import time
from datetime import timedelta
from typing import Any
from uuid import uuid4

import jwt
from jwt.exceptions import PyJWTError

from app.core.config import get_settings

settings = get_settings()

# Algoritmo fixado explicitamente — impede ataques de confusão de algoritmo
# (ex.: troca de HS256 por "none" ou RS256 com chave pública como HMAC).
_ALGORITHM = "HS256"


def create_access_token(
    subject: str | int,
    extra_claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_access_token_expire_minutes)
    now = int(time.time())
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + int(expires_delta.total_seconds()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM)


def create_refresh_token(
    subject: str | int,
    expires_delta: timedelta | None = None,
    jti: str | None = None,
) -> tuple[str, str]:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_refresh_token_expire_minutes)
    now = int(time.time())
    token_jti = jti or str(uuid4())
    payload: dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": now + int(expires_delta.total_seconds()),
        "typ": "refresh",
        "jti": token_jti,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_ALGORITHM), token_jti


def decode_access_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[_ALGORITHM],  # lista explícita — rejeita "none" e outros
    )
    if payload.get("typ") == "refresh":
        raise PyJWTError("Tipo de token inválido para acesso")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[_ALGORITHM],
    )
    if payload.get("typ") != "refresh":
        raise PyJWTError("Tipo de token inválido para refresh")
    if "jti" not in payload:
        raise PyJWTError("Refresh token sem jti")
    return payload


def decode_access_token_safe(token: str) -> dict[str, Any] | None:
    try:
        return decode_access_token(token)
    except PyJWTError:
        return None


def decode_refresh_token_safe(token: str) -> dict[str, Any] | None:
    try:
        return decode_refresh_token(token)
    except PyJWTError:
        return None
