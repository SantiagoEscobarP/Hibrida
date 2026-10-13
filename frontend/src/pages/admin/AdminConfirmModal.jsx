import React from "react";

function AdminConfirmModal({ abierto, titulo, mensaje, textoConfirmar = "Confirmar", onConfirmar, onCancelar, cargando = false }) {
  if (!abierto) return null;

  return (
    <div className="pi-admin-modal-overlay" onClick={onCancelar}>
      <div className="pi-admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{titulo}</h3>
        <p>{mensaje}</p>
        <div className="pi-admin-modal-actions">
          <button type="button" className="btn-secundario" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </button>
          <button type="button" className="btn-peligro" onClick={onConfirmar} disabled={cargando}>
            {cargando ? "Procesando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminConfirmModal;
