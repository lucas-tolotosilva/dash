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
    """Saneamento de strings para evitar espaços em branco do ERP Protheus"""
    out = {}
    for k, v in row.items():
        out[k] = v.strip() if isinstance(v, str) else v
    return out

def _rows(raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    rows = raw.get("rows") or []
    return [_trim_row(r) for r in rows]

def _escape_sql(s: str) -> str:
    """Proteção essencial contra SQL Injection em filtros manuais"""
    return (s or "").replace("'", "''")

# ======================================================
# Endpoints: BI & Métricas (Ordem #019)
# ======================================================
@router.get("/metrics")
async def get_unified_metrics(
    categoria: str = Query(..., description="Categorias: faturamento, pagar, receber"),
    data_de: str = Query(..., description="Data no formato YYYYMMDD"),
    data_ate: str = Query(..., description="Data no formato YYYYMMDD")
):
    """Endpoint de BI para SF2 (Faturamento), SE1 (Receber) e SE2 (Pagar)"""
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        total = 0.0

        if categoria == "faturamento":
            # SF2: Cabeçalho de Nota Fiscal de Saída
            where = f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' "
            raw = await client.consbanco("SF2", ["F2_VALBRUT"], where)
            total = sum(float(r.get("F2_VALBRUT", 0)) for r in _rows(raw))

        elif categoria == "receber":
            # SE1: Contas a Receber
            where = f" AND E1_VENCTO BETWEEN '{d_de}' AND '{d_ate}' AND E1_SALDO > 0 "
            raw = await client.consbanco("SE1", ["E1_VALOR"], where)
            total = sum(float(r.get("E1_VALOR", 0)) for r in _rows(raw))

        elif categoria == "pagar":
            # SE2: Contas a Pagar
            where = f" AND E2_VENCTO BETWEEN '{d_de}' AND '{d_ate}' AND E2_SALDO > 0 "
            raw = await client.consbanco("SE2", ["E2_VALOR"], where)
            total = sum(float(r.get("E2_VALOR", 0)) for r in _rows(raw))
        
        else:
            raise HTTPException(status_code=400, detail="Categoria inválida")

        return {
            "ok": True,
            "categoria": categoria,
            "total": total,
            "periodo": {"de": d_de, "ate": d_ate}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ======================================================
# Endpoints: Dashboard Summary
# ======================================================
@router.get("/dashboard/summary")
async def dashboard_summary():
    """KPIs unificados e resilientes"""
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
        # Consulta real de estoque (Saldos Físicos) na SB2
        r_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(r_sb2))
    except Exception as e: errors.append(f"SB2: {str(e)}")

    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso(), "debug": errors if errors else None}

# ======================================================
# Endpoints: Pedidos de Venda
# ======================================================
@router.get("/pedidos-venda")
async def get_pedidos(page: int = 1, page_size: int = 5):
    try:
        raw_sc5 = await client.consbanco("SC5", ["C5_NUM", "C5_CLIENTE", "C5_EMISSAO"], "")
        sc5_rows = _rows(raw_sc5)
        if not sc5_rows: return {"ok": True, "data": {"items": [], "total": 0}}

        start = (page - 1) * page_size
        paged = sc5_rows[start : start + page_size]
        
        # SQL IN seguro para Python 3.9
        nums_sql = ",".join([f"'{r['C5_NUM']}'" for r in paged])
        raw_sc6 = await client.consbanco("SC6", ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"], f" AND C6_NUM IN ({nums_sql}) ")
        sc6_rows = _rows(raw_sc6)
        
        final = []
        for p in paged:
            itens = [it for it in sc6_rows if it["C6_NUM"] == p["C5_NUM"]]
            for it in itens:
                final.append({
                    "numero": p["C5_NUM"],
                    "cliente_cod": p["C5_CLIENTE"],
                    "emissao": p["C5_EMISSAO"],
                    "produto": it["C6_PRODUTO"],
                    "quantidade": it["C6_QTDVEN"]
                })
        return {"ok": True, "data": {"items": final, "total": len(sc5_rows), "page": page}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))