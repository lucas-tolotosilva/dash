from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.settings import settings

app = FastAPI(title="Vetroresina Dashboard API", version="1.0.0")

# Configuração de CORS: Resolve o erro "blocked by CORS policy" no seu navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Libera acesso para o seu localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)