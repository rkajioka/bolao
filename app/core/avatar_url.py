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


def resolver_url_avatar_publica(
    avatar_url: str | None,
    imagem_perfil: str | None,
) -> str | None:
    """Retorna URL de avatar apenas se passar validação (evita XSS via imagem_perfil legado)."""
    for candidato in (avatar_url, imagem_perfil):
        if candidato is None:
            continue
        try:
            return validar_avatar_url(candidato)
        except ValueError:
            continue
    return None
