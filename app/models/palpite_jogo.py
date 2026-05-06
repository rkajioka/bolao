from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PalpiteJogo(Base):
    __tablename__ = "palpites_jogos"
    __table_args__ = (UniqueConstraint("usuario_id", "jogo_id", name="uq_palpite_usuario_jogo"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)
    jogo_id: Mapped[int] = mapped_column(ForeignKey("jogos.id"), nullable=False, index=True)

    palpite_casa: Mapped[int | None] = mapped_column(Integer, nullable=True)
    palpite_fora: Mapped[int | None] = mapped_column(Integer, nullable=True)
    palpite_classificado_id: Mapped[int | None] = mapped_column(ForeignKey("paises.id"), nullable=True)

    pontuacao_placar: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_resultado: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_classificado: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_marcadores_brasil: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    usuario = relationship("Usuario", back_populates="palpites_jogos")
    jogo = relationship("Jogo", back_populates="palpites")
    palpite_classificado = relationship(
        "Pais",
        foreign_keys=[palpite_classificado_id],
    )
    marcadores_brasil = relationship(
        "MarcadorBrasilPalpite",
        back_populates="palpite_jogo",
        cascade="all, delete-orphan",
    )
