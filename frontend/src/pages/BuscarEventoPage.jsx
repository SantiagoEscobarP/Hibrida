// src/pages/BuscarEventoPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./ListadoAutoridadesPage.css";
import "./BuscarEventoPage.css";

const API_BASE = "http://localhost:8000/api";

function BuscarEventoPage({ usuario }) {
  const navigate = useNavigate();
  const [eventosExistentes, setEventosExistentes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroResumen, setFiltroResumen] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMunicipio, setFiltroMunicipio] = useState("");

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
    setCargando(true);
    fetch(`${API_BASE}/eventos`)
      .then((res) => res.json())
      .then((data) => {
        setEventosExistentes(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error al cargar eventos:", err);
        setCargando(false);
      });
  }, []);

  const eventosFiltrados = eventosExistentes.filter((ev) => {
    const fechaStr = ev.fecha_creacion
      ? new Date(ev.fecha_creacion).toLocaleDateString("es-CO")
      : "";
    const resumenStr = `${ev.titulo || ""} ${ev.resumen_evento || ev.resumen || ""}`.toLowerCase();
    const categoriaStr = (ev.estado || ev.categoria || "").toLowerCase();
    const municipioStr = (ev.direccion_hecho?.localidad || ev.municipio || "").toLowerCase();

    return (
      (filtroFecha === "" || fechaStr.includes(filtroFecha)) &&
      (filtroResumen === "" || resumenStr.includes(filtroResumen.toLowerCase())) &&
      (filtroCategoria === "" || categoriaStr.includes(filtroCategoria.toLowerCase())) &&
      (filtroMunicipio === "" || municipioStr.includes(filtroMunicipio.toLowerCase()))
    );
  });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/login")} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>DESCRIPCIÓN Y BÚSQUEDA DE EVENTOS</h2>
        </header>

        <div className="create-btn-area">
          <button className="btn-crear-nuevo" onClick={() => navigate("/crear-evento")}>
            + Crear nuevo evento
          </button>
        </div>

        <div className="autoridades-table-container">
          <div className="table-header-grid buscar-grid">
            <div className="filter-field">
              <span className="filter-icon">📅</span>
              <input
                type="text"
                placeholder="Fecha (dd/mm/aaaa)"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">🔍</span>
              <input
                type="text"
                placeholder="Título o resumen del evento..."
                value={filtroResumen}
                onChange={(e) => setFiltroResumen(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">🏷️</span>
              <input
                type="text"
                placeholder="Categoría / Materia"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">📍</span>
              <input
                type="text"
                placeholder="Municipio / localidad"
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
              />
            </div>
            <div className="empty-col"></div>
          </div>

          <div className="table-body-rows">
            {cargando ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                Consultando eventos en Fuseki...
              </div>
            ) : eventosFiltrados.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                No se encontraron eventos registrados con los filtros aplicados.
              </div>
            ) : (
              eventosFiltrados.map((ev) => {
                const eventId = ev._id || ev.id;
                const titularId = ev.id_titular || eventId;
                return (
                  <div key={eventId} className="table-data-row buscar-data-row">
                    <div className="cell-box">
                      {ev.fecha_creacion
                        ? new Date(ev.fecha_creacion).toLocaleDateString("es-CO")
                        : "Sin fecha"}
                    </div>
                    <div className="cell-box font-bold">
                      {ev.titulo || ev.resumen_evento || ev.resumen || "Sin resumen"}
                    </div>
                    <div className="cell-box">
                      <span className="tag">{ev.estado || ev.categoria || "REG"}</span>
                    </div>
                    <div className="cell-box">
                      {ev.municipio || ev.direccion_hecho?.localidad || "Bogotá D.C."}
                    </div>
                    <div className="cell-action">
                      <button
                        className="btn-reg"
                        onClick={() => navigate(`/editar-evento/${eventId}`)}
                      >
                        REG
                      </button>
                      <button
                        className="btn-holding"
                        onClick={() => navigate(`/indexacion/${titularId}`)}
                      >
                        HOLDING
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BuscarEventoPage;