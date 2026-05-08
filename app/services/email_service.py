"""Envio de e-mail via Resend (credenciais em configuracao_email)."""

from __future__ import annotations

import logging

import resend
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services import configuracao_email_service

logger = logging.getLogger(__name__)


def _public_base_url() -> str:
    return get_settings().public_app_url.rstrip("/")


def tentar_enviar_convite(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
) -> bool:
    creds = configuracao_email_service.obter_ou_padrao(db)
    if not creds.resend_api_key or not creds.email_from:
        msg = (
            "Convite não enviado por e-mail: configure resend_api_key e email_from "
            "(tabela configuracao_email)"
        )
        logger.warning(msg)
        print(f"[bolao:email] convite -> {destinatario}: NÃO enviado — {msg}", flush=True)
        return False

    resend.api_key = creds.resend_api_key
    link = f"{_public_base_url()}/ativar-conta?token={token}"
    try:
        resend.Emails.send(
            {
                "from": creds.email_from,
                "to": destinatario,
                "subject": f"Convite para o Bolão — {empresa_nome}",
                "html": (
                    f"<p>Você foi convidado para o bolão da empresa <strong>{empresa_nome}</strong>.</p>"
                    f'<p><a href="{link}">Ativar minha conta</a></p>'
                    "<p>Se você não esperava este convite, ignore este e-mail.</p>"
                ),
            }
        )
        logger.info("E-mail de convite enviado para %s (empresa=%s)", destinatario, empresa_nome)
        print(
            f"[bolao:email] convite -> {destinatario}: enviado OK (Resend, link base={_public_base_url()})",
            flush=True,
        )
        return True
    except Exception as e:
        logger.exception("Falha ao enviar e-mail de convite")
        print(f"[bolao:email] convite -> {destinatario}: FALHA Resend — {e!s}", flush=True)
        return False


def tentar_enviar_reset_senha(db: Session, destinatario: str, token: str) -> bool:
    creds = configuracao_email_service.obter_ou_padrao(db)
    if not creds.resend_api_key or not creds.email_from:
        msg = "Reset não enviado: configure resend_api_key e email_from (configuracao_email)"
        logger.warning(msg)
        print(f"[bolao:email] reset-senha -> {destinatario}: NÃO enviado — {msg}", flush=True)
        return False

    resend.api_key = creds.resend_api_key
    link = f"{_public_base_url()}/redefinir-senha?token={token}"
    try:
        resend.Emails.send(
            {
                "from": creds.email_from,
                "to": destinatario,
                "subject": "Redefinição de senha — Bolão da Copa",
                "html": (
                    "<p>Recebemos um pedido para redefinir a senha da sua conta.</p>"
                    f'<p><a href="{link}">Redefinir senha</a></p>'
                    "<p>O link expira em breve. Se não foi você, ignore este e-mail.</p>"
                ),
            }
        )
        logger.info("E-mail de reset de senha enviado para %s", destinatario)
        print(
            f"[bolao:email] reset-senha -> {destinatario}: enviado OK (Resend)",
            flush=True,
        )
        return True
    except Exception as e:
        logger.exception("Falha ao enviar e-mail de redefinição de senha")
        print(f"[bolao:email] reset-senha -> {destinatario}: FALHA Resend — {e!s}", flush=True)
        return False
