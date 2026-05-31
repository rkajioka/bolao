"""
Integração com AWS Secrets Manager.

Busca um secret JSON e retorna como dict. Faz cache em memória para
evitar chamadas repetidas ao AWS a cada requisição.

Uso típico (produção):
  export AWS_SECRET_NAME=bolao/production
  export AWS_REGION=us-east-1

Em desenvolvimento o módulo não é chamado (AWS_SECRET_NAME não definido),
então boto3 nem precisa estar instalado no ambiente local.
"""

from __future__ import annotations

import functools
import json
import logging
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

# Campos sensíveis que o secret manager pode sobrescrever.
# Devem corresponder exatamente aos atributos da classe Settings (snake_case).
MANAGED_FIELDS = frozenset(
    {
        "database_url",
        "jwt_secret",
        "azure_client_id",
        "azure_client_secret",
        "azure_tenant_id",
        "outlook_sender",
        "redis_url",
    }
)

_MAX_RETRIES = 3
_RETRY_BACKOFF_SECONDS = (1, 2, 4)


@functools.lru_cache(maxsize=1)
def fetch_secret(secret_name: str, region: str) -> dict[str, Any]:
    """
    Busca o secret_name no AWS Secrets Manager e retorna o JSON parseado.

    Tenta até _MAX_RETRIES vezes com backoff exponencial antes de desistir.
    O resultado é cacheado em memória pelo tempo de vida do processo.
    Para forçar recarga, chame fetch_secret.cache_clear().

    Raises:
        ImportError: se boto3 não estiver instalado.
        RuntimeError: se o secret não for encontrado ou não for JSON válido
                      após todas as tentativas.
    """
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError as exc:
        raise ImportError(
            "boto3 é necessário para usar AWS Secrets Manager. "
            "Instale com: pip install boto3"
        ) from exc

    logger.info("Buscando secret '%s' na região '%s'", secret_name, region)

    client = boto3.session.Session().client(
        service_name="secretsmanager",
        region_name=region,
    )

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = client.get_secret_value(SecretId=secret_name)
            break
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            last_exc = exc
            # Erros permanentes não vale retentativas
            if error_code in ("ResourceNotFoundException", "InvalidParameterException",
                               "InvalidRequestException", "AccessDeniedException"):
                raise RuntimeError(
                    f"Não foi possível obter o secret '{secret_name}' ({error_code}): {exc}"
                ) from exc
            if attempt < _MAX_RETRIES - 1:
                wait = _RETRY_BACKOFF_SECONDS[attempt]
                logger.warning(
                    "Tentativa %d/%d falhou (%s). Aguardando %ds...",
                    attempt + 1, _MAX_RETRIES, error_code, wait,
                )
                time.sleep(wait)
    else:
        raise RuntimeError(
            f"Não foi possível obter o secret '{secret_name}' após "
            f"{_MAX_RETRIES} tentativas: {last_exc}"
        )

    secret_string = response.get("SecretString")
    if not secret_string:
        raise RuntimeError(
            f"Secret '{secret_name}' não contém SecretString (binary secrets não são suportados)"
        )

    try:
        data: dict[str, Any] = json.loads(secret_string)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Secret '{secret_name}' não é um JSON válido: {exc}"
        ) from exc

    logger.info(
        "Secret '%s' carregado com sucesso (%d campo(s))",
        secret_name,
        len(data),
    )
    return data


_DB_URL_TTL = 300  # segundos entre re-fetches do secret para novas conexões
_db_url_lock = threading.Lock()
_db_url_cache: dict[str, Any] = {"url": None, "fetched_at": 0.0}


def get_current_database_url(secret_name: str, region: str) -> str | None:
    """Retorna DATABASE_URL do Secrets Manager com cache TTL de 5 minutos.

    Chamado pelo creator function do engine a cada nova conexão criada.
    Usar cache curto (não lru_cache eterno) para absorver rotações de senha.
    """
    with _db_url_lock:
        now = time.monotonic()
        if _db_url_cache["url"] is not None and (now - _db_url_cache["fetched_at"]) < _DB_URL_TTL:
            return _db_url_cache["url"]  # type: ignore[return-value]
        fetch_secret.cache_clear()
        try:
            data = fetch_secret(secret_name, region)
            url: str | None = data.get("database_url")
            _db_url_cache["url"] = url
            _db_url_cache["fetched_at"] = now
            logger.info("Credenciais do banco re-carregadas do Secrets Manager")
            return url
        except Exception as exc:
            logger.error("Falha ao buscar DATABASE_URL do Secrets Manager: %s", exc)
            return _db_url_cache["url"]  # type: ignore[return-value]


def invalidate_database_url_cache() -> None:
    """Força re-fetch imediato das credenciais do banco na próxima conexão."""
    with _db_url_lock:
        _db_url_cache["fetched_at"] = 0.0
    fetch_secret.cache_clear()
    logger.warning("Cache de DATABASE_URL invalidado — próxima conexão buscará credenciais novas")


def apply_to_settings(settings_obj: Any, secret_name: str, region: str) -> None:
    """
    Busca o secret e aplica os campos gerenciados sobre o objeto settings_obj.

    Apenas campos presentes em MANAGED_FIELDS e que existam no modelo são
    sobrescritos — campos desconhecidos no secret são ignorados com aviso.
    """
    secret_data = fetch_secret(secret_name, region)

    for raw_key, value in secret_data.items():
        field = raw_key.lower()

        if field not in MANAGED_FIELDS:
            logger.debug("Campo '%s' do secret não é gerenciado, ignorando", raw_key)
            continue

        if not hasattr(settings_obj, field):
            logger.warning(
                "Campo '%s' do secret não existe em Settings, ignorando", field
            )
            continue

        object.__setattr__(settings_obj, field, value)
        logger.debug("Campo '%s' sobrescrito pelo AWS Secrets Manager", field)
