from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/bolao_copa"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_minutes: int = 60 * 24 * 7
    jwt_refresh_cookie_name: str = "bolao_refresh_token"
    jwt_refresh_cookie_secure: bool = False
    jwt_refresh_cookie_samesite: str = "lax"
    jwt_refresh_cookie_path: str = "/auth"
    rate_limit_login_requests: int = 5
    rate_limit_refresh_requests: int = 20
    rate_limit_avatar_pre_ip_requests: int = 10
    rate_limit_avatar_pre_token_requests: int = 5
    rate_limit_window_seconds: int = 60
    debug: bool = False
    public_app_url: str = "http://localhost:5173"
    cors_allowed_origins: str | None = None
    azure_client_id: str | None = None
    azure_client_secret: str | None = None
    azure_tenant_id: str | None = None
    outlook_sender: str | None = None
    graph_api_url: str = "https://graph.microsoft.com/v1.0"
    graph_api_scope: str = "https://graph.microsoft.com/.default"
    email_max_attempts: int = 3
    email_retry_backoff_seconds: float = 2.0
    email_bulk_interval_seconds: float = 1.0


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
    dev_origin = "http://localhost:5173"
    if dev_origin not in origins:
        origins.append(dev_origin)
    return origins
