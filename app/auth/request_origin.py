"""Validação de origem das requisições sensíveis (refresh, logout).

LIMITAÇÃO DE SEGURANÇA (Sprint 2.9)
====================================
O header X-Bolao-Client não é proteção CSRF real — qualquer script rodando no
browser pode adicionar headers customizados via fetch/XMLHttpRequest, então este
check sozinho não impede CSRF em browsers modernos com CORS permissivo.

O que X-Bolao-Client + Origin/Referer fazem juntos:
  1. Bloqueiam ferramentas fora do browser (curl, Postman sem o header).
  2. Validam que o Origin/Referer pertence a um domínio permitido.

Proteção CSRF real é fornecida pelo cookie HttpOnly + SameSite:
  - SameSite=Strict  → cookie não é enviado em requests cross-site (melhor).
  - SameSite=Lax     → cookie enviado apenas em GET top-level cross-site.

O valor de jwt_refresh_cookie_samesite é configurável via JWT_REFRESH_COOKIE_SAMESITE.
Para máxima proteção, defina SameSite=Strict no ambiente de produção (Sprint 1.5).
Enquanto isso, a combinação X-Bolao-Client + Origin constitui defesa em profundidade,
não uma garantia CSRF isolada.
"""

from urllib.parse import urlparse

from fastapi import HTTPException, Request, status

from app.core.config import cors_origins_for_settings, get_settings


def assert_bolao_client_request(request: Request) -> None:
    if request.headers.get("X-Bolao-Client") != "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requisição não permitida",
        )

    settings = get_settings()
    allowed_hosts = {urlparse(origin).netloc for origin in cors_origins_for_settings(settings)}

    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    host: str | None = None
    if origin:
        host = urlparse(origin).netloc
    elif referer:
        host = urlparse(referer).netloc

    if not host or host not in allowed_hosts:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requisição não permitida",
        )
