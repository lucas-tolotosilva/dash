from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Optional, Tuple

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
    if page < 1:
        page = 1
    if page_size < 1:
        page_size = 5

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
# WHERE helpers
# ======================================================

def _in_where(field: str, values: Set[str]) -> str:
    vals = [v for v in values if v]
    if not vals:
        return ""
    safe = [_escape_sql(v) for v in vals]
    quoted = ",".join([f"'{v}'" for v in safe])
    return f" AND {field} IN ({quoted}) "


# ======================================================
# Lookups
# ======================================================

async def _fetch_prod_desc_map(client: ProtheusClient, cods: Set[str]) -> Dict[str, str]:
    where = _in_where("B1_COD", cods)
    if not where:
        return {}

    raw = await client.consbanco("SB1", ["B1_COD", "B1_DESC"], where)
    rws = _rows(raw)

    m: Dict[str, str] = {}
    for r in rws:
        m[r.get("B1_COD", "")] = r.get("B1_DESC", "")
    return m


async def _fetch_cliente_nome_map(client: ProtheusClient, clis: Set[str]) -> Dict[str, str]:
    where = _in_where("A1_COD", clis)
    if not where:
        return {}

    raw = await client.consbanco("SA1", ["A1_COD", "A1_NOME"], where)
    rws = _rows(raw)

    m: Dict[str, str] = {}
    for r in rws:
        m[r.get("A1_COD", "")] = r.get("A1_NOME", "")
    return m


async def _fetch_cliente_cod_by_nome_like(client: ProtheusClient, cliente_contem: str) -> Set[str]:
    needle = _escape_sql((cliente_contem or "").strip())
    if not needle:
        return set()

    where = f" AND A1_NOME LIKE '%{needle}%' "
    raw = await client.consbanco("SA1", ["A1_COD"], where)
    rws = _rows(raw)

    out: Set[str] = set()
    for r in rws:
        c = r.get("A1_COD", "")
        if c:
            out.add(c)
    return out


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
        "raw": r,
    }


# ======================================================
# Endpoints básicos
# ======================================================

@router.get("/health")
def health():
    return {"ok": True, "ts": now_iso()}


@router.post("/protheus/query")
async def protheus_query(payload: ProtheusQueryRequest):
    raw = await client.consbanco(payload.tabela, payload.campos_desejados, payload.where or "")
    return {"ok": True, "data": raw, "ts": now_iso()}


# ======================================================
# OPS
# ======================================================

@router.get("/ops")
async def ops(
    page: int = Query(default=1),
    page_size: int = Query(default=5),
):
    try:
        where_ops = " AND D3_OP <> '' AND D3_QUANT > 0 "

        raw = await client.consbanco(settings.ops_table, settings.ops_fields_list(), where_ops)
        rows = _rows(raw)

        cods = {r.get("D3_COD", "") for r in rows}
        prod_map = await _fetch_prod_desc_map(client, cods)

        mapped = [map_op_row(r, prod_map) for r in rows]

        return {"ok": True, "data": _paginate(mapped, page, page_size), "ts": now_iso()}
    except Exception as e:
        return {"ok": False, "data": _paginate([], page, page_size), "ts": now_iso(), "debug": [str(e)]}


# ======================================================
# PEDIDOS DE VENDA (SC5 filtra, SC6 detalha)
# ======================================================

@router.get("/pedidos-venda")
async def pedidos_venda(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    emissao_de: Optional[str] = Query(None),
    emissao_ate: Optional[str] = Query(None),
    cliente_contem: Optional[str] = Query(None),
):

    try:
        client = ProtheusClient()

        # ================================
        # WHERE SC5 (cabecalho)
        # ================================

        where_parts: List[str] = []

        if emissao_de and emissao_ate:
            where_parts.append(
                f" AND C5_EMISSAO BETWEEN '{emissao_de}' AND '{emissao_ate}' "
            )
        elif emissao_de:
            where_parts.append(f" AND C5_EMISSAO >= '{emissao_de}' ")
        elif emissao_ate:
            where_parts.append(f" AND C5_EMISSAO <= '{emissao_ate}' ")

        where_sc5 = "".join(where_parts)

        # ================================
        # BUSCA PEDIDOS
        # ================================

        raw_sc5 = await client.consbanco(
            settings.pedidos_sc5_table,
            settings.pedidos_sc5_fields_list(),
            where_sc5,
        )

        sc5_rows = _rows(raw_sc5)

        if not sc5_rows:
            return {
                "ok": True,
                "data": _paginate([], page, page_size),
                "ts": now_iso(),
            }

        # ================================
        # CLIENTES
        # ================================

        clientes = {r["C5_CLIENTE"] for r in sc5_rows}
        cli_map = await _fetch_cliente_nome_map(clientes)

        # ================================
        # PEDIDOS DA PAGINA
        # ================================

        paged_sc5 = _paginate(sc5_rows, page, page_size)

        nums = {r["C5_NUM"] for r in paged_sc5["items"]}

        where_sc6 = _in_where("C6_NUM", nums)

        raw_sc6 = await client.consbanco(
            settings.pedidos_sc6_table,
            settings.pedidos_sc6_fields_list(),
            where_sc6,
        )

        sc6_rows = _rows(raw_sc6)

        # ================================
        # PRODUTOS
        # ================================

        cods = {r["C6_PRODUTO"] for r in sc6_rows}

        prod_map = await _fetch_prod_desc_map(cods)

        # ================================
        # MERGE FINAL
        # ================================

        itens_por_pedido: Dict[str, List[dict]] = {}

        for r in sc6_rows:
            itens_por_pedido.setdefault(r["C6_NUM"], []).append(r)

        final = []

        for ped in paged_sc5["items"]:
            numero = ped["C5_NUM"]

            itens = itens_por_pedido.get(numero, [])

            for it in itens:
                cod = it["C6_PRODUTO"]

                final.append({
                    "numero": numero,
                    "cliente_cod": ped["C5_CLIENTE"],
                    "cliente_nome": cli_map.get(ped["C5_CLIENTE"], ""),
                    "loja": ped["C5_LOJA"],
                    "emissao": ped["C5_EMISSAO"],
                    "produto": cod,
                    "produto_nome": prod_map.get(cod, ""),
                    "quantidade": it["C6_QTDVEN"],
                })

        return {
            "ok": True,
            "data": {
                "items": final,
                "page": paged_sc5["page"],
                "page_size": paged_sc5["page_size"],
                "total": paged_sc5["total"],
            },
            "ts": now_iso(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao consultar pedidos: {e}",
        )

# ======================================================
# DASHBOARD SUMMARY
# ======================================================

@router.get("/dashboard/summary")
async def dashboard_summary():
    try:
        raw_ops = await client.consbanco(settings.ops_table, settings.ops_fields_list(), " AND D3_OP <> '' AND D3_QUANT > 0 ")
        ops_rows = _rows(raw_ops)

        raw_sc5 = await client.consbanco(settings.pedidos_sc5_table, settings.pedidos_sc5_fields_list(), "")
        sc5_rows = _rows(raw_sc5)

        return {
            "ok": True,
            "data": {
                "kpis": {
                    "ops_ativas": len(ops_rows),
                    "pedidos_abertos": len(sc5_rows),
                    "bobinas_disponiveis": len(ops_rows),  # temporário
                }
            },
            "ts": now_iso(),
        }
    except Exception as e:
        return {
            "ok": False,
            "data": {"kpis": {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}},
            "ts": now_iso(),
            "debug": [str(e)],
        }
