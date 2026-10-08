import { useState, useEffect } from 'react';
import keycloak, { initKeycloak } from './services/keycloak';
import api from './services/api';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [autoridades, setAutoridades] = useState([]);
  const [tipoFiltro, setTipoFiltro] = useState('');

  useEffect(() => {
    initKeycloak(() => {
      setAuthReady(true);
      if (keycloak.authenticated) {
        setUserInfo({
          name: keycloak.tokenParsed?.preferred_username,
          roles: keycloak.tokenParsed?.realm_access?.roles || [],
        });
      }
    });
  }, []);

  const cargarAutoridades = async () => {
    try {
      const url = tipoFiltro ? `/api/autoridades?tipo=${tipoFiltro}` : '/api/autoridades';
      const res = await api.get(url);
      setAutoridades(res.data);
    } catch (err) {
      console.error('Error cargando autoridades:', err);
    }
  };

  if (!authReady) {
    return <div style={{ padding: '2rem' }}>Cargando servicio de autenticación...</div>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Indexación de Noticias de Orden Público</h1>

      {!keycloak.authenticated ? (
        <button onClick={() => keycloak.login()}>Iniciar Sesión con Keycloak</button>
      ) : (
        <div>
          <div style={{ marginBottom: '1.5rem', background: '#f0f4f8', padding: '1rem', borderRadius: '6px' }}>
            <p><strong>Usuario:</strong> {userInfo?.name}</p>
            <p><strong>Roles:</strong> {userInfo?.roles.join(', ')}</p>
            <button onClick={() => keycloak.logout()}>Cerrar Sesión</button>
          </div>

          <section style={{ marginTop: '2rem' }}>
            <h2>Consultar Autoridades desde Fuseki</h2>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
                <option value="">-- Todos los tipos --</option>
                <option value="Lugar">Lugar</option>
                <option value="GrupoCriminal">Grupo Criminal</option>
                <option value="Materia">Materia</option>
                <option value="Organizacion">Organización</option>
                <option value="Persona">Persona</option>
              </select>
              <button onClick={cargarAutoridades}>Consultar</button>
            </div>

            <ul>
              {autoridades.map((item) => (
                <li key={item.uri}>
                  <strong>{item.prefLabel}</strong> ({item.tipo}) {item.altLabel && `[Alias: ${item.altLabel}]`}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}