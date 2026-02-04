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
    return (s or "").replace("'", "''")

# ======================================================
# Lookups
# ======================================================
def _in_where(field: str, values: Set[str]) -> str:
    vals = [v for v in values if v]
    if not vals: return ""
    safe = [_escape_sql(v) for v in vals]
    quoted = ",".join([f"'{v}'" for v in safe])
    return f" AND {field} IN ({quoted}) "

async def _fetch_prod_desc_map(cods: Set[str]) -> Dict[str, str]:
    where = _in_where("B1_COD", cods)
    if not where: return {}
    # Busca simplificada para evitar erro 500
    raw = await client.consbanco("SB1", ["B1_COD", "B1_DESC"], where)
    rws = _rows(raw)
    return {r.get("B1_COD", ""): r.get("B1_DESC", "") for r in rws}

async def _fetch_cliente_nome_map(clis: Set[str]) -> Dict[str, str]:
    where = _in_where("A1_COD", clis)
    if not where: return {}
    raw = await client.consbanco("SA1", ["A1_COD", "A1_NOME"], where)
    rws = _rows(raw)
    return {r.get("A1_COD", ""): r.get("A1_NOME", "") for r in rws}

# ======================================================
# Mappers
# ======================================================
def map_op_row(r: Dict[str, Any], prod_map: Dict[str, str]) -> Dict[str, Any]:
    cod = r.get("D3_COD", "")
    return {
        "op": r.get("D3_OP", ""),
        "cod": cod,
        "produto_nome": prod_map.get(cod, ""),
        "lote": r.get("D3_LOTECTL", ""),
        "quantidade": r.get("D3_QUANT", 0),
        "endereco": r.get("D3_XENDERE", ""),
        "status": "Em Produção",
        "raw": r,
    }

# ======================================================
# Endpoints
# ======================================================
@router.get("/health")
def health():
    return {"ok": True, "ts": now_iso()}

@router.get("/ops")
async def ops(page: int = Query(default=1), page_size: int = Query(default=5)):
    try:
        where_ops = " AND D3_OP <> '' AND D3_QUANT > 0 "
        raw = await client.consbanco(settings.ops_table, settings.ops_fields_list(), where_ops)
        rows = _rows(raw)
        cods = {r.get("D3_COD", "") for r in rows}
        prod_map = await _fetch_prod_desc_map(cods)
        mapped = [map_op_row(r, prod_map) for r in rows]
        return {"ok": True, "data": _paginate(mapped, page, page_size), "ts": now_iso()}
    except Exception as e:
        return {"ok": False, "data": _paginate([], page, page_size), "ts": now_iso(), "debug": str(e)}

@router.get("/pedidos-venda")
async def pedidos_venda(page: int = Query(1), page_size: int = Query(25)):
    try:
        # Busca Cabeçalhos (SC5) - Removido C5_LOJA temporariamente para teste de compatibilidade
        raw_sc5 = await client.consbanco(settings.pedidos_sc5_table, ["C5_NUM", "C5_CLIENTE", "C5_EMISSAO"], "")
        sc5_rows = _rows(raw_sc5)
        
        if not sc5_rows:
            return {"ok": True, "data": _paginate([], page, page_size), "ts": now_iso()}

        # Busca Clientes
        clientes = {r["C5_CLIENTE"] for r in sc5_rows}
        cli_map = await _fetch_cliente_nome_map(clientes)

        # Paginação e Busca Itens (SC6)
        paged_sc5 = _paginate(sc5_rows, page, page_size)
        nums = {r["C5_NUM"] for r in paged_sc5["items"]}
        where_sc6 = _in_where("C6_NUM", nums)
        raw_sc6 = await client.consbanco(settings.pedidos_sc6_table, ["C6_NUM", "C6_PRODUTO", "C6_QTDVEN"], where_sc6)
        sc6_rows = _rows(raw_sc6)

        # Busca Nomes de Produtos
        cods = {r["C6_PRODUTO"] for r in sc6_rows}
        prod_map = await _fetch_prod_desc_map(cods)

        # Merge
        itens_por_pedido = {}
        for r in sc6_rows:
            itens_por_pedido.setdefault(r["C6_NUM"], []).append(r)

        final = []
        for ped in paged_sc5["items"]:
            num = ped["C5_NUM"]
            for it in itens_por_pedido.get(num, []):
                cod = it["C6_PRODUTO"]
                final.append({
                    "numero": num,
                    "cliente_nome": cli_map.get(ped["C5_CLIENTE"], ped["C5_CLIENTE"]),
                    "emissao": ped["C5_EMISSAO"],
                    "produto_nome": prod_map.get(cod, cod),
                    "quantidade": it["C6_QTDVEN"],
                    "status": "Aberto"
                })

        return {"ok": True, "data": _paginate(final, page, page_size), "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar pedidos: {str(e)}")

@router.get("/dashboard/summary")
async def dashboard_summary():
    try:
        raw_ops = await client.consbanco(settings.ops_table, ["D3_OP"], " AND D3_OP <> '' ")
        raw_sc5 = await client.consbanco(settings.pedidos_sc5_table, ["C5_NUM"], "")
        return {
            "ok": True,
            "data": {
                "kpis": {
                    "ops_ativas": len(_rows(raw_ops)),
                    "pedidos_abertos": len(_rows(raw_sc5)),
                    "bobinas_disponiveis": 0 
                }
            },
            "ts": now_iso()
        }
    except Exception as e:
        return {"ok": False, "data": {"kpis": {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}}, "debug": str(e)}