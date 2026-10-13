import re
import unicodedata
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.fuseki_client import fuseki_client

router = APIRouter(prefix="/api/autoridades", tags=["Autoridades"])

GRAPH_AUTH = "http://proyecto-noticias.org/graph/authorities"
BASE_URI = "http://proyecto-noticias.org/authorities"


# ==========================================
# ESQUEMAS FLEXIBLES PARA AUTORIDADES
# ==========================================
class EnlaceExternoItem(BaseModel):
    tipo: Optional[str] = ""
    enlace: str
    fuente: Optional[str] = None


class NotaAutoridadItem(BaseModel):
    tipo: Optional[str] = ""
    texto: str
    soloStaff: Optional[bool] = False


class AutoridadCompletaPayload(BaseModel):
    # Campos enviados desde AutoridadesPage.jsx o modal rápido
    id_sufijo: Optional[str] = None
    nombre: Optional[str] = None
    pref_label: Optional[str] = None
    tipo_nombre: Optional[str] = None
    tipo: Optional[str] = None
    idioma: Optional[str] = "Español"
    descripcion_breve: Optional[str] = ""
    alias: Optional[List[str]] = []
    alt_label: Optional[str] = None
    wikidata_uri: Optional[str] = None
    referencias_externas: Optional[List[str]] = []
    enlaces_externos: Optional[List[EnlaceExternoItem]] = []
    notas: Optional[List[NotaAutoridadItem]] = []
    campo_extra_tipo: Optional[str] = ""
    campo_extra_valor: Optional[str] = ""


def format_literal(text: str) -> str:
    """Escapa comillas y saltos de línea para SPARQL."""
    if not text:
        return '""'
    escaped = str(text).replace("\\", "\\\\").replace('"', '\\"')
    return f'"""{escaped}"""'


def generar_slug(prefijo: str, texto: str) -> str:
    """Genera un identificador limpio para la URI a partir del nombre."""
    normalizado = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("utf-8")
    limpio = re.sub(r"[^a-zA-Z0-9]+", "_", normalizado.lower()).strip("_")
    return f"{prefijo}_{limpio[:35]}"


def construir_tripletas_autoridad(uri: str, data: AutoridadCompletaPayload, fecha_creacion: str, fecha_mod: str) -> str:
    termino = (data.nombre or data.pref_label or "").strip()
    tipo_raw = (data.tipo_nombre or data.tipo or "Agente").strip()

    # Normalizar clase del modelo para búsquedas por ?tipo=Materia o ?tipo=Lugar
    tipo_map = {
        "Materia": "Materia",
        "Categoría": "Materia",
        "Lugar": "Lugar",
        "Municipio": "Lugar",
        "Persona": "Persona",
        "Entidad": "Organizacion",
        "Entidad / Organización": "Organizacion",
        "Organizacion": "Organizacion",
        "Grupo Criminal": "GrupoCriminal",
        "Estructura Criminal": "GrupoCriminal",
    }
    clase_rdf = tipo_map.get(tipo_raw, tipo_raw.replace(" ", ""))

    triples = [
        f"<{uri}> a <http://proyecto-noticias.org/core#{clase_rdf}> .",
        f"<{uri}> <http://proyecto-noticias.org/core#tipoNombre> {format_literal(tipo_raw)} .",
        f"<{uri}> <http://www.w3.org/2004/02/skos/core#prefLabel> {format_literal(termino)} .",
        f'<{uri}> <http://schema.org/dateCreated> "{fecha_creacion}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
        f'<{uri}> <http://schema.org/dateModified> "{fecha_mod}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
    ]

    if data.idioma:
        triples.append(f"<{uri}> <http://schema.org/inLanguage> {format_literal(data.idioma)} .")

    if data.descripcion_breve:
        triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#definition> {format_literal(data.descripcion_breve)} .")

    if data.campo_extra_tipo and data.campo_extra_valor:
        triples.append(f"<{uri}> <http://proyecto-noticias.org/core#campoExtraTipo> {format_literal(data.campo_extra_tipo)} .")
        triples.append(f"<{uri}> <http://proyecto-noticias.org/core#campoExtraValor> {format_literal(data.campo_extra_valor)} .")

    # Alias / Términos alternativos
    lista_alias = list(data.alias or [])
    if data.alt_label and data.alt_label not in lista_alias:
        lista_alias.append(data.alt_label)

    for al in lista_alias:
        if al and al.strip():
            triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#altLabel> {format_literal(al.strip())} .")

    # Referencias externas
    for ref in (data.referencias_externas or []):
        if ref and ref.strip():
            triples.append(f"<{uri}> <http://proyecto-noticias.org/core#fuenteAutoridad> {format_literal(ref.strip())} .")

    # Enlaces externos (Wikipedia, Wikidata, Sitio Oficial)
    if data.wikidata_uri:
        triples.append(f"<{uri}> <http://www.w3.org/2002/07/owl#sameAs> <{data.wikidata_uri.strip()}> .")

    for enl in (data.enlaces_externos or []):
        if enl.enlace and enl.enlace.strip():
            valor_enl = f"{enl.tipo || 'Enlace'}|{enl.enlace.strip()}|{enl.fuente or ''}"
            triples.append(f"<{uri}> <http://proyecto-noticias.org/core#enlaceExterno> {format_literal(valor_enl)} .")

    # Notas
    for n in (data.notas or []):
        if n.texto and n.texto.strip():
            valor_nota = f"{n.tipo or 'General'}|{n.texto.strip()}|{'1' if n.soloStaff else '0'}"
            triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#note> {format_literal(valor_nota)} .")

    return "\n            ".join(triples)


