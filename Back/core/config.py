import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    KEYCLOAK_URL: str = os.getenv("KEYCLOAK_URL", "http://localhost:8080")
    REALM_NAME: str = os.getenv("KEYCLOAK_REALM", "noticias-realm")
    CLIENT_ID: str = os.getenv("KEYCLOAK_CLIENT_ID", "noticias-backend")
    
    # Apache Jena Fuseki
    FUSEKI_HOST: str = os.getenv("FUSEKI_HOST", "http://localhost:3030")
    FUSEKI_DATASET: str = os.getenv("FUSEKI_DATASET", "noticias_op")
    FUSEKI_USER: str = os.getenv("FUSEKI_USER", "admin")
    FUSEKI_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "FusekiAdminSecure2026!")

    @property
    def ISSUER_URL(self) -> str:
        return f"{self.KEYCLOAK_URL}/realms/{self.REALM_NAME}"
    
    @property
    def JWKS_URI(self) -> str:
        return f"{self.ISSUER_URL}/protocol/openid-connect/certs"

    @property
    def SPARQL_QUERY_ENDPOINT(self) -> str:
        return f"{self.FUSEKI_HOST}/{self.FUSEKI_DATASET}/sparql"

    @property
    def SPARQL_UPDATE_ENDPOINT(self) -> str:
        return f"{self.FUSEKI_HOST}/{self.FUSEKI_DATASET}/update"

settings = Settings()