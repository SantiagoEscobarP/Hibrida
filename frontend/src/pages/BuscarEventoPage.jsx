// src/pages/BuscarEventoPage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './BuscarEventoPage.css';

function BuscarEventoPage({ usuario }) {
  const navigate = useNavigate();
  const [eventosExistentes, setEventosExistentes] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Filtros (estilo Autoridades — inputs de columna)
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroResumen, setFiltroResumen] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');

  const usuarioSesion = useMemo(() => {
    if (usuario) return usuario;
    try {
      const stored = localStorage.getItem('pressindex_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [usuario]);

  const rolUsuario = (usuarioSesion?.rol || '').toString().trim().toLowerCase();
  const puedeEditarEventos = rolUsuario === 'administrador' || rolUsuario === 'superusuario';

  useEffect(() => {
    fetch('http://localhost:5000/api/eventos')
      .then((response) => response.json())
      .then((data) => setEventosExistentes(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Error al cargar eventos:', error));

    fetch('http://localhost:5000/api/categorias')
      .then((res) => res.json())
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Error al cargar categorías:', err));
  }, []);

  // Función de filtrado aplicada en tiempo real
  const eventosFiltrados = eventosExistentes.filter((ev) => {
    const fechaStr = ev.fecha_creacion
      ? new Date(ev.fecha_creacion).toLocaleDateString('es-CO')
      : '';
    const resumenStr = (ev.resumen_evento || ev.resumen || '').toLowerCase();
    const categoriaStr = (ev.estado || ev.categoria || '').toLowerCase();
    const municipioStr = (
      ev.direccion_hecho?.localidad || ev.municipio || ''
    ).toLowerCase();

    return (
      (filtroFecha === '' || fechaStr.includes(filtroFecha)) &&
      (filtroResumen === '' || resumenStr.includes(filtroResumen.toLowerCase())) &&
      (filtroCategoria === '' || categoriaStr.includes(filtroCategoria.toLowerCase())) &&
      (filtroMunicipio === '' || municipioStr.includes(filtroMunicipio.toLowerCase()))
    );
  });

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate('/')} />
      <div className="content-area">
        <header className="page-header-title">
          <h2>BUSCAR EVENTO EXISTENTE</h2>
        </header>

        {/* Tabla con filtros de columna al estilo Autoridades */}
        <div className="autoridades-table-container">
          {/* Fila de filtros */}
          <div className="table-header-grid buscar-grid">
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input
                type="text"
                placeholder="Fecha (dd/mm/aaaa)"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input
                type="text"
                placeholder="Resumen / palabras clave"
                value={filtroResumen}
                onChange={(e) => setFiltroResumen(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input
                type="text"
                placeholder="Categoría / estado"
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
              />
            </div>
            <div className="filter-field">
              <span className="filter-icon">⚙</span>
              <input
                type="text"
                placeholder="Municipio / localidad"
                value={filtroMunicipio}
                onChange={(e) => setFiltroMunicipio(e.target.value)}
              />
            </div>
            <div className="empty-col"></div>
          </div>

          {/* Encabezados de columna */}
          <div className="table-header-grid buscar-grid buscar-col-headers">
            <div className="col-header-label">FECHA</div>
            <div className="col-header-label">RESUMEN</div>
            <div className="col-header-label">CATEGORÍA</div>
            <div className="col-header-label">MUNICIPIO</div>
            <div className="col-header-label">ACCIÓN</div>
          </div>

          {/* Filas de datos */}
          <div className="table-body-rows">
            {eventosFiltrados.length === 0 ? (
              <div className="table-data-row">
                <div className="cell-box" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#888' }}>
                  No se encontraron eventos con los filtros aplicados.
                </div>
              </div>
            ) : (
              eventosFiltrados.map((ev) => {
                const eventId = ev._id || ev.id;
                return (
                  <div key={eventId} className="table-data-row buscar-data-row">
                    <div className="cell-box">
                      {ev.fecha_creacion
                        ? new Date(ev.fecha_creacion).toLocaleDateString('es-CO')
                        : 'Sin fecha'}
                    </div>
                    <div className="cell-box">
                      {ev.resumen_evento || ev.resumen || 'Sin resumen'}
                    </div>
                    <div className="cell-box">
                      <span className="tag">{ev.estado || ev.categoria || 'N/A'}</span>
                    </div>
                    <div className="cell-box">
                      {ev.direccion_hecho?.localidad || ev.municipio || 'Sin localidad'}
                    </div>
                    <div className="cell-action">
                      {puedeEditarEventos ? (
                        <button
                          className="btn-reg"
                          onClick={() => navigate(`/editar-evento/${eventId}`)}
                        >
                          REG
                        </button>
                      ) : (
                        <button className="btn-reg" disabled title="Solo lectura">
                          VER
                        </button>
                      )}
                      <button
                        className="btn-holding"
                        onClick={() => navigate(`/indexacion/${eventId}`)}
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

        <button className="btn-back" onClick={() => navigate(-1)}>Cancelar</button>
      </div>
    </div>
  );
}

export default BuscarEventoPage;
