from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Query, HTTPException
from app.core.settings import settings
from app.services.protheus_client import ProtheusClient
from app.api.schemas import ProtheusQueryRequest

router = APIRouter()
client = ProtheusClient()

# --- CONFIGURAÇÃO DE SEGURANÇA E TABELAS ---
TABELAS_AUTORIZADAS = [
    "SC5", "SC6", "SF1", "SD1", "SC2", "SD3", "SE1", "SE2", 
    "FK2", "FK3", "FK4", "SE5", "FK5", "FK6", "FI7", "SB2", "SF2", "SD2"
]

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

def _escape_sql(s: str) -> str:
    return (s or "").replace("'", "''")

# --- ENDPOINTS EXISTENTES ---

@router.get("/health")
def health():
    return {"ok": True, "ts": now_iso()}

@router.get("/dashboard/summary")
async def dashboard_summary():
    kpis = {"ops_ativas": 0, "pedidos_abertos": 0, "bobinas_disponiveis": 0}
    try:
        r_ops = await client.consbanco("SD3", ["D3_OP"], " AND D3_OP <> '' AND D3_QUANT > 0 AND D_E_L_E_T_ <> '*' ")
        kpis["ops_ativas"] = len(_rows(r_ops))
    except Exception: pass

    try:
        r_sc5 = await client.consbanco("SC5", ["C5_NUM"], " AND D_E_L_E_T_ <> '*' ")
        kpis["pedidos_abertos"] = len(_rows(r_sc5))
    except Exception: pass

    try:
        r_sb2 = await client.consbanco("SB2", ["B2_QATU"], " AND B2_QATU > 0 AND D_E_L_E_T_ <> '*' ")
        kpis["bobinas_disponiveis"] = sum(float(r.get("B2_QATU", 0)) for r in _rows(r_sb2))
    except Exception: pass

    return {"ok": True, "data": {"kpis": kpis}, "ts": now_iso()}

@router.get("/fiscal/notas-investigacao")
async def get_notas_investigacao(data_de: str, data_ate: str):
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        where = f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        campos = ["F2_DOC", "F2_SERIE", "F2_EMISSAO", "F2_CLIENTE", "F2_VALMERC", "F2_VALBRUT", "F2_EST", "F2_FRETE", "F2_VALICM", "F2_VALIPI"]
        
        raw = await client.consbanco("SF2", campos, where)
        dados = _rows(raw)
        
        for item in dados:
            item["F2_VALMERC"] = float(item.get("F2_VALMERC") or 0)
            item["F2_VALBRUT"] = float(item.get("F2_VALBRUT") or 0)

        return {"ok": True, "count": len(dados), "data": dados, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Protheus SF2: {str(e)}")

@router.get("/comercial/pedidos-investigacao")
async def get_pedidos_investigacao(data_de: str, data_ate: str):
    d_de = _escape_sql(data_de)
    d_ate = _escape_sql(data_ate)
    where = f" AND C5_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
    campos_full = ["C5_NUM","C5_TIPO","C5_EMISSAO","C5_CLIENTE", "C5_LOJACLI", "C5_TIPOCLI", "C5_FRETE", "C5_NOTA"]
    
    try:
        raw = await client.consbanco("SC5", campos_full, where)
        dados = _rows(raw)
        return {"ok": True, "modo": "full", "count": len(dados), "data": dados, "ts": now_iso()}
    except Exception as e:
        print(f"⚠️ Erro na consulta full SC5, tentando modo segurança: {str(e)}")
        campos_safe = ["C5_NUM", "C5_CLIENTE", "C5_LOJA", "C5_EMISSAO"]
        try:
            raw_safe = await client.consbanco("SC5", campos_safe, where)
            dados_safe = _rows(raw_safe)
            return {"ok": True, "modo": "seguranca", "count": len(dados_safe), "data": dados_safe, "ts": now_iso()}
        except Exception as e_final:
            raise HTTPException(status_code=500, detail=f"Erro Crítico SC5: {str(e_final)}")

# --- NOVA ROTA FINANCEIRA: CONTAS A RECEBER (SE1) ---

@router.get("/financeiro/receber-investigacao")
async def get_receber_investigacao(data_de: str, data_ate: str):
    """
    Retorna o detalhamento de Contas a Receber (SE1):
    Foco em Títulos abertos, Vencimentos e Saldos.
    """
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        
        # Filtro por data de emissão do título
        where = f" AND E1_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        
        campos = [
            "E1_NUM", "E1_PREFIXO", "E1_CLIENTE", "E1_LOJA", "E1_NOMCLI",
            "E1_EMISSAO", "E1_VENCTO", "E1_VENCREA", "E1_VALOR", "E1_SALDO", 
            "E1_BAIXA", "E1_HIST"
        ]
        
        raw = await client.consbanco("SE1", campos, where)
        dados = _rows(raw)
        
        # Conversão de valores financeiros
        for item in dados:
            item["E1_VALOR"] = float(item.get("E1_VALOR") or 0)
            item["E1_SALDO"] = float(item.get("E1_SALDO") or 0)

        return {
            "ok": True, 
            "count": len(dados), 
            "data": dados, 
            "ts": now_iso()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Protheus SE1: {str(e)}")
    
# ... (Mantenha as rotas anteriores: health, summary, notas, pedidos, receber)

# --- NOVA ROTA FINANCEIRA: AUDITORIA DE VALORES ACESSÓRIOS (FKD) ---

# --- ROTA FINANCEIRA À PROVA DE ERROS (FKD) ---
@router.get("/financeiro/detalhe-baixa")
async def get_detalhe_baixa(data_de: str, data_ate: str):
    """
    Investigação de centavos: Tabela FKD.
    Blindada contra Erro 500 caso o dicionário da FKD esteja restrito.
    """
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        # Atenção: Algumas versões do Protheus usam FKD_DATA, outras FKD_DTMOV
        where = f" AND FKD_DATA BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        
        # Testamos com o campo solicitado: FKD_VALOR
        campos = ["FKD_IDDOC", "FKD_DATA", "FKD_VALOR", "FKD_TIPVAL"]
        
        raw = await client.consbanco("FKD", campos, where)
        dados = _rows(raw)
        
        for item in dados:
            item["FKD_VALOR"] = float(item.get("FKD_VALOR") or 0)

        return {"ok": True, "count": len(dados), "data": dados, "ts": now_iso()}
    except Exception as e:
        # Se falhar, tentamos descobrir se o campo de data tem outro nome
        print(f"⚠️ Falha na FKD: {str(e)}")
        return {
            "ok": False, 
            "error": "A tabela FKD retornou Erro 500. Verifique se o campo de data é FKD_DATA ou se há restrição de acesso.",
            "data": []
        }
# --- ENDPOINTS CORE RESTANTES ---

@router.post("/api/dynamic-query")
async def dynamic_query(payload: ProtheusQueryRequest):
    tabela = payload.tabela.upper()
    if tabela not in TABELAS_AUTORIZADAS:
        raise HTTPException(status_code=403, detail=f"Tabela {tabela} não autorizada.")
    try:
        where_safe = payload.where or ""
        raw = await client.consbanco(tabela, payload.campos_desejados, where_safe)
        return {"ok": True, "data": _rows(raw), "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_metrics(categoria: str, data_de: str, data_ate: str):
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        total = 0.0
        if categoria == "faturamento":
            where = f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
            raw = await client.consbanco("SF2", ["F2_VALMERC"], where)
            total = sum(float(r.get("F2_VALMERC", 0)) for r in _rows(raw))
        return {"ok": True, "total": total, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))