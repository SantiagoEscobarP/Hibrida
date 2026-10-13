import React from "react";

function AdminToast({ toasts, onClose }) {
  if (!toasts.length) return null;

  return (
    <div className="pi-admin-toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`pi-admin-toast pi-admin-toast-${toast.tipo}`}>
          <p>{toast.mensaje}</p>
          <button onClick={() => onClose(toast.id)} aria-label="Cerrar notificación">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default AdminToast;
