"""
Esvazia dados operacionais do bolão preservando paises, jogos e usuarios.

Uso (com DATABASE_URL no ambiente ou .env):
  py scripts/wipe_operational_data.py --confirm --keep-all-users

Modo legado (apenas um owner):
  py scripts/wipe_operational_data.py --confirm --keep-email owner@empresa.com

Modo apenas paises + owner novo:
  py scripts/wipe_operational_data.py --confirm --keep-only-paises --replace-owner --create-owner-email owner@o.com.br --create-owner-senha admin --create-owner-nome Owner --allow-short-owner-senha
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

TRUNCATE_ALL_EXCEPT_PAISES = (
    *TRUNCATE_TABLES,
    "usuarios",
    "jogos",
    "empresas",
    "configuracao_email",
    "plataforma_temas",
)


def _count(db: Session, model) -> int:
    return int(db.scalar(select(func.count()).select_from(model)) or 0)


def _resolve_owner_id(
    db: Session,
    keep_email: str | None,
    create_email: str | None,
    create_senha: str | None,
    create_nome: str | None,
    *,
    replace_owner: bool = False,
    allow_short_owner_senha: bool = False,
) -> int:
    if keep_email:
        email = keep_email.strip().lower()
        owner = usuario_service.get_by_email(db, email)
        if owner is None:
            raise SystemExit(f"Owner não encontrado para --keep-email={email}")
        if owner.tipo_usuario != "owner":
            raise SystemExit(f"Usuário {email} não é owner (tipo={owner.tipo_usuario})")
        return owner.id

    if not replace_owner:
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
    if not allow_short_owner_senha and len(create_senha) < 8:
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


def _truncate_all_except_paises(db: Session) -> None:
    tables = ",\n            ".join(TRUNCATE_ALL_EXCEPT_PAISES)
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


def _delete_all_users(db: Session) -> int:
    result = db.execute(text("DELETE FROM usuarios"))
    return int(result.rowcount or 0)


def _reset_jogos_agenda(db: Session) -> int:
    result = db.execute(
        text(
            """
            UPDATE jogos
            SET
                placar_casa = NULL,
                placar_fora = NULL,
                teve_prorrogacao = FALSE,
                foi_para_penaltis = FALSE,
                penaltis_casa = NULL,
                penaltis_fora = NULL,
                classificado_id = NULL,
                finalizado = FALSE
            """
        )
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
    *,
    removed_users: int,
    removed_empresas: int,
    jogos_reiniciados: int,
    owner_id: int | None = None,
) -> None:
    owner = db.get(Usuario, owner_id) if owner_id is not None else None
    print("Reset concluído.")
    print(f"  paises: {_count(db, Pais)}")
    print(f"  jogos: {_count(db, Jogo)}")
    print(f"  usuarios: {_count(db, Usuario)}")
    print(f"  empresas: {_count(db, Empresa)}")
    print(f"  palpites_jogos: {_count(db, PalpiteJogo)}")
    print(f"  jogos reiniciados: {jogos_reiniciados}")
    if owner is not None:
        print(f"  owner: id={owner.id} email={owner.email}")
    print(f"  usuarios removidos: {removed_users}")
    print(f"  empresas removidas: {removed_empresas}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Zera dados operacionais preservando paises, jogos e usuarios."
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
    parser.add_argument(
        "--replace-owner",
        action="store_true",
        help="Remove todos os usuários e cria o owner informado em --create-owner-*.",
    )
    parser.add_argument(
        "--keep-all-users",
        action="store_true",
        help="Preserva todos os usuários cadastrados (remove empresas e dados operacionais).",
    )
    parser.add_argument(
        "--keep-only-paises",
        action="store_true",
        help="Remove todos os dados exceto a tabela paises (inclui jogos e usuarios).",
    )
    parser.add_argument(
        "--allow-short-owner-senha",
        action="store_true",
        help="Permite senha do owner com menos de 8 caracteres (uso local).",
    )
    args = parser.parse_args()

    if not args.confirm:
        print(
            "Modo dry-run: nenhum dado será apagado. Use --confirm para executar o reset irreversível.",
            file=sys.stderr,
        )
        print("Seriam executados: TRUNCATE das tabelas operacionais e limpeza conforme flags informadas.")
        if args.keep_only_paises:
            print("  modo: --keep-only-paises (preserva apenas paises)")
        elif args.keep_all_users:
            print("  modo: --keep-all-users")
        elif args.replace_owner:
            print("  modo: --replace-owner")
        elif args.keep_email:
            print(f"  modo: manter usuário {args.keep_email}")
        else:
            print("  modo: reset operacional padrão")
        sys.exit(1)

    db: Session = SessionLocal()
    try:
        paises_antes = _count(db, Pais)
        jogos_antes = _count(db, Jogo)
        print(f"Antes: paises={paises_antes}, jogos={jogos_antes}")

        if args.replace_owner and args.keep_email:
            raise SystemExit("Use apenas --replace-owner ou --keep-email, não os dois.")
        if args.keep_all_users and (args.keep_email or args.replace_owner or args.keep_only_paises):
            raise SystemExit("Use --keep-all-users sozinho ou o modo legado de owner.")
        if args.keep_only_paises and not args.replace_owner:
            raise SystemExit("--keep-only-paises exige --replace-owner e --create-owner-*.")

        if args.keep_only_paises:
            _truncate_all_except_paises(db)
            removed_empresas = 0
            jogos_reiniciados = 0
            removed_users = 0
            owner_id = _resolve_owner_id(
                db,
                None,
                args.create_owner_email,
                args.create_owner_senha,
                args.create_owner_nome,
                replace_owner=True,
                allow_short_owner_senha=args.allow_short_owner_senha,
            )
        else:
            _truncate_operational_tables(db)
            removed_empresas = _delete_empresas(db)
            jogos_reiniciados = _reset_jogos_agenda(db)
            owner_id: int | None = None
            if args.keep_all_users:
                removed_users = 0
            elif args.replace_owner:
                removed_users = _delete_all_users(db)
                owner_id = _resolve_owner_id(
                    db,
                    None,
                    args.create_owner_email,
                    args.create_owner_senha,
                    args.create_owner_nome,
                    replace_owner=True,
                    allow_short_owner_senha=args.allow_short_owner_senha,
                )
            else:
                owner_id = _resolve_owner_id(
                    db,
                    args.keep_email,
                    args.create_owner_email,
                    args.create_owner_senha,
                    args.create_owner_nome,
                    allow_short_owner_senha=args.allow_short_owner_senha,
                )
                removed_users = _delete_other_users(db, owner_id)
        if owner_id is not None:
            _normalize_owner(db, owner_id)
        _ensure_configuracao_email(db)
        _ensure_plataforma_tema(db)
        db.commit()

        paises_depois = _count(db, Pais)
        jogos_depois = _count(db, Jogo)
        if paises_depois != paises_antes:
            raise SystemExit(
                "Erro: contagem de paises mudou após o reset "
                f"(paises {paises_antes}->{paises_depois})."
            )
        if args.keep_only_paises:
            if jogos_depois != 0:
                raise SystemExit(
                    "Erro: jogos deveriam estar vazios após --keep-only-paises "
                    f"(jogos={jogos_depois})."
                )
        elif jogos_depois != jogos_antes:
            raise SystemExit(
                "Erro: contagem de jogos mudou após o reset "
                f"(jogos {jogos_antes}->{jogos_depois})."
            )

        _print_summary(
            db,
            owner_id=owner_id,
            removed_users=removed_users,
            removed_empresas=removed_empresas,
            jogos_reiniciados=jogos_reiniciados,
        )
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
