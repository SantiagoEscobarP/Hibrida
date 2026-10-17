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

    SELECT ?encabezado ?cuerpo ?fuente ?fechaPub ?fechaMod ?materiaUri ?estadoIdx
    WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{uri}> a schema:NewsArticle ;
                    schema:headline ?encabezado .
            OPTIONAL {{ <{uri}> schema:articleBody ?cuerpo . }}
            OPTIONAL {{ <{uri}> schema:publisher ?fuente . }}
            OPTIONAL {{ <{uri}> schema:datePublished ?fechaPub . }}
            OPTIONAL {{ <{uri}> schema:dateModified ?fechaMod . }}
            OPTIONAL {{ <{uri}> core:tieneMateria ?materiaUri . }}
            OPTIONAL {{ <{uri}> core:estadoIndexacion ?estadoIdx . }}
        }}
    }}
    LIMIT 1
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])
    if not bindings:
        raise HTTPException(status_code=404, detail="Titular no encontrado")

    b = bindings[0]
    fecha_pub = b.get("fechaPub", {}).get("value", "")
    fecha_mod = b.get("fechaMod", {}).get("value", fecha_pub)
    return {
        "_id": id_sufijo,
        "uri": uri,
        "encabezado": b["encabezado"]["value"],
        "resumen": b.get("cuerpo", {}).get("value", ""),
        "url_fuente": b.get("fuente", {}).get("value", ""),
        "fuente": b.get("fuente", {}).get("value", ""),
        "fecha_publicacion": fecha_pub,
        "fecha_creacion": fecha_mod,
        "estado": b.get("estadoIdx", {}).get("value", "Pendiente"),
    }


# ==========================================
# 2. LISTAR EVENTOS CON TODOS SUS TITULARES ENLAZADOS
# ==========================================
@router.get("/api/eventos")
async def listar_todos_eventos():
    sparql = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?evUri ?titulo ?resumen ?municipio ?subdivision ?complemento ?categoria ?fecha ?noticiaUri ?noticiaTitulo ?noticiaFuente
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
            OPTIONAL {{
                ?noticiaUri core:relataEvento ?evUri .
                OPTIONAL {{ ?noticiaUri schema:headline ?noticiaTitulo . }}
                OPTIONAL {{ ?noticiaUri schema:publisher ?noticiaFuente . }}
            }}
        }}
    }}
    ORDER BY DESC(?fecha)
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    eventos_map = {}
    for b in bindings:
        ev_uri = b["evUri"]["value"]
        ev_id = ev_uri.split("/")[-1]

        noticia_uri = b.get("noticiaUri", {}).get("value", "")
        id_titular = noticia_uri.split("/")[-1] if noticia_uri else None
        noticia_titulo = b.get("noticiaTitulo", {}).get("value", id_titular or "")
        noticia_fuente = b.get("noticiaFuente", {}).get("value", "")

        if ev_uri not in eventos_map:
            muni = b.get("municipio", {}).get("value", "Bogotá D.C.")
            subdiv = b.get("subdivision", {}).get("value", "")
            comp = b.get("complemento", {}).get("value", "")
            cat = b.get("categoria", {}).get("value", "REG")
            fecha = b.get("fecha", {}).get("value", datetime.utcnow().isoformat())

            eventos_map[ev_uri] = {
                "_id": ev_id,
                "id": ev_id,
                "uri": ev_uri,
                "id_titular": id_titular or ev_id,
                "ids_titulares": [],
                "titulares_relacionados": [],
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
            }

        # Agregar todos los titulares que apuntan a este mismo evento en el grafo
        if id_titular and id_titular not in eventos_map[ev_uri]["ids_titulares"]:
            eventos_map[ev_uri]["ids_titulares"].append(id_titular)
            eventos_map[ev_uri]["titulares_relacionados"].append({
                "id": id_titular,
                "uri": noticia_uri,
                "encabezado": noticia_titulo,
                "fuente": noticia_fuente,
            })

    return list(eventos_map.values())


