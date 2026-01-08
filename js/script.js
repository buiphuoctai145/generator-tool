
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

const commandsContainer = el('#commandsContainer');

// ====== Command block (có conditions riêng) ======
function addCommandBlock({ name = '', conditions = [] } = {}) {
    const block = make('div', { class: 'cmd-block' });

    // Header: Command name + nút xóa command + nút thêm condition
    const header = make('div', { class: 'cmd-header' });
    const nameInput = make('input', { class: 'cmd-name', type: 'text', placeholder: 'Command name (Ex: Power On)' });
    nameInput.value = name;

    const headerActions = make('div', { class: 'controls' });
    const addCondBtn = make('button', { class: 'accent', text: '➕ Condition' });
    const removeCmdBtn = make('button', { class: 'danger', text: 'Delete Command' });

    headerActions.append(addCondBtn, removeCmdBtn);
    header.append(nameInput, headerActions);

    // Conditions list cho riêng command này
    const condList = make('div');

    function addConditionRow({ name = '', values = ['Off', 'On'] } = {}) {
        const row = make('div', { class: 'cond-row' });
        const condName = make('input', { class: 'cond-name', type: 'text', placeholder: 'Condition name (Ex: bPowerStatus)' });
        condName.value = name;

        const valuesWrap = make('div', { class: 'values-wrap' });
        const addValueChip = (val = '') => {
            const chip = make('div', { class: 'value-chip' });
            const input = make('input', { type: 'text', placeholder: 'Value' });
            input.value = val;
            const removeBtn = make('button', { class: 'remove-btn', text: '×' });
            removeBtn.title = 'Delete this value';
            removeBtn.addEventListener('click', () => chip.remove());
            chip.append(input, removeBtn);
            valuesWrap.appendChild(chip);
        };
        if (!Array.isArray(values) || values.length === 0) values = ['Off', 'On'];
        values.forEach(v => addValueChip(v));

        const actions = make('div', { class: 'cond-actions' });
        const addValBtn = make('button', { class: 'accent', text: '➕ Add Value' });
        const removeCondBtn = make('button', { class: 'danger', text: 'Delete Condition' });
        addValBtn.addEventListener('click', () => addValueChip(''));
        removeCondBtn.addEventListener('click', () => row.remove());

        // realtime validate trùng tên trong phạm vi command này
        condName.addEventListener('input', () => validateUniqueConditionNames(block, true));

        row.append(condName, valuesWrap, actions);
        actions.append(addValBtn, removeCondBtn);
        condList.appendChild(row);
    }

    addCondBtn.addEventListener('click', () => {
        addConditionRow();
        validateUniqueConditionNames(block, true);
    });
    removeCmdBtn.addEventListener('click', () => {
        block.remove();
        validateUniqueCommandNames(true);
    });

    // gắn lại vào block
    block.append(header, condList);
    commandsContainer.appendChild(block);

    // nếu có sẵn conditions, nạp vào
    (conditions || []).forEach(c => addConditionRow(c));

    // validate realtime cho command name
    nameInput.addEventListener('input', () => validateUniqueCommandNames(true));
}

// ====== Đọc dữ liệu toàn bộ cấu trúc ======
function readAll() {
    const equipmentTypeName = (el('#equipmentTypeName').value || '').trim();
    const commands = [...commandsContainer.querySelectorAll('.cmd-block')].map(block => {
        const cmdName = (block.querySelector('.cmd-name').value || '').trim();
        const conds = [...block.querySelectorAll('.cond-row')].map(row => {
            const name = (row.querySelector('.cond-name').value || '').trim();
            const values = [...row.querySelectorAll('.value-chip input')].map(inp => (inp.value || '').trim()).filter(Boolean);
            return { name, values };
        }).filter(c => c.name.length > 0);
        return { name: cmdName, conds };
    }).filter(cmd => cmd.name.length > 0);
    return { equipmentTypeName, commands };
}

// ====== Validation: trùng tên command (trong một equipment type) ======
function normalize(s) { return (s || '').trim().toLowerCase(); }
function validateUniqueCommandNames(showHints = true) {
    const inputs = [...commandsContainer.querySelectorAll('.cmd-name')];
    const counters = new Map(), originals = new Map();
    inputs.forEach(inp => { inp.classList.remove('error'); inp.removeAttribute('title'); });
    inputs.forEach(inp => {
        const orig = (inp.value || '').trim(); const norm = normalize(orig); if (!norm) return;
        counters.set(norm, (counters.get(norm) || 0) + 1);
        const arr = originals.get(norm) || []; arr.push(orig); originals.set(norm, arr);
    });
    let hasDup = false; counters.forEach((cnt) => { if (cnt > 1) hasDup = true; });
    if (showHints && hasDup) {
        inputs.forEach(inp => {
            const orig = (inp.value || '').trim(); const norm = normalize(orig);
            if (!norm) return; if ((counters.get(norm) || 0) > 1) {
                inp.classList.add('error');
                inp.title = `Duplicate Command Name: "${orig}"`;
            }
        });
    }
    return { ok: !hasDup };
}

