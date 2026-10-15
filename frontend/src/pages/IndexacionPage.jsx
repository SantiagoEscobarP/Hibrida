// src/pages/IndexacionPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./IndexacionPage.css";

const API_BASE = "http://localhost:8000/api";

function IndexacionPage({ usuario }) {
  const { id } = useParams(); // ID del titular
  const navigate = useNavigate();

  const [titular, setTitular] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [todosEventos, setTodosEventos] = useState([]);
  const [eventoSeleccionado, setEventoSeleccionado] = useState("");
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

  // Cargar datos del titular y eventos vinculados
  const cargarDatos = () => {
    setCargando(true);
    fetch(`${API_BASE}/noticias/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTitular(data);
      })
      .catch((err) => console.error("Error al obtener el titular:", err));

    fetch(`${API_BASE}/eventos/por-titular/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setEventos(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error al obtener eventos:", err);
        setCargando(false);
      });

    // Cargar todos los eventos disponibles para el selector de vinculación rápida
    fetch(`${API_BASE}/eventos`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setTodosEventos(data);
      })
      .catch((err) => console.error("Error al cargar lista de eventos:", err));
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  // Vincular un evento existente al titular actual
  const handleVincularExistente = async () => {
    if (!eventoSeleccionado) {
      alert("Por favor selecciona un evento de la lista.");
      return;
    }

    try {
      const resp = await fetch(
        `${API_BASE}/noticias/${id}/relacionar-evento/${eventoSeleccionado}`,
        { method: "POST" }
      );
      if (resp.ok) {
        alert("¡Evento relacionado exitosamente con el titular!");
        setEventoSeleccionado("");
        cargarDatos(); // Recargar para ver el estado OK
      } else {
        alert("No se pudo relacionar el evento.");
      }
    } catch (err) {
      console.error("Error al relacionar evento:", err);
      alert("Error de conexión con el backend.");
    }
  };

  const esOk = eventos.length > 0;

  return (
    <div className="page-container">
      <Navbar
        username={usuarioSesion?.nombre || "Usuario"}
        usuario={usuarioSesion}
        onLogout={() => navigate("/login")}
      />

      <div className="content-area">
        <header className="page-header-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>INDEXACIÓN DE TITULARES (HOLDING)</h2>
          <span className={`badge-estado ${esOk ? "ok" : "pend"}`} style={{ fontSize: "14px", padding: "8px 16px" }}>
            ESTADO: {esOk ? "OK (INDEXADO)" : "PEND (PENDIENTE)"}
          </span>
        </header>

        <div className="indexacion-card">
          <div className="field-section">
            <label className="section-label">TITULAR</label>
            <textarea
              className="main-titular-input"
              value={titular?.encabezado || "Cargando..."}
              readOnly
            />
          </div>

          <div className="field-section">
            <label className="section-label">CUERPO / RESUMEN</label>
            <textarea
              className="main-resumen-input"
              value={titular?.resumen || "Sin resumen disponible"}
              readOnly
            />
          </div>

          <div className="info-row-bar">
            <div className="info-box">
              Última Actualización:{" "}
              {titular?.fecha_creacion
                ? new Date(titular.fecha_creacion).toLocaleDateString("es-CO")
                : "N/A"}
            </div>
            <div className="info-box">
              FUENTE: <strong>{titular?.fuente || titular?.url_fuente || "N/A"}</strong>
            </div>
            <div className="info-box">
              FECHA PUBLICACIÓN:{" "}
              {titular?.fecha_publicacion
                ? new Date(titular.fecha_publicacion).toLocaleDateString("es-CO")
                : "N/A"}
            </div>
          </div>

          {/* SECCIÓN DE VINCULACIÓN RÁPIDA DE EVENTOS */}
          <div className="field-section" style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
            <label className="section-label" style={{ marginBottom: "8px" }}>VINCULAR EVENTO EXISTENTE AL TITULAR</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <select
                className="select-full-styled"
                value={eventoSeleccionado}
                onChange={(e) => setEventoSeleccionado(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Selecciona un evento registrado...</option>
                {todosEventos.map((ev) => (
                  <option key={ev._id || ev.id} value={ev._id || ev.id}>
                    {ev.titulo || ev.resumen_evento || "Evento sin título"} ({ev.municipio || "Bogotá"})
                  </option>
                ))}
              </select>
              <button className="btn-secondary" onClick={handleVincularExistente}>
                VINCULAR
              </button>
            </div>
          </div>

          <div className="eventos-section">
            <h3>EVENTOS VINCULADOS ({eventos.length})</h3>

            <table className="eventos-table">
              <thead>
                <tr>
                  <th style={{ width: "120px" }}>FECHA</th>
                  <th>RESUMEN DEL EVENTO</th>
                  <th style={{ width: "160px" }}>MATERIA / ESTADO</th>
                  <th style={{ width: "160px" }}>MUNICIPIO / LUGAR</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                      Cargando eventos desde Fuseki...
                    </td>
                  </tr>
                ) : eventos.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      Este titular no tiene eventos relacionados todavía. Crea un evento nuevo o vincula uno existente arriba.
                    </td>
                  </tr>
                ) : (
                  eventos.map((ev) => (
                    <tr key={ev.id || ev._id}>
                      <td>
                        {ev.fecha || ev.fecha_creacion
                          ? new Date(ev.fecha || ev.fecha_creacion).toLocaleDateString("es-CO")
                          : "N/A"}
                      </td>
                      <td>
                        <textarea defaultValue={ev.resumen || ev.resumen_evento || ""} readOnly />
                      </td>
                      <td>
                        <div className="tag">{ev.estado || ev.categoria || "REG"}</div>
                      </td>
                      <td>
                        <div className="tag">
                          {ev.municipio || ev.direccion_hecho?.localidad || "Bogotá D.C."}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="action-buttons-end" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button className="btn-secondary" onClick={() => navigate("/titulares")}>
              &larr; Volver a Titulares
            </button>

            <div style={{ display: "flex", gap: "12px" }}>
              <button className="btn-secondary" onClick={cargarDatos}>
                ACTUALIZAR / INDEXAR
              </button>
              <button
                className="btn-primary-dark"
                onClick={() => navigate(`/crear-evento/${id}`)}
              >
                + CREAR NUEVO EVENTO
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndexacionPage;