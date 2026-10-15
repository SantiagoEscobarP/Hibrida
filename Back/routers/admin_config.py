import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.fuseki_client import fuseki_client

router = APIRouter(prefix="/api", tags=["Administración Config"])

GRAPH_CONFIG = "http://proyecto-noticias.org/graph/config"
BASE_CONFIG = "http://proyecto-noticias.org/config"


def format_literal(text: str) -> str:
    if not text:
        return '""'
    escaped = str(text).replace("\\", "\\\\").replace('"', '\\"')
    return f'"""{escaped}"""'


class FuenteModel(BaseModel):
    nombre: str
    url: str
    tipo: str = "rss"
    activo: Optional[bool] = True


class ListaNegraModel(BaseModel):
    palabra: str
    activo: Optional[bool] = True


# ==========================================
# 1. GESTIÓN DE FUENTES
# ==========================================
@router.get("/fuentes")
async def listar_fuentes():
    sparql = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?uri ?nombre ?url ?tipo ?activo ?fecha
    WHERE {{
        GRAPH <{GRAPH_CONFIG}> {{
            ?uri a core:FuenteInfo ;
                 core:nombreFuente ?nombre ;
                 core:urlFuente ?url ;
                 core:tipoFuente ?tipo ;
                 core:activoFuente ?activo ;
                 schema:dateCreated ?fecha .
        }}
    }}
    ORDER BY ?nombre
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    fuentes = []
    for b in bindings:
        uri = b["uri"]["value"]
        id_sufijo = uri.split("/")[-1]
        activo_val = b["activo"]["value"].lower() in ("true", "1")
        fuentes.append({
            "_id": id_sufijo,
            "id": id_sufijo,
            "nombre": b["nombre"]["value"],
            "url": b["url"]["value"],
            "tipo": b["tipo"]["value"],
            "activo": activo_val,
            "fecha_creacion": b["fecha"]["value"]
        })
    return fuentes


@router.post("/fuentes")
async def crear_fuente(data: FuenteModel):
    id_sufijo = f"fuente_{uuid.uuid4().hex[:8]}"
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    ahora = datetime.utcnow().isoformat()
    activo_str = "true" if data.activo else "false"

    cuerpo = f"""
    <{uri}> a <http://proyecto-noticias.org/core#FuenteInfo> ;
            <http://proyecto-noticias.org/core#nombreFuente> {format_literal(data.nombre)} ;
            <http://proyecto-noticias.org/core#urlFuente> {format_literal(data.url)} ;
            <http://proyecto-noticias.org/core#tipoFuente> {format_literal(data.tipo)} ;
            <http://proyecto-noticias.org/core#activoFuente> "{activo_str}"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
            <http://schema.org/dateCreated> "{ahora}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    """
    sparql_update = f"INSERT DATA {{ GRAPH <{GRAPH_CONFIG}> {{ {cuerpo} }} }}"
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Fuente creada exitosamente", "id": id_sufijo}


@router.patch("/fuentes/{id_sufijo}/estado")
async def cambiar_estado_fuente(id_sufijo: str):
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    sparql_get = f"SELECT ?activo WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoFuente> ?activo . }} }}"
    res = await fuseki_client.execute_query(sparql_get)
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        raise HTTPException(status_code=404, detail="Fuente no encontrada")

    actual = bindings[0]["activo"]["value"].lower() in ("true", "1")
    nuevo = "false" if actual else "true"

    sparql_update = f"""
    DELETE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoFuente> ?old . }} }}
    INSERT {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoFuente> "{nuevo}"^^<http://www.w3.org/2001/XMLSchema#boolean> . }} }}
    WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoFuente> ?old . }} }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Estado actualizado", "activo": (nuevo == "true")}


@router.delete("/fuentes/{id_sufijo}")
async def eliminar_fuente(id_sufijo: str):
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    sparql_update = f"DELETE WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> ?p ?o . }} }}"
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Fuente eliminada"}


# ==========================================
# 2. GESTIÓN DE LISTA NEGRA
# ==========================================
@router.get("/lista-negra")
async def listar_lista_negra():
    sparql = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?uri ?palabra ?activo ?fecha
    WHERE {{
        GRAPH <{GRAPH_CONFIG}> {{
            ?uri a core:TerminoRuido ;
                 core:palabraRuido ?palabra ;
                 core:activoRuido ?activo ;
                 schema:dateCreated ?fecha .
        }}
    }}
    ORDER BY ?palabra
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    items = []
    for b in bindings:
        uri = b["uri"]["value"]
        id_sufijo = uri.split("/")[-1]
        activo_val = b["activo"]["value"].lower() in ("true", "1")
        items.append({
            "_id": id_sufijo,
            "id": id_sufijo,
            "palabra": b["palabra"]["value"],
            "activo": activo_val,
            "fecha_creacion": b["fecha"]["value"]
        })
    return items


@router.post("/lista-negra")
async def crear_termino_ruido(data: ListaNegraModel):
    id_sufijo = f"ruido_{uuid.uuid4().hex[:8]}"
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    ahora = datetime.utcnow().isoformat()
    activo_str = "true" if data.activo else "false"

    cuerpo = f"""
    <{uri}> a <http://proyecto-noticias.org/core#TerminoRuido> ;
            <http://proyecto-noticias.org/core#palabraRuido> {format_literal(data.palabra)} ;
            <http://proyecto-noticias.org/core#activoRuido> "{activo_str}"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
            <http://schema.org/dateCreated> "{ahora}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
    """
    sparql_update = f"INSERT DATA {{ GRAPH <{GRAPH_CONFIG}> {{ {cuerpo} }} }}"
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Término agregado a la lista negra", "id": id_sufijo}


@router.patch("/lista-negra/{id_sufijo}/estado")
async def cambiar_estado_ruido(id_sufijo: str):
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    sparql_get = f"SELECT ?activo WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoRuido> ?activo . }} }}"
    res = await fuseki_client.execute_query(sparql_get)
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        raise HTTPException(status_code=404, detail="Término no encontrado")

    actual = bindings[0]["activo"]["value"].lower() in ("true", "1")
    nuevo = "false" if actual else "true"

    sparql_update = f"""
    DELETE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoRuido> ?old . }} }}
    INSERT {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoRuido> "{nuevo}"^^<http://www.w3.org/2001/XMLSchema#boolean> . }} }}
    WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> <http://proyecto-noticias.org/core#activoRuido> ?old . }} }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Estado actualizado", "activo": (nuevo == "true")}


@router.delete("/lista-negra/{id_sufijo}")
async def eliminar_termino_ruido(id_sufijo: str):
    uri = f"{BASE_CONFIG}/{id_sufijo}"
    sparql_update = f"DELETE WHERE {{ GRAPH <{GRAPH_CONFIG}> {{ <{uri}> ?p ?o . }} }}"
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Término eliminado"}