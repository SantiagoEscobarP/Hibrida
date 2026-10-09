from fastapi import APIRouter, Depends
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

@router.post("", dependencies=[Depends(require_role("analista"))])
async def registrar_noticia(data: TitularNoticiaCreate):
    noticia_uri = f"http://proyecto-noticias.org/news/{data.id_sufijo}"
    
    triples = []
    
    # 1. Metadatos del Titular (Noticia)
    triples.append(f"<{noticia_uri}> a <http://schema.org/NewsArticle> .")
    triples.append(f"<{noticia_uri}> <http://schema.org/headline> {format_literal(data.titulo)} .")
    triples.append(f"<{noticia_uri}> <http://schema.org/articleBody> {format_literal(data.cuerpo)} .")
    triples.append(f"<{noticia_uri}> <http://schema.org/publisher> {format_literal(data.fuente)} .")
    triples.append(f'<{noticia_uri}> <http://schema.org/datePublished> "{data.fecha_publicacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .')
    triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#tieneMateria> <{data.materia_uri}> .")
    
    if data.fecha_actualizacion:
        triples.append(f'<{noticia_uri}> <http://schema.org/dateModified> "{data.fecha_actualizacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> .')

    # 2. Eventos Relacionados
    for ev in data.eventos:
        ev_uri = f"http://proyecto-noticias.org/events/{ev.id_sufijo}"
        
        # Conexión Titular -> Evento
        triples.append(f"<{noticia_uri}> <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> .")
        
        # Propiedades del Evento
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

        # 3. Agentes Involucrados por Evento (Nodos anónimos estructurados)
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