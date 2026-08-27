const API_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data.message || "Error en la solicitud"
        );
    }

    return data;
}

export const api = {

    login: (datos) =>
        request("/auth/login", {
            method: "POST",
            body: JSON.stringify(datos)
        }),

    register: (datos) =>
        request("/auth/register", {
            method: "POST",
            body: JSON.stringify(datos)
        }),

    // Obtener usuario y billetera actual
    profile: () =>
        request("/auth/profile")
};

export default api;