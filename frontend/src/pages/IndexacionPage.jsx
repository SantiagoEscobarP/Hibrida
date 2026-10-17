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
  const [indexando, setIndexando] = useState(false);

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
  const puedeBuscarEvento =
    rolUsuario === "administrador" ||
    rolUsuario === "superusuario" ||
    rolUsuario === "indexador" ||
    rolUsuario === "analista";

  // Guardar en sessionStorage el ID del titular activo para cuando vaya a "BUSCAR EVENTO" y use "HOLDING"
  useEffect(() => {
    if (id) {
      sessionStorage.setItem("holding_titular_id", id);
    }
  }, [id]);

  const cargarDatos = () => {
    fetch(`${API_BASE}/noticias/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setTitular(data);
      })
      .catch((error) => console.error("Error al obtener el titular:", error));

    fetch(`${API_BASE}/eventos/por-titular/${id}`)
      .then((response) => response.json())
      .then((data) => setEventos(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Error al obtener eventos:", error));
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  // Botón añadido: INDEXAR / ACTUALIZAR (cambia el estado del titular a OK)
  const manejarIndexarTitular = async () => {
    if (eventos.length === 0) {
      alert("Debes crear o enlazar (Holding) al menos un evento antes de indexar el titular.");
      return;
    }

    setIndexando(true);
    try {
      const resp = await fetch(`${API_BASE}/noticias/${id}/indexar`, {
        method: "POST",
      });
      if (resp.ok) {
        alert(
          titular?.estado === "OK"
            ? "¡Indexación del titular actualizada exitosamente!"
            : "¡Titular indexado exitosamente! Su estado ha cambiado a OK."
        );
        cargarDatos();
        navigate("/titulares");
      } else {
        alert("No se pudo actualizar el estado del titular.");
      }
    } catch (error) {
      console.error("Error al indexar titular:", error);
      alert("Error de conexión con el servidor.");
    } finally {
      setIndexando(false);
    }
  };

  const yaEstaOk = titular?.estado === "OK";

  return (
    <div className="page-container">
      <Navbar
        username={usuarioSesion?.nombre || "Usuario"}
        usuario={usuarioSesion}
        onLogout={() => navigate("/login")}
      />

      <div className="content-area">
        <header className="page-header-title">
          <h2>INDEXACIÓN TITULARES (REVISIÓN TITULAR-HOLDING)</h2>
        </header>

        <div className="indexacion-card">
          <div className="field-section">
            <label className="section-label">TITULAR</label>
            <textarea
              className="main-titular-input"
              value={titular?.encabezado || "Cargando..."}
              onChange={() => {}}
            />
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
            <div className="info-box">
              ESTADO ACTUAL:{" "}
              <strong style={{ color: yaEstaOk ? "#17c964" : "#f31260" }}>
                {yaEstaOk ? "OK" : "PEND"}
              </strong>
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
                  <th>RELACIÓN EN GRAFO (OTROS TITULARES)</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => {
                  const otrosTitulares = (ev.titulares_relacionados || []).filter(
                    (t) => t.id !== id
                  );

                  return (
                    <tr key={ev.id || ev._id}>
                      <td>
                        {ev.fecha || ev.fecha_creacion
                          ? new Date(ev.fecha || ev.fecha_creacion).toLocaleDateString("es-CO")
                          : "N/A"}
                      </td>
                      <td>
                        <textarea defaultValue={ev.resumen || ev.resumen_evento || ""} />
                      </td>
                      <td>
                        <div className="tag">{ev.estado || ev.categoria || "REG"}</div>
                      </td>
                      <td>
                        <div className="tag">
                          {ev.municipio ||
                            ev.direccion_hecho?.localidad ||
                            ev.subdivision ||
                            "N/A"}
                        </div>
                      </td>
                      <td>
                        {otrosTitulares.length === 0 ? (
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            Solo este titular
                          </span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {otrosTitulares.map((ot) => (
                              <span
                                key={ot.id}
                                onClick={() => navigate(`/indexacion/${ot.id}`)}
                                style={{
                                  fontSize: "12px",
                                  color: "#006fee",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  fontWeight: 600,
                                }}
                                title="Ver titular relacionado en el grafo"
                              >
                                🔗 {ot.encabezado ? `${ot.encabezado.slice(0, 45)}...` : ot.id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="action-buttons-end">
            {puedeCrearEventos ? (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/crear-evento/${id}`)}
              >
                CREAR EVENTO
              </button>
            ) : (
              <button
                className="btn-secondary"
                disabled
                title="No tienes permiso para crear eventos"
              >
                CREAR EVENTO (SIN PERMISO)
              </button>
            )}

            {puedeBuscarEvento && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/buscar-evento?titularId=${id}`)}
              >
                BUSCAR EVENTO
              </button>
            )}

            <button
              className="btn-primary-dark"
              onClick={manejarIndexarTitular}
              disabled={indexando}
            >
              {indexando
                ? "PROCESANDO..."
                : yaEstaOk
                  ? "ACTUALIZAR EVENTO / INDEXACIÓN"
                  : "INDEXAR"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndexacionPage;