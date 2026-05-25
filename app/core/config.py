"""
Configuração central da aplicação.

Hierarquia de precedência (maior → menor):
  1. AWS Secrets Manager  (quando AWS_SECRET_NAME estiver definido)
  2. Variáveis de ambiente / arquivo .env
  3. Valores padrão definidos nesta classe

Campos sensíveis gerenciados pelo AWS Secrets Manager:
  DATABASE_URL, JWT_SECRET,
  AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID,
  OUTLOOK_SENDER, REDIS_URL

Todos os outros campos (flags, URLs públicas, timeouts) ficam no .env
ou nas variáveis de ambiente do processo.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Placeholders que indicam segredo não configurado — a aplicação recusa boot
# quando encontrar qualquer um desses valores em produção (debug=False).
_INSECURE_JWT_SECRETS = frozenset(
    {
        "change-me-in-production",
        "altere-este-segredo-em-producao",
        "secret",
        "changeme",
        "",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ------------------------------------------------------------------ #
    # Credenciais — gerenciadas pelo AWS Secrets Manager em produção       #
    # ------------------------------------------------------------------ #
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/bolao_copa"
    jwt_secret: str = "change-me-in-production"
    azure_client_id: str | None = None
    azure_client_secret: str | None = None
    azure_tenant_id: str | None = None
    outlook_sender: str | None = None
    redis_url: str | None = None

    # ------------------------------------------------------------------ #
    # AWS Secrets Manager                                                  #
    # ------------------------------------------------------------------ #
    aws_secret_name: str | None = None   # ex.: "bolao/production"
    aws_region: str = "us-east-1"

    # ------------------------------------------------------------------ #
    # JWT / Cookies                                                        #
    # ------------------------------------------------------------------ #
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_minutes: int = 60 * 24 * 7
    jwt_refresh_cookie_name: str = "bolao_refresh_token"
    jwt_refresh_cookie_secure: bool = False
    jwt_refresh_cookie_samesite: str = "lax"
    jwt_refresh_cookie_path: str = "/auth"

    # ------------------------------------------------------------------ #
    # Rate limit                                                           #
    # ------------------------------------------------------------------ #
    rate_limit_login_requests: int = 5
    rate_limit_refresh_requests: int = 20
    rate_limit_avatar_pre_ip_requests: int = 10
    rate_limit_avatar_pre_token_requests: int = 5
    rate_limit_window_seconds: int = 60

    # ------------------------------------------------------------------ #
    # Geral                                                                #
    # ------------------------------------------------------------------ #
    debug: bool = False
    public_app_url: str = "http://localhost:5173"
    cors_allowed_origins: str | None = None

    # ------------------------------------------------------------------ #
    # Microsoft Graph / e-mail                                             #
    # ------------------------------------------------------------------ #
    graph_api_url: str = "https://graph.microsoft.com/v1.0"
    graph_api_scope: str = "https://graph.microsoft.com/.default"
    email_max_attempts: int = 3
    email_retry_backoff_seconds: float = 2.0
    email_bulk_interval_seconds: float = 1.0

    # ------------------------------------------------------------------ #
    # Validators                                                           #
    # ------------------------------------------------------------------ #

    @model_validator(mode="after")
    def load_from_aws_secrets_manager(self) -> "Settings":
        """
        Se AWS_SECRET_NAME estiver definido, busca o secret JSON no AWS
        Secrets Manager e sobrescreve os campos sensíveis.

        O validator roda após a resolução normal de env vars / .env,
        portanto o AWS sempre tem precedência sobre essas fontes.

        Em caso de falha (rede, throttle, permissão), a aplicação continua
        com as variáveis de ambiente já carregadas — não crasha o boot.
        Erros permanentes (secret não existe, acesso negado) ainda propagam.
        """
        if not self.aws_secret_name:
            return self

        from app.core.aws_secrets import apply_to_settings

        try:
            apply_to_settings(self, self.aws_secret_name, self.aws_region)
        except RuntimeError as exc:
            # Erros transientes (timeout, throttle) já foram retentados em
            # aws_secrets.fetch_secret. Se ainda falhou, loga e continua
            # com variáveis de ambiente — melhor degradado do que fora do ar.
            logger.error(
                "AWS Secrets Manager indisponível após retentativas. "
                "Continuando com variáveis de ambiente como fallback. "
                "ATENÇÃO: verifique as credenciais e a conectividade com a AWS. "
                "Erro: %s",
                exc,
            )
        return self

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """
        Em produção (debug=False), recusa iniciar com segredos inválidos.
        Garante que ninguém sobe por acidente com os placeholders padrão.
        """
        if self.debug:
            return self

        if self.jwt_secret.strip().lower() in _INSECURE_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET não pode ser um placeholder em produção. "
                "Gere um segredo forte: openssl rand -hex 32"
            )

        uses_https = self.public_app_url.startswith("https://")
        if uses_https and not self.jwt_refresh_cookie_secure:
            raise ValueError(
                "JWT_REFRESH_COOKIE_SECURE deve ser True quando PUBLIC_APP_URL "
                "usa HTTPS. O cookie de refresh token seria transmitido sem a "
                "flag Secure, expondo-o em conexões não-criptografadas. "
                "Defina JWT_REFRESH_COOKIE_SECURE=true no ambiente de produção."
            )

        if not uses_https and not self.jwt_refresh_cookie_secure:
            logger.warning(
                "JWT_REFRESH_COOKIE_SECURE está False em produção. "
                "Certifique-se de que a aplicação está atrás de HTTPS."
            )

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


def cors_origins_for_settings(settings: Settings) -> list[str]:
    if settings.cors_allowed_origins:
        origins = [
            origin.strip().rstrip("/")
            for origin in settings.cors_allowed_origins.split(",")
            if origin.strip()
        ]
        if origins:
            return origins

    origins: list[str] = []
    public = settings.public_app_url.strip().rstrip("/")
    if public:
        origins.append(public)

    # localhost:5173 só é adicionado automaticamente em modo debug
    if settings.debug:
        dev_origin = "http://localhost:5173"
        if dev_origin not in origins:
            origins.append(dev_origin)

    return origins
