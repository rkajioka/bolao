from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditoriaAdmin(Base):
    __tablename__ = "auditoria_admin"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    admin_user_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    acao: Mapped[str] = mapped_column(String(128), nullable=False)
    entidade: Mapped[str] = mapped_column(String(64), nullable=False)
    entidade_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="success")
    detalhes_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
