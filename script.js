// ====== DOM ======
const el = sel => document.querySelector(sel);
const make = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else node.setAttribute(k, v);
    });
    children.forEach(c => node.appendChild(c));
    return node;
};

const conditionsWrap = el('#conditions');

// ====== Component init ======
function addConditionRow({ name = '', values = ['Off', 'On'] } = {}) {
    const row = make('div', { class: 'cond-row' });
    const nameIn = make('input', { class: 'cond-name', type: 'text', placeholder: 'Condition name (exx: bPowerStatus)' });
    nameIn.value = name;

    const valuesWrap = make('div', { class: 'values-wrap' });

    // Helper
    const addValueChip = (val = '') => {
        const chip = make('div', { class: 'value-chip' });
        const input = make('input', { type: 'text', placeholder: 'Giá trị' });
        input.value = val;
        const removeBtn = make('button', { class: 'remove-value', text: '×' });
        removeBtn.title = 'Remove value';
        removeBtn.addEventListener('click', () => {
            chip.remove();
        });
        chip.append(input, removeBtn);
        valuesWrap.appendChild(chip);
    };

    // Initialize default values
    if (!Array.isArray(values) || values.length === 0) values = ['Off', 'On'];
    values.forEach(v => addValueChip(v));

    // add/remove buttons
    const actions = make('div', { class: 'cond-actions' });
    const addValBtn = make('button', { class: 'accent', text: '➕ Value' });
    const removeCondBtn = make('button', { class: 'danger', text: 'Remove condition' });

    addValBtn.addEventListener('click', () => addValueChip(''));
    removeCondBtn.addEventListener('click', () => row.remove());

    // input condition → validate duplicate realtime
    nameIn.addEventListener('input', () => validateUniqueNames(true));

    actions.append(addValBtn, removeCondBtn);

    row.append(nameIn, valuesWrap, actions);
    conditionsWrap.appendChild(row);
}

// Read data from UI
function readConditions() {
    const rows = [...conditionsWrap.querySelectorAll('.cond-row')];
    return rows.map(row => {
        const name = (row.querySelector('.cond-name').value || '').trim();
        const vals = [...row.querySelectorAll('.value-chip input')]
            .map(inp => (inp.value || '').trim())
            .filter(v => v.length > 0);
        return { name, values: vals };
    }).filter(c => c.name.length > 0);
}

// ====== Validation: except duplicate  ======
function normalizeName(s) {
    return (s || '').trim().toLowerCase();
}

/**
 * Quét toàn bộ tên điều kiện, phát hiện trùng (case-insensitive, bỏ khoảng trắng)
 * @param {boolean} showHints - nếu true, tô đỏ những input trùng và set tooltip.
 * @returns {{ok: boolean, dups: Map<string, string[]>}} ok=false nếu có trùng
 */
function validateUniqueNames(showHints = true) {
    const rows = [...conditionsWrap.querySelectorAll('.cond-row')];
    const names = rows.map(r => r.querySelector('.cond-name'));
    const normToOriginals = new Map(); // normName -> [originals...]
    const counters = new Map();        // normName -> count

    // reset error states
    names.forEach(inp => {
        inp.classList.remove('error');
        inp.removeAttribute('title');
    });

    // count
    names.forEach(inp => {
        const orig = (inp.value || '').trim();
        const norm = normalizeName(orig);
        if (!norm) return;
        counters.set(norm, (counters.get(norm) || 0) + 1);
        const list = normToOriginals.get(norm) || [];
        list.push(orig);
        normToOriginals.set(norm, list);
    });

    // define duplicates
    let hasDup = false;
    const dupMap = new Map(); // normName -> originals[]
    counters.forEach((cnt, norm) => {
        if (cnt > 1) {
            hasDup = true;
            dupMap.set(norm, normToOriginals.get(norm) || []);
        }
    });

    // show error hints
    if (showHints && hasDup) {
        names.forEach(inp => {
            const orig = (inp.value || '').trim();
            const norm = normalizeName(orig);
            if (!norm) return;
            if (dupMap.has(norm)) {
                inp.classList.add('error');
                const seen = dupMap.get(norm);
                inp.title = `Condition name duplicated: "${orig}" (seen ${seen.length} times: ${seen.join(', ')})`;
            }
        });
    }

    return { ok: !hasDup, dups: dupMap };
}

