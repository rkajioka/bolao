"""Envio de e-mail via Microsoft Graph (Outlook)."""

from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# --- Resend (desativado) ---
# import resend
# from app.services import configuracao_email_service
#
# def _enviar_via_resend(...):
#     creds = configuracao_email_service.obter_ou_padrao(db)
#     if not creds.resend_api_key or not creds.email_from:
#         return False
#     resend.api_key = creds.resend_api_key
#     resend.Emails.send({...})


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


def _enviar_email_outlook(
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


def tentar_enviar_convite(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
) -> bool:
    del db
    link = f"{_public_base_url()}/ativar-conta?token={token}"
    assunto = f"Convite para o Bolão — {empresa_nome}"
    corpo_html = (
        f"<p>Você foi convidado para o bolão da empresa <strong>{empresa_nome}</strong>.</p>"
        f'<p><a href="{link}">Ativar minha conta</a></p>'
        "<p>Se você não esperava este convite, ignore este e-mail.</p>"
    )
    try:
        _enviar_email_outlook(
            destinatario=destinatario,
            assunto=assunto,
            corpo_html=corpo_html,
            nome_remetente=empresa_nome,
        )
        logger.info("E-mail de convite enviado para %s (empresa=%s)", destinatario, empresa_nome)
        print(
            f"[bolao:email] convite -> {destinatario}: enviado OK (Outlook, empresa={empresa_nome})",
            flush=True,
        )
        return True
    except Exception as e:
        logger.exception("Falha ao enviar e-mail de convite")
        print(f"[bolao:email] convite -> {destinatario}: FALHA Outlook — {e!s}", flush=True)
        return False


def tentar_enviar_reset_senha(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
) -> bool:
    del db
    link = f"{_public_base_url()}/redefinir-senha?token={token}"
    assunto = f"Redefinição de senha — {empresa_nome}"
    corpo_html = (
        f"<p>Recebemos um pedido para redefinir a senha da sua conta no bolão "
        f"<strong>{empresa_nome}</strong>.</p>"
        f'<p><a href="{link}">Redefinir senha</a></p>'
        "<p>O link expira em breve. Se não foi você, ignore este e-mail.</p>"
    )
    try:
        _enviar_email_outlook(
            destinatario=destinatario,
            assunto=assunto,
            corpo_html=corpo_html,
            nome_remetente=empresa_nome,
        )
        logger.info("E-mail de reset de senha enviado para %s (empresa=%s)", destinatario, empresa_nome)
        print(
            f"[bolao:email] reset-senha -> {destinatario}: enviado OK (Outlook, empresa={empresa_nome})",
            flush=True,
        )
        return True
    except Exception as e:
        logger.exception("Falha ao enviar e-mail de redefinição de senha")
        print(f"[bolao:email] reset-senha -> {destinatario}: FALHA Outlook — {e!s}", flush=True)
        return False
