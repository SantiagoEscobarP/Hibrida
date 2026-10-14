// src/pages/BuscadorPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./BuscadorPage.css";

const API = "http://localhost:8000";

const TIPOS = [
  { value: "", label: "Todos los tipos en el grafo" },
  { value: "NewsArticle", label: "Titulares de Noticias" },
  { value: "Evento", label: "Eventos" },
  { value: "Persona", label: "Personas" },
  { value: "Organizacion", label: "Organizaciones / Entidades" },
  { value: "GrupoCriminal", label: "Estructuras / Grupos Criminales" },
  { value: "Materia", label: "Materias / Categorías" },
  { value: "Lugar", label: "Lugares / Municipios" },
];

function BuscadorPage({ usuario }) {
  const navigate = useNavigate();
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  useEffect(() => {
    fetch(`${API}/api/grafo/estadisticas`)
      .then((r) => r.json())
      .then((d) => setEstadisticas(d))
      .catch((e) => console.error("Error al cargar estadísticas:", e));
  }, []);

  const buscar = () => {
    setCargando(true);
    const params = new URLSearchParams();
    if (texto.trim()) params.set("q", texto.trim());
    if (tipo) params.set("tipo", tipo);

    fetch(`${API}/api/buscar?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setResultados(d.resultados || []))
      .catch((e) => console.error("Error de búsqueda:", e))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    const t = setTimeout(buscar, 300);
    return () => clearTimeout(t);
  }, [texto, tipo]);

  const verDetalle = (uri) => {
    fetch(`${API}/api/grafo/entidad?uri=${encodeURIComponent(uri)}`)
      .then((r) => r.json())
      .then((d) => setDetalle(d))
      .catch((e) => console.error("Error al cargar entidad:", e));
  };

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/login")} />
      <div className="content-area">
        <header className="page-header-title">
          <h2>EXPLORADOR SEMÁNTICO Y ESTADÍSTICAS DEL GRAFO (FUSEKI)</h2>
        </header>

        {estadisticas && estadisticas.por_tipo && (
          <div className="grafo-stats">
            <span className="grafo-total">Total recursos RDF: {estadisticas.total}</span>
            {Object.entries(estadisticas.por_tipo).map(([k, v]) => (
              <span key={k} className={`stat-chip ${v === 0 ? "stat-empty" : ""}`}>
                {k}: <strong>{v}</strong>
              </span>
            ))}
          </div>
        )}

        <div className="buscador-bar">
          <input
            type="text"
            className="buscador-input"
            placeholder="Buscar en el grafo (noticias, eventos, autoridades, lugares...)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <select
            className="buscador-select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button className="btn-primary-dark" onClick={buscar}>
            BUSCAR
          </button>
        </div>

        <div className="buscador-layout">
          <div className="buscador-resultados">
            {cargando ? (
              <p className="buscador-hint" style={{ padding: "20px" }}>
                Consultando tripletas en Apache Jena Fuseki...
              </p>
            ) : resultados.length === 0 ? (
              <p className="buscador-hint" style={{ padding: "20px" }}>
                Sin resultados para este filtro.
              </p>
            ) : (
              resultados.map((r) => (
                <div
                  key={r.uri}
                  className={`resultado-item ${detalle?.uri === r.uri ? "resultado-activo" : ""}`}
                  onClick={() => verDetalle(r.uri)}
                >
                  <span className="resultado-tipo">{r.tipo_etiqueta}</span>
                  <span className="resultado-nombre">{r.nombre}</span>
                </div>
              ))
            )}
          </div>

          <div className="buscador-detalle">
            {!detalle && (
              <p className="buscador-hint">
                Selecciona cualquier nodo de la izquierda para inspeccionar sus tripletas y navegar sus relaciones.
              </p>
            )}
            {detalle && (
              <>
                <h3>{detalle.label}</h3>
                <p className="detalle-uri">{detalle.uri}</p>

                <h4>Propiedades y Relaciones Salientes</h4>
                <table className="detalle-tabla">
                  <tbody>
                    {detalle.propiedades.map((p, i) => (
                      <tr key={i}>
                        <td className="detalle-pred">{p.predicado}</td>
                        <td>
                          {p.tipo_nodo === "uri" ? (
                            <span
                              className="detalle-enlace"
                              title={p.valor}
                              onClick={() => verDetalle(p.valor)}
                            >
                              🔗 {p.valor_label || p.valor}
                            </span>
                          ) : (
                            String(p.valor)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4>Conexiones Entrantes ({detalle.conexiones_entrantes.length})</h4>
                {detalle.conexiones_entrantes.length === 0 ? (
                  <p className="buscador-hint">Ninguna entidad apunta directamente a este recurso.</p>
                ) : (
                  <table className="detalle-tabla">
                    <tbody>
                      {detalle.conexiones_entrantes.map((c, i) => (
                        <tr key={i}>
                          <td className="detalle-pred">{c.predicado}</td>
                          <td>
                            <span
                              className="detalle-enlace"
                              onClick={() => verDetalle(c.sujeto_uri)}
                            >
                              🔗 {c.sujeto_label}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuscadorPage;