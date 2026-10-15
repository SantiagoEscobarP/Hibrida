Para documentar este proyecto de manera profesional y completa, he preparado un **README.md** estructurado desde cero. Cobre toda la evolución técnica: la autenticación con **Keycloak (OIDC/JWT)**, el almacenamiento semántico en **Apache Jena Fuseki (TDB2 / RDF)**, el backend en **FastAPI**, el frontend en **React con diseño PressIndex**, el bot de ingesta automatizada y la arquitectura en **Docker Compose**.

Puedes copiar este contenido directamente y guardarlo como **`README.md`** en la raíz de tu repositorio `Hibrida`.

---

```markdown
# PressIndex: Sistema de Indexación de Noticias de Orden Público con Datos Enlazados y RDF

PressIndex es una plataforma full-stack orientada al procesamiento, catalogación semántica y exploración de noticias de orden público en Colombia. El sistema transforma artículos de prensa y feeds RSS en tripletas RDF almacenadas en un triplestore, estructurándolas mediante vocabularios controlados (`SKOS`, `Schema.org`, ontología propia) y protegiendo sus endpoints mediante autenticación centralizada OIDC/JWT.

---

## 🏛️ Arquitectura del Sistema


```

```
              ┌───────────────────────────────┐
              │      Fuentes Externas         │
              │ (RSS / Scrapers / Periódicos) │
              └───────────────┬───────────────┘
                              │
                              ▼
                 [ Bot de Ingesta (Python) ]
                              │
                              ├─► Autenticación M2M (OAuth2 / OIDC)
                              ▼
                 [ Backend FastAPI (Puerto 8000) ]
                              │
                              ├─► Validación JWT (Keycloak)
                              ├─► Consultas & Actualizaciones SPARQL
                              ▼
              ┌───────────────────────────────┐
              │  Apache Jena Fuseki (TDB2)    │
              │  (Grafo News + Authorities)   │
              └───────────────▲───────────────┘
                              │
                              │ SPARQL SELECT / UPDATE
                              │
              ┌───────────────┴───────────────┐
              │    Frontend React + Vite      │
              │        (Puerto 5173)          │
              └───────────────────────────────┘

```

```

---

## 🛠️ Stack Tecnológico

* **Capa de Datos y Semántica:** Apache Jena Fuseki (TDB2) con soporte para grafos nombrados (`/graph/news`, `/graph/authorities`, `/graph/config`).
* **Seguridad e Identidad:** Keycloak (Realm: `noticias-realm`, flujo OIDC / Resource Server JWT).
* **Backend:** Python con FastAPI, Httpx, PyJWT y Uvicorn.
* **Frontend:** React, React Router DOM, Vite y diseño visual unificado (PressIndex UI).
* **Bot de Ingesta:** Python (Feedparser, BeautifulSoup, Requests, Schedule) / Script Node.js opcional.
* **Orquestación:** Docker y Docker Compose.

---

## 📂 Estructura del Repositorio

```text
Hibrida/
├── Back/
│   ├── core/           # Configuración (config.py) y seguridad JWT (security.py)
│   ├── routers/        # Endpoints de FastAPI (noticias.py, autoridades.py, eventos.py, admin_config.py)
│   ├── services/       # Cliente SPARQL de Fuseki (fuseki_client.py)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ # Navbar.jsx
│   │   ├── pages/      # HomePage, TitularesPage, MateriasPage, AutoridadesPage, BuscadorPage, Admin...
│   │   ├── App.jsx     # Enrutamiento protegido por roles
│   │   └── index.css   # Sistema de diseño global curvo
│   ├── Dockerfile
│   └── package.json
├── bot_crawler/        # Scripts de ingesta y scraping automático
└── docker-compose.yml  # Orquestación de contenedores

```

---

## 🚀 Guía de Instalación y Puesta en Marcha

### Prerrequisitos

* Docker y Docker Compose instalados.
* Node.js (v18+) y Python (v3.11+).

### 1. Clonar y Levantar Contenedores

En la raíz del proyecto, asegúrate de que el archivo `docker-compose.yml` contenga los servicios de Fuseki, Keycloak, Backend y Frontend:

```bash
docker compose up -d --build

```

Esto dejará operativos los siguientes servicios:

* **Frontend (React):** `http://localhost:5173`
* **Backend API (FastAPI):** `http://localhost:8000`
* **Apache Jena Fuseki:** `http://localhost:3030` (Dataset: `noticias_op`)
* **Keycloak Admin:** `http://localhost:8080` (Realm: `noticias-realm`)

---

## 🔐 Configuración de Keycloak (Identidad y Roles)

1. Ingresa a `http://localhost:8080/admin` las credenciales que estén en el .env.
2. Crea un Realm llamado **`noticias-realm`**.
3. Configura el cliente de la aplicación (ej. `noticias-frontend`) con soporte para **Direct Access Grants** activo.
4. Crea los usuarios analistas/indexadores y asígnales los roles correspondientes (ej. `analista`, `superusuario`, `indexador`).

---

## 🤖 Bot de Ingesta de Noticias

El bot captura de forma automática artículos y feeds RSS de 10 fuentes (El Tiempo, El Espectador, Q'hubo, Fiscalía, Policía, Alerta Bogotá, Secretaría de Seguridad), filtra ruido y los indexa en Fuseki vía FastAPI.

Para ejecutarlo localmente:

```bash
cd bot_crawler
python -m venv venv
# Activar entorno virtual (source venv/bin/activate o venv\Scripts\activate)
pip install -r requirements.txt
python bot_noticias.py

```

---

## 🔍 Modelado Semántico y Grafos (SPARQL)

El sistema emplea ontologías ligeras basadas en SKOS y Schema.org distribuidas en tres grafos principales:

* **`http://proyecto-noticias.org/graph/authorities`**: Catálogo unificado de Materias, Lugares, Personas y Grupos Criminales.
* **`http://proyecto-noticias.org/graph/news`**: Almacena los `NewsArticle` (Titulares) y los `core:Evento` enlazados mediante propiedades como `core:tieneMateria`, `core:relataEvento` e `involucraAgente`.
* **`http://proyecto-noticias.org/graph/config`**: Parámetros operativos del bot (fuentes activas y lista negra de palabras).

```
