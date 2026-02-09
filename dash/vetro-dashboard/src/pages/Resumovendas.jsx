import React, { useEffect, useState, useRef, useMemo } from "react";
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend 
} from 'recharts';
import { api } from "../services/api";

const GRUPOS_MAP = {
  "2001": { nome: "Linha Branca", cor: "#1f8a3b" },
  "2002": { nome: "Cobertura", cor: "#334155" },
  "2003": { nome: "Decoração", cor: "#64748B" },
  "OUTROS": { nome: "Outras Vendas", cor: "#CBD5E1" }
};

const COLORS = ['#1f8a3b', '#0ea5e9', '#6366f1', '#f59e0b', '#94a3b8'];

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={customTooltipStyle}>
        <p style={tooltipDate}>{payload[0].payload.data}</p>
        <p style={tooltipValue}>
          valor_bruto : <span style={{ color: '#1f8a3b' }}>{formatCurrency(payload[0].value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

// Função para renderizar Label Externo com Linha Indicativa e ajuste de sobreposição
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, fill, index }) => {
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  
  // Pontos de ancoragem da linha
  const sx = cx + (outerRadius + 5) * cos;
  const sy = cy + (outerRadius + 5) * sin;
  const mx = cx + (outerRadius + 25) * cos;
  const my = cy + (outerRadius + 25) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 20;
  
  // Lógica ANTI-SOBREPOSIÇÃO: desvia a altura baseado no índice da fatia
  const yOffset = (index % 2 === 0) ? -12 : 12;
  const ey = my + (percent < 0.05 ? yOffset : 0); // Só aplica desvio em fatias pequenas (< 5%)

  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2.5} fill={fill} stroke="none" />
      <text 
        x={ex + (cos >= 0 ? 1 : -1) * 10} 
        y={ey} 
        textAnchor={textAnchor} 
        fill={fill} 
        dominantBaseline="central"
        style={{ fontSize: '12px', fontWeight: 'bold' }}
      >
        {`${(percent * 100).toFixed(2)}%`}
      </text>
    </g>
  );
};

