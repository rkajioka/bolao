from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token
from app.auth.password import hash_password, verify_password
from app.models.usuario import Usuario
from app.schemas.usuario import ChangePasswordRequest, LoginRequest, PrimeiroAcessoRequest
from app.services import usuario_service


def login(db: Session, data: LoginRequest) -> tuple[str, bool]:
    user = usuario_service.get_by_email(db, str(data.email))
    if user is None or not verify_password(data.senha, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    token = create_access_token(user.id)
    return token, user.primeiro_login


def complete_primeiro_acesso(db: Session, user: Usuario, data: PrimeiroAcessoRequest) -> None:
    if not user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Primeiro acesso já foi concluído",
        )
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo",
        )
    user.nome = data.nome
    user.funcao = data.funcao
    user.imagem_perfil = data.imagem_perfil
    user.senha_hash = hash_password(data.nova_senha)
    user.primeiro_login = False
    db.commit()


def change_password(db: Session, user: Usuario, data: ChangePasswordRequest) -> None:
    if user.primeiro_login:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conclua o primeiro acesso antes de usar esta rota",
        )
    if not verify_password(data.senha_atual, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual incorreta",
        )
    if data.senha_atual == data.nova_senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha deve ser diferente da senha atual",
        )
    user.senha_hash = hash_password(data.nova_senha)
    db.commit()
