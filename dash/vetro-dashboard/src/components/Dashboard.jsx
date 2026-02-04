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
        setError(e.response?.data?.detail || e.message || "Erro Protheus");
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const kpis = summary?.kpis;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* 1. Cabeçalho Imutável (Sempre no topo da hierarquia) */}
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
            <span style={{ fontSize: 13 }}>API: {apiStatus.ok ? "conectado" : "aguardando..."}</span>
          </div>
        </div>
      </header>

      {/* 2. Conteúdo com Rolagem Independente (Evita corte visual) */}
      <main className="grid" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
        
        {error && (
          <div className="card" style={{ borderColor: "var(--red)", background: "rgba(217,45,32,0.06)", marginBottom: 20, padding: '15px' }}>
            <div style={{ fontSize: 13, color: "var(--red)" }}>⚠️ {error}</div>
          </div>
        )}

        <section className="card col-12">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Resumo Executivo</strong>
              <span>KPIs reais extraídos das tabelas SD3 e SC5</span>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 0 }}>
            <section className="card col-4" style={{ cursor: 'pointer' }} onClick={() => navigate("/pedidos")}>
              <div className="cardTitle"><strong>Pedidos abertos (SC5)</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.pedidos_abertos ?? "-"}
              </div>
            </section>
            
            <section className="card col-4" style={{ cursor: 'pointer' }} onClick={() => navigate("/ops")}>
              <div className="cardTitle"><strong>OPs ativas (SD3)</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.ops_ativas ?? "-"}
              </div>
            </section>

            <section className="card col-4">
              <div className="cardTitle"><strong>Bobinas disponíveis</strong></div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.bobinas_disponiveis ? Math.floor(kpis.bobinas_disponiveis) : "-"}
              </div>
            </section>
          </div>
        </section>

        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle"><strong>Últimas OPs</strong></div>
          </div>
          <div className="cardBody" style={{ padding: 0 }}>
            {ops.map((x, i) => (
              <div 
                key={i} 
                style={{ cursor: 'pointer', padding: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                onClick={() => navigate(`/ops?search=${x.op || x.D3_OP}`)}
              >
                <strong>{x.op || x.D3_OP || "OP Ativa"}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}> • {x.produto_nome || x.cod}</span>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Qtd: {x.quantidade} | Lote: {x.lote} | End: {x.endereco}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle"><strong>Pedidos Recentes</strong></div>
          </div>
          <div className="cardBody" style={{ padding: 0 }}>
            {pedidos.map((p, i) => (
              <div 
                key={i} 
                style={{ cursor: 'pointer', padding: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}
                onClick={() => navigate(`/pedidos?num=${p.numero}`)}
              >
                <strong>{p.numero}</strong>
                <span style={{ color: "var(--muted)", fontSize: 13 }}> • {p.cliente_nome || p.cliente_cod}</span>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Produto: {p.produto_nome || p.produto} | Qtd: {p.quantidade} | Emissão: {p.emissao}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}