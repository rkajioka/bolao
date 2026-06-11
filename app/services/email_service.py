"""Envio de e-mail via Microsoft Graph (Outlook).

Cada função existe em duas variantes:
- Síncrona  (sem sufixo) → para callers em contexto sync (ex.: rotas admin).
- Assíncrona (_async)    → para BackgroundTasks (evita bloquear workers uvicorn).

As variantes async usam httpx.AsyncClient para não bloquear o event-loop.
"""

from __future__ import annotations

import base64
import logging
from functools import lru_cache
from html import escape as html_escape
from pathlib import Path

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services import email_dispatch_service

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_ASSINATURA_CID = "bolao_assinatura_lpc"
_ASSINATURA_CANDIDATES = (
    _PROJECT_ROOT / "app" / "resources" / "email" / "assinatura.png",
    _PROJECT_ROOT / "frontend" / "public" / "assinatura.png",
    _PROJECT_ROOT / "frontend" / "dist" / "assinatura.png",
)


def _resolver_caminho_assinatura() -> Path | None:
    for path in _ASSINATURA_CANDIDATES:
        if path.is_file():
            return path
    return None


@lru_cache(maxsize=1)
def _carregar_assinatura_png() -> bytes | None:
    path = _resolver_caminho_assinatura()
    if path is None:
        logger.warning(
            "assinatura.png não encontrado em %s; e-mails serão enviados sem assinatura",
            ", ".join(str(p) for p in _ASSINATURA_CANDIDATES),
        )
        return None
    return path.read_bytes()


def _fragmento_assinatura_html() -> str:
    if _carregar_assinatura_png() is None:
        return ""
    return (
        "<br><br><br>"
        '<p style="margin:0;padding:0;">'
        f'<img src="cid:{_ASSINATURA_CID}" alt="Assinatura" '
        'style="display:block;max-width:320px;height:auto;border:0;" />'
        "</p>"
    )


def _anexos_assinatura_inline() -> list[dict]:
    png = _carregar_assinatura_png()
    if png is None:
        return []
    return [
        {
            "@odata.type": "#microsoft.graph.fileAttachment",
            "name": "assinatura.png",
            "contentType": "image/png",
            "contentBytes": base64.b64encode(png).decode("ascii"),
            "isInline": True,
            "contentId": _ASSINATURA_CID,
        }
    ]


def _preparar_corpo_e_anexos(corpo_html: str) -> tuple[str, list[dict]]:
    fragmento = _fragmento_assinatura_html()
    if not fragmento:
        return corpo_html, []
    return f"{corpo_html.rstrip()}{fragmento}", _anexos_assinatura_inline()


def _aplicar_assinatura_corpo(corpo_html: str) -> str:
    """Compatível com testes legados — retorna só o HTML."""
    corpo, _ = _preparar_corpo_e_anexos(corpo_html)
    return corpo


def _mask_email(email: str) -> str:
    """Mascara o endereço de e-mail para não expor PII em logs.

    Exemplos:
        joao.silva@empresa.com  → jo***@empresa.com
        ab@x.com                → a***@x.com
    """
    try:
        local, domain = email.rsplit("@", 1)
        masked_local = local[:2] + "***" if len(local) > 2 else local[0] + "***"
        return f"{masked_local}@{domain}"
    except Exception:
        return "***@***"


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
    corpo_html, anexos = _preparar_corpo_e_anexos(corpo_html)
    settings = _credenciais_outlook()
    token = _obter_token_graph()
    url = f"{settings.graph_api_url.rstrip('/')}/users/{settings.outlook_sender}/sendMail"
    message: dict = {
        "subject": assunto,
        "body": {"contentType": "HTML", "content": corpo_html},
        "from": {
            "emailAddress": {
                "name": nome_remetente,
                "address": settings.outlook_sender,
            }
        },
        "toRecipients": [{"emailAddress": {"address": destinatario}}],
    }
    if anexos:
        message["attachments"] = anexos
    payload = {"message": message, "saveToSentItems": True}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    response = httpx.post(url, headers=headers, json=payload, timeout=30.0)
    response.raise_for_status()


# ---------------------------------------------------------------------------
# Variantes assíncronas — usam httpx.AsyncClient para não bloquear workers
# ---------------------------------------------------------------------------


async def _obter_token_graph_async() -> str:
    """Versão async de _obter_token_graph usando httpx.AsyncClient."""
    settings = _credenciais_outlook()
    url = f"https://login.microsoftonline.com/{settings.azure_tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": settings.azure_client_id,
        "client_secret": settings.azure_client_secret,
        "scope": settings.graph_api_scope,
        "grant_type": "client_credentials",
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data, timeout=30.0)
    response.raise_for_status()
    return response.json()["access_token"]


async def enviar_email_outlook_async(
    *,
    destinatario: str,
    assunto: str,
    corpo_html: str,
    nome_remetente: str,
) -> None:
    """Versão async de enviar_email_outlook — não bloqueia o event-loop."""
    corpo_html, anexos = _preparar_corpo_e_anexos(corpo_html)
    settings = _credenciais_outlook()
    token = await _obter_token_graph_async()
    url = f"{settings.graph_api_url.rstrip('/')}/users/{settings.outlook_sender}/sendMail"
    message: dict = {
        "subject": assunto,
        "body": {"contentType": "HTML", "content": corpo_html},
        "from": {
            "emailAddress": {
                "name": nome_remetente,
                "address": settings.outlook_sender,
            }
        },
        "toRecipients": [{"emailAddress": {"address": destinatario}}],
    }
    if anexos:
        message["attachments"] = anexos
    payload = {"message": message, "saveToSentItems": True}
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=30.0)
    response.raise_for_status()


async def _enviar_com_log_async(
    *,
    destinatario: str,
    assunto: str,
    corpo_html: str,
    nome_remetente: str,
    rotulo: str,
) -> email_dispatch_service.ResultadoEnvio:
    resultado = await email_dispatch_service.enviar_com_retentativas_async(
        lambda: enviar_email_outlook_async(
            destinatario=destinatario,
            assunto=assunto,
            corpo_html=corpo_html,
            nome_remetente=nome_remetente,
        )
    )
    dest_log = _mask_email(destinatario)
    if resultado.sucesso:
        logger.info("E-mail %s enviado para %s", rotulo, dest_log)
        print(f"[bolao:email] {rotulo} -> {dest_log}: enviado OK", flush=True)
    else:
        logger.error("Falha ao enviar e-mail %s para %s: %s", rotulo, dest_log, resultado.erro)
        print(
            f"[bolao:email] {rotulo} -> {dest_log}: FALHA — {resultado.erro}",
            flush=True,
        )
    return resultado


async def tentar_enviar_convite_async(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
) -> email_dispatch_service.ResultadoEnvio:
    """Versão async de tentar_enviar_convite — para uso em BackgroundTasks."""
    del db
    link = f"{_public_base_url()}/ativar-conta?token={token}"
    safe_nome = html_escape(empresa_nome)
    assunto = f"Convite para o Bolão — {empresa_nome}"
    corpo_html = (
        f"<p>Você foi convidado para o bolão <strong>{safe_nome}</strong>.</p>"
        f'<p><a href="{link}">Ativar minha conta</a></p>'
        "<p>Este link funciona uma única vez e é válido pelas próximas 72 horas. "
        "Se o prazo expirar, entre em contato com o administrador do bolão.</p>"
        "<p>Se você não esperava este convite, ignore este e-mail.</p>"
    )
    return await _enviar_com_log_async(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="convite",
    )


def _mensagem_texto_para_html(mensagem: str) -> str:
    """Texto plano → parágrafos HTML seguros."""
    partes: list[str] = []
    for linha in mensagem.splitlines():
        if linha.strip():
            partes.append(f"<p>{html_escape(linha)}</p>")
        else:
            partes.append("<br>")
    return "".join(partes) or "<p></p>"


async def tentar_enviar_comunicado_async(
    destinatario: str,
    assunto: str,
    mensagem: str,
    empresa_nome: str,
) -> email_dispatch_service.ResultadoEnvio:
    corpo_html = (
        f"{_mensagem_texto_para_html(mensagem)}"
        "<p><em>Este é um aviso administrativo do bolão. "
        "Não responda a este e-mail.</em></p>"
    )
    return await _enviar_com_log_async(
        destinatario=destinatario,
        assunto=assunto.strip(),
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="comunicado-equipe",
    )


