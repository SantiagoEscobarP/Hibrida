import React, { useEffect, useState } from "react";
import { apiRequest, formatFecha } from "./adminApi";
import AdminConfirmModal from "./AdminConfirmModal";

const initialForm = {
  nombre: "",
  url: "",
  tipo: "web",
};

function AdminFuentes({ onToast }) {
  const [fuentes, setFuentes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errorForm, setErrorForm] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const cargarFuentes = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/fuentes");
      setFuentes(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast(`Error al cargar fuentes: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFuentes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validar = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio.";
    if (!form.url.trim()) return "La URL es obligatoria.";
    if (!/^https?:\/\//i.test(form.url.trim())) return "La URL debe iniciar con http:// o https://.";
    return "";
  };

  const crearFuente = async (e) => {
    e.preventDefault();
    const mensaje = validar();
    setErrorForm(mensaje);
    if (mensaje) return;

    try {
      setGuardando(true);
      await apiRequest("/api/fuentes", {
        method: "POST",
        body: JSON.stringify({ ...form, activo: true }),
      });
      onToast("Fuente creada correctamente.", "success");
      setForm(initialForm);
      setErrorForm("");
      await cargarFuentes();
    } catch (error) {
      onToast(`No se pudo crear la fuente: ${error.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  const toggleEstado = async (id) => {
    try {
      await apiRequest(`/api/fuentes/${id}/estado`, { method: "PATCH" });
      onToast("Estado de la fuente actualizado.", "success");
      await cargarFuentes();
    } catch (error) {
      onToast(`No se pudo actualizar la fuente: ${error.message}`, "error");
    }
  };

  const eliminarFuente = async () => {
    if (!confirmDelete) return;

    try {
      setProcesando(true);
      await apiRequest(`/api/fuentes/${confirmDelete._id || confirmDelete.id}`, { method: "DELETE" });
      onToast("Fuente eliminada correctamente.", "success");
      setConfirmDelete(null);
      await cargarFuentes();
    } catch (error) {
      onToast(`No se pudo eliminar la fuente: ${error.message}`, "error");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Gestión de fuentes</h2>
        <button className="btn-secundario" type="button" onClick={cargarFuentes} disabled={loading}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <div className="pi-admin-panel-grid two-columns">
        <form className="pi-admin-panel" onSubmit={crearFuente}>
          <h3>Nueva fuente</h3>
          <div className="form-grid single">
            <label>
              Nombre de la fuente
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Diario Nacional"
              />
            </label>

            <label>
              URL
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://dominio.com"
              />
            </label>

            <label>
              Tipo
              <input
                type="text"
                value={form.tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
                placeholder="web, rss, agencia..."
              />
            </label>
          </div>
          {errorForm && <small className="error-text">{errorForm}</small>}
          <div className="form-actions">
            <button className="btn-primario" type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Crear fuente"}
            </button>
          </div>
        </form>

        <div className="pi-admin-panel">
          <h3>Fuentes activas</h3>
          <div className="table-wrap">
            <table className="pi-admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>URL</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {fuentes.map((fuente) => {
                  const id = fuente._id || fuente.id;
                  const activa = fuente.activo !== false;
                  return (
                    <tr key={id}>
                      <td>{fuente.nombre || "Sin nombre"}</td>
                      <td>{fuente.tipo || "N/A"}</td>
                      <td>
                        <a href={fuente.url} target="_blank" rel="noreferrer" className="inline-link">
                          {fuente.url || "Sin URL"}
                        </a>
                      </td>
                      <td>{formatFecha(fuente.fecha_creacion)}</td>
                      <td>
                        <span className={`badge ${activa ? "badge-success" : "badge-warning"}`}>
                          {activa ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td>
                        <div className="action-row">
                          <button className="btn-secundario" type="button" onClick={() => toggleEstado(id)}>
                            Cambiar estado
                          </button>
                          <button className="btn-peligro" type="button" onClick={() => setConfirmDelete(fuente)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && fuentes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">No hay fuentes activas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        abierto={Boolean(confirmDelete)}
        titulo="Eliminar fuente"
        mensaje={`¿Deseas eliminar la fuente ${confirmDelete?.nombre || "seleccionada"}?`}
        textoConfirmar="Eliminar"
        onCancelar={() => setConfirmDelete(null)}
        onConfirmar={eliminarFuente}
        cargando={procesando}
      />
    </div>
  );
}

export default AdminFuentes;
