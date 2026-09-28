// src/App.jsx
import React, { useState, useEffect } from 'react';

export default function App() {
  const [organizaciones, setOrganizaciones] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    titulo: '',
    medio: '',
    cuerpo: '',
    titulo_evento: '',
    fecha_evento: new Date().toISOString().split('T')[0],
    municipio: '',
    departamento: '',
    organizacion_uri: ''
  });

  useEffect(() => {
    fetch('http://localhost:8000/api/organizaciones')
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}: Endpoint no encontrado en FastAPI`);
        return res.json();
      })
      .then((data) => {
        // Validación defensiva: asegurar que data sea una lista y no esté vacía
        if (Array.isArray(data) && data.length > 0) {
          setOrganizaciones(data);
          setForm((prev) => ({ ...prev, organizacion_uri: data[0].uri }));
        }
      })
      .catch((err) => {
        console.error("Error al cargar organizaciones:", err);
        setMensaje({ tipo: 'error', texto: `Fallo al cargar organizaciones desde Fuseki: ${err.message}` });
      });
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMensaje(null);

    try {
      const res = await fetch('http://localhost:8000/api/noticias-con-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al procesar');

      setMensaje({
        tipo: 'exito',
        texto: `¡Registro exitoso! Noticia ID Mongo: ${data.mongo_id} \vert{} URI Fuseki:${data.fuseki_evento_uri}`
      });

      setForm((prev) => ({
        ...prev,
        titulo: '',
        medio: '',
        cuerpo: '',
        titulo_evento: '',
        municipio: '',
        departamento: ''
      }));
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '30px auto', fontFamily: 'system-ui, sans-serif', padding: '0 20px' }}>
      <h2>Registrar Noticia y Crear Evento Semántico</h2>
      <p style={{ color: '#555', fontSize: '14px' }}>
        Este formulario inserta la noticia en <strong>MongoDB</strong> y crea el nodo ontológico del evento en <strong>Apache Jena Fuseki</strong> con SPARQL UPDATE.
      </p>

      {mensaje && (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '20px',
          background: mensaje.tipo === 'exito' ? '#e8f5e9' : '#ffebee',
          color: mensaje.tipo === 'exito' ? '#2e7d32' : '#c62828',
          border: `1px solid ${mensaje.tipo === 'exito' ? '#a5d6a7' : '#ef9a9a'}`
        }}>
          {mensaje.texto}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* SECCIÓN MONGODB */}
        <fieldset style={{ border: '1px solid #90caf9', borderRadius: '8px', padding: '15px' }}>
          <legend style={{ color: '#1565c0', fontWeight: 'bold' }}>1. Datos de la Noticia (MongoDB)</legend>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Título de la noticia:</label>
            <input
              type="text"
              name="titulo"
              value={form.titulo}
              onChange={handleChange}
              required
              placeholder="Ej: Hostigamientos en zona rural..."
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Medio periodístico:</label>
            <input
              type="text"
              name="medio"
              value={form.medio}
              onChange={handleChange}
              required
              placeholder="Ej: El Espectador"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Cuerpo / Resumen:</label>
            <textarea
              name="cuerpo"
              value={form.cuerpo}
              onChange={handleChange}
              rows={3}
              required
              placeholder="Detalle de los hechos reportados..."
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        </fieldset>

        {/* SECCIÓN FUSEKI */}
        <fieldset style={{ border: '1px solid #ce93d8', borderRadius: '8px', padding: '15px' }}>
          <legend style={{ color: '#6a1b9a', fontWeight: 'bold' }}>2. Hecho de Orden Público (Jena Fuseki SPARQL)</legend>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Descripción del Evento:</label>
            <input
              type="text"
              name="titulo_evento"
              value={form.titulo_evento}
              onChange={handleChange}
              required
              placeholder="Ej: Ataque a patrulla con artefactos explosivos"
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Municipio:</label>
              <input
                type="text"
                name="municipio"
                value={form.municipio}
                onChange={handleChange}
                required
                placeholder="Ej: Argelia"
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Departamento:</label>
              <input
                type="text"
                name="departamento"
                value={form.departamento}
                onChange={handleChange}
                required
                placeholder="Ej: Cauca"
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>Fecha del Hecho:</label>
              <input
                type="date"
                name="fecha_evento"
                value={form.fecha_evento}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '13px' }}>
              Estructura Armada Responsable (Cargada desde Fuseki):
            </label>
            <select
              name="organizacion_uri"
              value={form.organizacion_uri}
              onChange={handleChange}
              disabled={organizaciones.length === 0}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              {organizaciones.length === 0 ? (
                <option value="">Cargando organizaciones...</option>
              ) : (
                organizaciones.map((org) => (
                  <option key={org.uri} value={org.uri}>
                    {org.nombre}
                  </option>
                ))
              )}
            </select>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading || organizaciones.length === 0}
          style={{
            backgroundColor: loading || organizaciones.length === 0 ? '#9e9e9e' : '#1976d2',
            color: 'white',
            padding: '12px',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: loading || organizaciones.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Registrando en Fuseki y MongoDB...' : 'Guardar Noticia y Vincular Evento'}
        </button>
      </form>
    </div>
  );
}