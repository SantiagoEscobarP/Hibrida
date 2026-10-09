import httpx
from fastapi import HTTPException
from core.config import settings

class FusekiClient:
    def __init__(self):
        self.query_url = settings.SPARQL_QUERY_ENDPOINT
        self.update_url = settings.SPARQL_UPDATE_ENDPOINT
        self.auth = (settings.FUSEKI_USER, settings.FUSEKI_PASSWORD)

    async def execute_query(self, sparql_query: str) -> dict:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Accept": "application/sparql-results+json"}
            response = await client.post(
                self.query_url,
                data={"query": sparql_query},
                headers=headers,
                auth=self.auth
            )
            if response.status_code != 200:
                print("Error Fuseki Query:", response.text)
                raise HTTPException(status_code=response.status_code, detail=f"Fuseki Query Error: {response.text}")
            return response.json()

    async def execute_update(self, sparql_update: str):
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Content-Type": "application/sparql-update"}
            response = await client.post(
                self.update_url,
                content=sparql_update.encode("utf-8"),
                headers=headers,
                auth=self.auth
            )
            if response.status_code not in (200, 204):
                # Imprimir el SPARQL enviado y la respuesta de Fuseki en la consola de Uvicorn
                print("=== SPARQL QUE FALLÓ ===")
                print(sparql_update)
                print("=== RESPUESTA ERROR FUSEKI ===")
                print(response.text)
                raise HTTPException(status_code=400, detail=f"Fuseki SPARQL Error: {response.text}")
            return {"status": "success"}

fuseki_client = FusekiClient()