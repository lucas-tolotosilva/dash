import React, { useState } from "react";
import { api } from "../services/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const tabelasProtheus = [
  { id: "SF2", nome: "Faturamento - Saídas (SF2)" },
  { id: "SC5", nome: "Vendas - Cabeçalho (SC5)" },
  { id: "SD3", nome: "Movimentações de Estoque (SD3)" },
  { id: "SB2", nome: "Saldos de Estoque (SB2)" },
  { id: "SE1", nome: "Contas a Receber (SE1)" },
  { id: "SF1", nome: "Compras - Cabeçalho (SF1)" }
];

const formatarMes = (dateStr) => {
  if (!dateStr || dateStr.length < 6) return "N/A";
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return meses[parseInt(dateStr.substring(4, 6)) - 1] || "N/A";
};

export default function ReportBuilder({ onClose }) {
  const [step, setStep] = useState(1); // 1: Configuração, 2: Visualização
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  const [config, setConfig] = useState({ table: "SF2", type: "bar" });

  async function handleGerarRelatorio() {
    try {
      setLoading(true);
      const camposPadrao = {
        SF2: ["F2_EMISSAO", "F2_VALMERC"],
        SC5: ["C5_NUM", "C5_CLIENTE", "C5_EMISSAO"],
        SD3: ["D3_OP", "D3_COD", "D3_QUANT"],
        SB2: ["B2_COD", "B2_QATU", "B2_LOCAL"]
      };

      const res = await api.request("/api/dynamic-query", {
        method: "POST",
        body: JSON.stringify({
          tabela: config.table,
          campos_desejados: camposPadrao[config.table] || ["*"],
          where: config.table === "SF2" ? " AND F2_VALMERC > 0 " : ""
        })
      });

      if (res?.ok) {
        let dadosTratados = res.data;
        if (config.table === "SF2" && config.type === "bar") {
          const agrupado = res.data.reduce((acc, curr) => {
            const mes = formatarMes(curr.F2_EMISSAO);
            const valor = parseFloat(curr.F2_VALMERC || 0);
            if (!acc[mes]) acc[mes] = { name: mes, valor: 0 };
            acc[mes].valor += valor;
            return acc;
          }, {});
          const ordem = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          dadosTratados = Object.values(agrupado).sort((a, b) => ordem.indexOf(a.name) - ordem.indexOf(b.name));
        }
        setReportData(dadosTratados);
        setStep(2);
      }
    } catch (e) {
      alert("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={{ ...modalStyle, maxWidth: step === 2 ? "960px" : "540px" }}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* BOTÃO VOLTAR: Adicionado para permitir retorno à config */}
            {step === 2 && (
              <button onClick={() => setStep(1)} style={backButtonStyle} title="Voltar para configurações">
                ←
              </button>
            )}
            <div>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "800" }}>Report Builder</h2>
              <p style={{ margin: "4px 0 0 0", color: "#9A9FA5", fontSize: "13px" }}>
                {step === 1 ? "Configure seu relatório do Protheus" : `Resultados da tabela ${config.table}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={contentStyle}>
          {step === 1 ? (
            <>
              <div style={sectionStyle}>
                <label style={labelStyle}>1. Selecione a Origem de Dados (Tabela)</label>
                <select style={selectStyle} value={config.table} onChange={(e) => setConfig({ ...config, table: e.target.value })}>
                  {tabelasProtheus.map(tab => <option key={tab.id} value={tab.id}>{tab.nome}</option>)}
                </select>
              </div>
              <div style={sectionStyle}>
                <label style={labelStyle}>2. Formato de Exibição</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <button onClick={() => setConfig({...config, type: 'bar'})} style={typeButtonStyle(config.type === 'bar')}>📊 Gráfico</button>
                  <button onClick={() => setConfig({...config, type: 'table'})} style={typeButtonStyle(config.type === 'table')}>📋 Tabela</button>
                </div>
              </div>
              <div style={footerStyle}>
                <button onClick={onClose} style={cancelButtonStyle}>Cancelar</button>
                <button onClick={handleGerarRelatorio} disabled={loading} style={generateButtonStyle}>
                  {loading ? "Processando..." : "Gerar Relatório"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ maxHeight: "550px", overflowY: "auto" }}>
              {config.type === "bar" ? (
                <div style={{ height: "400px", width: "100%" }}>
                  <ResponsiveContainer>
                    <BarChart data={reportData} margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEFEF" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6F767E', fontSize: 12, fontWeight: 700 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} tick={{ fill: '#6F767E', fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#F4F4F4' }} formatter={(v) => [`R$ ${v.toLocaleString('pt-BR')}`, "Total"]} />
                      <Bar dataKey="valor" fill="#1f8a3b" radius={[6, 6, 0, 0]} barSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={tableContainerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ background: "#F8F9FB" }}>
                        {Object.keys(reportData[0] || {}).map(k => <th key={k} style={thStyle}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #EFEFEF" }}>
                          {Object.values(row).map((v, j) => <td key={j} style={tdStyle}>{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={alertStyle}>⚠️ ACESSO RESTRITO: CONSULTA DIRETA AO BANCO DE DADOS PROTHEUS</div>
      </div>
    </div>
  );
}

/* --- ESTILOS AJUSTADOS --- */
const backButtonStyle = { background: "#F4F4F4", border: "none", borderRadius: "12px", width: "40px", height: "40px", fontSize: "20px", cursor: "pointer", color: "#1A1D1F", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", transition: "0.2s" };
const overlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(26, 29, 31, 0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" };
const modalStyle = { background: "#FFFFFF", width: "100%", borderRadius: "24px", boxShadow: "0 20px 48px rgba(0,0,0,0.15)", overflow: "hidden", transition: "max-width 0.3s ease" };
const headerStyle = { padding: "32px", borderBottom: "1px solid #EFEFEF", display: "flex", justifyContent: "space-between", alignItems: "center" };
const closeButtonStyle = { background: "transparent", border: "none", fontSize: "20px", color: "#9A9FA5", cursor: "pointer", padding: "8px" };
const contentStyle = { padding: "32px" };
const sectionStyle = { marginBottom: "24px" };
const labelStyle = { display: "block", fontSize: "13px", fontWeight: "700", color: "#1A1D1F", marginBottom: "12px" };
const selectStyle = { width: "100%", padding: "14px", borderRadius: "12px", border: "2px solid #F4F4F4", background: "#F4F4F4", fontSize: "14px", fontWeight: "600", outline: "none" };
const typeButtonStyle = (active) => ({ padding: "14px", borderRadius: "12px", border: active ? "2px solid #1f8a3b" : "2px solid #F4F4F4", background: active ? "#EAF7ED" : "#FFFFFF", color: active ? "#1f8a3b" : "#6F767E", fontSize: "14px", fontWeight: "700", cursor: "pointer" });
const footerStyle = { display: "flex", gap: "12px", marginTop: "16px" };
const cancelButtonStyle = { flex: 1, padding: "14px", borderRadius: "12px", border: "2px solid #EFEFEF", background: "#FFFFFF", color: "#6F767E", fontWeight: "700", cursor: "pointer" };
const generateButtonStyle = { flex: 1, padding: "14px", borderRadius: "12px", border: "none", background: "#1f8a3b", color: "#FFFFFF", fontWeight: "700", cursor: "pointer" };
const alertStyle = { background: "rgba(217, 45, 32, 0.05)", padding: "16px", textAlign: "center", color: "#D92D20", fontSize: "11px", fontWeight: "700" };
const tableContainerStyle = { border: "1px solid #EFEFEF", borderRadius: "12px", overflow: "hidden" };
const tableStyle = { width: "100%", borderCollapse: "collapse", fontSize: "12px" };
const thStyle = { textAlign: "left", padding: "12px", borderBottom: "1px solid #EFEFEF", color: "#1A1D1F" };
const tdStyle = { padding: "12px", color: "#6F767E" };