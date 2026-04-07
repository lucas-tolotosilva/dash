from pydantic import BaseModel
from typing import List, Optional

class ProtheusQueryRequest(BaseModel):
    tabela: str
    campos_desejados: List[str]
    where: Optional[str] = None

# --- NOVO SCHEMA PARA O SELF-SERVICE BI ---
class ReportBuilderRequest(BaseModel):
    assunto: str                 # ex: "faturamento", "pedidos"
    dimensoes: List[str]         # ex: ["F2_CLIENTE"] (Como agrupar)
    metricas: List[str]          # ex: ["F2_VALMERC"] (O que somar/contar)
    data_de: str                 # YYYYMMDD
    data_ate: str                # YYYYMMDD
    operacao: str = "SUM"        # SUM, COUNT, AVG