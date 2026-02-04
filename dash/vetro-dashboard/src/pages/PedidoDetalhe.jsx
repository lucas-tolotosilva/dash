import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function PedidoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedidoData, setPedidoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    async function loadPedido() {
      try {
        setLoading(true);
        setError("");
        
        // Chamada para o endpoint de detalhe específico do backend 
        const response = await api.request(`/pedidos-venda/${id}`);
        
        if (!alive) return;

        if (response?.ok && response?.data) {
          setPedidoData(response.data);
        } else {
          setError("Pedido não encontrado ou dados inválidos no Protheus.");
        }
      } catch (e) {
        if (alive) setError("Erro ao conectar com a API Protheus.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadPedido();
    return () => { alive = false; };
  }, [id]);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* Topbar Fixa - Mantendo Identidade da Ordem #011 */}
      <header className="topbar" style={{ flexShrink: 0, padding: '16px 20px' }}>
        <div className="brand">
          <div className="logoMark" style={{ cursor: 'pointer' }} onClick={() => navigate("/")}>VR</div>
          <div className="brandTitle">
            <strong>Vetroresina • Detalhes do Pedido</strong>
            <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>Nº {id}</span>
          </div>
        </div>
        <div className="actions">
          <button className="btn btnPrimary" onClick={() => navigate("/")} style={{ cursor: 'pointer' }}>
            Voltar ao Dashboard
          </button>
        </div>
      </header>

      {/* Área de Conteúdo com Scroll Interno */}
      <main className="grid" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        
        {loading && <div className="card col-12">Carregando informações do ERP...</div>}
        
        {error && (
          <div className="card col-12" style={{ borderColor: "var(--red)", background: "rgba(217,45,32,0.06)" }}>
            <div style={{ color: "var(--red)" }}>⚠️ {error}</div>
          </div>
        )}

        {pedidoData && (
          <>
            {/* 1. Renderiza dados do data.header (Informações do Cliente/SC5)  */}
            <section className="card col-12" style={{ marginBottom: '24px' }}>
              <div className="cardHeader">
                <div className="cardTitle">
                  <strong>Informações do Cliente</strong>
                  <span>Dados extraídos do cabeçalho Protheus</span>
                </div>
              </div>
              <div className="grid" style={{ marginTop: '10px' }}>
                <div className="col-4">
                  <small style={{ color: "var(--muted)", display: 'block' }}>Código Cliente</small>
                  <strong>{pedidoData.header.C5_CLIENTE}</strong>
                </div>
                <div className="col-4">
                  <small style={{ color: "var(--muted)", display: 'block' }}>Data Emissão</small>
                  <strong>{pedidoData.header.C5_EMISSAO}</strong>
                </div>
                <div className="col-4">
                  <small style={{ color: "var(--muted)", display: 'block' }}>Cond. Pagamento</small>
                  <strong>{pedidoData.header.C5_CONDPAG || "-"}</strong>
                </div>
              </div>
            </section>

            {/* 2. Percorre data.items (Produtos vendidos/SC6)  */}
            <section className="card col-12">
              <div className="cardHeader">
                <div className="cardTitle">
                  <strong>Itens do Pedido</strong>
                  <span>Tabela detalhada de produtos</span>
                </div>
              </div>
              <div className="cardBody" style={{ padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ background: 'rgba(0,0,0,0.02)', fontSize: '12px', color: 'var(--muted)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Cod. Produto</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Qtd. Vendida</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Vlr. Unitário</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidoData.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={{ padding: '12px 16px' }}><strong>{item.C6_PRODUTO}</strong></td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{item.C6_QTDVEN}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{item.C6_PRCVUNIT}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{item.C6_VALOR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}