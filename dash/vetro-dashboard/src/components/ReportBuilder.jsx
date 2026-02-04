import React, { useState } from "react";

const tabelasProtheus = [
  { id: "SC5", nome: "Vendas - Cabeçalho (SC5)" },
  { id: "SC6", nome: "Vendas - Itens (SC6)" },
  { id: "SF1", nome: "Compras - Cabeçalho (SF1)" },
  { id: "SD1", nome: "Compras - Itens (SD1)" },
  { id: "SC2", nome: "Ordens de Produção (SC2)" },
  { id: "SD3", nome: "Movimentações de Estoque (SD3)" },
  { id: "SE1", nome: "Contas a Receber (SE1)" },
  { id: "SE2", nome: "Contas a Pagar (SE2)" },
  { id: "FK2", nome: "Baixas a Pagar (FK2)" },
  { id: "FK3", nome: "Identificação de Movimentos (FK3)" },
  { id: "FK4", nome: "Movimentos Bancários (FK4)" },
  { id: "SE5", nome: "Movimentação Bancária (SE5)" },
  { id: "FK5", nome: "Dados de Baixas (FK5)" },
  { id: "FK6", nome: "Baixas a Receber (FK6)" },
  { id: "FI7", nome: "Dados de Cobrança (FI7)" },
  { id: "SB2", nome: "Saldos de Estoque (SB2)" }
];

export default function ReportBuilder({ onClose }) {
  const [config, setConfig] = useState({
    table: "SC5",
    type: "bar",
    fields: []
  });

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header do Builder */}
        <div style={headerStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "800", letterSpacing: "-0.5px" }}>
              Report Builder
            </h2>
            <p style={{ margin: "4px 0 0 0", color: "#9A9FA5", fontSize: "13px", fontWeight: "500" }}>
              Configure seu relatório customizado do Protheus
            </p>
          </div>
          <button onClick={onClose} style={closeButtonStyle}>✕</button>
        </div>

        <div style={contentStyle}>
          {/* 1. Seleção de Tabela */}
          <div style={sectionStyle}>
            <label style={labelStyle}>1. Selecione a Origem de Dados (Tabela)</label>
            <select 
              style={selectStyle}
              value={config.table}
              onChange={(e) => setConfig({ ...config, table: e.target.value })}
            >
              {tabelasProtheus.map(tab => (
                <option key={tab.id} value={tab.id}>{tab.nome}</option>
              ))}
            </select>
          </div>

          {/* 2. Tipo de Gráfico */}
          <div style={sectionStyle}>
            <label style={labelStyle}>2. Formato de Exibição</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <button 
                onClick={() => setConfig({...config, type: 'bar'})}
                style={typeButtonStyle(config.type === 'bar')}
              >
                📊 Gráfico de Barras
              </button>
              <button 
                onClick={() => setConfig({...config, type: 'table'})}
                style={typeButtonStyle(config.type === 'table')}
              >
                📋 Tabela de Dados
              </button>
            </div>
          </div>

          {/* 3. Footer de Ações */}
          <div style={footerStyle}>
            <button onClick={onClose} style={cancelButtonStyle}>
              Cancelar
            </button>
            <button style={generateButtonStyle}>
              Gerar Relatório
            </button>
          </div>
        </div>

        {/* Alerta de Segurança (Vermelho Itália) */}
        <div style={alertStyle}>
          <span style={{ fontSize: "14px" }}>⚠️</span>
          <span style={{ fontSize: "11px", fontWeight: "700" }}>
            ACESSO RESTRITO: CONSULTA DIRETA AO BANCO DE DADOS PROTHEUS
          </span>
        </div>
      </div>
    </div>
  );
}

/* --- ESTILOS SPHERULE CLEAN --- */

const overlayStyle = {
  position: "fixed",
  top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(26, 29, 31, 0.4)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "20px"
};

const modalStyle = {
  background: "#FFFFFF",
  width: "100%",
  maxWidth: "540px",
  borderRadius: "24px",
  boxShadow: "0 20px 48px rgba(0,0,0,0.15)",
  overflow: "hidden",
  fontFamily: "'Plus Jakarta Sans', sans-serif"
};

const headerStyle = {
  padding: "32px",
  borderBottom: "1px solid #EFEFEF",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const closeButtonStyle = {
  background: "transparent",
  border: "none",
  fontSize: "20px",
  color: "#9A9FA5",
  cursor: "pointer",
  padding: "8px"
};

const contentStyle = {
  padding: "32px"
};

const sectionStyle = {
  marginBottom: "24px"
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: "700",
  color: "#1A1D1F",
  marginBottom: "12px"
};

const selectStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "2px solid #F4F4F4",
  background: "#F4F4F4",
  fontSize: "14px",
  fontWeight: "600",
  color: "#1A1D1F",
  outline: "none",
  cursor: "pointer"
};

const typeButtonStyle = (active) => ({
  padding: "14px",
  borderRadius: "12px",
  border: active ? "2px solid #1f8a3b" : "2px solid #F4F4F4",
  background: active ? "#EAF7ED" : "#FFFFFF",
  color: active ? "#1f8a3b" : "#6F767E",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "all 0.2s ease"
});

const footerStyle = {
  display: "flex",
  gap: "12px",
  marginTop: "16px"
};

const cancelButtonStyle = {
  flex: 1,
  padding: "14px",
  borderRadius: "12px",
  border: "2px solid #EFEFEF",
  background: "#FFFFFF",
  color: "#6F767E",
  fontWeight: "700",
  cursor: "pointer"
};

const generateButtonStyle = {
  flex: 1,
  padding: "14px",
  borderRadius: "12px",
  border: "none",
  background: "#1f8a3b",
  color: "#FFFFFF",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(31, 138, 59, 0.2)"
};

const alertStyle = {
  background: "rgba(217, 45, 32, 0.05)",
  padding: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  color: "#D92D20", // Vermelho Itália / Alerta
  borderTop: "1px solid rgba(217, 45, 32, 0.1)"
};