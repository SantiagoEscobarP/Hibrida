import re
import unicodedata
from datetime import datetime
from typing import Optional, List
from urllib.parse import unquote
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from services.fuseki_client import fuseki_client

router = APIRouter(prefix="/api/autoridades", tags=["Autoridades"])

GRAPH_AUTH = "http://proyecto-noticias.org/graph/authorities"
BASE_URI = "http://proyecto-noticias.org/authorities"


class EnlaceExternoItem(BaseModel):
    tipo: Optional[str] = ""
    enlace: str
    fuente: Optional[str] = None


class NotaAutoridadItem(BaseModel):
    tipo: Optional[str] = ""
    texto: str
    soloStaff: Optional[bool] = False


class AutoridadCompletaPayload(BaseModel):
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
    if not text:
        return '""'
    escaped = str(text).replace("\\", "\\\\").replace('"', '\\"')
    return f'"""{escaped}"""'


def generar_slug(prefijo: str, texto: str) -> str:
    normalizado = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("utf-8")
    limpio = re.sub(r"[^a-zA-Z0-9]+", "_", normalizado.lower()).strip("_")
    return f"{prefijo}_{limpio[:35]}"


def clasificar_entidad_ttl(uri: str, clase: str, superclase: str, tipo_explicito: str) -> str:
    """Determina si un recurso de los .ttl es Materia, Lugar, Grupo Criminal, etc."""
    if tipo_explicito:
        return tipo_explicito

    u_low = uri.lower()
    c_low = clase.lower()
    s_low = superclase.lower()

    if "materias" in u_low or "eventomayor" in s_low or "materia" in c_low:
        return "Materia"
    if any(k in u_low or k in c_low for k in ["geografia", "paises", "departamentos", "municipios", "localidades", "upz", "barrio", "lugar", "capital"]):
        return "Lugar"
    if "grupos_armados" in u_low or "grupocriminal" in c_low or "organization" in c_low:
        return "Grupo Criminal"
    if "persona" in c_low:
        return "Persona"
    if "agentes" in u_low or "tipos_autoridad" in u_low:
        return "Concepto"
    return "Autoridad"


# ==========================================
# 1. LISTAR AUTORIDADES COMPATIBLE CON TODOS LOS .TTL
# ==========================================
@router.get("")
async def listar_autoridades(tipo: Optional[str] = Query(None)):
    sparql = """
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>

    SELECT ?uri ?label ?clase ?superClase ?tipoNombre ?altLabel ?fechaCreacion ?fechaMod
    WHERE {
        {
            ?uri a ?clase .
            OPTIONAL { ?uri rdfs:subClassOf ?superClase . }
            OPTIONAL { ?uri skos:prefLabel ?pref . }
            OPTIONAL { ?uri skos:preferLabel ?prefer . }
            OPTIONAL { ?uri rdfs:label ?rlabel . }
            OPTIONAL { ?uri core:tipoNombre ?tipoNombre . }
            OPTIONAL { ?uri skos:altLabel ?altLabel . }
            OPTIONAL { ?uri schema:dateCreated ?fechaCreacion . }
            OPTIONAL { ?uri schema:dateModified ?fechaMod . }
        }
        UNION
        {
            GRAPH ?g {
                ?uri a ?clase .
                FILTER(?g != <http://proyecto-noticias.org/graph/news> && ?g != <http://proyecto-noticias.org/graph/config>)
                OPTIONAL { ?uri rdfs:subClassOf ?superClase . }
                OPTIONAL { ?uri skos:prefLabel ?pref . }
                OPTIONAL { ?uri skos:preferLabel ?prefer . }
                OPTIONAL { ?uri rdfs:label ?rlabel . }
                OPTIONAL { ?uri core:tipoNombre ?tipoNombre . }
                OPTIONAL { ?uri skos:altLabel ?altLabel . }
                OPTIONAL { ?uri schema:dateCreated ?fechaCreacion . }
                OPTIONAL { ?uri schema:dateModified ?fechaMod . }
            }
        }
        BIND(COALESCE(?pref, ?prefer, ?rlabel) AS ?label)
        FILTER(BOUND(?label))
        FILTER(LANG(?label) = "" || LANGMATCHES(LANG(?label), "es"))
    }
    """

    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    agrupadas = {}
    for b in bindings:
        uri = b["uri"]["value"]
        # Ignorar nodos raíz de esquema
        if uri.endswith("EventoMayor") or uri.endswith("#Localidad") or uri.endswith("/Localidad") or uri.endswith("/Barrio"):
            continue

        clase_val = b.get("clase", {}).get("value", "")
        super_val = b.get("superClase", {}).get("value", "")
        tipo_exp = b.get("tipoNombre", {}).get("value", "")

        tipo_calculado = clasificar_entidad_ttl(uri, clase_val, super_val, tipo_exp)

        # Filtrar si el frontend pidió ?tipo=Materia o ?tipo=Lugar
        if tipo:
            t_req = tipo.lower()
            if t_req == "materia" and tipo_calculado != "Materia":
                continue
            elif t_req == "lugar" and tipo_calculado != "Lugar":
                continue
            elif t_req not in ("materia", "lugar") and t_req not in tipo_calculado.lower():
                continue

        if uri not in agrupadas:
            id_corto = uri.rstrip("/").split("/")[-1].split("#")[-1]
            label_val = b["label"]["value"]
            fecha_c = b.get("fechaCreacion", {}).get("value", "2026-10-15T08:00:00")
            fecha_m = b.get("fechaMod", {}).get("value", fecha_c)

            agrupadas[uri] = {
                "id": id_corto,
                "_id": id_corto,
                "uri": uri,
                "prefLabel": label_val,
                "termino": label_val,
                "nombre": label_val,
                "tipo": tipo_calculado,
                "tipo_nombre": tipo_calculado,
                "altLabel": b.get("altLabel", {}).get("value", ""),
                "sinonimos": [],
                "fecha_creacion": fecha_c,
                "fecha_actualizacion": fecha_m,
            }

        alt = b.get("altLabel", {}).get("value")
        if alt and alt not in agrupadas[uri]["sinonimos"]:
            agrupadas[uri]["sinonimos"].append(alt)

    lista_final = list(agrupadas.values())
    lista_final.sort(key=lambda x: x["prefLabel"])
    return lista_final


