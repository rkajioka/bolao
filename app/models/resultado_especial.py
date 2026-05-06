from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ResultadoEspecial(Base):
    __tablename__ = "resultados_especiais"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    campeao_id: Mapped[int | None] = mapped_column(ForeignKey("paises.id"), nullable=True)
    melhor_jogador: Mapped[str | None] = mapped_column(String(255), nullable=True)
    artilheiro: Mapped[str | None] = mapped_column(String(255), nullable=True)
    melhor_goleiro: Mapped[str | None] = mapped_column(String(255), nullable=True)
    finalizado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    campeao = relationship("Pais", foreign_keys=[campeao_id])
