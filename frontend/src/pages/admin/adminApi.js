const API_BASE_URL = "http://localhost:5000";

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      data?.error || data?.detail || data?.mensaje || data?.message || "Error en la solicitud";
    throw new Error(errorMessage);
  }

  return data;
}

export function formatFecha(value) {
  if (!value) return "Sin fecha";
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) {
    return String(value);
  }
  return fecha.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
