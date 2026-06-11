from __future__ import annotations

import asyncio
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database import SessionLocal
from app.models.empresa import Empresa
from app.models.usuario import Usuario
from app.schemas.comunicado import (
    ComunicadoEquipePreviewResponse,
    ComunicadoEquipeRequest,
)
from app.services import audit_log_service, email_dispatch_service, email_service

logger = logging.getLogger(__name__)


def _normalizar_email(email: str) -> str:
    return email.strip().lower()


def _deduplicar_emails(emails: list[str]) -> list[str]:
    vistos: set[str] = set()
    resultado: list[str] = []
    for email in emails:
        normalizado = _normalizar_email(email)
        if not normalizado or normalizado in vistos:
            continue
        vistos.add(normalizado)
        resultado.append(normalizado)
    return resultado


def resolver_destinatarios_comunicado(
    db: Session,
    empresa_id: int,
    admin: Usuario,
    *,
    modo_teste: bool,
) -> list[str]:
    if modo_teste:
        return [_normalizar_email(admin.email)]

    emails = db.scalars(
        select(Usuario.email)
        .where(
            Usuario.empresa_id == empresa_id,
            Usuario.tipo_usuario.in_(("usuario", "admin")),
            Usuario.ativo.is_(True),
            Usuario.bloqueado.is_(False),
            Usuario.primeiro_login.is_(False),
        )
        .order_by(Usuario.email.asc())
    ).all()
    return _deduplicar_emails(list(emails))


def preview_comunicado(
    db: Session,
    empresa_id: int,
    admin: Usuario,
    *,
    modo_teste: bool,
) -> ComunicadoEquipePreviewResponse:
    destinatarios = resolver_destinatarios_comunicado(
        db, empresa_id, admin, modo_teste=modo_teste
    )
    return ComunicadoEquipePreviewResponse(
        total_destinatarios=len(destinatarios),
        modo_teste=modo_teste,
    )


def preparar_comunicado(
    db: Session,
    empresa_id: int,
    admin: Usuario,
    data: ComunicadoEquipeRequest,
    ip: str | None,
) -> tuple[list[str], str, bool]:
    empresa = db.get(Empresa, empresa_id)
    if empresa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa não encontrada")

    modo_teste = data.modo_teste
    destinatarios = resolver_destinatarios_comunicado(
        db, empresa_id, admin, modo_teste=modo_teste
    )
    if not destinatarios and not modo_teste:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum participante ativo encontrado",
        )

    assunto_truncado = data.assunto[:80] + ("…" if len(data.assunto) > 80 else "")
    audit_log_service.log(
        db,
        acao="equipe.comunicado_enviado",
        usuario_id=admin.id,
        empresa_id=empresa_id,
        alvo=f"{len(destinatarios)} destinatário(s)"
        + (" (modo teste)" if modo_teste else ""),
        metadata={"assunto": assunto_truncado, "modo_teste": modo_teste},
        ip=ip,
    )
    db.commit()

    return destinatarios, empresa.nome, modo_teste


async def enviar_comunicados_background(
    empresa_id: int,
    empresa_nome: str,
    destinatarios: list[str],
    assunto: str,
    mensagem: str,
    admin_email: str,
) -> None:
    if not destinatarios:
        return

    intervalo = get_settings().email_bulk_interval_seconds
    db = SessionLocal()
    try:
        falhas_envio: list[email_dispatch_service.FalhaEnvioItem] = []
        enviados = 0
        for indice, email in enumerate(destinatarios):
            resultado_envio = await email_service.tentar_enviar_comunicado_async(
                email,
                assunto,
                mensagem,
                empresa_nome,
            )
            if resultado_envio.sucesso:
                enviados += 1
            else:
                falhas_envio.append(
                    email_dispatch_service.FalhaEnvioItem(
                        destinatario=email,
                        operacao="comunicado",
                        erro=resultado_envio.erro or "Falha desconhecida",
                    )
                )
                logger.warning(
                    "Comunicado da equipe não entregue para %s",
                    email,
                )
            if indice < len(destinatarios) - 1 and intervalo > 0:
                await asyncio.sleep(intervalo)

        if falhas_envio:
            await email_dispatch_service.notificar_admins_falha_envio_async(
                db,
                empresa_id=empresa_id,
                empresa_nome=empresa_nome,
                operacao="comunicado da equipe",
                falhas=falhas_envio,
            )

        email_admin = admin_email.strip().lower()
        if email_admin:
            await email_service.tentar_enviar_resumo_comunicado_admin_async(
                email_admin,
                empresa_nome,
                assunto,
                total=len(destinatarios),
                enviados=enviados,
                falhas=len(falhas_envio),
            )
    finally:
        db.close()
