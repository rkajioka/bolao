"""IP do cliente considerando proxy reverso confiável."""

from __future__ import annotations

import ipaddress

from fastapi import Request

from app.core.config import get_settings


def _parse_ip(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        return None


def client_ip(request: Request) -> str:
    """Retorna o IP do cliente para uso em rate limiting e auditoria.

    Quando trusted_proxy=True, os headers X-Forwarded-For / X-Real-IP são
    considerados confiáveis (injetados pelo proxy reverso) e usados diretamente.

    Quando trusted_proxy=False (default), os headers NÃO são confiáveis (podem
    ser forjados pelo cliente), mas ainda são usados como fallback com prefixo
    "fwd:" quando não há request.client — isso evita que todos os IPs sem
    conexão direta colapssem no mesmo bucket "unknown" e se bloqueiem mutuamente.

    IMPORTANTE: o valor "fwd:<ip>" pode ser forjado; não usar para decisões de
    segurança além de rate limiting quando trusted_proxy=False.
    """
    settings = get_settings()
    if settings.trusted_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            parsed = _parse_ip(first)
            if parsed:
                return parsed
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            parsed = _parse_ip(real_ip.strip())
            if parsed:
                return parsed

    if request.client and request.client.host:
        return request.client.host

    # Fallback para evitar que bucket "unknown" seja compartilhado por todos os
    # requests sem request.client (ex.: testes de carga, Lambda, edge functions).
    # O prefixo "fwd:" distingue do IP confiável retornado quando trusted_proxy=True.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        parsed = _parse_ip(first)
        if parsed:
            return f"fwd:{parsed}"
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        parsed = _parse_ip(real_ip.strip())
        if parsed:
            return f"fwd:{parsed}"

    return "unknown"
