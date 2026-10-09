import { useState, useEffect } from 'react';
import keycloak, { initKeycloak } from './services/keycloak';
import FormularioNoticia from './components/FormularioNoticia';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    initKeycloak((authenticated) => {
      setAuthReady(true);
      if (authenticated) {
        setUserInfo({
          username: keycloak.tokenParsed?.preferred_username,
          roles: keycloak.tokenParsed?.realm_access?.roles || [],
        });
      }
    });
  }, []);

  if (!authReady) {
    return <div style={{ padding: '2rem' }}>Conectando con Keycloak...</div>;
  }

  if (!keycloak.authenticated) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h2>Sistema de Indexación de Noticias de Orden Público</h2>
        <p>Inicie sesión para acceder a las herramientas de análisis.</p>
        <button 
          onClick={() => keycloak.login()} 
          style={{ padding: '0.8rem 1.5rem', fontSize: '1rem', cursor: 'pointer' }}
        >
          Iniciar Sesión
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: '#eceff1', minHeight: '100vh', padding: '1rem' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: '#263238', 
        color: '#fff', 
        padding: '0.8rem 1.5rem',
        borderRadius: '6px',
        marginBottom: '1.5rem'
      }}>
        <span><strong>Usuario:</strong> {userInfo?.username} ({userInfo?.roles.filter(r => !r.includes('default')).join(', ')})</span>
        <button 
          onClick={() => keycloak.logout()}
          style={{ background: '#cfd8dc', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </header>

      <main>
        <FormularioNoticia />
      </main>
    </div>
  );
}