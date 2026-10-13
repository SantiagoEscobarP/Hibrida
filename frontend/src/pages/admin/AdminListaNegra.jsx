import React, { useEffect, useState } from "react";
import { apiRequest, formatFecha } from "./adminApi";
import AdminConfirmModal from "./AdminConfirmModal";

function AdminListaNegra({ onToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [palabra, setPalabra] = useState("");
  const [errorForm, setErrorForm] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const cargarLista = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/lista-negra");
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast(`Error al cargar lista negra: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crearPalabra = async (e) => {
    e.preventDefault();
    const valor = palabra.trim();

    if (!valor) {
      setErrorForm("Debes ingresar una palabra o término.");
      return;
    }

    if (valor.length < 3) {
      setErrorForm("Ingresa al menos 3 caracteres.");
      return;
    }

    try {
      setGuardando(true);
      await apiRequest("/api/lista-negra", {
        method: "POST",
        body: JSON.stringify({ palabra: valor, activo: true }),
      });
      onToast("Término agregado a la lista negra.", "success");
      setPalabra("");
      setErrorForm("");
      await cargarLista();
    } catch (error) {
      onToast(`No se pudo agregar el término: ${error.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (id) => {
    try {
      await apiRequest(`/api/lista-negra/${id}/estado`, { method: "PATCH" });
      onToast("Estado del término actualizado.", "success");
      await cargarLista();
    } catch (error) {
      onToast(`No se pudo actualizar el término: ${error.message}`, "error");
    }
  };

  const eliminarPalabra = async () => {
    if (!confirmDelete) return;

    try {
      setProcesando(true);
      await apiRequest(`/api/lista-negra/${confirmDelete._id || confirmDelete.id}`, { method: "DELETE" });
      onToast("Término eliminado correctamente.", "success");
      setConfirmDelete(null);
      await cargarLista();
    } catch (error) {
      onToast(`No se pudo eliminar el término: ${error.message}`, "error");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Gestión de lista negra</h2>
        <button className="btn-secundario" type="button" onClick={cargarLista} disabled={loading}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <div className="pi-admin-panel-grid two-columns">
        <form className="pi-admin-panel" onSubmit={crearPalabra}>
          <h3>Agregar término restringido</h3>
          <div className="form-grid single">
            <label>
              Palabra o frase
              <input
                type="text"
                value={palabra}
                onChange={(e) => setPalabra(e.target.value)}
                placeholder="Ej: crimen organizado"
              />
            </label>
          </div>
          {errorForm && <small className="error-text">{errorForm}</small>}
          <div className="form-actions">
            <button className="btn-primario" type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Agregar término"}
            </button>
          </div>
        </form>

        <div className="pi-admin-panel">
          <h3>Términos activos</h3>
          <div className="table-wrap">
            <table className="pi-admin-table">
              <thead>
                <tr>
                  <th>Término</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const id = item._id || item.id;
                  const activo = item.activo !== false;
                  return (
                    <tr key={id}>
                      <td>{item.palabra || "Sin término"}</td>
                      <td>{formatFecha(item.fecha_creacion)}</td>
                      <td>
                        <span className={`badge ${activo ? "badge-success" : "badge-warning"}`}>
                          {activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="action-row">
                          <button type="button" className="btn-secundario" onClick={() => cambiarEstado(id)}>
                            Cambiar estado
                          </button>
                          <button type="button" className="btn-peligro" onClick={() => setConfirmDelete(item)}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-state">No hay términos activos en la lista negra.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        abierto={Boolean(confirmDelete)}
        titulo="Eliminar término"
        mensaje={`¿Deseas eliminar el término "${confirmDelete?.palabra || "seleccionado"}"?`}
        textoConfirmar="Eliminar"
        onCancelar={() => setConfirmDelete(null)}
        onConfirmar={eliminarPalabra}
        cargando={procesando}
      />
    </div>
  );
}

export default AdminListaNegra;
