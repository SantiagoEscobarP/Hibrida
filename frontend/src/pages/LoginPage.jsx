// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginPage.css";

const KEYCLOAK_TOKEN_URL = "http://localhost:8080/realms/noticias-realm/protocol/openid-connect/token";
const API_ME_URL = "http://localhost:8000/api/me";
const CLIENT_ID = "noticias-frontend";

function LoginPage({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      const formData = new URLSearchParams();
      formData.append("client_id", CLIENT_ID);
      formData.append("grant_type", "password");
      formData.append("username", usuario.trim());
      formData.append("password", password);

      const tokenResp = await fetch(KEYCLOAK_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (!tokenResp.ok) {
        setError("Credenciales inválidas o cuenta pendiente de configuración en Keycloak.");
        setCargando(false);
        return;
      }

      const tokenData = await tokenResp.json();
      const accessToken = tokenData.access_token;
      localStorage.setItem("pressindex_token", accessToken);

      let perfil = { username: usuario.trim(), email: usuario.trim(), roles: ["administrador"] };
      try {
        const meResp = await fetch(API_ME_URL, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (meResp.ok) {
          perfil = await meResp.json();
        }
      } catch (_) {}

      const rolesKeycloak = (perfil.roles || []).map((r) => r.toLowerCase());
      let rolAsignado = "administrador";
      if (rolesKeycloak.includes("superusuario")) rolAsignado = "superusuario";
      else if (rolesKeycloak.includes("indexador")) rolAsignado = "indexador";
      else if (rolesKeycloak.includes("administrador") || rolesKeycloak.includes("analista")) {
        rolAsignado = "administrador";
      }

      const usuarioNormalizado = {
        nombre: perfil.username || usuario.trim(),
        correo: perfil.email || `${usuario.trim()}@pressindex.com`,
        rol: rolAsignado,
        permiso_crear_eventos: true,
        token: accessToken,
      };

      onLogin(usuarioNormalizado);
      navigate("/inicio");
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar con Keycloak (puerto 8080).");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-page-dark">
      <form className="login-card" onSubmit={handleLogin}>
        <img src="/LOGO.png" alt="PressIndex Logo" className="login-logo" />

        <h1>PressIndex</h1>
        <p className="subtitle">Autenticación Centralizada OIDC</p>

        {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

        <div className="input-group">
          <label>Usuario</label>
          <input
            type="text"
            placeholder="Ingresa tu usuario de Keycloak"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>

        <div className="input-group">
          <label>Contraseña</label>
          <input
            type="password"
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="btn-login-gradient" disabled={cargando}>
          {cargando ? "Verificando credenciales..." : "Iniciar Sesión"}
        </button>

        <hr className="login-divider" />

        <div className="demo-info">
          Gestión de accesos administrada vía <strong>Keycloak Identity</strong>
        </div>
      </form>
    </div>
  );
}

export default LoginPage;