export default function ResumoVendas() {
  const [diario, setDiario] = useState({ data: [], resumo: {} });
  const [distribuicao, setDistribuicao] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [grupoAtivo, setGrupoAtivo] = useState("2001");
  const [activeIndex, setActiveIndex] = useState(0);
  
  const chartContainerRef = useRef(null);
  const tableRef = useRef(null);

  const [periodo, setPeriodo] = useState(() => {
    const salvo = localStorage.getItem("vetro_dashboard_periodo");
    return salvo ? JSON.parse(salvo) : { de: "2025-11-01", ate: "2025-11-30" };
  });

  async function loadAllData() {
    try {
      const query = `?data_de=${periodo.de.replace(/-/g, '')}&data_ate=${periodo.ate.replace(/-/g, '')}`;
      const [resDiario, resPizza, resRanking] = await Promise.all([
        api.request(`/analytics/resumo-vendas-diario${query}`),
        api.request(`/analytics/distribuicao-grupos${query}`),
        api.request(`/analytics/top5-outros-grupo${query}&grupo=${grupoAtivo}`)
      ]);
      if (resDiario.ok) setDiario({ data: resDiario.data, resumo: resDiario.resumo_periodo });
      
      if (resPizza.ok) {
        setDistribuicao(resPizza.data.map((item, index) => ({
          ...item,
          name: GRUPOS_MAP[item.grupo]?.nome || item.grupo,
          fill: COLORS[index % COLORS.length]
        })));
      }
      
      if (resRanking.ok) setRanking(resRanking.data);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (diario.data.length > 0) {
      const interval = setInterval(() => {
        setActiveIndex((prev) => {
          const next = (prev + 1) % diario.data.length;
          const row = tableRef.current?.querySelector(`[data-index="${next}"]`);
          row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return next;
        });
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [diario.data]);

  useEffect(() => { loadAllData(); }, [grupoAtivo, periodo]);

  const tooltipCoords = useMemo(() => {
    if (!diario.data.length || !chartContainerRef.current) return { x: 0, y: 0 };
    const containerWidth = chartContainerRef.current.offsetWidth;
    const containerHeight = chartContainerRef.current.offsetHeight;
    const margin = { top: 20, right: 20, left: 20, bottom: 0 };
    const chartWidth = containerWidth - margin.left - margin.right;
    const chartHeight = containerHeight - margin.top - margin.bottom;
    const x = margin.left + (activeIndex * (chartWidth / (diario.data.length - 1)));
    const maxVal = Math.max(...diario.data.map(d => d.valor_bruto), 1);
    const currentVal = diario.data[activeIndex].valor_bruto;
    const y = margin.top + chartHeight - (currentVal / maxVal * chartHeight);
    return { x, y };
  }, [activeIndex, diario.data]);

  const totalImpostos = diario.data.reduce((acc, curr) => acc + (curr.impostos || 0), 0);
  const mediaImpostos = totalImpostos / (diario.data.length || 1);

  return (
    <div style={containerFluid}>
      <header style={headerFluid}>
        <h1 style={titleFluid}>Performance Comercial Vetroresina</h1>
        <div style={filterFluid}>
          <input type="date" value={periodo.de} onChange={(e) => setPeriodo({...periodo, de: e.target.value})} style={inputFluid} />
          <input type="date" value={periodo.ate} onChange={(e) => setPeriodo({...periodo, ate: e.target.value})} style={inputFluid} />
        </div>
      </header>

      <div style={gridMain}>
        <div style={cardTableFull}>
          <div style={tableHeader}>CONSOLIDADO MENSAL (BRUTO / NOTAS / IMPOSTOS)</div>
          <div style={tableWrapperFull}>
            <div style={headerGrid}>
              <span>Data</span>
              <span>Vlr. Bruto</span>
              <span style={{textAlign:'center'}}>Notas</span>
              <span>Impostos</span>
            </div>
            <div style={tbodyFlex} ref={tableRef}>
              {diario.data.map((d, i) => (
                <div key={i} data-index={i} style={i === activeIndex ? rowActiveGrid : (i % 2 === 0 ? rowEvenGrid : rowOddGrid)}>
                  <span>{d.data}</span>
                  <span style={{fontWeight:'700'}}>{formatCurrency(d.valor_bruto)}</span>
                  <span style={{textAlign:'center'}}>{d.qtd_notas}</span>
                  <span>{formatCurrency(d.impostos)}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={footerSummaryTV}>
              <div style={summaryRow}>
                <div style={sumLabel}>TOTAL:</div>
                <div style={sumVal}>{formatCurrency(diario.resumo.total_vendas)}</div>
                <div style={sumValCenter}>{diario.resumo.total_notas}</div>
                <div style={sumVal}>{formatCurrency(totalImpostos)}</div>
              </div>
              <div style={summaryRowMedia}>
                <div style={sumLabelMedia}>MÉDIA:</div>
                <div style={sumValMedia}>{formatCurrency(diario.resumo.media_diaria_valor)}</div>
                <div style={sumValCenterMedia}>{diario.resumo.media_diaria_notas}</div>
                <div style={sumValMedia}>{formatCurrency(mediaImpostos)}</div>
              </div>
          </div>
        </div>

        <div style={sideMetrics}>
          <section style={cardMetricRanking}>
            <div style={headerCard}>TOP 5 CLIENTES + OUTROS</div>
            <div style={rankingWrapper}>
              {ranking.map((r, i) => (
                <div key={i} style={i === ranking.length - 1 ? rankingRowLast : rankingRow}>
                  <span style={textTruncate}>{r.cliente}</span>
                  <span style={{color: '#1f8a3b', fontWeight: '800'}}>{formatCurrency(r.valor)}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={cardMetricChart}>
            <div style={headerCard}>PARTICIPAÇÃO % POR GRUPO</div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={distribuicao} 
                  dataKey="valor" 
                  innerRadius="35%" 
                  outerRadius="55%" 
                  stroke="#fff"
                  strokeWidth={2}
                  labelLine={false}
                  label={renderCustomizedLabel}
                  isAnimationActive={false}
                >
                  {distribuicao.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '15px' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </section>

          <section style={cardMetricChart} ref={chartContainerRef}>
            <div style={headerCard}>EVOLUÇÃO DIÁRIA (AO VIVO)</div>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={diario.data} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="data" hide />
                <YAxis hide domain={[0, 'dataMax + 100000']} />
                <Tooltip 
                  content={<CustomTooltip />} 
                  active={true}
                  payload={diario.data.length > 0 ? [{ 
                    payload: diario.data[activeIndex], 
                    value: diario.data[activeIndex].valor_bruto 
                  }] : []}
                  label={diario.data.length > 0 ? diario.data[activeIndex].data : ""}
                  position={{ x: tooltipCoords.x, y: tooltipCoords.y - 70 }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="valor_bruto" 
                  stroke="#1f8a3b" 
                  fill="rgba(31,138,59,0.1)" 
                  strokeWidth={3} 
                  isAnimationActive={true}
                  dot={(props) => {
                    const { cx, cy, index } = props;
                    if (index === activeIndex) {
                      return <circle key={index} cx={cx} cy={cy} r={6} fill="#1f8a3b" stroke="#fff" strokeWidth={2} />;
                    }
                    return null;
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>
    </div>
  );
}

const customTooltipStyle = { backgroundColor: '#fff', border: '1px solid #E2E8F0', padding: '10px 15px', borderRadius: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', pointerEvents: 'none', zIndex: 100 };
const tooltipDate = { fontSize: '16px', fontWeight: 'bold', margin: '0 0 5px 0', color: '#334155' };
const tooltipValue = { fontSize: '14px', margin: 0, color: '#64748B' };

const containerFluid = { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', padding: '10px', boxSizing: 'border-box', background: '#F1F5F9', overflow: 'hidden' };
const headerFluid = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 };
const titleFluid = { fontSize: '18px', fontWeight: '900', color: '#0F172A', margin: 0 };
const filterFluid = { display: 'flex', gap: '8px' };
const inputFluid = { padding: '3px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '11px', fontWeight: '700' };
const gridMain = { display: 'flex', flex: 1, gap: '10px', minHeight: 0 };
const cardTableFull = { flex: 1.4, display: 'flex', flexDirection: 'column', background: '#FFF', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' };
const tableWrapperFull = { flex: 1, display: 'flex', flexDirection: 'column', padding: '0 10px' };
const gridConfig = "1.2fr 2fr 1fr 2fr";
const headerGrid = { display: 'grid', gridTemplateColumns: gridConfig, padding: '10px 0', borderBottom: '1px solid #F1F5F9', fontSize: '11px', fontWeight: '800', color: '#64748B' };
const tbodyFlex = { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px 0' };
const rowBase = { display: 'grid', gridTemplateColumns: gridConfig, alignItems: 'center', fontSize: '11px', flex: 1, padding: '2px 0' };
const rowActiveGrid = { ...rowBase, background: '#EAF7ED', color: '#1f8a3b', transition: '0.5s', borderRadius: '4px' };
const rowEvenGrid = { ...rowBase, background: '#FFF' };
const rowOddGrid = { ...rowBase, background: '#F8FAFC' };
const tableHeader = { padding: '10px', fontSize: '10px', fontWeight: '800', color: '#64748B', borderBottom: '1px solid #F1F5F9' };
const footerSummaryTV = { background: '#0F172A', color: '#FFF', padding: '10px 10px', flexShrink: 0 };
const summaryRow = { display: 'grid', gridTemplateColumns: gridConfig, alignItems: 'center', marginBottom: '2px' };
const summaryRowMedia = { display: 'grid', gridTemplateColumns: gridConfig, alignItems: 'center', opacity: 0.8 };
const sumLabel = { fontSize: '11px', fontWeight: '900' };
const sumVal = { fontSize: '13px', fontWeight: '900', color: '#31B047' };
const sumValCenter = { textAlign: 'center', fontWeight: '900', fontSize: '13px' };
const sumLabelMedia = { fontSize: '9px', fontWeight: '700' };
const sumValMedia = { fontSize: '11px', fontWeight: '700' };
const sumValCenterMedia = { textAlign: 'center', fontWeight: '700', fontSize: '11px' };
const sideMetrics = { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 };
const cardMetricRanking = { flex: 1.2, background: '#FFF', borderRadius: '16px', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minHeight: 0 };
const cardMetricChart = { flex: 1, background: '#FFF', borderRadius: '16px', padding: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', minHeight: 0 };
const headerCard = { fontSize: '9px', fontWeight: '800', color: '#64748B', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems:'center' };
const rankingWrapper = { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' };
const rankingRow = { display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '4px 0', borderBottom: '1px solid #F1F5F9' };
const rankingRowLast = { display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '4px 0', background: '#F8FAFC', fontWeight: '800' };
const textTruncate = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' };