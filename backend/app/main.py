from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.settings import settings

app = FastAPI(title="Vetroresina Dashboard API", version="1.0.0")

# CORS (frontend Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
