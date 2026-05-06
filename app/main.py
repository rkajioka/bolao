import app.models  # noqa: F401 — garante registro dos models no metadata

from fastapi import FastAPI

from app.routes import auth, health, usuarios

app = FastAPI(
    title="Bolão da Copa do Mundo — MVP",
    version="0.1.0",
)

app.include_router(health.router, tags=["health"])
app.include_router(auth.router)
app.include_router(usuarios.router)
