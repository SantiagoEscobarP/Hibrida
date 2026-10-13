import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import AdminUsuarios from "./admin/AdminUsuarios";
import AdminFuentes from "./admin/AdminFuentes";
import AdminListaNegra from "./admin/AdminListaNegra";
import "./admin/AdminPage.css";

function AdminPage({ onLogout, usuario }) {
  const navigate = useNavigate();
  const [vistaActiva, setVistaActiva] = useState("dashboard");
  const [toasts, setToasts] = useState([]);

  const menu = useMemo(
    () => [
      { id: "dashboard", label: "Panel general", icono: "🏠" },
      { id: "usuarios", label: "Gestión de usuarios", icono: "👥" },
      { id: "fuentes", label: "Fuentes", icono: "📰" },
      { id: "lista-negra", label: "Lista negra", icono: "⛔" },
    ],
    []
  );

  const agregarToast = (mensaje, tipo = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const eliminarToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const cerrarSesion = () => {
    onLogout();
    navigate("/");
  };

  const renderVista = () => {
    switch (vistaActiva) {
      case "usuarios":
        return <AdminUsuarios onToast={agregarToast} />;
      case "fuentes":
        return <AdminFuentes onToast={agregarToast} />;
      case "lista-negra":
        return <AdminListaNegra onToast={agregarToast} />;
      case "dashboard":
      default:
        return <AdminDashboard onNavigate={setVistaActiva} onToast={agregarToast} />;
    }
  };

  return (
    <AdminLayout
      usuario={usuario}
      menu={menu}
      vistaActiva={vistaActiva}
      onCambiarVista={setVistaActiva}
      onLogout={cerrarSesion}
      toasts={toasts}
      onCloseToast={eliminarToast}
    >
      {renderVista()}
    </AdminLayout>
  );
}

export default AdminPage;
