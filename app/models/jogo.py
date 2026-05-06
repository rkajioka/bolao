from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Jogo(Base):
    __tablename__ = "jogos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fase: Mapped[str] = mapped_column(String(128), nullable=False)
    grupo: Mapped[str | None] = mapped_column(String(16), nullable=True)
    tipo_fase: Mapped[str] = mapped_column(String(32), nullable=False)

    pais_casa_id: Mapped[int] = mapped_column(ForeignKey("paises.id"), nullable=False)
    pais_fora_id: Mapped[int] = mapped_column(ForeignKey("paises.id"), nullable=False)

    data_jogo: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    placar_casa: Mapped[int | None] = mapped_column(Integer, nullable=True)
    placar_fora: Mapped[int | None] = mapped_column(Integer, nullable=True)

    teve_prorrogacao: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    foi_para_penaltis: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    penaltis_casa: Mapped[int | None] = mapped_column(Integer, nullable=True)
    penaltis_fora: Mapped[int | None] = mapped_column(Integer, nullable=True)

    classificado_id: Mapped[int | None] = mapped_column(ForeignKey("paises.id"), nullable=True)
    finalizado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    pais_casa = relationship("Pais", foreign_keys=[pais_casa_id], back_populates="jogos_casa")
    pais_fora = relationship("Pais", foreign_keys=[pais_fora_id], back_populates="jogos_fora")
    classificado = relationship(
        "Pais",
        foreign_keys=[classificado_id],
        back_populates="jogos_classificado",
    )

    palpites = relationship("PalpiteJogo", back_populates="jogo")
    marcadores_resultado = relationship("MarcadorBrasilResultado", back_populates="jogo")
