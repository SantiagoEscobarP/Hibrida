from fastapi import APIRouter, Depends, Query
from typing import Optional
from schemas.noticia import TitularNoticiaCreate
from services.fuseki_client import fuseki_client
from core.security import require_role

router = APIRouter(prefix="/api/noticias", tags=["Noticias"])

def format_literal(text: str) -> str:
    """Escapa y formatea literales multilínea limpios para SPARQL."""
    if not text:
        return '""'
    escaped = text.replace('\\', '\\\\').replace('"', '\\"')
    return f'"""{escaped}"""'


# ==========================================
# 1. GUARDAR NOTICIA EN FUSEKI (POST)
# ==========================================
@router.post("", dependencies=[Depends(require_role("analista"))])
async def registrar_noticia(data: TitularNoticiaCreate):
    noticia_uri = f"http://proyecto-noticias.org/news/{data.id_sufijo}"
    
    triples = []
    
    # Metadatos del Titular
    triples.append(f"<{noticia_uri}> a <http://schema.org/NewsArticle> .")
    triples.append(f"<{noticia_uri}> <http://schema.org/headline> {format_literal(data.titulo)} .")
    triples.append(f"<{noticia_uri}> <http://schema.org/articleBody> {format_literal(data.cuerpo)} .")
    triples.append(f"<{noticia_uri}> <http://schema.org/publisher> {format_literal(data.fuente)} .")
    triples.append(f'<{noticia_uri}> <http://schema.org/datePublished> "{data.fecha_publicacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .')
    triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#tieneMateria> <{data.materia_uri}> .")
    
    if data.fecha_actualizacion:
        triples.append(f'<{noticia_uri}> <http://schema.org/dateModified> "{data.fecha_actualizacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .')

    # Eventos Relacionados
    for ev in data.eventos:
        ev_uri = f"http://proyecto-noticias.org/events/{ev.id_sufijo}"
        triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> .")
        triples.append(f"<{ev_uri}> a <http://proyecto-noticias.org/core#Evento> .")
        triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#tituloEvento> {format_literal(ev.titulo)} .")
        triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#municipio> <{ev.municipio_uri}> .")
        triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#tieneMateria> <{ev.materia_uri}> .")
        
        if ev.titulo_alterno:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#tituloAlterno> {format_literal(ev.titulo_alterno)} .")
        if ev.resumen:
            triples.append(f"<{ev_uri}> <http://schema.org/abstract> {format_literal(ev.resumen)} .")
        if ev.subdivision_uri:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#subdivision> <{ev.subdivision_uri}> .")
        if ev.complemento:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#complemento> {format_literal(ev.complemento)} .")
        if ev.codigo_clasificacion:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#codigoClasificacion> {format_literal(ev.codigo_clasificacion)} .")
        if ev.tipo_fuente_materia:
            triples.append(f"<{ev_uri}> <http://proyecto-noticias.org/core#tipoFuenteMateria> {format_literal(ev.tipo_fuente_materia)} .")

        for ag in ev.agentes:
            if not ag.autoridad_uri:
                continue
            partes_agente = [
                "a <http://proyecto-noticias.org/core#Involucramiento>",
                f"<http://proyecto-noticias.org/core#tieneAutoridad> <{ag.autoridad_uri}>",
                f"<http://proyecto-noticias.org/core#tipoParticipacion> <http://proyecto-noticias.org/core#{ag.tipo_participacion}>"
            ]
            if ag.rol:
                partes_agente.append(f"<http://proyecto-noticias.org/core#rol> {format_literal(ag.rol)}")
            if ag.tipo_afiliacion:
                partes_agente.append(f"<http://proyecto-noticias.org/core#tipoAfiliacion> {format_literal(ag.tipo_afiliacion)}")
            if ag.autor:
                partes_agente.append(f"<http://proyecto-noticias.org/core#autor> {format_literal(ag.autor)}")

            bloque_agente = " ;\n        ".join(partes_agente)
            triples.append(f"""<{ev_uri}> <http://proyecto-noticias.org/core#involucraAgente> [
        {bloque_agente}
    ] .""")

    cuerpo_tripletas = "\n    ".join(triples)
    update_sparql = f"""
    INSERT DATA {{
        GRAPH <http://proyecto-noticias.org/graph/news> {{
            {cuerpo_tripletas}
        }}
    }}
    """
    await fuseki_client.execute_update(update_sparql)
    return {"message": "Noticia y eventos indexados exitosamente", "uri": noticia_uri}


