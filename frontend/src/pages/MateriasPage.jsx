// src/pages/MateriasPage.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./MateriasPage.css";

const API_BASE = "http://localhost:8000/api";

function MateriasPage({ usuario, onLogout }) {
  const navigate = useNavigate();
  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const irATitulares = (categoria, estado) => {
    navigate(`/titulares?categoria=${encodeURIComponent(categoria)}&estado=${encodeURIComponent(estado)}`);
  };

  // Estados de filtros
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroDepartamento, setFiltroDepartamento] = useState("");

  // Datos desde Fuseki (FastAPI)
  const [conteoMaterias, setConteoMaterias] = useState([]);
  const [categoriasCatalogo, setCategoriasCatalogo] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 1. Cargar conteo de noticias por materia desde Fuseki
  useEffect(() => {
    setCargando(true);
    const params = new URLSearchParams();
    if (fechaDesde) params.append("fechaDesde", fechaDesde);
    if (fechaHasta) params.append("fechaHasta", fechaHasta);
    const query = params.toString() ? `?${params.toString()}` : "";

    fetch(`${API_BASE}/noticias/materias-conteo${query}`)
      .then((res) => res.json())
      .then((data) => {
        setConteoMaterias(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        console.error("Error al traer conteo de materias:", err);
        setCargando(false);
      });
  }, [fechaDesde, fechaHasta]);

  // 2. Cargar autoridades de tipo Materia desde Fuseki
  useEffect(() => {
    fetch(`${API_BASE}/autoridades?tipo=Materia`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategoriasCatalogo(
            data.map((m) => ({
              _id: m.uri,
              nombre: m.prefLabel,
            }))
          );
        }
      })
      .catch((err) => console.error("Error al traer materias:", err));
  }, []);

  // 3. Cargar autoridades de tipo Lugar desde Fuseki
  useEffect(() => {
    fetch(`${API_BASE}/autoridades?tipo=Lugar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLugares(
            data.map((l) => ({
              _id: l.uri,
              nombre: l.prefLabel,
            }))
          );
        }
      })
      .catch((err) => console.error("Error al traer lugares:", err));
  }, []);

  // Unificamos las materias del catálogo con las que tengan noticias activas
  const listaCategoriasUnificada = useMemo(() => {
    const mapa = new Map();
    categoriasCatalogo.forEach((c) => {
      if (c.nombre) mapa.set(c.nombre, { _id: c._id, nombre: c.nombre });
    });
    conteoMaterias.forEach((item) => {
      const nombre = item._id?.categoria;
      if (nombre && !mapa.has(nombre)) {
        mapa.set(nombre, { _id: nombre, nombre });
      }
    });
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [categoriasCatalogo, conteoMaterias]);

  const categoriasFiltradas = listaCategoriasUnificada.filter((cat) => {
    if (filtroCategoria && cat.nombre !== filtroCategoria) return false;
    return true;
  });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={onLogout || (() => navigate("/login"))} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>MATERIAS / CATEGORÍAS</h2>
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
              {listaCategoriasUnificada.map((cat) => (
                <option key={cat._id} value={cat.nombre}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Municipio / Lugar</label>
            <select
              value={filtroDepartamento}
              onChange={(e) => setFiltroDepartamento(e.target.value)}
            >
              <option value="">Todos</option>
              {lugares.map((lugar) => (
                <option key={lugar._id} value={lugar.nombre}>
                  {lugar.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE CONTEO POR MATERIA */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>MATERIAS / CATEGORÍAS</th>
                <th style={{ width: "140px", textAlign: "center" }}>PEND</th>
                <th style={{ width: "140px", textAlign: "center" }}>OK</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    Consultando grafo de noticias en Apache Jena Fuseki...
                  </td>
                </tr>
              ) : categoriasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                    No hay materias registradas todavía.
                  </td>
                </tr>
              ) : (
                categoriasFiltradas.map((cat) => {
                  const totalPend =
                    conteoMaterias.find(
                      (item) => item._id?.categoria === cat.nombre && item._id?.estado === "Pendiente"
                    )?.total || 0;
                  const totalOk =
                    conteoMaterias.find(
                      (item) => item._id?.categoria === cat.nombre && item._id?.estado === "OK"
                    )?.total || 0;

                  return (
                    <tr key={cat._id}>
                      <td style={{ fontWeight: 700 }}>{cat.nombre}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="num-btn pend"
                          onClick={() => irATitulares(cat.nombre, "Pendiente")}
                        >
                          {totalPend}
                        </button>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="num-btn ok"
                          onClick={() => irATitulares(cat.nombre, "OK")}
                        >
                          {totalOk}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MateriasPage;