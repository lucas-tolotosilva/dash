import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState({ loading: false, ok: false });
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setError("");
        // Chamadas usando apenas os métodos que existem no seu service
        const health = await api.health();
        const [s, o, p] = await Promise.all([
          api.summary(),
          api.ops({ page: 1, page_size: 5 }),
          api.pedidosVenda({ page: 1, page_size: 5 }),
        ]);

        if (!alive) return;

        setSummary(s?.data || null);
        setOps(o?.data?.items || []);
        setPedidos(p?.data?.items || []);
        setLastUpdate(s?.ts || health?.ts);
        setApiStatus({ loading: false, ok: true });
      } catch (e) {
        if (!alive) return;
        setApiStatus({ loading: false, ok: false });
        setError(e.message || "Erro de integração Protheus");
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const kpis = summary?.kpis;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* 1. Cabeçalho Imutável - Fixado no topo para evitar corte visual */}
      <header className="topbar" style={{ flexShrink: 0, padding: '16px 20px' }}>
        <div className="brand">
          <div className="logoMark">VR</div>
          <div className="brandTitle">
            <strong>Vetroresina • Dashboard</strong>
            <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>
              {lastUpdate ? `Sincronizado: ${new Date(lastUpdate).toLocaleString('pt-BR')}` : "Monitoramento ERP Protheus"}
            </span>
          </div>
        </div>
        <div className="actions">
          <div className="pill">
            <span 
              className="dot" 
              style={{ 
                background: apiStatus.ok ? "var(--green)" : "var(--red)",
                boxShadow: apiStatus.ok ? "0 0 0 4px rgba(31,138,59,0.12)" : "0 0 0 4px rgba(217,45,32,0.12)"
              }} 
            />
            <span style={{ fontSize: 13 }}>API: {apiStatus.ok ? "conectado" : "falhou"}</span>
          </div>
        </div>
      </header>

      {/* 2. Área de Conteúdo com Rolagem Independente */}
      <main className="grid" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
        
        {error && (
          <div className="card" style={{ borderColor: "var(--red)", background: "rgba(217,45,32,0.06)", marginBottom: 20, padding: '15px' }}>
            <div style={{ fontSize: 13, color: "var(--red)" }}>⚠️ {error}</div>
          </div>
        )}

        {/* KPIs Reais das Tabelas SD3, SC5 e SB2 */}
        <section className="card col-12">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Resumo Executivo</strong>
              <span>Indicadores extraídos do ERP</span>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 0 }}>
            <section className="card col-4" style={{ cursor: 'pointer' }} onClick={() => navigate("/pedidos")}>
              <div className="cardTitle"><strong>Pedidos abertos</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.pedidos_abertos ?? "-"}
              </div>
            </section>
            
            <section className="card col-4" style={{ cursor: 'pointer' }} onClick={() => navigate("/ops")}>
              <div className="cardTitle"><strong>OPs ativas</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.ops_ativas ?? "-"}
              </div>
            </section>

            <section className="card col-4">
              <div className="cardTitle"><strong>Estoque (Bobinas)</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.bobinas_disponiveis ? Math.floor(kpis.bobinas_disponiveis) : "-"}
              </div>
            </section>
          </div>
        </section>

        {/* Listagem de OPs com nomes mapeados corretamente */}
        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle"><strong>Últimas OPs (Produção)</strong></div>
          </div>
          <div className="cardBody" style={{ padding: 0 }}>
            {ops.map((x, i) => (
              <div 
                key={i} 
                className="list-item" 
                style={{ cursor: 'pointer', padding: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                onClick={() => navigate(`/ops/${x.D3_OP}`)}
              >
                <strong>{x.D3_OP || "OP Ativa"}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}> • {x.produto_nome || x.D3_COD}</span>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Qtd: {x.D3_QUANT} | Lote: {x.D3_LOTECTL} | End: {x.D3_XENDERE}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Listagem de Pedidos com nomes de Clientes mapeados */}
        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle"><strong>Pedidos Recentes (Comercial)</strong></div>
          </div>
          <div className="cardBody" style={{ padding: 0 }}>
            {pedidos.map((p, i) => (
              <div 
                key={i} 
                className="list-item" 
                style={{ cursor: 'pointer', padding: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                onClick={() => navigate(`/pedidos-venda/${p.numero}`)}
              >
                <strong>{p.numero}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}> • {p.cliente}</span>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Produto: {p.produto} | Qtd: {p.qtd}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}