// ====== Generate combinations ======
function generateCombinations(conds) {
    const n = conds.length;
    if (n === 0) return [];

    // Validate: each condition must have >= 2 values (can be relaxed as needed)
    for (const c of conds) {
        if (!Array.isArray(c.values) || c.values.length < 2) {
            throw new Error(`Condition "${c.name}" must have at least 2 values.`);
        }
    }

    const radices = conds.map(c => c.values.length);
    const total = radices.reduce((acc, k) => acc * k, 1);

    const out = [];
    const idxs = Array(n).fill(0); // bộ đếm mixed-radix

    for (let t = 0; t < total; t++) {
        const caseObj = {};
        for (let i = 0; i < n; i++) {
            caseObj[conds[i].name] = conds[i].values[idxs[i]];
        }
        out.push(caseObj);

        // Tăng bộ đếm: điều kiện cuối cùng (i = n-1) đổi nhanh nhất
        for (let i = n - 1; i >= 0; i--) {
            idxs[i]++;
            if (idxs[i] < radices[i]) break; // chưa tràn
            idxs[i] = 0;                      // tràn: reset và carry sang trái
        }
    }
    return out;
}

// ====== Hiển thị bảng ======
function renderTable(conds, cases) {
    const table = el('#resultsTable');
    table.innerHTML = '';

    const thead = make('thead');
    const headerRow = make('tr');
    headerRow.appendChild(make('th', { text: 'Case' }));
    conds.forEach(c => headerRow.appendChild(make('th', { text: c.name })));
    thead.appendChild(headerRow);

    const tbody = make('tbody');
    cases.forEach((c, idx) => {
        const tr = make('tr');
        tr.appendChild(make('td', { text: `Case ${idx + 1}` }));
        conds.forEach(cond => tr.appendChild(make('td', { text: c[cond.name] ?? '' })));
        tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    el('#tableWrap').style.display = 'block';

    const equipmentType = (el('#equipmentTypeName').value || '').trim() || '';
    const commandName = (el('#commandName').value || '').trim() || '';
    el('#stats').textContent =
        `Equipment Type: ${equipmentType} · Command: ${commandName} · ` +
        `Total conditions: ${conds.length} · Total cases: ${cases.length}`;
}

// ====== Xuất dữ liệu ======
// function toCSV(conds, cases) {
//     const header = ['Case', ...conds.map(c => c.name)].join(',');
//     const lines = cases.map((c, idx) => {
//         const row = [`Case ${idx + 1}`, ...conds.map(cond => `"${(c[cond.name] ?? '').replace(/"/g, '""')}"`)];
//         return row.join(',');
//     });
//     return [header, ...lines].join('\n');
// }

// function toJSON(conds, cases, equipmentTypeName, commandName) {
//     return JSON.stringify({
//         EquipmentTypes: [
//             {
//                 Name: equipmentTypeName || 'Equipment',
//                 Commands: [
//                     {
//                         Name: commandName || 'Command',
//                         Scenarios: cases.map((c, idx) => ({
//                             Name: `Case ${idx + 1}`,
//                             Conditions: c
//                         }))
//                     }
//                 ]
//             }
//         ]
//     }, null, 2);
// }

function yamlSafe(str) {
    if (str == null) return '""';
    const s = String(str);
    return (/^[A-Za-z0-9_\-]+$/.test(s)) ? s : `"${s.replace(/"/g, '\\"')}"`;
}

function toYAML(conds, cases, equipmentTypeName, commandName) {
    const lines = [];
    lines.push(`EquipmentTypes:`);
    lines.push(`  - Name: ${yamlSafe((equipmentTypeName || 'Equipment').trim())}`);
    lines.push(`    Commands:`);
    lines.push(`      - Name: ${yamlSafe((commandName || 'Command').trim())}`);
    lines.push(`        Scenarios:`);
    cases.forEach((c, idx) => {
        lines.push(`          - Name: Case ${idx + 1}`);
        lines.push(`            Conditions:`);
        Object.entries(c).forEach(([k, v]) => {
            lines.push(`              ${k}: ${yamlSafe(v)}`);
        });
    });
    return lines.join('\n');
}

function enableExports(enabled) {
    [
        // 'downloadCSV', 
        // 'downloadJSON', 
        'downloadYAML', 
        'copyYAML'].forEach(id => el('#' + id).disabled = !enabled);
}

function download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// ====== LocalStorage ======
function saveConfig() {
    // chặn lưu khi có tên trùng
    const v = validateUniqueNames(true);
    if (!v.ok) {
        alert('Duplicate condition names found. Please fix before saving configuration.');
        return;
    }
    const equipmentTypeName = (el('#equipmentTypeName').value || '').trim();
    const commandName = (el('#commandName').value || '').trim();
    const conds = readConditions();
    localStorage.setItem('comb_config', JSON.stringify({ equipmentTypeName, commandName, conds }));
    alert('Đã lưu cấu hình vào trình duyệt.');
}
function loadConfig() {
    const raw = localStorage.getItem('comb_config');
    if (!raw) return;
    try {
        const { equipmentTypeName, commandName, conds } = JSON.parse(raw);
        el('#equipmentTypeName').value = equipmentTypeName || '';
        el('#commandName').value = commandName || '';
        conditionsWrap.innerHTML = '';
        (conds || []).forEach(c => addConditionRow(c));
        validateUniqueNames(true); // đánh dấu nếu có trùng trong dữ liệu cũ
    } catch { }
}
function clearConfig() {
    localStorage.removeItem('comb_config');
    alert('Removed saved configuration from browser.');
}

// ====== Events ======
el('#addCondition').addEventListener('click', () => {
    addConditionRow();
    validateUniqueNames(true); // re-check sau khi thêm dòng
});
el('#clearConfig').addEventListener('click', () => { clearConfig(); });
el('#loadSample').addEventListener('click', () => {
    conditionsWrap.innerHTML = '';
    // 3 điều kiện nhị phân
    addConditionRow({ name: 'bPowerStatus', values: ['Off', 'On'] });
    addConditionRow({ name: 'bRunningUp', values: ['Off', 'On'] });
    addConditionRow({ name: 'bRunningDown', values: ['Off', 'On'] });
    // 1 điều kiện có 5 giá trị (ví dụ)
    addConditionRow({ name: 'SpeedMode', values: ['Stop', 'Slow', 'Medium', 'Fast', 'Max'] });

    el('#equipmentTypeName').value = 'Escalator';
    el('#commandName').value = 'Power On';
    validateUniqueNames(true);
});

let lastConds = [], lastCases = [], lastEquipmentType = '', lastCommand = '';

el('#generate').addEventListener('click', () => {
    // chặn generate nếu có tên trùng
    const v = validateUniqueNames(true);
    if (!v.ok) {
        alert('Có tên điều kiện trùng lặp. Vui lòng sửa trước khi tạo cases.');
        return;
    }

    const conds = readConditions();
    if (conds.length === 0) { alert('Please enter at least 1 condition (Name).'); return; }
    const equipmentTypeName = (el('#equipmentTypeName').value || '').trim();
    const commandName = (el('#commandName').value || '').trim();
    if (!equipmentTypeName) { alert('Please enter Equipment Type Name.'); return; }
    if (!commandName) { alert('Please enter Command Name.'); return; }

    try {
        const cases = generateCombinations(conds);
        renderTable(conds, cases);
        const yaml = toYAML(conds, cases, equipmentTypeName, commandName);
        el('#yamlBlock').textContent = yaml;
        el('#yamlBlock').style.display = 'block';

        lastConds = conds;
        lastCases = cases;
        lastEquipmentType = equipmentTypeName;
        lastCommand = commandName;
        enableExports(true);
    } catch (e) {
        alert(e.message || 'Error occurred during case generation.');
    }
});

// el('#downloadCSV').addEventListener('click', () => {
//     const csv = toCSV(lastConds, lastCases);
//     const baseET = (lastEquipmentType || 'Equipment').replace(/[^\w\-]+/g, '_');
//     const baseCmd = (lastCommand || 'Command').replace(/[^\w\-]+/g, '_');
//     download(`${baseET}_${baseCmd}_cases.csv`, csv, 'text/csv');
// });
// el('#downloadJSON').addEventListener('click', () => {
//     const json = toJSON(lastConds, lastCases, lastEquipmentType, lastCommand);
//     const baseET = (lastEquipmentType || 'Equipment').replace(/[^\w\-]+/g, '_');
//     const baseCmd = (lastCommand || 'Command').replace(/[^\w\-]+/g, '_');
//     download(`${baseET}_${baseCmd}_cases.json`, json, 'application/json');
// });
el('#downloadYAML').addEventListener('click', () => {
    const yaml = toYAML(lastConds, lastCases, lastEquipmentType, lastCommand);
    const baseET = (lastEquipmentType || 'Equipment').replace(/[^\w\-]+/g, '_');
    const baseCmd = (lastCommand || 'Command').replace(/[^\w\-]+/g, '_');
    download(`${baseET}_${baseCmd}_cases.yaml`, yaml, 'text/yaml');
});
el('#copyYAML').addEventListener('click', async () => {
    const yaml = toYAML(lastConds, lastCases, lastEquipmentType, lastCommand);
    try { await navigator.clipboard.writeText(yaml); alert('Copied YAML to clipboard!'); }
    catch { alert('Browser does not allow automatic copy. Please select and copy the YAML block manually.'); }
});

// Khởi tạo
addConditionRow(); // một dòng mặc định (Off/On)
loadConfig();      // nếu có cấu hình đã lưu
