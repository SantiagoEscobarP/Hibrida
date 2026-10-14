import uuid
import json
from datetime import datetime
from typing import Optional, List, Any
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.fuseki_client import fuseki_client

router = APIRouter(tags=["Eventos y Grafo"])

GRAPH_NEWS = "http://proyecto-noticias.org/graph/news"
GRAPH_AUTH = "http://proyecto-noticias.org/graph/authorities"
BASE_NEWS = "http://proyecto-noticias.org/news"
BASE_EVENT = "http://proyecto-noticias.org/events"


def format_literal(text: Any) -> str:
    if text is None or text == "":
        return '""'
    escaped = str(text).replace("\\", "\\\\").replace('"', '\\"')
    return f'"""{escaped}"""'


class EventoPayload(BaseModel):
    id_titular: Optional[str] = None
    titulo_recurso: Optional[str] = ""
    titulo: Optional[str] = ""
    resumen_evento: Optional[str] = ""
    resumen: Optional[str] = ""
    estado: Optional[str] = "REG"
    fechaCatalogacion: Optional[str] = ""
    fuenteTitulo: Optional[dict] = None
    titulosAlternativos: Optional[List[dict]] = []
    municipio: Optional[str] = ""
    subdivision: Optional[str] = ""
    complemento: Optional[str] = ""
    direccion_hecho: Optional[dict] = None
    afectados: Optional[List[dict]] = []
    victimarios: Optional[List[dict]] = []
    agentes_vinculados: Optional[List[dict]] = []
    notasList: Optional[List[dict]] = []
    notas: Optional[List[dict]] = []
    materiasList: Optional[List[dict]] = []
    organizacion: Optional[dict] = None
    lideres: Optional[List[dict]] = []


