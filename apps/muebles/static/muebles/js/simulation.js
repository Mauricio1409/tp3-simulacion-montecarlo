const API_BASE = '/api/simulation';

const form       = document.getElementById('sim-form');
const btnSimular = document.getElementById('btn-simular');
const btnDefaults= document.getElementById('btn-defaults');
const simStatus  = document.getElementById('sim-status');
const results    = document.getElementById('results');
const tbody      = document.getElementById('sim-tbody');
const btnPrev    = document.getElementById('btn-prev');
const btnNext    = document.getElementById('btn-next');
const pageInfo   = document.getElementById('page-info');
const resultMeta = document.getElementById('result-meta');

let lastParams = null;
let currentPage = 1;
let totalPages  = 1;

// ── Helpers ────────────────────────────────────────────────────────────────

function setStatus(msg, isError = false) {
    simStatus.textContent = msg;
    simStatus.className = 'sim-status' + (isError ? ' error' : '');
}

function fmt(val, decimals = 4) {
    if (val === null || val === undefined) return null;
    return typeof val === 'number' ? val.toFixed(decimals) : String(val);
}

function collectParams() {
    const fd = new FormData(form);
    const p = {};
    for (const [k, v] of fd.entries()) {
        p[k] = ['n_corridas', 'page', 'page_size'].includes(k)
            ? parseInt(v, 10)
            : parseFloat(v);
    }
    return p;
}

// ── Defaults ───────────────────────────────────────────────────────────────

function loadDefaults() {
    form.reset();
}

// ── Stats ──────────────────────────────────────────────────────────────────

function renderStats(data) {
    document.getElementById('stat-promedio').textContent        = data.tiempo_promedio?.toFixed(2) ?? '—';
    document.getElementById('stat-maximo').textContent          = data.tiempo_total_maximo?.toFixed(2) ?? '—';
    document.getElementById('stat-minimo').textContent          = data.tiempo_total_minimo?.toFixed(2) ?? '—';
    document.getElementById('stat-ctrl-interv').textContent     = data.porcentaje_pasa_control_intervencion?.toFixed(2) ?? '—';
    document.getElementById('stat-sin-demoras').textContent     = data.cantidad_sin_demoras ?? '—';
    document.getElementById('stat-pct-calibracion').textContent = data.porcentaje_jornadas_con_al_menos_una_calibracion?.toFixed(2) ?? '—';
    document.getElementById('stat-demora-adicional').textContent= data.tiempo_promedio_demora_adicional?.toFixed(2) ?? '—';
    document.getElementById('stat-demora-calibracion').textContent = data.tiempo_promedio_demora_calibracion?.toFixed(2) ?? '—';

    resultMeta.textContent = `${data.total_corridas?.toLocaleString()} corridas`;
}

// ── Fila de tabla ──────────────────────────────────────────────────────────

function buildRow(row, isLast = false) {
    const tr = document.createElement('tr');
    if (isLast) tr.classList.add('last-row');

    const cols = [
        { v: row.reloj },
        { v: fmt(row.rnd_cantidad_etapas) },
        { v: row.cantidad_etapas },
        { v: fmt(row.rnd_tiempo_etapa_1),  na: row.rnd_tiempo_etapa_1  === null },
        { v: fmt(row.tiempo_etapa_1, 4),   na: row.tiempo_etapa_1      === null },
        { v: fmt(row.rnd_demora_etapa_1),  na: row.rnd_demora_etapa_1  === null },
        { v: row.tiene_demora_etapa_1,     bool: true, na: row.tiene_demora_etapa_1 === null },
        { v: fmt(row.tiempo_total_etapa_1, 4), na: row.tiempo_total_etapa_1 === null },
        { v: fmt(row.rnd_tiempo_etapa_2),  na: row.rnd_tiempo_etapa_2  === null },
        { v: fmt(row.tiempo_etapa_2, 4),   na: row.tiempo_etapa_2      === null },
        { v: fmt(row.rnd_tiempo_etapa_3),  na: row.rnd_tiempo_etapa_3  === null },
        { v: fmt(row.tiempo_etapa_3, 4),   na: row.tiempo_etapa_3      === null },
        { v: fmt(row.rnd_demora_etapa_3),  na: row.rnd_demora_etapa_3  === null },
        { v: row.tiene_demora_etapa_3,     bool: true, na: row.tiene_demora_etapa_3 === null },
        { v: fmt(row.tiempo_total_etapa_3, 4), na: row.tiempo_total_etapa_3 === null },
        { v: fmt(row.rnd_pasa_control) },
        { v: row.pasa_control,             bool: true },
        { v: fmt(row.rnd_tiempo_control),  na: row.rnd_tiempo_control  === null },
        { v: fmt(row.tiempo_control, 4),   na: row.tiempo_control      === null },
        { v: fmt(row.rnd_requiere_intervencion) },
        { v: row.requiere_intervencion,    bool: true },
        { v: fmt(row.rnd_tiempo_intervencion), na: row.rnd_tiempo_intervencion === null },
        { v: fmt(row.tiempo_intervencion, 4),  na: row.tiempo_intervencion     === null },
        { v: fmt(row.tiempo_total, 4) },
    ];

    for (const col of cols) {
        const td = document.createElement('td');
        if (col.na) {
            td.textContent = '—';
            td.classList.add('na');
        } else if (col.bool) {
            const val = col.v;
            td.textContent = val ? 'Sí' : 'No';
            td.classList.add(val ? 'si' : 'no');
        } else {
            td.textContent = col.v ?? '—';
        }
        tr.appendChild(td);
    }
    return tr;
}

// ── Tabla ──────────────────────────────────────────────────────────────────

function renderTable(data) {
    tbody.innerHTML = '';

    const mainRows = data.rows ?? [];
    const lastRow  = data.last_row ?? null;

    for (const row of mainRows) tbody.appendChild(buildRow(row));


    if (lastRow) {
        const sep = document.createElement('tr');
        sep.innerHTML = `<td colspan="24" style="text-align:center;background:#e0f2fe;color:#075985;font-weight:700;padding:5px;font-size:.75rem;letter-spacing:.04em">
            ··· FILA N — CORRIDA ${data.total_corridas?.toLocaleString()} ···
        </td>`;
        tbody.appendChild(sep);
        tbody.appendChild(buildRow(lastRow, true));
    }

    currentPage = data.page;
    totalPages  = data.total_pages;
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    btnPrev.disabled = currentPage <= 1;
    btnNext.disabled = currentPage >= totalPages;
}

// ── Fetch simulación ───────────────────────────────────────────────────────

async function runSimulation(params) {
    btnSimular.disabled = true;
    setStatus('Simulando…');
    tbody.innerHTML = '';
    results.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(JSON.stringify(err) || `HTTP ${res.status}`);
        }

        const data = await res.json();
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

// ── Eventos ────────────────────────────────────────────────────────────────

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    lastParams = collectParams();
    lastParams.page = 1;
    await runSimulation(lastParams);
});

btnDefaults.addEventListener('click', loadDefaults);
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

