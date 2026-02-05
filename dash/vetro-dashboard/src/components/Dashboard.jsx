import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from "../services/api"; 
import ReportBuilder from "../components/ReportBuilder";
import logo from "../assets/Prancheta-8-_1_ (1).ico"

// --- Utilitários de Formatação ---
const formatCurrency = (val) => 
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatNumber = (val) => 
  new Intl.NumberFormat('pt-BR').format(val || 0);

export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState({ ok: false, loading: true });
  const [summary, setSummary] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  // ESTADO DO CALENDÁRIO: Sincronizado para filtros (YYYY-MM-DD para o input)
  const [periodo, setPeriodo] = useState({
    de: "2024-01-01", 
    ate: new Date().toISOString().split('T')[0]
  });

  async function loadData() {
    try {
      setApiStatus(prev => ({ ...prev, loading: true }));
      
      // Limpa hifens para o padrão Protheus (YYYYMMDD) exigido pelo backend
      const d_de = periodo.de.replace(/-/g, '');
      const d_ate = periodo.ate.replace(/-/g, '');

      // Chamadas sincronizadas com o routes.py
      const [resSummary, resMetrics] = await Promise.all([
        api.summary(), 
        api.request(`/metrics?categoria=faturamento&data_de=${d_de}&data_ate=${d_ate}`)
      ]);
      
      if (resSummary?.ok) {
        setSummary(resSummary.data);
      }

      if (resMetrics?.ok) {
        setAnalyticsData([{ 
          name: "Faturamento Real", 
          valor: resMetrics.total 
        }]);
      }
      
      setApiStatus({ ok: true, loading: false });
    } catch (e) { 
      console.error("Erro na carga:", e.message);
      setApiStatus({ ok: false, loading: false }); 
    }
  }

  useEffect(() => {
    loadData();
  }, [periodo]);

  const kpis = summary?.kpis;

  return (
    <div style={containerStyle}>
      {/* SIDEBAR */}
      <aside style={sidebarStyle}>
        <div style={logoAreaStyle}>
          <img src={logo} alt="Logo" style={logoImgStyle} />
          <div style={logoTextStyle}>
            <div style={{ fontWeight: '800', fontSize: '18px' }}>Vetroresina</div>
            <div style={{ fontSize: '12px', color: '#9A9FA5' }}>Management Hub</div>
          </div>
        </div>

        <nav style={navStyle}>
          <div 
            style={navItemStyle(!isBuilderOpen)} 
            onClick={() => setIsBuilderOpen(false)}
          >
            Dashboard
          </div>
          <div 
            style={navItemStyle(isBuilderOpen)} 
            onClick={() => setIsBuilderOpen(true)}
          >
            Report Builder
          </div>
        </nav>

        <div style={statusPillStyle(apiStatus.ok)}>
          <div style={dotStyle(apiStatus.ok)} />
          <span style={{ fontSize: '12px', fontWeight: '700' }}>
            ERP: {apiStatus.loading ? 'CARREGANDO...' : (apiStatus.ok ? 'ONLINE' : 'DESCONECTADO')}
          </span>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL */}
      <main style={mainStyle}>
        {isBuilderOpen ? (
          <ReportBuilder 
            tabelasAutorizadas={["SC5", "SC6", "SD3", "SB2", "SF2", "SA1", "SB1"]} 
            onClose={() => setIsBuilderOpen(false)} 
          />
        ) : (
          <>
            <header style={headerStyle}>
              <div>
                <h1 style={titleStyle}>Overview Comercial</h1>
                <p style={subtitleStyle}>BI Sincronizado com Protheus (Tabelas SA1, SB1, SC5, SD3)</p>
              </div>

              <div style={calendarContainerStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelMiniStyle}>DE:</label>
                  <input 
                    type="date" 
                    value={periodo.de} 
                    onChange={(e) => setPeriodo({...periodo, de: e.target.value})}
                    style={inputDateStyle}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelMiniStyle}>ATÉ:</label>
                  <input 
                    type="date" 
                    value={periodo.ate} 
                    onChange={(e) => setPeriodo({...periodo, ate: e.target.value})}
                    style={inputDateStyle}
                  />
                </div>
                <button onClick={loadData} style={btnRefreshStyle}>🔍 Filtrar</button>
              </div>
            </header>

            {/* KPIs */}
            <div style={kpiGridStyle}>
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>Pedidos Abertos (SC5)</div>
                <div style={{ fontSize: '32px', fontWeight: '800', color: '#1f8a3b' }}>
                  {apiStatus.loading ? "..." : formatNumber(kpis?.pedidos_abertos)}
                </div>
              </div>
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>Ordens Ativas (SD3)</div>
                <div style={{ fontSize: '32px', fontWeight: '800' }}>
                  {apiStatus.loading ? "..." : formatNumber(kpis?.ops_ativas)}
                </div>
              </div>
              <div style={kpiCardStyle}>
                <div style={kpiLabelStyle}>Estoque Bobinas (SB2)</div>
                <div style={{ fontSize: '32px', fontWeight: '800' }}>
                  {apiStatus.loading ? "..." : formatNumber(kpis?.bobinas_disponiveis)}
                </div>
              </div>
            </div>

            {/* GRÁFICO */}
            <section style={chartCardStyle}>
              <h3 style={{ marginBottom: '24px', fontWeight: '700' }}>Faturamento Real (SF2)</h3>
              <div style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEFEF" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => `R$ ${val / 1000}k`} 
                    />
                    <Tooltip 
                      cursor={{ fill: '#F4F7FA' }} 
                      formatter={(val) => [formatCurrency(val), "Faturamento Total"]}
                    />
                    <Bar dataKey="valor" fill="#1f8a3b" radius={[6, 6, 0, 0]} barSize={80} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// --- ESTILOS ---
const containerStyle = { display: 'flex', height: '100vh', background: '#F8F9FB', fontFamily: 'sans-serif', overflow: 'hidden' };
const sidebarStyle = { width: '280px', background: '#FFFFFF', borderRight: '1px solid #EFEFEF', display: 'flex', flexDirection: 'column', padding: '32px 24px' };
const logoAreaStyle = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' };
const logoImgStyle = { width: '40px', height: '40px', borderRadius: '12px' };
const logoTextStyle = { lineHeight: '1.2' };
const navStyle = { display: 'flex', flexDirection: 'column', gap: '4px' };
const navItemStyle = (active) => ({ padding: '12px 16px', borderRadius: '12px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', background: active ? '#F4F4F4' : 'transparent', color: active ? '#1f8a3b' : '#6F767E', transition: '0.2s' });
const statusPillStyle = (ok) => ({ marginTop: 'auto', padding: '16px', background: ok ? '#EAF7ED' : '#F4F4F4', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' });
const dotStyle = (ok) => ({ width: '8px', height: '8px', borderRadius: '50%', background: ok ? '#31B047' : '#FF4D4D' });
const mainStyle = { flex: 1, overflowY: 'auto', padding: '48px 64px' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' };
const titleStyle = { fontSize: '32px', fontWeight: '800', margin: 0 };
const subtitleStyle = { color: '#9A9FA5', margin: '4px 0 0 0' };
const kpiGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' };
const kpiCardStyle = { background: '#FFFFFF', borderRadius: '24px', border: '1px solid #EFEFEF', padding: '32px' };
const kpiLabelStyle = { fontSize: '14px', fontWeight: '700', color: '#6F767E', marginBottom: '16px' };
const kpiSubStyle = { fontSize: '12px', color: '#9A9FA5', marginTop: '8px' };
const chartCardStyle = { background: '#FFFFFF', borderRadius: '24px', padding: '32px', border: '1px solid #EFEFEF' };
const calendarContainerStyle = { display: 'flex', gap: '12px', alignItems: 'center', background: '#FFF', padding: '10px 16px', borderRadius: '12px', border: '1px solid #EFEFEF' };
const inputGroupStyle = { display: 'flex', flexDirection: 'column', gap: '2px' };
const labelMiniStyle = { fontSize: '10px', fontWeight: '800', color: '#9A9FA5' };
const inputDateStyle = { border: '1px solid #EEE', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', outline: 'none' };
const btnRefreshStyle = { background: '#1f8a3b', color: '#FFF', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' };