from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PalpiteEspecial(Base):
    __tablename__ = "palpites_especiais"
    __table_args__ = (UniqueConstraint("usuario_id", name="uq_palpite_especial_usuario"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"), nullable=False, index=True)

    campeao_id: Mapped[int | None] = mapped_column(ForeignKey("paises.id"), nullable=True)
    melhor_jogador: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artilheiro: Mapped[str | None] = mapped_column(String(255), nullable=True)
    melhor_goleiro: Mapped[str | None] = mapped_column(String(255), nullable=True)

    pontuacao_campeao: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_melhor_jogador: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_artilheiro: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_melhor_goleiro: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontuacao_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    bloqueado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    usuario = relationship("Usuario", back_populates="palpites_especiais")
    campeao = relationship("Pais", foreign_keys=[campeao_id])
