import React, { useEffect, useState } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { api } from "../services/api"; 
import ReportBuilder from "../components/ReportBuilder";
import logo from "../assets/Prancheta-8-_1_ (1).ico";

// --- Utilitários ---
const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
const COLORS = ['#1f8a3b', '#334155', '#64748B', '#94A3B8', '#CBD5E1'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [apiStatus, setApiStatus] = useState({ ok: false, loading: true });
  const [summary, setSummary] = useState(null);
  const [investigacao, setInvestigacao] = useState({ notas: [], pedidos: [] });

  // ESTADO INICIAL: Tenta recuperar do localStorage ou usa o padrão predefinido
  const [periodo, setPeriodo] = useState(() => {
    const salvo = localStorage.getItem("vetro_dashboard_periodo");
    if (salvo) {
      return JSON.parse(salvo);
    }
    return { 
      de: "2024-01-01", 
      ate: new Date().toISOString().split('T')[0] 
    };
  });

  async function loadData() {
    try {
      setApiStatus(prev => ({ ...prev, loading: true }));
      
      // Persiste o período selecionado para futuras sessões
      localStorage.setItem("vetro_dashboard_periodo", JSON.stringify(periodo));

      const d_de = periodo.de.replace(/-/g, '');
      const d_ate = periodo.ate.replace(/-/g, '');
      const queryParams = `?data_de=${d_de}&data_ate=${d_ate}`;

      const [resSummary, resFiscal, resComercial] = await Promise.all([
        api.summary(), 
        api.request(`/fiscal/notas-investigacao${queryParams}`),
        api.request(`/comercial/pedidos-investigacao${queryParams}`)
      ]);
      
      if (resSummary?.ok) setSummary(resSummary.data);
      if (resFiscal?.ok) setInvestigacao(prev => ({ ...prev, notas: resFiscal.data }));
      if (resComercial?.ok) setInvestigacao(prev => ({ ...prev, pedidos: resComercial.data }));
      
      setApiStatus({ ok: true, loading: false });
    } catch (e) { 
      setApiStatus({ ok: false, loading: false }); 
    }
  }

  // O useEffect agora só dispara no "mount" inicial. 
  // O loadData subsequente é controlado pelo botão de Sincronizar (🔄) para evitar loops de escrita no storage.
  useEffect(() => { 
    loadData(); 
  }, []);

  // Lógica para o Gráfico de Top Clientes
  const getTopClientes = () => {
    const map = investigacao.notas.reduce((acc, n) => {
      acc[n.F2_CLIENTE] = (acc[n.F2_CLIENTE] || 0) + n.F2_VALMERC;
      return acc;
    }, {});
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  };

  return (
    <div style={containerStyle}>
      <aside style={sidebarStyle}>
        <div style={logoAreaStyle}>
          <img src={logo} alt="Logo" style={logoImgStyle} />
          <div style={logoTextStyle}>
            <div style={{ fontWeight: '800', fontSize: '18px', color: '#FFF' }}>Vetroresina</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>BI Hub</div>
          </div>
        </div>
        <nav style={navStyle}>
          <div style={navItemStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>📊 Overview</div>
          <div style={navItemStyle(activeTab === 'builder')} onClick={() => setActiveTab('builder')}>🛠 Builder</div>
        </nav>
        <div style={statusPillStyle(apiStatus.ok)}>
          <div style={dotStyle(apiStatus.ok)} />
          <span style={{ fontSize: '11px', color: '#FFF' }}>{apiStatus.ok ? 'CONECTADO' : 'OFFLINE'}</span>
        </div>
      </aside>

      <main style={mainStyle}>
        {activeTab === 'builder' ? <ReportBuilder onClose={() => setActiveTab('overview')} /> : (
          <>
            <header style={headerStyle}>
              <h1 style={titleStyle}>Management Hub</h1>
              <div style={calendarContainerStyle}>
                <input type="date" value={periodo.de} onChange={e => setPeriodo({...periodo, de: e.target.value})} style={inputDateStyle} />
                <input type="date" value={periodo.ate} onChange={e => setPeriodo({...periodo, ate: e.target.value})} style={inputDateStyle} />
                <button onClick={loadData} style={btnRefreshStyle}>🔄</button>
              </div>
            </header>

            <div style={kpiGridStyle}>
              <KpiCard title="Pedidos" value={summary?.kpis.pedidos_abertos} sub="Tabela SC5" />
              <KpiCard title="OPs Ativas" value={summary?.kpis.ops_ativas} sub="Tabela SD3" />
              <KpiCard title="Faturamento" value={formatCurrency(investigacao.notas.reduce((a, b) => a + b.F2_VALMERC, 0))} sub="Tabela SF2" color="#1f8a3b" />
              <KpiCard title="Ticket Médio" value={formatCurrency(investigacao.notas.length ? investigacao.notas.reduce((a, b) => a + b.F2_VALMERC, 0) / investigacao.notas.length : 0)} sub="BI Calc" />
            </div>

            <div style={dashboardGrid}>
              <section style={cardStyle}>
                <h3 style={cardTitle}>Tendência de Faturamento</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={investigacao.notas}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="F2_EMISSAO" hide />
                    <YAxis fontSize={10} tickFormatter={v => `${v/1000}k`} />
                    <Tooltip />
                    <Area type="monotone" dataKey="F2_VALMERC" stroke="#1f8a3b" fill="rgba(31,138,59,0.1)" />
                  </AreaChart>
                </ResponsiveContainer>
              </section>

              <section style={cardStyle}>
                <h3 style={cardTitle}>Top 5 Clientes (R$)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={getTopClientes()} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" fontSize={10} width={80} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#334155" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section style={{...cardStyle, gridColumn: 'span 2'}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                   <h3 style={cardTitle}>Monitoramento Investigativo (SF2)</h3>
                   <button style={btnSmall} onClick={() => alert("Exportando...")}>Exportar Excel</button>
                </div>
                <div style={tableWrapper}>
                  <table style={tableStyle}>
                    <thead><tr><th>NF</th><th>Data</th><th>Cliente</th><th>Estado</th><th>Valor</th></tr></thead>
                    <tbody>
                      {investigacao.notas.map((n, i) => (
                        <tr key={i}><td>{n.F2_DOC}</td><td>{n.F2_EMISSAO}</td><td>{n.F2_CLIENTE}</td><td>{n.F2_EST}</td><td>{formatCurrency(n.F2_VALMERC)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const KpiCard = ({ title, value, sub, color }) => (
  <div style={kpiCardStyle}>
    <div style={kpiLabelStyle}>{title}</div>
    <div style={{ fontSize: '24px', fontWeight: '900', color: color || '#1E293B', margin: '4px 0' }}>{value || '0'}</div>
    <div style={kpiSubStyle}>{sub}</div>
  </div>
);

const containerStyle = { display: 'flex', height: '100vh', background: '#F1F5F9', fontFamily: 'sans-serif' };
const sidebarStyle = { width: '250px', background: '#0F172A', padding: '32px 20px', display: 'flex', flexDirection: 'column' };
const logoAreaStyle = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' };
const logoImgStyle = { width: '36px', borderRadius: '8px' };
const logoTextStyle = { lineHeight: '1.2' };
const navStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' };
const navItemStyle = (active) => ({ padding: '12px 16px', borderRadius: '10px', color: active ? '#FFF' : '#94A3B8', background: active ? '#1E293B' : 'transparent', cursor: 'pointer', fontWeight: '700', fontSize: '13px' });
const statusPillStyle = (ok) => ({ marginTop: 'auto', padding: '12px', background: '#1E293B', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' });
const dotStyle = (ok) => ({ width: '8px', height: '8px', borderRadius: '50%', background: ok ? '#31B047' : '#EF4444' });
const mainStyle = { flex: 1, padding: '32px 40px', overflowY: 'auto' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' };
const titleStyle = { fontSize: '24px', fontWeight: '800', color: '#0F172A' };
const calendarContainerStyle = { display: 'flex', gap: '8px', background: '#FFF', padding: '6px', borderRadius: '10px', border: '1px solid #E2E8F0' };
const inputDateStyle = { border: 'none', background: '#F8FAFC', padding: '6px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' };
const btnRefreshStyle = { background: '#1f8a3b', color: '#FFF', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' };
const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' };
const kpiCardStyle = { background: '#FFF', padding: '20px', borderRadius: '16px', border: '1px solid #E2E8F0' };
const kpiLabelStyle = { fontSize: '11px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase' };
const kpiSubStyle = { fontSize: '10px', color: '#94A3B8' };
const dashboardGrid = { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' };
const cardStyle = { background: '#FFF', padding: '24px', borderRadius: '20px', border: '1px solid #E2E8F0' };
const cardTitle = { fontSize: '14px', fontWeight: '700', margin: '0 0 16px 0', color: '#1E293B' };
const tableWrapper = { maxHeight: '300px', overflowY: 'auto' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: '11px' };
const btnSmall = { padding: '4px 10px', background: '#F1F5F9', border: 'none', borderRadius: '6px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' };