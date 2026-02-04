import { useEffect, useState } from "react";
import { api } from "../services/api";

// Sub-componente para efeito de carregamento (Skeleton)
const Skeleton = ({ width = "100%", height = "20px", borderRadius = "4px" }) => (
  <div className="skeleton-loader" style={{ width, height, borderRadius }} />
);

export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState({ loading: true, ok: false });
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
        setApiStatus({ loading: true, ok: false });

        // 1) Health Check inicial [cite: 355]
        const health = await api.health();
        
        // 2) Busca de dados em paralelo [cite: 359, 360, 361, 362]
        const [s, o, p] = await Promise.all([
          api.summary(),
          api.ops({ page: 1, page_size: 5 }),
          api.pedidosVenda({ page: 1, page_size: 5 }),
        ]);

        if (!alive) return;

        // Sucesso: Atualiza estados com dados mapeados [cite: 365, 366, 367]
        setSummary(s?.data || null);
        setOps(o?.data?.items || []);
        setPedidos(p?.data?.items || []);
        setLastUpdate(s?.ts || health?.ts || new Date().toISOString());
        setApiStatus({ loading: false, ok: true });
      } catch (e) {
        if (!alive) return;
        setApiStatus({ loading: false, ok: false });
        // Captura detalhada de erro do backend para suporte [cite: 348, 371]
        const detailedError = e.response?.data?.detail || e.message || "Falha na conexão com a API";
        setError(detailedError);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const kpis = summary?.kpis;

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">
          <div className="logoMark" aria-hidden="true">VR</div>
          <div className="brandTitle">
            <strong>Vetroresina • Dashboard</strong>
            {apiStatus.loading ? (
              <Skeleton width="150px" height="10px" />
            ) : (
              lastUpdate && (
                <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>
                  Sincronizado: {new Date(lastUpdate).toLocaleString('pt-BR')}
                </span>
              )
            )}
          </div>
        </div>
        <div className="actions">
          <div className="pill">
            <span
              className="dot"
              style={{
                background: apiStatus.loading ? "#aab3b9" : (apiStatus.ok ? "var(--green)" : "var(--red)"),
                boxShadow: apiStatus.ok ? "0 0 0 4px rgba(31,138,59,0.12)" : "0 0 0 4px rgba(217,45,32,0.12)",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              API: {apiStatus.loading ? "validando..." : (apiStatus.ok ? "conectado" : "falhou")}
            </span>
          </div>
        </div>
      </header>

      {/* Banner de Erro Detalhado [cite: 405, 408] */}
      {error && (
        <div className="card" style={{ borderColor: "var(--red)", background: "rgba(217,45,32,0.06)", marginBottom: 20 }}>
          <strong>⚠️ Erro de Integração</strong>
          <div className="cardBody" style={{ fontSize: 12 }}>
            Detalhes técnicos: <code>{error}</code>
          </div>
        </div>
      )}

      <main className="grid">
        <section className="card col-12">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Resumo</strong>
              <span>Indicadores em tempo real</span>
            </div>
          </div>
          <div className="grid" style={{ marginTop: 0 }}>
            {[
              { label: "Pedidos abertos", val: kpis?.pedidos_abertos },
              { label: "OPs ativas", val: kpis?.ops_ativas },
              { label: "Bobinas disponíveis", val: kpis?.bobinas_disponiveis }
            ].map((item, idx) => (
              <section key={idx} className="card col-4">
                <div className="cardTitle"><strong>{item.label}</strong></div>
                <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                  {apiStatus.loading ? <Skeleton width="60px" height="34px" /> : (item.val ?? 0)}
                </div>
              </section>
            ))}
          </div>
        </section>

        {/* Lista de OPs mapeada [cite: 450, 464, 467] */}
        <section className="card col-6">
          <div className="cardHeader"><strong>Últimas OPs</strong></div>
          <div className="cardBody">
            {apiStatus.loading ? (
              [1, 2, 3].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton height="40px" /></div>)
            ) : (
              ops.map(x => (
                <div key={x.op} style={{ marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 5 }}>
                  <strong>{x.op}</strong> <span>• {x.produto_nome || x.cod}</span>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Qtd: {x.quantidade} | Lote: {x.lote}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Lista de Pedidos mapeada [cite: 485, 499, 503] */}
        <section className="card col-6">
          <div className="cardHeader"><strong>Últimos Pedidos</strong></div>
          <div className="cardBody">
            {apiStatus.loading ? (
              [1, 2, 3].map(i => <div key={i} style={{ marginBottom: 12 }}><Skeleton height="40px" /></div>)
            ) : (
              pedidos.map(p => (
                <div key={p.numero} style={{ marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 5 }}>
                  <strong>{p.numero}</strong> <span>{p.cliente_nome || p.cliente_cod}</span>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Data: {p.emissao} | Qtd: {p.quantidade}</div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}