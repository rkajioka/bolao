"""
Seed opcional: cria um usuário administrador se o e-mail ainda não existir.

Uso (com venv ativo e DATABASE_URL no ambiente ou .env):
  python scripts/seed_admin.py --email admin@example.com --senha "SenhaForte1" --nome "Admin"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models.usuario import Usuario
from app.services import usuario_service


def main() -> None:
    p = argparse.ArgumentParser(description="Cria usuário admin inicial (idempotente por e-mail).")
    p.add_argument("--email", required=True)
    p.add_argument("--senha", required=True, min_length=8)
    p.add_argument("--nome", required=True)
    args = p.parse_args()
    email = args.email.strip().lower()

    db: Session = SessionLocal()
    try:
        if usuario_service.get_by_email(db, email):
            print("E-mail já cadastrado; nenhuma alteração feita.")
            return
        u = Usuario(
            nome=args.nome,
            email=email,
            senha_hash=hash_password(args.senha),
            funcao="Administrador",
            imagem_perfil=None,
            tipo_usuario="admin",
            ativo=True,
            primeiro_login=False,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        print(f"Admin criado: id={u.id} email={u.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
