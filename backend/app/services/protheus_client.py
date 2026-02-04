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

    async def consbanco(self, tabela: str, campos_desejados: list, where: str = "") -> dict:
        payload = {
            "tabela": tabela,
            "campos_desejados": campos_desejados,
            "where": where or ""
        }
        url = self._normalize_url(self.url)
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # 1) Tenta POST
                resp = await client.post(url, json=payload, headers=self._headers(), auth=self._auth())
                
                # 2) Se Protheus responder 501, tenta GET com body
                if resp.status_code == 501:
                    resp = await client.request("GET", url, json=payload, headers=self._headers(), auth=self._auth())
                
                # LOG DE APOIO: Se o Protheus rejeitar (401, 404, 500), imprime o motivo real no terminal
                if resp.status_code >= 400:
                    print(f"\n--- ERRO NA RESPOSTA DO PROTHEUS ---")
                    print(f"Status: {resp.status_code}")
                    print(f"Detalhe: {resp.text}")
                    print(f"------------------------------------\n")
                
                resp.raise_for_status()
                return resp.json()
                
            except httpx.HTTPStatusError as e:
                # Repassa o erro detalhado para o frontend poder exibir
                error_detail = e.response.text if e.response else str(e)
                raise RuntimeError(f"Protheus Error: {error_detail}")