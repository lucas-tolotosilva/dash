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
    """Saneamento de strings para evitar espaços em branco do ERP [cite: 13, 33]"""
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
    """Proteção contra SQL Injection """
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
    """KPIs unificados e resilientes [cite: 247, 257]"""
    kpis = {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}
    try:
        raw_ops = await client.consbanco("SD3", ["D3_OP"], " AND D3_OP <> '' AND D3_QUANT > 0 ")
        kpis["ops_ativas"] = len(_rows(raw_ops))
        
        raw_sc5 = await client.consbanco("SC5", ["C5_NUM"], "")
        kpis["pedidos_abertos"] = len(_rows(raw_sc5))
        
        raw_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(raw_sb2))
    except: pass
    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso()}

@router.get("/analytics/vendas")
async def analytics_vendas():
    """Endpoint para alimentar gráficos de volume [Novo]"""
    try:
        raw = await client.consbanco("SC5", ["C5_EMISSAO", "C5_NUM"], "")
        rows = _rows(raw)
        stats = {}
        for r in rows:
            mes = r.get("C5_EMISSAO", "")[:6] # Agrupamento básico YYYYMM
            stats[mes] = stats.get(mes, 0) + 1
        return {"ok": True, "data": stats, "ts": now_iso()}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# ======================================================
# Endpoints: OPs (SD3)
# ======================================================
@router.get("/ops")
async def get_ops(page: int = 1, page_size: int = 20, cod: Optional[str] = None):
    where = " AND D3_OP <> '' AND D3_QUANT > 0 "
    if cod: where += f" AND D3_COD = '{_escape_sql(cod)}' "
    raw = await client.consbanco("SD3", ["D3_COD", "D3_OP", "D3_QUANT", "D3_LOTECTL", "D3_XENDERE"], where)
    rows = _rows(raw)
    prod_map = await _fetch_prod_desc_map(client, {r["D3_COD"] for r in rows})
    final = [{**r, "produto_nome": prod_map.get(r["D3_COD"], "")} for r in rows]
    return {"ok": True, "data": _paginate(final, page, page_size)}

@router.get("/ops/{op_id}")
async def get_op_detail(op_id: str):
    """Retorna detalhes completos de uma OP """
    where = f" AND D3_OP = '{_escape_sql(op_id)}' "
    raw = await client.consbanco("SD3", ["*"], where)
    rows = _rows(raw)
    if not rows: raise HTTPException(404, "OP não encontrada")
    return {"ok": True, "data": rows[0]}

# ======================================================
# Endpoints: Pedidos (SC5/SC6)
# ======================================================
@router.get("/pedidos-venda")
async def get_pedidos(
    page: int = 1, 
    page_size: int = 20, 
    cliente: Optional[str] = None
):
    where_sc5 = ""
    if cliente:
        # Busca por nome (LIKE) na SA1 para filtrar códigos 
        c_needle = _escape_sql(cliente)
        raw_cli = await client.consbanco("SA1", ["A1_COD"], f" AND A1_NOME LIKE '%{c_needle}%' ")
        clis = {r["A1_COD"] for r in _rows(raw_cli)}
        if not clis: return {"ok": True, "data": _paginate([], page, page_size)}
        where_sc5 = _in_where("C5_CLIENTE", clis)

    raw_sc5 = await client.consbanco("SC5", ["C5_NUM", "C5_CLIENTE", "C5_EMISSAO"], where_sc5)
    sc5_rows = _rows(raw_sc5)
    cli_map = await _fetch_cliente_nome_map(client, {r["C5_CLIENTE"] for r in sc5_rows})
    
    paged = _paginate(sc5_rows, page, page_size)
    nums = {r["C5_NUM"] for r in paged["items"]}
    raw_sc6 = await client.consbanco("SC6", ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"], _in_where("C6_NUM", nums))
    sc6_rows = _rows(raw_sc6)
    
    prod_map = await _fetch_prod_desc_map(client, {r["C6_PRODUTO"] for r in sc6_rows})
    
    # Merge simples para lista
    final = []
    for p in paged["items"]:
        itens = [it for it in sc6_rows if it["C6_NUM"] == p["C5_NUM"]]
        for it in itens:
            final.append({
                "numero": p["C5_NUM"],
                "cliente": cli_map.get(p["C5_CLIENTE"], ""),
                "produto": prod_map.get(it["C6_PRODUTO"], it["C6_PRODUTO"]),
                "qtd": it["C6_QTDVEN"]
            })
    return {"ok": True, "data": {**paged, "items": final}}

@router.get("/pedidos-venda/{pedido_id}")
async def get_pedido_detail(pedido_id: str):
    """Retorna cabeçalho e itens completos """
    where_c5 = f" AND C5_NUM = '{_escape_sql(pedido_id)}' "
    raw_c5 = await client.consbanco("SC5", ["*"], where_c5)
    c5 = _rows(raw_c5)
    if not c5: raise HTTPException(404, "Pedido não encontrado")
    
    where_c6 = f" AND C6_NUM = '{_escape_sql(pedido_id)}' "
    raw_c6 = await client.consbanco("SC6", ["*"], where_c6)
    return {"ok": True, "data": {"header": c5[0], "items": _rows(raw_sc6)}}