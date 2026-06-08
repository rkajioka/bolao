from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.core.password_defaults import SENHA_PADRAO_TEMPORARIA
from app.models.convite import Convite
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.services import audit_log_service, auth_service, convite_service, email_dispatch_service, empresa_quota_service

OrigemProvisionamento = Literal["admin", "script"]


@dataclass(frozen=True)
class ProvisionarExpiradosItemResultado:
    email: str
    status: str
    detalhe: str | None = None


@dataclass(frozen=True)
class ProvisionarExpiradosLoteResultado:
    total: int
    provisionados: int
    erros: int
    itens: list[ProvisionarExpiradosItemResultado]


def _lock_convite(db: Session, convite_id: int, empresa_id: int) -> Convite:
    convite = db.scalar(
        select(Convite)
        .where(and_(Convite.id == convite_id, Convite.empresa_id == empresa_id))
        .with_for_update()
    )
    if convite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite não encontrado")
    return convite


def _aplicar_senha_padrao(db: Session, usuario: Usuario) -> None:
    usuario.senha_hash = hash_password(SENHA_PADRAO_TEMPORARIA)
    auth_service.revogar_refresh_tokens_usuario(db, usuario.id)


def _validar_usuario_para_convite(db: Session, convite: Convite) -> Usuario | None:
    usuario = db.scalar(select(Usuario).where(Usuario.email == convite.email))
    if usuario is None:
        return None
    if (
        usuario.empresa_id is not None
        and usuario.empresa_id != convite.empresa_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este e-mail já está vinculado a outro bolão.",
        )
    if not usuario.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conta já ativada",
        )
    return usuario


def provisionar_convite_senha_padrao(
    db: Session,
    convite: Convite,
    *,
    solicitante_id: int | None,
    ip: str | None,
    origem: OrigemProvisionamento,
) -> tuple[bool, int]:
    """Provisiona acesso com senha padrão a partir de um convite. Retorna (criado, usuario_id)."""
    if convite.usado_em is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este convite já foi utilizado",
        )

    usuario = _validar_usuario_para_convite(db, convite)
    criado = usuario is None

    if criado:
        empresa = db.get(Empresa, convite.empresa_id)
        if empresa is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")
        try:
            empresa_quota_service.validar_limite_usuarios(db, empresa)
        except HTTPException:
            ocupacao = empresa_quota_service.ocupacao_atual(db, empresa.id)
            email_dispatch_service.notificar_owners_limite_usuarios(
                db,
                empresa_id=empresa.id,
                empresa_nome=empresa.nome,
                max_usuarios=empresa.max_usuarios,
                ocupacao_atual=ocupacao,
                operacao="ativação com senha padrão",
                emails_bloqueados=[convite.email],
            )
            raise

        usuario = Usuario(
            empresa_id=convite.empresa_id,
            email=convite.email,
            nome=convite.email,
            senha_hash=hash_password(SENHA_PADRAO_TEMPORARIA),
            tipo_usuario="usuario",
            ativo=True,
            bloqueado=False,
            primeiro_login=True,
        )
        db.add(usuario)
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está cadastrado",
            ) from exc
    else:
        assert usuario is not None
        if usuario.empresa_id is None:
            usuario.empresa_id = convite.empresa_id
        _aplicar_senha_padrao(db, usuario)
        db.flush()

    convite_service.marcar_usado(db, convite)

    audit_log_service.log(
        db,
        acao="convite.provisionado_senha_padrao",
        usuario_id=solicitante_id,
        empresa_id=convite.empresa_id,
        alvo=convite.email,
        metadata={"origem": origem, "criado": criado},
        ip=ip,
    )

    db.commit()
    db.refresh(usuario)
    return criado, usuario.id


def provisionar_convite_senha_padrao_por_id(
    db: Session,
    convite_id: int,
    empresa_id: int,
    *,
    solicitante_id: int | None,
    ip: str | None,
    origem: OrigemProvisionamento,
) -> tuple[bool, int]:
    convite = _lock_convite(db, convite_id, empresa_id)
    return provisionar_convite_senha_padrao(
        db,
        convite,
        solicitante_id=solicitante_id,
        ip=ip,
        origem=origem,
    )


def reaplicar_senha_padrao_usuario(
    db: Session,
    usuario: Usuario,
    *,
    solicitante_id: int | None,
    ip: str | None,
) -> None:
    if not usuario.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conta já ativada",
        )

    _aplicar_senha_padrao(db, usuario)

    audit_log_service.log(
        db,
        acao="equipe.senha_padrao_reaplicada",
        usuario_id=solicitante_id,
        empresa_id=usuario.empresa_id,
        alvo=str(usuario.id),
        ip=ip,
    )

    db.commit()


def listar_convites_expirados_elegiveis(db: Session, empresa_id: int) -> list[Convite]:
    convites = list(
        db.scalars(
            select(Convite)
            .where(
                Convite.empresa_id == empresa_id,
                Convite.usado_em.is_(None),
                Convite.expiracao < datetime.now(UTC),
            )
            .order_by(Convite.email.asc())
        ).all()
    )
    elegiveis: list[Convite] = []
    for convite in convites:
        usuario = db.scalar(select(Usuario).where(Usuario.email == convite.email))
        if usuario is not None:
            if (
                usuario.empresa_id is not None
                and usuario.empresa_id != convite.empresa_id
            ):
                continue
            if not usuario.primeiro_login:
                continue
        elegiveis.append(convite)
    return elegiveis


def provisionar_convites_expirados_lote(
    db: Session,
    empresa_id: int,
    *,
    solicitante_id: int | None,
    ip: str | None,
    origem: OrigemProvisionamento,
    dry_run: bool = False,
) -> ProvisionarExpiradosLoteResultado:
    convites = listar_convites_expirados_elegiveis(db, empresa_id)
    itens: list[ProvisionarExpiradosItemResultado] = []
    provisionados = 0
    erros = 0

    for convite in convites:
        if dry_run:
            itens.append(
                ProvisionarExpiradosItemResultado(
                    email=convite.email,
                    status="simulado",
                    detalhe="Seria provisionado com senha padrão",
                )
            )
            continue
        try:
            criado, _ = provisionar_convite_senha_padrao_por_id(
                db,
                convite.id,
                empresa_id,
                solicitante_id=solicitante_id,
                ip=ip,
                origem=origem,
            )
            provisionados += 1
            itens.append(
                ProvisionarExpiradosItemResultado(
                    email=convite.email,
                    status="ok",
                    detalhe="criado" if criado else "senha reaplicada",
                )
            )
        except HTTPException as exc:
            erros += 1
            db.rollback()
            detalhe = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            itens.append(
                ProvisionarExpiradosItemResultado(
                    email=convite.email,
                    status="erro",
                    detalhe=detalhe,
                )
            )
        except Exception as exc:
            erros += 1
            db.rollback()
            itens.append(
                ProvisionarExpiradosItemResultado(
                    email=convite.email,
                    status="erro",
                    detalhe=str(exc),
                )
            )

    return ProvisionarExpiradosLoteResultado(
        total=len(convites),
        provisionados=provisionados,
        erros=erros,
        itens=itens,
    )
