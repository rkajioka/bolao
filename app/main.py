import app.models  # noqa: F401 — garante registro dos models no metadata

from fastapi import FastAPI

from app.routes import health

app = FastAPI(
    title="Bolão da Copa do Mundo — MVP",
    version="0.1.0",
)

app.include_router(health.router, tags=["health"])
