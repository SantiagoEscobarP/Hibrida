from fastapi import APIRouter, Depends
from schemas.noticia import TitularNoticiaCreate
from services.fuseki_client import fuseki_client
from core.security import require_role

router = APIRouter(prefix="/api/noticias", tags=["Noticias"])

@router.post("", dependencies=[Depends(require_role("analista"))])
async def registrar_noticia(data: TitularNoticiaCreate):
    noticia_uri = f"http://proyecto-noticias.org/news/{data.id_sufijo}"
    triples = [
        f"<{noticia_uri}> a <http://schema.org/NewsArticle> ;",
        f'  <http://schema.org/headline> "{data.titulo}" ;',
        f'  <http://schema.org/articleBody> "{data.cuerpo}" ;',
        f'  <http://schema.org/publisher> "{data.fuente}" ;',
        f'  <http://schema.org/datePublished> "{data.fecha_publicacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;',
        f'  <http://proyecto-noticias.org/core#tieneMateria> <{data.materia_uri}> ;'
    ]
    
    if data.fecha_actualizacion:
        triples.append(f'  <http://schema.org/dateModified> "{data.fecha_actualizacion.isoformat()}"^^<http://www.w3.org/2001/XMLSchema#dateTime> ;')

    event_triples = []
    for ev in data.eventos:
        ev_uri = f"http://proyecto-noticias.org/events/{ev.id_sufijo}"
        triples.append(f"  <http://proyecto-noticias.org/core#relataEvento> <{ev_uri}> ;")
        
        event_triples.extend([
            f"<{ev_uri}> a <http://proyecto-noticias.org/core#Evento> ;",
            f'  <http://proyecto-noticias.org/core#tituloEvento> "{ev.titulo}" ;',
            f'  <http://schema.org/abstract> "{ev.resumen or ""}" ;',
            f'  <http://proyecto-noticias.org/core#municipio> <{ev.municipio_uri}> ;',
            f'  <http://proyecto-noticias.org/core#tieneMateria> <{ev.materia_uri}> ;'
        ])
        if ev.codigo_clasificacion:
            event_triples.append(f'  <http://proyecto-noticias.org/core#codigoClasificacion> "{ev.codigo_clasificacion}" ;')
        
        # Agentes involucrados (nodos anónimos reificados)
        for ag in ev.agentes:
            ag_triplet = f"""
            <{ev_uri}> <http://proyecto-noticias.org/core#involucraAgente> [
                a <http://proyecto-noticias.org/core#Involucramiento> ;
                <http://proyecto-noticias.org/core#tieneAutoridad> <{ag.autoridad_uri}> ;
                <http://proyecto-noticias.org/core#tipoParticipacion> <http://proyecto-noticias.org/core#{ag.tipo_participacion}> ;
                <http://proyecto-noticias.org/core#tipoAfiliacion> "{ag.tipo_afiliacion or ''}" ;
                <http://proyecto-noticias.org/core#rol> "{ag.rol or ''}"
            ] .
            """
            event_triples.append(ag_triplet)

    # Ajustar formato RDF del titular principal
    triples_str = "\n".join(triples)
    if triples_str.endswith(";"):
        triples_str = triples_str[:-1] + "."

    events_str = "\n".join(event_triples)

    update_sparql = f"""
    INSERT DATA {{
        GRAPH <http://proyecto-noticias.org/graph/news> {{
            {triples_str}
            {events_str}
        }}
    }}
    """
    await fuseki_client.execute_update(update_sparql)
    return {"message": "Noticia y eventos indexados exitosamente", "uri": noticia_uri}