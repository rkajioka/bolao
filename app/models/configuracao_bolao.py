from datetime import datetime

from sqlalchemy import DateTime, Integer, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConfiguracaoBolao(Base):
    __tablename__ = "configuracoes_bolao"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    data_bloqueio_palpites_especiais: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    pontos_campeao: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_melhor_jogador: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_artilheiro: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_melhor_goleiro: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_placar_exato: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_resultado_correto: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_classificado_mata_mata: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_marcador_brasil: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_marcador_brasil_com_quantidade: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
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