# ==========================================
# 1. LISTAR TODAS LAS AUTORIDADES (GET)
# ==========================================
@router.get("")
async def listar_autoridades(tipo: Optional[str] = Query(None)):
    filtro_tipo = ""
    if tipo:
        filtro_tipo = f"FILTER(?clase = <http://proyecto-noticias.org/core#{tipo}> || REGEX(STR(?tipoNombre), '{tipo}', 'i'))"

    sparql = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?uri ?prefLabel ?clase ?tipoNombre ?altLabel ?fechaCreacion ?fechaMod
    WHERE {{
        GRAPH <{GRAPH_AUTH}> {{
            ?uri a ?clase ;
                 skos:prefLabel ?prefLabel .
            OPTIONAL {{ ?uri core:tipoNombre ?tipoNombre . }}
            OPTIONAL {{ ?uri skos:altLabel ?altLabel . }}
            OPTIONAL {{ ?uri schema:dateCreated ?fechaCreacion . }}
            OPTIONAL {{ ?uri schema:dateModified ?fechaMod . }}
            {filtro_tipo}
        }}
    }}
    ORDER BY ?prefLabel
    """

    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    agrupadas = {}
    for b in bindings:
        uri = b["uri"]["value"]
        if uri not in agrupadas:
            id_sufijo = uri.split("/")[-1]
            clase_str = b["clase"]["value"].split("#")[-1]
            tipo_mostrar = b.get("tipoNombre", {}).get("value", clase_str)
            fecha_c = b.get("fechaCreacion", {}).get("value", datetime.utcnow().isoformat())
            fecha_m = b.get("fechaMod", {}).get("value", fecha_c)

            agrupadas[uri] = {
                "id": id_sufijo,
                "_id": id_sufijo,
                "uri": uri,
                "prefLabel": b["prefLabel"]["value"],
                "termino": b["prefLabel"]["value"],
                "nombre": b["prefLabel"]["value"],
                "tipo": tipo_mostrar,
                "tipo_nombre": tipo_mostrar,
                "altLabel": b.get("altLabel", {}).get("value", ""),
                "fecha_creacion": fecha_c,
                "fecha_actualizacion": fecha_m,
            }

    return list(agrupadas.values())


# ==========================================
# 2. OBTENER DETALLE DE UNA AUTORIDAD POR ID (GET)
# ==========================================
@router.get("/{id_sufijo}")
async def obtener_autoridad(id_sufijo: str):
    uri = f"{BASE_URI}/{id_sufijo}"
    sparql = f"""
    SELECT ?p ?o
    WHERE {{
        GRAPH <{GRAPH_AUTH}> {{
            <{uri}> ?p ?o .
        }}
    }}
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    if not bindings:
        raise HTTPException(status_code=404, detail="Autoridad no encontrada en Fuseki")

    detalle = {
        "id": id_sufijo,
        "uri": uri,
        "nombre": "",
        "tipo_nombre": "Persona",
        "idioma": "Español",
        "descripcion_breve": "",
        "alias": [],
        "referencias_externas": [],
        "enlaces_externos": [],
        "notas": [],
        "campo_extra_tipo": "",
        "campo_extra_valor": "",
        "fecha_creacion": datetime.utcnow().isoformat(),
    }

    for b in bindings:
        pred = b["p"]["value"]
        obj = b["o"]["value"]

        if pred.endswith("#prefLabel"):
            detalle["nombre"] = obj
        elif pred.endswith("#tipoNombre"):
            detalle["tipo_nombre"] = obj
        elif pred.endswith("#type") and not detalle["tipo_nombre"]:
            detalle["tipo_nombre"] = obj.split("#")[-1]
        elif pred.endswith("/inLanguage"):
            detalle["idioma"] = obj
        elif pred.endswith("#definition"):
            detalle["descripcion_breve"] = obj
        elif pred.endswith("#altLabel"):
            detalle["alias"].append(obj)
        elif pred.endswith("#fuenteAutoridad"):
            detalle["referencias_externas"].append(obj)
        elif pred.endswith("#campoExtraTipo"):
            detalle["campo_extra_tipo"] = obj
        elif pred.endswith("#campoExtraValor"):
            detalle["campo_extra_valor"] = obj
        elif pred.endswith("/dateCreated"):
            detalle["fecha_creacion"] = obj
        elif pred.endswith("#enlaceExterno"):
            partes = obj.split("|")
            detalle["enlaces_externos"].append({
                "tipo": partes[0] if len(partes) > 0 else "",
                "enlace": partes[1] if len(partes) > 1 else obj,
                "fuente": partes[2] if len(partes) > 2 else "",
            })
        elif pred.endswith("#note"):
            partes = obj.split("|")
            detalle["notas"].append({
                "tipo": partes[0] if len(partes) > 0 else "General",
                "texto": partes[1] if len(partes) > 1 else obj,
                "soloStaff": (partes[2] == "1") if len(partes) > 2 else False,
            })

    return detalle


