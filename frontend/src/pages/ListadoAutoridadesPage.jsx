// src/pages/ListadoAutoridadesPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./ListadoAutoridadesPage.css";

function ListadoAutoridadesPage({ usuario }) {
  const navigate = useNavigate();
  const [autoridades, setAutoridades] = useState([]);

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const rol = (usuarioSesion?.rol || "").toString().trim().toLowerCase();
  const puedeEditarAutoridades = rol === "administrador" || rol === "superusuario";

  useEffect(() => {
    Promise.all([
      fetch("http://localhost:5000/api/agentes").then((res) => res.json()),
      fetch("http://localhost:5000/api/estructuras-criminales").then((res) => res.json()),
      fetch("http://localhost:5000/api/categorias").then((res) => res.json()),
      fetch("http://localhost:5000/api/lugares").then((res) => res.json()),
    ])
      .then(([agentesData, estructurasData, categoriasData, lugaresData]) => {
        const combinadas = [
          ...(Array.isArray(agentesData)
            ? agentesData.map((a) => ({ id: a.id || a._id, tipo: a.tipo_nombre || "Agente", termino: a.nombre, fecha_creacion: a.fecha_creacion || a.fechaCreacion || a.fecha }))
            : []),
          ...(Array.isArray(estructurasData)
            ? estructurasData.map((e) => ({ id: e.id || e._id, tipo: "Grupo Criminal", termino: e.nombre, fecha_creacion: e.fecha_creacion }))
            : []),
          ...(Array.isArray(categoriasData)
            ? categoriasData.map((c) => ({ id: c.id || c._id, tipo: "Materia", termino: c.nombre, fecha_creacion: c.fecha_creacion }))
            : []),
          ...(Array.isArray(lugaresData)
            ? lugaresData.map((l) => ({ id: l.id || l._id, tipo: l.tipo_lugar || "Lugar", termino: l.nombre, fecha_creacion: l.fecha_creacion }))
            : []),
        ];
        setAutoridades(combinadas);
      })
      .catch((error) => console.error("Error al traer autoridades:", error));
  }, []);

  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroTermino, setFiltroTermino] = useState("");
  const [filtroCreacion, setFiltroCreacion] = useState("");
  const [filtroActualizacion, setFiltroActualizacion] = useState("");

  const autoridadesFiltradas = autoridades.filter((item) => {
    const fechaCreacionText = item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString("es-CO") : "";
    const fechaActualizacionText = fechaCreacionText;

    return (
      (filtroTipo === "" || (item.tipo || "").toLowerCase().includes(filtroTipo.toLowerCase())) &&
      (filtroTermino === "" || (item.termino || "").toLowerCase().includes(filtroTermino.toLowerCase())) &&
      (filtroCreacion === "" || fechaCreacionText.includes(filtroCreacion)) &&
      (filtroActualizacion === "" || fechaActualizacionText.includes(filtroActualizacion))
    );
  });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/")} />

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
              <span className="filter-icon">⚙</span>
              <input type="text" placeholder="Tipo de término" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input type="text" placeholder="Término autorizado" value={filtroTermino} onChange={(e) => setFiltroTermino(e.target.value)} />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input type="text" placeholder="Fecha de creación" value={filtroCreacion} onChange={(e) => setFiltroCreacion(e.target.value)} />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
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
            {autoridadesFiltradas.map((item) => (
              <div key={item.id} className="table-data-row">
                <div className="cell-box">{item.tipo}</div>
                <div className="cell-box font-bold">{item.termino}</div>
                <div className="cell-box date-box">
                  <span>{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString("es-CO") : "N/A"}</span>
                  <span className="calendar-icon">📅</span>
                </div>
                <div className="cell-box date-box">
                  <span>{item.fecha_creacion ? new Date(item.fecha_creacion).toLocaleDateString("es-CO") : "N/A"}</span>
                  <span className="calendar-icon">📅</span>
                </div>
                <div className="cell-action">
                  {puedeEditarAutoridades ? (
                    <button className="btn-reg" onClick={() => navigate(`/autoridades/editar/${item.id}`)} title="Ver/Editar registro">
                      REG
                    </button>
                  ) : (
                    <button className="btn-reg" disabled title="Solo lectura para indexador">
                      SOLO LECTURA
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

export default ListadoAutoridadesPage;
