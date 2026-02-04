from typing import Optional, List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # App
    app_env: str = "development"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    allow_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Protheus - Autenticação e Conexão
    protheus_consbanco_url: str = Field(default="", validation_alias="PROTHEUS_CONSBANCO_URL")
    protheus_basic_user: str = Field(default="", validation_alias="PROTHEUS_BASIC_USER")
    protheus_basic_pass: str = Field(default="", validation_alias="PROTHEUS_BASIC_PASS")
    protheus_token: Optional[str] = Field(default=None, validation_alias="PROTHEUS_TOKEN")
    protheus_timeout_seconds: int = Field(default=20, validation_alias="PROTHEUS_TIMEOUT_SECONDS")

    # Mapeamento de Tabelas
    ops_table: str = "SD3"
    pedidos_sc5_table: str = "SC5"
    pedidos_sc6_table: str = "SC6"

    def allow_origins_list(self) -> List[str]:
        return [x.strip() for x in self.allow_origins.split(",") if x.strip()]

    def ops_fields_list(self) -> List[str]:
        return ["D3_OP", "D3_COD", "D3_QUANT", "D3_LOTECTL", "D3_XENDERE"]
    
    def pedidos_sc5_fields_list(self) -> List[str]:
        return ["C5_NUM", "C5_CLIENTE", "C5_LOJA", "C5_EMISSAO"]
    
    def pedidos_sc6_fields_list(self) -> List[str]:
        return ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"]

settings = Settings()