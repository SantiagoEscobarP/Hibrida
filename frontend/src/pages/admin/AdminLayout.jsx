import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";
import AdminToast from "./AdminToast";

function AdminLayout({ usuario, menu, vistaActiva, onCambiarVista, onLogout, children, toasts, onCloseToast }) {
  const navigate = useNavigate();

  return (
    <div className="pi-admin-wrapper">
      {/* Navbar principal siempre visible */}
      <Navbar usuario={usuario} onLogout={onLogout} />

      <div className="pi-admin-shell">
        <aside className="pi-admin-sidebar">
          <div className="pi-admin-brand">
            <p className="brand-chip">PressIndex</p>
            <h2>Administrador</h2>
            <small>{usuario?.nombre || "Usuario"}</small>
          </div>

          <nav className="pi-admin-menu" aria-label="Secciones de administración">
            {menu.map((item) => (
              <button
                key={item.id}
                type="button"
                className={vistaActiva === item.id ? "menu-item active" : "menu-item"}
                onClick={() => onCambiarVista(item.id)}
              >
                <span>{item.icono}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="pi-admin-sidebar-footer">
            <button type="button" className="btn-volver" onClick={() => navigate("/inicio")}>
              ← Volver a Inicio
            </button>
            <button type="button" className="btn-logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="pi-admin-main">
          <header className="pi-admin-main-header">
            <div>
              <h1>Panel de administración</h1>
              <p>Gestiona usuarios, fuentes y términos de lista negra en tiempo real.</p>
            </div>
          </header>

          <section className="pi-admin-content">{children}</section>
        </main>
      </div>

      <AdminToast toasts={toasts} onClose={onCloseToast} />
    </div>
  );
}

export default AdminLayout;
