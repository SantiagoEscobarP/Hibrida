// src/pages/AutoridadesPage.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './AutoridadesPage.css';

function AutoridadesPage({ usuario }) {
  const navigate = useNavigate();
  const { id } = useParams();           // ← id presente = modo edición
  const modoEdicion = Boolean(id);

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
  const puedeEditarAutoridades = rolUsuario === 'administrador' || rolUsuario === 'superusuario';

  // Control de secciones colapsables
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    datosAutoridad: true,
    descripcion: true,
    enlacesExternos: true,
    notas: true,
  });

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas((prev) => ({ ...prev, [seccion]: !prev[seccion] }));
  };

  // ── Estados del formulario ──
  const [cargando, setCargando] = useState(modoEdicion);
  const [fechaCatalogacion, setFechaCatalogacion] = useState(new Date().toLocaleDateString('es-CO'));

  // Datos de autoridad
  const [tipoAutoridad, setTipoAutoridad] = useState('');
  const [terminoAutorizado, setTerminoAutorizado] = useState('');
  const [idioma, setIdioma] = useState('');
  const [fuenteAutoridad, setFuenteAutoridad] = useState({ visible: false, url: '' });
  const [terminosAlternativos, setTerminosAlternativos] = useState([]);

  // Descripción
  const [descripcionTermino, setDescripcionTermino] = useState('');
  const [fuenteDescripcion, setFuenteDescripcion] = useState({ visible: false, url: '' });
  const [tipoCampoExtraDesc, setTipoCampoExtraDesc] = useState('');
  const [valorCampoExtraDesc, setValorCampoExtraDesc] = useState('');

  // Enlaces externos
  const [enlacesList, setEnlacesList] = useState([
    { tipo: '', enlace: '', fuenteVisible: false, urlFuente: '' }
  ]);

  // Notas
  const [notasList, setNotasList] = useState([
    { tipo: '', nota: '', soloStaff: false }
  ]);

  // ── Carga de datos existentes (modo edición) ──
  const [coleccionOrigen, setColeccionOrigen] = useState('agentes');

  useEffect(() => {
    if (!modoEdicion) return;
    setCargando(true);
    fetch(`http://localhost:5000/api/agentes/${id}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error || data.detail) {
          alert('No se pudo cargar la autoridad: ' + (data.error || data.detail || 'Error del servidor'));
          navigate('/autoridades');
          return null;
        }
        return data;
      })
      .then((data) => {
        if (!data) return;
        // Colección de origen (para guardar en el mismo lugar)
        setColeccionOrigen(data._coleccion || 'agentes');

        // Poblar formulario con datos existentes (mapea las 4 colecciones)
        setTipoAutoridad(data.tipo_nombre || data.tipoAutoridad || data.tipo_lugar || '');
        setTerminoAutorizado(data.nombre || data.terminoAutorizado || '');
        setIdioma(data.idioma || '');
        setDescripcionTermino(data.descripcion_breve || data.descripcionTermino || '');

        // Términos alternativos (alias)
        const alias = data.alias || data.terminosAlternativos || [];
        if (alias.length > 0) {
          setTerminosAlternativos(
            alias.map((a) => (typeof a === 'string' ? { termino: a } : a))
          );
        }

        // Fuente de autoridad
        const refs = data.referencias_externas || [];
        if (refs.length > 0) {
          setFuenteAutoridad({ visible: true, url: refs[0] || '' });
        }

        // Enlaces externos
        const enlaces = data.enlaces_externos || data.enlacesList || [];
        if (enlaces.length > 0) {
          setEnlacesList(
            enlaces.map((e) => ({
              tipo: e.tipo || '',
              enlace: e.enlace || '',
              fuenteVisible: Boolean(e.fuente || e.urlFuente),
              urlFuente: e.fuente || e.urlFuente || '',
            }))
          );
        }

        // Notas
        const notas = data.notas || data.notasList || [];
        if (notas.length > 0) {
          setNotasList(
            notas.map((n) => ({
              tipo: n.tipo || '',
              nota: n.texto || n.nota || '',
              soloStaff: n.soloStaff || false,
            }))
          );
        }

        // Fecha de catalogación
        if (data.fecha_creacion || data.fechaCreacion) {
          const f = data.fecha_creacion || data.fechaCreacion;
          try {
            setFechaCatalogacion(new Date(f).toLocaleDateString('es-CO'));
          } catch (_) {}
        }

        setCargando(false);
      })
      .catch((err) => {
        console.error('Error cargando autoridad:', err);
        alert('Error de red al cargar la autoridad.');
        setCargando(false);
      });
  }, [id, modoEdicion]);

  // ── Manejadores dinámicos ──
  const agregarTerminoAlternativo = () => {
    setTerminosAlternativos([...terminosAlternativos, { termino: '' }]);
  };

  const agregarEnlace = () => {
    setEnlacesList([...enlacesList, { tipo: '', enlace: '', fuenteVisible: false, urlFuente: '' }]);
  };

  const actualizarEnlace = (index, campo, valor) => {
    const nuevos = [...enlacesList];
    nuevos[index][campo] = valor;
    setEnlacesList(nuevos);
  };

  const agregarNota = () => {
    setNotasList([...notasList, { tipo: '', nota: '', soloStaff: false }]);
  };

  const actualizarNota = (index, campo, valor) => {
    const nuevos = [...notasList];
    nuevos[index][campo] = valor;
    setNotasList(nuevos);
  };

  // ── Guardar (POST o PUT según modo) ──
  const manejarGuardarAutoridad = async () => {
    if (!terminoAutorizado || !tipoAutoridad) {
      alert('Por favor completa el Tipo de Autoridad y el Término Autorizado.');
      return;
    }

    const payload = {
      _coleccion: modoEdicion
        ? coleccionOrigen
        : (tipoAutoridad === 'Entidad' || tipoAutoridad === 'Entidad / Organización' || tipoAutoridad === 'Grupo Criminal' || tipoAutoridad === 'Estructura Criminal'
            ? 'estructura'
            : tipoAutoridad === 'Lugar'
              ? 'lugar'
              : 'agentes'),
      nombre: terminoAutorizado,
      tipo_nombre: tipoAutoridad,
      idioma: idioma,
      descripcion_breve: descripcionTermino,
      alias: terminosAlternativos.map((t) => t.termino).filter(Boolean),
      referencias_externas: fuenteAutoridad.url ? [fuenteAutoridad.url] : [],
      enlaces_externos: enlacesList
        .filter((e) => e.enlace)
        .map((e) => ({ tipo: e.tipo, enlace: e.enlace, fuente: e.urlFuente || null })),
      notas: notasList
        .filter((n) => n.nota)
        .map((n) => ({ tipo: n.tipo, texto: n.nota, soloStaff: n.soloStaff })),
    };

    try {
      const url = modoEdicion
        ? `http://localhost:5000/api/agentes/${id}`
        : 'http://localhost:5000/api/agentes';
      const method = modoEdicion ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resultado = await response.json().catch(() => ({}));

      if (!response.ok || resultado.error || resultado.detail) {
        alert('Error al guardar: ' + (resultado.error || resultado.detail || 'Error del servidor'));
        return;
      }

      alert(modoEdicion ? '¡Autoridad actualizada exitosamente!' : '¡Autoridad guardada exitosamente!');
      navigate('/autoridades');
    } catch (error) {
      console.error('Error al guardar autoridad:', error);
      alert('Hubo un error al guardar.');
    }
  };

  // ── Acceso restringido (indexador) ──
  if (!puedeEditarAutoridades) {
    return (
      <div className="page-container">
        <Navbar usuario={usuarioSesion} onLogout={() => navigate('/')} />
        <div className="content-area" style={{ padding: '24px' }}>
          <header className="page-header-title">
            <h2>ACCESO RESTRINGIDO</h2>
          </header>
          <div className="indexacion-card" style={{ maxWidth: 680 }}>
            <p style={{ marginBottom: '16px' }}>
              Como indexador puedes consultar autoridades, pero no crear ni editar registros.
            </p>
            <button className="btn-secondary" onClick={() => navigate('/autoridades')}>
              Volver al listado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pantalla de carga ──
  if (cargando) {
    return (
      <div className="page-container">
        <Navbar usuario={usuarioSesion} onLogout={() => navigate('/')} />
        <div className="content-area" style={{ padding: '32px', textAlign: 'center' }}>
          <p>Cargando datos de la autoridad...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate('/')} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>{modoEdicion ? 'EDITAR AUTORIDAD' : 'CREAR AUTORIDAD'}</h2>
        </header>

        {/* Fecha de catalogación */}
        <div className="catalogacion-header">
          <label>Fecha de catalogación</label>
          <select
            value={fechaCatalogacion}
            onChange={(e) => setFechaCatalogacion(e.target.value)}
            className="select-catalogacion"
          >
            <option value={fechaCatalogacion}>{`Última Actualización: ${fechaCatalogacion}`}</option>
          </select>
        </div>

        <div className="accordion-form-container">

          {/* 1. DATOS DE AUTORIDAD */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion('datosAutoridad')}>
              <span>{seccionesAbiertas.datosAutoridad ? '∧' : '∨'} Datos de autoridad</span>
            </div>
            {seccionesAbiertas.datosAutoridad && (
              <div className="accordion-body">
                <div className="three-col-grid">
                  <div>
                    <label className="field-label">Tipo de autoridad<span className="req">*</span></label>
                    <select
                      className="select-full-styled"
                      value={tipoAutoridad}
                      onChange={(e) => setTipoAutoridad(e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Persona">Persona</option>
                      <option value="Entidad">Entidad / Organización</option>
                      <option value="Lugar">Lugar</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Término autorizado<span className="req">*</span></label>
                    <textarea
                      className="input-textarea-small"
                      value={terminoAutorizado}
                      onChange={(e) => setTerminoAutorizado(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Idioma<span className="req">*</span></label>
                    <select
                      className="select-full-styled"
                      value={idioma}
                      onChange={(e) => setIdioma(e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Español">Español</option>
                      <option value="Inglés">Inglés</option>
                    </select>
                  </div>
                </div>

                {!fuenteAutoridad.visible ? (
                  <button type="button" className="btn-gray-action margin-top-small"
                    onClick={() => setFuenteAutoridad({ ...fuenteAutoridad, visible: true })}>
                    Agregar fuente
                  </button>
                ) : (
                  <div className="ref-container margin-top-small">
                    <span className="ref-tag">∨ 1 referencia</span>
                    <div className="ref-box">
                      <label>URL:</label>
                      <input
                        type="text"
                        value={fuenteAutoridad.url}
                        onChange={(e) => setFuenteAutoridad({ ...fuenteAutoridad, url: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                )}

                <div className="field-group margin-top">
                  <label className="field-label">Términos alternativos</label>
                  {terminosAlternativos.map((tAlt, idx) => (
                    <div key={idx} className="alt-title-row">
                      <textarea
                        className="input-textarea-small"
                        value={tAlt.termino}
                        onChange={(e) => {
                          const nuevos = [...terminosAlternativos];
                          nuevos[idx].termino = e.target.value;
                          setTerminosAlternativos(nuevos);
                        }}
                        placeholder="Término alternativo..."
                      />
                    </div>
                  ))}
                  <button type="button" className="btn-gray-action margin-top-small" onClick={agregarTerminoAlternativo}>
                    Agregar término alternativo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. DESCRIPCIÓN */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion('descripcion')}>
              <span>{seccionesAbiertas.descripcion ? '∧' : '∨'} Descripción</span>
            </div>
            {seccionesAbiertas.descripcion && (
              <div className="accordion-body">
                <div className="field-group">
                  <label className="field-label">Descripción del término</label>
                  <textarea
                    className="input-textarea-large"
                    value={descripcionTermino}
                    onChange={(e) => setDescripcionTermino(e.target.value)}
                  />
                  {!fuenteDescripcion.visible ? (
                    <button type="button" className="btn-gray-action margin-top-small"
                      onClick={() => setFuenteDescripcion({ ...fuenteDescripcion, visible: true })}>
                      Agregar fuente
                    </button>
                  ) : (
                    <div className="ref-container margin-top-small">
                      <span className="ref-tag">∨ 1 referencia</span>
                      <div className="ref-box">
                        <label>URL:</label>
                        <input
                          type="text"
                          value={fuenteDescripcion.url}
                          onChange={(e) => setFuenteDescripcion({ ...fuenteDescripcion, url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="two-col-grid margin-top">
                  <div>
                    <select
                      className="select-full-styled"
                      value={tipoCampoExtraDesc}
                      onChange={(e) => setTipoCampoExtraDesc(e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Anotación">Anotación</option>
                      <option value="Atributo">Atributo</option>
                    </select>
                  </div>
                  <div>
                    <textarea
                      className="input-textarea-small"
                      value={valorCampoExtraDesc}
                      onChange={(e) => setValorCampoExtraDesc(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. ENLACES EXTERNOS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion('enlacesExternos')}>
              <span>{seccionesAbiertas.enlacesExternos ? '∧' : '∨'} Enlaces externos</span>
            </div>
            {seccionesAbiertas.enlacesExternos && (
              <div className="accordion-body">
                {enlacesList.map((item, idx) => (
                  <div key={idx} className="enlace-row-block margin-bottom-small">
                    <div className="two-col-grid">
                      <div>
                        <label className="field-label">Tipo de enlace</label>
                        <select
                          className="select-full-styled"
                          value={item.tipo}
                          onChange={(e) => actualizarEnlace(idx, 'tipo', e.target.value)}
                        >
                          <option value="">Select</option>
                          <option value="Wikipedia">Wikipedia</option>
                          <option value="Sitio Oficial">Sitio Oficial</option>
                          <option value="Perfil Público">Perfil Público</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Enlace</label>
                        <textarea
                          className="input-textarea-small"
                          value={item.enlace}
                          onChange={(e) => actualizarEnlace(idx, 'enlace', e.target.value)}
                        />
                      </div>
                    </div>
                    {!item.fuenteVisible ? (
                      <button type="button" className="btn-gray-action margin-top-small"
                        onClick={() => actualizarEnlace(idx, 'fuenteVisible', true)}>
                        Agregar fuente
                      </button>
                    ) : (
                      <div className="ref-container margin-top-small">
                        <span className="ref-tag">∨ 1 referencia</span>
                        <div className="ref-box">
                          <label>URL:</label>
                          <input
                            type="text"
                            value={item.urlFuente}
                            onChange={(e) => actualizarEnlace(idx, 'urlFuente', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" className="btn-gray-action margin-top-small" onClick={agregarEnlace}>
                  + Agregar otro enlace
                </button>
              </div>
            )}
          </div>

          {/* 4. NOTAS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion('notas')}>
              <span>{seccionesAbiertas.notas ? '∧' : '∨'} Notas</span>
            </div>
            {seccionesAbiertas.notas && (
              <div className="accordion-body">
                {notasList.map((notaItem, idx) => (
                  <div key={idx} className="notas-grid margin-bottom-small">
                    <div>
                      <label className="field-label">Tipo de nota</label>
                      <select
                        className="select-full-styled"
                        value={notaItem.tipo}
                        onChange={(e) => actualizarNota(idx, 'tipo', e.target.value)}
                      >
                        <option value="">Select</option>
                        <option value="General">General</option>
                        <option value="Uso Interno">Uso Interno</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Nota</label>
                      <textarea
                        className="input-textarea-small"
                        value={notaItem.nota}
                        onChange={(e) => actualizarNota(idx, 'nota', e.target.value)}
                      />
                    </div>
                    <div className="checkbox-col">
                      <label className="field-label">Solo staff</label>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={notaItem.soloStaff}
                        onChange={(e) => actualizarNota(idx, 'soloStaff', e.target.checked)}
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-gray-action margin-top-small" onClick={agregarNota}>
                  Agregar nota
                </button>
              </div>
            )}
          </div>

          {/* BOTONES */}
          <div className="footer-action-area" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="button" className="btn-primary-dark" onClick={manejarGuardarAutoridad}>
              {modoEdicion ? 'ACTUALIZAR AUTORIDAD' : 'GUARDAR AUTORIDAD'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => navigate('/autoridades')}>
              Cancelar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AutoridadesPage;