# ==========================================
# 2. OBTENER DETALLE DE UNA AUTORIDAD POR ID
# ==========================================
@router.get("/{id_sufijo}")
async def obtener_autoridad(id_sufijo: str):
    id_decodificado = unquote(id_sufijo)
    sparql = f"""
    SELECT ?uri ?p ?o
    WHERE {{
        {{
            ?uri ?p ?o .
            FILTER(STRENDS(STR(?uri), "/{id_decodificado}") || STRENDS(STR(?uri), "#{id_decodificado}") || STRENDS(STR(?uri), "{id_decodificado}"))
        }}
        UNION
        {{
            GRAPH ?g {{
                ?uri ?p ?o .
                FILTER(STRENDS(STR(?uri), "/{id_decodificado}") || STRENDS(STR(?uri), "#{id_decodificado}") || STRENDS(STR(?uri), "{id_decodificado}"))
            }}
        }}
    }}
    """
    res = await fuseki_client.execute_query(sparql)
    bindings = res.get("results", {}).get("bindings", [])

    if not bindings:
        raise HTTPException(status_code=404, detail="Autoridad no encontrada en Fuseki")

    uri_real = bindings[0]["uri"]["value"]
    detalle = {
        "id": id_decodificado,
        "uri": uri_real,
        "nombre": "",
        "tipo_nombre": clasificar_entidad_ttl(uri_real, "", "", ""),
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

        if pred.endswith(("prefLabel", "preferLabel")) and not detalle["nombre"]:
            detalle["nombre"] = obj
        elif pred.endswith("#label") and not detalle["nombre"]:
            detalle["nombre"] = obj
        elif pred.endswith("#tipoNombre"):
            detalle["tipo_nombre"] = obj
        elif pred.endswith(("definition", "description")):
            detalle["descripcion_breve"] = obj
        elif pred.endswith(("altLabel", "hiddenLabel")):
            if obj not in detalle["alias"]:
                detalle["alias"].append(obj)
        elif pred.endswith(("source", "fuenteAutoridad")):
            if obj not in detalle["referencias_externas"]:
                detalle["referencias_externas"].append(obj)
        elif pred.endswith(("sameAs", "exactMatch")):
            detalle["enlaces_externos"].append({"tipo": "Wikidata / Externo", "enlace": obj, "fuente": ""})
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


def construir_tripletas_autoridad(uri: str, data: AutoridadCompletaPayload, fecha_creacion: str, fecha_mod: str) -> str:
    termino = (data.nombre or data.pref_label or "").strip()
    tipo_raw = (data.tipo_nombre or data.tipo or "Agente").strip()

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
        f"<{uri}> <http://www.w3.org/2004/02/skos/core#prefLabel> {format_literal(termino)}@es .",
        f'<{uri}> <http://schema.org/dateCreated> "{fecha_creacion}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
        f'<{uri}> <http://schema.org/dateModified> "{fecha_mod}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .',
    ]

    if data.descripcion_breve:
        triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#definition> {format_literal(data.descripcion_breve)}@es .")

    for al in (data.alias or []):
        if al and al.strip():
            triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#altLabel> {format_literal(al.strip())}@es .")

    for ref in (data.referencias_externas or []):
        if ref and ref.strip():
            triples.append(f"<{uri}> <http://proyecto-noticias.org/core#fuenteAutoridad> {format_literal(ref.strip())} .")

    for enl in (data.enlaces_externos or []):
        if enl.enlace and enl.enlace.strip():
            tipo_enl = enl.tipo if enl.tipo else "Enlace"
            fuente_enl = enl.fuente if enl.fuente else ""
            valor_enl = f"{tipo_enl}|{enl.enlace.strip()}|{fuente_enl}"
            triples.append(f"<{uri}> <http://proyecto-noticias.org/core#enlaceExterno> {format_literal(valor_enl)} .")

    for n in (data.notas or []):
        if n.texto and n.texto.strip():
            tipo_nota = n.tipo if n.tipo else "General"
            flag_staff = "1" if n.soloStaff else "0"
            valor_nota = f"{tipo_nota}|{n.texto.strip()}|{flag_staff}"
            triples.append(f"<{uri}> <http://www.w3.org/2004/02/skos/core#note> {format_literal(valor_nota)} .")

    return "\n            ".join(triples)


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