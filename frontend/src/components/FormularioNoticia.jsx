import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './FormularioNoticia.css';
import ModalCrearAutoridad from './ModalCrearAutoridad';
export default function FormularioNoticia() {
  // Catálogos cargados dinámicamente desde Fuseki
  const [materias, setMaterias] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [agentesAutoridades, setAgentesAutoridades] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
const [modalAbierto, setModalAbierto] = useState(false);
const [tipoModal, setTipoModal] = useState('Materia');
  // Estado del Titular principal
  const [titular, setTitular] = useState({
    id_sufijo: `noticia_${Date.now()}`,
    titulo: '',
    cuerpo: '',
    fuente: '',
    fecha_publicacion: new Date().toISOString().slice(0, 16),
    fecha_actualizacion: '',
    materia_uri: ''
  });

  // Lista dinámica de eventos
  const [eventos, setEventos] = useState([]);

  // Cargar autoridades al montar el componente
  useEffect(() => {
    async function cargarCatalogos() {
      try {
        const [resMaterias, resLugares, resPersonas, resGrupos, resFuerzas] = await Promise.all([
          api.get('/api/autoridades?tipo=Materia'),
          api.get('/api/autoridades?tipo=Lugar'),
          api.get('/api/autoridades?tipo=Persona'),
          api.get('/api/autoridades?tipo=GrupoCriminal'),
          api.get('/api/autoridades?tipo=FuerzasArmadas')
        ]);

        setMaterias(resMaterias.data);
        setLugares(resLugares.data);
        setAgentesAutoridades([
          ...resPersonas.data,
          ...resGrupos.data,
          ...resFuerzas.data
        ]);
      } catch (err) {
        console.error('Error cargando catálogos de autoridades:', err);
      }
    }
    cargarCatalogos();
  }, []);

  // --- Handlers para Titular ---
  const handleTitularChange = (e) => {
    setTitular({ ...titular, [e.target.name]: e.target.value });
  };
const handleAutoridadCreada = (nueva) => {
  if (nueva.tipo === 'Materia') {
    setMaterias(prev => [...prev, nueva]);
    setTitular(prev => ({ ...prev, materia_uri: nueva.uri }));
  } else if (nueva.tipo === 'Lugar') {
    setLugares(prev => [...prev, nueva]);
  } else {
    setAgentesAutoridades(prev => [...prev, nueva]);
  }
};
  // --- Handlers para Eventos ---
  const agregarEvento = () => {
    const nuevoEvento = {
      id_sufijo: `ev_${Date.now()}_${eventos.length + 1}`,
      titulo: '',
      fuente: '',
      titulo_alterno: '',
      resumen: '',
      idioma: 'es',
      notas: '',
      municipio_uri: '',
      subdivision_uri: '',
      complemento: '',
      materia_uri: '',
      codigo_clasificacion: '',
      tipo_fuente_materia: '',
      agentes: []
    };
    setEventos([...eventos, nuevoEvento]);
  };

  const eliminarEvento = (index) => {
    setEventos(eventos.filter((_, i) => i !== index));
  };

  const handleEventoChange = (index, campo, valor) => {
    const actualizados = [...eventos];
    actualizados[index][campo] = valor;
    setEventos(actualizados);
  };

  // --- Handlers para Agentes por Evento ---
  const agregarAgente = (eventoIndex) => {
    const nuevoAgente = {
      autoridad_uri: '',
      tipo_participacion: 'Victimario',
      autor: '',
      tipo_afiliacion: '',
      rol: ''
    };
    const actualizados = [...eventos];
    actualizados[eventoIndex].agentes.push(nuevoAgente);
    setEventos(actualizados);
  };

  const eliminarAgente = (eventoIndex, agenteIndex) => {
    const actualizados = [...eventos];
    actualizados[eventoIndex].agentes = actualizados[eventoIndex].agentes.filter((_, i) => i !== agenteIndex);
    setEventos(actualizados);
  };

  const handleAgenteChange = (eventoIndex, agenteIndex, campo, valor) => {
    const actualizados = [...eventos];
    actualizados[eventoIndex].agentes[agenteIndex][campo] = valor;
    setEventos(actualizados);
  };

  // --- Envío del Formulario Completo a FastAPI ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const payload = {
      ...titular,
      fecha_publicacion: new Date(titular.fecha_publicacion).toISOString(),
      fecha_actualizacion: titular.fecha_actualizacion ? new Date(titular.fecha_actualizacion).toISOString() : null,
      eventos: eventos.map(ev => ({
        ...ev,
        subdivision_uri: ev.subdivision_uri || null,
        codigo_clasificacion: ev.codigo_clasificacion || null,
        tipo_fuente_materia: ev.tipo_fuente_materia || null
      }))
    };

    try {
      const res = await api.post('/api/noticias', payload);
      setFeedback({ type: 'success', message: `Noticia indexada con éxito. URI: ${res.data.uri}` });
      // Resetear estado tras envío exitoso
      setTitular({
        id_sufijo: `noticia_${Date.now()}`,
        titulo: '',
        cuerpo: '',
        fuente: '',
        fecha_publicacion: new Date().toISOString().slice(0, 16),
        fecha_actualizacion: '',
        materia_uri: ''
      });
      setEventos([]);
    } catch (err) {
      console.error(err);
      setFeedback({ 
        type: 'error', 
        message: err.response?.data?.detail || 'Error al persistir la noticia en Fuseki' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="form-container" onSubmit={handleSubmit}>
      <h2>Indexación de Noticia de Orden Público</h2>
      
      {feedback && (
        <div style={{
          padding: '0.8rem', 
          marginBottom: '1.2rem', 
          borderRadius: '4px',
          background: feedback.type === 'success' ? '#e8f5e9' : '#ffebee',
          color: feedback.type === 'success' ? '#2e7d32' : '#c62828'
        }}>
          {feedback.message}
        </div>
      )}

      {/* SECCIÓN 1: DATOS DEL TITULAR */}
      <fieldset className="card-section">
        <legend><strong>Datos del Titular (Noticia Base)</strong></legend>

        <div className="form-group">
          <label>Título del Titular *</label>
          <input 
            type="text" 
            name="titulo" 
            value={titular.titulo} 
            onChange={handleTitularChange} 
            required 
            placeholder="Ej: Combates armados en el área rural de Tibú" 
          />
        </div>

        <div className="form-group">
          <label>Cuerpo de la Noticia *</label>
          <textarea 
            name="cuerpo" 
            rows="5" 
            value={titular.cuerpo} 
            onChange={handleTitularChange} 
            required 
            placeholder="Texto completo o fragmento analizado por el bot..." 
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Fuente *</label>
            <input 
              type="text" 
              name="fuente" 
              value={titular.fuente} 
              onChange={handleTitularChange} 
              required 
              placeholder="Ej: Periódico El Tiempo / Twitter @Policia" 
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ margin: 0 }}>Materia / Categoría del Titular *</label>
                <button 
                type="button" 
                onClick={() => { setTipoModal('Materia'); setModalAbierto(true); }}
                style={{ background: 'none', border: 'none', color: '#1976d2', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
                >
                + Nueva Materia
                </button>
            </div>
            <select 
                name="materia_uri" 
                value={titular.materia_uri} 
                onChange={handleTitularChange} 
                required
            >
                <option value="">-- Seleccionar Autoridad Materia --</option>
                {materias.map(m => (
                <option key={m.uri} value={m.uri}>{m.prefLabel}</option>
                ))}
            </select>
            </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Fecha de Publicación *</label>
            <input 
              type="datetime-local" 
              name="fecha_publicacion" 
              value={titular.fecha_publicacion} 
              onChange={handleTitularChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Fecha de Actualización</label>
            <input 
              type="datetime-local" 
              name="fecha_actualizacion" 
              value={titular.fecha_actualizacion} 
              onChange={handleTitularChange} 
            />
          </div>
        </div>
      </fieldset>

      {/* SECCIÓN 2: EVENTOS RELACIONADOS */}
      <div className="card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Eventos Relacionados ({eventos.length})</h3>
          <button type="button" className="btn btn-secondary" onClick={agregarEvento}>
            + Asociar Evento
          </button>
        </div>

        {eventos.map((evento, evIdx) => (
          <div key={evento.id_sufijo} className="event-card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h4>Evento #{evIdx + 1}</h4>
              <button 
                type="button" 
                className="btn btn-danger" 
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => eliminarEvento(evIdx)}
              >
                Eliminar Evento
              </button>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Título del Evento *</label>
                <input 
                  type="text" 
                  value={evento.titulo} 
                  onChange={(e) => handleEventoChange(evIdx, 'titulo', e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Título Alterno</label>
                <input 
                  type="text" 
                  value={evento.titulo_alterno} 
                  onChange={(e) => handleEventoChange(evIdx, 'titulo_alterno', e.target.value)} 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Resumen del Evento</label>
              <textarea 
                rows="2" 
                value={evento.resumen} 
                onChange={(e) => handleEventoChange(evIdx, 'resumen', e.target.value)} 
              />
            </div>

            {/* Lugar de ocurrencia */}
            <div className="form-row">
              <div className="form-group">
                <label>Municipio (Lugar) *</label>
                <select 
                  value={evento.municipio_uri} 
                  onChange={(e) => handleEventoChange(evIdx, 'municipio_uri', e.target.value)} 
                  required
                >
                  <option value="">-- Seleccionar Municipio --</option>
                  {lugares.map(l => (
                    <option key={l.uri} value={l.uri}>{l.prefLabel}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subdivisión (Lugar)</label>
                <select 
                  value={evento.subdivision_uri} 
                  onChange={(e) => handleEventoChange(evIdx, 'subdivision_uri', e.target.value)}
                >
                  <option value="">-- Opcional (Comuna / Corregimiento) --</option>
                  {lugares.map(l => (
                    <option key={l.uri} value={l.uri}>{l.prefLabel}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Complemento</label>
                <input 
                  type="text" 
                  placeholder="Ej: Barrio San José, km 4" 
                  value={evento.complemento} 
                  onChange={(e) => handleEventoChange(evIdx, 'complemento', e.target.value)} 
                />
              </div>
            </div>

            {/* Materia / Clasificación del Evento */}
            <div className="form-row">
              <div className="form-group">
                <label>Materia del Evento *</label>
                <select 
                  value={evento.materia_uri} 
                  onChange={(e) => handleEventoChange(evIdx, 'materia_uri', e.target.value)} 
                  required
                >
                  <option value="">-- Seleccionar Materia --</option>
                  {materias.map(m => (
                    <option key={m.uri} value={m.uri}>{m.prefLabel}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Código de Clasificación</label>
                <input 
                  type="text" 
                  placeholder="Ej: COD-HOMIC-01" 
                  value={evento.codigo_clasificacion} 
                  onChange={(e) => handleEventoChange(evIdx, 'codigo_clasificacion', e.target.value)} 
                />
              </div>
            </div>

            {/* SUB-SECCIÓN: AGENTES INVOLUCRADOS */}
            <div style={{ marginTop: '1rem', borderTop: '1px dashed #ccc', paddingTop: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5>Agentes Involucrados ({evento.agentes.length})</h5>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }}
                  onClick={() => agregarAgente(evIdx)}
                >
                  + Agregar Agente
                </button>
              </div>

              {evento.agentes.map((agente, agIdx) => (
                <div key={agIdx} className="agent-card">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Tipo de Participación *</label>
                      <select 
                        value={agente.tipo_participacion} 
                        onChange={(e) => handleAgenteChange(evIdx, agIdx, 'tipo_participacion', e.target.value)}
                      >
                        <option value="Victimario">Victimario</option>
                        <option value="Afectado">Afectado</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Autoridad (Persona / Grupo / Fuerza) *</label>
                      <select 
                        value={agente.autoridad_uri} 
                        onChange={(e) => handleAgenteChange(evIdx, agIdx, 'autoridad_uri', e.target.value)} 
                        required
                      >
                        <option value="">-- Seleccionar Autoridad --</option>
                        {agentesAutoridades.map(a => (
                          <option key={a.uri} value={a.uri}>{a.prefLabel} ({a.tipo})</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Rol</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Cabecilla, Víctima directa" 
                        value={agente.rol} 
                        onChange={(e) => handleAgenteChange(evIdx, agIdx, 'rol', e.target.value)} 
                      />
                    </div>

                    <div className="form-group">
                      <label>Afiliación</label>
                      <input 
                        type="text" 
                        placeholder="Ej: Disidencia, Civil" 
                        value={agente.tipo_afiliacion} 
                        onChange={(e) => handleAgenteChange(evIdx, agIdx, 'tipo_afiliacion', e.target.value)} 
                      />
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-danger" 
                      style={{ alignSelf: 'flex-end', marginBottom: '1rem', padding: '0.35rem 0.6rem' }}
                      onClick={() => eliminarAgente(evIdx, agIdx)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        ))}
      </div>

      <button 
        type="submit" 
        className="btn btn-submit" 
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Guardando en Fuseki...' : 'Indexar Noticia y Eventos'}
      </button>
        <ModalCrearAutoridad 
            isOpen={modalAbierto} 
            onClose={() => setModalAbierto(false)} 
            tipoPorDefecto={tipoModal}
            onAutoridadCreada={handleAutoridadCreada}
        />
    </form>
  );
}