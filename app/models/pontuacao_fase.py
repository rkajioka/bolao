from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PontuacaoFase(Base):
    __tablename__ = "pontuacao_fase"
    __table_args__ = (UniqueConstraint("fase_key", name="uq_pontuacao_fase_key"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    fase_key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    pontos_placar_exato: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_resultado_correto: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_classificado_mata_mata: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
