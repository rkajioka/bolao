import re

_AVATAR_URL_RE = re.compile(
    r"^/static/uploads/avatars/[a-f0-9]{32}\.(jpg|jpeg|png|webp)$"
)


def validar_avatar_url(url: str | None) -> str | None:
    if url is None:
        return None
    normalized = url.strip()
    if not normalized:
        return None
    if not _AVATAR_URL_RE.fullmatch(normalized):
        raise ValueError("URL de avatar inválida")
    return normalized
