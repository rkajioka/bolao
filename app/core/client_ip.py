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
    return "unknown"
