from fastapi import APIRouter, Depends, HTTPException
from schemas.autoridad import AutoridadCreate
from services.fuseki_client import fuseki_client
from core.security import require_role

router = APIRouter(prefix="/api/autoridades", tags=["Autoridades"])

@router.post("", dependencies=[Depends(require_role("analista"))])
async def crear_autoridad(data: AutoridadCreate):
    uri = f"http://proyecto-noticias.org/authorities/{data.id_sufijo}"
    
    triples = [
        f"<{uri}> a <http://proyecto-noticias.org/core#{data.tipo_autoridad}> ;",
        f'  <http://www.w3.org/2004/02/skos/core#prefLabel> "{data.termino_autorizado}"@{data.idioma} ;'
    ]
    
    if data.termino_alternativo:
        triples.append(f'  <http://www.w3.org/2004/02/skos/core#altLabel> "{data.termino_alternativo}"@{data.idioma} ;')
    if data.descripcion:
        triples.append(f'  <http://schema.org/description> "{data.descripcion}" ;')
    if data.latitud and data.longitud:
        triples.append(f'  <http://schema.org/latitude> "{data.latitud}"^^<http://www.w3.org/2001/XMLSchema#float> ;')
        triples.append(f'  <http://schema.org/longitude> "{data.longitud}"^^<http://www.w3.org/2001/XMLSchema#float> ;')
    if data.direccion:
        triples.append(f'  <http://schema.org/streetAddress> "{data.direccion}" ;')
    if data.sitio_web:
        triples.append(f'  <http://schema.org/url> <{data.sitio_web}> ;')
    if data.esta_ubicado_en:
        triples.append(f'  <http://proyecto-noticias.org/core#estaUbicadoEn> <{data.esta_ubicado_en}> ;')
    if data.relacionado_con:
        triples.append(f'  <http://www.w3.org/2004/02/skos/core#related> <{data.relacionado_con}> ;')
    if data.integrante_de:
        triples.append(f'  <http://schema.org/memberOf> <{data.integrante_de}> ;')
    if data.wikidata:
        triples.append(f'  <http://schema.org/sameAs> <{data.wikidata}> ;')
    if data.notas:
        triples.append(f'  <http://www.w3.org/2004/02/skos/core#note> "{data.notas}" ;')

    # Reemplazar el punto y coma final por un punto
    triples_str = "\n".join(triples)
    if triples_str.endswith(";"):
        triples_str = triples_str[:-1] + "."

    update_sparql = f"""
    INSERT DATA {{
        GRAPH <http://proyecto-noticias.org/graph/authorities> {{
            {triples_str}
        }}
    }}
    """
    await fuseki_client.execute_update(update_sparql)
    return {"message": "Autoridad creada exitosamente", "uri": uri}


@router.get("")
async def listar_autoridades(tipo: str = None):
    filtro_tipo = f"?uri a <http://proyecto-noticias.org/core#{tipo}> ." if tipo else "?uri a ?tipo ."
    query = f"""
    SELECT ?uri ?tipo ?prefLabel ?altLabel WHERE {{
        GRAPH <http://proyecto-noticias.org/graph/authorities> {{
            {filtro_tipo}
            ?uri <http://www.w3.org/2004/02/skos/core#prefLabel> ?prefLabel .
            OPTIONAL {{ ?uri <http://www.w3.org/2004/02/skos/core#altLabel> ?altLabel }}
        }}
    }}
    """
    res = await fuseki_client.execute_query(query)
    items = []
    for b in res.get("results", {}).get("bindings", []):
        items.append({
            "uri": b["uri"]["value"],
            "tipo": tipo if tipo else b.get("tipo", {}).get("value", "").split("#")[-1],
            "prefLabel": b["prefLabel"]["value"],
            "altLabel": b.get("altLabel", {}).get("value")
        })
    return items