# ==========================================
# 1. DETALLE DE UN TITULAR POR ID
# ==========================================
@router.get("/api/noticias/{id_sufijo}")
async def obtener_titular_por_id(id_sufijo: str):
    uri = f"{BASE_NEWS}/{id_sufijo}"
    sparql = f"""
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT ?encabezado ?cuerpo ?fuente ?fechaPub ?materiaUri
    WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{uri}> a schema:NewsArticle ;
                    schema:headline ?encabezado ;
                    schema:articleBody ?cuerpo ;
                    schema:publisher ?fuente ;
                    schema:datePublished ?fechaPub .
            OPTIONAL {{ <{uri}> core:tieneMateria ?materiaUri . }}
        }}
    }}
    LIMIT 1
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        raise HTTPException(status_code=404, detail="Titular no encontrado")

    b = bindings[0]
    return {
        "_id": id_sufijo,
        "uri": uri,
        "encabezado": b["encabezado"]["value"],
        "resumen": b["cuerpo"]["value"],
        "url_fuente": b["fuente"]["value"],
        "fuente": b["fuente"]["value"],
        "fecha_publicacion": b["fechaPub"]["value"],
        "fecha_creacion": b["fechaPub"]["value"],
    }


# ==========================================
# 2. LISTAR EVENTOS (TODOS O POR TITULAR)
# ==========================================
@router.get("/api/eventos")
async def listar_todos_eventos():
    sparql = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?evUri ?titulo ?resumen ?municipio ?subdivision ?complemento ?categoria ?fecha ?noticiaUri
    WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            ?evUri a core:Evento ;
                   core:tituloEvento ?titulo .
            OPTIONAL {{ ?evUri schema:abstract ?resumen . }}
            OPTIONAL {{ ?evUri core:municipioTexto ?municipio . }}
            OPTIONAL {{ ?evUri core:subdivisionTexto ?subdivision . }}
            OPTIONAL {{ ?evUri core:complemento ?complemento . }}
            OPTIONAL {{ ?evUri core:categoriaTexto ?categoria . }}
            OPTIONAL {{ ?evUri schema:dateCreated ?fecha . }}
            OPTIONAL {{ ?noticiaUri core:relataEvento ?evUri . }}
        }}
    }}
    ORDER BY DESC(?fecha)
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    eventos = []
    vistos = set()
    for b in bindings:
        ev_uri = b["evUri"]["value"]
        if ev_uri in vistos:
            continue
        vistos.add(ev_uri)

        ev_id = ev_uri.split("/")[-1]
        noticia_uri = b.get("noticiaUri", {}).get("value", "")
        id_titular = noticia_uri.split("/")[-1] if noticia_uri else ev_id

        muni = b.get("municipio", {}).get("value", "Bogotá D.C.")
        subdiv = b.get("subdivision", {}).get("value", "")
        comp = b.get("complemento", {}).get("value", "")
        cat = b.get("categoria", {}).get("value", "REG")
        fecha = b.get("fecha", {}).get("value", datetime.utcnow().isoformat())

        eventos.append({
            "_id": ev_id,
            "id": ev_id,
            "uri": ev_uri,
            "id_titular": id_titular,
            "titulo": b["titulo"]["value"],
            "titulo_recurso": b["titulo"]["value"],
            "resumen": b.get("resumen", {}).get("value", ""),
            "resumen_evento": b.get("resumen", {}).get("value", ""),
            "estado": cat,
            "categoria": cat,
            "municipio": muni,
            "subdivision": subdiv,
            "direccion_hecho": {
                "ciudad": muni,
                "localidad": subdiv or muni,
                "barrio": comp,
            },
            "fecha_creacion": fecha,
            "fecha": fecha,
        })

    return eventos


@router.get("/api/eventos/por-titular/{id_titular}")
async def listar_eventos_por_titular(id_titular: str):
    todos = await listar_todos_eventos()
    return [e for e in todos if e.get("id_titular") == id_titular]


@router.get("/api/eventos/{id_evento}")
async def obtener_evento_detalle(id_evento: str):
    ev_uri = f"{BASE_EVENT}/{id_evento}"
    sparql = f"""
    SELECT ?p ?o
    WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{ev_uri}> ?p ?o .
        }}
    }}
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    datos = {
        "id": id_evento,
        "_id": id_evento,
        "titulo": "",
        "resumen": "",
        "municipio": "",
        "subdivision": "",
        "complemento": "",
        "afectados": [],
        "victimarios": [],
        "notasList": [],
        "materiasList": [],
        "organizacion": None,
        "lideres": [],
    }

    for b in bindings:
        pred = b["p"]["value"]
        obj = b["o"]["value"]
        if pred.endswith("#tituloEvento"):
            datos["titulo"] = obj
        elif pred.endswith("/abstract"):
            datos["resumen"] = obj
        elif pred.endswith("#municipioTexto"):
            datos["municipio"] = obj
        elif pred.endswith("#subdivisionTexto"):
            datos["subdivision"] = obj
        elif pred.endswith("#complemento"):
            datos["complemento"] = obj
        elif pred.endswith("#payloadJson"):
            try:
                extra = json.loads(obj)
                datos.update(extra)
            except Exception:
                pass

    return datos


