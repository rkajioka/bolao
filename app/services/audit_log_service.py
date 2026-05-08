import json

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log(
    db: Session,
    acao: str,
    usuario_id: int | None = None,
    empresa_id: int | None = None,
    alvo: str | None = None,
    metadata: dict | None = None,
    ip: str | None = None,
) -> None:
    entry = AuditLog(
        usuario_id=usuario_id,
        empresa_id=empresa_id,
        acao=acao,
        alvo=alvo,
        metadata_json=json.dumps(metadata, ensure_ascii=False) if metadata else None,
        ip=ip,
    )
    db.add(entry)
    db.flush()
