// src/pages/admin/AdminUsuarios.jsx
import React from "react";

function AdminUsuarios() {
  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Gestión de Identidad y Usuarios (Keycloak)</h2>
      </div>

      <div className="pi-admin-panel" style={{ padding: "35px", textAlign: "center" }}>
        <h3 style={{ marginBottom: "12px", color: "#0d1b2a" }}>Administración Centralizada OIDC</h3>
        <p style={{ color: "#64748b", marginBottom: "24px", maxWidth: "600px", margin: "0 auto 24px" }}>
          La creación, desactivación de cuentas, restablecimiento de contraseñas y asignación de roles de seguridad se gestionan de forma segura directamente en el servidor de Keycloak.
        </p>

        <a
          href="http://localhost:8080/admin"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primario"
          style={{
            display: "inline-block",
            textDecoration: "none",
            lineHeight: "36px",
            padding: "0 24px",
            fontWeight: "700"
          }}
        >
          Abrir Consola de Administración de Keycloak &rarr;
        </a>
      </div>
    </div>
  );
}

export default AdminUsuarios;