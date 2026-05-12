// ============================================================
// TRANSACTIONS MODULE — BudgetWise
// ============================================================

let currentType = 'expense';

// ---- Open / Close Modal ----

function openAddModal(id = null) {
  document.getElementById('edit-id').value        = '';
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-amount').value       = '';
  document.getElementById('tx-note').value         = '';
  document.getElementById('tx-date').value         = new Date().toISOString().split('T')[0];
  document.getElementById('modal-title').textContent = 'Add Transaction';

  // Reset recurrence fields
  const toggle = document.getElementById('tx-recurring-toggle');
  if (toggle) toggle.checked = false;
  toggleRecurrenceFields();
  const recSel = document.getElementById('tx-recurrence');
  if (recSel) recSel.value = 'monthly';
  const recEnd = document.getElementById('tx-recurrence-end');
  if (recEnd) recEnd.value = '';

  if (id) {
    const tx = DB.getTransactions().find(t => t.id === id);
    if (tx) {
      document.getElementById('modal-title').textContent = 'Edit Transaction';
      document.getElementById('edit-id').value           = tx.id;
      document.getElementById('tx-description').value    = tx.description;
      document.getElementById('tx-amount').value         = tx.amount;
      document.getElementById('tx-date').value           = tx.date;
      document.getElementById('tx-note').value           = tx.note || '';
      applyTypeToggle(tx.type);
      populateCategorySelect(tx.type, tx.category);
      // Restore recurrence if editing a recurring tx
      if (tx.recurrence && toggle) {
        toggle.checked = true;
        toggleRecurrenceFields();
        if (recSel) recSel.value = tx.recurrence;
        if (recEnd) recEnd.value = tx.recurrence_end || '';
      }
    }
  } else {
    applyTypeToggle('expense');
    populateCategorySelect('expense');
  }

  document.getElementById('add-modal').classList.remove('hidden');
}

