import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import ReportBuilder from "../components/ReportBuilder";
import logo from "../assets/Prancheta-8-_1_ (1).ico"

export default function Dashboard() {
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState({ ok: false });
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [s, o, p] = await Promise.all([
          api.summary(),
          api.ops({ page: 1, page_size: 5 }),
          api.pedidosVenda({ page: 1, page_size: 5 }),
        ]);
        setSummary(s?.data || null);
        setOps(o?.data?.items || []);
        setPedidos(p?.data?.items || []);
        setApiStatus({ ok: true });
      } catch (e) { 
        setApiStatus({ ok: false }); 
      }
    }
    load();
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: '#F8F9FB', 
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      color: '#1A1D1F',
      overflow: 'hidden'
    }}>
      
      {/* 1. SIDEBAR COM LOGO OFICIAL */}
      <aside style={{ 
        width: '280px', 
        background: '#FFFFFF', 
        borderRight: '1px solid #EFEFEF',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
          <img 
            src={logo} 
            alt="Vetroresina Logo" 
            style={{ width: '40px', height: '40px', borderRadius: '12px' }} 
          />
          <div style={{ lineHeight: '1.2' }}>
            <div style={{ fontWeight: '800', fontSize: '18px', color: '#1A1D1F' }}>Vetroresina</div>
            <div style={{ fontSize: '12px', color: '#9A9FA5', fontWeight: '600' }}>Management Hub</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={navItemStyle(true)}>Dashboard</div>
          <div style={navItemStyle(false)} onClick={() => navigate("/ops")}>Produção (SD3)</div>
          <div style={navItemStyle(false)} onClick={() => navigate("/pedidos")}>Vendas (SC5)</div>
          <div style={navItemStyle(false)} onClick={() => setIsBuilderOpen(true)}>Report Builder</div>
        </nav>

        {/* STATUS DO ERP NO RODAPÉ DA SIDEBAR */}
        <div style={{ marginTop: 'auto', padding: '16px', background: '#F4F4F4', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: apiStatus.ok ? '#31B047' : '#FF4D4D' 
          }} />
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#6F767E' }}>
            ERP: {apiStatus.ok ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </aside>

      {/* 2. CONTEÚDO PRINCIPAL (COM CORREÇÃO DE VIEWPORT) */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '48px 64px' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '800', margin: 0, letterSpacing: '-1px' }}>Overview</h1>
            <p style={{ color: '#9A9FA5', margin: '4px 0 0 0', fontWeight: '500' }}>Dados reais extraídos do Protheus</p>
          </div>
          <button 
            onClick={() => setIsBuilderOpen(true)}
            style={{ 
              background: '#1f8a3b', 
              color: '#FFF', 
              border: 'none', 
              padding: '12px 24px', 
              borderRadius: '12px', 
              fontWeight: '700', 
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(31, 138, 59, 0.25)'
            }}
          >
            + Novo Relatório
          </button>
        </header>

        {/* MÉTRICAS (KPIs) - ESTILO SPHERULE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '48px' }}>
          <WidgetKPI label="Pedidos Abertos" value={summary?.kpis?.pedidos_abertos} sub="Tabela SC5" color="#31B047" />
          <WidgetKPI label="Ordens Ativas" value={summary?.kpis?.ops_ativas} sub="Tabela SD3" color="#1A1D1F" />
          <WidgetKPI label="Disponível" value={summary?.kpis?.bobinas_disponiveis ? Math.floor(summary.kpis.bobinas_disponiveis).toLocaleString() : '-'} sub="Tabela SB2" color="#1A1D1F" />
        </div>

        {/* LISTAGENS LADO A LADO */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
          <div style={cardStyle}>
            <div style={cardHeaderStyle}><strong>Status de Produção</strong></div>
            <div style={{ padding: '0 24px 24px 24px' }}>
              {ops.map((op, i) => (
                <div key={i} style={itemRowStyle}>
                  <div>
                    <div style={{ fontWeight: '700' }}>{op.D3_OP}</div>
                    <div style={{ fontSize: '12px', color: '#9A9FA5' }}>{op.produto_nome}</div>
                  </div>
                  <div style={{ fontWeight: '800' }}>{op.D3_QUANT}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={cardHeaderStyle}><strong>Vendas Recentes</strong></div>
            <div style={{ padding: '0 24px 24px 24px' }}>
              {pedidos.map((p, i) => (
                <div key={i} style={itemRowStyle}>
                  <div>
                    <div style={{ fontWeight: '700' }}>{p.numero}</div>
                    <div style={{ fontSize: '12px', color: '#9A9FA5' }}>{p.cliente?.substring(0, 15)}...</div>
                  </div>
                  <div style={{ color: '#31B047', fontWeight: '800' }}>R$ {p.total?.toLocaleString() || '---'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MODAL DO REPORT BUILDER */}
        {isBuilderOpen && (
          <ReportBuilder onClose={() => setIsBuilderOpen(false)} />
        )}

      </main>
    </div>
  );
}

/* --- COMPONENTES AUXILIARES --- */

function WidgetKPI({ label, value, sub, color }) {
  return (
    <div style={{ ...cardStyle, padding: '32px' }}>
      <div style={{ fontSize: '14px', fontWeight: '700', color: '#6F767E', marginBottom: '16px' }}>{label}</div>
      <div style={{ fontSize: '40px', fontWeight: '800', color: color, letterSpacing: '-1.5px' }}>{value ?? '-'}</div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#9A9FA5', marginTop: '8px' }}>{sub}</div>
    </div>
  );
}

/* --- ESTILOS NATIVOS --- */

const cardStyle = { 
  background: '#FFFFFF', 
  borderRadius: '24px', 
  border: '1px solid #EFEFEF', 
  boxShadow: '0 2px 4px rgba(0,0,0,0.01)' 
};

const cardHeaderStyle = { padding: '24px', fontSize: '18px' };

const itemRowStyle = { 
  display: 'flex', 
  justifyContent: 'space-between', 
  padding: '16px 0', 
  borderBottom: '1px solid #F4F4F4' 
};

const navItemStyle = (active) => ({ 
  padding: '12px 16px', 
  borderRadius: '12px', 
  fontSize: '14px', 
  fontWeight: '700', 
  cursor: 'pointer', 
  background: active ? '#F4F4F4' : 'transparent', 
  color: active ? '#1A1D1F' : '#6F767E' 
});