"""
Esvazia dados operacionais do bolão preservando paises, jogos e um único owner.

Uso (com DATABASE_URL no ambiente ou .env):
  py scripts/wipe_operational_data.py --confirm --keep-email owner@empresa.com

Se não existir owner:
  py scripts/wipe_operational_data.py --confirm \\
    --create-owner-email owner@empresa.com \\
    --create-owner-senha "SenhaForte1" \\
    --create-owner-nome "Owner"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.database import SessionLocal
from app.models.configuracao_email import ConfiguracaoEmail
from app.models.empresa import Empresa
from app.models.jogo import Jogo
from app.models.pais import Pais
from app.models.palpite_jogo import PalpiteJogo
from app.models.plataforma_tema import PlataformaTema
from app.models.usuario import Usuario
from app.services import usuario_service
from app.theme_defaults import DEFAULT_THEME_TOKENS_DARK, DEFAULT_THEME_TOKENS_LIGHT

TRUNCATE_TABLES = (
    "marcadores_brasil_palpite",
    "palpites_jogos",
    "marcadores_brasil_resultado",
    "palpites_especiais",
    "password_resets",
    "refresh_tokens",
    "convites",
    "audit_logs",
    "auditoria_admin",
    "candidatos_marcador_brasil",
    "resultados_especiais",
    "configuracoes_bolao",
    "pontuacao_fase",
    "empresa_temas",
)


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def _resolve_owner_id(
    db: Session,
    keep_email: str | None,
    create_email: str | None,
    create_senha: str | None,
    create_nome: str | None,
) -> int:
    if keep_email:
        email = keep_email.strip().lower()
        owner = usuario_service.get_by_email(db, email)
        if owner is None:
            raise SystemExit(f"Owner não encontrado para --keep-email={email}")
        if owner.tipo_usuario != "owner":
            raise SystemExit(f"Usuário {email} não é owner (tipo={owner.tipo_usuario})")
        return owner.id

    owner_id = db.scalar(
        select(func.min(Usuario.id)).where(Usuario.tipo_usuario == "owner")
    )
    if owner_id is not None:
        return int(owner_id)

    if not create_email or not create_senha or not create_nome:
        raise SystemExit(
            "Nenhum owner encontrado. Informe --keep-email ou "
            "--create-owner-email, --create-owner-senha e --create-owner-nome."
        )
    if len(create_senha) < 8:
        raise SystemExit("Erro: --create-owner-senha deve ter pelo menos 8 caracteres.")

    email = create_email.strip().lower()
    existing = usuario_service.get_by_email(db, email)
    if existing is not None:
        if existing.tipo_usuario != "owner":
            raise SystemExit(f"E-mail {email} já existe e não é owner.")
        return existing.id

    owner = Usuario(
        nome=create_nome,
        email=email,
        senha_hash=hash_password(create_senha),
        funcao="Owner",
        imagem_perfil=None,
        tipo_usuario="owner",
        ativo=True,
        primeiro_login=False,
        empresa_id=None,
    )
    db.add(owner)
    db.flush()
    return owner.id


def _truncate_operational_tables(db: Session) -> None:
    tables = ",\n            ".join(TRUNCATE_TABLES)
    db.execute(
        text(
            f"""
            TRUNCATE TABLE
                {tables}
            RESTART IDENTITY CASCADE;
            """
        )
    )


def _delete_empresas(db: Session) -> int:
    result = db.execute(text("DELETE FROM empresas"))
    return int(result.rowcount or 0)


def _delete_other_users(db: Session, owner_id: int) -> int:
    result = db.execute(
        text("DELETE FROM usuarios WHERE id <> :owner_id"),
        {"owner_id": owner_id},
    )
    return int(result.rowcount or 0)


def _normalize_owner(db: Session, owner_id: int) -> None:
    owner = db.get(Usuario, owner_id)
    if owner is None:
        raise SystemExit(f"Owner id={owner_id} não encontrado após limpeza.")
    owner.tipo_usuario = "owner"
    owner.empresa_id = None
    owner.ativo = True
    owner.primeiro_login = False


def _ensure_configuracao_email(db: Session) -> None:
    row = db.get(ConfiguracaoEmail, 1)
    if row is None:
        db.add(ConfiguracaoEmail(id=1, resend_api_key=None, email_from=None))
        return
    row.resend_api_key = None
    row.email_from = None


def _ensure_plataforma_tema(db: Session) -> None:
    count = int(db.scalar(select(func.count()).select_from(PlataformaTema)) or 0)
    if count > 0:
        return
    db.add(
        PlataformaTema(
            tokens_dark=dict(DEFAULT_THEME_TOKENS_DARK),
            tokens_light=dict(DEFAULT_THEME_TOKENS_LIGHT),
        )
    )


def _print_summary(
    db: Session,
    owner_id: int,
    removed_users: int,
    removed_empresas: int,
) -> None:
    owner = db.get(Usuario, owner_id)
    print("Reset concluído.")
    print(f"  paises: {_count(db, Pais)}")
    print(f"  jogos: {_count(db, Jogo)}")
    print(f"  usuarios: {_count(db, Usuario)}")
    print(f"  empresas: {_count(db, Empresa)}")
    print(f"  palpites_jogos: {_count(db, PalpiteJogo)}")
    if owner is not None:
        print(f"  owner: id={owner.id} email={owner.email}")
    print(f"  usuarios removidos: {removed_users}")
    print(f"  empresas removidas: {removed_empresas}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Zera dados operacionais preservando paises, jogos e um owner."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Confirma a execução irreversível do reset.",
    )
    parser.add_argument("--keep-email", default=None)
    parser.add_argument("--create-owner-email", default=None)
    parser.add_argument("--create-owner-senha", default=None)
    parser.add_argument("--create-owner-nome", default=None)
    args = parser.parse_args()

    if not args.confirm:
        print("Abortado: use --confirm para executar o reset.", file=sys.stderr)
        sys.exit(1)

    db: Session = SessionLocal()
    try:
        paises_antes = _count(db, Pais)
        jogos_antes = _count(db, Jogo)
        print(f"Antes: paises={paises_antes}, jogos={jogos_antes}")

        owner_id = _resolve_owner_id(
            db,
            args.keep_email,
            args.create_owner_email,
            args.create_owner_senha,
            args.create_owner_nome,
        )

        _truncate_operational_tables(db)
        removed_empresas = _delete_empresas(db)
        removed_users = _delete_other_users(db, owner_id)
        _normalize_owner(db, owner_id)
        _ensure_configuracao_email(db)
        _ensure_plataforma_tema(db)
        db.commit()

        paises_depois = _count(db, Pais)
        jogos_depois = _count(db, Jogo)
        if paises_depois != paises_antes or jogos_depois != jogos_antes:
            raise SystemExit(
                "Erro: contagem de paises/jogos mudou após o reset "
                f"(paises {paises_antes}->{paises_depois}, jogos {jogos_antes}->{jogos_depois})."
            )

        _print_summary(db, owner_id, removed_users, removed_empresas)
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
