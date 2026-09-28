import os
import re
from datetime import date
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from SPARQLWrapper import SPARQLWrapper, JSON, POST
from motor.motor_asyncio import AsyncIOMotorClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
FUSEKI_QUERY_URL = os.getenv("FUSEKI_QUERY_URL", "http://localhost:3030/orden_publico/query")
FUSEKI_UPDATE_URL = os.getenv("FUSEKI_UPDATE_URL", "http://localhost:3030/orden_publico/update")

mongo_client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = mongo_client["prensa_db"]

# Cliente SPARQL de lectura
sparql_read = SPARQLWrapper(FUSEKI_QUERY_URL)
sparql_read.setReturnFormat(JSON)

# Cliente SPARQL de escritura
sparql_write = SPARQLWrapper(FUSEKI_UPDATE_URL)
sparql_write.setMethod(POST)

# --- MODELOS PYDANTIC ---
class NuevaNoticiaEventoRequest(BaseModel):
    # Datos de la Noticia (MongoDB)
    titulo: str
    medio: str
    cuerpo: str
    
    # Datos del Evento (Fuseki)
    titulo_evento: str
    fecha_evento: str  # YYYY-MM-DD
    municipio: str
    departamento: str
    organizacion_uri: str  # URI de la estructura armada seleccionada

def slugify(text: str) -> str:
    """Convierte texto en un identificador limpio para la URI semántica."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[\s_-]+', '-', text)[:40]

# --- 1. ENDPOINT PARA OBTENER ORGANIZACIONES DE FUSEKI ---
@app.get("/api/organizaciones")
def get_organizaciones():
    """Trae las organizaciones armadas existentes para mostrarlas en un select en React."""
    query = """
    PREFIX ex: <http://example.org/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?uri ?nombre
    WHERE {
        ?uri a ex:OrganizacionArmada ;
             rdfs:label ?nombre .
    }
    """
    sparql_read.setQuery(query)
    try:
        results = sparql_read.query().convert()
        bindings = results["results"]["bindings"]
        return [
            {"uri": b["uri"]["value"], "nombre": b["nombre"]["value"]}
            for b in bindings
        ]
    except Exception as e:
        print(f"Error consultando organizaciones: {e}")
        return []

# --- 2. ENDPOINT TRANSACCIONAL HÍBRIDO (FUSEKI + MONGO) ---
@app.post("/api/noticias-con-evento")
async def crear_noticia_con_evento(payload: NuevaNoticiaEventoRequest):
    # Generar URI única para el nuevo evento en Fuseki
    event_slug = f"{slugify(payload.municipio)}-{payload.fecha_evento}-{slugify(payload.titulo_evento)}"
    nueva_evento_uri = f"http://example.org/{event_slug}"

    # 1. Insertar el evento en Apache Jena Fuseki mediante SPARQL UPDATE
    sparql_insert = f"""
    PREFIX ex: <http://example.org/>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {{
        <{nueva_evento_uri}> rdf:type ex:EventoOrdenPublico ;
            rdfs:label "{payload.titulo_evento}" ;
            ex:fecha "{payload.fecha_evento}"^^xsd:date ;
            ex:municipio "{payload.municipio}" ;
            ex:departamento "{payload.departamento}" ;
            ex:perpetradoPor <{payload.organizacion_uri}> .
    }}
    """
    
    try:
        sparql_write.setQuery(sparql_insert)
        sparql_write.query()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fallo al registrar evento en Jena Fuseki: {str(e)}"
        )

    # 2. Insertar la noticia en MongoDB guardando la URI semántica generada
    noticia_doc = {
        "titulo": payload.titulo,
        "medio": payload.medio,
        "cuerpo": payload.cuerpo,
        "fecha_creacion": payload.fecha_evento,
        "uri_eventos": [nueva_evento_uri]  # <- Enlace semántico directo
    }

    try:
        result = await db.noticias.insert_one(noticia_doc)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Fallo al guardar noticia en MongoDB: {str(e)}"
        )

    return {
        "status": "success",
        "mensaje": "Evento creado en Fuseki y Noticia enlazada en MongoDB",
        "mongo_id": str(result.inserted_id),
        "fuseki_evento_uri": nueva_evento_uri
    }