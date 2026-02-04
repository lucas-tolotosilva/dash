from pydantic import BaseModel
from typing import List, Optional


class ProtheusQueryRequest(BaseModel):
    tabela: str
    campos_desejados: List[str]
    where: Optional[str] = ""
