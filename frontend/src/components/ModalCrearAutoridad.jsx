import React, { useState } from 'react';
import api from '../services/api';

export default function ModalCrearAutoridad({ isOpen, onClose, tipoPorDefecto = 'Materia', onAutoridadCreada }) {
  const [formData, setFormData] = useState({
    id_sufijo: '',
    tipo_autoridad: tipoPorDefecto,
    termino_autorizado: '',
    termino_alternativo: '',
    descripcion: '',
    idioma: 'es'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Si el usuario no especificó ID, generamos uno a partir del término
    const idSufijo = formData.id_sufijo.trim() !== '' 
      ? formData.id_sufijo 
      : `${formData.tipo_autoridad.toLowerCase()}_${Date.now()}`;

    const payload = {
      ...formData,
      id_sufijo: idSufijo
    };

    try {
      const res = await api.post('/api/autoridades', payload);
      const nuevaAutoridad = {
        uri: res.data.uri,
        tipo: payload.tipo_autoridad,
        prefLabel: payload.termino_autorizado,
        altLabel: payload.termino_alternativo || null
      };

      onAutoridadCreada(nuevaAutoridad);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Error al guardar la autoridad');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{ background: '#fff', padding: '1.8rem', borderRadius: '8px', width: '480px', maxWidth: '90%' }}>
        <h3 style={{ marginTop: 0 }}>Crear Nueva Autoridad</h3>

        {error && <div style={{ color: 'red', marginBottom: '0.8rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Tipo de Autoridad *</label>
            <select 
              name="tipo_autoridad" 
              value={formData.tipo_autoridad} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.4rem' }}
            >
              <option value="Materia">Materia</option>
              <option value="Lugar">Lugar</option>
              <option value="Persona">Persona</option>
              <option value="GrupoCriminal">Grupo Criminal</option>
              <option value="FuerzasArmadas">Fuerzas Armadas</option>
              <option value="Organizacion">Organización</option>
            </select>
          </div>

          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Término Autorizado *</label>
            <input 
              type="text" 
              name="termino_autorizado" 
              required 
              placeholder="Ej: Desplazamiento Forzado / ELN / Cúcuta"
              value={formData.termino_autorizado} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.4rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '0.8rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Término Alternativo / Alias</label>
            <input 
              type="text" 
              name="termino_alternativo" 
              placeholder="Ej: Siglas o nombres comunes"
              value={formData.termino_alternativo} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.4rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem' }}>Descripción</label>
            <textarea 
              name="descripcion" 
              rows="2"
              placeholder="Breve definición o alcance"
              value={formData.descripcion} 
              onChange={handleChange}
              style={{ width: '100%', padding: '0.4rem', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px' }}>
              {loading ? 'Guardando...' : 'Crear y Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}