// ====== Validation: trùng tên condition trong phạm vi MỖI command ======
function validateUniqueConditionNames(commandBlock, showHints = true) {
    const inputs = [...commandBlock.querySelectorAll('.cond-name')];
    const counters = new Map();
    inputs.forEach(inp => { inp.classList.remove('error'); inp.removeAttribute('title'); });
    inputs.forEach(inp => {
        const norm = normalize(inp.value); if (!norm) return;
        counters.set(norm, (counters.get(norm) || 0) + 1);
    });
    let hasDup = false; counters.forEach(cnt => { if (cnt > 1) hasDup = true; });
    if (showHints && hasDup) {
        inputs.forEach(inp => {
            const norm = normalize(inp.value); if (!norm) return;
            if ((counters.get(norm) || 0) > 1) {
                inp.classList.add('error');
                inp.title = `Duplicate Condition Name in Command`;
            }
        });
    }
    return { ok: !hasDup };
}

// ====== Sinh tổ hợp cho MỘT command (mixed-radix) ======
function generateCombinationsForCommand(conds) {
    if (!Array.isArray(conds) || conds.length === 0) return [];
    for (const c of conds) {
        if (!Array.isArray(c.values) || c.values.length < 2) {
            throw new Error(`Condition "${c.name}" must have at least 2 values.`);
        }
    }
    const radices = conds.map(c => c.values.length);
    const total = radices.reduce((acc, k) => acc * k, 1);
    const out = []; const idxs = Array(conds.length).fill(0);
    for (let t = 0; t < total; t++) {
        const caseObj = {};
        for (let i = 0; i < conds.length; i++) caseObj[conds[i].name] = conds[i].values[idxs[i]];
        out.push(caseObj);
        for (let i = conds.length - 1; i >= 0; i--) { idxs[i]++; if (idxs[i] < radices[i]) break; idxs[i] = 0; }
    }
    return out;
}

// ====== Stats tổng hợp ======
function updateStats(equipmentTypeName, commandsCasesMap) {
    const cmds = Object.keys(commandsCasesMap);
    const totalCommands = cmds.length;
    const totalCases = cmds.reduce((acc, k) => acc + (commandsCasesMap[k].length || 0), 0);
    const perCmd = cmds.map(k => `${k}: ${commandsCasesMap[k].length} cases`).join(' · ');
    el('#stats').textContent =
        `Equipment Type: ${equipmentTypeName || ''} · Commands: ${totalCommands} · Total cases: ${totalCases}` +
        (perCmd ? ` · ${perCmd}` : '');
}

// ====== export ======
// function yamlSafe(str) {
//     if (str == null) return '""';
//     const s = String(str);
//     return (/^[A-Za-z0-9_\-]+$/.test(s)) ? s : `"${s.replace(/"/g, '\\"')}"`;
// }

// function toYAML(equipmentTypeName, commandsCasesMap) {
//     const lines = [];
//     lines.push(`EquipmentTypes:`);
//     lines.push(`  - Name: ${(equipmentTypeName || 'Equipment').trim()}`); // KHÔNG quote Name
//     lines.push(`    Commands:`);
//     Object.entries(commandsCasesMap).forEach(([cmdName, cases]) => {
//         lines.push(`      - Name: ${(cmdName || 'Command').trim()}`); // KHÔNG quote Name
//         lines.push(`        Scenarios:`);
//         cases.forEach((c, idx) => {
//             lines.push(`          - Name: Case ${idx + 1}`);
//             lines.push(`            Conditions:`);
//             Object.entries(c).forEach(([k, v]) => {
//                 lines.push(`              ${k}: ${yamlSafe(v)}`); // values có thể quote nếu cần
//             });
//         });
//     });
//     return lines.join('\n');
// }


function yamlQuoteAlways(str) {
  // Luôn bọc trong "..." và escape dấu "
  const s = String(str ?? '');
  return `"${s.replace(/"/g, '\\"')}"`;
}

function yamlSafe(str) {
  // Quote khi cần cho VALUES (không áp dụng cho Name ở Commands/Scenarios)
  if (str == null) return '""';
  const s = String(str);
  // Cho phép chuỗi "an toàn" không cần dấu "
  return (/^[A-Za-z0-9_\-]+$/.test(s)) ? s : `"${s.replace(/"/g, '\\"')}"`;
}

function toYAML(equipmentTypeName, commandsCasesMap) {
  const lines = [];
  lines.push(`EquipmentTypes:`);

  // ✅ CHỈ Equipment Type Name được bọc trong dấu "
  const etName = (equipmentTypeName || 'Equipment').trim();
  lines.push(`  - Name: ${yamlQuoteAlways(etName)}`);

  lines.push(`    Commands:`);

  Object.entries(commandsCasesMap).forEach(([cmdName, cases]) => {
    // ❌ KHÔNG quote Command Name
    lines.push(`      - Name: ${(cmdName || 'Command').trim()}`);
    lines.push(`        Scenarios:`);

    cases.forEach((c, idx) => {
      // ❌ KHÔNG quote Scenario Name (Case n)
      lines.push(`          - Name: Case ${idx + 1}`);
      lines.push(`            Conditions:`);

      Object.entries(c).forEach(([k, v]) => {
        // ✅ VALUES vẫn yamlSafe
        lines.push(`              ${k}: ${yamlSafe(v)}`);
      });
    });
  });

  return lines.join('\n');
}

