const API_BASE = '/api/simulation';

const form= document.getElementById('sim-form');
const btnSimular = document.getElementById('btn-simular');
const btnDefaults= document.getElementById('btn-defaults');
const simStatus = document.getElementById('sim-status');
const results = document.getElementById('results');
const tbody = document.getElementById('sim-tbody');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const pageInfo = document.getElementById('page-info');
const resultMeta = document.getElementById('result-meta');
const inputPage = form.elements['page'];

const INT_FIELDS = new Set(['n_corridas', 'page', 'page_size']);

let lastParams  = null;
let currentPage = 1;
let totalPages  = 1;

// Helpers

function setStatus(msg, isError = false) {
    simStatus.textContent = msg;
    simStatus.className = 'sim-status' + (isError ? ' error' : '');
}

function collectParams() {
    const fd = new FormData(form);
    const p = {};
    for (const [k, v] of fd.entries()) {
        p[k] = INT_FIELDS.has(k) ? parseInt(v, 10) : parseFloat(v);
    }
    return p;
}

// Stats

function renderStats(data) {
    document.getElementById('stat-promedio').textContent = data.tiempo_promedio?.toFixed(2) ?? '—';
    document.getElementById('stat-maximo').textContent = data.tiempo_total_maximo?.toFixed(2) ?? '—';
    document.getElementById('stat-minimo').textContent = data.tiempo_total_minimo?.toFixed(2) ?? '—';
    document.getElementById('stat-ctrl-interv').textContent = data.porcentaje_pasa_control_intervencion?.toFixed(2) ?? '—';
    document.getElementById('stat-sin-demoras').textContent = data.cantidad_sin_demoras ?? '—';
    document.getElementById('stat-pct-calibracion').textContent = data.porcentaje_jornadas_con_al_menos_una_calibracion?.toFixed(2) ?? '—';
    document.getElementById('stat-demora-adicional').textContent   = data.tiempo_promedio_demora_adicional?.toFixed(2) ?? '—';
    document.getElementById('stat-demora-calibracion').textContent = data.tiempo_promedio_demora_calibracion?.toFixed(2) ?? '—';
    resultMeta.textContent = `${data.total_corridas?.toLocaleString()} corridas`;
}

// Fila de tabla

function addCell(tr, text, kind) {
    const td = document.createElement('td');
    if (text == null) {
        td.textContent = '—';
        td.classList.add('na');
    } else {
        td.textContent = text;
        if (kind) td.classList.add(kind);
    }
    tr.appendChild(td);
}

function addNum(tr, val, decimals = 2) {
    addCell(tr, val == null ? null : val.toFixed(decimals));
}

function addBool(tr, val) {
    if (val == null) {
        addCell(tr, null);
    } else {
        addCell(tr, val ? 'Sí' : 'No', val ? 'si' : 'no');
    }
}

function buildRow(row, isLast = false) {
    const tr = document.createElement('tr');
    if (isLast) tr.classList.add('last-row');

    addCell(tr, row.reloj);
    addNum(tr, row.rnd_cantidad_etapas);
    addCell(tr, row.cantidad_etapas);

    // Etapa 1
    addNum(tr, row.rnd_tiempo_etapa_1);
    addNum(tr, row.tiempo_etapa_1);
    addNum(tr, row.rnd_demora_etapa_1);
    addBool(tr, row.tiene_demora_etapa_1);
    addNum(tr, row.tiempo_total_etapa_1);

    // Etapa 2
    addNum(tr, row.rnd_tiempo_etapa_2);
    addNum(tr, row.tiempo_etapa_2);

    // Etapa 3
    addNum(tr, row.rnd_tiempo_etapa_3);
    addNum(tr, row.tiempo_etapa_3);
    addNum(tr, row.rnd_demora_etapa_3);
    addBool(tr, row.tiene_demora_etapa_3);
    addNum(tr, row.tiempo_total_etapa_3);

    // Control
    addNum(tr, row.rnd_pasa_control);
    addBool(tr, row.pasa_control);
    addNum(tr, row.rnd_tiempo_control);
    addNum(tr, row.tiempo_control);

    // Intervención
    addNum(tr, row.rnd_requiere_intervencion);
    addBool(tr, row.requiere_intervencion);
    addNum(tr, row.rnd_tiempo_intervencion);
    addNum(tr, row.tiempo_intervencion);

    addNum(tr, row.tiempo_total);

    return tr;
}

//  Tabla

function renderTable(data) {
    tbody.innerHTML = '';

    for (const row of data.rows ?? []) {
        tbody.appendChild(buildRow(row));
    }

    if (data.last_row) {
        const sep = document.createElement('tr');
        sep.classList.add('row-separator');
        sep.innerHTML = `<td colspan="24">··· FILA N — CORRIDA ${data.total_corridas?.toLocaleString()} ···</td>`;
        tbody.appendChild(sep);
        tbody.appendChild(buildRow(data.last_row, true));
    }

    currentPage = data.page;
    totalPages  = data.total_pages;
    inputPage.value = currentPage;
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= totalPages;
}

// Fetch simulación

async function runSimulation(params) {
    btnSimular.disabled = true;
    setStatus('Simulando…');

    try {
        const res = await fetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        const data = await res.json();

        if (!res.ok) {
            const msg = Object.values(data).flat().join(' · ') || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        renderStats(data);
        renderTable(data);
        results.classList.remove('hidden');
        setStatus(`Simulación completada — ${params.n_corridas?.toLocaleString()} corridas.`);

    } catch (err) {
        setStatus(`Error: ${err.message}`, true);
    } finally {
        btnSimular.disabled = false;
    }
}

// Eventos

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    lastParams = collectParams();
    lastParams.page = 1;
    inputPage.value = 1;
    await runSimulation(lastParams);
});

btnDefaults.addEventListener('click', () => form.reset());

btnPrev.addEventListener('click', async () => {
    if (!lastParams || currentPage <= 1) return;
    lastParams.page = currentPage - 1;
    await runSimulation(lastParams);
});

btnNext.addEventListener('click', async () => {
    if (!lastParams || currentPage >= totalPages) return;
    lastParams.page = currentPage + 1;
    await runSimulation(lastParams);
});
