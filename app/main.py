import app.models  # noqa: F401 — garante registro dos models no metadata

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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
)


@app.middleware("http")
async def serve_spa_on_html_navigation(request: Request, call_next):
    if _frontend_dist.exists() and request.method == "GET":
        accept = request.headers.get("accept", "")
        if "text/html" in accept:
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

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str = "") -> FileResponse:
        index = _frontend_dist / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse({"detail": "Frontend build not found"}, status_code=404)
else:
    @app.get("/", include_in_schema=False)
    def root_unavailable() -> JSONResponse:
        return JSONResponse({"detail": "Frontend not served by backend in dev. Use Vite dev server."}, status_code=404)
