from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.auditoria_admin import AuditoriaAdmin
from app.models.usuario import Usuario


def registrar_evento(
    db: Session,
    admin: Usuario,
    *,
    acao: str,
    entidade: str,
    entidade_id: int | None = None,
    status: str = "success",
    detalhes: dict[str, Any] | None = None,
) -> None:
    payload = json.dumps(detalhes, ensure_ascii=False) if detalhes else None
    db.add(
        AuditoriaAdmin(
            admin_user_id=admin.id,
            acao=acao,
            entidade=entidade,
            entidade_id=entidade_id,
            status=status,
            detalhes_json=payload,
        )
    )
    db.commit()
