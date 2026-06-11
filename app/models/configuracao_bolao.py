from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ConfiguracaoBolao(Base):
    __tablename__ = "configuracoes_bolao"
    __table_args__ = (UniqueConstraint("empresa_id", name="uq_configuracoes_bolao_empresa_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    empresa_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False, index=True
    )

    data_bloqueio_palpites_especiais: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    override_bloqueio_palpites_especiais: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    pontos_campeao: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_vice_campeao: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_terceiro_lugar: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pontos_artilheiro_pais: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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
