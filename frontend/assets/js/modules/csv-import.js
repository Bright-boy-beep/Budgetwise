// ============================================================
// CSV IMPORT MODULE
// Parses CSV files, auto-detects columns, ML-classifies
// categories, shows preview, and bulk-imports transactions.
// ============================================================

// ── State ────────────────────────────────────────────────────
let _csvRows      = [];   // raw parsed rows (objects)
let _csvHeaders   = [];   // original column names
let _colMap       = { date: '', description: '', amount: '', credit: '', debit: '', type: '' };
let _parsedTxs    = [];   // processed transaction previews

// ── Open / Close ─────────────────────────────────────────────
function openCSVImport() {
  _resetCSVImport();
  document.getElementById('csv-import-modal').classList.remove('hidden');
}

function closeCSVImport() {
  document.getElementById('csv-import-modal').classList.add('hidden');
  _resetCSVImport();
}

function _resetCSVImport() {
  _csvRows   = [];
  _csvHeaders = [];
  _parsedTxs = [];

  const uploadStep  = document.getElementById('csv-step-upload');
  const previewStep = document.getElementById('csv-step-preview');
  const importBtn   = document.getElementById('csv-import-btn');
  const fileInput   = document.getElementById('csv-file-input');

  if (uploadStep)  uploadStep.classList.remove('hidden');
  if (previewStep) previewStep.classList.add('hidden');
  if (importBtn)   importBtn.classList.add('hidden');
  if (fileInput)   fileInput.value = '';
}

// ── File handling ─────────────────────────────────────────────
function handleCSVFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => _processCSVText(e.target.result);
  reader.readAsText(file);
}

// Drag-and-drop support
(function _setupDrag() {
  document.addEventListener('DOMContentLoaded', () => {
    const zone = document.getElementById('csv-drop-zone');
    if (!zone) return;
    zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleCSVFile(file);
    });
  });
})();

// ── CSV Parsing ───────────────────────────────────────────────
function _parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function parseLine(line) {
    const result = [];
    let current  = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows    = lines.slice(1)
    .map(l => {
      const vals = parseLine(l);
      const obj  = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
      return obj;
    })
    .filter(r => Object.values(r).some(v => v !== ''));

  return { headers, rows };
}

// ── Column auto-detection ─────────────────────────────────────
const DATE_PATTERNS  = /date|time|day|when|posted|trans/i;
const DESC_PATTERNS  = /desc|narrat|detail|merchant|payee|reference|memo|note|particulars|remark/i;
const AMT_PATTERNS   = /^amount$|^amt$|transaction.?amount|value/i;
const CREDIT_PATTERNS= /credit|deposit|in|received/i;
const DEBIT_PATTERNS = /debit|withdrawal|out|paid|charge/i;
const TYPE_PATTERNS  = /^type$|transaction.?type|cr.?dr/i;

function _autoDetectColumns(headers) {
  const map = { date: '', description: '', amount: '', credit: '', debit: '', type: '' };
  headers.forEach(h => {
    const hn = h.toLowerCase();
    if (!map.date        && DATE_PATTERNS.test(h))   map.date        = h;
    if (!map.description && DESC_PATTERNS.test(h))   map.description = h;
    if (!map.amount      && AMT_PATTERNS.test(h))    map.amount      = h;
    if (!map.credit      && CREDIT_PATTERNS.test(h)) map.credit      = h;
    if (!map.debit       && DEBIT_PATTERNS.test(h))  map.debit       = h;
    if (!map.type        && TYPE_PATTERNS.test(h))   map.type        = h;
  });
  // Fallbacks
  if (!map.date        && headers[0]) map.date        = headers[0];
  if (!map.description && headers[1]) map.description = headers[1];
  if (!map.amount      && !map.credit && !map.debit) {
    // pick first numeric-looking column after date+desc
    for (let i = 2; i < headers.length; i++) {
      map.amount = headers[i];
      break;
    }
  }
  return map;
}

