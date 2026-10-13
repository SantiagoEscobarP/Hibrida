// src/pages/BuscadorPage.jsx
// Buscador de datos enlazados (Linked Data) sobre Apache Jena Fuseki.
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./BuscadorPage.css";

const API = "http://localhost:5000";

const TIPOS = [
  { value: "", label: "Todos los tipos" },
  { value: "evento", label: "Eventos" },
  { value: "agente", label: "Agentes" },
  { value: "autoridad", label: "Autoridades" },
  { value: "estructura", label: "Estructuras criminales" },
  { value: "organizacion", label: "Organizaciones armadas" },
  { value: "lider", label: "Líderes" },
  { value: "categoria", label: "Materias / categorías" },
  { value: "lugar", label: "Lugares geográficos" },
  { value: "sector", label: "Sectores económicos" },
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

  // Estadísticas del grafo al entrar
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

  // Búsqueda inicial y en tiempo real (con pequeño debounce)
  useEffect(() => {
    const t = setTimeout(buscar, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <h2>BUSCADOR FUSEKI (DATOS ENLAZADOS)</h2>
        </header>

        {estadisticas && estadisticas.por_tipo && (
          <div className="grafo-stats">
            <span className="grafo-total">Total en el grafo: {estadisticas.total}</span>
            {Object.entries(estadisticas.por_tipo).map(([k, v]) => (
              <span key={k} className={`stat-chip ${v === 0 ? "stat-empty" : ""}`}>
                {k}: {v}
              </span>
            ))}
          </div>
        )}

        <div className="buscador-bar">
          <input
            type="text"
            className="buscador-input"
            placeholder="Buscar en el grafo (eventos, autoridades, estructuras, lugares...)"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <select className="buscador-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button className="btn-reg" onClick={buscar}>BUSCAR</button>
        </div>

        {cargando && <p className="buscador-hint">Buscando en Fuseki...</p>}

        {!cargando && resultados.length === 0 && (
          <p className="buscador-hint">Sin resultados. Ajusta el texto o el tipo.</p>
        )}

        <div className="buscador-layout">
          <div className="buscador-resultados">
            {resultados.map((r) => (
              <div
                key={r.uri}
                className={`resultado-item ${detalle?.uri === r.uri ? "resultado-activo" : ""}`}
                onClick={() => verDetalle(r.uri)}
              >
                <span className="resultado-tipo">{r.tipo_etiqueta}</span>
                <span className="resultado-nombre">{r.nombre}</span>
              </div>
            ))}
          </div>

          <div className="buscador-detalle">
            {!detalle && <p className="buscador-hint">Selecciona un resultado para ver sus conexiones (datos enlazados).</p>}
            {detalle && (
              <>
                <h3>{detalle.label}</h3>
                <p className="detalle-uri">{detalle.uri}</p>

                <h4>Propiedades</h4>
                <table className="detalle-tabla">
                  <tbody>
                    {detalle.propiedades.map((p, i) => (
                      <tr key={i}>
                        <td className="detalle-pred">{p.predicado}</td>
                        <td>
                          {p.tipo_nodo === "uri" ? (
                            <span className="detalle-enlace" title={p.valor}>
                              {p.valor_label || p.valor}
                            </span>
                          ) : (
                            String(p.valor)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4>Conexiones entrantes ({detalle.conexiones_entrantes.length})</h4>
                {detalle.conexiones_entrantes.length === 0 ? (
                  <p className="buscador-hint">Ninguna entidad apunta a esta todavía.</p>
                ) : (
                  <table className="detalle-tabla">
                    <tbody>
                      {detalle.conexiones_entrantes.map((c, i) => (
                        <tr key={i}>
                          <td className="detalle-pred">{c.predicado}</td>
                          <td>
                            <span className="detalle-enlace" onClick={() => verDetalle(c.sujeto_uri)}>
                              {c.sujeto_label}
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
