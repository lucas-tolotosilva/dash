const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path) {
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} em ${path} :: ${text}`);
  }

  return r.json();
}

export const api = {
  health: () => request("/health"),
  summary: () => request("/dashboard/summary"),
  ops: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/ops${qs ? `?${qs}` : ""}`);
  },
  pedidosVenda: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/pedidos-venda${qs ? `?${qs}` : ""}`);
  },
};
