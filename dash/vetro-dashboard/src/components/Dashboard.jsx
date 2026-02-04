import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { api } from "../services/api";

function formatMoneyBRL(value) {
  if (typeof value !== "number") return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Dashboard() {
  const [apiStatus, setApiStatus] = useState({ loading: true, ok: false });
  const [summary, setSummary] = useState(null);
  const [ops, setOps] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setError("");

        // 1) health/ping
        await api.health();
        if (!alive) return;
        setApiStatus({ loading: false, ok: true });

        // 2) dados principais
        const [s, o, p] = await Promise.all([
          api.summary(),
          api.ops({ page: 1, page_size: 5 }),
          api.pedidosVenda({ page: 1, page_size: 5 }),
        ]);

        if (!alive) return;

        setSummary(s?.data || null);
        setOps(o?.data?.items || []);
        setPedidos(p?.data?.items || []);
      } catch (e) {
        if (!alive) return;
        setApiStatus({ loading: false, ok: false });
        setError(e?.message || "Erro ao carregar dados");
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  const kpis = summary?.kpis ?? summary;

  return (
    <div className="container">
      <header className="topbar">
        <div className="brand">
          <div className="logoMark" aria-hidden="true">VR</div>
          <div className="brandTitle">
            <strong>Vetroresina • Dashboard</strong>
            <span>Frontend para API Protheus (primeira versão)</span>
          </div>
        </div>

        <div className="actions">
          <div className="pill" title="Status de conexão com API">
            <span
              className="dot"
              style={{
                background: apiStatus.loading ? "#aab3b9" : (apiStatus.ok ? "var(--green)" : "var(--red)"),
                boxShadow: apiStatus.ok
                  ? "0 0 0 4px rgba(31,138,59,0.12)"
                  : "0 0 0 4px rgba(217,45,32,0.12)",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              API: {apiStatus.loading ? "verificando..." : (apiStatus.ok ? "conectado" : "falhou")}
            </span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="card" style={{ borderColor: "rgba(217,45,32,0.35)", background: "rgba(217,45,32,0.06)" }}>
          <strong>Erro ao carregar</strong>
          <div className="cardBody" style={{ color: "var(--text)" }}>{error}</div>
        </div>
      ) : null}

      <main className="grid">
        {/* KPIs (troca o texto pelos números reais) */}
        <section className="card col-12">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Resumo</strong>
              <span>KPIs principais do dia</span>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 0 }}>
            <section className="card col-4">
              <div className="cardTitle">
                <strong>Pedidos abertos</strong>
                <span>Comercial</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.pedidos_abertos ?? "-"}
              </div>
            </section>

            <section className="card col-4">
              <div className="cardTitle">
                <strong>OPs ativas</strong>
                <span>Produção</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.ops_ativas ?? "-"}
              </div>
            </section>

            <section className="card col-4">
              <div className="cardTitle">
                <strong>Bobinas disponíveis</strong>
                <span>Estoque</span>
              </div>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 800 }}>
                {kpis?.bobinas_disponiveis ?? "-"}
              </div>
            </section>
          </div>
        </section>



        {/* Lista rápida de OPs */}
        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Últimas OPs</strong>
              <span>Top 5 (exemplo)</span>
            </div>
            <div className="badge">Produção</div>
          </div>

          <div className="cardBody" style={{ paddingTop: 4 }}>
            {ops.length === 0 ? (
              <span>Nenhuma OP encontrada.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ops.map((x) => (
                  <div key={x.op} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{x.op}</strong>{" "}
                      <span style={{ color: "var(--muted)" }}> • {x.produto_nome || x.cod}</span>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        Lote: {x.lote} • End.: {x.endereco}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 120 }}>
                      <div style={{ fontWeight: 700 }}>{x.status}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        Qtde: {x.quantidade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Lista rápida de Pedidos */}
        <section className="card col-6">
          <div className="cardHeader">
            <div className="cardTitle">
              <strong>Últimos Pedidos</strong>
              <span>Top 5 (exemplo)</span>
            </div>
            <div className="badge">Comercial</div>
          </div>

          <div className="cardBody" style={{ paddingTop: 4 }}>
            {pedidos.length === 0 ? (
              <span>Nenhum pedido encontrado.</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pedidos.map((p) => (
                  <div key={p.pedido} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{p.pedido}</strong>{" "}
                      <span>Cliente: {p.cliente_nome || p.cliente_cod}</span>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        <span>Pedido: {p.numero}</span> <span>Produto: {p.produto}</span> <span>Qtde: {p.quantidade}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 140 }}>
                      <div style={{ fontWeight: 700 }}>{p.status}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {formatMoneyBRL(p.valor_total)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