async def tentar_enviar_reset_senha_async(
    db: Session,
    destinatario: str,
    token: str,
    empresa_nome: str,
    *,
    motivo: str = "solicitacao",
) -> email_dispatch_service.ResultadoEnvio:
    """Versão async de tentar_enviar_reset_senha — para uso em BackgroundTasks."""
    del db
    link = f"{_public_base_url()}/redefinir-senha?token={token}"
    safe_nome = html_escape(empresa_nome)
    safe_dest = html_escape(destinatario)
    if motivo == "conta_criada":
        assunto = f"Defina sua senha — {empresa_nome}"
        corpo_html = (
            f"<p>Sua conta no bolão <strong>{safe_nome}</strong> foi criada.</p>"
            f"<p>Use o link abaixo para definir sua senha de acesso com o e-mail "
            f"<strong>{safe_dest}</strong>.</p>"
            f'<p><a href="{link}">Definir senha</a></p>'
            "<p>O link expira em breve. Se você não esperava este acesso, ignore este e-mail.</p>"
        )
    elif motivo == "reset_gestor":
        assunto = f"Sua senha foi redefinida — {empresa_nome}"
        corpo_html = (
            f"<p>A senha da sua conta no bolão <strong>{safe_nome}</strong> foi redefinida "
            "por um administrador.</p>"
            f"<p>Use o link abaixo para definir uma nova senha com o e-mail "
            f"<strong>{safe_dest}</strong>.</p>"
            f'<p><a href="{link}">Definir nova senha</a></p>'
            "<p>O link expira em breve. Se você não esperava esta alteração, ignore este e-mail.</p>"
        )
    else:
        assunto = f"Redefinição de senha — {empresa_nome}"
        corpo_html = (
            f"<p>Recebemos um pedido para redefinir a senha da sua conta no bolão "
            f"<strong>{safe_nome}</strong>.</p>"
            f'<p><a href="{link}">Redefinir senha</a></p>'
            "<p>O link expira em breve. Se não foi você, ignore este e-mail.</p>"
        )
    return await _enviar_com_log_async(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="reset-senha",
    )


# ---------------------------------------------------------------------------
# Variantes síncronas — mantidas para callers em contexto sync (rotas admin)
# ---------------------------------------------------------------------------


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
    dest_log = _mask_email(destinatario)
    if resultado.sucesso:
        logger.info("E-mail %s enviado para %s", rotulo, dest_log)
        print(f"[bolao:email] {rotulo} -> {dest_log}: enviado OK", flush=True)
    else:
        logger.error("Falha ao enviar e-mail %s para %s: %s", rotulo, dest_log, resultado.erro)
        print(
            f"[bolao:email] {rotulo} -> {dest_log}: FALHA — {resultado.erro}",
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
    safe_nome = html_escape(empresa_nome)
    assunto = f"Convite para o Bolão — {empresa_nome}"
    corpo_html = (
        f"<p>Você foi convidado para o bolão <strong>{safe_nome}</strong>.</p>"
        f'<p><a href="{link}">Ativar minha conta</a></p>'
        "<p>Este link funciona uma única vez e é válido pelas próximas 72 horas. "
        "Se o prazo expirar, entre em contato com o administrador do bolão.</p>"
        "<p>Se você não esperava este convite, ignore este e-mail.</p>"
    )
    return _enviar_com_log(
        destinatario=destinatario,
        assunto=assunto,
        corpo_html=corpo_html,
        nome_remetente=empresa_nome,
        rotulo="convite",
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
    safe_nome = html_escape(empresa_nome)
    safe_dest = html_escape(destinatario)
    if motivo == "conta_criada":
        assunto = f"Defina sua senha — {empresa_nome}"
        corpo_html = (
            f"<p>Sua conta no bolão <strong>{safe_nome}</strong> foi criada.</p>"
            f"<p>Use o link abaixo para definir sua senha de acesso com o e-mail "
            f"<strong>{safe_dest}</strong>.</p>"
            f'<p><a href="{link}">Definir senha</a></p>'
            "<p>O link expira em breve. Se você não esperava este acesso, ignore este e-mail.</p>"
        )
    elif motivo == "reset_gestor":
        assunto = f"Sua senha foi redefinida — {empresa_nome}"
        corpo_html = (
            f"<p>A senha da sua conta no bolão <strong>{safe_nome}</strong> foi redefinida "
            "por um administrador.</p>"
            f"<p>Use o link abaixo para definir uma nova senha com o e-mail "
            f"<strong>{safe_dest}</strong>.</p>"
            f'<p><a href="{link}">Definir nova senha</a></p>'
            "<p>O link expira em breve. Se você não esperava esta alteração, ignore este e-mail.</p>"
        )
    else:
        assunto = f"Redefinição de senha — {empresa_nome}"
        corpo_html = (
            f"<p>Recebemos um pedido para redefinir a senha da sua conta no bolão "
            f"<strong>{safe_nome}</strong>.</p>"
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
