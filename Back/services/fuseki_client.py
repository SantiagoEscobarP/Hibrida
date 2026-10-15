import os
import httpx
from fastapi import HTTPException
from core.config import settings


class FusekiClient:
    def __init__(self):
        query_url = getattr(
            settings,
            "SPARQL_QUERY_ENDPOINT",
            "http://localhost:3030/noticias_op/query",
        )
        update_url = getattr(
            settings,
            "SPARQL_UPDATE_ENDPOINT",
            "http://localhost:3030/noticias_op/update",
        )

        # Si el backend está corriendo dentro de Docker, cambiar localhost por host.docker.internal
        if os.path.exists("/.dockerenv"):
            query_url = query_url.replace("localhost:3030", "host.docker.internal:3030").replace(
                "127.0.0.1:3030", "host.docker.internal:3030"
            )
            update_url = update_url.replace("localhost:3030", "host.docker.internal:3030").replace(
                "127.0.0.1:3030", "host.docker.internal:3030"
            )

        self.query_url = query_url
        self.update_url = update_url

        user = getattr(settings, "FUSEKI_USER", None)
        password = getattr(settings, "FUSEKI_PASSWORD", None)
        self.auth = (user, password) if user and password else None

        print(f"✅ FusekiClient conectado a: {self.query_url}")

    async def execute_query(self, sparql_query: str) -> dict:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Accept": "application/sparql-results+json"}
            response = await client.post(
                self.query_url,
                data={"query": sparql_query},
                headers=headers,
                auth=self.auth,
            )
            if response.status_code != 200:
                print("Error Fuseki Query:", response.text)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Fuseki Query Error: {response.text}",
                )
            return response.json()

    async def execute_update(self, sparql_update: str):
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Content-Type": "application/sparql-update"}
            response = await client.post(
                self.update_url,
                content=sparql_update.encode("utf-8"),
                headers=headers,
                auth=self.auth,
            )
            if response.status_code not in (200, 204):
                print("=== SPARQL QUE FALLÓ ===")
                print(sparql_update)
                print("=== RESPUESTA ERROR FUSEKI ===")
                print(response.text)
                raise HTTPException(
                    status_code=400,
                    detail=f"Fuseki SPARQL Error: {response.text}",
                )
            return {"status": "success"}


fuseki_client = FusekiClient()