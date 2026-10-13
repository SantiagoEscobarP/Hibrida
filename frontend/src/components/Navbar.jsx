// src/components/Navbar.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

function Navbar({ username = "Usuario", onLogout, usuario }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
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

  const nombreMostrado = usuarioSesion?.nombre || usuarioSesion?.username || username;
  const correoMostrado = usuarioSesion?.correo || usuarioSesion?.email || "usuario@pressindex.com";
  const rol = (usuarioSesion?.rol || "administrador").toString().trim().toLowerCase();
  const permisoCrearEventos = !!usuarioSesion?.permiso_crear_eventos;

  const esAdministrador = rol === "administrador" || rol === "analista";
  const esSuperusuario = rol === "superusuario";
  const esIndexador = rol === "indexador";

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initialLetter = nombreMostrado ? nombreMostrado.charAt(0).toUpperCase() : "U";

  const links = [
    { key: "inicio", label: "INICIO", icon: "🏠", path: "/inicio", visible: true, activeWhen: ["/inicio"] },
    {
      key: "materias",
      label: "MATERIAS",
      icon: "📋",
      path: "/materias",
      visible: esAdministrador || esSuperusuario || esIndexador,
      activeWhen: ["/materias"],
    },
    {
      key: "titulares",
      label: "TITULARES",
      icon: "📰",
      path: "/titulares",
      visible: true,
      activeWhen: ["/titulares", "/indexacion"],
    },
    {
      key: "descripcion",
      label: "DESCRIPCIÓN",
      icon: "🔗",
      path: "/buscar-evento",
      visible: esAdministrador || esSuperusuario || esIndexador,
      activeWhen: ["/buscar-evento", "/crear-evento", "/editar-evento"],
    },
    {
      key: "buscador",
      label: "GRÁFICAS / GRAFO",
      icon: "📊",
      path: "/buscador",
      visible: esAdministrador || esSuperusuario || esIndexador,
      activeWhen: ["/buscador", "/graficas"],
    },
    {
      key: "autoridades",
      label: "AUTORIDADES",
      icon: "🛡️",
      path: "/autoridades",
      visible: esAdministrador || esSuperusuario || esIndexador,
      activeWhen: ["/autoridades"],
    },
    {
      key: "admin",
      label: "ADMIN",
      icon: "⚙️",
      path: "/admin",
      visible: esAdministrador,
      activeWhen: ["/admin"],
    },
  ].filter((item) => item.visible);

  const isActive = (activeWhen) => {
    const current = location.pathname.toLowerCase();
    return activeWhen.some((prefix) => current.startsWith(prefix.toLowerCase()));
  };

  return (
    <nav className="main-navbar">
      <div className="nav-logo" onClick={() => navigate("/inicio")}>
        <img src="/LOGO_INVERT.png" alt="PressIndex Logo" className="nav-logo-img" />
      </div>

      <ul className="nav-links">
        {links.map((link) => (
          <li
            key={link.key}
            className={isActive(link.activeWhen) ? "active" : ""}
            onClick={() => navigate(link.path)}
          >
            <span className="nav-link-icon">{link.icon}</span>
            <span>{link.label}</span>
          </li>
        ))}
      </ul>

      <div className="nav-user-container" ref={dropdownRef}>
        <span className="nav-username-label">{nombreMostrado}</span>
        <button
          className={`avatar-btn ${menuOpen ? "active" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          title="Cuenta de PressIndex"
        >
          <span className="avatar-text">{initialLetter}</span>
        </button>

        {menuOpen && (
          <div className="google-menu-dropdown">
            <div className="menu-user-header">
              <div className="large-avatar">{initialLetter}</div>
              <div className="user-info">
                <span className="user-name">{nombreMostrado}</span>
                <span className="user-email">{correoMostrado}</span>
              </div>
            </div>

            <hr className="menu-divider" />

            <ul className="menu-options">
              <li>
                <span>Rol activo: <strong>{usuarioSesion?.rol || "Analista"}</strong></span>
              </li>
              {esIndexador && (
                <li>
                  <span>Crear eventos: {permisoCrearEventos ? "Habilitado" : "No habilitado"}</span>
                </li>
              )}
            </ul>

            <hr className="menu-divider" />

            <div className="menu-footer">
              <button
                className="btn-logout-google"
                onClick={() => {
                  localStorage.removeItem("pressindex_user");
                  if (onLogout) onLogout();
                  navigate("/login");
                }}
              >
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;