from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from core.security import get_current_user, require_role
from routers import autoridades, noticias, eventos
from routers import autoridades, noticias, eventos, admin_config

app = FastAPI(
    title="API de Indexación de Noticias de Orden Público",
    version="1.0.0"
)


app.include_router(admin_config.router)
app.include_router(autoridades.router)
app.include_router(noticias.router)
app.include_router(eventos.router)
# Habilitar CORS para peticiones desde React (Vite: 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/public/health")
def health_check():
    """Ruta pública sin autenticación."""
    return {"status": "ok", "message": "Backend operativo"}


@app.get("/api/me")
def read_current_user_profile(user: dict = Depends(get_current_user)):
    """Ruta que requiere autenticación básica (cualquier usuario con token válido)."""
    return {
        "id": user.get("sub"),
        "username": user.get("preferred_username"),
        "email": user.get("email"),
        "roles": user.get("realm_access", {}).get("roles", [])
    }


@app.post("/api/noticias")
def crear_noticia(user: dict = Depends(require_role("analista"))):
    """Ruta que exige expresamente el rol 'analista'."""
    return {
        "message": "Acceso permitido para registrar noticia",
        "registrado_por": user.get("preferred_username")
    }