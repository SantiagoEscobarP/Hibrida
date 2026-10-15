import hashlib
import time
import re
from datetime import datetime
from bs4 import BeautifulSoup
import feedparser
import requests
import schedule

# ==========================================
# CONEXIÓN DIRECTA A FUSEKI (PUERTO 3030)
# ==========================================
FUSEKI_QUERY_URL = "http://localhost:3030/noticias_op/query"
FUSEKI_UPDATE_URL = "http://localhost:3030/noticias_op/update"
FUSEKI_AUTH = ("admin", "admin123")  # Funciona con o sin clave en Fuseki

FECHA_MINIMA = datetime(2026, 1, 1)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

session = requests.Session()
session.headers.update(HEADERS)

# ==========================================
# 10 FUENTES ACTIVAS
# ==========================================
FUENTES = [
    {
        "nombre": "El Tiempo - Delitos",
        "tipo": "rss",
        "url": "https://www.eltiempo.com/rss/justicia_delitos.xml"
    },
    {
        "nombre": "El Espectador - Bogotá",
        "tipo": "rss",
        "url": "https://www.elespectador.com/arc/outboundfeeds/discover/category/bogota/?outputType=xml"
    },
    {
        "nombre": "El Espectador - Judicial",
        "tipo": "rss",
        "url": "https://www.elespectador.com/arc/outboundfeeds/discover/category/judicial/?outputType=xml"
    },
    {
        "nombre": "Q'hubo Bogotá",
        "tipo": "rss",
        "url": "https://www.qhubobogota.com/feed/"
    },
    {
        "nombre": "Fiscalía General de la Nación",
        "tipo": "rss",
        "url": "https://www.fiscalia.gov.co/feed/"
    },
    {
        "nombre": "El Tiempo - Bogotá",
        "tipo": "rss",
        "url": "https://www.eltiempo.com/rss/bogota.xml"
    },
    {
        "nombre": "El Tiempo - Justicia",
        "tipo": "rss",
        "url": "https://www.eltiempo.com/rss/justicia.xml"
    },
    {
        "nombre": "Alerta Bogotá",
        "tipo": "scraping",
        "url": "https://www.alerta.com.co/judiciales?zone=bogota"
    },
    {
        "nombre": "Secretaría Distrital de Seguridad",
        "tipo": "rss",
        "url": "https://www.scj.gov.co/rss.xml"
    },
    {
        "nombre": "Policía Nacional",
        "tipo": "rss",
        "url": "https://www.policia.gov.co/rss.xml"
    }
]

# ==========================================
# REGLAS DE FILTRADO Y MATERIAS RDF
# ==========================================
LISTA_NEGRA = [
    "horóscopo", "farándula", "lotería", "chance", "signos del zodiaco",
    "rock al parque", "concierto", "cine gratis", "feria de empleo", "vacantes",
    "arriendo", "acueducto", "tubo roto", "corte de agua", "respiratorio",
    "pico y placa", "campo de golf", "turismo", "becas", "colegio",
    "notificación por aviso", "respuesta ticket", "respuesta tikec", "respuesta queja"
]

INDICADORES_ORDEN_PUBLICO = [
    "robo", "robaron", "ladrones", "ladrón", "atrac", "hurto", "asalto", "fleteo",
    "captur", "detenid", "aprehend", "judicializ", "imputa", "condena", "cárcel", "prisión",
    "homicidi", "asesin", "sicari", "muerte", "muerto", "sin vida", "crimen", "dispar",
    "atentado", "bomba", "explosiv", "disturbios", "enfrentamiento", "combate",
    "disidencias", "mordisco", "clan del golfo", "eln", "tren de aragua",
    "banda", "extorsión", "amenaza", "operativo", "allanamiento", "fuga", "secuestro",
    "narcotráfico", "incauta", "estupefacientes", "microtráfico", "violencia", "abuso"
]

def escapar_sparql(texto: str) -> str:
    """Escapa comillas y barras para literales RDF en triples comillas."""
    if not texto:
        return ""
    return str(texto).replace("\\", "\\\\").replace('"', '\\"')

def es_ruido(titulo, resumen):
    texto = f"{titulo or ''} {resumen or ''}".lower()
    if any(re.search(rf"\b{re.escape(p)}\b", texto) for p in LISTA_NEGRA):
        return True
    return False