# ==========================================
# 2. LISTAR TITULARES PARA TitularesPage.jsx (GET)
# ==========================================
@router.get("")
async def listar_titulares():
    sparql_query = """
    PREFIX schema: <http://schema.org/>
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT ?noticiaUri ?encabezado ?cuerpo ?fuente ?fechaPub ?materiaUri ?materiaLabel ?eventoUri ?municipioLabel
    WHERE {
        GRAPH <http://proyecto-noticias.org/graph/news> {
            ?noticiaUri a schema:NewsArticle ;
                        schema:headline ?encabezado ;
                        schema:articleBody ?cuerpo ;
                        schema:publisher ?fuente ;
                        schema:datePublished ?fechaPub .
            
            OPTIONAL { ?noticiaUri core:tieneMateria ?materiaUri . }
            OPTIONAL {
                ?noticiaUri core:relataEvento ?eventoUri .
                OPTIONAL { ?eventoUri core:municipio ?municipioUri . }
            }
        }
        OPTIONAL {
            GRAPH <http://proyecto-noticias.org/graph/authorities> {
                ?materiaUri skos:prefLabel ?materiaLabel .
            }
        }
        OPTIONAL {
            GRAPH <http://proyecto-noticias.org/graph/authorities> {
                ?municipioUri skos:prefLabel ?municipioLabel .
            }
        }
    }
    ORDER BY DESC(?fechaPub)
    """

    res = await fuseki_client.execute_query(sparql_query)
    bindings = res.get("results", {}).get("bindings", [])

    noticias_map = {}
    for b in bindings:
        uri = b["noticiaUri"]["value"]
        id_sufijo = uri.split("/")[-1]

        materia_uri = b.get("materiaUri", {}).get("value", "")
        materia_label = b.get("materiaLabel", {}).get("value")
        if not materia_label:
            # Si no tiene etiqueta en authorities, limpiamos el final de la URI
            materia_label = materia_uri.split("/")[-1].replace("mat_", "").replace("_", " ").capitalize() if materia_uri else "Sin categoría"

        tiene_evento = "eventoUri" in b
        estado_calc = "OK" if tiene_evento else "Pendiente"
        municipio_label = b.get("municipioLabel", {}).get("value", "Bogotá D.C.")

        if uri not in noticias_map:
            noticias_map[uri] = {
                "_id": id_sufijo,
                "uri": uri,
                "encabezado": b["encabezado"]["value"],
                "resumen": b["cuerpo"]["value"],
                "url_fuente": b["fuente"]["value"],
                "fuente": b["fuente"]["value"],
                "fecha_publicacion": b["fechaPub"]["value"],
                "estado": estado_calc,
                "lugar": municipio_label,
                "municipio": municipio_label,
                "categorias": [{"_id": materia_uri, "nombre": materia_label}] if materia_label else []
            }
        else:
            # Si ya existe y aparece un evento asociado, aseguramos estado OK
            if tiene_evento:
                noticias_map[uri]["estado"] = "OK"

    return list(noticias_map.values())


# ==========================================
# 3. CONTEO POR MATERIA PARA MateriasPage.jsx (GET)
# ==========================================
@router.get("/materias-conteo")
async def conteo_por_materias(
    fechaDesde: Optional[str] = Query(None),
    fechaHasta: Optional[str] = Query(None)
):
    titulares = await listar_titulares()
    conteo = {}

    for item in titulares:
        fecha_pub = item.get("fecha_publicacion", "")[:10]  # YYYY-MM-DD
        if fechaDesde and fecha_pub < fechaDesde:
            continue
        if fechaHasta and fecha_pub > fechaHasta:
            continue

        estado = item.get("estado", "Pendiente")
        categorias = item.get("categorias", [])
        nombre_cat = categorias[0]["nombre"] if categorias else "Sin categoría"

        clave = (nombre_cat, estado)
        conteo[clave] = conteo.get(clave, 0) + 1

    # Formato compatible con MateriasPage.jsx
    resultado = []
    for (cat_nombre, est), total in conteo.items():
        resultado.append({
            "_id": {"categoria": cat_nombre, "estado": est},
            "total": total
        })

    return resultado