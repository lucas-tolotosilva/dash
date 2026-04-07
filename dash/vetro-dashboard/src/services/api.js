const BASE_URL = "http://192.168.0.199:8000";

async function request(path, options = {}) {
  const r = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers 
    },
  });

  if (!r.ok) {
    throw new Error(`Erro na API: ${r.status}`);
  }

  return r.json();
}

export const api = {
  request,
  health: () => request("/health"),
  summary: () => request("/dashboard/summary"),
  // Função para o BI dinâmico (Ordem #024)
  dynamicQuery: (payload) => request("/api/dynamic-query", {
    method: "POST",
    body: JSON.stringify(payload)
  })
};