function toJSON(equipmentTypeName, commandsCasesMap) {
    return JSON.stringify({
        EquipmentTypes: [
            {
                Name: equipmentTypeName || 'Equipment',
                Commands: Object.entries(commandsCasesMap).map(([cmdName, cases]) => ({
                    Name: cmdName || 'Command',
                    Scenarios: cases.map((c, idx) => ({
                        Name: `Case ${idx + 1}`,
                        Conditions: c
                    }))
                }))
            }
        ]
    }, null, 2);
}

function enableExports(enabled) {
    ['downloadJSON', 'downloadYAML', 'copyYAML'].forEach(id => el('#' + id).disabled = !enabled);
}

function download(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

// ====== Sự kiện ======
el('#addCommand').addEventListener('click', () => addCommandBlock());
el('#clearAll').addEventListener('click', () => { commandsContainer.innerHTML = ''; });

el('#loadSample').addEventListener('click', () => {
    commandsContainer.innerHTML = '';
    // Sample: 2 command, mỗi cái có conditions riêng
    addCommandBlock({
        name: 'Power On',
        conditions: [
            { name: 'bPowerStatus', values: ['Off', 'On'] },
            { name: 'bRunningUp', values: ['Off', 'On'] },
            { name: 'bRunningDown', values: ['Off', 'On'] },
        ]
    });
    addCommandBlock({
        name: 'Set Speed',
        conditions: [
            { name: 'SpeedMode', values: ['Stop', 'Slow', 'Medium', 'Fast', 'Max'] },
            { name: 'Direction', values: ['Up', 'Down'] },
        ]
    });
    el('#equipmentTypeName').value = 'Escalator';
});

let lastEquipmentType = '', lastCommandsCasesMap = {};

el('#generate').addEventListener('click', () => {
    // Validate tổng
    if (!validateUniqueCommandNames(true).ok) { alert('Duplicate Command Name found. Please fix before generating cases.'); return; }
    // Validate chi tiết từng command
    const blocks = [...commandsContainer.querySelectorAll('.cmd-block')];
    for (const b of blocks) {
        const v = validateUniqueConditionNames(b, true);
        if (!v.ok) { alert('Duplicate Condition Name found in a Command. Please fix before generating cases.'); return; }
    }

    const { equipmentTypeName, commands } = readAll();
    if (!equipmentTypeName) { alert('Please enter Equipment Type Name.'); return; }
    if (commands.length === 0) { alert('Please add at least 1 Command.'); return; }

    // Mỗi command: sinh case theo chính conditions của nó
    const commandsCasesMap = {};
    try {
        for (const cmd of commands) {
            if (!cmd.name) continue;
            if (!Array.isArray(cmd.conds) || cmd.conds.length === 0) {
                throw new Error(`Command "${cmd.name}" has no conditions.`);
            }
            const cases = generateCombinationsForCommand(cmd.conds);
            commandsCasesMap[cmd.name] = cases;
        }
    } catch (e) {
        alert(e.message || 'There was an error generating combinations.');
        return;
    }

    // Stats + YAML/JSON
    updateStats(equipmentTypeName, commandsCasesMap);
    const yaml = toYAML(equipmentTypeName, commandsCasesMap);
    el('#yamlBlock').textContent = yaml;
    el('#yamlBlock').style.display = 'block';

    lastEquipmentType = equipmentTypeName;
    lastCommandsCasesMap = commandsCasesMap;
    enableExports(true);
});

el('#downloadJSON').addEventListener('click', () => {
    const json = toJSON(lastEquipmentType, lastCommandsCasesMap);
    const baseET = (lastEquipmentType || 'Equipment').replace(/[^\w\-]+/g, '_');
    download(`${baseET}_cases.json`, json, 'application/json');
});

el('#downloadYAML').addEventListener('click', () => {
    const yaml = toYAML(lastEquipmentType, lastCommandsCasesMap);
    const baseET = (lastEquipmentType || 'Equipment').replace(/[^\w\-]+/g, '_');
    download(`${baseET}_cases.yaml`, yaml, 'text/yaml');
});

el('#copyYAML').addEventListener('click', async () => {
    const yaml = toYAML(lastEquipmentType, lastCommandsCasesMap);
    try { await navigator.clipboard.writeText(yaml); alert('YAML copied to clipboard!'); }
    catch { alert('Browser does not allow automatic copy. Please select and copy the YAML block manually.'); }
});

// Khởi tạo: một command rỗng
addCommandBlock({ name: 'Command Name', conditions: [{ name: 'IO Tag', values: ['Value 1', 'Value 2'] }] });
