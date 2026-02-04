from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Optional
from fastapi import APIRouter, Query, HTTPException
from app.core.settings import settings
from app.services.protheus_client import ProtheusClient
from app.api.schemas import ProtheusQueryRequest

router = APIRouter()
client = ProtheusClient()

# ======================================================
# Utils
# ======================================================
def now_iso() -> str:
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
    rows = raw.get("rows") or []
    return [_trim_row(r) for r in rows]

def _paginate(items: List[Dict[str, Any]], page: int, page_size: int) -> Dict[str, Any]:
    if page < 1: page = 1
    if page_size < 1: page_size = 5
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
    }

def _escape_sql(s: str) -> str:
    """Proteção contra SQL Injection"""
    return (s or "").replace("'", "''")

# ======================================================
# Lookups & Helpers
# ======================================================
def _in_where(field: str, values: Set[str]) -> str:
    vals = [v for v in values if v]
    if not vals: return ""
    safe = [_escape_sql(v) for v in vals]
    quoted = ",".join([f"'{v}'" for v in safe])
    return f" AND {field} IN ({quoted}) "

async def _fetch_prod_desc_map(client: ProtheusClient, cods: Set[str]) -> Dict[str, str]:
    where = _in_where("B1_COD", cods)
    if not where: return {}
    raw = await client.consbanco("SB1", ["B1_COD", "B1_DESC"], where)
    return {r.get("B1_COD", ""): r.get("B1_DESC", "") for r in _rows(raw)}

async def _fetch_cliente_nome_map(client: ProtheusClient, clis: Set[str]) -> Dict[str, str]:
    where = _in_where("A1_COD", clis)
    if not where: return {}
    raw = await client.consbanco("SA1", ["A1_COD", "A1_NOME"], where)
    return {r.get("A1_COD", ""): r.get("A1_NOME", "") for r in _rows(raw)}

# ======================================================
# Endpoints: Dashboard & Analytics
# ======================================================
@router.get("/health")
def health():
    return {"ok": True, "ts": now_iso()}

@router.get("/dashboard/summary")
async def dashboard_summary():
    """KPIs unificados e resilientes: Erro em uma tabela não quebra as outras"""
    kpis = {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}
    errors = []
    
    try:
        raw_ops = await client.consbanco("SD3", ["D3_OP"], " AND D3_OP <> '' AND D3_QUANT > 0 ")
        kpis["ops_ativas"] = len(_rows(raw_ops))
    except Exception as e: errors.append(f"SD3: {str(e)}")

    try:
        raw_sc5 = await client.consbanco("SC5", ["C5_NUM"], "")
        kpis["pedidos_abertos"] = len(_rows(raw_sc5))
    except Exception as e: errors.append(f"SC5: {str(e)}")

    try:
        raw_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(raw_sb2))
    except Exception as e: errors.append(f"SB2: {str(e)}")

    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso(), "debug": errors if errors else None}

# ======================================================
# Endpoints: Pedidos de Venda (SC5 / SC6)
# ======================================================
@router.get("/pedidos-venda")
async def get_pedidos(
    page: int = Query(1, ge=1), 
    page_size: int = Query(25, ge=1, le=200), 
    cliente: Optional[str] = Query(None)
):
    where_sc5 = ""
    if cliente:
        needle = _escape_sql(cliente)
        raw_cli = await client.consbanco("SA1", ["A1_COD"], f" AND A1_NOME LIKE '%{needle}%' ")
        clis = {r["A1_COD"] for r in _rows(raw_cli)}
        if not clis: return {"ok": True, "data": _paginate([], page, page_size), "ts": now_iso()}
        where_sc5 = _in_where("C5_CLIENTE", clis)

    raw_sc5 = await client.consbanco("SC5", ["C5_NUM", "C5_CLIENTE", "C5_EMISSAO"], where_sc5)
    sc5_rows = _rows(raw_sc5)
    
    if not sc5_rows:
        return {"ok": True, "data": _paginate([], page, page_size), "ts": now_iso()}

    paged = _paginate(sc5_rows, page, page_size)
    nums = {r["C5_NUM"] for r in paged["items"]}
    
    raw_sc6 = await client.consbanco("SC6", ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"], _in_where("C6_NUM", nums))
    sc6_rows = _rows(raw_sc6)
    
    cli_map = await _fetch_cliente_nome_map(client, {r["C5_CLIENTE"] for r in sc5_rows})
    prod_map = await _fetch_prod_desc_map(client, {r["C6_PRODUTO"] for r in sc6_rows})
    
    final = []
    for p in paged["items"]:
        itens_ped = [it for it in sc6_rows if it["C6_NUM"] == p["C5_NUM"]]
        for it in itens_ped:
            final.append({
                "numero": p["C5_NUM"],
                "cliente": cli_map.get(p["C5_CLIENTE"], ""),
                "emissao": p["C5_EMISSAO"],
                "produto": prod_map.get(it["C6_PRODUTO"], it["C6_PRODUTO"]),
                "quantidade": it["C6_QTDVEN"]
            })
    return {"ok": True, "data": {**paged, "items": final}, "ts": now_iso()}

@router.get("/pedidos-venda/{pedido_id}")
async def get_pedido_unitario(pedido_id: str):
    """Consulta unitária para detalhes do pedido"""
    try:
        where_id = f" AND C5_NUM = '{_escape_sql(pedido_id)}' "
        raw_sc5 = await client.consbanco("SC5", ["*"], where_id)
        sc5_rows = _rows(raw_sc5)
        
        if not sc5_rows:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
            
        header = sc5_rows[0]
        raw_sc6 = await client.consbanco("SC6", ["*"], f" AND C6_NUM = '{_escape_sql(pedido_id)}' ")
        items = _rows(raw_sc6)
        
        return {"ok": True, "data": {"header": header, "items": items}, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ======================================================
# Endpoints: OPs (SD3)
# ======================================================
@router.get("/ops")
async def get_ops(page: int = Query(1), page_size: int = Query(5)):
    try:
        where_ops = " AND D3_OP <> '' AND D3_QUANT > 0 "
        raw = await client.consbanco("SD3", ["D3_COD", "D3_OP", "D3_QUANT", "D3_LOTECTL", "D3_XENDERE"], where_ops)
        rows = _rows(raw)
        cods = {r.get("D3_COD", "") for r in rows}
        prod_map = await _fetch_prod_desc_map(client, cods)
        
        final = []
        for r in rows:
            final.append({
                "op": r.get("D3_OP", ""),
                "cod": r.get("D3_COD", ""),
                "produto_nome": prod_map.get(r.get("D3_COD", ""), ""),
                "lote": r.get("D3_LOTECTL", ""),
                "quantidade": r.get("D3_QUANT", 0),
                "endereco": r.get("D3_XENDERE", "")
            })
        return {"ok": True, "data": _paginate(final, page, page_size), "ts": now_iso()}
    except Exception as e:
        return {"ok": False, "data": _paginate([], page, page_size), "ts": now_iso(), "debug": [str(e)]}