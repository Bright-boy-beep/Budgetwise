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

function saveBudget() {
  const category = document.getElementById('budget-category').value;
  const limit    = parseFloat(document.getElementById('budget-limit').value);
  const month    = document.getElementById('budget-month').value;
  const editId   = document.getElementById('budget-edit-id').value;

  if (!category)           { showToast('Please select a category.'); return; }
  if (!limit || limit <= 0){ showToast('Please enter a valid limit amount.'); return; }
  if (!month)              { showToast('Please select a month.'); return; }

  DB.addBudget({ id: editId || undefined, category, limit, month });
  showToast('Budget saved successfully!');
  closeModal('budget-modal');
  renderBudgets();
  renderDashboardBudgets();
}

function deleteBudget(id) {
  if (!confirm('Delete this budget? This cannot be undone.')) return;
  DB.deleteBudget(id);
  showToast('Budget deleted.');
  renderBudgets();
  renderDashboardBudgets();
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
