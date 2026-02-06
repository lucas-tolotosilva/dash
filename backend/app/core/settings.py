from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000

    # Protheus Connection
    protheus_consbanco_url: str = Field(default="", validation_alias="PROTHEUS_CONSBANCO_URL")
    protheus_base_url: Optional[str] = Field(default=None, validation_alias="PROTHEUS_BASE_URL")
    protheus_timeout_seconds: int = Field(default=20, validation_alias="PROTHEUS_TIMEOUT_SECONDS")
    protheus_token: Optional[str] = Field(default=None, validation_alias="PROTHEUS_TOKEN")
    
    # Campos obrigatórios para o Motor de Investigação (MII)
    protheus_basic_user: str = Field(default="", validation_alias="PROTHEUS_BASIC_USER")
    protheus_basic_pass: str = Field(default="", validation_alias="PROTHEUS_BASIC_PASS")

    def allow_origins_list(self) -> List[str]:
        return ["http://localhost:5173", "http://127.0.0.1:5173", "http://192.168.56.1:5173", "http://192.168.0.199:5173"]

settings = Settings()
        


