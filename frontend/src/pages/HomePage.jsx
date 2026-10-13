// src/pages/HomePage.jsx
import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./HomePage.css";

function HomePage({ onLogout, usuario }) {
  const navigate = useNavigate();
  const rol = (usuario?.rol || "administrador").toString().trim().toLowerCase();
  const permisoCrearEventos = Boolean(usuario?.permiso_crear_eventos);

  const esAdministrador = rol === "administrador" || rol === "analista";
  const esSuperusuario = rol === "superusuario";
  const esIndexador = rol === "indexador";

  const modules = useMemo(
    () => [
      {
        id: 1,
        title: "MATERIAS/CATEGORÍAS",
        desc: "Gestiona las categorías de noticias",
        icon: "📋",
        bgIcon: "#fff8e6",
        path: "/materias",
        visible: esAdministrador || esSuperusuario || esIndexador,
      },
      {
        id: 2,
        title: "TITULARES",
        desc: "Administra los titulares de noticias",
        icon: "📰",
        bgIcon: "#e6f1fe",
        path: "/titulares",
        visible: esAdministrador || esSuperusuario || esIndexador,
      },
      {
        id: 3,
        title: "DESCRIPCIÓN",
        desc: "Descripción detallada de eventos",
        icon: "🔗",
        bgIcon: "#fef3d6",
        path: "/buscar-evento",
        visible: esAdministrador || esSuperusuario || esIndexador,
      },
      {
        id: 4,
        title: "GRÁFICAS / GRAFO",
        desc: "Visualiza estadísticas y grafo RDF",
        icon: "📊",
        bgIcon: "#fee7e6",
        path: "/buscador",
        visible: esAdministrador || esSuperusuario || esIndexador,
      },
      {
        id: 5,
        title: "AUTORIDADES",
        desc: "Gestión de autoridades",
        icon: "👔",
        bgIcon: "#e6f1fe",
        path: "/autoridades",
        visible: esAdministrador || esSuperusuario || esIndexador,
      },
      {
        id: 6,
        title: "CREAR EVENTO",
        desc: "Registrar y catalogar eventos",
        icon: "➕",
        bgIcon: "#e8faf0",
        path: "/crear-evento",
        visible: esAdministrador || esSuperusuario || (esIndexador && permisoCrearEventos),
      },
      {
        id: 7,
        title: "PANEL ADMIN",
        desc: "Gestión de usuarios, fuentes y lista negra",
        icon: "⚙️",
        bgIcon: "#f1f5f9",
        path: "/admin",
        visible: esAdministrador,
      },
    ].filter((m) => m.visible),
    [esAdministrador, esSuperusuario, esIndexador, permisoCrearEventos]
  );

  return (
    <div className="dashboard-page">
      <Navbar usuario={usuario} onLogout={onLogout} />

      <div className="dashboard-content">
        <header className="welcome-header">
          <h1>Bienvenido al sistema PressIndex</h1>
          <p>Selecciona una opción para comenzar</p>
        </header>

        <div className="modules-grid">
          {modules.map((mod) => (
            <div key={mod.id} className="module-card" onClick={() => navigate(mod.path)}>
              <div className="module-icon-wrapper" style={{ backgroundColor: mod.bgIcon }}>
                <span className="module-icon">{mod.icon}</span>
              </div>
              <h3>{mod.title}</h3>
              <p>{mod.desc}</p>
              <div className="module-arrow">&rarr;</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default HomePage;