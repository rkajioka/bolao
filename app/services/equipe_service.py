from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.convite import Convite
from app.models.usuario import Usuario
from app.schemas.perfil import AlterarSenhaRequest, PerfilUpdate
from app.auth.password import hash_password, verify_password
from app.services import audit_log_service, convite_service


def listar_equipe(db: Session, empresa_id: int) -> list[dict]:
    usuarios = list(
        db.scalars(
            select(Usuario)
            .where(Usuario.empresa_id == empresa_id)
            .order_by(Usuario.nome.asc())
        ).all()
    )

    convites_pendentes = list(
        db.scalars(
            select(Convite).where(
                and_(
                    Convite.empresa_id == empresa_id,
                    Convite.usado_em.is_(None),
                    Convite.expiracao > datetime.now(UTC),
                )
            )
        ).all()
    )

    emails_cadastrados = {u.email for u in usuarios}

    resultado = []
    for u in usuarios:
        resultado.append({
            "tipo": "usuario",
            "id": u.id,
            "nome": u.nome,
            "email": u.email,
            "funcao": u.funcao,
            "avatar_url": u.avatar_url or u.imagem_perfil,
            "tipo_usuario": u.tipo_usuario,
            "ativo": u.ativo,
            "bloqueado": u.bloqueado,
            "primeiro_login": u.primeiro_login,
            "ultimo_login": u.ultimo_login.isoformat() if u.ultimo_login else None,
            "created_at": u.created_at.isoformat(),
        })

    for c in convites_pendentes:
        if c.email not in emails_cadastrados:
            resultado.append({
                "tipo": "convite",
                "convite_id": c.id,
                "email": c.email,
                "token": c.token,
                "expiracao": c.expiracao.isoformat(),
                "status": "convite_pendente",
                "criado_por": c.criado_por,
                "created_at": c.created_at.isoformat(),
            })

    return resultado


def bloquear_usuario(
    db: Session,
    empresa_id: int,
    usuario_id: int,
    bloqueado: bool,
    solicitante_id: int,
    ip: str | None = None,
) -> Usuario:
    usuario = get_usuario_empresa(db, empresa_id, usuario_id)
    usuario.bloqueado = bloqueado
    acao = "equipe.bloqueado" if bloqueado else "equipe.desbloqueado"
    audit_log_service.log(
        db, acao=acao, usuario_id=solicitante_id,
        empresa_id=empresa_id, alvo=str(usuario_id), ip=ip,
    )
    db.commit()
    db.refresh(usuario)
    return usuario


def remover_usuario(
    db: Session,
    empresa_id: int,
    usuario_id: int,
    solicitante_id: int,
    ip: str | None = None,
) -> None:
    usuario = get_usuario_empresa(db, empresa_id, usuario_id)
    if usuario.id == solicitante_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode remover a si mesmo da empresa",
        )
    usuario.empresa_id = None
    audit_log_service.log(
        db, acao="equipe.removido", usuario_id=solicitante_id,
        empresa_id=empresa_id, alvo=str(usuario_id), ip=ip,
    )
    db.commit()


def get_usuario_empresa(db: Session, empresa_id: int, usuario_id: int) -> Usuario:
    usuario = db.scalar(
        select(Usuario).where(
            and_(
                Usuario.id == usuario_id,
                Usuario.empresa_id == empresa_id,
            )
        )
    )
    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado nesta empresa",
        )
    return usuario


def atualizar_perfil(db: Session, usuario: Usuario, data: PerfilUpdate) -> Usuario:
    if data.nome is not None:
        usuario.nome = data.nome
    if data.funcao is not None:
        usuario.funcao = data.funcao
    if data.avatar_url is not None:
        usuario.avatar_url = data.avatar_url
    db.commit()
    db.refresh(usuario)
    return usuario


def definir_avatar_url(db: Session, usuario: Usuario, avatar_url: str) -> Usuario:
    usuario.avatar_url = avatar_url
    db.commit()
    db.refresh(usuario)
    return usuario


def alterar_senha(db: Session, usuario: Usuario, data: AlterarSenhaRequest) -> None:
    if usuario.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conclua o primeiro acesso antes de alterar a senha aqui",
        )
    if not verify_password(data.senha_atual, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    if data.senha_atual == data.nova_senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ser diferente da senha atual",
        )
    usuario.senha_hash = hash_password(data.nova_senha)
    db.commit()
