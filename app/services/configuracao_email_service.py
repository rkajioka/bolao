from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.configuracao_email import ConfiguracaoEmail


@dataclass(frozen=True)
class CredenciaisEmail:
    resend_api_key: str | None
    email_from: str | None


def obter_ou_padrao(db: Session) -> CredenciaisEmail:
    row = db.scalar(select(ConfiguracaoEmail).where(ConfiguracaoEmail.id == 1))
    if row is None:
        return CredenciaisEmail(resend_api_key=None, email_from=None)
    key = (row.resend_api_key or "").strip() or None
    from_addr = (row.email_from or "").strip() or None
    return CredenciaisEmail(resend_api_key=key, email_from=from_addr)
