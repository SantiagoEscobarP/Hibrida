// src/pages/admin/AdminDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./adminApi";

function AdminDashboard({ onNavigate, onToast }) {
  const [stats, setStats] = useState({
    fuentes: [],
    listaNegra: [],
  });
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [fuentes, listaNegra] = await Promise.all([
        apiRequest("/api/fuentes"),
        apiRequest("/api/lista-negra"),
      ]);
      setStats({ fuentes, listaNegra });
    } catch (error) {
      onToast(`No se pudo cargar el dashboard: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumen = useMemo(() => {
    return {
      fuentesActivas: stats.fuentes.length,
      terminosBloqueados: stats.listaNegra.length,
    };
  }, [stats]);

  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Resumen general del sistema</h2>
        <button type="button" className="btn-secundario" onClick={cargarDatos} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="pi-admin-cards-grid">
        <article className="pi-admin-card">
          <h3>Gestión de Accesos</h3>
          <p className="kpi" style={{ fontSize: "1.3rem", color: "#2563eb" }}>Keycloak</p>
          <small>Identidad y roles centralizados OIDC</small>
        </article>
        <article className="pi-admin-card">
          <h3>Fuentes activas</h3>
          <p className="kpi">{resumen.fuentesActivas}</p>
          <small>Feeds RSS y portales de scraping</small>
        </article>
        <article className="pi-admin-card">
          <h3>Lista negra activa</h3>
          <p className="kpi">{resumen.terminosBloqueados}</p>
          <small>Términos de ruido filtrados por el bot</small>
        </article>
      </div>

      <div className="pi-admin-quick-actions" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <button type="button" className="quick-card" onClick={() => onNavigate("fuentes")}>
          <span>📡</span>
          <div>
            <strong>Administrar fuentes</strong>
            <p>Registrar nuevas fuentes informativas y controlar su estado en Fuseki.</p>
          </div>
        </button>

        <button type="button" className="quick-card" onClick={() => onNavigate("lista-negra")}>
          <span>🛡️</span>
          <div>
            <strong>Editar lista negra</strong>
            <p>Agregar o remover términos de ruido para el filtrado automatizado del bot.</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;