// ============================================================
// TRANSACTIONS MODULE
// ============================================================

let currentType = 'expense';

// ---- Open / Close Modal ----

function openAddModal(id = null) {
  // Reset all fields first
  document.getElementById('edit-id').value        = '';
  document.getElementById('tx-description').value = '';
  document.getElementById('tx-amount').value       = '';
  document.getElementById('tx-note').value         = '';
  document.getElementById('tx-date').value         = new Date().toISOString().split('T')[0];
  document.getElementById('modal-title').textContent = 'Add Transaction';

  if (id) {
    // ---- EDIT mode ----
    const tx = DB.getTransactions().find(t => t.id === id);
    if (tx) {
      document.getElementById('modal-title').textContent = 'Edit Transaction';
      document.getElementById('edit-id').value           = tx.id;
      document.getElementById('tx-description').value    = tx.description;
      document.getElementById('tx-amount').value         = tx.amount;
      document.getElementById('tx-date').value           = tx.date;
      document.getElementById('tx-note').value           = tx.note || '';
      // Set type toggle first, then populate categories with the saved category pre-selected
      applyTypeToggle(tx.type);
      populateCategorySelect(tx.type, tx.category);
    }
  } else {
    // ---- ADD mode ----
    applyTypeToggle('expense');
    populateCategorySelect('expense');
  }

  // Show modal — remove hidden class
  document.getElementById('add-modal').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeModalOnOverlay(event, id) {
  // Only close when the dark backdrop itself is clicked,
  // not anything inside the white modal box
  if (event.target === document.getElementById(id)) {
    closeModal(id);
  }
}

// ---- Toggle (Expense / Income) ----

function setType(type) {
  // Update the internal state
  currentType = type;
  // Update button visual states
  applyTypeToggle(type);
  // Repopulate the category dropdown for the new type
  // (no pre-selected value — reset to first in list)
  populateCategorySelect(type, null);
}

function applyTypeToggle(type) {
  // Keeps visual toggle in sync without touching the category dropdown
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

function saveTransaction() {
  const desc   = document.getElementById('tx-description').value.trim();
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const date   = document.getElementById('tx-date').value;
  const cat    = document.getElementById('tx-category').value;
  const note   = document.getElementById('tx-note').value.trim();
  const editId = document.getElementById('edit-id').value;

  // Validation
  if (!desc)               { showToast('Please enter a description.'); return; }
  if (!amount || amount <= 0) { showToast('Please enter a valid amount.'); return; }
  if (!date)               { showToast('Please select a date.'); return; }

  const tx = { type: currentType, description: desc, amount, date, category: cat, note };

  if (editId) {
    DB.updateTransaction(editId, tx);
    showToast('Transaction updated!');
  } else {
    DB.addTransaction(tx);
    showToast('Transaction added!');
  }

  closeModal('add-modal');
  refreshAll();
}

// ---- Delete Transaction ----

function deleteTransaction(id) {
  if (!confirm('Delete this transaction? This cannot be undone.')) return;
  DB.deleteTransaction(id);
  showToast('Transaction deleted.');
  refreshAll();
}

// ---- Rendering ----

function renderTransactionItem(tx, showActions = true) {
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const icon     = getCategoryIcon(tx.category);
  const dateStr  = new Date(tx.date + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const sign = tx.type === 'income' ? '+' : '-';

  const div       = document.createElement('div');
  div.className   = 'tx-item';
  div.innerHTML   = `
    <div class="tx-icon ${tx.type}">${icon}</div>
    <div class="tx-info">
      <div class="tx-desc">${escHtml(tx.description)}</div>
      <div class="tx-meta">${escHtml(tx.category)} · ${dateStr}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
    </div>
    <div class="tx-right">
      <div class="tx-amount ${tx.type}">${sign}${curr}${tx.amount.toLocaleString()}</div>
      ${showActions ? `
        <div class="tx-actions">
          <button class="tx-edit"   onclick="openAddModal('${tx.id}')">&#x270F;</button>
          <button class="tx-delete" onclick="deleteTransaction('${tx.id}')">&#x2715;</button>
        </div>` : ''}
    </div>
  `;
  return div;
}

function renderRecentTransactions() {
  const list = document.getElementById('recent-list');
  list.innerHTML   = '';
  const txs = DB.getTransactions().slice(0, 5);
  if (txs.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:1.5rem"><p>No transactions yet. Add your first one!</p></div>';
    return;
  }
  txs.forEach(tx => list.appendChild(renderTransactionItem(tx, true)));
}

function renderAllTransactions() {
  filterTransactions();
}

function filterTransactions() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const typeF  = document.getElementById('filter-type')?.value  || 'all';
  const catF   = document.getElementById('filter-category')?.value || 'all';
  const monthF = document.getElementById('filter-month')?.value || '';

  let txs = DB.getTransactions();

  if (typeF  !== 'all') txs = txs.filter(t => t.type === typeF);
  if (catF   !== 'all') txs = txs.filter(t => t.category === catF);
  if (monthF)           txs = txs.filter(t => t.date.startsWith(monthF));
  if (search)           txs = txs.filter(t =>
    t.description.toLowerCase().includes(search) ||
    t.category.toLowerCase().includes(search)    ||
    (t.note || '').toLowerCase().includes(search)
  );

  const list  = document.getElementById('transactions-list');
  const empty = document.getElementById('transactions-empty');
  list.innerHTML = '';

  if (txs.length === 0) {
    list.style.display = 'none';
    empty.classList.remove('hidden');
  } else {
    list.style.display = '';
    empty.classList.add('hidden');
    txs.forEach(tx => list.appendChild(renderTransactionItem(tx, true)));
  }
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

  document.getElementById('total-income').textContent   = curr + totals.income.toLocaleString();
  document.getElementById('total-expenses').textContent = curr + totals.expense.toLocaleString();
  document.getElementById('net-balance').textContent    = curr + totals.balance.toLocaleString();
  document.getElementById('savings-rate').textContent   = rate + '%';

  const balEl       = document.getElementById('net-balance');
  balEl.style.color = totals.balance >= 0 ? 'var(--green)' : 'var(--red)';
}

// ---- Utility ----

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}