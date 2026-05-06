from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    LoginResponse,
    PrimeiroAcessoRequest,
    UsuarioRead,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def post_login(data: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    token, primeiro = auth_service.login(db, data)
    return LoginResponse(access_token=token, primeiro_login=primeiro)


@router.get("/me", response_model=UsuarioRead)
def get_me(user: Usuario = Depends(get_current_active_user)) -> Usuario:
    return user


@router.post("/primeiro-acesso", status_code=status.HTTP_204_NO_CONTENT)
def post_primeiro_acesso(
    data: PrimeiroAcessoRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    auth_service.complete_primeiro_acesso(db, user, data)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def post_change_password(
    data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> None:
    auth_service.change_password(db, user, data)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def post_forgot_password(_body: ForgotPasswordRequest) -> ForgotPasswordResponse:
    """
    MVP sem envio de e-mail (§6.2): resposta fixa conforme especificação.
    Não revela se o e-mail existe no sistema.
    """
    return ForgotPasswordResponse(
        mensagem="Para redefinir sua senha, entre em contato com o administrador.",
    )
