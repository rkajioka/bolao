from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmpresaTema(Base):
    __tablename__ = "empresa_temas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empresa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    tokens_dark: Mapped[dict] = mapped_column(JSON, nullable=False)
    tokens_light: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