# ==========================================
# 3. CREAR Y ACTUALIZAR EVENTO EN FUSEKI
# ==========================================
async def persistir_evento_fuseki(ev_id: str, data: EventoPayload):
    ev_uri = f"{BASE_EVENT}/{ev_id}"
    titulo = (data.titulo or data.titulo_recurso or "Evento sin título").strip()
    resumen = (data.resumen or data.resumen_evento or "").strip()

    muni = data.municipio or (data.direccion_hecho or {}).get("ciudad") or "Bogotá D.C."
    subdiv = data.subdivision or (data.direccion_hecho or {}).get("localidad") or ""
    comp = data.complemento or (data.direccion_hecho or {}).get("barrio") or ""

    cat_principal = "REG"
    if data.materiasList and len(data.materiasList) > 0:
        cat_principal = data.materiasList[0].get("materia") or "REG"

    ahora = datetime.utcnow().isoformat()

    # Respaldo estructurado para recarga exacta en edición
    snapshot = {
        "fechaCatalogacion": data.fechaCatalogacion or datetime.utcnow().strftime("%d/%m/%Y"),
        "titulo": titulo,
        "resumen": resumen,
        "municipio": muni,
        "subdivision": subdiv,
        "complemento": comp,
        "afectados": data.afectados or [],
        "victimarios": data.victimarios or [],
        "notasList": data.notasList or [],
        "materiasList": data.materiasList or [],
        "organizacion": data.organizacion,
        "lideres": data.lideres or [],
    }

    triples = [
        f"<{ev_uri}> a <http://proyecto-noticias.org/core#Evento> .",
        f"<{ev_uri}> <http://proyecto-noticias.org/core#tituloEvento> {format_literal(titulo)} .",
        f"<{ev_uri}> <http://schema.org/abstract> {format_literal(resumen)} .",
        f"<{ev_uri}> <http://proyecto-noticias.org/core#municipioTexto> {format_literal(muni)} .",
        f"<{ev_uri}> <http://proyecto-noticias.org/core#subdivisionTexto> {format_literal(subdiv)} .",
        f"<{ev_uri}> <http://proyecto-noticias.org/core#complemento> {format_literal(comp)} .",
        f"<{ev_uri}> <http://proyecto-noticias.org/core#categoriaTexto> {format_literal(cat_principal)} .",
        f'<{ev_uri}> <http://schema.org/dateCreated> "{ahora}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
        f"<{ev_uri}> <http://proyecto-noticias.org/core#payloadJson> {format_literal(json.dumps(snapshot, ensure_ascii=False))} .",
    ]

    # Enlazar con el Titular para que pase de PEND a OK automáticamente
    if data.id_titular:
        noticia_uri = f"{BASE_NEWS}/{data.id_titular}"
        triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> .")

    # Enlazar agentes vinculados (Afectados y Victimarios)
    agentes_totales = list(data.agentes_vinculados or [])
    for af in (data.afectados or []):
        if af.get("nombre"):
            agentes_totales.append({"nombre": af.get("nombre"), "rol": af.get("rol") or "Afectado"})
    for vic in (data.victimarios or []):
        if vic.get("nombre"):
            agentes_totales.append({"nombre": vic.get("nombre"), "rol": vic.get("rol") or "Victimario"})

    for ag in agentes_totales:
        nombre_ag = ag.get("nombre", "").strip()
        if nombre_ag:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#agenteMencionado> {format_literal(nombre_ag)} .")

    if data.organizacion and data.organizacion.get("nombre"):
        triples.append(
            f"<{ev_uri}> <http://proyecto-noticias.org/core#organizacionPerpetradora> {format_literal(data.organizacion['nombre'])} ."
        )

    cuerpo = "\n            ".join(triples)
    sparql_update = f"""
    DELETE WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{ev_uri}> ?p ?o .
        }}
    }};
    INSERT DATA {{
        GRAPH <{GRAPH_NEWS}> {{
            {cuerpo}
        }}
    }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Evento guardado en Fuseki", "id": ev_id, "uri": ev_uri}


@router.post("/api/eventos")
async def crear_evento(data: EventoPayload):
    ev_id = f"ev_{uuid.uuid4().hex[:10]}"
    return await persistir_evento_fuseki(ev_id, data)


@router.put("/api/eventos/{id_evento}")
async def actualizar_evento(id_evento: str, data: EventoPayload):
    return await persistir_evento_fuseki(id_evento, data)


# ==========================================
# 4. BUSCADOR FUSEKI Y ESTADÍSTICAS DEL GRAFO
# ==========================================
@router.get("/api/grafo/estadisticas")
async def estadisticas_grafo():
    sparql = """
    SELECT ?clase (COUNT(DISTINCT ?s) AS ?total)
    WHERE {
        GRAPH ?g {
            ?s a ?clase .
        }
    }
    GROUP BY ?clase
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    por_tipo = {}
    total_general = 0
    for b in bindings:
        clase_raw = b["clase"]["value"].split("#")[-1].split("/")[-1]
        cantidad = int(b["total"]["value"])
        por_tipo[clase_raw] = por_tipo.get(clase_raw, 0) + cantidad
        total_general += cantidad

    return {"total": total_general, "por_tipo": por_tipo}


