import app.models  # noqa: F401 — garante registro dos models no metadata

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes import auth, grupos, health, jogos, marcadores_brasil, paises, palpites_especiais, palpites_jogos, usuarios

app = FastAPI(
    title="Bolão da Copa do Mundo — MVP",
    version="0.1.0",
)

_static_root = Path(__file__).resolve().parent.parent / "static"
_static_root.mkdir(parents=True, exist_ok=True)
(_static_root / "bandeiras").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(_static_root)), name="static")

app.include_router(health.router, tags=["health"])
app.include_router(auth.router)
app.include_router(usuarios.router)
app.include_router(paises.router)
app.include_router(jogos.router)
app.include_router(grupos.router)
app.include_router(palpites_jogos.router)
app.include_router(palpites_especiais.router)
app.include_router(marcadores_brasil.router)