def es_fecha_valida(fecha_parsed):
    if not fecha_parsed:
        return True
    try:
        if isinstance(fecha_parsed, time.struct_time):
            fecha_dt = datetime(*fecha_parsed[:6])
        elif isinstance(fecha_parsed, datetime):
            fecha_dt = fecha_parsed
        else:
            fecha_dt = datetime.fromisoformat(str(fecha_parsed).replace("Z", ""))

        if fecha_dt.tzinfo:
            fecha_dt = fecha_dt.replace(tzinfo=None)

        return fecha_dt >= FECHA_MINIMA
    except Exception:
        return True

def asignar_materia_rdf(titulo, resumen=""):
    """Asigna exactamente las mismas URIs de materias del grafo de autoridades."""
    texto = f"{titulo} {resumen}".lower()

    reglas = [
        (r"\b(robo|robaron|ladron|atrac|hurto|asalto|fleteo)\w*", "http://proyecto-noticias.org/authorities/mat_hurto", "Hurto"),
        (r"\b(asesin|homicidi|sicari|mataron|crimen|acribill|muerto|muerte|sin vida|dispar)\w*", "http://proyecto-noticias.org/authorities/mat_homicidio", "Homicidio"),
        (r"\b(atentad|bomba|explosiv|cilindro|terroris)\w*", "http://proyecto-noticias.org/authorities/mat_atentado", "Atentado con Explosivos"),
        (r"\b(combate|enfrentamiento|hostigamiento|emboscada|disidencias|mordisco)\w*", "http://proyecto-noticias.org/authorities/mat_combates", "Combates"),
        (r"\b(captur|judicializ|imputa|condena|cárcel|prisión|detenid|aprehend|allanamiento|golpe|fuga)\w*", "http://proyecto-noticias.org/authorities/mat_detencion", "Detención"),
    ]

    for patron, uri, label in reglas:
        if re.search(patron, texto):
            return uri, label

    if any(re.search(rf"\b{re.escape(k)}\b", texto) for k in INDICADORES_ORDEN_PUBLICO):
        return "http://proyecto-noticias.org/authorities/mat_detencion", "Detención"

    return None, None

def ya_existe_en_fuseki(noticia_uri: str) -> bool:
    """Verifica en Fuseki (3030) si la noticia ya fue insertada antes."""
    sparql_ask = f"""
    ASK WHERE {{
        GRAPH <http://proyecto-noticias.org/graph/news> {{
            <{noticia_uri}> a <http://schema.org/NewsArticle> .
        }}
    }}
    """
    try:
        r = session.post(
            FUSEKI_QUERY_URL,
            data={"query": sparql_ask},
            headers={"Accept": "application/sparql-results+json"},
            auth=FUSEKI_AUTH,
            timeout=5
        )
        if r.status_code == 200:
            return r.json().get("boolean", False)
    except Exception:
        pass
    return False