@router.get("/api/buscar")
async def buscar_en_grafo(
    q: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None)
):
    filtro_texto = ""
    if q:
        filtro_texto = f'FILTER(REGEX(STR(?nombre), "{q}", "i"))'

    filtro_tipo = ""
    if tipo:
        filtro_tipo = f'FILTER(REGEX(STR(?clase), "{tipo}", "i"))'

    sparql = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT DISTINCT ?uri ?clase ?nombre
    WHERE {{
        GRAPH ?g {{
            ?uri a ?clase .
            OPTIONAL {{ ?uri skos:prefLabel ?l1 . }}
            OPTIONAL {{ ?uri schema:headline ?l2 . }}
            OPTIONAL {{ ?uri core:tituloEvento ?l3 . }}
            BIND(COALESCE(?l1, ?l2, ?l3, STR(?uri)) AS ?nombre)
            {filtro_texto}
            {filtro_tipo}
        }}
    }}
    LIMIT 80
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    resultados = []
    for b in bindings:
        clase_etiqueta = b["clase"]["value"].split("#")[-1].split("/")[-1]
        resultados.append({
            "uri": b["uri"]["value"],
            "tipo_etiqueta": clase_etiqueta,
            "nombre": b["nombre"]["value"],
        })

    return {"resultados": resultados}


@router.get("/api/grafo/entidad")
async def detalle_entidad_grafo(uri: str = Query(...)):
    # Propiedades salientes
    sparql_out = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT ?p ?o ?oLabel
    WHERE {{
        GRAPH ?g {{
            <{uri}> ?p ?o .
        }}
        OPTIONAL {{
            GRAPH ?g2 {{
                OPTIONAL {{ ?o skos:prefLabel ?l1 . }}
                OPTIONAL {{ ?o schema:headline ?l2 . }}
                OPTIONAL {{ ?o core:tituloEvento ?l3 . }}
                BIND(COALESCE(?l1, ?l2, ?l3) AS ?oLabel)
            }}
        }}
    }}
    """
    # Conexiones entrantes
    sparql_in = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT ?s ?p ?sLabel
    WHERE {{
        GRAPH ?g {{
            ?s ?p <{uri}> .
            OPTIONAL {{ ?s skos:prefLabel ?l1 . }}
            OPTIONAL {{ ?s schema:headline ?l2 . }}
            OPTIONAL {{ ?s core:tituloEvento ?l3 . }}
            BIND(COALESCE(?l1, ?l2, ?l3, STR(?s)) AS ?sLabel)
        }}
    }}
    """
    res_out = await fuseki_client.execute_query(sparql_out)
    res_in = await fuseki_client.execute_query(sparql_in)

    propiedades = []
    label_principal = uri.split("/")[-1]

    for b in res_out.get("results", {}).get("bindings", []):
        pred_full = b["p"]["value"]
        pred_short = pred_full.split("#")[-1].split("/")[-1]
        if pred_short == "payloadJson":
            continue

        obj_val = b["o"]["value"]
        obj_type = b["o"]["type"]

        if pred_short in ("prefLabel", "headline", "tituloEvento"):
            label_principal = obj_val

        propiedades.append({
            "predicado": pred_short,
            "valor": obj_val,
            "tipo_nodo": obj_type,
            "valor_label": b.get("oLabel", {}).get("value", obj_val),
        })

    entrantes = []
    for b in res_in.get("results", {}).get("bindings", []):
        pred_short = b["p"]["value"].split("#")[-1].split("/")[-1]
        entrantes.append({
            "sujeto_uri": b["s"]["value"],
            "sujeto_label": b.get("sLabel", {}).get("value", b["s"]["value"]),
            "predicado": pred_short,
        })

    return {
        "uri": uri,
        "label": label_principal,
        "propiedades": propiedades,
        "conexiones_entrantes": entrantes,
    }