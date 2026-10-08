import httpx
from core.config import settings

class FusekiClient:
    def __init__(self):
        self.query_url = settings.SPARQL_QUERY_ENDPOINT
        self.update_url = settings.SPARQL_UPDATE_ENDPOINT
        self.auth = (settings.FUSEKI_USER, settings.FUSEKI_PASSWORD)

    async def execute_query(self, sparql_query: str) -> dict:
        """Ejecuta consultas SPARQL SELECT / ASK y retorna JSON estándar."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Accept": "application/sparql-results+json"}
            response = await client.post(
                self.query_url,
                data={"query": sparql_query},
                headers=headers,
                auth=self.auth
            )
            response.raise_for_status()
            return response.json()

    async def execute_update(self, sparql_update: str):
        """Ejecuta operaciones SPARQL Update (INSERT DATA, DELETE DATA)."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            headers = {"Content-Type": "application/sparql-update"}
            response = await client.post(
                self.update_url,
                content=sparql_update.encode("utf-8"),
                headers=headers,
                auth=self.auth
            )
            response.raise_for_status()
            return {"status": "success"}

fuseki_client = FusekiClient()