@router.get("/api/eventos/por-titular/{id_titular}")
async def listar_eventos_por_titular(id_titular: str):
    todos = await listar_todos_eventos()
    return [
        e for e in todos
        if id_titular in e.get("ids_titulares", []) or e.get("id_titular") == id_titular
    ]


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

    # Enlazar con el Titular sin cambiar todavía a OK (espera al botón INDEXAR)
    if data.id_titular:
        noticia_uri = f"{BASE_NEWS}/{data.id_titular}"
        triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> .")

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
# 4. HOLDING Y BOTÓN INDEXAR / ACTUALIZAR
# ==========================================
@router.post("/api/noticias/{id_titular}/relacionar-evento/{id_evento}")
async def relacionar_evento_existente(id_titular: str, id_evento: str):
    """Enlaza un evento existente a otro titular mediante HOLDING conservando los enlaces previos."""
    noticia_uri = f"{BASE_NEWS}/{id_titular}"
    ev_uri = f"{BASE_EVENT}/{id_evento}"

    sparql_update = f"""
    DELETE WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{noticia_uri}> <http://proyecto-noticias.org/core#estadoIndexacion> ?oldEstado .
        }}
    }};
    INSERT DATA {{
        GRAPH <{GRAPH_NEWS}> {{
            <{noticia_uri}> <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> .
            <{noticia_uri}> <http://proyecto-noticias.org/core#estadoIndexacion> "Pendiente" .
        }}
    }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Evento enlazado al titular en Holding"}


@router.post("/api/noticias/{id_titular}/indexar")
async def indexar_titular_definitivo(id_titular: str):
    """Cambia oficialmente el estado del titular a OK cuando el usuario presiona INDEXAR / ACTUALIZAR."""
    noticia_uri = f"{BASE_NEWS}/{id_titular}"
    ahora = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S")

    sparql_update = f"""
    DELETE WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{noticia_uri}> <http://proyecto-noticias.org/core#estadoIndexacion> ?oldEstado .
        }}
    }};
    DELETE WHERE {{
        GRAPH <{GRAPH_NEWS}> {{
            <{noticia_uri}> <http://schema.org/dateModified> ?oldMod .
        }}
    }};
    INSERT DATA {{
        GRAPH <{GRAPH_NEWS}> {{
            <{noticia_uri}> <http://proyecto-noticias.org/core#estadoIndexacion> "OK" .
            <{noticia_uri}> <http://schema.org/dateModified> "{ahora}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .
        }}
    }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Titular indexado con estado OK", "estado": "OK", "fecha_actualizacion": ahora}


# ==========================================
# 5. BUSCADOR FUSEKI Y ESTADÍSTICAS DEL GRAFO
# ==========================================
@router.get("/api/grafo/estadisticas")
async def estadisticas_grafo():
    sparql = """
    SELECT ?clase (COUNT(DISTINCT ?s) AS ?total)
    WHERE {
        { ?s a ?clase . }
        UNION
        { GRAPH ?g { ?s a ?clase . } }
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
    filtro_texto = f'FILTER(REGEX(STR(?nombre), "{q}", "i"))' if q else ""
    filtro_tipo = f'FILTER(REGEX(STR(?clase), "{tipo}", "i"))' if tipo else ""

    sparql = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT DISTINCT ?uri ?clase ?nombre
    WHERE {{
        {{
            ?uri a ?clase .
            OPTIONAL {{ ?uri skos:prefLabel ?l1 . }}
            OPTIONAL {{ ?uri skos:preferLabel ?l2 . }}
            OPTIONAL {{ ?uri rdfs:label ?l3 . }}
            OPTIONAL {{ ?uri schema:headline ?l4 . }}
            OPTIONAL {{ ?uri core:tituloEvento ?l5 . }}
            BIND(COALESCE(?l1, ?l2, ?l3, ?l4, ?l5, STR(?uri)) AS ?nombre)
            {filtro_texto}
            {filtro_tipo}
        }}
        UNION
        {{
            GRAPH ?g {{
                ?uri a ?clase .
                OPTIONAL {{ ?uri skos:prefLabel ?l1 . }}
                OPTIONAL {{ ?uri skos:preferLabel ?l2 . }}
                OPTIONAL {{ ?uri rdfs:label ?l3 . }}
                OPTIONAL {{ ?uri schema:headline ?l4 . }}
                OPTIONAL {{ ?uri core:tituloEvento ?l5 . }}
                BIND(COALESCE(?l1, ?l2, ?l3, ?l4, ?l5, STR(?uri)) AS ?nombre)
                {filtro_texto}
                {filtro_tipo}
            }}
        }}
    }}
    LIMIT 80
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    resultados = []
    vistos = set()
    for b in bindings:
        u = b["uri"]["value"]
        if u in vistos:
            continue
        vistos.add(u)
        clase_etiqueta = b["clase"]["value"].split("#")[-1].split("/")[-1]
        resultados.append({
            "uri": u,
            "tipo_etiqueta": clase_etiqueta,
            "nombre": b["nombre"]["value"],
        })

    return {"resultados": resultados}


@router.get("/api/grafo/entidad")
async def detalle_entidad_grafo(uri: str = Query(...)):
    sparql_out = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT ?p ?o ?oLabel
    WHERE {{
        {{ <{uri}> ?p ?o . }}
        UNION
        {{ GRAPH ?g {{ <{uri}> ?p ?o . }} }}
        OPTIONAL {{
            {{
                OPTIONAL {{ ?o skos:prefLabel ?l1 . }}
                OPTIONAL {{ ?o skos:preferLabel ?l2 . }}
                OPTIONAL {{ ?o rdfs:label ?l3 . }}
                OPTIONAL {{ ?o schema:headline ?l4 . }}
                OPTIONAL {{ ?o core:tituloEvento ?l5 . }}
                BIND(COALESCE(?l1, ?l2, ?l3, ?l4, ?l5) AS ?oLabel)
            }}
            UNION
            {{
                GRAPH ?g2 {{
                    OPTIONAL {{ ?o skos:prefLabel ?l1 . }}
                    OPTIONAL {{ ?o skos:preferLabel ?l2 . }}
                    OPTIONAL {{ ?o rdfs:label ?l3 . }}
                    OPTIONAL {{ ?o schema:headline ?l4 . }}
                    OPTIONAL {{ ?o core:tituloEvento ?l5 . }}
                    BIND(COALESCE(?l1, ?l2, ?l3, ?l4, ?l5) AS ?oLabel)
                }}
            }}
        }}
    }}
    """
    sparql_in = f"""
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>

    SELECT DISTINCT ?s ?p ?sLabel
    WHERE {{
        {{
            ?s ?p <{uri}> .
            OPTIONAL {{ ?s skos:prefLabel ?l1 . }}
            OPTIONAL {{ ?s rdfs:label ?l2 . }}
            OPTIONAL {{ ?s schema:headline ?l3 . }}
            OPTIONAL {{ ?s core:tituloEvento ?l4 . }}
            BIND(COALESCE(?l1, ?l2, ?l3, ?l4, STR(?s)) AS ?sLabel)
        }}
        UNION
        {{
            GRAPH ?g {{
                ?s ?p <{uri}> .
                OPTIONAL {{ ?s skos:prefLabel ?l1 . }}
                OPTIONAL {{ ?s rdfs:label ?l2 . }}
                OPTIONAL {{ ?s schema:headline ?l3 . }}
                OPTIONAL {{ ?s core:tituloEvento ?l4 . }}
                BIND(COALESCE(?l1, ?l2, ?l3, ?l4, STR(?s)) AS ?sLabel)
            }}
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

        if pred_short in ("prefLabel", "preferLabel", "label", "headline", "tituloEvento"):
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