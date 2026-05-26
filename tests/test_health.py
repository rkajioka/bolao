from __future__ import annotations

from unittest.mock import patch

from app.core.config import Settings


def test_health_ok(client) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_security_headers_hsts_quando_producao_https(client) -> None:
    prod_settings = Settings(
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret="test-secret-key-for-pytest-32chars!!",
        debug=False,
        public_app_url="https://bolao.example.com",
        jwt_refresh_cookie_secure=True,
    )
    with patch("app.main.settings", prod_settings):
        response = client.get("/health")
    assert response.status_code == 200
    assert response.headers.get("strict-transport-security") == (
        "max-age=31536000; includeSubDomains"
    )
