// ============================================================
// ANALYTICS MODULE
// ============================================================

// ---- Spending Calendar ----------------------------------------

let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth(); // 0-indexed

function renderSpendingCalendar() {
  const txs      = DB.getTransactions();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  const year  = _calYear;
  const month = _calMonth;

  // Month label
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const titleEl = document.getElementById('cal-title');
  const subEl   = document.getElementById('cal-subtitle');
  if (titleEl) titleEl.textContent = 'Spending Calendar';
  if (subEl)   subEl.textContent   = monthName;

  // Build daily totals for this month
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dayTotals = {}; // { 'YYYY-MM-DD': { total, txs[] } }

  txs.filter(t => t.type === 'expense' && t.date.startsWith(monthStr))
     .forEach(t => {
       if (!dayTotals[t.date]) dayTotals[t.date] = { total: 0, txs: [] };
       dayTotals[t.date].total += t.amount;
       dayTotals[t.date].txs.push(t);
     });

  // Determine thresholds for colour bands
  const dailyAmounts = Object.values(dayTotals).map(d => d.total).filter(v => v > 0);
  dailyAmounts.sort((a, b) => a - b);
  const maxAmount = dailyAmounts[dailyAmounts.length - 1] || 1;
  const lowThresh  = maxAmount * 0.33;
  const midThresh  = maxAmount * 0.66;

  function intensityClass(total) {
    if (!total)           return 'no-spend';
    if (total <= lowThresh)  return 'low-spend';
    if (total <= midThresh)  return 'mid-spend';
    return 'high-spend';
  }

  // Build the grid
  const grid = document.getElementById('cal-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const firstDay    = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();
  const todayStr    = today.toISOString().split('T')[0];

  // Blank cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-cell empty';
    grid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const data    = dayTotals[dateStr];
    const cell    = document.createElement('div');

    cell.className = `cal-cell ${intensityClass(data?.total)}`;
    if (dateStr === todayStr) cell.classList.add('cal-today');

    cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      ${data ? `<span class="cal-day-amt">${curr}${Math.round(data.total).toLocaleString()}</span>` : ''}
    `;

    if (data) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => openCalDetail(dateStr, data.txs, curr));
    }

    grid.appendChild(cell);
  }

  // Close detail panel on new render
  closeCalDetail();
}

function calShift(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0;  _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  renderSpendingCalendar();
}

function openCalDetail(dateStr, txs, curr) {
  const panel   = document.getElementById('cal-detail');
  const dateEl  = document.getElementById('cal-detail-date');
  const listEl  = document.getElementById('cal-detail-list');
  if (!panel) return;

  const label = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  if (dateEl) dateEl.textContent = label;

  const total = txs.reduce((s, t) => s + t.amount, 0);

  listEl.innerHTML = `
    <div class="cal-detail-total">Total: <strong>${curr}${Math.round(total).toLocaleString()}</strong></div>
    ${txs.sort((a, b) => b.amount - a.amount).map(t => `
      <div class="cal-detail-tx">
        <span class="cal-detail-icon">${getCategoryIcon(t.category)}</span>
        <span class="cal-detail-desc">${t.description}</span>
        <span class="cal-detail-cat">${t.category}</span>
        <span class="cal-detail-amt">${curr}${t.amount.toLocaleString()}</span>
      </div>
    `).join('')}
  `;

  panel.classList.remove('hidden');
}

function closeCalDetail() {
  document.getElementById('cal-detail')?.classList.add('hidden');
}

function renderTopCategories() {
    const container = document.getElementById('top-categories');
    if (!container) return;

    const txs = DB.getTransactions();
    const now = new Date();
    const settings = DB.getSettings();
    const curr = settings.currency || '₦';

    const monthExpenses = txs.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const byCategory = {};
    monthExpenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

    const sorted = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 6);
    const max    = sorted[0]?.[1] || 1;

    container.innerHTML = '';

    if (sorted.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:2rem 0">No data for this month</p>';
      return;
    }

    sorted.forEach(([cat, amount]) => {
      const pct = Math.round((amount / max) * 100);
      const color = getCategoryColor(cat);
      const row = document.createElement('div');
      row.className = 'top-cat-item';
      row.innerHTML = `
        <div class="top-cat-name">${getCategoryIcon(cat)} ${cat.split(' ')[0]}</div>
        <div class="top-cat-bar"><div class="top-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="top-cat-val">${curr}${amount.toLocaleString()}</div>
      `;
      container.appendChild(row);
    });
  }
