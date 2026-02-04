import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState({ ok: false });
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        setError("");
        const [s, o, p] = await Promise.all([
          api.summary(),
          api.ops({ page: 1, page_size: 5 }),
          api.pedidosVenda({ page: 1, page_size: 5 }),
        ]);
        if (!alive) return;
        setSummary(s?.data || null);
        setOps(o?.data?.items || []);
        setPedidos(p?.data?.items || []);
        setApiStatus({ ok: true });
      } catch (e) {
        if (!alive) return;
        setError("API fora do ar ou Rota não encontrada (404).");
        setApiStatus({ ok: false });
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  const kpis = summary?.kpis;

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f2f5', overflow: 'hidden' }}>
      
      {/* Header Estilizado - VR Gestão */}
      <header className="topbar" style={{ flexShrink: 0, padding: '12px 24px', background: '#fff', borderBottom: '1px solid #dce0e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#1f8a3b', color: '#fff', padding: '6px 10px', borderRadius: '4px', fontWeight: 'bold' }}>VR</div>
          <strong style={{ color: '#1a1d21' }}>Vetroresina • Gestão Protheus</strong>
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: apiStatus.ok ? '#1f8a3b' : '#d92d20', fontWeight: '600' }}>
            ● {apiStatus.ok ? "Sistema Online" : "Erro de Conexão"}
          </span>
        </div>
      </header>

      {/* Grid de Dashboard Customizável */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        
        {error && <div style={{ color: '#d92d20', background: '#fdebeb', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '13px' }}>⚠️ {error}</div>}

        {/* 1. Linha de Métricas (KPIs) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <small style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Pedidos em Aberto</small>
            <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '8px' }}>{kpis?.pedidos_abertos ?? "-"}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <small style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Ordens Ativas</small>
            <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '8px' }}>{kpis?.ops_ativas ?? "-"}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
            <small style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>Peso em Estoque</small>
            <div style={{ fontSize: '32px', fontWeight: '800', marginTop: '8px' }}>{kpis?.bobinas_disponiveis ? Math.floor(kpis.bobinas_disponiveis) : "-"}</div>
          </div>
          <div className="card" style={{ padding: '20px', textAlign: 'center', background: '#1f8a3b', color: '#fff' }}>
            <small style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: '700', opacity: 0.8 }}>Status Global</small>
            <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '8px' }}>EFICIENTE</div>
          </div>
        </div>

        {/* 2. Área de Gráficos e Listas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
          
          {/* Espaço para o Futuro Gráfico de Vendas */}
          <section className="card" style={{ padding: '24px', minHeight: '350px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <strong>Volume de Vendas (Mensal)</strong>
              <select style={{ fontSize: '12px', padding: '4px', borderRadius: '4px', border: '1px solid #ddd' }}>
                <option>Últimos 6 meses</option>
              </select>
            </div>
            {/* Aqui entra o componente de gráfico (Recharts ou Chart.js) */}
            <div style={{ height: '250px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              Área destinada ao Gráfico de Analytics
            </div>
          </section>

          {/* Lista de Ações Rápidas / Recentes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="card" style={{ padding: '20px' }}>
              <strong>Últimas OPs</strong>
              <div style={{ marginTop: '15px' }}>
                {ops.map((x, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                    <strong>{x.D3_OP || x.op}</strong> • {x.produto_nome || x.D3_COD}
                  </div>
                ))}
              </div>
            </section>
            
            <section className="card" style={{ padding: '20px' }}>
              <strong>Pedidos Recentes</strong>
              <div style={{ marginTop: '15px' }}>
                {pedidos.map((p, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12px', cursor: 'pointer' }} onClick={() => navigate(`/pedidos-venda/${p.numero}`)}>
                    <strong>{p.numero}</strong> • {p.cliente}
                  </div>
                ))}
              </div>
            </section>
          </div>

        </div>
      </main>
    </div>
  );
}