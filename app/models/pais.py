from datetime import datetime

from sqlalchemy import DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pais(Base):
    __tablename__ = "paises"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    sigla: Mapped[str] = mapped_column(String(8), nullable=False)
    bandeira_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    grupo: Mapped[str | None] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    jogos_casa = relationship(
        "Jogo",
        foreign_keys="Jogo.pais_casa_id",
        back_populates="pais_casa",
    )
    jogos_fora = relationship(
        "Jogo",
        foreign_keys="Jogo.pais_fora_id",
        back_populates="pais_fora",
    )
    jogos_classificado = relationship(
        "Jogo",
        foreign_keys="Jogo.classificado_id",
        back_populates="classificado",
    )
