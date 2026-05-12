"""Remove arquivos de avatar em disco sem referência no banco."""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import get_settings  # noqa: E402
from app.models.usuario import Usuario  # noqa: E402
from app.services.avatar_upload_service import avatar_upload_dir  # noqa: E402


def _referenced_filenames(db: Session) -> set[str]:
    rows = db.execute(select(Usuario.avatar_url, Usuario.imagem_perfil)).all()
    names: set[str] = set()
    prefix = "/static/uploads/avatars/"
    for avatar_url, imagem_perfil in rows:
        for value in (avatar_url, imagem_perfil):
            if not value or not value.startswith(prefix):
                continue
            names.add(Path(value).name)
    return names


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove avatares órfãos em static/uploads/avatars.")
    parser.add_argument(
        "--min-age-hours",
        type=float,
        default=24.0,
        help="Idade mínima do arquivo em horas antes da remoção (default: 24).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Lista arquivos que seriam removidos sem apagar.",
    )
    args = parser.parse_args()

    upload_dir = avatar_upload_dir()
    if not upload_dir.exists():
        print("Diretório de avatares inexistente; nada a fazer.")
        return

    min_age_seconds = max(0.0, args.min_age_hours) * 3600.0
    now = time.time()
    engine = create_engine(get_settings().database_url, future=True)
    with Session(engine) as db:
        referenced = _referenced_filenames(db)

    removed = 0
    for path in sorted(upload_dir.iterdir()):
        if not path.is_file():
            continue
        if path.name in referenced:
            continue
        age = now - path.stat().st_mtime
        if age < min_age_seconds:
            continue
        if args.dry_run:
            print(f"[dry-run] removeria {path.name}")
        else:
            path.unlink(missing_ok=True)
            print(f"removido {path.name}")
        removed += 1

    if removed == 0:
        print("Nenhum avatar órfão elegível para remoção.")
    elif args.dry_run:
        print(f"{removed} arquivo(s) seriam removidos.")


if __name__ == "__main__":
    main()
