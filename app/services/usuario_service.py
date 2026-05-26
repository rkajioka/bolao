import secrets
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.password import hash_password
from app.core.avatar_url import resolver_url_avatar_publica, validar_avatar_url
from app.core.password_policy import validar_complexidade_senha
from app.database import SessionLocal
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioRead, UsuarioUpdate
from app.services import email_dispatch_service, empresa_quota_service, empresa_service, password_reset_service


def _validar_vinculo_empresa(tipo_usuario: str, empresa_id: int | None) -> None:
    if tipo_usuario == "admin" and empresa_id is None:
        raise ValueError("Administrador deve estar vinculado a uma empresa")


def _email_filter(email_normalized: str):
    return func.lower(Usuario.email) == email_normalized


@dataclass(frozen=True)
class EmailEntregaResultado:
    email_enviado: bool | None = None
    email_erro: str | None = None
    email_tentativas: int | None = None
    alerta_admins_enviado: bool = False


def get_by_id(db: Session, usuario_id: int) -> Usuario | None:
    return db.get(Usuario, usuario_id)


def get_by_email(db: Session, email: str) -> Usuario | None:
    email_n = email.strip().lower()
    return db.scalar(select(Usuario).where(_email_filter(email_n)))


def list_usuarios(db: Session) -> list[Usuario]:
    return list(db.scalars(select(Usuario).order_by(Usuario.id.asc())).all())


def _empresa_nome(db: Session, empresa_id: int | None) -> str:
    empresa_nome = "Bolão da Copa"
    if empresa_id is not None:
        empresa = empresa_service.get_by_id(db, empresa_id)
        if empresa is not None:
            empresa_nome = empresa.nome
    return empresa_nome


def _registrar_falha_email(
    db: Session,
    *,
    usuario: Usuario,
    operacao: str,
    resultado: email_dispatch_service.ResultadoEnvio,
) -> EmailEntregaResultado:
    alerta_admins_enviado = False
    if usuario.empresa_id is not None:
        alerta_admins_enviado = email_dispatch_service.notificar_admins_falha_envio(
            db,
            empresa_id=usuario.empresa_id,
            empresa_nome=_empresa_nome(db, usuario.empresa_id),
            operacao=operacao,
            falhas=[
                email_dispatch_service.FalhaEnvioItem(
                    destinatario=usuario.email,
                    operacao=operacao,
                    erro=resultado.erro or "Falha desconhecida",
                )
            ],
        )
    return EmailEntregaResultado(
        email_enviado=False,
        email_erro=resultado.erro,
        email_tentativas=resultado.tentativas,
        alerta_admins_enviado=alerta_admins_enviado,
    )


def _enviar_link_acesso_inicial(db: Session, usuario: Usuario) -> EmailEntregaResultado:
    _, resultado = password_reset_service.gerar_e_enviar_reset_para_usuario(
        db,
        usuario,
        acao_auditoria="password_reset.solicitado_pos_criacao",
        motivo="conta_criada",
        commit=True,
    )
    if resultado.sucesso:
        return EmailEntregaResultado(
            email_enviado=True,
            email_tentativas=resultado.tentativas,
        )
    return _registrar_falha_email(
        db,
        usuario=usuario,
        operacao="criação de usuário",
        resultado=resultado,
    )


def create_usuario(db: Session, data: UsuarioCreate) -> tuple[Usuario, EmailEntregaResultado | None]:
    _validar_vinculo_empresa(data.tipo_usuario, data.empresa_id)
    if data.empresa_id is not None:
        empresa = empresa_service.get_by_id(db, data.empresa_id)
        if empresa is not None and not empresa_quota_service.pode_adicionar_usuario(db, empresa):
            email_dispatch_service.notificar_owners_limite_usuarios(
                db,
                empresa_id=empresa.id,
                empresa_nome=empresa.nome,
                max_usuarios=empresa.max_usuarios,
                ocupacao_atual=empresa_quota_service.ocupacao_atual(db, empresa.id),
                operacao="criação de usuário",
                emails_bloqueados=[str(data.email).strip().lower()],
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"A empresa atingiu o limite de {empresa.max_usuarios} usuários. "
                    "Solicite ao proprietário da plataforma o aumento da cota."
                ),
            )
    senha_inicial = data.senha_plana or secrets.token_urlsafe(48)
    u = Usuario(
        nome=data.nome,
        email=str(data.email).strip().lower(),
        senha_hash=hash_password(senha_inicial),
        funcao=data.funcao,
        imagem_perfil=validar_avatar_url(data.imagem_perfil) if data.imagem_perfil else None,
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

    entrega: EmailEntregaResultado | None = None
    if u.ativo and u.primeiro_login and data.senha_plana is None:
        entrega = _enviar_link_acesso_inicial(db, u)
    return u, entrega


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
        usuario.imagem_perfil = validar_avatar_url(data.imagem_perfil)
    if data.tipo_usuario is not None:
        usuario.tipo_usuario = data.tipo_usuario
    if "empresa_id" in data.model_fields_set:
        if data.empresa_id is not None and data.empresa_id != usuario.empresa_id:
            empresa = empresa_service.get_by_id(db, data.empresa_id)
            if empresa is not None and not empresa_quota_service.pode_adicionar_usuario(db, empresa):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"A empresa atingiu o limite de {empresa.max_usuarios} usuários. "
                        "Solicite ao proprietário da plataforma o aumento da cota."
                    ),
                )
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


def reset_password(db: Session, usuario: Usuario) -> EmailEntregaResultado:
    """Redefine acesso: senha aleatória no banco (desconhecida) + revoga sessões + link por e-mail."""
    from app.models.refresh_token import RefreshToken
    from sqlalchemy import update as _update
    usuario.senha_hash = hash_password(secrets.token_urlsafe(48))
    usuario.primeiro_login = True
    db.execute(
        _update(RefreshToken)
        .where(RefreshToken.usuario_id == usuario.id, RefreshToken.revogado.is_(False))
        .values(revogado=True)
    )
    db.flush()

    _, resultado = password_reset_service.gerar_e_enviar_reset_para_usuario(
        db,
        usuario,
        acao_auditoria="password_reset.solicitado_pelo_gestor",
        motivo="reset_gestor",
        commit=True,
    )
    if resultado.sucesso:
        return EmailEntregaResultado(
            email_enviado=True,
            email_tentativas=resultado.tentativas,
        )
    return _registrar_falha_email(
        db,
        usuario=usuario,
        operacao="reset de senha",
        resultado=resultado,
    )


def reset_password_background(usuario_id: int) -> None:
    db = SessionLocal()
    try:
        usuario = db.get(Usuario, usuario_id)
        if usuario is None:
            return
        reset_password(db, usuario)
    finally:
        db.close()


def usuario_para_read(db: Session, usuario: Usuario) -> UsuarioRead:
    empresa_nome: str | None = None
    if usuario.empresa_id is not None:
        if usuario.empresa is not None:
            empresa_nome = usuario.empresa.nome
        else:
            empresa = empresa_service.get_by_id(db, usuario.empresa_id)
            if empresa is not None:
                empresa_nome = empresa.nome
    return UsuarioRead.model_validate(usuario).model_copy(update={"empresa_nome": empresa_nome})
