// ============================================================
// BUDGETS MODULE
// ============================================================

function openBudgetModal(id = null) {
  // Reset fields
  document.getElementById('budget-edit-id').value = id || '';
  document.getElementById('budget-limit').value = '';

  // Default to current month
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('budget-month').value = monthStr;

  // Populate category dropdown
  const sel = document.getElementById('budget-category');
  sel.innerHTML = '';
  CATEGORIES.expense.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.name;
    opt.textContent = `${c.icon}  ${c.name}`;
    sel.appendChild(opt);
  });

  // If editing, pre-fill existing values
  if (id) {
    const budget = DB.getBudgets().find(b => b.id === id);
    if (budget) {
      document.getElementById('budget-category').value = budget.category;
      document.getElementById('budget-limit').value    = budget.limit;
      document.getElementById('budget-month').value    = budget.month;
    }
  }

  // Show the modal — remove hidden class
  document.getElementById('budget-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeModalOnOverlay(event, id) {
  // Only close when clicking directly on the dark overlay backdrop,
  // not when clicking inside the white modal box
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

async function saveBudget() {
  const category = document.getElementById('budget-category').value;
  const limit    = parseFloat(document.getElementById('budget-limit').value);
  const month    = document.getElementById('budget-month').value;

  if (!category)            { showToast('Please select a category.'); return; }
  if (!limit || limit <= 0) { showToast('Please enter a valid limit amount.'); return; }
  if (!month)               { showToast('Please select a month.'); return; }

  const saveBtn = document.querySelector('#budget-modal .btn-primary');
  if (saveBtn) saveBtn.disabled = true;

  try {
    await DB.addBudget({ category, limit, month });
    showToast('Budget saved.', 'success');
    closeModal('budget-modal');
    renderBudgets();
    renderDashboardBudgets();
  } catch (e) {
    showToast('Could not save budget. Please try again.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function deleteBudget(id) {
  if (!confirm('Delete this budget? This cannot be undone.')) return;
  try {
    await DB.deleteBudget(id);
    showToast('Budget removed.');
    renderBudgets();
    renderDashboardBudgets();
  } catch (e) {
    showToast('Could not remove budget.', 'error');
  }
}

function getSpentForBudget(category, month) {
  return DB.getTransactions()
    .filter(t => t.type === 'expense' && t.category === category && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amount, 0);
}

function renderBudgetCard(b) {
  const settings  = DB.getSettings();
  const curr      = settings.currency || '₦';
  const spent     = getSpentForBudget(b.category, b.month);
  const pct       = Math.min(Math.round((spent / b.limit) * 100), 100);
  const status    = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : 'safe';
  const remaining = b.limit - spent;

  const div = document.createElement('div');
  div.className = 'budget-card';
  div.innerHTML = `
    <div class="budget-card-header">
      <div>
        <div class="budget-cat">${getCategoryIcon(b.category)} ${escHtml(b.category)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${b.month}</div>
      </div>
      <div class="budget-actions">
        <button class="budget-del" onclick="deleteBudget('${b.id}')" title="Delete budget">&#x2715;</button>
      </div>
    </div>
    <div class="budget-amounts">
      <span class="budget-spent">${curr}${spent.toLocaleString()} spent</span>
      <span class="budget-limit-text">of ${curr}${b.limit.toLocaleString()}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill ${status}" style="width:${pct}%"></div>
    </div>
    <div class="budget-pct ${status}">
      ${pct}% used &middot;
      ${remaining >= 0
        ? `${curr}${remaining.toLocaleString()} remaining`
        : `${curr}${Math.abs(remaining).toLocaleString()} over budget`
      }
    </div>
  `;
  return div;
}

function renderBudgets() {
  const grid  = document.getElementById('budgets-list');
  const empty = document.getElementById('budgets-empty');
  const budgets = DB.getBudgets();
  grid.innerHTML = '';

  if (budgets.length === 0) {
    grid.style.display = 'none';
    empty.classList.remove('hidden');
  } else {
    grid.style.display = '';
    empty.classList.add('hidden');
    budgets.forEach(b => grid.appendChild(renderBudgetCard(b)));
  }
}

// ---- Smart Budget Suggestions ----

let _suggestionsVisible = false;
let _currentSuggestions = [];  // [{ category, suggested, basedOn, monthsUsed }]

function toggleBudgetSuggestions() {
  const panel = document.getElementById('budget-suggestions-panel');
  if (!panel) return;
  _suggestionsVisible = !_suggestionsVisible;
  if (_suggestionsVisible) {
    panel.classList.remove('hidden');
    _computeAndRenderSuggestions();
  } else {
    panel.classList.add('hidden');
  }
}

function _computeAndRenderSuggestions() {
  const txs      = DB.getTransactions();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const now      = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const listEl  = document.getElementById('bsugg-list');
  const emptyEl = document.getElementById('bsugg-empty');
  const subEl   = document.getElementById('bsugg-sub');

  // Build monthly totals from expense transactions (exclude current month)
  const expenses  = txs.filter(t => t.type === 'expense');
  const monthly   = {};
  expenses.forEach(t => {
    const ym  = t.date.slice(0, 7);
    if (ym >= curMonth) return;           // skip current month
    const cat = t.category || 'Other';
    if (!monthly[ym]) monthly[ym] = {};
    monthly[ym][cat] = (monthly[ym][cat] || 0) + t.amount;
  });

  const pastMonths = Object.keys(monthly).sort().slice(-6);

  if (pastMonths.length === 0) {
    listEl.innerHTML  = '';
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    if (subEl) subEl.textContent = 'Need at least 1 completed month of expenses';
    return;
  }

  listEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');
  if (subEl) subEl.textContent = `Based on ${pastMonths.length} month${pastMonths.length > 1 ? 's' : ''} of spending history`;

  // Weighted average + 10% buffer per category
  const allCats = new Set(pastMonths.flatMap(ym => Object.keys(monthly[ym] || {})));
  const BUFFER  = 1.10;

  _currentSuggestions = [];
  allCats.forEach(cat => {
    const hist   = pastMonths.map(ym => (monthly[ym] || {})[cat] || 0);
    const n      = hist.length;
    let wSum = 0, total = 0;
    hist.forEach((v, i) => { const w = i + 1; total += v * w; wSum += w; });
    const avg       = wSum > 0 ? total / wSum : 0;
    const suggested = Math.ceil(avg * BUFFER / 100) * 100;  // round up to nearest 100
    if (suggested > 0) {
      _currentSuggestions.push({ category: cat, suggested, basedOn: avg, monthsUsed: n });
    }
  });

  // Sort by suggested amount descending
  _currentSuggestions.sort((a, b) => b.suggested - a.suggested);

  // Track which categories already have a budget this month
  const existingBudgets = DB.getBudgets().filter(b => b.month === curMonth);
  const existingCats    = new Set(existingBudgets.map(b => b.category));

  listEl.innerHTML = '';
  _currentSuggestions.forEach((s, idx) => {
    const alreadyApplied = existingCats.has(s.category);
    const row = document.createElement('div');
    row.className = 'bsugg-row' + (alreadyApplied ? ' applied' : '');
    row.id        = `bsugg-row-${idx}`;
    row.innerHTML = `
      <div class="bsugg-row-info">
        <div class="bsugg-cat-name">${getCategoryIcon(s.category)} ${escHtml(s.category)}</div>
        <div class="bsugg-cat-meta">Avg spend: ${curr}${Math.round(s.basedOn).toLocaleString()} · ${s.monthsUsed} month${s.monthsUsed > 1 ? 's' : ''} of data · +10% buffer applied</div>
      </div>
      <div class="bsugg-amount-col">
        <div class="bsugg-suggested-amt">${curr}${s.suggested.toLocaleString()}</div>
        <div class="bsugg-based-on">suggested limit</div>
      </div>
      <button class="bsugg-apply-btn${alreadyApplied ? ' applied' : ''}"
              id="bsugg-btn-${idx}"
              onclick="applySuggestion(${idx})"
              ${alreadyApplied ? 'disabled' : ''}>
        ${alreadyApplied ? 'Applied' : 'Apply'}
      </button>
    `;
    listEl.appendChild(row);
  });

  // Update Apply All button state
  const applyAllBtn = document.getElementById('bsugg-apply-all-btn');
  const allApplied  = _currentSuggestions.every(s => existingCats.has(s.category));
  if (applyAllBtn) applyAllBtn.disabled = allApplied;
}

async function applySuggestion(idx) {
  const s   = _currentSuggestions[idx];
  if (!s) return;

  const now      = new Date();
  const month    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const btn      = document.getElementById(`bsugg-btn-${idx}`);
  const row      = document.getElementById(`bsugg-row-${idx}`);

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    await DB.addBudget({ category: s.category, limit: s.suggested, month });
    if (btn) { btn.textContent = 'Applied'; btn.classList.add('applied'); }
    if (row) row.classList.add('applied');
    showToast(`${s.category} budget set to ${DB.getSettings().currency || '₦'}${s.suggested.toLocaleString()}.`, 'success');
    renderBudgets();
    renderDashboardBudgets();
  } catch (e) {
    showToast('Could not apply suggestion.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Apply'; }
  }
}

async function applyAllSuggestions() {
  const now   = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const existingCats = new Set(DB.getBudgets().filter(b => b.month === month).map(b => b.category));
  const toApply = _currentSuggestions.filter(s => !existingCats.has(s.category));

  if (toApply.length === 0) { showToast('All suggestions have already been applied.'); return; }

  const applyAllBtn = document.getElementById('bsugg-apply-all-btn');
  if (applyAllBtn) { applyAllBtn.disabled = true; applyAllBtn.textContent = 'Applying…'; }

  let applied = 0;
  for (const s of toApply) {
    try {
      await DB.addBudget({ category: s.category, limit: s.suggested, month });
      applied++;
    } catch (_) { /* skip any that fail */ }
  }

  showToast(`${applied} budget${applied !== 1 ? 's' : ''} applied successfully.`, 'success');
  renderBudgets();
  renderDashboardBudgets();
  // Refresh the panel to show applied state
  _computeAndRenderSuggestions();
  if (applyAllBtn) { applyAllBtn.disabled = false; applyAllBtn.textContent = 'Apply All'; }
}

// ---- Budget Alerts (dashboard warning banners) ----

function renderBudgetAlerts() {
  const container = document.getElementById('budget-alerts');
  if (!container) return;

  const now      = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budgets  = DB.getBudgets().filter(b => b.month === monthStr);
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  // Collect budgets at ≥80% usage
  const alerts = budgets
    .map(b => {
      const spent = getSpentForBudget(b.category, b.month);
      const pct   = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      return { ...b, spent, pct };
    })
    .filter(b => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  if (alerts.length === 0) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  container.innerHTML = alerts.map(b => {
    const isOver  = b.pct >= 100;
    const cls     = isOver ? 'danger' : 'warn';
    const icon    = isOver ? '🚨' : '⚠️';
    const overAmt = b.spent - b.limit;
    const msg     = isOver
      ? `<strong>${escHtml(b.category)}</strong> is <strong>${curr}${overAmt.toLocaleString()} over budget</strong> (${b.pct}% used)`
      : `<strong>${escHtml(b.category)}</strong> is at <strong>${b.pct}%</strong> of its ${curr}${b.limit.toLocaleString()} budget`;

    return `
      <div class="budget-alert-item ${cls}">
        <span class="budget-alert-icon">${icon}</span>
        <span class="budget-alert-msg">${msg}</span>
        <button class="budget-alert-action" onclick="navigate('budgets')">Review →</button>
      </div>
    `;
  }).join('');
}

function renderDashboardBudgets() {
  const container = document.getElementById('dashboard-budget-list');
  if (!container) return;
  container.innerHTML = '';

  const now      = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budgets  = DB.getBudgets().filter(b => b.month === monthStr).slice(0, 4);
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  if (budgets.length === 0) {
    container.innerHTML = `
      <p style="color:var(--text-muted);font-size:14px;text-align:center;padding:1rem">
        No budgets set for this month.
        <button class="link-btn" onclick="navigate('budgets')">Set one →</button>
      </p>`;
    return;
  }

  budgets.forEach(b => {
    const spent  = getSpentForBudget(b.category, b.month);
    const pct    = Math.min(Math.round((spent / b.limit) * 100), 100);
    const status = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : 'safe';

    const row = document.createElement('div');
    row.style.cssText = 'margin-bottom:14px';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:5px">
        <span style="font-size:13px;font-weight:500">${getCategoryIcon(b.category)} ${escHtml(b.category)}</span>
        <span style="font-size:13px;color:var(--text-muted)">${curr}${spent.toLocaleString()} / ${curr}${b.limit.toLocaleString()}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${status}" style="width:${pct}%"></div>
      </div>
    `;
    container.appendChild(row);
  });
}
