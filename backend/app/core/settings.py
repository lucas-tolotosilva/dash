from typing import Optional, List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Configuração para ler o arquivo .env corretamente no Pydantic V2 [cite: 317]
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Autenticação (Resolve o erro anterior e garante o BasicAuth) [cite: 12]
    protheus_basic_user: str = Field(default="", validation_alias="PROTHEUS_BASIC_USER")
    protheus_basic_pass: str = Field(default="", validation_alias="PROTHEUS_BASIC_PASS")
    
    # Token (Resolve o erro ATUAL do seu terminal) 
    protheus_token: Optional[str] = Field(default=None, validation_alias="PROTHEUS_TOKEN")

    # URLs e Timeouts [cite: 325, 327]
    protheus_consbanco_url: str = Field(default="", validation_alias="PROTHEUS_CONSBANCO_URL")
    protheus_timeout_seconds: int = Field(default=20, validation_alias="PROTHEUS_TIMEOUT_SECONDS")

    # Mapeamento de Tabelas para as Rotas [cite: 136, 174, 197]
    ops_table: str = "SD3"
    pedidos_sc5_table: str = "SC5"
    pedidos_sc6_table: str = "SC6"

    # Auxiliar para o CORS no main.py
    def allow_origins_list(self) -> List[str]:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Campos exigidos pelas funções de resumo/lista 
    def ops_fields_list(self) -> List[str]:
        return ["D3_OP", "D3_COD", "D3_QUANT", "D3_LOTECTL", "D3_XENDERE"]
    
    def pedidos_sc5_fields_list(self) -> List[str]:
        return ["C5_NUM", "C5_CLIENTE", "C5_LOJA", "C5_EMISSAO"]
    
    def pedidos_sc6_fields_list(self) -> List[str]:
        return ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"]

settings = Settings()