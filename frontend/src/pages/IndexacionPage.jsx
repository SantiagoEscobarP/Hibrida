// src/pages/IndexacionPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./IndexacionPage.css";

const API_BASE = "http://localhost:8000/api";

function IndexacionPage({ usuario }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [titular, setTitular] = useState(null);
  const [eventos, setEventos] = useState([]);

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const rolUsuario = (usuarioSesion?.rol || "administrador").toString().trim().toLowerCase();
  const esIndexador = rolUsuario === "indexador";
  const puedeCrearEventos = !esIndexador || !!usuarioSesion?.permiso_crear_eventos;
  const puedeBuscarEvento = true;

  useEffect(() => {
    fetch(`${API_BASE}/noticias/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTitular(data);
      })
      .catch((err) => console.error("Error al obtener el titular:", err));

    fetch(`${API_BASE}/eventos/por-titular/${id}`)
      .then((res) => res.json())
      .then((data) => setEventos(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error al obtener eventos:", err));
  }, [id]);

  return (
    <div className="page-container">
      <Navbar
        username={usuarioSesion?.nombre || "Usuario"}
        usuario={usuarioSesion}
        onLogout={() => navigate("/login")}
      />

      <div className="content-area">
        <header className="page-header-title">
          <h2>INDEXACIÓN DE TITULARES (REVISIÓN TITULAR - EVENTOS)</h2>
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

          <div className="eventos-section">
            <h3>EVENTOS VINCULADOS ({eventos.length})</h3>

            <table className="eventos-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>RESUMEN DEL EVENTO</th>
                  <th>MATERIA / ESTADO</th>
                  <th>MUNICIPIO / LUGAR</th>
                </tr>
              </thead>
              <tbody>
                {eventos.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                      Este titular aún no tiene eventos catalogados (Estado: PEND). Haz clic en "CREAR EVENTO" para indexarlo.
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
                        <div className="tag">{ev.estado || "REG"}</div>
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

          <div className="action-buttons-end">
            <button className="btn-secondary" onClick={() => navigate("/titulares")}>
              &larr; Volver a Titulares
            </button>

            {puedeBuscarEvento && (
              <button className="btn-secondary" onClick={() => navigate("/buscar-evento")}>
                BUSCAR EVENTO EXISTENTE
              </button>
            )}

            {puedeCrearEventos && (
              <button
                className="btn-primary-dark"
                onClick={() => navigate(`/crear-evento/${id}`)}
              >
                + CREAR EVENTO
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndexacionPage;