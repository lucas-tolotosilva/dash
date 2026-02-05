from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Configurações do App [cite: 319, 320, 321]
    app_env: str = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    
    # Protheus Connection [cite: 325, 327]
    protheus_consbanco_url: str = Field(default="", validation_alias="PROTHEUS_CONSBANCO_URL")
    protheus_timeout_seconds: int = Field(default=20, validation_alias="PROTHEUS_TIMEOUT_SECONDS")
    
    # Autenticação (Ajuste obrigatório para o ProtheusClient) [cite: 12]
    protheus_basic_user: str = Field(default="", validation_alias="PROTHEUS_BASIC_USER")
    protheus_basic_pass: str = Field(default="", validation_alias="PROTHEUS_BASIC_PASS")
    protheus_token: Optional[str] = Field(default=None, validation_alias="PROTHEUS_TOKEN")

settings = Settings()