# ==========================================
# 3. CREAR NUEVA AUTORIDAD (POST)
# ==========================================
@router.post("")
async def crear_autoridad(data: AutoridadCompletaPayload):
    termino = (data.nombre or data.pref_label or "").strip()
    if not termino:
        raise HTTPException(status_code=400, detail="El término autorizado es obligatorio")

    tipo_raw = (data.tipo_nombre or data.tipo or "aut").lower()
    prefijo = "mat" if "materia" in tipo_raw else "mun" if "lugar" in tipo_raw else "aut"
    id_sufijo = data.id_sufijo or generar_slug(prefijo, termino)
    uri = f"{BASE_URI}/{id_sufijo}"

    ahora = datetime.utcnow().isoformat()
    cuerpo = construir_tripletas_autoridad(uri, data, ahora, ahora)

    sparql_update = f"""
    INSERT DATA {{
        GRAPH <{GRAPH_AUTH}> {{
            {cuerpo}
        }}
    }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Autoridad registrada exitosamente", "uri": uri, "id": id_sufijo}


# ==========================================
# 4. ACTUALIZAR AUTORIDAD EXISTENTE (PUT)
# ==========================================
@router.put("/{id_sufijo}")
async def actualizar_autoridad(id_sufijo: str, data: AutoridadCompletaPayload):
    uri = f"{BASE_URI}/{id_sufijo}"
    ahora = datetime.utcnow().isoformat()
    cuerpo = construir_tripletas_autoridad(uri, data, ahora, ahora)

    sparql_update = f"""
    DELETE WHERE {{
        GRAPH <{GRAPH_AUTH}> {{
            <{uri}> ?p ?o .
        }}
    }};
    INSERT DATA {{
        GRAPH <{GRAPH_AUTH}> {{
            {cuerpo}
        }}
    }}
    """
    await fuseki_client.execute_update(sparql_update)
    return {"message": "Autoridad actualizada exitosamente", "uri": uri, "id": id_sufijo}