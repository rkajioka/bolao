import app.models  # noqa: F401 — garante registro dos models no metadata

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import cors_origins_for_settings, get_settings
from app.routes import (
    auth,
    configuracao_bolao,
    empresas,
    equipe,
    grupos,
    health,
    jogos,
    marcadores_brasil,
    paises,
    palpites_especiais,
    palpites_jogos,
    perfil,
    pontuacao_fase,
    ranking,
    resultados_especiais,
    tema,
    usuarios,
)

settings = get_settings()

_root = Path(__file__).resolve().parent.parent
_static_root = _root / "static"
_static_root.mkdir(parents=True, exist_ok=True)
(_static_root / "bandeiras").mkdir(parents=True, exist_ok=True)
(_static_root / "uploads" / "avatars").mkdir(parents=True, exist_ok=True)

_frontend_dist = _root / "frontend" / "dist"
_SPA_HTML_PATHS = frozenset(
    {
        "/",
        "/login",
        "/primeiro-acesso",
        "/ativar-conta",
        "/esqueci-senha",
        "/redefinir-senha",
        "/jogos",
        "/especiais",
        "/regras",
        "/grupos",
        "/ranking",
        "/perfil",
        "/admin",
        "/admin/config",
        "/equipe",
    }
)

app = FastAPI(
    title="Bolão da Copa do Mundo — MVP",
    version="0.2.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins_for_settings(settings),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Bolao-Client"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not settings.debug:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; frame-ancestors 'none'; "
            "base-uri 'self'; upgrade-insecure-requests"
        )
    return response


@app.middleware("http")
async def cache_hashed_assets(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/assets/") and response.status_code == 200:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@app.middleware("http")
async def serve_spa_on_html_navigation(request: Request, call_next):
    if _frontend_dist.exists() and request.method == "GET":
        accept = request.headers.get("accept", "").lower()
        # Navegação do browser (F5): text/html sem JSON. Fetch da API: application/json ou */*.
        if "text/html" in accept and "application/json" not in accept:
            path = request.url.path.rstrip("/") or "/"
            if path in _SPA_HTML_PATHS:
                index = _frontend_dist / "index.html"
                if index.exists():
                    return FileResponse(str(index))
    return await call_next(request)

app.include_router(health.router, tags=["health"])
app.include_router(auth.router)
app.include_router(configuracao_bolao.router)
app.include_router(empresas.router)
app.include_router(equipe.router)
app.include_router(perfil.router)
app.include_router(usuarios.router)
app.include_router(paises.router)
app.include_router(jogos.router)
app.include_router(grupos.router)
app.include_router(ranking.router)
app.include_router(palpites_jogos.router)
app.include_router(palpites_especiais.router)
app.include_router(resultados_especiais.router)
app.include_router(marcadores_brasil.router)
app.include_router(pontuacao_fase.router)
app.include_router(tema.router)

# Serve static assets (ex.: bandeiras)
app.mount("/static", StaticFiles(directory=str(_static_root)), name="static")

# Serve new React frontend — must be last
if _frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_frontend_dist / "assets")), name="frontend-assets")

    def _spa_index_response() -> FileResponse | JSONResponse:
        index = _frontend_dist / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "Frontend build not found"}, status_code=404)

    @app.get("/", include_in_schema=False, response_model=None)
    def serve_spa_root() -> FileResponse | JSONResponse:
        return _spa_index_response()

    @app.get("/{full_path:path}", include_in_schema=False, response_model=None)
    def serve_spa(full_path: str, request: Request) -> FileResponse | JSONResponse:
        accept = request.headers.get("accept", "").lower()
        if "application/json" in accept:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        path = f"/{full_path}".rstrip("/") or "/"
        if path not in _SPA_HTML_PATHS:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return _spa_index_response()
else:
    @app.get("/", include_in_schema=False)
    def root_unavailable() -> JSONResponse:
        return JSONResponse({"detail": "Frontend not served by backend in dev. Use Vite dev server."}, status_code=404)
