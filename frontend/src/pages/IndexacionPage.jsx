// src/pages/IndexacionPage.js
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./IndexacionPage.css";

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

  const rolUsuario = (usuarioSesion?.rol || "").toString().trim().toLowerCase();
  const esIndexador = rolUsuario === "indexador";
  const puedeCrearEventos = !esIndexador || !!usuarioSesion?.permiso_crear_eventos;
  const puedeBuscarEvento = rolUsuario === "administrador" || rolUsuario === "superusuario" || rolUsuario === "indexador";

  useEffect(() => {
    fetch(`http://localhost:5000/api/titulares/${id}`)
      .then((response) => response.json())
      .then((data) => setTitular(data))
      .catch((error) => console.error("Error al obtener el titular:", error));
  }, [id]);

  useEffect(() => {
    fetch(`http://localhost:5000/api/eventos/por-titular/${id}`)
      .then((response) => response.json())
      .then((data) => setEventos(data))
      .catch((error) => console.error("Error al obtener eventos:", error));
  }, [id]);

  return (
    <div className="page-container">
      <Navbar username={usuarioSesion?.nombre || "Usuario"} usuario={usuarioSesion} onLogout={() => navigate("/")} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>INDEXACIÓN TITULARES (REVISIÓN TITULAR-HOLDING)</h2>
        </header>

        <div className="indexacion-card">
          <div className="field-section">
            <label className="section-label">TITULAR</label>
            <textarea className="main-titular-input" value={titular?.encabezado || "Cargando..."} onChange={() => {}} />
          </div>

          <div className="field-section">
            <textarea
              className="main-resumen-input"
              value={titular?.resumen || "Sin resumen disponible"}
              onChange={() => {}}
            />
          </div>

          <div className="info-row-bar">
            <div className="info-box">
              Última Actualización: {titular?.fecha_creacion ? new Date(titular.fecha_creacion).toLocaleDateString("es-CO") : "N/A"}
            </div>
            <div className="info-box">
              FUENTE: {titular?.url_fuente && <a href={titular.url_fuente} target="_blank" rel="noopener noreferrer">Ver artículo</a>}
            </div>
            <div className="info-box">
              FECHA PUBLICACIÓN: {titular?.fecha_publicacion ? new Date(titular.fecha_publicacion).toLocaleDateString("es-CO") : "N/A"}
            </div>
          </div>

          <div className="eventos-section">
            <h3>EVENTOS ({eventos.length})</h3>

            <table className="eventos-table">
              <thead>
                <tr>
                  <th>FECHA</th>
                  <th>RESUMEN</th>
                  <th>MATERIAS / CATEGORÍAS</th>
                  <th>MUNICIPIO / DEPARTAMENTO</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id || ev._id}>
                    <td>{(ev.fecha || ev.fecha_creacion) ? new Date(ev.fecha || ev.fecha_creacion).toLocaleDateString("es-CO") : "N/A"}</td>
                    <td><textarea defaultValue={ev.resumen || ev.resumen_evento || ""} /></td>
                    <td><div className="tag">{ev.estado}</div></td>
                    <td><div className="tag">{ev.municipio || ev.direccion_hecho?.localidad || ev.subdivision || "N/A"}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="action-buttons-end">
            {puedeCrearEventos ? (
              <button
                className="btn-secondary"
                onClick={() => {
                  navigate(`/crear-evento/${id}`);
                }}
              >
                CREAR EVENTO
              </button>
            ) : (
              <button className="btn-secondary" disabled title="No tienes permiso para crear eventos">
                CREAR EVENTO (SIN PERMISO)
              </button>
            )}

            {puedeBuscarEvento && (
              <button className="btn-secondary" onClick={() => navigate("/buscar-evento")}>
                BUSCAR EVENTO
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndexacionPage;
