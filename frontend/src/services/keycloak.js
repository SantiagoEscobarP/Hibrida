import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: 'http://localhost:8080',
  realm: 'noticias-realm',
  clientId: 'noticias-frontend',
};

const keycloak = new Keycloak(keycloakConfig);

export const initKeycloak = (onAuthenticatedCallback) => {
  keycloak
    .init({
      onLoad: 'check-sso',
      pkceMethod: 'S256',
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    })
    .then((authenticated) => {
      onAuthenticatedCallback(authenticated);
    })
    .catch((err) => {
      console.error('Error al inicializar Keycloak:', err);
    });
};

export default keycloak;