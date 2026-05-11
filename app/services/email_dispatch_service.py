from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.usuario import Usuario
from app.services import email_service

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ResultadoEnvio:
    sucesso: bool
    tentativas: int
    erro: str | None = None


@dataclass(frozen=True)
class FalhaEnvioItem:
    destinatario: str
    operacao: str
    erro: str


def enviar_com_retentativas(enviar: Callable[[], None]) -> ResultadoEnvio:
    settings = get_settings()
    max_attempts = max(1, settings.email_max_attempts)
    ultimo_erro: str | None = None

    for tentativa in range(1, max_attempts + 1):
        try:
            enviar()
            return ResultadoEnvio(sucesso=True, tentativas=tentativa)
        except Exception as exc:  # noqa: BLE001
            ultimo_erro = str(exc)
            logger.warning("Falha no envio de e-mail (tentativa %s/%s): %s", tentativa, max_attempts, exc)
            if tentativa < max_attempts:
                time.sleep(settings.email_retry_backoff_seconds)

    return ResultadoEnvio(sucesso=False, tentativas=max_attempts, erro=ultimo_erro)


def listar_emails_admins_empresa(db: Session, empresa_id: int) -> list[str]:
    admins = db.scalars(
        select(Usuario.email).where(
            Usuario.empresa_id == empresa_id,
            Usuario.tipo_usuario == "admin",
            Usuario.ativo.is_(True),
        )
    ).all()
    return [email.strip().lower() for email in admins if email]


def notificar_admins_falha_envio(
    db: Session,
    *,
    empresa_id: int | None,
    empresa_nome: str,
    operacao: str,
    falhas: list[FalhaEnvioItem],
) -> bool:
    if empresa_id is None or not falhas:
        return False

    destinatarios = listar_emails_admins_empresa(db, empresa_id)
    if not destinatarios:
        return False

    linhas = "".join(
        f"<li><strong>{item.destinatario}</strong> ({item.operacao}): {item.erro}</li>"
        for item in falhas
    )
    assunto = f"Falha no envio de e-mails — {empresa_nome}"
    corpo_html = (
        f"<p>Alguns e-mails do bolão <strong>{empresa_nome}</strong> não puderam ser enviados "
        f"após as retentativas automáticas.</p>"
        f"<p>Operação: <strong>{operacao}</strong></p>"
        f"<ul>{linhas}</ul>"
        "<p>Revise os convites ou reenvie as credenciais manualmente na plataforma.</p>"
    )

    enviados = 0
    for destinatario in destinatarios:
        try:
            email_service.enviar_email_outlook(
                destinatario=destinatario,
                assunto=assunto,
                corpo_html=corpo_html,
                nome_remetente=empresa_nome,
            )
            enviados += 1
        except Exception:
            logger.exception("Falha ao alertar admin %s sobre envio de e-mail", destinatario)

    return enviados > 0
