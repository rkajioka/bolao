from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.core.password_defaults import SENHA_PADRAO_TEMPORARIA
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate
from app.services import email_service, empresa_service


def _validar_vinculo_empresa(tipo_usuario: str, empresa_id: int | None) -> None:
    if tipo_usuario == "admin" and empresa_id is None:
        raise ValueError("Administrador deve estar vinculado a uma empresa")


def _email_filter(email_normalized: str):
    return func.lower(Usuario.email) == email_normalized


def get_by_id(db: Session, usuario_id: int) -> Usuario | None:
    return db.get(Usuario, usuario_id)


def get_by_email(db: Session, email: str) -> Usuario | None:
    email_n = email.strip().lower()
    return db.scalar(select(Usuario).where(_email_filter(email_n)))


def list_usuarios(db: Session) -> list[Usuario]:
    return list(db.scalars(select(Usuario).order_by(Usuario.id.asc())).all())


def create_usuario(db: Session, data: UsuarioCreate) -> Usuario:
    _validar_vinculo_empresa(data.tipo_usuario, data.empresa_id)
    u = Usuario(
        nome=data.nome,
        email=str(data.email).strip().lower(),
        senha_hash=hash_password(data.senha_plana),
        funcao=data.funcao,
        imagem_perfil=data.imagem_perfil,
        tipo_usuario=data.tipo_usuario,
        ativo=data.ativo,
        primeiro_login=data.primeiro_login,
        empresa_id=data.empresa_id,
    )
    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(u)
    return u


def update_usuario(db: Session, usuario: Usuario, data: UsuarioUpdate) -> Usuario:
    tipo = data.tipo_usuario if data.tipo_usuario is not None else usuario.tipo_usuario
    empresa_id = data.empresa_id if "empresa_id" in data.model_fields_set else usuario.empresa_id
    _validar_vinculo_empresa(tipo, empresa_id)
    if data.nome is not None:
        usuario.nome = data.nome
    if data.email is not None:
        usuario.email = str(data.email).strip().lower()
    if data.funcao is not None:
        usuario.funcao = data.funcao
    if data.imagem_perfil is not None:
        usuario.imagem_perfil = data.imagem_perfil
    if data.tipo_usuario is not None:
        usuario.tipo_usuario = data.tipo_usuario
    if "empresa_id" in data.model_fields_set:
        usuario.empresa_id = data.empresa_id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(usuario)
    return usuario


def set_ativo(db: Session, usuario: Usuario, ativo: bool) -> Usuario:
    usuario.ativo = ativo
    db.commit()
    db.refresh(usuario)
    return usuario


def reset_password(db: Session, usuario: Usuario) -> None:
    usuario.senha_hash = hash_password(SENHA_PADRAO_TEMPORARIA)
    usuario.primeiro_login = True
    db.commit()

    empresa_nome = "Bolão da Copa"
    if usuario.empresa_id is not None:
        empresa = empresa_service.get_by_id(db, usuario.empresa_id)
        if empresa is not None:
            empresa_nome = empresa.nome

    email_service.tentar_enviar_senha_resetada_pelo_gestor(
        db,
        destinatario=usuario.email,
        empresa_nome=empresa_nome,
        senha_temporaria=SENHA_PADRAO_TEMPORARIA,
    )
