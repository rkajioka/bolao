"""Upload de avatar para perfil — arquivos em static/uploads/avatars."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

AVATAR_MAX_BYTES = 2 * 1024 * 1024  # 2 MiB

_CONTENT_EXT: dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def project_static_root() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "static"


def avatar_upload_dir() -> Path:
    return project_static_root() / "uploads" / "avatars"


async def read_upload_limited(file: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    chunk_size = 64 * 1024
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        if total + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Arquivo excede o limite de {max_bytes // (1024 * 1024)} MB",
            )
        total += len(chunk)
        chunks.append(chunk)
    return b"".join(chunks)


def persist_avatar(data: bytes, content_type: str | None) -> str:
    if not content_type or content_type not in _CONTENT_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use imagem JPEG, PNG ou WebP",
        )
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo vazio",
        )
    ext = _CONTENT_EXT[content_type]
    upload_dir = avatar_upload_dir()
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    path = upload_dir / name
    path.write_bytes(data)
    return f"/static/uploads/avatars/{name}"
