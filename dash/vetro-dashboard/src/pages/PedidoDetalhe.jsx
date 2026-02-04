import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function PedidoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadPedido() {
      try {
        setLoading(true);
        // Utiliza a rota de pedidos-venda passando o número como filtro
        const response = await api.pedidosVenda({ num: id });
        const dados = response?.data?.items?.find(p => p.numero === id);
        
        if (dados) {
          setPedido(dados);
        } else {
          setError("Pedido não encontrado na base Protheus.");
        }
      } catch (e) {
        setError("Erro ao carregar detalhes do pedido.");
      } finally {
        setLoading(false);
      }
    }
    loadPedido();
  }, [id]);

  return (
    <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* Topbar Fixa - Padrão OS #011 */}
      <header className="topbar" style={{ flexShrink: 0, padding: '16px 20px' }}>
        <div className="brand">
          <div className="logoMark" style={{ cursor: 'pointer' }} onClick={() => navigate("/")}>VR</div>
          <div className="brandTitle">
            <strong>Vetroresina • Detalhes do Pedido</strong>
            <span style={{ fontSize: 10, display: 'block', opacity: 0.7 }}>Visualizando: {id}</span>
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
        
        {loading && <div className="card col-12">Carregando dados do ERP...</div>}
        
        {error && (
          <div className="card col-12" style={{ borderColor: "var(--red)", background: "rgba(217,45,32,0.06)" }}>
            <div style={{ color: "var(--red)" }}>⚠️ {error}</div>
          </div>
        )}

        {pedido && (
          <>
            {/* Cabeçalho do Pedido (SC5) */}
            <section className="card col-12">
              <div className="cardHeader">
                <div className="cardTitle">
                  <strong>Informações Gerais</strong>
                  <span>Dados extraídos do cabeçalho (SC5)</span>
                </div>
              </div>
              <div className="grid">
                <div className="col-4">
                  <small style={{ color: "var(--muted)" }}>Cliente</small>
                  <div style={{ fontWeight: 600 }}>{pedido.cliente_nome || pedido.cliente_cod}</div>
                </div>
                <div className="col-4">
                  <small style={{ color: "var(--muted)" }}>Emissão</small>
                  <div style={{ fontWeight: 600 }}>{pedido.emissao}</div>
                </div>
                <div className="col-4">
                  <small style={{ color: "var(--muted)" }}>Loja</small>
                  <div style={{ fontWeight: 600 }}>{pedido.loja || "01"}</div>
                </div>
              </div>
            </section>

            {/* Itens do Pedido (SC6) */}
            <section className="card col-12" style={{ marginTop: '20px' }}>
              <div className="cardHeader">
                <div className="cardTitle">
                  <strong>Itens e Produtos</strong>
                  <span>Detalhamento da venda (SC6)</span>
                </div>
              </div>
              <div className="list-item" style={{ padding: "16px", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{pedido.produto}</strong>
                    <span style={{ color: "var(--muted)", marginLeft: '8px' }}>• {pedido.produto_nome}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '18px' }}>
                    Qtd: {pedido.quantidade}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}