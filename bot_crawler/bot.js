const RSSParser = require('rss-parser');
const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const crypto = require('crypto');

const parser = new RSSParser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// ===== CONFIGURACIÓN DEL PROYECTO =====
const BACKEND_URL = 'http://localhost:8000';
const KEYCLOAK_URL = 'http://localhost:8080/realms/noticias-realm/protocol/openid-connect/token';
const CLIENT_ID = 'noticias-frontend';
const BOT_USER = 'bot_ingesta';
const BOT_PASS = 'BotIngesta2026*';

const FECHA_MINIMA = new Date('2026-01-01');

// Lista de fuentes activas
const FUENTES = [
  {
    nombre: "El Tiempo - Delitos",
    tipo: "rss",
    url: "https://www.eltiempo.com/rss/justicia_delitos.xml"
  },
  {
    nombre: "El Espectador - Bogotá",
    tipo: "rss",
    url: "https://www.elespectador.com/arc/outboundfeeds/discover/category/bogota/?outputType=xml"
  },
  {
    nombre: "El Espectador - Judicial",
    tipo: "rss",
    url: "https://www.elespectador.com/arc/outboundfeeds/discover/category/judicial/?outputType=xml"
  },
  {
    nombre: "Q'hubo Bogotá",
    tipo: "rss",
    url: "https://www.qhubobogota.com/feed/"
  },
  {
    nombre: "Fiscalía General de la Nación",
    tipo: "rss",
    url: "https://www.fiscalia.gov.co/feed/"
  },
  {
    nombre: "El Tiempo - Bogotá",
    tipo: "rss",
    url: "https://www.eltiempo.com/rss/bogota.xml"
  },
  {
    nombre: "El Tiempo - Justicia",
    tipo: "rss",
    url: "https://www.eltiempo.com/rss/justicia.xml"
  },
  {
    nombre: "Alerta Bogotá",
    tipo: "scraping",
    url: "https://www.alerta.com.co/judiciales?zone=bogota"
  },
  {
    nombre: "Secretaría Distrital de Seguridad",
    tipo: "rss",
    url: "https://www.scj.gov.co/rss.xml"
  },
  {
    nombre: "Policía Nacional",
    tipo: "rss",
    url: "https://www.policia.gov.co/rss.xml"
  }
];

let tokenAcceso = null;

