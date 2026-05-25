"""Configuração de produção — cookies e headers."""

from __future__ import annotations

from app.core.config import Settings


def test_producao_https_forca_cookie_strict() -> None:
    prod = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="test-secret-key-for-pytest-32chars!!",
        debug=False,
        public_app_url="https://bolao.example.com",
        jwt_refresh_cookie_secure=True,
        jwt_refresh_cookie_samesite="lax",
    )
    assert prod.jwt_refresh_cookie_samesite == "strict"
