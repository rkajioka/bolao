"""
Etapa 13 — base de testes: SQLite em memória (sem PostgreSQL obrigatório).

Defina DATABASE_URL antes de qualquer import de `app` (pytest carrega conftest primeiro).

Checklist manual complementar (§18 / Etapa 13 — responsividade):
  abrir `http://localhost:8000/static/app/index.html` em viewport estreita (~375px),
  percorrer login, palpites, especiais, tabela de grupo e ranking; confirmar toques e scrolls.
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-32chars!!")

from app.core.config import get_settings

get_settings.cache_clear()

import pytest
from fastapi.testclient import TestClient
import app.models  # noqa: F401 — registra metadata
from app.database import Base, engine


@pytest.fixture(autouse=True)
def reset_db() -> None:
    """Isola cada teste com schema limpo."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client() -> TestClient:
    from app.main import app

    with TestClient(app) as c:
        yield c
