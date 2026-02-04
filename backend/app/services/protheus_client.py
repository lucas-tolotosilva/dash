import httpx
from app.core.settings import settings


class ProtheusClient:
    def __init__(self):
        self.url = settings.protheus_consbanco_url
        self.timeout = settings.protheus_timeout_seconds

        self.basic_user = settings.protheus_basic_user or ""
        self.basic_pass = settings.protheus_basic_pass or ""
        self.token = settings.protheus_token or ""

        if not self.url:
            raise RuntimeError("PROTHEUS_CONSBANCO_URL não configurada no .env")

    def _normalize_url(self, url: str) -> str:
        # Alguns endpoints do Protheus não gostam da barra final
        return url[:-1] if url.endswith("/") else url

    def _headers(self) -> dict:
        h = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def _auth(self):
        if self.basic_user and self.basic_pass:
            return httpx.BasicAuth(self.basic_user, self.basic_pass)
        return None

    # app/services/protheus_client.py

async def consbanco(self, tabela: str, campos_desejados: list, where: str = "") -> dict:
    payload = {
        "tabela": tabela,
        "campos_desejados": campos_desejados,
        "where": where or ""
    }
    
    # Validação de Endpoint: Normaliza removendo a barra final para evitar //consbanco [cite: 284, 286, 302]
    url = self._normalize_url(self.url)
    
    async with httpx.AsyncClient(timeout=self.timeout) as client:
        try:
            # 1) Tentativa via POST [cite: 305]
            resp = await client.post(url, json=payload, headers=self._headers(), auth=self._auth())
            
            # 2) Fallback para GET com body se 501 (comum em algumas builds do Protheus) [cite: 307, 308]
            if resp.status_code == 501:
                resp = await client.request("GET", url, json=payload, headers=self._headers(), auth=self._auth())

            # Se retornar erro (4xx ou 5xx), capturamos o texto bruto para diagnóstico 
            if resp.is_error:
                error_detail = resp.text  # Aqui pegamos se é erro de Alias ou Auth 
                raise HTTPException(
                    status_code=resp.status_code, 
                    detail=f"Erro Protheus: {error_detail}"
                )

            return resp.json() [cite: 310]
            
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Erro de conexão: {exc}")
