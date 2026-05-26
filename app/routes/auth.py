from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.request_origin import assert_bolao_client_request
from app.core.config import get_settings
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.convite import AtivarContaRequest, AtivarContaResponse, AvatarPreAtivacaoResponse
from app.schemas.password_reset import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    ResetPasswordRequest,
)
from app.schemas.usuario import (
    AccessTokenResponse,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PrimeiroAcessoRequest,
    UsuarioRead,
)
from app.services import (
    auth_service,
    ativacao_service,
    avatar_upload_service,
    convite_service,
    password_reset_service,
    usuario_service,
)
from app.services.rate_limit_service import enforce_limit, reset_key

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

_FORGOT_PASSWORD_MSG = (
    "Se existir uma conta vinculada ao e-mail informado, "
    "você receberá as instruções de redefinição em breve."
)


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
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> LoginResponse:
    ip = request.client.host if request.client else "unknown"
    login_key = f"auth:login_failed:{ip}:{str(data.email).lower()}"
    try:
        access_token, refresh_token, primeiro = auth_service.login(db, data)
    except HTTPException as exc:
        if exc.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN):
            enforce_limit(
                key=login_key,
                limit=settings.rate_limit_login_requests,
                window_seconds=settings.rate_limit_window_seconds,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="E-mail ou senha incorretos",
            )
        raise
    reset_key(login_key)
    _set_refresh_cookie(response, refresh_token)
    return LoginResponse(access_token=access_token, primeiro_login=primeiro)


@router.post("/refresh", response_model=AccessTokenResponse)
def post_refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AccessTokenResponse:
    assert_bolao_client_request(request)
    ip = request.client.host if request.client else "unknown"
    enforce_limit(
        key=f"auth:refresh:{ip}",
        limit=settings.rate_limit_refresh_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    cookie = request.cookies.get(settings.jwt_refresh_cookie_name)
    if not cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token não informado")
    access_token, refresh_token = auth_service.refresh_access_token(db, cookie, ip=ip)
    _set_refresh_cookie(response, refresh_token)
    return AccessTokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def post_logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> None:
    assert_bolao_client_request(request)
    cookie = request.cookies.get(settings.jwt_refresh_cookie_name)
    auth_service.logout(db, cookie)
    _clear_refresh_cookie(response)


@router.get("/me", response_model=UsuarioRead)
def get_me(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_active_user),
) -> UsuarioRead:
    return usuario_service.usuario_para_read(db, user)


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


@router.post("/avatar-pre-ativacao", response_model=AvatarPreAtivacaoResponse)
async def post_avatar_pre_ativacao(
    request: Request,
    db: Session = Depends(get_db),
    token: str = Form(...),
    file: UploadFile = File(...),
) -> AvatarPreAtivacaoResponse:
    """Upload de foto antes de ativar conta — exige token de convite válido (sem JWT)."""
    import hashlib

    ip = request.client.host if request.client else "unknown"
    enforce_limit(
        key=f"auth:avatar-pre:{ip}",
        limit=settings.rate_limit_avatar_pre_ip_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    token_key = hashlib.sha256(token.encode("utf-8")).hexdigest()[:16]
    enforce_limit(
        key=f"auth:avatar-pre:token:{token_key}",
        limit=settings.rate_limit_avatar_pre_token_requests,
        window_seconds=settings.rate_limit_window_seconds,
    )
    convite_service.validar_token(db, token)
    raw = await avatar_upload_service.read_upload_limited(
        file, avatar_upload_service.AVATAR_MAX_BYTES
    )
    path = avatar_upload_service.persist_avatar(raw, file.content_type)
    return AvatarPreAtivacaoResponse(avatar_url=path)


@router.post("/ativar-conta", response_model=AtivarContaResponse)
def post_ativar_conta(
    data: AtivarContaRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AtivarContaResponse:
    """Ativa conta via token de convite. Cria usuário e emite tokens de sessão."""
    ip = request.client.host if request.client else None
    usuario = ativacao_service.ativar_conta(db, data, ip)
    access_token, refresh_token = auth_service.issue_token_pair(db, usuario)
    _set_refresh_cookie(response, refresh_token)
    return AtivarContaResponse(access_token=access_token)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
def post_forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    """
    Gera token de reset. Resposta é sempre a mesma para evitar enumeração de usuários.
    Em dev: token retornado em campo extra quando gerado (apenas admin pode ver via /equipe).
    """
    ip = request.client.host if request.client else None
    enforce_limit(
        key=f"auth:forgot:{ip}",
        limit=5,
        window_seconds=300,
    )
    password_reset_service.solicitar_reset(db, str(body.email), ip)
    return ForgotPasswordResponse(mensagem=_FORGOT_PASSWORD_MSG)


@router.post("/redefinir-senha", response_model=AtivarContaResponse)
def post_redefinir_senha(
    data: ResetPasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AtivarContaResponse:
    ip = request.client.host if request.client else None
    usuario = password_reset_service.redefinir_senha(db, data.token, data.nova_senha, ip)
    access_token, refresh_token = auth_service.issue_token_pair(db, usuario)
    _set_refresh_cookie(response, refresh_token)
    return AtivarContaResponse(access_token=access_token)