function toggleRecurrenceFields() {
  const checked = document.getElementById('tx-recurring-toggle')?.checked;
  const fields  = document.getElementById('recurrence-fields');
  if (fields) fields.classList.toggle('hidden', !checked);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeModalOnOverlay(event, id) {
  if (event.target === document.getElementById(id)) closeModal(id);
}

// ---- Toggle (Expense / Income) ----

function setType(type) {
  currentType = type;
  applyTypeToggle(type);
  populateCategorySelect(type, null);
}

function applyTypeToggle(type) {
  currentType = type;
  document.getElementById('btn-expense').classList.toggle('active', type === 'expense');
  document.getElementById('btn-income').classList.toggle('active', type === 'income');
}

function populateCategorySelect(type, selected = null) {
  const sel = document.getElementById('tx-category');
  sel.innerHTML = '';
  CATEGORIES[type].forEach(c => {
    const opt       = document.createElement('option');
    opt.value       = c.name;
    opt.textContent = `${c.icon}  ${c.name}`;
    if (selected && c.name === selected) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ---- Save Transaction ----

async function saveTransaction() {
  const desc   = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;
  const cat    = document.getElementById('tx-category').value;
  const note   = document.getElementById('tx-note').value.trim();
  const editId = document.getElementById('edit-id').value;

  if (!desc)                  { showToast('Please enter a description.'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount.'); return; }
  if (!date)                  { showToast('Please select a date.'); return; }

  const isRecurring  = document.getElementById('tx-recurring-toggle')?.checked;
  const recurrence   = isRecurring ? document.getElementById('tx-recurrence')?.value : null;
  const recurrenceEnd = isRecurring ? (document.getElementById('tx-recurrence-end')?.value || null) : null;

  const tx = { type: currentType, description: desc, amount, date, category: cat, note,
               recurrence: recurrence || null, recurrence_end: recurrenceEnd || null };

  // Disable save button to prevent double-submit
  const saveBtn = document.querySelector('#add-modal .btn-primary');
  if (saveBtn) saveBtn.disabled = true;

  try {
    if (editId) {
      await DB.updateTransaction(editId, tx);
      showToast('Transaction updated.', 'success');
    } else {
      await DB.addTransaction(tx);
      showToast('Transaction saved.', 'success');
    }
    closeModal('add-modal');
    refreshAll();
  } catch (e) {
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ---- Delete Transaction ----

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  try {
    await DB.deleteTransaction(id);
    showToast('Transaction removed.');
    refreshAll();
  } catch (e) {
    showToast('Could not delete transaction.', 'error');
  }
}

// ---- Rendering — Transaction Item ----

function renderTransactionItem(tx, showActions = true) {
  const settings  = DB.getSettings();
  const curr      = settings.currency || '₦';
  const color     = getCategoryColor(tx.category);
  const icon      = getCategoryIcon(tx.category);
  const dateStr   = new Date(tx.date + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const sign = tx.type === 'income' ? '+' : '-';

  // Recurrence badge label
  const recurrenceLabels = { daily:'Daily', weekly:'Weekly', monthly:'Monthly', yearly:'Yearly' };
  const recBadge = tx.recurrence
    ? `<span class="tx-recurrence-badge">
         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
           <path d="M3 12a9 9 0 009 9 9 9 0 006.9-3.2"/><path d="M21 12a9 9 0 00-9-9 9 9 0 00-6.9 3.2"/>
           <polyline points="16 3 21 3 21 8"/><polyline points="8 21 3 21 3 16"/>
         </svg>
         ${recurrenceLabels[tx.recurrence] || tx.recurrence}
       </span>`
    : '';

  const nextDueText = tx.recurrence && tx.next_due
    ? ` · Next: ${new Date(tx.next_due + 'T12:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`
    : '';

  const div     = document.createElement('div');
  div.className = 'tx-item';
  div.innerHTML = `
    <div class="tx-badge" style="background:${color}22;color:${color}" title="${escHtml(tx.category)}">${getCategoryIconSVG(tx.category)}</div>
    <div class="tx-info">
      <div class="tx-desc">${escHtml(tx.description)} ${recBadge}</div>
      <div class="tx-meta">${escHtml(tx.category)} · ${dateStr}${nextDueText}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount ${tx.type}">${sign}${curr}${tx.amount.toLocaleString()}</div>
      <div class="tx-dot ${tx.type}"></div>
      ${showActions ? `
        <div class="tx-actions">
          ${tx.recurrence ? `<button class="tx-stop-recur" onclick="stopRecurrence('${tx.id}')" title="Stop recurring">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>` : ''}
          <button class="tx-edit"   onclick="openAddModal('${tx.id}')" title="Edit">&#x270F;</button>
          <button class="tx-delete" onclick="deleteTransaction('${tx.id}')" title="Delete">&#x2715;</button>
        </div>` : ''}
    </div>
  `;
  return div;
}

function renderRecentTransactions() {
  const list = document.getElementById('recent-list');
  if (!list) return;
  list.innerHTML = '';
  const txs = DB.getTransactions().slice(0, 5);
  if (txs.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p class="empty-state-sub">No transactions yet — add one to get started.</p></div>';
    return;
  }
  txs.forEach(tx => list.appendChild(renderTransactionItem(tx, false)));
}

function renderAllTransactions() {
  filterTransactions();
}

// ── Advanced filter panel toggle ─────────────────────────────
let _advancedOpen = false;

function toggleAdvancedFilters() {
  _advancedOpen = !_advancedOpen;
  const panel  = document.getElementById('filter-advanced-panel');
  const btn    = document.getElementById('filter-advanced-toggle');
  if (panel) panel.classList.toggle('hidden', !_advancedOpen);
  if (btn)   btn.classList.toggle('active', _advancedOpen);
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) { input.value = ''; filterTransactions(); }
}

function clearAllFilters() {
  const ids = ['search-input','filter-type','filter-category',
                'filter-date-from','filter-date-to',
                'filter-amount-min','filter-amount-max'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.value = 'all';
    else el.value = '';
  });
  const sortEl = document.getElementById('filter-sort');
  if (sortEl) sortEl.value = 'date-desc';
  filterTransactions();
}

// ── Main filter + sort function ───────────────────────────────
function filterTransactions() {
  const search    = (document.getElementById('search-input')?.value    || '').toLowerCase().trim();
  const typeF     =  document.getElementById('filter-type')?.value     || 'all';
  const catF      =  document.getElementById('filter-category')?.value || 'all';
  const dateFrom  =  document.getElementById('filter-date-from')?.value  || '';
  const dateTo    =  document.getElementById('filter-date-to')?.value    || '';
  const amtMin    =  parseFloat(document.getElementById('filter-amount-min')?.value) || 0;
  const amtMax    =  parseFloat(document.getElementById('filter-amount-max')?.value) || Infinity;
  const sort      =  document.getElementById('filter-sort')?.value     || 'date-desc';

  // Show/hide search clear button
  const clearBtn  = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.toggle('hidden', !search);

  let txs = DB.getTransactions();
  const total = txs.length;

  // Apply filters
  if (typeF    !== 'all') txs = txs.filter(t => t.type     === typeF);
  if (catF     !== 'all') txs = txs.filter(t => t.category === catF);
  if (dateFrom)           txs = txs.filter(t => t.date >= dateFrom);
  if (dateTo)             txs = txs.filter(t => t.date <= dateTo);
  if (amtMin  > 0)        txs = txs.filter(t => t.amount >= amtMin);
  if (amtMax  < Infinity) txs = txs.filter(t => t.amount <= amtMax);
  if (search)             txs = txs.filter(t =>
    (t.description || '').toLowerCase().includes(search) ||
    (t.category    || '').toLowerCase().includes(search) ||
    (t.note        || '').toLowerCase().includes(search)
  );

  // Sort
  txs = [...txs].sort((a, b) => {
    if (sort === 'date-desc')   return b.date.localeCompare(a.date) || b.id - a.id;
    if (sort === 'date-asc')    return a.date.localeCompare(b.date) || a.id - b.id;
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  // Render list
  const list  = document.getElementById('transactions-list');
  const empty = document.getElementById('transactions-empty');
  if (!list) return;
  list.innerHTML = '';

  if (txs.length === 0) {
    list.style.display = 'none';
    if (empty) empty.classList.remove('hidden');
  } else {
    list.style.display = '';
    if (empty) empty.classList.add('hidden');
    txs.forEach(tx => list.appendChild(renderTransactionItem(tx, true)));
  }

  // Update results count + chips
  _updateFilterUI({ search, typeF, catF, dateFrom, dateTo, amtMin, amtMax, sort },
                  txs.length, total);
}

// ── Active filter chips & results count ───────────────────────
function _updateFilterUI(f, shown, total) {
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const chipsEl  = document.getElementById('filter-chips');
  const countEl  = document.getElementById('filter-results-count');
  const clearBtn = document.getElementById('filter-clear-all');
  const advBadge = document.getElementById('filter-adv-badge');

  if (!chipsEl) return;
  chipsEl.innerHTML = '';

  const chips = [];

  if (f.search)         chips.push({ label: `"${f.search}"`,                    clear: 'search-input' });
  if (f.typeF !== 'all') chips.push({ label: f.typeF === 'income' ? '↑ Income' : '↓ Expense', clear: 'filter-type' });
  if (f.catF  !== 'all') chips.push({ label: f.catF,                            clear: 'filter-category' });
  if (f.dateFrom)        chips.push({ label: `From ${f.dateFrom}`,               clear: 'filter-date-from' });
  if (f.dateTo)          chips.push({ label: `To ${f.dateTo}`,                   clear: 'filter-date-to' });
  if (f.amtMin > 0)      chips.push({ label: `Min ${curr}${f.amtMin.toLocaleString()}`, clear: 'filter-amount-min' });
  if (f.amtMax < Infinity) chips.push({ label: `Max ${curr}${f.amtMax.toLocaleString()}`, clear: 'filter-amount-max' });

  chips.forEach(chip => {
    const el = document.createElement('span');
    el.className = 'filter-chip';
    el.innerHTML = `${escHtml(chip.label)}
      <button class="filter-chip-remove" onclick="_removeChip('${chip.clear}')" title="Remove filter">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;
    chipsEl.appendChild(el);
  });

  // Results count
  if (countEl) {
    if (shown < total) {
      countEl.textContent = `Showing ${shown} of ${total} transaction${total !== 1 ? 's' : ''}`;
    } else {
      countEl.textContent = `${total} transaction${total !== 1 ? 's' : ''}`;
    }
  }

  // Advanced filter badge
  const advCount = [f.dateFrom, f.dateTo, f.amtMin > 0, f.amtMax < Infinity].filter(Boolean).length;
  if (advBadge) {
    advBadge.textContent = advCount;
    advBadge.classList.toggle('hidden', advCount === 0);
  }

  // Clear-all button
  const hasAny = chips.length > 0;
  if (clearBtn) clearBtn.classList.toggle('hidden', !hasAny);
}

function _removeChip(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  if (el.tagName === 'SELECT') el.value = 'all';
  else el.value = '';
  filterTransactions();
}

function populateFilterCategories() {
  const sel = document.getElementById('filter-category');
  if (!sel) return;
  sel.innerHTML = '<option value="all">All Categories</option>';
  const all = [...CATEGORIES.expense, ...CATEGORIES.income];
  all.forEach(c => {
    const opt       = document.createElement('option');
    opt.value       = c.name;
    opt.textContent = `${c.icon} ${c.name}`;
    sel.appendChild(opt);
  });
}

// ---- Dashboard — Category Spending Grid ----

function renderDashCategoriesGrid() {
  const grid = document.getElementById('dash-categories-grid');
  if (!grid) return;

  const txs      = DB.getTransactions();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const now      = new Date();

  // Current month expenses only
  const monthExpenses = txs.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense'
      && d.getFullYear() === now.getFullYear()
      && d.getMonth()    === now.getMonth();
  });

  const byCategory = {};
  monthExpenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  grid.innerHTML = '';

  if (sorted.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:13px;padding:1.2rem 0">No spending this month</div>';
    return;
  }

  sorted.forEach(([cat, amt]) => {
    const color = getCategoryColor(cat);
    const item  = document.createElement('div');
    item.className = 'cat-grid-item';
    item.innerHTML = `
      <div class="cat-grid-icon" style="background:${color}22;color:${color}">${getCategoryIconSVG(cat)}</div>
      <div class="cat-grid-name">${escHtml(cat.split(' ')[0])}</div>
      <div class="cat-grid-amt">${curr}${amt.toLocaleString()}</div>
    `;
    grid.appendChild(item);
  });
}

// ---- Summary Calculations ----

function getMonthlyTotals(txs, year, month) {
  const filtered = txs.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
  const income  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function updateSummaryCards() {
  const txs      = DB.getTransactions();
  const now      = new Date();
  const totals   = getMonthlyTotals(txs, now.getFullYear(), now.getMonth());
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const rate     = totals.income > 0
    ? Math.round(((totals.income - totals.expense) / totals.income) * 100)
    : 0;

  // Net balance includes any opening/starting balance the user configured
  const openingBalance = Number(settings.openingBalance) || 0;
  const availableBalance = openingBalance + totals.balance;

  // Core summary
  setTextSafe('total-income',   curr + totals.income.toLocaleString());
  setTextSafe('total-expenses', curr + totals.expense.toLocaleString());
  setTextSafe('net-balance',    curr + availableBalance.toLocaleString());
  setTextSafe('savings-rate',   rate + '%');

  // Budget progress (uses budgets for the current month)
  const monthStr   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budgets    = (DB.getBudgets() || []).filter(b => b.month === monthStr);
  const totalLimit = budgets.reduce((s, b) => s + (Number(b.limit) || 0), 0);
  const pct        = totalLimit > 0 ? Math.min(Math.round((totals.expense / totalLimit) * 100), 100) : 0;
  const rem        = Math.max(totalLimit - totals.expense, 0);

  // Income/Budget card elements
  setTextSafe('ib-budget-limit', totalLimit > 0
    ? `Budget limit: ${curr}${totalLimit.toLocaleString()}`
    : 'No budget set for this month');

  const fillEl = document.getElementById('dash-budget-fill');
  if (fillEl) {
    fillEl.style.width = pct + '%';
    // Turn fill red when over budget
    fillEl.style.background = pct >= 100 ? 'var(--red)' : '';
  }

  setTextSafe('dash-budget-pct', pct + '% used');
  setTextSafe('dash-budget-rem', totalLimit > 0
    ? `${curr}${rem.toLocaleString()} remaining`
    : '—');
}

// ---- Utility ----

function setTextSafe(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function stopRecurrence(id) {
  if (!confirm('Stop this recurring schedule? The transaction will remain but no more copies will be generated.')) return;
  try {
    await DB.stopRecurrence(id);
    showToast('Recurring schedule stopped.');
    refreshAll();
  } catch (e) {
    showToast('Could not stop recurrence. Please try again.', 'error');
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
