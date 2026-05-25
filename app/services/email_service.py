"""Envio de e-mail via Microsoft Graph (Outlook)."""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services import email_dispatch_service

logger = logging.getLogger(__name__)


def _public_base_url() -> str:
    return get_settings().public_app_url.rstrip("/")


def _credenciais_outlook():
    settings = get_settings()
    if not all(
        (
            settings.azure_client_id,
            settings.azure_client_secret,
            settings.azure_tenant_id,
            settings.outlook_sender,
        )
    ):
        raise RuntimeError(
            "Configure AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID e OUTLOOK_SENDER no ambiente"
        )
    return settings


def _obter_token_graph() -> str:
    settings = _credenciais_outlook()
    url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": settings.azure_client_id,
        "client_secret": settings.azure_client_secret,
        "scope": settings.graph_api_scope,
        "grant_type": "client_credentials",
    }
    response = httpx.post(url, data=data, timeout=30.0)
    response.raise_for_status()
    return response.json()["access_token"]


def enviar_email_outlook(
    *,
    destinatario: str,
    assunto: str,
    corpo_html: str,
    nome_remetente: str,
) -> None:
    settings = _credenciais_outlook()
    token = _obter_token_graph()
    url = f"{settings.graph_api_url.rstrip('/')}/users/{settings.outlook_sender}/sendMail"
    payload = {
        "message": {
            "subject": assunto,
            "body": {"contentType": "HTML", "content": corpo_html},
            "from": {
                "emailAddress": {
                    "name": nome_remetente,
                    "address": settings.outlook_sender,
                }
            },
            "toRecipients": [{"emailAddress": {"address": destinatario}}],
        },
        "saveToSentItems": True,
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
    response.raise_for_status()


def _enviar_com_log(
    *,
    destinatario: str,
    assunto: str,
    corpo_html: str,
    nome_remetente: str,
    rotulo: str,
) -> email_dispatch_service.ResultadoEnvio:
    resultado = email_dispatch_service.enviar_com_retentativas(
        lambda: enviar_email_outlook(
            destinatario=destinatario,
            assunto=assunto,
            corpo_html=corpo_html,
            nome_remetente=nome_remetente,
        )
    )
    if resultado.sucesso:
        logger.info("E-mail %s enviado para %s", rotulo, destinatario)
        print(f"[bolao:email] {rotulo} -> {destinatario}: enviado OK", flush=True)
    else:
        logger.error("Falha ao enviar e-mail %s para %s: %s", rotulo, destinatario, resultado.erro)
        print(
            f"[bolao:email] {rotulo} -> {destinatario}: FALHA — {resultado.erro}",
            flush=True,
        )
    return resultado


def tentar_enviar_convite(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
) -> email_dispatch_service.ResultadoEnvio:
    del db
    link = f"{_public_base_url()}/ativar-conta?token={token}"
    assunto = f"Convite para o Bolão — {empresa_nome}"
    corpo_html = (
        f"<p>Você foi convidado para o bolão <strong>{empresa_nome}</strong>.</p>"
        f'<p><a href="{link}">Ativar minha conta</a></p>'
        "<p>Se você não esperava este convite, ignore este e-mail.</p>"
    )
    return _enviar_com_log(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="convite",
    )


def tentar_enviar_conta_criada_pelo_gestor(
    db: Session,
    destinatario: str,
    empresa_nome: str,
    senha_inicial: str,
) -> email_dispatch_service.ResultadoEnvio:
    del db
    login_url = f"{_public_base_url()}/login"
    assunto = f"Sua conta no bolão foi criada — {empresa_nome}"
    corpo_html = (
        f"<p>Foi criada uma conta para você no bolão <strong>{empresa_nome}</strong>.</p>"
        f"<p>Use seu e-mail <strong>{destinatario}</strong> e a senha inicial "
        f"<strong>{senha_inicial}</strong> para entrar.</p>"
        f'<p><a href="{login_url}">Acessar o bolão</a></p>'
        "<p>No primeiro acesso, você precisará definir uma nova senha antes de continuar.</p>"
    )
    return _enviar_com_log(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="conta-criada",
    )


def tentar_enviar_senha_resetada_pelo_gestor(
    db: Session,
    destinatario: str,
    empresa_nome: str,
    token: str,
) -> email_dispatch_service.ResultadoEnvio:
    """Legado: preferir gerar_e_enviar_reset com motivo reset_gestor."""
    del db
    return tentar_enviar_reset_senha(
        db,
        destinatario,
        token,
        empresa_nome,
        motivo="reset_gestor",
    )


def tentar_enviar_reset_senha(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
    *,
    motivo: str = "solicitacao",
) -> email_dispatch_service.ResultadoEnvio:
    del db
    link = f"{_public_base_url()}/redefinir-senha?token={token}"
    if motivo == "conta_criada":
        assunto = f"Defina sua senha — {empresa_nome}"
        corpo_html = (
            f"<p>Sua conta no bolão <strong>{empresa_nome}</strong> foi criada.</p>"
            f"<p>Use o link abaixo para definir sua senha de acesso com o e-mail "
            f"<strong>{destinatario}</strong>.</p>"
            f'<p><a href="{link}">Definir senha</a></p>'
            "<p>O link expira em breve. Se você não esperava este acesso, ignore este e-mail.</p>"
        )
    elif motivo == "reset_gestor":
        assunto = f"Sua senha foi redefinida — {empresa_nome}"
        corpo_html = (
            f"<p>A senha da sua conta no bolão <strong>{empresa_nome}</strong> foi redefinida "
            "por um administrador.</p>"
            f"<p>Use o link abaixo para definir uma nova senha com o e-mail "
            f"<strong>{destinatario}</strong>.</p>"
            f'<p><a href="{link}">Definir nova senha</a></p>'
            "<p>O link expira em breve. Se você não esperava esta alteração, ignore este e-mail.</p>"
        )
    else:
        assunto = f"Redefinição de senha — {empresa_nome}"
        corpo_html = (
            f"<p>Recebemos um pedido para redefinir a senha da sua conta no bolão "
            f"<strong>{empresa_nome}</strong>.</p>"
            f'<p><a href="{link}">Redefinir senha</a></p>'
            "<p>O link expira em breve. Se não foi você, ignore este e-mail.</p>"
        )
    return _enviar_com_log(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="reset-senha",
    )
