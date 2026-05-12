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
