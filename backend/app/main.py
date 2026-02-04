from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.settings import settings

app = FastAPI(title="Vetroresina Dashboard API", version="1.0.0")

# Configuração de CORS - Libera o Frontend do Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, substitua pelo domínio real
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)