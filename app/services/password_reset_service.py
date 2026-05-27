import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy import and_, select, update as sa_update
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.models.empresa import Empresa
from app.models.password_reset import PasswordReset
from app.models.usuario import Usuario
from app.database import SessionLocal
from app.services import audit_log_service, auth_service, email_dispatch_service, email_service, usuario_service


_TOKEN_BYTES = 48
_EXPIRACAO_MINUTOS = 60
MotivoResetEmail = Literal["solicitacao", "conta_criada", "reset_gestor"]


def _gerar_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def _expiracao() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=_EXPIRACAO_MINUTOS)


def _empresa_nome(db: Session, empresa_id: int | None) -> str:
    if empresa_id is None:
        return "Bolão"
    empresa = db.get(Empresa, empresa_id)
    return empresa.nome if empresa is not None else "Bolão"


def _invalidar_tokens_pendentes(db: Session, usuario_id: int) -> None:
    # UPDATE atômico evita race condition onde dois requests simultâneos de reset
    # selecionariam os mesmos tokens pendentes antes de qualquer um marcar como usado.
    db.execute(
        sa_update(PasswordReset)
        .where(
            PasswordReset.usuario_id == usuario_id,
            PasswordReset.usado.is_(False),
        )
        .values(usado=True)
    )
    db.flush()


def _criar_token_reset(
    db: Session,
    usuario: Usuario,
    *,
    ip: str | None,
    acao_auditoria: str,
) -> str:
    _invalidar_tokens_pendentes(db, usuario.id)
    token = _gerar_token()
    db.add(
        PasswordReset(
            usuario_id=usuario.id,
            token=token,
            expiracao=_expiracao(),
        )
    )
    audit_log_service.log(
        db,
        acao=acao_auditoria,
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
        ip=ip,
    )
    db.flush()
    return token


def gerar_e_enviar_reset_para_usuario(
    db: Session,
    usuario: Usuario,
    *,
    ip: str | None = None,
    acao_auditoria: str = "password_reset.solicitado",
    motivo: MotivoResetEmail = "solicitacao",
    commit: bool = True,
) -> tuple[str, email_dispatch_service.ResultadoEnvio]:
    token = _criar_token_reset(db, usuario, ip=ip, acao_auditoria=acao_auditoria)
    if commit:
        db.commit()
    resultado = email_service.tentar_enviar_reset_senha(
        db,
        usuario.email,
        token,
        _empresa_nome(db, usuario.empresa_id),
        motivo=motivo,
    )
    return token, resultado


async def solicitar_reset_background(email: str, ip: str | None = None) -> None:
    """BackgroundTask async — evita bloquear worker com chamadas HTTP síncronas ao Graph.

    A lógica de DB é sync (não há await aqui), mas o envio do e-mail usa
    email_service.tentar_enviar_reset_senha_async (httpx.AsyncClient).
    """
    db = SessionLocal()
    try:
        usuario = usuario_service.get_by_email(db, email)
        if usuario is None or not usuario.ativo:
            return

        _invalidar_tokens_pendentes(db, usuario.id)
        token = _gerar_token()
        db.add(
            PasswordReset(
                usuario_id=usuario.id,
                token=token,
                expiracao=_expiracao(),
            )
        )
        audit_log_service.log(
            db,
            acao="password_reset.solicitado",
            usuario_id=usuario.id,
            empresa_id=usuario.empresa_id,
            ip=ip,
        )
        db.commit()

        await email_service.tentar_enviar_reset_senha_async(
            db,
            usuario.email,
            token,
            _empresa_nome(db, usuario.empresa_id),
            motivo="solicitacao",
        )
    finally:
        db.close()


def solicitar_reset(
    db: Session,
    email: str,
    ip: str | None = None,
) -> str | None:
    """
    Retorna o token gerado (para exibição dev/admin) ou None se e-mail não existe.
    NUNCA lança exceção que revele existência do e-mail — chamador deve retornar
    resposta genérica independente.
    """
    usuario = usuario_service.get_by_email(db, email)
    if usuario is None or not usuario.ativo:
        return None

    token, _ = gerar_e_enviar_reset_para_usuario(
        db,
        usuario,
        ip=ip,
        acao_auditoria="password_reset.solicitado",
        motivo="solicitacao",
        commit=True,
    )
    return token


def redefinir_senha(
    db: Session,
    token: str,
    nova_senha: str,
    ip: str | None = None,
) -> Usuario:
    agora = datetime.now(UTC)
    pr = db.scalar(
        select(PasswordReset)
        .where(
            and_(
                PasswordReset.token == token,
                PasswordReset.usado.is_(False),
                PasswordReset.expiracao > agora,
            )
        )
        .with_for_update()
    )
    if pr is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token inválido ou expirado",
        )

    usuario = db.get(Usuario, pr.usuario_id)
    if usuario is None or not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário não encontrado",
        )

    usuario.senha_hash = hash_password(nova_senha)
    usuario.primeiro_login = False
    pr.usado = True

    audit_log_service.log(
        db,
        acao="password_reset.concluido",
        usuario_id=usuario.id,
        empresa_id=usuario.empresa_id,
        ip=ip,
    )

    auth_service.revogar_refresh_tokens_usuario(db, usuario.id)
    db.commit()
    db.refresh(usuario)
    return usuario