// ===== 1. AUTENTICACIÓN CON KEYCLOAK =====
async function obtenerToken() {
  try {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('grant_type', 'password');
    params.append('username', BOT_USER);
    params.append('password', BOT_PASS);

    const res = await axios.post(KEYCLOAK_URL, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    tokenAcceso = res.data.access_token;
    return tokenAcceso;
  } catch (error) {
    console.error('✘ Error obteniendo token de Keycloak:', error.response?.data || error.message);
    return null;
  }
}

// ===== 2. FILTRADO INTELIGENTE DE ORDEN PÚBLICO =====
const LISTA_NEGRA = [
  'horóscopo', 'farándula', 'lotería', 'chance', 'rock al parque', 'concierto',
  'feria de empleo', 'vacantes', 'arriendo', 'acueducto', 'tubo roto', 'corte de agua',
  'respiratorio', 'pico y placa', 'movilidad hoy', 'campo de golf', 'turismo', 'cine'
];

const ACTORES_CRITICOS = [
  'disidencias', 'disidente', 'eln', 'clan del golfo', 'mordisco', 'calarcá',
  'atentado', 'explosivos', 'secuestro', 'emboscada', 'hostigamiento', 'reclutamiento',
  'sicario', 'sicariato', 'homicidio', 'asesinato', 'armado', 'fuerza pública'
];

function esRuido(titulo, resumen) {
  const texto = `${titulo || ''} ${resumen || ''}`.toLowerCase();

  // Si contiene un actor o hecho armado prioritario, NUNCA se descarta
  const esCritico = ACTORES_CRITICOS.some(act => new RegExp(`\\b${act}\\b`, 'i').test(texto));
  if (esCritico) return false;

  // Si no es prioritario, verificamos palabras de la lista negra
  return LISTA_NEGRA.some(palabra => new RegExp(`\\b${palabra}\\b`, 'i').test(texto));
}

function esFechaValida(fechaPublicacion) {
  if (!fechaPublicacion) return true;
  const fecha = new Date(fechaPublicacion);
  return !isNaN(fecha.getTime()) && fecha >= FECHA_MINIMA;
}

// ===== 3. MATCHING CON MATERIAS DE FUSEKI =====
async function buscarMateriaEnFuseki(titulo, resumen = '') {
  const texto = `${titulo} ${resumen}`.toLowerCase();

  try {
    const res = await axios.get(`${BACKEND_URL}/api/autoridades?tipo=Materia`, { timeout: 4000 });
    const materias = res.data || [];

    // Match exacto con prefLabel o alias registrado en Fuseki
    for (const mat of materias) {
      const nombre = (mat.prefLabel || '').trim().toLowerCase();
      if (nombre.length > 3 && new RegExp(`\\b${nombre}\\b`, 'i').test(texto)) {
        return { uri: mat.uri, label: mat.prefLabel };
      }
    }

    // Reglas semánticas por patrones si la autoridad tiene nombre formal
    const reglas = [
      { regex: /\b(asesinat|homicidi|sicari|mataron|crimen|acribill)\w*/i, keyword: 'homicidio' },
      { regex: /\b(atentad|bomba|explosiv|cilindro)\w*/i, keyword: 'atentado' },
      { regex: /\b(combate|enfrentamiento|hostigamiento|emboscada)\w*/i, keyword: 'combate' },
      { regex: /\b(captur|judicializ|a la cárcel|a prisión|detenid)\w*/i, keyword: 'orden público' }
    ];

    for (const r of reglas) {
      if (r.regex.test(texto)) {
        const mat = materias.find(m => m.prefLabel.toLowerCase().includes(r.keyword));
        if (mat) return { uri: mat.uri, label: mat.prefLabel };
      }
    }

    // Fallback: Si el texto contiene indicadores de orden público claros
    if (ACTORES_CRITICOS.some(k => texto.includes(k)) && materias.length > 0) {
      return { uri: materias[0].uri, label: materias[0].prefLabel };
    }
  } catch (err) {
    // Si la API falla momentáneamente
  }

  return null; // Si no es de orden público, no se le asigna materia y se descarta
}

// ===== 4. ENVIAR TITULAR A FASTAPI (GUARDA EN FUSEKI) =====
async function guardarTitular(encabezado, resumen, urlFuente, fechaPublicacion, nombreFuente) {
  if (!encabezado || !urlFuente) return;

  if (esRuido(encabezado, resumen)) {
    console.log(`⏭ Descartado por ruido: ${encabezado.substring(0, 50)}...`);
    return;
  }

  if (!esFechaValida(fechaPublicacion)) {
    console.log(`⏭ Descartado por fecha antigua: ${encabezado.substring(0, 50)}...`);
    return;
  }

  const materia = await buscarMateriaEnFuseki(encabezado, resumen);

  // Descartamos todo lo que no sea de orden público para no llenar Fuseki de basura
  if (!materia) {
    console.log(`⏭ Omitido (no es orden público): ${encabezado.substring(0, 50)}...`);
    return;
  }

  const idSufijo = `bot_${crypto.createHash('sha256').update(urlFuente).digest('hex').substring(0, 14)}`;
  const fechaIso = fechaPublicacion ? new Date(fechaPublicacion).toISOString() : new Date().toISOString();

  const payload = {
    id_sufijo: idSufijo,
    titulo: encabezado.trim(),
    cuerpo: (resumen && resumen.trim().length > 0) ? resumen.trim() : encabezado.trim(),
    fuente: nombreFuente,
    fecha_publicacion: fechaIso,
    fecha_actualizacion: null,
    materia_uri: materia.uri,
    eventos: []
  };

  if (!tokenAcceso) {
    await obtenerToken();
  }

  try {
    await axios.post(`${BACKEND_URL}/api/noticias`, payload, {
      headers: {
        'Authorization': `Bearer ${tokenAcceso}`,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    console.log(`✔ Guardado en Fuseki: ${encabezado.substring(0, 48)}... [${materia.label}]`);
  } catch (error) {
    if (error.response?.status === 401) {
      await obtenerToken();
      try {
        await axios.post(`${BACKEND_URL}/api/noticias`, payload, {
          headers: {
            'Authorization': `Bearer ${tokenAcceso}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        });
        console.log(`✔ Guardado tras renovar token: ${encabezado.substring(0, 48)}...`);
      } catch (err) {
        console.error(`✘ Error al guardar: ${encabezado.substring(0, 40)}`, err.message);
      }
    } else if (error.response?.status === 400) {
      console.log(`⏭ Duplicado o ya existente en Fuseki: ${encabezado.substring(0, 48)}...`);
    } else {
      console.error(`✘ Error: ${encabezado.substring(0, 40)}`, error.message);
    }
  }
}

// ===== 5. LECTORES DE FUENTES =====
async function procesarFuenteRSS(fuente) {
  try {
    const feed = await parser.parseURL(fuente.url);
    console.log(`\n--- ${fuente.nombre}: ${feed.items.length} noticias leídas ---`);

    for (const item of feed.items) {
      const resumen = (item.contentSnippet || item.summary || item.content || '').substring(0, 400);
      await guardarTitular(item.title, resumen, item.link, item.pubDate, fuente.nombre);
    }
  } catch (err) {
    console.error(`✘ Error al leer feed ${fuente.nombre}:`, err.message);
  }
}

async function scrapearAlertaBogota(fuente) {
  try {
    const { data: html } = await axios.get(fuente.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000
    });
    const $ = cheerio.load(html);
    const noticias = [];

    $('.news-1').each((_, el) => {
      const linkTag = $(el).find('h3.news-card-title a');
      const titulo = linkTag.text().trim();
      let href = linkTag.attr('href');

      if (titulo && href) {
        if (!href.startsWith('http')) href = `https://www.alerta.com.co${href}`;
        noticias.push({ titulo, link: href });
      }
    });

    console.log(`\n--- ${fuente.nombre}: ${noticias.length} noticias encontradas ---`);

    for (const n of noticias) {
      let resumen = '';
      try {
        const { data: artHtml } = await axios.get(n.link, { timeout: 5000 });
        const $$ = cheerio.load(artHtml);         resumen = $$('meta[property="og:description"]').attr('content') || '';
      } catch (_) {}

      await guardarTitular(n.titulo, resumen, n.link, new Date(), fuente.nombre);
    }
  } catch (err) {
    console.error(`✘ Error en scraping ${fuente.nombre}:`, err.message);
  }
}

// ===== 6. ORQUESTADOR =====
async function ejecutarBarrido() {
  console.log(`\n[${new Date().toLocaleString()}] Iniciando barrido automático hacia Fuseki...`);

  for (const f of FUENTES) {
    if (f.tipo === 'rss') {
      await procesarFuenteRSS(f);
    } else if (f.tipo === 'scraping' && f.nombre === 'Alerta Bogotá') {
      await scrapearAlertaBogota(f);
    }
  }
  console.log(`\n[${new Date().toLocaleString()}] Barrido completado con éxito.`);
}

// Ejecución periódica programada
cron.schedule('0 7 * * *', () => ejecutarBarrido());
cron.schedule('0 12 * * *', () => ejecutarBarrido());

console.log('Bot de Indexación de Noticias listo (Cron activo: 7:00 a.m. y 12:00 p.m.)');

// Ejecución inicial inmediata
ejecutarBarrido();