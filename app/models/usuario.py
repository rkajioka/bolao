from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    funcao: Mapped[str | None] = mapped_column(String(255), nullable=True)
    imagem_perfil: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    tipo_usuario: Mapped[str] = mapped_column(String(32), nullable=False, default="usuario")
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    primeiro_login: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("CURRENT_TIMESTAMP"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )

    palpites_jogos = relationship("PalpiteJogo", back_populates="usuario")
    palpites_especiais = relationship("PalpiteEspecial", back_populates="usuario")
