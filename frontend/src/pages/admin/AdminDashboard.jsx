import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "./adminApi";

function AdminDashboard({ onNavigate, onToast }) {
  const [stats, setStats] = useState({
    usuarios: [],
    fuentes: [],
    listaNegra: [],
  });
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [usuarios, fuentes, listaNegra] = await Promise.all([
        apiRequest("/api/admin/usuarios"),
        apiRequest("/api/fuentes"),
        apiRequest("/api/lista-negra"),
      ]);
      setStats({ usuarios, fuentes, listaNegra });
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
    const totalUsuarios = stats.usuarios.length;
    const activos = stats.usuarios.filter((u) => u.activo === true).length;
    const pendientes = stats.usuarios.filter((u) => u.activo === false).length;

    return {
      totalUsuarios,
      activos,
      pendientes,
      fuentesActivas: stats.fuentes.length,
      terminosBloqueados: stats.listaNegra.length,
    };
  }, [stats]);

  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Resumen general</h2>
        <button type="button" className="btn-secundario" onClick={cargarDatos} disabled={loading}>
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <div className="pi-admin-cards-grid">
        <article className="pi-admin-card">
          <h3>Usuarios registrados</h3>
          <p className="kpi">{resumen.totalUsuarios}</p>
          <small>{resumen.activos} activos · {resumen.pendientes} pendientes/inactivos</small>
        </article>

        <article className="pi-admin-card">
          <h3>Fuentes activas</h3>
          <p className="kpi">{resumen.fuentesActivas}</p>
          <small>Fuentes disponibles para indexación</small>
        </article>

        <article className="pi-admin-card">
          <h3>Lista negra activa</h3>
          <p className="kpi">{resumen.terminosBloqueados}</p>
          <small>Términos restringidos para el bot</small>
        </article>
      </div>

      <div className="pi-admin-quick-actions">
        <button type="button" className="quick-card" onClick={() => onNavigate("usuarios")}>
          <span>👥</span>
          <div>
            <strong>Gestionar usuarios</strong>
            <p>Aprobar indexadores, desactivar cuentas o eliminar usuarios.</p>
          </div>
        </button>
        <button type="button" className="quick-card" onClick={() => onNavigate("fuentes")}>
          <span>📰</span>
          <div>
            <strong>Administrar fuentes</strong>
            <p>Registrar nuevas fuentes informativas y controlar su estado.</p>
          </div>
        </button>
        <button type="button" className="quick-card" onClick={() => onNavigate("lista-negra")}>
          <span>⛔</span>
          <div>
            <strong>Editar lista negra</strong>
            <p>Agregar o remover términos para filtrado automatizado.</p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default AdminDashboard;
