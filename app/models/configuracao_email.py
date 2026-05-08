from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConfiguracaoEmail(Base):
    __tablename__ = "configuracao_email"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resend_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_from: Mapped[str | None] = mapped_column(String(320), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
