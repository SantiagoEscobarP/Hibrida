// src/pages/CrearEventoPage.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./CrearEventoPage.css";

function CrearEventoPage({ usuario }) {
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

  const rolUsuario = (usuarioSesion?.rol || "").toString().trim().toLowerCase();
  const esAdministrador = rolUsuario === "administrador";
  const esSuperusuario = rolUsuario === "superusuario";
  const esIndexador = rolUsuario === "indexador";

  const esModoEdicion = location.pathname.toLowerCase().startsWith("/editar-evento/");
  const puedeEditarEventos = esAdministrador || esSuperusuario;
  const puedeCrearEventos = !esIndexador || !!usuarioSesion?.permiso_crear_eventos;
  const puedeAccederPagina = esModoEdicion ? puedeEditarEventos : puedeCrearEventos;

  // Secciones del acordeón
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({
    titulo: true,
    lugar: true,
    agentes: true,
    descriptivos: true,
    notas: true,
    materias: true,
    clasificacion: true,
  });

  const toggleSeccion = (seccion) => {
    setSeccionesAbiertas((prev) => ({
      ...prev,
      [seccion]: !prev[seccion],
    }));
  };

  // ESTADOS DEL FORMULARIO
  const [fechaCatalogacion, setFechaCatalogacion] = useState(new Date().toLocaleDateString("es-CO"));
  const [titulo, setTitulo] = useState("");
  const [fuenteTitulo, setFuenteTitulo] = useState({ visible: false, url: "" });

  const { id } = useParams();

  useEffect(() => {
    if (!puedeAccederPagina || !id) return;

    if (esModoEdicion) {
      fetch(`http://localhost:5000/api/eventos/${id}`)
        .then((response) => {
          if (!response.ok) throw new Error("No se pudo cargar el evento para edición");
          return response.json();
        })
        .then((evento) => {
          setFechaCatalogacion(evento.fechaCatalogacion || evento.fecha || "");
          setTitulo(evento.titulo || evento.titulo_recurso || "");
          setFuenteTitulo(evento.fuenteTitulo || { visible: false, url: "" });
          setTitulosAlternativos(Array.isArray(evento.titulosAlternativos) ? evento.titulosAlternativos : []);
          setResumen(evento.resumen || evento.resumen_evento || "");
          setMunicipio(evento.municipio || evento.direccion_hecho?.ciudad || "");
          setSubdivision(evento.subdivision || evento.direccion_hecho?.localidad || "");
          setComplemento(evento.complemento || evento.direccion_hecho?.barrio || "");
          setAfectados(Array.isArray(evento.afectados) && evento.afectados.length ? evento.afectados : [{ nombre: "", tipoNombre: "", afiliacion: "", rol: "", nota: "", tieneNota: false, tieneFuente: false, urlFuente: "" }]);
          setVictimarios(Array.isArray(evento.victimarios) && evento.victimarios.length ? evento.victimarios : [{ nombre: "", tipoNombre: "", afiliacion: "", rol: "", edad: "", nota: "", tieneNota: false, tieneFuente: false, urlFuente: "" }]);
          setNotasList(Array.isArray(evento.notasList) && evento.notasList.length ? evento.notasList : [{ tipo: "", nota: "", soloStaff: false }]);
          setMateriasList(Array.isArray(evento.materiasList) && evento.materiasList.length ? evento.materiasList : [{ materia: "", subjectSource: "", subjectType: "" }]);
          setOrganizacion(evento.organizacion || null);
          setLideres(Array.isArray(evento.lideres) ? evento.lideres : []);
        })
        .catch((error) => console.error("Error al precargar evento para edición:", error));
      return;
    }

    fetch(`http://localhost:5000/api/titulares/${id}`)
      .then((response) => response.json())
      .then((data) => {
        setTitulo(data.encabezado || "");
        setResumen(data.resumen || "");
      })
      .catch((error) => console.error("Error al precargar el titular:", error));
  }, [id, puedeAccederPagina, esModoEdicion]);

  // Cargar organizaciones existentes para el selector
  useEffect(() => {
    fetch("http://localhost:5000/api/organizaciones")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOrganizacionesExistentes(data);
      })
      .catch((err) => console.error("Error al cargar organizaciones:", err));
  }, []);

  // Títulos alternativos
  const [titulosAlternativos, setTitulosAlternativos] = useState([]);

  const [resumen, setResumen] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [mostrarSugerenciasMunicipio, setMostrarSugerenciasMunicipio] = useState(false);
  const [mostrarSugerenciasSubdivision, setMostrarSugerenciasSubdivision] = useState(false);
  const [subdivision, setSubdivision] = useState("");
  const [complemento, setComplemento] = useState("");

  // Agentes
  const [afectados, setAfectados] = useState([
    {
      nombre: "",
      tipoNombre: "",
      afiliacion: "",
      rol: "",
      nota: "",
      tieneNota: false,
      tieneFuente: false,
      urlFuente: "",
    },
  ]);
  const [victimarios, setVictimarios] = useState([
    {
      nombre: "",
      tipoNombre: "",
      afiliacion: "",
      rol: "",
      edad: "",
      nota: "",
      tieneNota: false,
      tieneFuente: false,
      urlFuente: "",
    },
  ]);
  const [agentes, setAgentes] = useState([]);

  useEffect(() => {
    if (!puedeAccederPagina) return;

    fetch("http://localhost:5000/api/agentes")
      .then((response) => response.json())
      .then((data) => setAgentes(data))
      .catch((error) => console.error("Error al traer agentes:", error));
  }, [puedeAccederPagina]);

  const [lugares, setLugares] = useState([]);

  useEffect(() => {
    if (!puedeAccederPagina) return;

    fetch("http://localhost:5000/api/lugares")
      .then((response) => response.json())
      .then((data) => setLugares(data))
      .catch((error) => console.error("Error al traer lugares:", error));
  }, [puedeAccederPagina]);

  // Notas de instancia
  const [notasList, setNotasList] = useState([{ tipo: "", nota: "", soloStaff: false }]);

  // Materias
  const [materiasList, setMateriasList] = useState([{ materia: "", subjectSource: "", subjectType: "" }]);
  // Organización perpetradora y líderes (Fuseki)
  const [organizacion, setOrganizacion] = useState(null);
  const [lideres, setLideres] = useState([]);
  const [organizacionesExistentes, setOrganizacionesExistentes] = useState([]);
  const [mostrarNuevaOrg, setMostrarNuevaOrg] = useState(false);
  const [nuevaOrgNombre, setNuevaOrgNombre] = useState("");
  const [nuevaOrgAlias, setNuevaOrgAlias] = useState("");
  const [nuevoLiderNombre, setNuevoLiderNombre] = useState("");
  const [nuevoLiderAlias, setNuevoLiderAlias] = useState("");

  // FUNCIONES DE AGREGAR / EDITAR

  // Títulos alternativos
  const agregarTituloAlternativo = () => {
    setTitulosAlternativos([...titulosAlternativos, { texto: "", tieneFuente: false, urlFuente: "" }]);
  };

  const actualizarTituloAlt = (index, campo, valor) => {
    const nuevos = [...titulosAlternativos];
    nuevos[index][campo] = valor;
    setTitulosAlternativos(nuevos);
  };

  // Afectados
  const agregarAfectado = () => {
    setAfectados([
      ...afectados,
      {
        nombre: "",
        tipoNombre: "",
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

  // Victimarios
  const agregarVictimario = () => {
    setVictimarios([
      ...victimarios,
      {
        nombre: "",
        tipoNombre: "",
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

  // Notas
  const agregarNotaInstancia = () => {
    setNotasList([...notasList, { tipo: "", nota: "", soloStaff: false }]);
  };

  const actualizarNotaInstancia = (index, campo, valor) => {
    const nuevos = [...notasList];
    nuevos[index][campo] = valor;
    setNotasList(nuevos);
  };

  // Materias
  const agregarMateriaItem = () => {
    setMateriasList([...materiasList, { materia: "", subjectSource: "", subjectType: "" }]);
  };

  const actualizarMateriaItem = (index, campo, valor) => {
    const nuevos = [...materiasList];
    nuevos[index][campo] = valor;
    setMateriasList(nuevos);
  };

  const manejarCrearEvento = async () => {
    if (!puedeAccederPagina) {
      alert(esModoEdicion ? "No tienes permiso para editar eventos." : "No tienes permiso para crear eventos.");
      return;
    }

    if (!titulo || !resumen) {
      alert("Por favor completa el Título y el Resumen.");
      return;
    }

    const payloadEdicion = {
      fechaCatalogacion,
      titulo,
      fuenteTitulo,
      titulosAlternativos,
      resumen,
      municipio,
      subdivision,
      complemento,
      afectados,
      victimarios,
      notasList,
      materiasList,
      organizacion,
      lideres,
    };

    // Contrato Express operativo para creación
    const nuevoEvento = {
      id_titular: id,
      titulo_recurso: titulo,
      resumen_evento: resumen,
      estado: "REG",
      confiabilidad: "Alta",
      direccion_hecho: {
        ciudad: municipio,
        localidad: subdivision,
        barrio: complemento,
      },
      agentes_vinculados: [
        ...afectados.map((af) => ({
          id_agente: af.agenteId || null,
          nombre: af.nombre,
          tipoNombre: af.tipoNombre,
          afiliacion: af.afiliacion,
          roles: [af.rol || "Afectado"],
          nota: af.nota || af.nombre,
          edad: null,
        })),
        ...victimarios.map((vic) => ({
          id_agente: vic.agenteId || null,
          nombre: vic.nombre,
          tipoNombre: vic.tipoNombre,
          afiliacion: vic.afiliacion,
          roles: [vic.rol || "Victimario"],
          nota: vic.nota || vic.nombre,
          edad: vic.edad ? parseInt(vic.edad, 10) : null,
        })),
      ],
      notas: notasList
        .filter((n) => n.nota)
        .map((n) => ({
          tipo: n.tipo,
          texto: n.nota,
          soloStaff: n.soloStaff,
        })),
      lugares_mencionados: [],
      publicaciones: [],
      organizacion,
      lideres,
    };

    try {
      const endpoint = esModoEdicion ? `http://localhost:5000/api/eventos/${id}` : "http://localhost:5000/api/eventos";
      const method = esModoEdicion ? "PUT" : "POST";
      const body = esModoEdicion ? payloadEdicion : nuevoEvento;

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert(esModoEdicion ? "¡Evento actualizado exitosamente!" : "¡Evento guardado exitosamente en la base de datos!");
        navigate(-1);
      } else {
        alert(esModoEdicion ? "Error al actualizar el evento." : "Error al guardar el evento. Verifica las validaciones del servidor.");
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("No se pudo conectar con la API.");
    }
  };

  const [categorias, setCategorias] = useState([]);

  useEffect(() => {
    if (!puedeAccederPagina) return;

    fetch("http://localhost:5000/api/categorias")
      .then((response) => response.json())
      .then((data) => setCategorias(data))
      .catch((error) => console.error("Error al traer categorías:", error));
  }, [puedeAccederPagina]);

  if (!puedeAccederPagina) {
    return (
      <div className="page-container">
        <Navbar usuario={usuarioSesion} onLogout={() => navigate("/")} />
        <div className="content-area" style={{ padding: "24px" }}>
          <header className="page-header-title">
            <h2>ACCESO RESTRINGIDO</h2>
          </header>
          <div className="indexacion-card" style={{ maxWidth: 680 }}>
            <p style={{ marginBottom: "16px" }}>
              {esModoEdicion
                ? "Tu rol no tiene permisos para editar eventos existentes."
                : "Tu rol no tiene habilitado el permiso para crear eventos. Solicita al administrador activar el permiso permiso_crear_eventos para tu cuenta."}
            </p>
            <button className="btn-secondary" onClick={() => navigate("/titulares")}>Volver a Titulares</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navbar usuario={usuarioSesion} onLogout={() => navigate("/")} />

      <div className="content-area">
        <header className="page-header-title">
          <h2>INDEXACIÓN TITULARES DESCRIPCIÓN DE EVENTO</h2>
        </header>

        <div className="catalogacion-header">
          <label>Fecha de catalogación</label>
          <select value={fechaCatalogacion} onChange={(e) => setFechaCatalogacion(e.target.value)} className="select-catalogacion">
            <option value={fechaCatalogacion}>{`Última Actualización: ${fechaCatalogacion}`}</option>
          </select>
        </div>

        <div className="accordion-form-container">
          {/* 1. DATOS DE TÍTULO */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("titulo")}>
              <span>{seccionesAbiertas.titulo ? "∧" : "∨"} Datos de título</span>
            </div>
            {seccionesAbiertas.titulo && (
              <div className="accordion-body">
                <div className="field-group">
                  <label className="field-label">
                    Título del recurso<span className="req">*</span>
                  </label>
                  <textarea
                    className="input-textarea-small"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Escribe el título del recurso..."
                  />
                  {!fuenteTitulo.visible ? (
                    <button type="button" className="btn-gray-action" onClick={() => setFuenteTitulo({ ...fuenteTitulo, visible: true })}>
                      Agregar fuente
                    </button>
                  ) : (
                    <div className="ref-container">
                      <span className="ref-tag">∨ 1 referencia</span>
                      <div className="ref-box">
                        <label>URL:</label>
                        <input
                          type="text"
                          value={fuenteTitulo.url}
                          onChange={(e) =>
                            setFuenteTitulo({
                              ...fuenteTitulo,
                              url: e.target.value,
                            })
                          }
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Títulos Alternativos Dinámicos */}
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
                      {!tAlt.tieneFuente ? (
                        <button type="button" className="btn-gray-action" onClick={() => actualizarTituloAlt(idx, "tieneFuente", true)}>
                          Agregar fuente
                        </button>
                      ) : (
                        <div className="ref-container">
                          <span className="ref-tag">∨ 1 referencia</span>
                          <div className="ref-box">
                            <label>URL:</label>
                            <input
                              type="text"
                              value={tAlt.urlFuente}
                              onChange={(e) => actualizarTituloAlt(idx, "urlFuente", e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-gray-action margin-top-small" onClick={agregarTituloAlternativo}>
                    Agregar título alternativo
                  </button>
                </div>

                <div className="field-group margin-top-small">
                  <label className="field-label">
                    Resumen<span className="req">*</span>
                  </label>
                  <textarea className="input-textarea-large" value={resumen} onChange={(e) => setResumen(e.target.value)} placeholder="Resumen del evento..." />
                </div>
              </div>
            )}
          </div>

          {/* 2. LUGAR DE OCURRENCIA */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("lugar")}>
              <span>{seccionesAbiertas.lugar ? "∧" : "∨"} Lugar de ocurrencia</span>
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
                    />
                    {mostrarSugerenciasMunicipio && municipio.length > 0 && (
                      <div
                        style={{
                          border: "1px solid #ccc",
                          backgroundColor: "white",
                          position: "absolute",
                          zIndex: 10,
                          width: "100%",
                        }}
                      >
                        {lugares
                          .filter(
                            (l) => (l.tipo_lugar === "Ciudad" || l.tipo_lugar === "Municipio") && l.nombre.toLowerCase().includes(municipio.toLowerCase()),
                          )
                          .slice(0, 5)
                          .map((l) => (
                            <div
                              key={l._id}
                              style={{ padding: "5px", cursor: "pointer" }}
                              onClick={() => {
                                setMunicipio(l.nombre);
                                setMostrarSugerenciasMunicipio(false);
                              }}
                            >
                              {l.nombre} ({l.tipo_lugar})
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <label className="field-label">Subdivisión</label>
                    <textarea
                      className="input-textarea-small"
                      value={subdivision}
                      onChange={(e) => {
                        setSubdivision(e.target.value);
                        setMostrarSugerenciasSubdivision(true);
                      }}
                    />
                    {mostrarSugerenciasSubdivision && subdivision.length > 0 && (
                      <div
                        style={{
                          border: "1px solid #ccc",
                          backgroundColor: "white",
                          position: "absolute",
                          zIndex: 10,
                          width: "100%",
                        }}
                      >
                        {lugares
                          .filter((l) => l.tipo_lugar === "Barrio" && l.nombre.toLowerCase().includes(subdivision.toLowerCase()))
                          .slice(0, 5)
                          .map((l) => (
                            <div
                              key={l._id}
                              style={{ padding: "5px", cursor: "pointer" }}
                              onClick={() => {
                                setSubdivision(l.nombre);
                                setMostrarSugerenciasSubdivision(false);
                              }}
                            >
                              {l.localidad} - {l.nombre}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="field-label">Complemento</label>
                    <textarea className="input-textarea-small" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. DATOS DE AGENTES INVOLUCRADOS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("agentes")}>
              <span>{seccionesAbiertas.agentes ? "∧" : "∨"} Datos de agentes involucrados</span>
            </div>
            {seccionesAbiertas.agentes && (
              <div className="accordion-body">
                {/* AFECTADOS */}
                <div className="agente-block">
                  <h4 className="sub-title">Afectado(s)</h4>
                  {afectados.map((af, idx) => (
                    <div key={idx} className="agente-card">
                      <div className={`agente-grid ${af.tieneNota ? "with-nota" : ""}`}>
                        <div style={{ position: "relative" }}>
                          <label className="field-label">
                            Nombre<span className="req">*</span>
                          </label>
                          <textarea className="input-textarea-small" value={af.nombre} onChange={(e) => actualizarAfectado(idx, "nombre", e.target.value)} />
                          {af.nombre.length > 0 && !af.agenteId && (
                            <div
                              style={{
                                border: "1px solid #ccc",
                                backgroundColor: "white",
                                position: "absolute",
                                zIndex: 10,
                                width: "100%",
                              }}
                            >
                              {agentes
                                .filter((a) => a.nombre.toLowerCase().includes(af.nombre.toLowerCase()))
                                .slice(0, 5)
                                .map((a) => (
                                  <div
                                    key={a._id}
                                    style={{
                                      padding: "5px",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => {
                                      actualizarAfectado(idx, "nombre", a.nombre);
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
                          <label className="field-label">
                            Tipo de nombre<span className="req">*</span>
                          </label>
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
                          <div className="row-with-link">
                            <textarea className="input-textarea-small" value={af.rol} onChange={(e) => actualizarAfectado(idx, "rol", e.target.value)} />
                            <span className="link-icon">🔗</span>
                          </div>
                        </div>
                        {af.tieneNota && (
                          <div>
                            <label className="field-label">Nota</label>
                            <textarea className="input-textarea-small" value={af.nota} onChange={(e) => actualizarAfectado(idx, "nota", e.target.value)} />
                          </div>
                        )}
                      </div>

                      <div className="button-group-row">
                        {!af.tieneNota && (
                          <button type="button" className="btn-gray-action" onClick={() => actualizarAfectado(idx, "tieneNota", true)}>
                            Agregar nota
                          </button>
                        )}
                        {!af.tieneFuente && (
                          <button type="button" className="btn-gray-action" onClick={() => actualizarAfectado(idx, "tieneFuente", true)}>
                            Agregar fuente
                          </button>
                        )}
                      </div>

                      {af.tieneFuente && (
                        <div className="ref-container margin-top-small">
                          <span className="ref-tag">∨ 1 referencia</span>
                          <div className="ref-box">
                            <label>URL:</label>
                            <input
                              type="text"
                              value={af.urlFuente}
                              onChange={(e) => actualizarAfectado(idx, "urlFuente", e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-gray-action margin-top-small" onClick={agregarAfectado}>
                    Agregar afectado
                  </button>
                </div>

                {/* VICTIMARIOS */}
                <div className="agente-block margin-top">
                  <h4 className="sub-title">Victimario(s)</h4>
                  {victimarios.map((vic, idx) => (
                    <div key={idx} className="agente-card">
                      <div className={`agente-grid-vic ${vic.tieneNota ? "with-nota" : ""}`}>
                        <div style={{ position: "relative" }}>
                          <label className="field-label">
                            Nombre<span className="req">*</span>
                          </label>
                          <textarea
                            className="input-textarea-small"
                            value={vic.nombre}
                            onChange={(e) => {
                              actualizarVictimario(idx, "nombre", e.target.value);
                            }}
                          />
                          {vic.nombre.length > 0 && !vic.agenteId && (
                            <div
                              style={{
                                border: "1px solid #ccc",
                                backgroundColor: "white",
                                position: "absolute",
                                zIndex: 10,
                                width: "100%",
                              }}
                            >
                              {agentes
                                .filter((a) => a.nombre.toLowerCase().includes(vic.nombre.toLowerCase()))
                                .slice(0, 5)
                                .map((a) => (
                                  <div
                                    key={a._id}
                                    style={{
                                      padding: "5px",
                                      cursor: "pointer",
                                    }}
                                    onClick={() => {
                                      actualizarVictimario(idx, "nombre", a.nombre);
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
                          <label className="field-label">
                            Tipo de nombre<span className="req">*</span>
                          </label>
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
                          <textarea className="input-textarea-small" value={vic.rol} onChange={(e) => actualizarVictimario(idx, "rol", e.target.value)} />
                        </div>
                        <div>
                          <label className="field-label">Edad</label>
                          <textarea className="input-textarea-small" value={vic.edad} onChange={(e) => actualizarVictimario(idx, "edad", e.target.value)} />
                        </div>
                        {vic.tieneNota && (
                          <div>
                            <label className="field-label">Nota</label>
                            <textarea className="input-textarea-small" value={vic.nota} onChange={(e) => actualizarVictimario(idx, "nota", e.target.value)} />
                          </div>
                        )}
                      </div>

                      <div className="button-group-row">
                        {!vic.tieneNota && (
                          <button type="button" className="btn-gray-action" onClick={() => actualizarVictimario(idx, "tieneNota", true)}>
                            Agregar nota
                          </button>
                        )}
                        {!vic.tieneFuente && (
                          <button type="button" className="btn-gray-action" onClick={() => actualizarVictimario(idx, "tieneFuente", true)}>
                            Agregar fuente
                          </button>
                        )}
                      </div>

                      {vic.tieneFuente && (
                        <div className="ref-container margin-top-small">
                          <span className="ref-tag">∨ 1 referencia</span>
                          <div className="ref-box">
                            <label>URL:</label>
                            <input
                              type="text"
                              value={vic.urlFuente}
                              onChange={(e) => actualizarVictimario(idx, "urlFuente", e.target.value)}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn-gray-action margin-top-small" onClick={agregarVictimario}>
                    Agregar victimario
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3.5 ORGANIZACIÓN PERPETRADORA (Fuseki) */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("organizacion")}>
              <span>{seccionesAbiertas.organizacion ? "\u2227" : "\u2228"} Organización perpetradora</span>
            </div>
            {seccionesAbiertas.organizacion && (
              <div className="accordion-body">
                <h4 className="sub-title">Organización</h4>
                {!mostrarNuevaOrg && (
                  <div className="form-row">
                    <select
                      className="form-control"
                      value={organizacion ? organizacion.id : ""}
                      onChange={(e) => {
                        const sel = organizacionesExistentes.find((o) => o.id === e.target.value);
                        setOrganizacion(sel || null);
                        setLideres(sel ? sel.lideres || [] : []);
                      }}
                    >
                      <option value="">Sin organización</option>
                      {organizacionesExistentes.map((o) => (
                        <option key={o.id} value={o.id}>{o.nombre}{o.alias ? ` (${o.alias})` : ""}</option>
                      ))}
                    </select>
                    <button type="button" className="btn-gray-action" onClick={() => setMostrarNuevaOrg(true)}>
                      + Nueva organización
                    </button>
                  </div>
                )}
                {mostrarNuevaOrg && (
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
                        if (!nuevaOrgNombre.trim()) { alert("Escribe el nombre de la organización"); return; }
                        setOrganizacion({ nombre: nuevaOrgNombre.trim(), alias: nuevaOrgAlias.trim() });
                        setLideres([]);
                        setMostrarNuevaOrg(false);
                        setNuevaOrgNombre(""); setNuevaOrgAlias("");
                      }}
                    >
                      Usar esta organización
                    </button>
                    <button type="button" className="btn-gray-action" onClick={() => setMostrarNuevaOrg(false)}>Cancelar</button>
                  </div>
                )}
                {organizacion && (
                  <div className="margin-top-small">
                    <strong>{organizacion.nombre}</strong>
                    {organizacion.alias ? ` (${organizacion.alias})` : ""}
                    {organizacion.id && (
                      <button type="button" className="btn-gray-action margin-left-small" onClick={() => { setOrganizacion(null); setLideres([]); }}>
                        Quitar
                      </button>
                    )}
                  </div>
                )}

                <h4 className="sub-title margin-top-small">Líderes</h4>
                {lideres.map((lider, idx) => (
                  <div key={idx} className="form-row">
                    <span className="cell-box">{lider.nombre}{lider.alias ? ` (${lider.alias})` : ""}</span>
                    <button
                      type="button"
                      className="btn-gray-action"
                      onClick={() => setLideres(lideres.filter((_, i) => i !== idx))}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
                <div className="form-row">
                  <input
                    className="form-control"
                    placeholder="Nombre del líder"
                    value={nuevoLiderNombre}
                    onChange={(e) => setNuevoLiderNombre(e.target.value)}
                  />
                  <input
                    className="form-control"
                    placeholder="Alias (opcional)"
                    value={nuevoLiderAlias}
                    onChange={(e) => setNuevoLiderAlias(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-gray-action"
                    onClick={() => {
                      if (!nuevoLiderNombre.trim()) { alert("Escribe el nombre del líder"); return; }
                      setLideres([...lideres, { nombre: nuevoLiderNombre.trim(), alias: nuevoLiderAlias.trim() }]);
                      setNuevoLiderNombre(""); setNuevoLiderAlias("");
                    }}
                  >
                    Agregar líder
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. DATOS DESCRIPTIVOS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("descriptivos")}>
              <span>{seccionesAbiertas.descriptivos ? "∧" : "∨"} Datos descriptivos</span>
            </div>
            {seccionesAbiertas.descriptivos && (
              <div className="accordion-body">
                <h4 className="sub-title">Idiomas</h4>
                <div className="field-group">
                  <label className="field-label">
                    Idioma<span className="req">*</span>
                  </label>
                  <select className="select-full-styled">
                    <option value="">Select...</option>
                    <option value="Español">Español</option>
                    <option value="Inglés">Inglés</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 5. NOTAS DE INSTANCIA */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("notas")}>
              <span>{seccionesAbiertas.notas ? "∧" : "∨"} Notas de instancia</span>
            </div>
            {seccionesAbiertas.notas && (
              <div className="accordion-body">
                <h4 className="sub-title">Notas</h4>
                {notasList.map((notaItem, idx) => (
                  <div key={idx} className="notas-grid margin-bottom-small">
                    <div>
                      <label className="field-label">Tipo de nota</label>
                      <select className="select-full-styled" value={notaItem.tipo} onChange={(e) => actualizarNotaInstancia(idx, "tipo", e.target.value)}>
                        <option value="">Select</option>
                        <option value="Nota de agentes">Nota de agentes</option>
                        <option value="Nota de idiomas">Nota de idiomas</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Nota</label>
                      <textarea className="input-textarea-small" value={notaItem.nota} onChange={(e) => actualizarNotaInstancia(idx, "nota", e.target.value)} />
                    </div>
                    <div className="checkbox-col">
                      <label className="field-label">Solo staff</label>
                      <input
                        type="checkbox"
                        className="custom-checkbox"
                        checked={notaItem.soloStaff}
                        onChange={(e) => actualizarNotaInstancia(idx, "soloStaff", e.target.checked)}
                      />
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-gray-action margin-top-small" onClick={agregarNotaInstancia}>
                  Agregar nota
                </button>
              </div>
            )}
          </div>

          {/* 6. MATERIAS / CATEGORÍAS */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("materias")}>
              <span>{seccionesAbiertas.materias ? "∧" : "∨"} Materias / Categorías</span>
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
                        <option value="">Select</option>
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
                        onChange={(e) => actualizarMateriaItem(idx, "subjectSource", e.target.value)}
                      >
                        <option value="">Select</option>
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
                        <option value="">Select</option>
                        <option value="Topical term">Topical term</option>
                      </select>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn-gray-action margin-top-small" onClick={agregarMateriaItem}>
                  Agregar materia
                </button>
              </div>
            )}
          </div>

          {/* 7. CLASIFICACIÓN */}
          <div className="accordion-section">
            <div className="accordion-header" onClick={() => toggleSeccion("clasificacion")}>
              <span>{seccionesAbiertas.clasificacion ? "∧" : "∨"} Clasificación</span>
            </div>
            {seccionesAbiertas.clasificacion && (
              <div className="accordion-body">
                <div className="two-col-grid">
                  <div>
                    <label className="field-label">Tipo de identificador de clasificación</label>
                    <select className="select-full-styled">
                      <option>Select</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Clasificación</label>
                    <textarea className="input-textarea-small" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BOTÓN FINAL */}
          <div className="footer-action-area">
            <button type="button" className="btn-primary-dark" onClick={manejarCrearEvento}>
              CREAR EVENTO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CrearEventoPage;
