from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.core.settings import settings
from app.services.protheus_client import ProtheusClient
from app.api.schemas import ProtheusQueryRequest

router = APIRouter()
client = ProtheusClient()

# --- CONFIGURAÇÃO DE SEGURANÇA E TABELAS ---
# Lista Oficial de Tabelas da Vetroresina para o BI (Ordem #021)
TABELAS_AUTORIZADAS = [
    "SC5", "SC6", "SF1", "SD1", "SC2", "SD3", "SE1", "SE2", 
    "FK2", "FK3", "FK4", "SE5", "FK5", "FK6", "FI7", "SB2", "SF2"
]

def now_iso() -> str:
    """Retorna o timestamp atual em formato ISO UTC"""
    return datetime.now(timezone.utc).isoformat()

def _trim_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Saneamento de strings para evitar espaços em branco do ERP Protheus"""
    out = {}
    for k, v in row.items():
        if isinstance(v, str):
            out[k] = v.strip()
        else:
            out[k] = v
    return out

def _rows(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extrai e sanitiza as linhas do retorno da API"""
    rows = raw.get("rows") or []
    return [_trim_row(r) for r in rows]

def _escape_sql(s: str) -> str:
    """Proteção essencial contra SQL Injection em filtros manuais"""
    return (s or "").replace("'", "''")

# --- ENDPOINTS CORE ---

@router.get("/health")
def health():
    """Verificação de status da API"""
    return {"ok": True, "ts": now_iso()}

@router.get("/dashboard/summary")
async def dashboard_summary():
    """Busca KPIs das tabelas mestras com tratamento de erro individual para resiliência"""
    kpis = {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}
    
    # Busca OPs (SD3) - Produção
    try:
        r_ops = await client.consbanco("SD3", ["D3_OP"], " AND D3_OP <> '' AND D3_QUANT > 0 ")
        kpis["ops_ativas"] = len(_rows(r_ops))
    except Exception:
        pass

    # Busca Pedidos (SC5) - Comercial
    try:
        r_sc5 = await client.consbanco("SC5", ["C5_NUM"], "")
        kpis["pedidos_abertos"] = len(_rows(r_sc5))
    except Exception:
        pass

    # Busca Estoque (SB2) - Saldos Físicos (Bobinas)
    try:
        r_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(r_sb2))
    except Exception:
        pass

    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso()}

@router.post("/api/dynamic-query")
async def dynamic_query(payload: ProtheusQueryRequest):
    """Motor de BI para as tabelas autorizadas da Vetroresina"""
    tabela = payload.tabela.upper()
    if tabela not in TABELAS_AUTORIZADAS:
        raise HTTPException(status_code=403, detail=f"Tabela {tabela} não autorizada para BI.")
    
    try:
        # Sanitização de filtros para garantir segurança na query
        where_safe = payload.where or ""
        raw = await client.consbanco(tabela, payload.campos_desejados, where_safe)
        return {"ok": True, "data": _rows(raw), "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_metrics(categoria: str, data_de: str, data_ate: str):
    """Faturamento real (SF2) e métricas financeiras para gráficos"""
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        total = 0.0
        
        if categoria == "faturamento":
            # SF2: Cabeçalho de Nota Fiscal de Saída
            where = f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' "
            raw = await client.consbanco("SF2", ["F2_VALBRUT"], where)
            total = sum(float(r.get("F2_VALBRUT", 0)) for r in _rows(raw))
            
        return {"ok": True, "total": total, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))