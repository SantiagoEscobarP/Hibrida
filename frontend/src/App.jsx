// src/App.jsx
import React, { useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage";
import HomePage from "./pages/HomePage";
import MateriasPage from "./pages/MateriasPage";
import TitularesPage from "./pages/TitularesPage";
import IndexacionPage from "./pages/IndexacionPage";
import CrearEventoPage from "./pages/CrearEventoPage";
import BuscarEventoPage from "./pages/BuscarEventoPage";
import AutoridadesPage from "./pages/AutoridadesPage";
import ListadoAutoridadesPage from "./pages/ListadoAutoridadesPage";
import BuscadorPage from "./pages/BuscadorPage";

function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const stored = localStorage.getItem("pressindex_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem("pressindex_user");
      return null;
    }
  });

  const loggedIn = !!usuario;
  const rol = usuario ? (usuario.rol || "").toString().trim().toLowerCase() : "";
  const permisoCrearEventos = !!usuario?.permiso_crear_eventos;

  const esAdministrador = rol === "administrador" || rol === "analista" || rol === "admin";
  const esSuperusuario = rol === "superusuario";
  const esIndexador = rol === "indexador";

  const normalizeUser = (data) => ({
    ...data,
    permiso_crear_eventos: Boolean(data?.permiso_crear_eventos ?? true),
  });

  const handleLogin = (datosUsuario) => {
    const normalized = normalizeUser(datosUsuario);
    setUsuario(normalized);
    localStorage.setItem("pressindex_user", JSON.stringify(normalized));
  };

  const handleLogout = () => {
    setUsuario(null);
    localStorage.removeItem("pressindex_user");
    localStorage.removeItem("pressindex_token");
  };

  const destinoAutenticado = "/inicio";
  const puedeAccederAdmin = loggedIn && esAdministrador;
  const puedeAccederModuloOperativo = loggedIn && (esAdministrador || esSuperusuario || esIndexador);
  const puedeAccederMaterias = loggedIn && (esAdministrador || esSuperusuario || esIndexador);
  const puedeAccederBuscarEvento = loggedIn && (esAdministrador || esSuperusuario || esIndexador);
  const puedeAccederEditarEvento = loggedIn && (esAdministrador || esSuperusuario);
  const puedeAccederAutoridades = loggedIn && (esAdministrador || esSuperusuario || esIndexador);
  const puedeEditarAutoridades = loggedIn && (esAdministrador || esSuperusuario);
  const puedeCrearEvento = loggedIn && (esAdministrador || esSuperusuario || (esIndexador && permisoCrearEventos));

  const destinoDenegado = useMemo(() => (loggedIn ? "/inicio" : "/login"), [loggedIn]);
  const proteger = (permiso, element) => (permiso ? element : <Navigate to={destinoDenegado} replace />);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={loggedIn ? <Navigate to={destinoAutenticado} replace /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/login"
          element={loggedIn ? <Navigate to={destinoAutenticado} replace /> : <LoginPage onLogin={handleLogin} />}
        />
        <Route path="/LoginIndexador" element={<Navigate to="/login" replace />} />
        <Route path="/LoginSuperusuario" element={<Navigate to="/login" replace />} />
        <Route
          path="/admin"
          element={proteger(puedeAccederAdmin, <AdminPage onLogout={handleLogout} usuario={usuario} />)}
        />
        <Route
          path="/inicio"
          element={proteger(puedeAccederModuloOperativo, <HomePage onLogout={handleLogout} usuario={usuario} />)}
        />
        <Route
          path="/materias"
          element={proteger(puedeAccederMaterias, <MateriasPage onLogout={handleLogout} usuario={usuario} />)}
        />
        <Route
          path="/titulares"
          element={proteger(puedeAccederModuloOperativo, <TitularesPage onLogout={handleLogout} usuario={usuario} />)}
        />
        <Route
          path="/indexacion/:id"
          element={proteger(puedeAccederModuloOperativo, <IndexacionPage usuario={usuario} />)}
        />
        <Route
          path="/buscador"
          element={proteger(puedeAccederModuloOperativo, <BuscadorPage usuario={usuario} />)}
        />
        <Route
          path="/graficas"
          element={proteger(puedeAccederModuloOperativo, <BuscadorPage usuario={usuario} />)}
        />
        <Route
          path="/buscar-evento"
          element={proteger(puedeAccederBuscarEvento, <BuscarEventoPage usuario={usuario} />)}
        />
        <Route
          path="/crear-evento"
          element={proteger(puedeCrearEvento, <CrearEventoPage usuario={usuario} />)}
        />
        <Route
          path="/crear-evento/:id"
          element={proteger(puedeCrearEvento, <CrearEventoPage usuario={usuario} />)}
        />
        <Route
          path="/editar-evento/:id"
          element={proteger(puedeAccederEditarEvento, <CrearEventoPage usuario={usuario} />)}
        />
        <Route
          path="/Autoridades"
          element={proteger(puedeAccederAutoridades, <ListadoAutoridadesPage usuario={usuario} />)}
        />
        <Route
          path="/autoridades"
          element={proteger(puedeAccederAutoridades, <ListadoAutoridadesPage usuario={usuario} />)}
        />
        <Route
          path="/Autoridades/crear"
          element={proteger(puedeEditarAutoridades, <AutoridadesPage usuario={usuario} />)}
        />
        <Route
          path="/autoridades/crear"
          element={proteger(puedeEditarAutoridades, <AutoridadesPage usuario={usuario} />)}
        />
        <Route
          path="/Autoridades/editar/:id"
          element={proteger(puedeEditarAutoridades, <AutoridadesPage usuario={usuario} />)}
        />
        <Route
          path="/autoridades/editar/:id"
          element={proteger(puedeEditarAutoridades, <AutoridadesPage usuario={usuario} />)}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;