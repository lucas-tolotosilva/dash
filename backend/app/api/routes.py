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
    "FK2", "FK3", "FK4", "SE5", "FK5", "FK6", "FI7", "SB2", "SF2", "SD2", "FKD"
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

# --- ENDPOINTS EXISTENTES (MARCO ZERO) ---

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
        return {"ok": True, "modo": "full", "count": len(_rows(raw)), "data": _rows(raw), "ts": now_iso()}
    except Exception:
        campos_safe = ["C5_NUM", "C5_CLIENTE", "C5_LOJA", "C5_EMISSAO"]
        try:
            raw_safe = await client.consbanco("SC5", campos_safe, where)
            return {"ok": True, "modo": "seguranca", "count": len(_rows(raw_safe)), "data": _rows(raw_safe), "ts": now_iso()}
        except Exception as e_final:
            raise HTTPException(status_code=500, detail=f"Erro Crítico SC5: {str(e_final)}")

@router.get("/financeiro/receber-investigacao")
async def get_receber_investigacao(data_de: str, data_ate: str):
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        where = f" AND E1_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        campos = ["E1_NUM", "E1_PREFIXO", "E1_CLIENTE", "E1_LOJA", "E1_NOMCLI", "E1_EMISSAO", "E1_VENCTO", "E1_VENCREA", "E1_VALOR", "E1_SALDO", "E1_BAIXA", "E1_HIST"]
        raw = await client.consbanco("SE1", campos, where)
        dados = _rows(raw)
        for item in dados:
            item["E1_VALOR"] = float(item.get("E1_VALOR") or 0)
            item["E1_SALDO"] = float(item.get("E1_SALDO") or 0)
        return {"ok": True, "count": len(dados), "data": dados, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro Protheus SE1: {str(e)}")

@router.get("/financeiro/detalhe-baixa")
async def get_detalhe_baixa(data_de: str, data_ate: str):
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        where = f" AND FKD_DATA BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        campos = ["FKD_IDDOC", "FKD_DATA", "FKD_VALOR", "FKD_TIPVAL"]
        raw = await client.consbanco("FKD", campos, where)
        dados = _rows(raw)
        for item in dados:
            item["FKD_VALOR"] = float(item.get("FKD_VALOR") or 0)
        return {"ok": True, "count": len(dados), "data": dados, "ts": now_iso()}
    except Exception as e:
        return {"ok": False, "error": f"Tabela FKD indisponível: {str(e)}", "data": []}

# --- SEÇÃO BI ANALYTICS: MOTOR DE MARGEM (IA-READY) ---

@router.get("/analytics/margem-contribuicao")
async def get_margem_contribuicao(data_de: str, data_ate: str):
    """Cruza faturamento com custos para identificar padrões de rentabilidade."""
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        where = f" AND D2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        campos = ["D2_DOC", "D2_COD", "D2_QUANT", "D2_TOTAL", "D2_CUSTO1", "D2_MARGEM", "D2_TES"]
        raw = await client.consbanco("SD2", campos, where)
        itens = _rows(raw)
        analise = []
        for i in itens:
            venda = float(i.get("D2_TOTAL") or 0)
            custo = float(i.get("D2_CUSTO1") or 0)
            lucro = venda - custo
            margem_perc = (lucro / venda * 100) if venda > 0 else 0
            analise.append({
                "doc": i.get("D2_DOC"),
                "cod": i.get("D2_COD"),
                "venda": venda,
                "custo": custo,
                "lucro": round(lucro, 2),
                "margem_perc": round(margem_perc, 2),
                "status_ia": "Risco" if margem_perc < 10 else "Saudável"
            })
        return {"ok": True, "data": analise, "ts": now_iso()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS CORE RESTANTES ---

@router.post("/api/dynamic-query")
async def dynamic_query(payload: ProtheusQueryRequest):
    tabela = payload.tabela.upper()
    if tabela not in TABELAS_AUTORIZADAS:
        raise HTTPException(status_code=403, detail=f"Tabela {tabela} não autorizada.")
    try:
        raw = await client.consbanco(tabela, payload.campos_desejados, payload.where or "")
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
    
# --- BLOCO 1 & 2: RESUMO DIÁRIO (BRUTO E LÍQUIDO) ---

@router.get("/analytics/resumo-vendas-diario")
async def get_resumo_vendas_diario(data_de: str, data_ate: str):
    """
    Recupera o faturamento dia a dia: Valor Bruto, Quantidade de Notas,
    Impostos, Frete e Valor Líquido.
    """
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        where = f" AND F2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        
        # F2_VALMERC (Líquido de itens), F2_VALBRUT (Total com impostos/frete)
        campos = ["F2_EMISSAO", "F2_DOC", "F2_VALBRUT", "F2_VALMERC", "F2_FRETE", "F2_VALICM", "F2_VALIPI"]
        raw = await client.consbanco("SF2", campos, where)
        notas = _rows(raw)
        
        # Agrupamento por dia
        resumo_diario = {}
        for n in notas:
            dia = n["F2_EMISSAO"]
            if dia not in resumo_diario:
                resumo_diario[dia] = {
                    "data": f"{dia[6:8]}/{dia[4:6]}/{dia[0:4]}",
                    "valor_bruto": 0.0,
                    "valor_liquido": 0.0,
                    "impostos": 0.0,
                    "frete": 0.0,
                    "qtd_notas": 0
                }
            
            # Cálculos por linha
            bruto = float(n.get("F2_VALBRUT") or 0)
            impostos = float(n.get("F2_VALICM") or 0) + float(n.get("F2_VALIPI") or 0)
            
            resumo_diario[dia]["valor_bruto"] += bruto
            resumo_diario[dia]["valor_liquido"] += float(n.get("F2_VALMERC") or 0)
            resumo_diario[dia]["impostos"] += impostos
            resumo_diario[dia]["frete"] += float(n.get("F2_FRETE") or 0)
            resumo_diario[dia]["qtd_notas"] += 1

        # Transformar em lista ordenada para o gráfico
        lista_final = sorted(resumo_diario.values(), key=lambda x: x['data'])
        
        # Cálculos de Totais e Médias (Rodapé do seu desenho)
        total_geral = sum(item["valor_bruto"] for item in lista_final)
        total_notas = sum(item["qtd_notas"] for item in lista_final)
        dias_faturados = len(lista_final) or 1

        return {
            "ok": True,
            "data": lista_final,
            "resumo_periodo": {
                "total_vendas": round(total_geral, 2),
                "media_diaria_valor": round(total_geral / dias_faturados, 2),
                "total_notas": total_notas,
                "media_diaria_notas": round(total_notas / dias_faturados, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- BLOCO 3: TOP 5 + OUTROS POR GRUPO ---

@router.get("/analytics/top5-outros-grupo")
async def get_top5_grupo(data_de: str, data_ate: str, grupo: str):
    """
    Exibe as 5 maiores vendas de um grupo com Nome do Cliente e Descrição do Produto.
    """
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        
        # 1. Busca produtos do grupo trazendo a DESCRIÇÃO (B1_DESC)
        res_sb1 = await client.consbanco("SB1", ["B1_COD", "B1_DESC"], f" AND B1_GRUPO = '{_escape_sql(grupo)}' AND D_E_L_E_T_ <> '*' ")
        dados_sb1 = _rows(res_sb1)
        
        # Criamos um mapa de descrições: { "COD001": "NOME DO PRODUTO" }
        mapa_produtos = {p["B1_COD"]: p["B1_DESC"].strip() for p in dados_sb1}
        prods_grupo = set(mapa_produtos.keys())
        
        if not prods_grupo:
            return {"ok": True, "data": [], "msg": "Nenhum produto encontrado para este grupo."}

        # 2. Busca itens faturados (SD2)
        where_d2 = f" AND D2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' AND D_E_L_E_T_ <> '*' "
        res_d2 = await client.consbanco("SD2", ["D2_DOC", "D2_CLIENTE", "D2_COD", "D2_TOTAL"], where_d2)
        vendas_filtradas = [v for v in _rows(res_d2) if v["D2_COD"] in prods_grupo]

        # 3. Busca Nomes dos Clientes (SA1)
        cods_cli = "('" + "','".join({v["D2_CLIENTE"] for v in vendas_filtradas}) + "')"
        res_sa1 = await client.consbanco("SA1", ["A1_COD", "A1_NOME"], f" AND A1_COD IN {cods_cli} AND D_E_L_E_T_ <> '*' ")
        mapa_clientes = {c["A1_COD"]: c["A1_NOME"].strip() for c in _rows(res_sa1)}

        # 4. Formatação Final (Top 5 + Outros)
        vendas_ordenadas = sorted(vendas_filtradas, key=lambda x: float(x["D2_TOTAL"]), reverse=True)
        top_5_raw = vendas_ordenadas[:5]
        restantes_raw = vendas_ordenadas[5:]
        
        resultado_final = []
        for v in top_5_raw:
            cod_cli = v.get("D2_CLIENTE")
            cod_prod = v.get("D2_COD")
            resultado_final.append({
                "cliente": mapa_clientes.get(cod_cli, f"Cod: {cod_cli}"),
                "produto_cod": cod_prod,
                "produto_desc": mapa_produtos.get(cod_prod, "DESCRIÇÃO NÃO ENCONTRADA"),
                "valor": float(v.get("D2_TOTAL") or 0),
                "nota": v.get("D2_DOC")
            })
        
        if restantes_raw:
            soma_outros = sum(float(r.get("D2_TOTAL") or 0) for r in restantes_raw)
            resultado_final.append({
                "cliente": "DIVERSOS CLIENTES",
                "produto_desc": "OUTRAS VENDAS DO GRUPO",
                "valor": round(soma_outros, 2),
                "nota": "OUTROS"
            })

        return {"ok": True, "grupo": grupo, "data": resultado_final}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no Ranking Detalhado: {str(e)}")

# --- BLOCO 4: GRÁFICO PIZZA (PARTICIPAÇÃO POR GRUPO) ---

@router.get("/analytics/distribuicao-grupos")
async def get_distribuicao_grupos(data_de: str, data_ate: str):
    """
    Calcula a porcentagem de participação de cada grupo (2001, 2002, 2003) no total.
    """
    try:
        d_de = _escape_sql(data_de)
        d_ate = _escape_sql(data_ate)
        
        # Buscamos vendas e cruzamos com SB1 para pegar o grupo
        res_d2 = await client.consbanco("SD2", ["D2_COD", "D2_TOTAL"], f" AND D2_EMISSAO BETWEEN '{d_de}' AND '{d_ate}' ")
        vendas = _rows(res_d2)
        
        res_sb1 = await client.consbanco("SB1", ["B1_COD", "B1_GRUPO"], " AND B1_GRUPO IN ('2001','2002','2003') ")
        mapa_grupos = {p["B1_COD"]: p["B1_GRUPO"] for p in _rows(res_sb1)}
        
        distribuicao = {"2001": 0.0, "2002": 0.0, "2003": 0.0, "OUTROS": 0.0}
        total_periodo = 0.0
        
        for v in vendas:
            valor = float(v.get("D2_TOTAL") or 0)
            grupo = mapa_grupos.get(v["D2_COD"], "OUTROS")
            distribuicao[grupo] += valor
            total_periodo += valor

        # Calcular % para o gráfico pizza
        pizza = []
        for g, val in distribuicao.items():
            if val > 0:
                perc = (val / total_periodo) * 100
                pizza.append({"grupo": g, "valor": round(val, 2), "porcentagem": round(perc, 2)})

        return {"ok": True, "data": pizza}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))