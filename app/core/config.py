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
    rate_limit_window_seconds: int = 60
    debug: bool = False
    public_app_url: str = "http://localhost:5173"
    azure_client_id: str | None = None
    azure_client_secret: str | None = None
    azure_tenant_id: str | None = None
    outlook_sender: str | None = None
    graph_api_url: str = "https://graph.microsoft.com/v1.0"
    graph_api_scope: str = "https://graph.microsoft.com/.default"


@lru_cache
def get_settings() -> Settings:
    return Settings()
