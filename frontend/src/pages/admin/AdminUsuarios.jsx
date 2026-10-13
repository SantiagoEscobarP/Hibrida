import React, { useEffect, useMemo, useState } from "react";
import { apiRequest, formatFecha } from "./adminApi";
import AdminConfirmModal from "./AdminConfirmModal";

const initialForm = {
  nombreCompleto: "",
  correo: "",
  password: "",
  rol: "indexador",
};

function AdminUsuarios({ onToast }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [errores, setErrores] = useState({});
  const [confirmacion, setConfirmacion] = useState({ abierto: false, usuario: null, accion: null });
  const [procesandoAccion, setProcesandoAccion] = useState(false);
  const [procesandoPermisoId, setProcesandoPermisoId] = useState(null);

  const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/admin/usuarios");
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (error) {
      onToast(`Error cargando usuarios: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = usuarios.length;
    const activos = usuarios.filter((u) => u.activo === true).length;
    const inactivos = usuarios.filter((u) => u.activo === false).length;
    const administradores = usuarios.filter((u) => (u.rol || "").toLowerCase() === "administrador").length;

    return { total, activos, inactivos, administradores };
  }, [usuarios]);

  const validar = () => {
    const nextErrors = {};

    if (!form.nombreCompleto.trim()) {
      nextErrors.nombreCompleto = "El nombre completo es obligatorio.";
    }

    if (!form.correo.trim()) {
      nextErrors.correo = "El correo es obligatorio.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) {
      nextErrors.correo = "Ingresa un correo válido.";
    }

    if (!form.password || form.password.length < 5) {
      nextErrors.password = "La contraseña debe tener al menos 5 caracteres.";
    }

    setErrores(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCrear = async (event) => {
    event.preventDefault();
    if (!validar()) return;

    try {
      setGuardando(true);
      await apiRequest("/api/auth/registro", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onToast("Usuario creado. Queda pendiente de aprobación.", "success");
      setForm(initialForm);
      setErrores({});
      await cargarUsuarios();
    } catch (error) {
      onToast(`No se pudo crear el usuario: ${error.message}`, "error");
    } finally {
      setGuardando(false);
    }
  };

  const abrirConfirmacion = (usuario, accion) => {
    setConfirmacion({ abierto: true, usuario, accion });
  };

  const cerrarConfirmacion = () => {
    if (procesandoAccion) return;
    setConfirmacion({ abierto: false, usuario: null, accion: null });
  };

  const ejecutarConfirmacion = async () => {
    if (!confirmacion.usuario || !confirmacion.accion) return;

    try {
      setProcesandoAccion(true);
      if (confirmacion.accion === "toggle") {
        const nuevoEstado = !confirmacion.usuario.activo;
        await apiRequest(`/api/admin/usuarios/${confirmacion.usuario.id_usuario}/estado`, {
          method: "PUT",
          body: JSON.stringify({ activo: nuevoEstado }),
        });
        onToast(`Usuario ${nuevoEstado ? "activado" : "desactivado"} correctamente.`, "success");
      }

      if (confirmacion.accion === "delete") {
        await apiRequest(`/api/admin/usuarios/${confirmacion.usuario.id_usuario}`, {
          method: "DELETE",
        });
        onToast("Usuario eliminado correctamente.", "success");
      }

      await cargarUsuarios();
      cerrarConfirmacion();
    } catch (error) {
      onToast(`No se pudo completar la acción: ${error.message}`, "error");
    } finally {
      setProcesandoAccion(false);
    }
  };

  const togglePermisoCrearEventos = async (usuario) => {
    const esIndexador = (usuario.rol || "").toLowerCase() === "indexador";
    if (!esIndexador) return;

    const nuevoPermiso = !usuario.permiso_crear_eventos;

    try {
      setProcesandoPermisoId(usuario.id_usuario);
      await apiRequest(`/api/admin/usuarios/${usuario.id_usuario}/permisos`, {
        method: "PUT",
        body: JSON.stringify({ permiso_crear_eventos: nuevoPermiso }),
      });

      setUsuarios((prev) =>
        prev.map((item) =>
          item.id_usuario === usuario.id_usuario
            ? { ...item, permiso_crear_eventos: nuevoPermiso }
            : item
        )
      );

      onToast(
        `Permiso para crear eventos ${nuevoPermiso ? "habilitado" : "deshabilitado"} para ${usuario.nombre}.`,
        "success"
      );
    } catch (error) {
      onToast(`No se pudo actualizar el permiso: ${error.message}`, "error");
    } finally {
      setProcesandoPermisoId(null);
    }
  };

  return (
    <div className="pi-admin-section">
      <div className="section-head">
        <h2>Gestión de usuarios</h2>
        <button type="button" className="btn-secundario" onClick={cargarUsuarios} disabled={loading}>
          {loading ? "Cargando..." : "Recargar"}
        </button>
      </div>

      <div className="pi-admin-cards-grid compact">
        <article className="pi-admin-card"><h3>Total</h3><p className="kpi">{stats.total}</p></article>
        <article className="pi-admin-card"><h3>Activos</h3><p className="kpi">{stats.activos}</p></article>
        <article className="pi-admin-card"><h3>Inactivos/Pendientes</h3><p className="kpi">{stats.inactivos}</p></article>
        <article className="pi-admin-card"><h3>Administradores</h3><p className="kpi">{stats.administradores}</p></article>
      </div>

      <div className="pi-admin-panel-grid">
        <form className="pi-admin-panel" onSubmit={handleCrear}>
          <h3>Crear usuario</h3>
          <div className="form-grid">
            <label>
              Nombre completo
              <input
                type="text"
                value={form.nombreCompleto}
                onChange={(e) => setForm((prev) => ({ ...prev, nombreCompleto: e.target.value }))}
                placeholder="Ej: Laura Ramírez"
              />
              {errores.nombreCompleto && <small className="error-text">{errores.nombreCompleto}</small>}
            </label>

            <label>
              Correo
              <input
                type="email"
                value={form.correo}
                onChange={(e) => setForm((prev) => ({ ...prev, correo: e.target.value }))}
                placeholder="usuario@pressindex.local"
              />
              {errores.correo && <small className="error-text">{errores.correo}</small>}
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Mínimo 5 caracteres"
              />
              {errores.password && <small className="error-text">{errores.password}</small>}
            </label>

            <label>
              Rol
              <select value={form.rol} onChange={(e) => setForm((prev) => ({ ...prev, rol: e.target.value }))}>
                <option value="indexador">Indexador</option>
                <option value="superusuario">Superusuario</option>
                <option value="administrador">Administrador</option>
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primario" disabled={guardando}>
              {guardando ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>

        <div className="pi-admin-panel">
          <h3>Usuarios registrados</h3>
          <div className="table-wrap">
            <table className="pi-admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Permiso crear eventos</th>
                  <th>Registro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const esIndexador = (u.rol || "").toLowerCase() === "indexador";
                  const permisoActivo = !!u.permiso_crear_eventos;
                  const bloqueado = procesandoPermisoId === u.id_usuario;

                  return (
                    <tr key={u.id_usuario}>
                      <td>{u.nombre || "Sin nombre"}</td>
                      <td>{u.correo || "Sin correo"}</td>
                      <td><span className="badge badge-neutral">{u.rol || "Sin rol"}</span></td>
                      <td>
                        <span className={`badge ${u.activo ? "badge-success" : "badge-warning"}`}>
                          {u.activo ? "Activo" : "Pendiente/Inactivo"}
                        </span>
                      </td>
                      <td>
                        {esIndexador ? (
                          <button
                            type="button"
                            className="btn-secundario"
                            onClick={() => togglePermisoCrearEventos(u)}
                            disabled={bloqueado}
                          >
                            {bloqueado
                              ? "Actualizando..."
                              : permisoActivo
                                ? "Habilitado"
                                : "No habilitado"}
                          </button>
                        ) : (
                          <span className="badge badge-neutral">N/A</span>
                        )}
                      </td>
                      <td>{formatFecha(u.fechaRegistro)}</td>
                      <td>
                        <div className="action-row">
                          <button
                            type="button"
                            className="btn-secundario"
                            onClick={() => abrirConfirmacion(u, "toggle")}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            className="btn-peligro"
                            onClick={() => abrirConfirmacion(u, "delete")}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && usuarios.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty-state">No hay usuarios disponibles.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AdminConfirmModal
        abierto={confirmacion.abierto}
        titulo={confirmacion.accion === "delete" ? "Eliminar usuario" : "Actualizar estado"}
        mensaje={
          confirmacion.accion === "delete"
            ? `¿Seguro que deseas eliminar a ${confirmacion.usuario?.nombre || "este usuario"}? Esta acción no se puede deshacer.`
            : `¿Deseas ${confirmacion.usuario?.activo ? "desactivar" : "activar"} a ${confirmacion.usuario?.nombre || "este usuario"}?`
        }
        textoConfirmar={confirmacion.accion === "delete" ? "Eliminar" : "Confirmar"}
        onConfirmar={ejecutarConfirmacion}
        onCancelar={cerrarConfirmacion}
        cargando={procesandoAccion}
      />
    </div>
  );
}

export default AdminUsuarios;
