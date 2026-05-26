from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.models.usuario import Usuario
from app.schemas.convite import AtivarContaRequest
from app.services import audit_log_service, convite_service


def ativar_conta(db: Session, data: AtivarContaRequest, ip: str | None = None) -> Usuario:
    convite = convite_service.validar_token_for_update(db, data.token)

    # Verificar se já existe usuário com este e-mail na empresa
    usuario_existente = db.scalar(
        select(Usuario).where(
            Usuario.email == convite.email,
            Usuario.empresa_id == convite.empresa_id,
        )
    )
    if usuario_existente is not None and not usuario_existente.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta conta já foi ativada. Faça login normalmente.",
        )

    if usuario_existente is not None:
        # Usuário criado previamente pelo admin — apenas atualiza senha e conclui onboarding
        usuario = usuario_existente
    else:
        usuario = Usuario(
            empresa_id=convite.empresa_id,
            email=convite.email,
            nome=data.nome,
            senha_hash="",
            tipo_usuario="usuario",
            ativo=True,
            bloqueado=False,
            primeiro_login=True,
        )
        db.add(usuario)
        db.flush()

    usuario.nome = data.nome
    usuario.senha_hash = hash_password(data.senha)
    usuario.avatar_url = data.avatar_url
    usuario.primeiro_login = False
    usuario.ativo = True

    convite_service.marcar_usado(db, convite)

    audit_log_service.log(
        db,
        acao="conta.ativada",
        usuario_id=usuario.id,
        empresa_id=convite.empresa_id,
        alvo=convite.email,
        ip=ip,
    )

    db.commit()
    db.refresh(usuario)
    return usuario
