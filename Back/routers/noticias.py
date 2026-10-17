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
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?noticiaUri ?encabezado ?cuerpo ?fuente ?fechaPub ?materiaUri ?materiaLabel ?eventoUri ?municipioLabel
    WHERE {
        GRAPH <http://proyecto-noticias.org/graph/news> {
            ?noticiaUri a schema:NewsArticle ;
                        schema:headline ?encabezado .
            OPTIONAL { ?noticiaUri schema:articleBody ?cuerpo . }
            OPTIONAL { ?noticiaUri schema:publisher ?fuente . }
            OPTIONAL { ?noticiaUri schema:datePublished ?fechaPub . }
            OPTIONAL { ?noticiaUri core:tieneMateria ?materiaUri . }
            OPTIONAL {
                ?noticiaUri core:relataEvento ?eventoUri .
                OPTIONAL { ?eventoUri core:municipioTexto ?municipioLabel . }
            }
        }
        OPTIONAL {
            {
                OPTIONAL { ?materiaUri skos:prefLabel ?ml1 . }
                OPTIONAL { ?materiaUri skos:preferLabel ?ml2 . }
            }
            UNION
            {
                GRAPH ?gMat {
                    OPTIONAL { ?materiaUri skos:prefLabel ?ml1 . }
                    OPTIONAL { ?materiaUri skos:preferLabel ?ml2 . }
                }
            }
            BIND(COALESCE(?ml1, ?ml2) AS ?materiaLabel)
        }
    }
    ORDER BY DESC(?fechaPub)
    """

    res = await fuseki_client.execute_query(sparql_query)
    bindings = res.get("results", {}).get("bindings", [])

    nombres_materias_fallback = {
        "mat_hurto": "Hurto",
        "Hurto": "Hurto",
        "Robo": "Robo",
        "mat_homicidio": "Homicidio",
        "Homicidio": "Homicidio",
        "AsesinatoSelectivo": "Asesinato selectivo",
        "mat_atentado": "Atentados terroristas",
        "AtentadosTerroristas": "Atentados terroristas",
        "Terrorismo": "Terrorismo",
        "mat_combates": "Enfrentamientos y acciones bélicas",
        "EnfrentamientosAccionesBelicas": "Enfrentamientos y acciones bélicas",
        "mat_detencion": "Detención",
        "Detencion": "Detención",
        "Disturbio": "Disturbio",
        "Manifestacion": "Manifestación",
        "Narcotrafico": "Narcotráfico",
        "Extorsion": "Extorsión",
        "Secuestro": "Secuestro",
        "ViolenciaSexual": "Violencia sexual",
        "ViolenciaIntrafamiliar": "Violencia intrafamiliar",
        "LesionesPersonales": "Lesiones Personales",
    }

    noticias_map = {}
    for b in bindings:
        uri = b["noticiaUri"]["value"]
        id_sufijo = uri.split("/")[-1]

        materia_uri = b.get("materiaUri", {}).get("value", "")
        materia_slug = materia_uri.rstrip("/").split("/")[-1].split("#")[-1] if materia_uri else ""
        materia_label = (
            b.get("materiaLabel", {}).get("value")
            or nombres_materias_fallback.get(materia_slug)
            or (materia_slug if materia_slug else "Sin categoría")
        )

        tiene_evento = "eventoUri" in b
        estado_calc = "OK" if tiene_evento else "Pendiente"
        municipio_label = b.get("municipioLabel", {}).get("value", "Bogotá D.C.")

        encabezado_val = b.get("encabezado", {}).get("value", "Sin título")
        cuerpo_val = b.get("cuerpo", {}).get("value", encabezado_val)
        fuente_val = b.get("fuente", {}).get("value", "Bot")
        fecha_val = b.get("fechaPub", {}).get("value", "")

        if uri not in noticias_map:
            noticias_map[uri] = {
                "_id": id_sufijo,
                "uri": uri,
                "encabezado": encabezado_val,
                "cuerpo": cuerpo_val,
                "resumen": cuerpo_val,
                "url_fuente": fuente_val,
                "fuente": fuente_val,
                "fecha_publicacion": fecha_val,
                "estado": estado_calc,
                "lugar": municipio_label,
                "municipio": municipio_label,
                "municipio_nombre": municipio_label,
                "materia_uri": materia_uri,
                "materia_nombre": materia_label,
                "categorias": [{"_id": materia_uri, "nombre": materia_label}],
            }
        else:
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