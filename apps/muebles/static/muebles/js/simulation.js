// Punto de entrada del front. Por ahora sólo verifica la conexión con la API.

const API_BASE = '/api/simulation';

async function ping() {
    const status = document.getElementById('status');
    try {
        const res = await fetch(`${API_BASE}/defaults/`);
        const data = await res.json();
        status.textContent = `Conexión OK → ${JSON.stringify(data)}`;
    } catch (err) {
        status.textContent = `Error de conexión: ${err.message}`;
    }
}

document.addEventListener('DOMContentLoaded', ping);
