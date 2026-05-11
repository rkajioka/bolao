from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, false, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Empresa(Base):
    __tablename__ = "empresas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    codigo_empresa: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    marcadores_brasil_habilitado: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    max_usuarios: Mapped[int] = mapped_column(
        Integer, nullable=False, default=50, server_default="50"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    usuarios = relationship("Usuario", back_populates="empresa")
    convites = relationship("Convite", back_populates="empresa")
