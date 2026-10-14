// src/pages/CrearEventoPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./CrearEventoPage.css";

const API_BASE = "http://localhost:8000/api";

function CrearEventoPage({ usuario }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();

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
  const esAdministrador =
    rolUsuario === "administrador" || rolUsuario === "analista" || rolUsuario === "admin";
  const esSuperusuario = rolUsuario === "superusuario";
  const esIndexador = rolUsuario === "indexador";
  const esModoEdicion = location.pathname.toLowerCase().startsWith("/editar-evento/");
  const puedeEditarEventos = esAdministrador || esSuperusuario;
  const puedeCrearEventos = !esIndexador || !!usuarioSesion?.permiso_crear_eventos;
  const puedeAccederPagina = esModoEdicion ? puedeEditarEventos : puedeCrearEventos;

  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    titulo: true,
    lugar: true,
    agentes: true,
    organizacion: true,
    descriptivos: true,
    notas: true,
    materias: true,
    clasificacion: true,
  });

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas((prev) => ({ ...prev, [seccion]: !prev[seccion] }));
  };

  // Estados del formulario
  const [fechaCatalogacion, setFechaCatalogacion] = useState(
    new Date().toLocaleDateString("es-CO")
  );
  const [titulo, setTitulo] = useState("");
  const [fuenteTitulo, setFuenteTitulo] = useState({ visible: false, url: "" });
  const [titulosAlternativos, setTitulosAlternativos] = useState([]);
  const [resumen, setResumen] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [mostrarSugerenciasMunicipio, setMostrarSugerenciasMunicipio] = useState(false);
  const [mostrarSugerenciasSubdivision, setMostrarSugerenciasSubdivision] = useState(false);
  const [subdivision, setSubdivision] = useState("");
  const [complemento, setComplemento] = useState("");

  const [afectados, setAfectados] = useState([
    {
      nombre: "",
      tipoNombre: "Persona",
      afiliacion: "",
      rol: "Víctima / Afectado",
      nota: "",
      tieneNota: false,
      tieneFuente: false,
      urlFuente: "",
    },
  ]);

  const [victimarios, setVictimarios] = useState([
    {
      nombre: "",
      tipoNombre: "Persona",
      afiliacion: "",
      rol: "Presunto implicado",
      edad: "",
      nota: "",
      tieneNota: false,
      tieneFuente: false,
      urlFuente: "",
    },
  ]);

  const [notasList, setNotasList] = useState([{ tipo: "", nota: "", soloStaff: false }]);
  const [materiasList, setMateriasList] = useState([
    { materia: "", subjectSource: "Other", subjectType: "Topical term" },
  ]);

  const [organizacion, setOrganizacion] = useState(null);
  const [lideres, setLideres] = useState([]);
  const [organizacionesExistentes, setOrganizacionesExistentes] = useState([]);
  const [mostrarNuevaOrg, setMostrarNuevaOrg] = useState(false);
  const [nuevaOrgNombre, setNuevaOrgNombre] = useState("");
  const [nuevaOrgAlias, setNuevaOrgAlias] = useState("");
  const [nuevoLiderNombre, setNuevoLiderNombre] = useState("");
  const [nuevoLiderAlias, setNuevoLiderAlias] = useState("");

  // Catálogos desde Fuseki
  const [agentes, setAgentes] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [categorias, setCategorias] = useState([]);

  // Cargar datos de edición o precargar el titular base
  useEffect(() => {
    if (!puedeAccederPagina || !id) return;

    if (esModoEdicion) {
      fetch(`${API_BASE}/eventos/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((evento) => {
          if (!evento) return;
          setFechaCatalogacion(evento.fechaCatalogacion || fechaCatalogacion);
          setTitulo(evento.titulo || "");
          setResumen(evento.resumen || "");
          setMunicipio(evento.municipio || "");
          setSubdivision(evento.subdivision || "");
          setComplemento(evento.complemento || "");
          if (Array.isArray(evento.afectados) && evento.afectados.length)
            setAfectados(evento.afectados);
          if (Array.isArray(evento.victimarios) && evento.victimarios.length)
            setVictimarios(evento.victimarios);
          if (Array.isArray(evento.notasList) && evento.notasList.length)
            setNotasList(evento.notasList);
          if (Array.isArray(evento.materiasList) && evento.materiasList.length)
            setMateriasList(evento.materiasList);
          if (evento.organizacion) setOrganizacion(evento.organizacion);
          if (Array.isArray(evento.lideres)) setLideres(evento.lideres);
        })
        .catch((err) => console.error("Error cargando evento:", err));
      return;
    }

    // Modo creación desde un titular (/crear-evento/:id)
    fetch(`${API_BASE}/noticias/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTitulo(data.encabezado || "");
          setResumen(data.resumen || "");
        }
      })
      .catch((err) => console.error("Error al precargar titular:", err));
  }, [id, puedeAccederPagina, esModoEdicion]);

  // Cargar Autoridades desde Fuseki
  useEffect(() => {
    if (!puedeAccederPagina) return;

    fetch(`${API_BASE}/autoridades`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setAgentes(
          data.map((a) => ({
            _id: a.id || a.uri,
            nombre: a.prefLabel,
            tipo_nombre: a.tipo,
          }))
        );
        setOrganizacionesExistentes(
          data
            .filter(
              (a) =>
                (a.tipo || "").toLowerCase().includes("grupo") ||
                (a.tipo || "").toLowerCase().includes("organizacion") ||
                (a.tipo || "").toLowerCase().includes("entidad")
            )
            .map((o) => ({ id: o.id, nombre: o.prefLabel, alias: o.altLabel }))
        );
      })
      .catch((err) => console.error("Error al traer autoridades:", err));

    fetch(`${API_BASE}/autoridades?tipo=Lugar`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setLugares(
            data.map((l) => ({
              _id: l.id || l.uri,
              nombre: l.prefLabel,
              tipo_lugar: "Municipio",
            }))
          );
        }
      })
      .catch((err) => console.error("Error al traer lugares:", err));

    fetch(`${API_BASE}/autoridades?tipo=Materia`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategorias(data.map((c) => ({ _id: c.id || c.uri, nombre: c.prefLabel })));
        }
      })
      .catch((err) => console.error("Error al traer materias:", err));
  }, [puedeAccederPagina]);

  // Manejadores dinámicos
  const agregarTituloAlternativo = () => {
    setTitulosAlternativos([
      ...titulosAlternativos,
      { texto: "", tieneFuente: false, urlFuente: "" },
    ]);
  };

  const actualizarTituloAlt = (index, campo, valor) => {
    const nuevos = [...titulosAlternativos];
    nuevos[index][campo] = valor;
    setTitulosAlternativos(nuevos);
  };

  const agregarAfectado = () => {
    setAfectados([
      ...afectados,
      {
        nombre: "",
        tipoNombre: "Persona",
        afiliacion: "",
        rol: "",
        nota: "",
        tieneNota: false,
        tieneFuente: false,
        urlFuente: "",
      },
    ]);
  };

  const actualizarAfectado = (index, campo, valor) => {
    const nuevos = [...afectados];
    nuevos[index][campo] = valor;
    setAfectados(nuevos);
  };

  const agregarVictimario = () => {
    setVictimarios([
      ...victimarios,
      {
        nombre: "",
        tipoNombre: "Persona",
        afiliacion: "",
        rol: "",
        edad: "",
        nota: "",
        tieneNota: false,
        tieneFuente: false,
        urlFuente: "",
      },
    ]);
  };

  const actualizarVictimario = (index, campo, valor) => {
    const nuevos = [...victimarios];
    nuevos[index][campo] = valor;
    setVictimarios(nuevos);
  };

  const agregarNotaInstancia = () => {
    setNotasList([...notasList, { tipo: "", nota: "", soloStaff: false }]);
  };

  const actualizarNotaInstancia = (index, campo, valor) => {
    const nuevos = [...notasList];
    nuevos[index][campo] = valor;
    setNotasList(nuevos);
  };

  const agregarMateriaItem = () => {
    setMateriasList([...materiasList, { materia: "", subjectSource: "", subjectType: "" }]);
  };

  const actualizarMateriaItem = (index, campo, valor) => {
    const nuevos = [...materiasList];
    nuevos[index][campo] = valor;
    setMateriasList(nuevos);
  };

  const manejarCrearEvento = async () => {
    if (!titulo.trim() || !resumen.trim()) {
      alert("Por favor completa el Título y el Resumen del evento.");
      return;
    }

    const payload = {
      id_titular: !esModoEdicion ? id : null,
      fechaCatalogacion,
      titulo,
      titulo_recurso: titulo,
      fuenteTitulo,
      titulosAlternativos,
      resumen,
      resumen_evento: resumen,
      municipio: municipio || "Bogotá D.C.",
      subdivision,
      complemento,
      afectados,
      victimarios,
      notasList,
      materiasList,
      organizacion,
      lideres,
    };

    try {
      const endpoint = esModoEdicion
        ? `${API_BASE}/eventos/${id}`
        : `${API_BASE}/eventos`;
      const method = esModoEdicion ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert(
          esModoEdicion
            ? "¡Evento actualizado exitosamente en Fuseki!"
            : "¡Evento indexado y enlazado exitosamente en Fuseki!"
        );
        if (!esModoEdicion && id) {
          navigate(`/indexacion/${id}`);
        } else {
          navigate("/buscar-evento");
        }
      } else {
        alert("Error al guardar el evento en Fuseki.");
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("No se pudo conectar con FastAPI (puerto 8000).");
    }
  };

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/login")} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>
            {esModoEdicion
              ? "EDITAR EVENTO EN FUSEKI"
              : "INDEXACIÓN DE TITULARES - DESCRIPCIÓN DE EVENTO"}
          </h2>
        </header>

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
          {/* 1. DATOS DE TÍTULO */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("titulo")}>
              <span>{seccionesAbiertas.titulo ? "▼" : "▶"} Datos de título</span>
            </div>
            {seccionesAbiertas.titulo && (
              <div className="accordion-body">
                <div className="field-group">
                  <label className="field-label">
                    Título del recurso / evento<span className="req">*</span>
                  </label>
                  <textarea
                    className="input-textarea-small"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Escribe el título del evento..."
                  />
                </div>

                <div className="field-group margin-top-small">
                  <label className="field-label">Títulos alternativos</label>
                  {titulosAlternativos.map((tAlt, idx) => (
                    <div key={idx} className="alt-title-row">
                      <textarea
                        className="input-textarea-small"
                        value={tAlt.texto}
                        onChange={(e) => actualizarTituloAlt(idx, "texto", e.target.value)}
                        placeholder="Título alternativo..."
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-gray-action margin-top-small"
                    onClick={agregarTituloAlternativo}
                  >
                    + Agregar título alternativo
                  </button>
                </div>

                <div className="field-group margin-top-small">
                  <label className="field-label">
                    Resumen del evento<span className="req">*</span>
                  </label>
                  <textarea
                    className="input-textarea-large"
                    value={resumen}
                    onChange={(e) => setResumen(e.target.value)}
                    placeholder=" síntesis detallada de los hechos..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. LUGAR DE OCURRENCIA */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("lugar")}>
              <span>{seccionesAbiertas.lugar ? "▼" : "▶"} Lugar de ocurrencia</span>
            </div>
            {seccionesAbiertas.lugar && (
              <div className="accordion-body">
                <div className="three-col-grid">
                  <div style={{ position: "relative" }}>
                    <label className="field-label">
                      Municipio<span className="req">*</span>
                    </label>
                    <textarea
                      className="input-textarea-small"
                      value={municipio}
                      onChange={(e) => {
                        setMunicipio(e.target.value);
                        setMostrarSugerenciasMunicipio(true);
                      }}
                      placeholder="Ej: Bogotá D.C., Cali, Medellín..."
                    />
                    {mostrarSugerenciasMunicipio && municipio.length > 0 && (
                      <div
                        style={{
                          border: "1px solid #cbd5e1",
                          borderRadius: "10px",
                          backgroundColor: "white",
                          position: "absolute",
                          zIndex: 10,
                          width: "100%",
                          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                      >
                        {lugares
                          .filter((l) =>
                            l.nombre.toLowerCase().includes(municipio.toLowerCase())
                          )
                          .slice(0, 5)
                          .map((l) => (
                            <div
                              key={l._id}
                              style={{ padding: "8px 12px", cursor: "pointer", fontSize: "13px" }}
                              onClick={() => {
                                setMunicipio(l.nombre);
                                setMostrarSugerenciasMunicipio(false);
                              }}
                            >
                              {l.nombre}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="field-label">Subdivisión / Localidad</label>
                    <textarea
                      className="input-textarea-small"
                      value={subdivision}
                      onChange={(e) => setSubdivision(e.target.value)}
                      placeholder="Ej: Usaquén, Kennedy, Zona Rural..."
                    />
                  </div>

                  <div>
                    <label className="field-label">Complemento / Barrio</label>
                    <textarea
                      className="input-textarea-small"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Dirección o punto de referencia..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. AGENTES INVOLUCRADOS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("agentes")}>
              <span>{seccionesAbiertas.agentes ? "▼" : "▶"} Datos de agentes involucrados</span>
            </div>
            {seccionesAbiertas.agentes && (
              <div className="accordion-body">
                <div className="agente-block">
                  <h4 className="sub-title">Afectado(s)</h4>
                  {afectados.map((af, idx) => (
                    <div key={idx} className="agente-card">
                      <div className="agente-grid">
                        <div style={{ position: "relative" }}>
                          <label className="field-label">Nombre</label>
                          <textarea
                            className="input-textarea-small"
                            value={af.nombre}
                            onChange={(e) => {
                              actualizarAfectado(idx, "nombre", e.target.value);
                              actualizarAfectado(idx, "agenteId", null);
                            }}
                          />
                          {af.nombre.length > 0 && !af.agenteId && (
                            <div
                              style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "10px",
                                backgroundColor: "white",
                                position: "absolute",
                                zIndex: 10,
                                width: "100%",
                              }}
                            >
                              {agentes
                                .filter((a) =>
                                  a.nombre.toLowerCase().includes(af.nombre.toLowerCase())
                                )
                                .slice(0, 5)
                                .map((a) => (
                                  <div
                                    key={a._id}
                                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}
                                    onClick={() => {
                                      actualizarAfectado(idx, "nombre", a.nombre);
                                      actualizarAfectado(idx, "tipoNombre", a.tipo_nombre || "Persona");
                                      actualizarAfectado(idx, "agenteId", a._id);
                                    }}
                                  >
                                    {a.nombre} ({a.tipo_nombre})
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="field-label">Tipo de nombre</label>
                          <textarea
                            className="input-textarea-small"
                            value={af.tipoNombre}
                            onChange={(e) => actualizarAfectado(idx, "tipoNombre", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Afiliación</label>
                          <textarea
                            className="input-textarea-small"
                            value={af.afiliacion}
                            onChange={(e) => actualizarAfectado(idx, "afiliacion", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Rol</label>
                          <textarea
                            className="input-textarea-small"
                            value={af.rol}
                            onChange={(e) => actualizarAfectado(idx, "rol", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-gray-action margin-top-small"
                    onClick={agregarAfectado}
                  >
                    + Agregar afectado
                  </button>
                </div>

                <div className="agente-block margin-top">
                  <h4 className="sub-title">Victimario(s)</h4>
                  {victimarios.map((vic, idx) => (
                    <div key={idx} className="agente-card">
                      <div className="agente-grid-vic">
                        <div style={{ position: "relative" }}>
                          <label className="field-label">Nombre</label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.nombre}
                            onChange={(e) => {
                              actualizarVictimario(idx, "nombre", e.target.value);
                              actualizarVictimario(idx, "agenteId", null);
                            }}
                          />
                          {vic.nombre.length > 0 && !vic.agenteId && (
                            <div
                              style={{
                                border: "1px solid #cbd5e1",
                                borderRadius: "10px",
                                backgroundColor: "white",
                                position: "absolute",
                                zIndex: 10,
                                width: "100%",
                              }}
                            >
                              {agentes
                                .filter((a) =>
                                  a.nombre.toLowerCase().includes(vic.nombre.toLowerCase())
                                )
                                .slice(0, 5)
                                .map((a) => (
                                  <div
                                    key={a._id}
                                    style={{ padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}
                                    onClick={() => {
                                      actualizarVictimario(idx, "nombre", a.nombre);
                                      actualizarVictimario(idx, "tipoNombre", a.tipo_nombre || "Persona");
                                      actualizarVictimario(idx, "agenteId", a._id);
                                    }}
                                  >
                                    {a.nombre} ({a.tipo_nombre})
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="field-label">Tipo de nombre</label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.tipoNombre}
                            onChange={(e) => actualizarVictimario(idx, "tipoNombre", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Afiliación</label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.afiliacion}
                            onChange={(e) => actualizarVictimario(idx, "afiliacion", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Rol</label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.rol}
                            onChange={(e) => actualizarVictimario(idx, "rol", e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="field-label">Edad</label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.edad}
                            onChange={(e) => actualizarVictimario(idx, "edad", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-gray-action margin-top-small"
                    onClick={agregarVictimario}
                  >
                    + Agregar victimario
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. ORGANIZACIÓN PERPETRADORA */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("organizacion")}>
              <span>{seccionesAbiertas.organizacion ? "▼" : "▶"} Organización perpetradora</span>
            </div>
            {seccionesAbiertas.organizacion && (
              <div className="accordion-body">
                {!mostrarNuevaOrg ? (
                  <div className="form-row">
                    <select
                      className="select-full-styled"
                      value={organizacion ? organizacion.id || organizacion.nombre : ""}
                      onChange={(e) => {
                        const sel = organizacionesExistentes.find(
                          (o) => o.id === e.target.value || o.nombre === e.target.value
                        );
                        setOrganizacion(sel || null);
                      }}
                    >
                      <option value="">Sin organización perpetradora</option>
                      {organizacionesExistentes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre} {o.alias ? `(${o.alias})` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-gray-action"
                      onClick={() => setMostrarNuevaOrg(true)}
                    >
                      + Nueva organización
                    </button>
                  </div>
                ) : (
                  <div className="form-row">
                    <input
                      className="form-control"
                      placeholder="Nombre de la organización"
                      value={nuevaOrgNombre}
                      onChange={(e) => setNuevaOrgNombre(e.target.value)}
                    />
                    <input
                      className="form-control"
                      placeholder="Alias (opcional)"
                      value={nuevaOrgAlias}
                      onChange={(e) => setNuevaOrgAlias(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-reg"
                      onClick={() => {
                        if (!nuevaOrgNombre.trim()) return;
                        setOrganizacion({
                          nombre: nuevaOrgNombre.trim(),
                          alias: nuevaOrgAlias.trim(),
                        });
                        setMostrarNuevaOrg(false);
                        setNuevaOrgNombre("");
                        setNuevaOrgAlias("");
                      }}
                    >
                      Usar organización
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. MATERIAS / CATEGORÍAS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("materias")}>
              <span>{seccionesAbiertas.materias ? "▼" : "▶"} Materias / Categorías</span>
            </div>
            {seccionesAbiertas.materias && (
              <div className="accordion-body">
                {materiasList.map((materiaItem, idx) => (
                  <div key={idx} className="three-col-grid margin-bottom-small">
                    <div>
                      <label className="field-label">Materia</label>
                      <select
                        className="select-full-styled"
                        value={materiaItem.materia}
                        onChange={(e) => actualizarMateriaItem(idx, "materia", e.target.value)}
                      >
                        <option value="">Seleccionar materia...</option>
                        {categorias.map((cat) => (
                          <option key={cat._id} value={cat.nombre}>
                            {cat.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Subject source</label>
                      <select
                        className="select-full-styled"
                        value={materiaItem.subjectSource}
                        onChange={(e) =>
                          actualizarMateriaItem(idx, "subjectSource", e.target.value)
                        }
                      >
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Subject type</label>
                      <select
                        className="select-full-styled"
                        value={materiaItem.subjectType}
                        onChange={(e) => actualizarMateriaItem(idx, "subjectType", e.target.value)}
                      >
                        <option value="Topical term">Topical term</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-gray-action margin-top-small"
                  onClick={agregarMateriaItem}
                >
                  + Agregar materia
                </button>
              </div>
            )}
          </div>

          {/* 6. NOTAS DE INSTANCIA */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("notas")}>
              <span>{seccionesAbiertas.notas ? "▼" : "▶"} Notas de instancia</span>
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
                        onChange={(e) => actualizarNotaInstancia(idx, "tipo", e.target.value)}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Nota de agentes">Nota de agentes</option>
                        <option value="Nota general">Nota general</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Nota</label>
                      <textarea
                        className="input-textarea-small"
                        value={notaItem.nota}
                        onChange={(e) => actualizarNotaInstancia(idx, "nota", e.target.value)}
                      />
                    </div>
                    <div className="checkbox-col">
                      <label className="field-label">Solo staff</label>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={notaItem.soloStaff}
                        onChange={(e) =>
                          actualizarNotaInstancia(idx, "soloStaff", e.target.checked)
                        }
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-gray-action margin-top-small"
                  onClick={agregarNotaInstancia}
                >
                  + Agregar nota
                </button>
              </div>
            )}
          </div>

          {/* BOTONES FINALES */}
          <div className="footer-action-area">
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="button" className="btn-primary-dark" onClick={manejarCrearEvento}>
              {esModoEdicion ? "ACTUALIZAR EVENTO" : "GUARDAR EVENTO EN FUSEKI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CrearEventoPage;