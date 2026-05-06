from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioResetPasswordBody, UsuarioUpdate


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
    u = Usuario(
        nome=data.nome,
        email=str(data.email).strip().lower(),
        senha_hash=hash_password(data.senha_plana),
        funcao=data.funcao,
        imagem_perfil=data.imagem_perfil,
        tipo_usuario=data.tipo_usuario,
        ativo=data.ativo,
        primeiro_login=data.primeiro_login,
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


def reset_password(db: Session, usuario: Usuario, body: UsuarioResetPasswordBody) -> None:
    usuario.senha_hash = hash_password(body.senha_plana)
    usuario.primeiro_login = True
    db.commit()
