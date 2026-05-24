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


@functools.lru_cache(maxsize=1)
def fetch_secret(secret_name: str, region: str) -> dict[str, Any]:
    """
    Busca o secret_name no AWS Secrets Manager e retorna o JSON parseado.

    O resultado é cacheado em memória pelo tempo de vida do processo
    (lru_cache). Para forçar recarga, chame fetch_secret.cache_clear().

    Raises:
        ImportError: se boto3 não estiver instalado.
        RuntimeError: se o secret não for encontrado ou não for JSON válido.
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

    try:
        response = client.get_secret_value(SecretId=secret_name)
    except ClientError as exc:
        error_code = exc.response["Error"]["Code"]
        raise RuntimeError(
            f"Não foi possível obter o secret '{secret_name}' ({error_code}): {exc}"
        ) from exc

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