// ── Date normalisation ────────────────────────────────────────
function _normaliseDate(raw) {
  if (!raw) return '';
  // Remove quotes
  raw = raw.replace(/['"]/g, '').trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // DD/MM/YYYY or DD-MM-YYYY
  let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  // MM/DD/YYYY
  m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d1 = parseInt(m[1]), d2 = parseInt(m[2]);
    if (d1 > 12) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  }
  // Try native Date parse
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return '';
}

// ── Amount normalisation ──────────────────────────────────────
function _normaliseAmount(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  return Math.abs(parseFloat(cleaned) || 0);
}

// ── ML Category Classifier (local keyword-based fallback) ─────
function _mlClassify(description) {
  // Mirrors the Python CategoryClassifier keyword logic
  const d = (description || '').toLowerCase();
  const rules = [
    { cat: 'Food & Dining',       kws: ['food','restaurant','eat','cafe','coffee','pizza','burger','dining','grocery','supermarket','shoprite','market'] },
    { cat: 'Transport',           kws: ['uber','bolt','taxi','bus','fuel','petrol','transport','ride','fare','okada','transport'] },
    { cat: 'Shopping',            kws: ['shop','store','mall','purchase','buy','amazon','jumia','konga','aliexpress','clothing','fashion'] },
    { cat: 'Utilities',           kws: ['electric','nepa','dstv','water','internet','wifi','data','ikedc','ekedc','utility','bill'] },
    { cat: 'Healthcare',          kws: ['hospital','pharmacy','doctor','clinic','drug','health','medical','chemist'] },
    { cat: 'Entertainment',       kws: ['netflix','spotify','cinema','movie','game','ticket','event','concert','show'] },
    { cat: 'Education',           kws: ['school','tuition','book','course','training','university','college','lesson','tutorial'] },
    { cat: 'Housing & Rent',      kws: ['rent','landlord','house','apartment','accommodation','lodge','hostel'] },
    { cat: 'Savings & Investment',kws: ['savings','invest','piggybank','cowrywise','risevest','stash','transfer to savings'] },
    { cat: 'Personal Care',       kws: ['salon','barber','spa','beauty','cosmetic','makeup','haircut'] },
    { cat: 'Business',            kws: ['business','invoice','client','vendor','supplier','professional'] },
    { cat: 'Travel',              kws: ['flight','hotel','airbnb','trip','travel','airline','booking','hotel'] },
    { cat: 'Salary',              kws: ['salary','wage','payroll','income'] },
    { cat: 'Freelance',           kws: ['freelance','contract','gig','project fee','consulting'] },
  ];
  for (const { cat, kws } of rules) {
    if (kws.some(k => d.includes(k))) return cat;
  }
  return 'Other';
}

// ── Determine transaction type from row ───────────────────────
function _detectType(row, map, defaultType) {
  if (map.type && row[map.type]) {
    const t = row[map.type].toLowerCase();
    if (/credit|cr|income|deposit|received/i.test(t)) return 'income';
    if (/debit|dr|expense|withdrawal|payment/i.test(t)) return 'expense';
  }
  if (map.credit && map.debit) {
    const c = _normaliseAmount(row[map.credit]);
    const d = _normaliseAmount(row[map.debit]);
    if (c > 0 && d === 0) return 'income';
    if (d > 0 && c === 0) return 'expense';
  }
  return defaultType;
}

// ── Main processing ───────────────────────────────────────────
function _processCSVText(text) {
  const { headers, rows } = _parseCSV(text);
  if (rows.length === 0) { showToast('Could not parse CSV — is it comma-separated?'); return; }

  _csvHeaders = headers;
  _csvRows    = rows;
  _colMap     = _autoDetectColumns(headers);

  document.getElementById('csv-step-upload').classList.add('hidden');
  document.getElementById('csv-step-preview').classList.remove('hidden');

  _buildMappingBar();
  refreshCSVPreview();
}

function _buildMappingBar() {
  const bar = document.getElementById('csv-mapping-bar');
  if (!bar) return;

  const fields = [
    { key: 'date',        label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'amount',      label: 'Amount' },
    { key: 'credit',      label: 'Credit col' },
    { key: 'debit',       label: 'Debit col' },
    { key: 'type',        label: 'Type col' },
  ];

  bar.innerHTML = fields.map(f => `
    <div class="csv-map-chip">
      <label>${f.label}:</label>
      <select onchange="_updateColMap('${f.key}', this.value); refreshCSVPreview()">
        <option value="">(none)</option>
        ${_csvHeaders.map(h =>
          `<option value="${escHtml(h)}" ${_colMap[f.key] === h ? 'selected' : ''}>${escHtml(h)}</option>`
        ).join('')}
      </select>
    </div>
  `).join('');
}

function _updateColMap(key, value) {
  _colMap[key] = value;
}

function refreshCSVPreview() {
  const defaultType = document.getElementById('csv-default-type')?.value || 'expense';
  const tbody       = document.getElementById('csv-preview-body');
  const importBtn   = document.getElementById('csv-import-btn');
  const countEl     = document.getElementById('csv-preview-count');
  const importCount = document.getElementById('csv-import-count');

  if (!tbody) return;

  _parsedTxs = _csvRows.slice(0, 200).map((row, i) => {
    const dateRaw = _colMap.date ? row[_colMap.date] : '';
    const date    = _normaliseDate(dateRaw);
    const desc    = _colMap.description ? row[_colMap.description] : Object.values(row)[1] || '';

    // Amount: prefer credit/debit split, else single amount col
    let amount = 0;
    if (_colMap.credit || _colMap.debit) {
      const c = _colMap.credit ? _normaliseAmount(row[_colMap.credit]) : 0;
      const d = _colMap.debit  ? _normaliseAmount(row[_colMap.debit])  : 0;
      amount  = c > 0 ? c : d;
    } else if (_colMap.amount) {
      amount = _normaliseAmount(row[_colMap.amount]);
    }

    const type     = _detectType(row, _colMap, defaultType);
    const category = type === 'expense' ? _mlClassify(desc) : 'Salary';
    const valid    = date !== '' && amount > 0;

    return { _idx: i, date, description: desc, amount, type, category, valid, checked: valid };
  });

  // Build table rows
  const allCats = [...CATEGORIES.expense, ...CATEGORIES.income].map(c => c.name);
  tbody.innerHTML = '';
  _parsedTxs.forEach((tx, i) => {
    const tr = document.createElement('tr');
    if (!tx.valid) tr.classList.add('csv-row-skip');
    tr.id = `csv-tr-${i}`;
    tr.innerHTML = `
      <td><input type="checkbox" ${tx.checked && tx.valid ? 'checked' : ''} ${!tx.valid ? 'disabled' : ''}
           onchange="_csvRowToggle(${i}, this.checked)"/></td>
      <td>${escHtml(tx.date) || '<span style="color:var(--red)">invalid</span>'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(tx.description)}">${escHtml(tx.description)}</td>
      <td style="font-weight:600">${tx.amount > 0 ? (DB.getSettings().currency||'₦') + tx.amount.toLocaleString() : '<span style="color:var(--red)">—</span>'}</td>
      <td><span class="csv-type-badge ${tx.type}">${tx.type}</span></td>
      <td>
        <select class="csv-cat-select" onchange="_csvSetCat(${i}, this.value)" ${!tx.valid ? 'disabled' : ''}>
          ${allCats.map(c => `<option value="${escHtml(c)}" ${tx.category === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('')}
        </select>
        ${tx.type === 'expense' ? '<span class="csv-ml-badge">ML</span>' : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });

  const validCount = _parsedTxs.filter(t => t.valid && t.checked).length;
  if (countEl)     countEl.textContent = `${_parsedTxs.length} rows found · ${validCount} ready to import`;
  if (importCount) importCount.textContent = validCount;
  if (importBtn) {
    if (validCount > 0) importBtn.classList.remove('hidden');
    else importBtn.classList.add('hidden');
  }

  // Sync check-all state
  const allChecked = _parsedTxs.filter(t => t.valid).every(t => t.checked);
  const chkAll = document.getElementById('csv-check-all');
  if (chkAll) chkAll.checked = allChecked;
}

function _csvRowToggle(i, checked) {
  if (_parsedTxs[i]) _parsedTxs[i].checked = checked;
  // Update import count
  const validCount = _parsedTxs.filter(t => t.valid && t.checked).length;
  const countEl    = document.getElementById('csv-import-count');
  if (countEl) countEl.textContent = validCount;
  const importBtn = document.getElementById('csv-import-btn');
  if (importBtn) {
    if (validCount > 0) importBtn.classList.remove('hidden');
    else importBtn.classList.add('hidden');
  }
}

function _csvSetCat(i, cat) {
  if (_parsedTxs[i]) _parsedTxs[i].category = cat;
}

function csvToggleAll(checked) {
  _parsedTxs.forEach((tx, i) => {
    if (tx.valid) {
      tx.checked = checked;
      const cb = document.querySelector(`#csv-tr-${i} input[type=checkbox]`);
      if (cb) cb.checked = checked;
    }
  });
  const validCount = _parsedTxs.filter(t => t.valid && t.checked).length;
  const countEl    = document.getElementById('csv-import-count');
  if (countEl) countEl.textContent = validCount;
  const importBtn  = document.getElementById('csv-import-btn');
  if (importBtn) {
    if (validCount > 0) importBtn.classList.remove('hidden');
    else importBtn.classList.add('hidden');
  }
}

// ── Import confirmed rows ─────────────────────────────────────
async function confirmCSVImport() {
  const toImport = _parsedTxs.filter(t => t.valid && t.checked);
  if (toImport.length === 0) { showToast('Select at least one row to import.'); return; }

  const btn = document.getElementById('csv-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }

  let imported = 0;
  let failed   = 0;

  for (const tx of toImport) {
    try {
      await DB.addTransaction({
        date:        tx.date,
        description: tx.description,
        amount:      tx.amount,
        type:        tx.type,
        category:    tx.category,
        note:        'Imported via CSV',
      });
      imported++;
    } catch (_) {
      failed++;
    }
  }

  closeCSVImport();
  renderAllTransactions();
  renderPage('dashboard');

  const type = failed > 0 ? 'info' : 'success';
  const msg  = failed > 0
    ? `Imported ${imported} transaction${imported !== 1 ? 's' : ''} — ${failed} could not be read`
    : `${imported} transaction${imported !== 1 ? 's' : ''} imported successfully`;
  showToast(msg, type, 3500);
}
