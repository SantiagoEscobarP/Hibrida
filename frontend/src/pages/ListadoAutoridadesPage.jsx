// src/pages/ListadoAutoridadesPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./ListadoAutoridadesPage.css";

const API_BASE = "http://localhost:8000/api";

function ListadoAutoridadesPage({ usuario }) {
  const navigate = useNavigate();
  const [autoridades, setAutoridades] = useState([]);
  const [cargando, setCargando] = useState(true);

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const rol = (usuarioSesion?.rol || "administrador").toString().trim().toLowerCase();
  const puedeEditarAutoridades =
    rol === "administrador" || rol === "superusuario" || rol === "analista" || rol === "admin";

  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE}/autoridades`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAutoridades(
            data.map((item) => ({
              id: item.id || item._id || item.uri.split("/").pop(),
              uri: item.uri,
              tipo: item.tipo || item.tipo_nombre || "Autoridad",
              termino: item.termino || item.prefLabel || item.nombre || "",
              fecha_creacion: item.fecha_creacion,
              fecha_actualizacion: item.fecha_actualizacion || item.fecha_creacion,
            }))
          );
        }
        setCargando(false);
      })
      .catch((error) => {
        console.error("Error al traer autoridades desde Fuseki:", error);
        setCargando(false);
      });
  }, []);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroTermino, setFiltroTermino] = useState("");
  const [filtroCreacion, setFiltroCreacion] = useState("");
  const [filtroActualizacion, setFiltroActualizacion] = useState("");

  const autoridadesFiltradas = autoridades.filter((item) => {
    const fechaCreacionText = item.fecha_creacion
      ? new Date(item.fecha_creacion).toLocaleDateString("es-CO")
      : "";
    const fechaActualizacionText = item.fecha_actualizacion
      ? new Date(item.fecha_actualizacion).toLocaleDateString("es-CO")
      : fechaCreacionText;

    return (
      (filtroTipo === "" || (item.tipo || "").toLowerCase().includes(filtroTipo.toLowerCase())) &&
      (filtroTermino === "" || (item.termino || "").toLowerCase().includes(filtroTermino.toLowerCase())) &&
      (filtroCreacion === "" || fechaCreacionText.includes(filtroCreacion)) &&
      (filtroActualizacion === "" || fechaActualizacionText.includes(filtroActualizacion))
    );
  });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/login")} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>LISTADO DE AUTORIDADES</h2>
        </header>

        <div className="create-btn-area create-btn-top">
          {puedeEditarAutoridades ? (
            <button className="btn-crear-nuevo" onClick={() => navigate("/autoridades/crear")}>
              + Crear nueva autoridad
            </button>
          ) : (
            <button className="btn-crear-nuevo" disabled title="Solo lectura para indexador">
              + Crear nueva autoridad (deshabilitado)
            </button>
          )}
        </div>

        <div className="autoridades-table-container">
          <div className="table-header-grid">
            <div className="filter-field">
              <span className="filter-icon">🔍</span>
              <input
                type="text"
                placeholder="Tipo de término (Persona, Lugar, Materia...)"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">🔍</span>
              <input
                type="text"
                placeholder="Término autorizado"
                value={filtroTermino}
                onChange={(e) => setFiltroTermino(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">📅</span>
              <input
                type="text"
                placeholder="Fecha de creación"
                value={filtroCreacion}
                onChange={(e) => setFiltroCreacion(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">📅</span>
              <input
                type="text"
                placeholder="Fecha de actualización"
                value={filtroActualizacion}
                onChange={(e) => setFiltroActualizacion(e.target.value)}
              />
            </div>
            <div className="empty-col"></div>
          </div>

          <div className="table-body-rows">
            {cargando ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                Cargando autoridades desde Apache Jena Fuseki...
              </div>
            ) : autoridadesFiltradas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                No se encontraron autoridades con los filtros aplicados.
              </div>
            ) : (
              autoridadesFiltradas.map((item) => (
                <div key={item.id} className="table-data-row">
                  <div className="cell-box">{item.tipo}</div>
                  <div className="cell-box font-bold">{item.termino}</div>
                  <div className="cell-box date-box">
                    <span>
                      {item.fecha_creacion
                        ? new Date(item.fecha_creacion).toLocaleDateString("es-CO")
                        : "N/A"}
                    </span>
                    <span className="calendar-icon">🗓️</span>
                  </div>
                  <div className="cell-box date-box">
                    <span>
                      {item.fecha_actualizacion
                        ? new Date(item.fecha_actualizacion).toLocaleDateString("es-CO")
                        : "N/A"}
                    </span>
                    <span className="calendar-icon">🗓️</span>
                  </div>
                  <div className="cell-action">
                    {puedeEditarAutoridades ? (
                      <button
                        className="btn-reg"
                        onClick={() => navigate(`/autoridades/editar/${item.id}`)}
                        title="Ver/Editar registro"
                      >
                        REG
                      </button>
                    ) : (
                      <button className="btn-reg" disabled title="Solo lectura">
                        VER
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListadoAutoridadesPage;