import React, { useEffect, useState, useRef } from "react";
import {
    Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
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

const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, fill, index }) => {
    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 5) * cos;
    const sy = cy + (outerRadius + 5) * sin;
    const mx = cx + (outerRadius + 25) * cos;
    const my = cy + (outerRadius + 25) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 20;
    const ey = my + (percent < 0.05 ? ((index % 2 === 0) ? -12 : 12) : 0);
    const textAnchor = cos >= 0 ? 'start' : 'end';

    return (
        <g>
            <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
            <circle cx={ex} cy={ey} r={2.5} fill={fill} stroke="none" />
            <text x={ex + (cos >= 0 ? 1 : -1) * 10} y={ey} textAnchor={textAnchor} fill={fill} dominantBaseline="central" style={{ fontSize: '11px', fontWeight: 'bold' }}>
                {`${(percent * 100).toFixed(2)}%`}
            </text>
        </g>
    );
};

export default function ResumoVendas() {
    const [diario, setDiario] = useState({ data: [], resumo: {} });
    const [distribuicao, setDistribuicao] = useState([]);
    const [ranking, setRanking] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const tableRef = useRef(null);

    const [periodo] = useState(() => {
        const salvo = localStorage.getItem("vetro_dashboard_periodo");
        return salvo ? JSON.parse(salvo) : { de: "2025-11-01", ate: "2025-11-30" };
    });

    async function loadAllData() {
        try {
            const query = `?data_de=${periodo.de.replace(/-/g, '')}&data_ate=${periodo.ate.replace(/-/g, '')}`;
            const [resDiario, resPizza, resRanking] = await Promise.all([
                api.request(`/analytics/resumo-vendas-diario${query}`),
                api.request(`/analytics/distribuicao-grupos${query}`),
                api.request(`/analytics/ranking-geral-clientes${query}`)
            ]);

            if (resDiario?.ok) setDiario({ data: resDiario.data || [], resumo: resDiario.resumo_periodo || {} });

            if (resPizza?.ok) {
                setDistribuicao((resPizza.data || []).map((item, index) => ({
                    ...item,
                    name: GRUPOS_MAP[item.grupo]?.nome || item.grupo,
                    fill: COLORS[index % COLORS.length]
                })));
            }

            // =======================
            // ALTERAÇÃO APENAS AQUI 👇
            // =======================
            if (resRanking?.ok) {
                // Consolidação: soma faturamentos de clientes repetidos (normalizando nome)
                const consolidados = (resRanking.data || []).reduce((acc, curr) => {
                    const nome = (curr?.cliente ?? "").toString().trim();
                    const valor = Number(curr?.valor ?? 0) || 0;

                    const existente = acc.find(item => item.cliente === nome);
                    if (existente) {
                        existente.valor += valor;
                    } else {
                        acc.push({ cliente: nome, valor });
                    }
                    return acc;
                }, []);

                const ordenados = consolidados.sort((a, b) => (b.valor || 0) - (a.valor || 0));

                // ✅ total bruto vindo do MESMO dataset do relatório diário (resDiario)
                const totalGeral = (resDiario?.data || []).reduce((s, d) => s + (Number(d?.valor_bruto ?? 0) || 0), 0);


                // Top 9 (posições 1..9)
                const top9 = ordenados.slice(0, 9);

                // Demais Clientes (posição 10)
                const somaTop9 = top9.reduce((s, c) => s + (c.valor || 0), 0);
                const demaisValor = Math.max(0, totalGeral - somaTop9);

                const finalRanking = [
                    ...top9,
                    { cliente: "Demais Clientes", valor: demaisValor, _demais: true },
                ];

                setRanking(finalRanking);
            }
            // =======================
            // ALTERAÇÃO APENAS AQUI 👆
            // =======================

        } catch (e) { console.error("Erro ao carregar dados:", e); }
    }

    useEffect(() => {
        if (diario.data?.length > 0) {
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

    useEffect(() => { loadAllData(); }, []);

    // Cálculo de Totais e Médias para as colunas solicitadas
    const stats = (diario.data || []).reduce((acc, curr) => {
        const liq = (curr.valor_bruto || 0) - (curr.impostos || 0) - (curr.frete || 0);
        acc.notas += curr.qtd_notas || 0;
        acc.bruto += curr.valor_bruto || 0;
        acc.impostos += curr.impostos || 0;
        acc.frete += curr.frete || 0;
        acc.liquido += liq;
        return acc;
    }, { notas: 0, bruto: 0, impostos: 0, frete: 0, liquido: 0 });

    const qtdDias = diario.data?.length || 1;

    // TOTAL DO RANKING (para linha TOTAL no card)
    const rankingTotal = stats.bruto;


    return (
        <div style={containerFluid}>
            <header style={headerFluid}>
                <h1 style={titleFluid}>Performance Comercial Vetroresina</h1>
                <div style={tvBadge}>{periodo.de} - {periodo.ate}</div>
            </header>

            <div style={gridMain}>
                {/* RELATÓRIO ESQUERDA: NOVAS COLUNAS */}
                <div style={cardTableFull}>
                    <div style={tableHeader}>RELATÓRIO MENSAL CONSOLIDADO</div>
                    <div style={tableWrapperFull}>
                        <div style={headerGridTV}>
                            <span>Data</span><span>Qtd. Notas</span><span>Vlr. Bruto</span><span>Impostos</span><span>Frete</span><span>Vlr. Líquido</span>
                        </div>
                        <div style={tbodyFlex} ref={tableRef}>
                            {(diario.data || []).map((d, i) => {
                                const liquido = (d.valor_bruto || 0) - (d.impostos || 0) - (d.frete || 0);
                                return (
                                    <div key={i} data-index={i} style={i === activeIndex ? rowActiveGrid : (i % 2 === 0 ? rowEvenGrid : rowOddGrid)}>
                                        <span>{d.data}</span>
                                        <span style={{ textAlign: 'center' }}>{d.qtd_notas}</span>
                                        <span style={{ fontWeight: '700' }}>{formatCurrency(d.valor_bruto)}</span>
                                        <span>{formatCurrency(d.impostos)}</span>
                                        <span>{formatCurrency(d.frete)}</span>
                                        <span style={{ fontWeight: '800', color: '#10b981' }}>{formatCurrency(liquido)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div style={footerSummaryTV}>
                        <div style={summaryRowTV}>
                            <div style={sumLabel}>TOTAL:</div>
                            <div style={sumValCenter}>{stats.notas}</div>
                            <div style={sumVal}>{formatCurrency(stats.bruto)}</div>
                            <div style={sumVal}>{formatCurrency(stats.impostos)}</div>
                            <div style={sumVal}>{formatCurrency(stats.frete)}</div>
                            <div style={sumValHighlight}>{formatCurrency(stats.liquido)}</div>
                        </div>
                        <div style={summaryRowMediaTV}>
                            <div style={sumLabelMedia}>MÉDIA:</div>
                            <div style={sumValCenterMedia}>{(stats.notas / qtdDias).toFixed(1)}</div>
                            <div style={sumValMedia}>{formatCurrency(stats.bruto / qtdDias)}</div>
                            <div style={sumValMedia}>{formatCurrency(stats.impostos / qtdDias)}</div>
                            <div style={sumValMedia}>{formatCurrency(stats.frete / qtdDias)}</div>
                            <div style={sumValMedia}>{formatCurrency(stats.liquido / qtdDias)}</div>
                        </div>
                    </div>
                </div>

                <div style={sideMetrics}>
                    {/* TOP 10 CLIENTES ACUMULADO */}
                    <section style={cardMetricRankingTV}>
                        <div style={headerCard}>TOP 10 CLIENTES (FATURAMENTO NO PERÍODO)</div>

                        <div style={rankingWrapper}>
                            {(ranking || []).map((r, i) => (
                                <div key={i} style={i === ranking.length - 1 ? rankingRowLast : rankingRow}>
                                    {/* manter layout, mas mostrar nome completo (sem cortar) */}
                                    <span style={textFullTV}>{i + 1}. {r.cliente}</span>

                                    <span style={{ color: '#1f8a3b', fontWeight: '900' }}>
                                        {formatCurrency(r.valor)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* LINHA TOTAL (igual conceito do consolidado) */}
                        <div style={rankingTotalRow}>
                            <span style={rankingTotalLabel}>TOTAL:</span>
                            <span style={rankingTotalValue}>{formatCurrency(rankingTotal)}</span>
                        </div>
                    </section>

                    {/* PARTICIPAÇÃO % */}
                    <section style={cardMetricChartFull}>
                        <div style={headerCard}>PARTICIPAÇÃO % POR GRUPO</div>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={distribuicao}
                                    dataKey="valor"
                                    innerRadius="38%"
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
                                <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '5px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </section>
                </div>
            </div>
        </div>
    );
}

// --- ESTILOS FIXOS PARA EVITAR TELA EM BRANCO ---
const containerFluid = { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', padding: '10px', boxSizing: 'border-box', background: '#F1F5F9', overflow: 'hidden' };
const headerFluid = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 };
const titleFluid = { fontSize: '20px', fontWeight: '900', color: '#0F172A', margin: 0 };
const tvBadge = { background: '#FFF', padding: '5px 15px', borderRadius: '20px', fontSize: '12px', fontWeight: '800', color: '#64748B' };

const gridMain = { display: 'flex', flex: 1, gap: '10px', minHeight: 0 };
const cardTableFull = { flex: 2, display: 'flex', flexDirection: 'column', background: '#FFF', borderRadius: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden' };
const tableWrapperFull = { flex: 1, display: 'flex', flexDirection: 'column', padding: '0 10px' };

const gridTVConfig = "1.2fr 0.8fr 1.3fr 1.3fr 1fr 1.3fr";
const headerGridTV = { display: 'grid', gridTemplateColumns: gridTVConfig, padding: '10px 0', borderBottom: '1px solid #F1F5F9', fontSize: '11px', fontWeight: '800', color: '#64748B' };
const tbodyFlex = { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '5px 0' };

const rowBaseTV = { display: 'grid', gridTemplateColumns: gridTVConfig, alignItems: 'center', fontSize: '11px', flex: 1, padding: '2px 0' };
const rowActiveGrid = { ...rowBaseTV, background: '#EAF7ED', color: '#1f8a3b', transition: '0.5s', borderRadius: '4px' };
const rowEvenGrid = { ...rowBaseTV, background: '#FFF' };
const rowOddGrid = { ...rowBaseTV, background: '#F8FAFC' };

const footerSummaryTV = { background: '#0F172A', color: '#FFF', padding: '10px 10px', flexShrink: 0 };
const summaryRowTV = { display: 'grid', gridTemplateColumns: gridTVConfig, alignItems: 'center', marginBottom: '2px' };
const summaryRowMediaTV = { display: 'grid', gridTemplateColumns: gridTVConfig, alignItems: 'center', opacity: 0.8 };

const sumLabel = { fontSize: '11px', fontWeight: '900' };
const sumVal = { fontSize: '12px', fontWeight: '900' };
const sumValHighlight = { fontSize: '13px', fontWeight: '900', color: '#31B047' };
const sumValCenter = { textAlign: 'center', fontWeight: '900', fontSize: '12px' };
const sumLabelMedia = { fontSize: '9px', fontWeight: '700' };
const sumValMedia = { fontSize: '10px', fontWeight: '700' };
const sumValCenterMedia = { textAlign: 'center', fontWeight: '700', fontSize: '10px' };

const tableHeader = { padding: '10px', fontSize: '10px', fontWeight: '800', color: '#64748B', borderBottom: '1px solid #F1F5F9' };

const sideMetrics = { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' };
const cardMetricRankingTV = { flex: 1.3, background: '#FFF', borderRadius: '15px', padding: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };
const cardMetricChartFull = { flex: 1, background: '#FFF', borderRadius: '15px', padding: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' };

const headerCard = { fontSize: '9px', fontWeight: '900', color: '#64748B', marginBottom: '8px', textTransform: 'uppercase' };
const rankingWrapper = { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' };
const rankingRow = { display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0', borderBottom: '1px solid #F1F5F9' };
const rankingRowLast = { display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0', background: '#F8FAFC', fontWeight: '800' };

// mantém layout e largura, mas remove ellipsis para mostrar nome completo
const textFullTV = {
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',     // NÃO quebra linha
    overflow: 'hidden',
    textOverflow: 'ellipsis', // se passar, corta com ...
    fontWeight: '600',
    paddingRight: '10px'
};

// linha total (sem mexer no card/colunas, só adiciona no final)
const rankingTotalRow = { display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px', borderTop: '1px solid #F1F5F9' };
const rankingTotalLabel = { fontSize: '11px', fontWeight: '900', color: '#0F172A' };
const rankingTotalValue = { fontSize: '12px', fontWeight: '900', color: '#1f8a3b' };
