import hashlib
import time
import re
from datetime import datetime
from bs4 import BeautifulSoup
import feedparser
import requests
import schedule

# ==========================================
# CONFIGURACIÓN DEL SISTEMA
# ==========================================
BACKEND_URL = "http://localhost:8000"
KEYCLOAK_URL = "http://localhost:8080/realms/noticias-realm/protocol/openid-connect/token"
CLIENT_ID = "noticias-frontend"
BOT_USER = "bot_ingesta"
BOT_PASS = "BotIngesta2026*"

FECHA_MINIMA = datetime(2026, 1, 1)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

session = requests.Session()
session.headers.update(HEADERS)

token_actual = None

# ==========================================
# 10 FUENTES EXACTAS RECUPERADAS
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
# AUTENTICACIÓN KEYCLOAK
# ==========================================
def obtener_token():
    global token_actual
    try:
        resp = session.post(
            KEYCLOAK_URL,
            data={
                "client_id": CLIENT_ID,
                "grant_type": "password",
                "username": BOT_USER,
                "password": BOT_PASS,
            },
            timeout=8
        )
        resp.raise_for_status()
        token_actual = resp.json()["access_token"]
        return token_actual
    except Exception as e:
        print(f"✘ Error autenticando con Keycloak: {e}")
        return None

# ==========================================
# REGLAS DE FILTRADO Y SEMÁNTICA
# ==========================================
LISTA_NEGRA = [
    "horóscopo", "farándula", "lotería", "chance", "signos del zodiaco",
    "rock al parque", "concierto", "cine gratis", "feria de empleo", "vacantes",
    "arriendo", "acueducto", "tubo roto", "corte de agua", "respiratorio",
    "pico y placa", "movilidad hoy", "campo de golf", "turismo"
]

ACTORES_CRITICOS = [
    "disidencias", "disidente", "eln", "clan del golfo", "mordisco", "calarcá",
    "atentado", "explosivos", "secuestro", "emboscada", "hostigamiento", "reclutamiento",
    "sicario", "sicariato", "homicidio", "asesinato", "fuerza pública"
]

def es_ruido(titulo, resumen):
    texto = f"{titulo or ''} {resumen or ''}".lower()
    
    # Si menciona actores o acciones armadas prioritarias, NO es ruido
    if any(re.search(rf"\b{re.escape(act)}\b", texto) for act in ACTORES_CRITICOS):
        return False
        
    return any(re.search(rf"\b{re.escape(p)}\b", texto) for p in LISTA_NEGRA)

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

def buscar_materia_fuseki(titulo, resumen=""):
    texto = f"{titulo} {resumen}".lower()
    try:
        resp = session.get(f"{BACKEND_URL}/api/autoridades?tipo=Materia", timeout=6)
        if resp.status_code == 200:
            materias = resp.json()
            
            # Coincidencia directa con etiquetas de autoridades existentes
            for mat in materias:
                nombre = (mat.get("prefLabel") or "").strip().lower()
                if len(nombre) > 3 and re.search(rf"\b{re.escape(nombre)}\b", texto):
                    return mat["uri"], mat.get("prefLabel")

            # Mapeos semánticos clave
            reglas = [
                (r"\b(asesinat|homicidi|sicari|mataron|crimen|acribill)\w*", "homicidio"),
                (r"\b(atentad|bomba|explosiv|cilindro)\w*", "atentado"),
                (r"\b(captur|judicializ|a la cárcel|a prisión|detenid)\w*", "orden público")
            ]
            for regex, keyword in reglas:
                if re.search(regex, texto):
                    encontrada = next((m for m in materias if keyword in m.get("prefLabel", "").lower()), None)
                    if encontrada:
                        return encontrada["uri"], encontrada.get("prefLabel")

            # Fallback solo si es un hecho de orden público comprobado
            if any(k in texto for k in ACTORES_CRITICOS) and materias:
                return materias[0]["uri"], materias[0].get("prefLabel")
    except Exception:
        pass

    return None, None

# ==========================================
# ENVÍO DE TITULAR A FASTAPI -> FUSEKI
# ==========================================
def guardar_titular(encabezado, resumen, url_fuente, fecha_publicacion, fuente_nombre="Bot"):
    global token_actual

    if not encabezado or not url_fuente:
        return

    if es_ruido(encabezado, resumen):
        print(f"⏭ Descartado por ruido: {encabezado[:50]}...")
        return

    if not es_fecha_valida(fecha_publicacion):
        print(f"⏭ Descartado por fecha antigua: {encabezado[:50]}...")
        return

    materia_uri, cat_nombre = buscar_materia_fuseki(encabezado, resumen)
    if not materia_uri:
        print(f"⏭ Omitido (no es orden público): {encabezado[:50]}...")
        return

    id_sufijo = f"bot_{hashlib.sha256(url_fuente.encode('utf-8')).hexdigest()[:14]}"

    if isinstance(fecha_publicacion, time.struct_time):
        fecha_iso = datetime(*fecha_publicacion[:6]).isoformat()
    elif isinstance(fecha_publicacion, datetime):
        fecha_iso = fecha_publicacion.isoformat()
    else:
        fecha_iso = datetime.utcnow().isoformat()

    payload = {
        "id_sufijo": id_sufijo,
        "titulo": encabezado.strip(),
        "cuerpo": (resumen.strip() if resumen and len(resumen.strip()) > 0 else encabezado.strip()),
        "fuente": fuente_nombre,
        "fecha_publicacion": fecha_iso,
        "fecha_actualizacion": None,
        "materia_uri": materia_uri,
        "eventos": []
    }

    if not token_actual:
        obtener_token()

    headers = {
        "Authorization": f"Bearer {token_actual}",
        "Content-Type": "application/json"
    }

    try:
        resp = session.post(f"{BACKEND_URL}/api/noticias", json=payload, headers=headers, timeout=8)

        # Si el token expiró, renovar e intentar una vez
        if resp.status_code == 401:
            obtener_token()
            headers["Authorization"] = f"Bearer {token_actual}"
            resp = session.post(f"{BACKEND_URL}/api/noticias", json=payload, headers=headers, timeout=8)

        if resp.status_code == 200:
            print(f"✔ Guardado en Fuseki: {encabezado[:48]}... [{cat_nombre}]")
        elif resp.status_code == 400:
            print(f"⏭ Duplicado o ya existente: {encabezado[:48]}...")
    except Exception as e:
        print(f"✘ Error al guardar: {encabezado[:40]} | {e}")

# ==========================================
# PROCESAMIENTO DE FUENTES
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
            fecha = getattr(item, "published_parsed", None) or getattr(item, "updated_parsed", None) or datetime.utcnow()
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

            guardar_titular(item["titulo"], resumen, item["link"], datetime.utcnow(), fuente["nombre"])
    except Exception as e:
        print(f"✘ Error al scrapear {fuente['nombre']}: {e}")

# ==========================================
# EJECUCIÓN PROGRAMADA
# ==========================================
def ejecutar_barrido():
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Iniciando barrido completo...")
    for f in FUENTES:
        if f["tipo"] == "rss":
            procesar_rss(f)
        elif f["tipo"] == "scraping" and f["nombre"] == "Alerta Bogotá":
            scrapear_alerta_bogota(f)
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Barrido completado.")

if __name__ == "__main__":
    print("Bot de Ingesta en Python iniciado.")
    ejecutar_barrido()

    schedule.every().day.at("07:00").do(ejecutar_barrido)
    schedule.every().day.at("12:00").do(ejecutar_barrido)

    while True:
        schedule.run_pending()
        time.sleep(1)