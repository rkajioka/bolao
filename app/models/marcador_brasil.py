from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MarcadorBrasilPalpite(Base):
    __tablename__ = "marcadores_brasil_palpite"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    palpite_jogo_id: Mapped[int] = mapped_column(
        ForeignKey("palpites_jogos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nome_jogador: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade_gols: Mapped[int] = mapped_column(Integer, nullable=False)
    pontuacao: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    palpite_jogo = relationship("PalpiteJogo", back_populates="marcadores_brasil")


class MarcadorBrasilResultado(Base):
    __tablename__ = "marcadores_brasil_resultado"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    jogo_id: Mapped[int] = mapped_column(ForeignKey("jogos.id"), nullable=False, index=True)
    nome_jogador: Mapped[str] = mapped_column(String(255), nullable=False)
    quantidade_gols: Mapped[int] = mapped_column(Integer, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    jogo = relationship("Jogo", back_populates="marcadores_resultado")
