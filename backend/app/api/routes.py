from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Optional
from fastapi import APIRouter, Query, HTTPException
from app.core.settings import settings
from app.services.protheus_client import ProtheusClient

router = APIRouter()
client = ProtheusClient()

# ======================================================
# Utils & Segurança
# ======================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _trim_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Saneamento de strings para evitar espaços em branco do ERP"""
    out = {}
    for k, v in row.items():
        out[k] = v.strip() if isinstance(v, str) else v
    return out

def _rows(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = raw.get("rows") or []
    return [_trim_row(r) for r in rows]

def _escape_sql(s: str) -> str:
    """Proteção contra SQL Injection"""
    return (s or "").replace("'", "''")

# ======================================================
# Endpoints de BI e Métricas (Ordem #021)
# ======================================================
@router.get("/metrics")
async def get_metrics(
    categoria: str = Query(..., description="faturamento, pagar, receber"),
    data_de: str = Query(...),
    data_ate: str = Query(...)
):
    """Endpoint para alimentar os gráficos do seu novo layout Overview"""
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        total = 0.0

        if categoria == "faturamento":
            # SF2: Faturamento real
            raw = await client.consbanco("SF2", ["F2_VALBRUT"], f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' ")
            total = sum(float(r.get("F2_VALBRUT", 0)) for r in _rows(raw))
        elif categoria == "receber":
            # SE1: Contas a Receber
            raw = await client.consbanco("SE1", ["E1_VALOR"], f" AND E1_VENCTO BETWEEN '{d_de}' AND '{d_ate}' AND E1_SALDO > 0 ")
            total = sum(float(r.get("E1_VALOR", 0)) for r in _rows(raw))
        elif categoria == "pagar":
            # SE2: Contas a Pagar
            raw = await client.consbanco("SE2", ["E2_VALOR"], f" AND E2_VENCTO BETWEEN '{d_de}' AND '{d_ate}' AND E2_SALDO > 0 ")
            total = sum(float(r.get("E2_VALOR", 0)) for r in _rows(raw))
        
        return {"ok": True, "total": total, "categoria": categoria}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ======================================================
# Dashboard Summary Resiliente
# ======================================================
@router.get("/dashboard/summary")
async def dashboard_summary():
    """Alimenta os cards de Pedidos, OPs e Estoque no layout novo"""
    kpis = {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}
    errors = []
    
    try:
        r_ops = await client.consbanco("SD3", ["D3_OP"], " AND D3_OP <> '' AND D3_QUANT > 0 ")
        kpis["ops_ativas"] = len(_rows(r_ops))
    except Exception as e: errors.append(f"SD3: {str(e)}")

    try:
        r_sc5 = await client.consbanco("SC5", ["C5_NUM"], "")
        kpis["pedidos_abertos"] = len(_rows(r_sc5))
    except Exception as e: errors.append(f"SC5: {str(e)}")

    try:
        r_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(r_sb2))
    except Exception as e: errors.append(f"SB2: {str(e)}")

    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso(), "debug": errors if errors else None}

@router.get("/health")
def health():
    return {"ok": True, "ts": now_iso()}