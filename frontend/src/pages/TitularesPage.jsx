// src/pages/TitularesPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./TitularesPage.css";

const API_BASE = "http://localhost:8000/api";

function TitularesPage({ usuario, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const queryParams = new URLSearchParams(location.search);
  const categoriaSeleccionada = queryParams.get("categoria") || "";
  const estadoSeleccionado = queryParams.get("estado") || "Todos";

  // Estados para la barra de filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(estadoSeleccionado);
  const [filtroCategoria, setFiltroCategoria] = useState(categoriaSeleccionada);
  const [filtroLugar, setFiltroLugar] = useState("");
  const [filtroFuente, setFiltroFuente] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // Datos desde Fuseki
  const [titulares, setTitulares] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. Cargar titulares desde FastAPI / Fuseki
  useEffect(() => {
    setCargando(true);
    fetch(`${API_BASE}/noticias`)
      .then((res) => res.json())
      .then((data) => {
        setTitulares(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error al traer titulares:", err);
        setCargando(false);
      });
  }, []);

  // 2. Cargar Materias desde Fuseki
  useEffect(() => {
    fetch(`${API_BASE}/autoridades?tipo=Materia`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategorias(data.map((c) => ({ _id: c.uri, nombre: c.prefLabel })));
        }
      })
      .catch((err) => console.error("Error al traer categorías:", err));
  }, []);

  // 3. Cargar Lugares desde Fuseki
  useEffect(() => {
    fetch(`${API_BASE}/autoridades?tipo=Lugar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLugares(data.map((l) => ({ _id: l.uri, nombre: l.prefLabel })));
        }
      })
      .catch((err) => console.error("Error al traer lugares:", err));
  }, []);

  // Extraer dinámicamente las fuentes y categorías presentes en los titulares
  const fuentesDisponibles = useMemo(() => {
    const setFuentes = new Set(titulares.map((t) => t.fuente).filter(Boolean));
    return Array.from(setFuentes).sort();
  }, [titulares]);

  const categoriasDisponibles = useMemo(() => {
    const mapa = new Map();
    categorias.forEach((c) => {
      if (c.nombre) mapa.set(c.nombre, c.nombre);
    });
    titulares.forEach((t) => {
      (t.categorias || []).forEach((c) => {
        if (c.nombre) mapa.set(c.nombre, c.nombre);
      });
    });
    return Array.from(mapa.values()).sort();
  }, [categorias, titulares]);

  // Filtrado reactivo
  const titularesFiltrados = titulares
    .filter((item) => {
      if (!fechaDesde) return true;
      try {
        return new Date(item.fecha_publicacion) >= new Date(fechaDesde);
      } catch {
        return true;
      }
    })
    .filter((item) => {
      if (!fechaHasta) return true;
      try {
        return new Date(item.fecha_publicacion) <= new Date(fechaHasta + "T23:59:59");
      } catch {
        return true;
      }
    })
    .filter(
      (item) =>
        filtroCategoria === "" ||
        (item.categorias || []).some((c) => c.nombre === filtroCategoria)
    )
    .filter(
      (item) =>
        filtroTexto === "" ||
        (item.encabezado || "").toLowerCase().includes(filtroTexto.toLowerCase()) ||
        (item.resumen || "").toLowerCase().includes(filtroTexto.toLowerCase())
    )
    .filter((item) => filtroEstado === "Todos" || item.estado === filtroEstado)
    .filter((item) => {
      if (!filtroLugar) return true;
      const lugar = (item.lugar || item.municipio || "").toLowerCase();
      return lugar.includes(filtroLugar.toLowerCase());
    })
    .filter((item) => {
      if (!filtroFuente) return true;
      return item.fuente === filtroFuente;
    });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={onLogout || (() => navigate("/login"))} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>TITULARES</h2>
        </header>

        {/* BARRA DE FILTROS */}
        <div className="filters-bar">
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Materias / Categorías</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {categoriasDisponibles.map((nombreCat) => (
                <option key={nombreCat} value={nombreCat}>
                  {nombreCat}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Palabras Clave</label>
            <input
              type="text"
              placeholder="Buscar en titular o cuerpo..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
            >
              <option value="Todos">Todos</option>
              <option value="Pendiente">PEND</option>
              <option value="OK">OK</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Municipio / Departamento</label>
            <select
              value={filtroLugar}
              onChange={(e) => setFiltroLugar(e.target.value)}
            >
              <option value="">Todos</option>
              {lugares.map((lugar) => (
                <option key={lugar._id} value={lugar.nombre}>
                  {lugar.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Fuente</label>
            <select
              value={filtroFuente}
              onChange={(e) => setFiltroFuente(e.target.value)}
            >
              <option value="">Todas</option>
              {fuentesDisponibles.map((nombreFuente) => (
                <option key={nombreFuente} value={nombreFuente}>
                  {nombreFuente}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE TITULARES */}
        <div className="table-container">
          <table className="titulares-table">
            <thead>
              <tr>
                <th style={{ width: "115px" }}>FECHA</th>
                <th>ENCABEZADO</th>
                <th style={{ width: "190px" }}>MATERIAS / CATEGORÍAS</th>
                <th style={{ width: "160px" }}>MUNICIPIO / DEPARTAMENTO</th>
                <th style={{ width: "170px" }}>FUENTE</th>
                <th style={{ width: "100px", textAlign: "center" }}>ESTADO</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "35px", color: "#64748b" }}>
                    Cargando titulares desde Apache Jena Fuseki...
                  </td>
                </tr>
              ) : titularesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "35px", color: "#64748b" }}>
                    No se encontraron titulares con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                titularesFiltrados.map((item) => {
                  const esOk = item.estado === "OK";

                  return (
                    <tr key={item._id}>
                      <td>
                        <input
                          type="text"
                          value={
                            item.fecha_publicacion
                              ? new Date(item.fecha_publicacion).toLocaleDateString("es-CO")
                              : "S/F"
                          }
                          className="table-input-small"
                          readOnly
                        />
                      </td>
                      <td>
                        <textarea
                          defaultValue={item.encabezado}
                          className="table-textarea"
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.categorias?.map((c) => c.nombre).join(", ") || "Sin categoría"}
                          className="table-input"
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          defaultValue={item.lugar || item.municipio || "Bogotá D.C."}
                          className="table-input"
                          readOnly
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={item.fuente || ""}
                          className="table-input"
                          readOnly
                        />
                      </td>
                      <td className="estado-cell" style={{ justifyContent: "center" }}>
                        <button
                          className={`btn-estado ${esOk ? "ok" : "pend"}`}
                          onClick={() => navigate(`/indexacion/${item._id}`)}
                        >
                          {esOk ? "OK" : "PEND"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <button className="btn-back" onClick={() => navigate("/materias")}>
          &larr; Volver a Materias
        </button>
      </div>
    </div>
  );
}

export default TitularesPage;