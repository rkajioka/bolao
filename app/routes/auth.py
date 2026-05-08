from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.auth.dependencies import get_current_active_user
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.usuario import (
    AccessTokenResponse,
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
settings = get_settings()


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.jwt_refresh_cookie_name,
        value=token,
        httponly=True,
        secure=settings.jwt_refresh_cookie_secure,
        samesite=settings.jwt_refresh_cookie_samesite,
        path=settings.jwt_refresh_cookie_path,
        max_age=settings.jwt_refresh_token_expire_minutes * 60,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.jwt_refresh_cookie_name,
        path=settings.jwt_refresh_cookie_path,
    )


@router.post("/login", response_model=LoginResponse)
def post_login(
    data: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    access_token, refresh_token, primeiro = auth_service.login(db, data)
    _set_refresh_cookie(response, refresh_token)
    return LoginResponse(access_token=access_token, primeiro_login=primeiro)


@router.post("/refresh", response_model=AccessTokenResponse)
def post_refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    cookie = request.cookies.get(settings.jwt_refresh_cookie_name)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token não informado")
    access_token, refresh_token = auth_service.refresh_access_token(db, cookie)
    _set_refresh_cookie(response, refresh_token)
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def post_logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> None:
    cookie = request.cookies.get(settings.jwt_refresh_cookie_name)
    auth_service.logout(db, cookie)
    _clear_refresh_cookie(response)


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
