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

// Validacion de campos

function setFieldError(name, msg) {
    const errEl = document.querySelector(`.field-error[data-for="${name}"]`);
    const input = form.elements[name];
    if (errEl) errEl.textContent = msg || '';
    if (input) input.classList.toggle('invalid', !!msg);
}

function clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    form.querySelectorAll('input.invalid').forEach(el => el.classList.remove('invalid'));
}

function validateParams(p) {
    const errors = {};

    // Enteros con rango
    if (!Number.isInteger(p.n_corridas) || p.n_corridas < 1 || p.n_corridas > 1_000_000) {
        errors.n_corridas = 'Debe ser un entero entre 1 y 1.000.000';
    }
    if (!Number.isInteger(p.page) || p.page < 1) {
        errors.page = 'Debe ser un entero ≥ 1';
    }
    if (!Number.isInteger(p.page_size) || p.page_size < 1 || p.page_size > 500) {
        errors.page_size = 'Debe ser un entero entre 1 y 500';
    }

    // Probabilidades de etapa: cada una en [0, 1]
    for (const k of ['prob_etapa_1', 'prob_etapa_2', 'prob_etapa_3']) {
        if (Number.isNaN(p[k]) || p[k] < 0 || p[k] > 1) {
            errors[k] = 'Debe estar entre 0 y 1';
        }
    }
    // Suma de probabilidades de etapa = 1
    const suma = p.prob_etapa_1 + p.prob_etapa_2 + p.prob_etapa_3;
    if (!Number.isNaN(suma) && Math.abs(suma - 1) > 1e-6) {
        const msg = `Las 3 probabilidades deben sumar 1 (suman ${suma.toFixed(2)})`;
        for (const k of ['prob_etapa_1', 'prob_etapa_2', 'prob_etapa_3']) {
            if (!errors[k]) errors[k] = msg;
        }
    }

    // Probabilidades de eventos: en [0, 1]
    for (const k of ['prob_control', 'prob_demora', 'prob_intervencion']) {
        if (Number.isNaN(p[k]) || p[k] < 0 || p[k] > 1) {
            errors[k] = 'Debe estar entre 0 y 1';
        }
    }

    // Medias y desvio: > 0
    for (const k of ['media_tiempo_etapa', 'desvio_tiempo_etapa', 'media_tiempo_control', 'media_intervencion']) {
        if (Number.isNaN(p[k]) || p[k] <= 0) {
            errors[k] = 'Debe ser mayor a 0';
        }
    }

    // Factor demora: ≥ 1
    if (Number.isNaN(p.factor_demora) || p.factor_demora < 1) {
        errors.factor_demora = 'Debe ser ≥ 1';
    }

    // Cross-field: la página no puede exceder el total de corridas
    if (Number.isInteger(p.n_corridas) && Number.isInteger(p.page) && Number.isInteger(p.page_size)) {
        const offset = (p.page - 1) * p.page_size;
        if (offset >= p.n_corridas) {
            errors.page = `La página ${p.page} excede el total de ${p.n_corridas} corridas`;
        }
    }

    return errors;
}

function showErrors(errors) {
    for (const [name, msg] of Object.entries(errors)) {
        setFieldError(name, msg);
    }
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
    clearAllErrors();

    const params = collectParams();
    params.page = 1;
    inputPage.value = 1;

    const errors = validateParams(params);
    if (Object.keys(errors).length > 0) {
        showErrors(errors);
        setStatus('Hay errores en el formulario.', true);
        return;
    }

    lastParams = params;
    await runSimulation(lastParams);
});

// Limpiar el error de un campo cuando el usuario lo modifica
form.addEventListener('input', (e) => {
    if (e.target.name) setFieldError(e.target.name, '');
});

btnDefaults.addEventListener('click', () => {
    form.reset();
    clearAllErrors();
});

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