# ==========================================
# GUARDADO DIRECTO EN FUSEKI (3030) EN FORMATO RDF
# ==========================================
def guardar_titular(encabezado, resumen, url_fuente, fecha_publicacion, fuente_nombre="Bot"):
    if not encabezado or not url_fuente:
        return

    if es_ruido(encabezado, resumen):
        print(f"⏭ Descartado por ruido: {encabezado[:55]}...")
        return

    if not es_fecha_valida(fecha_publicacion):
        print(f"⏭ Descartado por fecha antigua: {encabezado[:55]}...")
        return

    materia_uri, cat_nombre = asignar_materia_rdf(encabezado, resumen)
    if not materia_uri:
        print(f"⏭ Omitido (no es orden público): {encabezado[:55]}...")
        return

    id_sufijo = f"bot_{hashlib.sha256(url_fuente.encode('utf-8')).hexdigest()[:12]}"
    noticia_uri = f"http://proyecto-noticias.org/news/{id_sufijo}"

    if ya_existe_en_fuseki(noticia_uri):
        print(f"⏭ Ya existe en Fuseki: {encabezado[:50]}...")
        return

    if isinstance(fecha_publicacion, time.struct_time):
        fecha_iso = datetime(*fecha_publicacion[:6]).strftime("%Y-%m-%dT%H:%M:%S")
    elif isinstance(fecha_publicacion, datetime):
        fecha_iso = fecha_publicacion.strftime("%Y-%m-%dT%H:%M:%S")
    else:
        fecha_iso = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")

    titulo_limpio = escapar_sparql(encabezado.strip())
    cuerpo_limpio = escapar_sparql(resumen.strip() if resumen and resumen.strip() else encabezado.strip())
    fuente_limpia = escapar_sparql(fuente_nombre)

    # Mismo formato exacto INSERT DATA que subiste manualmente a Fuseki
    sparql_insert = f"""
    PREFIX core: <http://proyecto-noticias.org/core#>
    PREFIX schema: <http://schema.org/>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

    INSERT DATA {{
      GRAPH <http://proyecto-noticias.org/graph/news> {{
        <{noticia_uri}> a schema:NewsArticle ;
            schema:headline \"\"\"{titulo_limpio}\"\"\" ;
            schema:articleBody \"\"\"{cuerpo_limpio}\"\"\" ;
            schema:publisher \"\"\"{fuente_limpia}\"\"\" ;
            schema:datePublished "{fecha_iso}"^^xsd:dateTime ;
            core:tieneMateria <{materia_uri}> .
      }}
    }}
    """

    try:
        resp = session.post(
            FUSEKI_UPDATE_URL,
            data=sparql_insert.encode("utf-8"),
            headers={"Content-Type": "application/sparql-update"},
            auth=FUSEKI_AUTH,
            timeout=8
        )
        if resp.status_code in (200, 204):
            print(f"✔ Guardado en Fuseki (3030): {encabezado[:50]}... [{cat_nombre}]")
        else:
            print(f"✘ Error Fuseki ({resp.status_code}): {resp.text[:120]}")
    except Exception as e:
        print(f"✘ Error conectando a Fuseki (3030): {e}")

# ==========================================
# LECTURA DE FUENTES RSS Y SCRAPING
# ==========================================
def procesar_rss(fuente):
    try:
        resp = session.get(fuente["url"], timeout=10)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
        items = feed.entries or []

        print(f"\n--- {fuente['nombre']}: {len(items)} noticias leídas ---")
        for item in items:
            raw_summary = getattr(item, "summary", "") or getattr(item, "description", "")
            resumen_limpio = BeautifulSoup(raw_summary, "html.parser").get_text()[:400]
            fecha = getattr(item, "published_parsed", None) or getattr(item, "updated_parsed", None)
            guardar_titular(item.title, resumen_limpio, item.link, fecha, fuente["nombre"])
    except Exception as e:
        print(f"✘ Error al procesar RSS {fuente['nombre']}: {e}")

def scrapear_alerta_bogota(fuente):
    try:
        resp = session.get(fuente["url"], timeout=10)
        soup = BeautifulSoup(resp.text, "html.parser")
        items = []

        for card in soup.select(".news-1"):
            tag_a = card.select_one("h3.news-card-title a")
            if tag_a:
                titulo = tag_a.get_text(strip=True)
                href = tag_a.get("href")
                if href and not href.startswith("http"):
                    href = f"https://www.alerta.com.co{href}"
                if titulo and href:
                    items.append({"titulo": titulo, "link": href})

        print(f"\n--- {fuente['nombre']}: {len(items)} noticias encontradas ---")
        for item in items:
            resumen = ""
            try:
                r_item = session.get(item["link"], timeout=5)
                s_item = BeautifulSoup(r_item.text, "html.parser")
                meta_desc = s_item.find("meta", property="og:description")
                if meta_desc and meta_desc.get("content"):
                    resumen = meta_desc["content"].strip()
            except Exception:
                pass

            guardar_titular(item["titulo"], resumen, item["link"], None, fuente["nombre"])
    except Exception as e:
        print(f"✘ Error al scrapear {fuente['nombre']}: {e}")

def ejecutar_barrido():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Iniciando barrido directo hacia Fuseki (3030)...")
    for f in FUENTES:
        if f["tipo"] == "rss":
            procesar_rss(f)
        elif f["tipo"] == "scraping" and f["nombre"] == "Alerta Bogotá":
            scrapear_alerta_bogota(f)
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Barrido completado.")

if __name__ == "__main__":
    print("Bot de Ingesta RDF iniciado.")
    ejecutar_barrido()

    schedule.every().day.at("07:00").do(ejecutar_barrido)
    schedule.every().day.at("12:00").do(ejecutar_barrido)

    while True:
        schedule.run_pending()
        time.sleep(1)