// ============================================================
// MAIN APP CONTROLLER
// ============================================================

let currentPage = 'dashboard';

function initApp(user) {
  // Apply saved settings
  const settings = DB.getSettings();
  applyTheme(settings.theme || 'light');

  // Update currency labels
  updateCurrencyLabels();

  // Set up sidebar user info
  document.getElementById('sidebar-name').textContent  = user.name || 'User';
  document.getElementById('sidebar-email').textContent = user.email || '';
  document.getElementById('sidebar-avatar').textContent = (user.name || 'U')[0].toUpperCase();

  // Greeting
  setGreeting();

  // Set settings form
  const displayName  = settings.name || user.name || '';
  const displayEmail = user.email || '';
  document.getElementById('settings-name').value            = displayName;
  document.getElementById('settings-email').value           = displayEmail;
  document.getElementById('settings-currency').value        = settings.currency || '₦';
  document.getElementById('settings-opening-balance').value = settings.openingBalance || 0;

  // Sync avatar display in settings
  const avatarEl = document.getElementById('settings-avatar-display');
  if (avatarEl) avatarEl.textContent = (displayName || 'U')[0].toUpperCase();
  const avatarName = document.getElementById('settings-avatar-name');
  if (avatarName) avatarName.textContent = displayName || 'User';
  const avatarEmail = document.getElementById('settings-avatar-email');
  if (avatarEmail) avatarEmail.textContent = displayEmail;

  // Sync theme pill
  _syncThemeUI(settings.theme || 'light');

  // Populate filter categories
  populateFilterCategories();

  // Navigate to dashboard
  navigate('dashboard');
}

function navigate(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  // Highlight nav item
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick')?.includes(page)) n.classList.add('active');
  });

  // Update topbar title
  const titles = { dashboard:'Dashboard', transactions:'Transactions', budgets:'Budgets', analytics:'Analytics', 'ml-insights':'ML Insights', goals:'Goals', reports:'Reports', settings:'Settings' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('active');

  currentPage = page;

  // Sync mobile bottom nav active state
  mbnSetActive(page);

  // Render page-specific content
  renderPage(page);
}

function mbnSetActive(page) {
  const map = { dashboard: 'mbn-dashboard', transactions: 'mbn-transactions', budgets: 'mbn-budgets', settings: 'mbn-settings' };
  document.querySelectorAll('.mbn-item').forEach(el => el.classList.remove('active'));
  const activeId = map[page];
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) el.classList.add('active');
  }
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':
      updateSummaryCards();
      renderRecentTransactions();
      renderDashCategoriesGrid();
      renderDashboardBudgets();
      renderAllCharts();
      updateQuickRecordInfo();
      renderBudgetAlerts();
      renderHealthScore();
      renderForecastWidget();
      renderInsightsCard();
      generateNotifications();
      break;
    case 'transactions':
      renderAllTransactions();
      break;
    case 'budgets':
      switchBudgetTab('current');
      renderBudgets();
      break;
    case 'analytics':
      renderAnalyticsCharts();
      _calYear  = new Date().getFullYear();
      _calMonth = new Date().getMonth();
      renderSpendingCalendar();
      break;
    case 'ml-insights':
      renderMLInsights();
      break;
    case 'goals':
      renderGoals();
      break;
    case 'reports':
      renderReports();
      break;
    case 'settings':
      renderSettings();
      break;
  }
}

function refreshAll() {
  renderPage(currentPage);
  if (currentPage !== 'dashboard') {
    // Keep summary always fresh
    updateSummaryCards();
  }
}

// ---- Navigation helpers ----

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const isOpen = sidebar.classList.toggle('open');
  // Manage overlay
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = () => toggleSidebar();
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active', isOpen);
}

// ---- Quick Add (dashboard shortcut buttons) ----

function quickAdd(type) {
  // Opens the Add Transaction modal pre-set to the chosen type
  openAddModal();
  setType(type);
}

// ---- Quick Record bar info ----

function updateQuickRecordInfo() {
  const now    = new Date();
  const month  = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const txs    = DB.getTransactions();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count  = txs.filter(t => t.date.startsWith(monthStr)).length;

  const monthEl = document.getElementById('qr-month-label');
  const countEl = document.getElementById('qr-tx-count');
  if (monthEl) monthEl.textContent = month;
  if (countEl) countEl.textContent = count + ' transaction' + (count !== 1 ? 's' : '') + ' this month';
}

// ---- Theme ----

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  _syncThemeUI(theme);
  // Re-render charts with correct colors
  setTimeout(() => {
    if (currentPage === 'dashboard') renderAllCharts();
    if (currentPage === 'analytics') renderAnalyticsCharts();
  }, 100);
}

function _syncThemeUI(theme) {
  const isDark = theme === 'dark';
  // Topbar toggle button
  document.getElementById('topbar-theme-btn')?.classList.toggle('is-dark', isDark);
  // Sidebar toggle button
  document.getElementById('sidebar-theme-btn')?.classList.toggle('is-dark', isDark);
  // Settings pill
  document.getElementById('theme-btn-light')?.classList.toggle('active', !isDark);
  document.getElementById('theme-btn-dark')?.classList.toggle('active',  isDark);
  // Hidden input (used by saveSettings)
  const hiddenInput = document.getElementById('settings-theme');
  if (hiddenInput) hiddenInput.value = theme;
}

function toggleTheme() {
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  const next    = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

async function setTheme(theme) {
  applyTheme(theme);
  try {
    const s = DB.getSettings();
    await DB.saveSettings({ ...s, theme });
  } catch (_) { /* non-critical */ }
}

// ---- Settings ----

async function saveSettings() {
  const name           = document.getElementById('settings-name').value.trim();
  const currency       = document.getElementById('settings-currency').value;
  const theme          = document.getElementById('settings-theme').value;
  const openingBalance = parseFloat(document.getElementById('settings-opening-balance').value) || 0;

  // Disable all save buttons in settings page during save
  const saveBtns = document.querySelectorAll('#page-settings .btn-primary');
  saveBtns.forEach(b => b.disabled = true);

  try {
    await DB.saveSettings({ name, currency, theme, openingBalance });
    applyTheme(theme);
    updateCurrencyLabels();
    // Update sidebar
    if (name) {
      document.getElementById('sidebar-name').textContent  = name;
      document.getElementById('sidebar-avatar').textContent = name[0].toUpperCase();
    }
    // Update settings avatar display
    const avatarEl   = document.getElementById('settings-avatar-display');
    const avatarName = document.getElementById('settings-avatar-name');
    if (avatarEl && name)   avatarEl.textContent  = name[0].toUpperCase();
    if (avatarName && name) avatarName.textContent = name;
    showToast('Settings updated.', 'success');
    refreshAll();
  } catch (e) {
    showToast('Could not save settings. Please try again.', 'error');
  } finally {
    saveBtns.forEach(b => b.disabled = false);
  }
}

async function changePassword() {
  const current = document.getElementById('pw-current').value;
  const newPw   = document.getElementById('pw-new').value;
  const confirm = document.getElementById('pw-confirm').value;

  if (!current)          { showToast('Please enter your current password.'); return; }
  if (!newPw)            { showToast('Please enter a new password.'); return; }
  if (newPw.length < 6)  { showToast('New password must be at least 6 characters.'); return; }
  if (newPw !== confirm) { showToast('New passwords do not match.'); return; }

  const btn = document.querySelector('#page-settings .settings-card button[onclick="changePassword()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Updating…'; }

  try {
    await API.put('/auth/change-password', { current_password: current, new_password: newPw });
    showToast('Password updated successfully.', 'success');
    document.getElementById('pw-current').value = '';
    document.getElementById('pw-new').value      = '';
    document.getElementById('pw-confirm').value  = '';
  } catch (e) {
    showToast(e.message || 'Could not update password. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Update password'; }
  }
}

function updateCurrencyLabels() {
  const curr = DB.getSettings().currency || '₦';
  document.querySelectorAll('.currency-label').forEach(el => el.textContent = curr);
}

// ---- Export ----

function exportData() {
  const data = {
    exportDate: new Date().toISOString(),
    user:       DB.getSession(),
    transactions: DB.getTransactions(),
    budgets:    DB.getBudgets(),
    settings:   DB.getSettings(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `budgetwise-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported — keep it somewhere safe.', 'success');
}

async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Reset input so same file can be re-selected
  event.target.value = '';

  const text = await file.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    showToast('Invalid file — could not read the backup.', 'error');
    return;
  }

  // Validate it's a Expense Tracker export
  if (!data.transactions && !data.budgets) {
    showToast('This doesn\'t look like a Expense Tracker backup file.', 'error');
    return;
  }

  if (!confirm(
    `This will import:\n• ${(data.transactions || []).length} transactions\n• ${(data.budgets || []).length} budgets\n\nExisting data will not be deleted. Continue?`
  )) return;

  let txImported = 0, budgetImported = 0, failed = 0;

  // Import transactions
  for (const tx of (data.transactions || [])) {
    try {
      await DB.addTransaction({
        description: tx.description,
        amount:      tx.amount,
        type:        tx.type,
        category:    tx.category,
        date:        tx.date,
        note:        tx.note || '',
      });
      txImported++;
    } catch { failed++; }
  }

  // Import budgets
  for (const b of (data.budgets || [])) {
    try {
      await DB.addBudget({ category: b.category, limit: b.limit, month: b.month });
      budgetImported++;
    } catch { /* skip duplicates */ }
  }

  const summary = `Imported ${txImported} transaction${txImported !== 1 ? 's' : ''} and ${budgetImported} budget${budgetImported !== 1 ? 's' : ''}.`;
  showToast(summary, failed > 0 ? 'info' : 'success', 4000);
  refreshAll();
}

function exportCSV() {
  const txs = DB.getTransactions();
  if (txs.length === 0) { showToast('No transactions to export yet.'); return; }
  const headers = ['Date','Type','Description','Category','Amount','Note','Recurring'];
  const rows    = txs.map(t => [
    t.date,
    t.type,
    `"${(t.description || '').replace(/"/g,'""')}"`,
    `"${(t.category   || '').replace(/"/g,'""')}"`,
    t.amount,
    `"${(t.note       || '').replace(/"/g,'""')}"`,
    t.recurrence || '',
  ]);
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `budgetwise-transactions-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${txs.length} transaction${txs.length !== 1 ? 's' : ''} to CSV.`, 'success');
}

function clearAllData() {
  if (!confirm('Delete all transactions, budgets, and goals? This cannot be undone.')) return;
  DB.clearUserData();
  showToast('All data has been cleared.', 'info');
  refreshAll();
}

// ---- Greeting ----

function setGreeting() {
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const session = DB.getSession();
  const name = session?.name ? ', ' + session.name.split(' ')[0] : '';
  const el = document.getElementById('greeting');
  if (el) el.textContent = greeting + name + '.';

  // Date subtitle
  const subEl = document.getElementById('dash-date-sub');
  if (subEl) {
    subEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

// ---- Toast ----

function showToast(msg, type = 'default', duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast'; // reset
  if (type === 'success') toast.classList.add('success');
  else if (type === 'error') toast.classList.add('error');
  else if (type === 'info') toast.classList.add('info');
  toast.classList.remove('hidden');
  // Force reflow so animation replays on repeated calls
  void toast.offsetWidth;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ---- Settings page render ----

function renderSettings() {
  const settings = DB.getSettings();
  const session  = DB.getSession();

  const name  = settings.name  || session?.name  || '';
  const email = session?.email || '';

  // Form fields
  const nameEl = document.getElementById('settings-name');
  const emailEl = document.getElementById('settings-email');
  const currEl  = document.getElementById('settings-currency');
  const balEl   = document.getElementById('settings-opening-balance');
  if (nameEl)  nameEl.value  = name;
  if (emailEl) emailEl.value = email;
  if (currEl)  currEl.value  = settings.currency || '₦';
  if (balEl)   balEl.value   = settings.openingBalance || 0;

  // Avatar card
  const avatarEl   = document.getElementById('settings-avatar-display');
  const avatarName = document.getElementById('settings-avatar-name');
  const avatarEmail = document.getElementById('settings-avatar-email');
  if (avatarEl)    avatarEl.textContent   = (name || 'U')[0].toUpperCase();
  if (avatarName)  avatarName.textContent = name  || 'User';
  if (avatarEmail) avatarEmail.textContent = email;

  // Theme pill
  _syncThemeUI(settings.theme || 'light');
}

// ---- Financial Health Score ----

function renderHealthScore() {
  const txs      = DB.getTransactions();
  const budgets  = DB.getBudgets();

  const now      = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const curTxs  = txs.filter(t => t.date.startsWith(curMonth));
  const lastTxs = txs.filter(t => t.date.startsWith(lastMonth));

  const curIncome   = curTxs.filter(t => t.type === 'income') .reduce((s, t) => s + t.amount, 0);
  const curExpense  = curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  /* ── 1. Savings Rate (0–35 pts) ─────────────────────────────────────────── */
  let savingsScore = 0, savingsLabel = 'No income recorded', savingsPct = 0;
  if (curIncome > 0) {
    const rate = (curIncome - curExpense) / curIncome * 100;
    savingsPct = Math.max(0, Math.min(100, rate));
    if      (rate >= 30) { savingsScore = 35; savingsLabel = `${rate.toFixed(0)}% saved — Excellent`; }
    else if (rate >= 20) { savingsScore = 28; savingsLabel = `${rate.toFixed(0)}% saved — Good`;      }
    else if (rate >= 10) { savingsScore = 20; savingsLabel = `${rate.toFixed(0)}% saved — Fair`;      }
    else if (rate >= 0)  { savingsScore = 10; savingsLabel = `${rate.toFixed(0)}% saved — Low`;       }
    else                 { savingsScore = 0;  savingsLabel = `Overspending by ${Math.abs(rate).toFixed(0)}%`; savingsPct = 0; }
  }

  /* ── 2. Budget Adherence (0–35 pts) ─────────────────────────────────────── */
  let budgetScore = 20, budgetLabel = 'No budgets set', budgetPct = 57;
  const curBudgets = budgets.filter(b => b.month === curMonth);
  if (curBudgets.length > 0) {
    let withinCount = 0;
    curBudgets.forEach(b => {
      const spent = curTxs
        .filter(t => t.type === 'expense' && t.category === b.category)
        .reduce((s, t) => s + t.amount, 0);
      if (spent <= b.limit) withinCount++;
    });
    const adherence = withinCount / curBudgets.length;
    budgetPct   = adherence * 100;
    budgetScore = Math.round(adherence * 35);
    budgetLabel = `${withinCount}/${curBudgets.length} budget${curBudgets.length !== 1 ? 's' : ''} on track`;
  }

  /* ── 3. Spending Trend (0–15 pts) ───────────────────────────────────────── */
  let trendScore = 10, trendLabel = 'Not enough history', trendPct = 66;
  if (curExpense > 0 && lastExpense > 0) {
    const change = (curExpense - lastExpense) / lastExpense * 100;
    if      (change <= -10) { trendScore = 15; trendLabel = `↓ ${Math.abs(change).toFixed(0)}% less than last month`; trendPct = 100; }
    else if (change <= 0)   { trendScore = 13; trendLabel = `↓ Slightly less than last month`;                        trendPct = 87;  }
    else if (change <= 10)  { trendScore = 10; trendLabel = `→ Similar to last month`;                                trendPct = 66;  }
    else if (change <= 25)  { trendScore = 6;  trendLabel = `↑ ${change.toFixed(0)}% more than last month`;           trendPct = 40;  }
    else                    { trendScore = 3;  trendLabel = `↑↑ ${change.toFixed(0)}% surge vs last month`;           trendPct = 20;  }
  }

  /* ── 4. Anomaly Health (0–15 pts) ───────────────────────────────────────── */
  let anomalyScore = 15, anomalyLabel = 'No anomalies detected', anomalyPct = 100;
  const anomalyCount = txs.filter(t => t.is_anomaly).length;
  if (txs.length > 0) {
    const ratio = anomalyCount / txs.length;
    if      (ratio === 0)   { anomalyScore = 15; anomalyLabel = 'No anomalies detected';              anomalyPct = 100; }
    else if (ratio < 0.05)  { anomalyScore = 12; anomalyLabel = `${anomalyCount} minor flag(s)`;     anomalyPct = 80;  }
    else if (ratio < 0.10)  { anomalyScore = 8;  anomalyLabel = `${anomalyCount} anomalies flagged`; anomalyPct = 53;  }
    else if (ratio < 0.20)  { anomalyScore = 4;  anomalyLabel = `${anomalyCount} — review needed`;   anomalyPct = 27;  }
    else                    { anomalyScore = 0;  anomalyLabel = `${anomalyCount} — urgent attention`; anomalyPct = 0;  }
  }

  /* ── Total & grade ──────────────────────────────────────────────────────── */
  const total = savingsScore + budgetScore + trendScore + anomalyScore;
  let grade, gradeColor;
  if      (total >= 85) { grade = 'Excellent';       gradeColor = '#16A34A'; }
  else if (total >= 70) { grade = 'Good';            gradeColor = '#7B5CF5'; }
  else if (total >= 50) { grade = 'Fair';            gradeColor = '#CA8A04'; }
  else                  { grade = 'Needs Attention'; gradeColor = '#DC2626'; }

  /* ── DOM update ─────────────────────────────────────────────────────────── */
  const scoreNumEl = document.getElementById('health-score-num');
  if (!scoreNumEl) return;

  scoreNumEl.textContent = total;

  const gradeEl = document.getElementById('health-score-grade');
  if (gradeEl) { gradeEl.textContent = grade; gradeEl.style.color = gradeColor; }

  // Animate SVG arc: circumference of r=48 circle = 2π×48 ≈ 301.6
  const arcEl = document.getElementById('health-gauge-arc');
  if (arcEl) {
    arcEl.style.stroke = gradeColor;
    arcEl.style.strokeDashoffset = (301.6 - (total / 100) * 301.6).toFixed(2);
  }

  const subEl = document.getElementById('health-subtitle');
  if (subEl) {
    if (txs.length === 0)   subEl.textContent = 'Add some transactions to see your score';
    else if (total >= 85)   subEl.textContent = 'Great shape — keep it up';
    else if (total >= 70)   subEl.textContent = 'On track. Small adjustments can push this higher';
    else if (total >= 50)   subEl.textContent = 'Some room to improve — review your spending';
    else                    subEl.textContent = 'Needs attention — try setting a few budgets';
  }

  // Factor bars
  _setHealthFactor('savings', savingsPct, savingsLabel,
    savingsScore >= 28 ? '#16A34A' : savingsScore >= 15 ? '#CA8A04' : '#DC2626');
  _setHealthFactor('budget', budgetPct, budgetLabel,
    budgetScore >= 28 ? '#16A34A' : budgetScore >= 15 ? '#CA8A04' : '#DC2626');
  _setHealthFactor('trend', trendPct, trendLabel,
    trendScore >= 13 ? '#16A34A' : trendScore >= 8 ? '#CA8A04' : '#DC2626');
  _setHealthFactor('anomaly', anomalyPct, anomalyLabel,
    anomalyScore >= 12 ? '#16A34A' : anomalyScore >= 6 ? '#CA8A04' : '#DC2626');
}

function _setHealthFactor(id, pct, label, color) {
  const fill = document.getElementById(`hf-${id}-fill`);
  const val  = document.getElementById(`hf-${id}-val`);
  if (fill) { fill.style.width = Math.max(3, pct) + '%'; fill.style.background = color; }
  if (val)  val.textContent = label;
}

// ---- ML Spending Forecast Widget ----

function renderForecastWidget() {
  const txs      = DB.getTransactions();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const now      = new Date();

  const bodyEl   = document.getElementById('forecast-body');
  const emptyEl  = document.getElementById('forecast-empty');
  const subEl    = document.getElementById('forecast-sub');
  const chipText = document.getElementById('forecast-status-text');
  const chipDot  = document.getElementById('forecast-status-dot');

  // ── Only expense transactions ──────────────────────────────────────────────
  const expenses = txs.filter(t => t.type === 'expense');

  // Need at least some data to show anything
  if (expenses.length === 0) {
    if (bodyEl)  bodyEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    if (subEl)   subEl.textContent = 'Add expense transactions to activate the forecast';
    return;
  }
  if (bodyEl)  bodyEl.classList.remove('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');

  // ── Weighted-average forecast (mirrors backend ExpensePredictor) ───────────
  const MAX_MONTHS = 6;

  // Build monthly totals: { 'YYYY-MM': { category: total } }
  const monthly = {};
  expenses.forEach(t => {
    const ym  = t.date.slice(0, 7);
    const cat = t.category || 'Other';
    if (!monthly[ym]) monthly[ym] = {};
    monthly[ym][cat] = (monthly[ym][cat] || 0) + t.amount;
  });

  const curMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pastMonths = Object.keys(monthly)
    .filter(ym => ym < curMonth)
    .sort()
    .slice(-MAX_MONTHS);

  // ── Weighted average helper ────────────────────────────────────────────────
  function weightedAvg(values) {
    if (!values.length) return 0;
    const n   = values.length;
    let wSum  = 0, total = 0;
    values.forEach((v, i) => { const w = i + 1; total += v * w; wSum += w; });
    return wSum > 0 ? total / wSum : 0;
  }

  // Gather all categories from history
  const allCats = new Set(pastMonths.flatMap(ym => Object.keys(monthly[ym] || {})));

  const predictions = {};
  allCats.forEach(cat => {
    const hist = pastMonths.map(ym => (monthly[ym] || {})[cat] || 0);
    predictions[cat] = weightedAvg(hist);
  });

  const predictedTotal = Object.values(predictions).reduce((s, v) => s + v, 0);

  // ── Current month actuals ─────────────────────────────────────────────────
  const curMonthTxs = expenses.filter(t => t.date.startsWith(curMonth));
  const spentTotal  = curMonthTxs.reduce((s, t) => s + t.amount, 0);

  // ── Days info ─────────────────────────────────────────────────────────────
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth   = now.getDate();
  const daysLeft     = daysInMonth - dayOfMonth;
  const monthPct     = (dayOfMonth / daysInMonth) * 100;

  // Safe-to-spend per day: whatever remains of predicted budget ÷ days left
  const remaining     = Math.max(0, predictedTotal - spentTotal);
  const safePerDay    = daysLeft > 0 ? remaining / daysLeft : 0;

  // Spend pace: if we extrapolate today's pace to end of month
  const spendPace     = dayOfMonth > 0 ? (spentTotal / dayOfMonth) * daysInMonth : 0;
  const spendPacePct  = predictedTotal > 0 ? Math.min(120, (spendPace / predictedTotal) * 100) : monthPct;

  // Status: on-track / over / under
  let status, dotClass, statusLabel;
  if (pastMonths.length === 0) {
    status = 'learning'; dotClass = 'under'; statusLabel = 'Learning…';
  } else if (spendPace > predictedTotal * 1.1) {
    status = 'over';     dotClass = 'over';  statusLabel = 'Over pace';
  } else if (spendPace < predictedTotal * 0.9) {
    status = 'under';    dotClass = 'under'; statusLabel = 'Under budget';
  } else {
    status = 'on-track'; dotClass = 'on-track'; statusLabel = 'On track';
  }

  // ── DOM updates ────────────────────────────────────────────────────────────
  const fmt = v => curr + Math.round(v).toLocaleString();

  _fcSet('fc-spent',      fmt(spentTotal));
  _fcSet('fc-predicted',  pastMonths.length > 0 ? fmt(predictedTotal) : 'Learning…');
  _fcSet('fc-safe-day',   daysLeft > 0 && predictedTotal > 0 ? fmt(safePerDay) : '—');
  _fcSet('fc-days-left',  daysLeft + ' day' + (daysLeft !== 1 ? 's' : ''));

  if (chipText) chipText.textContent = statusLabel;
  if (chipDot)  { chipDot.className = 'fsc-dot ' + dotClass; }

  if (subEl) {
    if (pastMonths.length === 0) {
      subEl.textContent = 'Building your spending model — keep adding transactions';
    } else {
      const monthName = now.toLocaleDateString('en-GB', { month: 'long' });
      subEl.textContent = `${monthName} forecast based on ${pastMonths.length} month${pastMonths.length !== 1 ? 's' : ''} of history`;
    }
  }

  // Pace bars
  const monthBarEl = document.getElementById('fc-month-bar');
  const spendBarEl = document.getElementById('fc-spend-bar');
  if (monthBarEl) monthBarEl.style.width = monthPct.toFixed(1) + '%';
  if (spendBarEl) {
    spendBarEl.style.width = spendPacePct.toFixed(1) + '%';
    spendBarEl.className   = 'fpt-spend-bar ' + dotClass;
  }

  const paceLabelEl = document.getElementById('fc-pace-label');
  if (paceLabelEl) {
    paceLabelEl.textContent = `Day ${dayOfMonth} of ${daysInMonth}`;
  }

  // Top 3 category predictions
  const catsEl = document.getElementById('fc-cats');
  if (catsEl) {
    const sorted = Object.entries(predictions)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const maxVal = sorted[0]?.[1] || 1;
    const catColors = ['#7B5CF5','#16A34A','#CA8A04','#E94560'];

    catsEl.innerHTML = '';
    if (sorted.length === 0) {
      catsEl.innerHTML = '<span style="font-size:12px;color:var(--text-muted)">More history needed for category breakdown</span>';
    } else {
      sorted.forEach(([cat, val], i) => {
        const pct = (val / maxVal) * 100;
        const row = document.createElement('div');
        row.className = 'forecast-cat-row';
        row.innerHTML = `
          <div class="fcat-name">${getCategoryIcon(cat)} ${cat.split(' ').slice(0,2).join(' ')}</div>
          <div class="fcat-bar-track">
            <div class="fcat-bar-fill" style="width:${pct.toFixed(1)}%;background:${catColors[i]}"></div>
          </div>
          <div class="fcat-val">${fmt(val)}</div>
        `;
        catsEl.appendChild(row);
      });
    }
  }
}

function _fcSet(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ---- AI Spending Insights Summary ----

// ============================================================
// AI FINANCIAL TIPS ENGINE
// ============================================================

let _allTips      = [];   // full generated list
let _tipShowCount = 4;    // how many are visible

function _fmt(n) { return Math.round(n).toLocaleString(); }

function _generateTips(txs, budgets, goals, settings) {
  const curr     = settings.currency || '₦';
  const now      = new Date();
  const tips     = [];

  const curMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prev2Date = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prev2Month = `${prev2Date.getFullYear()}-${String(prev2Date.getMonth() + 1).padStart(2, '0')}`;

  const curTxs    = txs.filter(t => t.date.startsWith(curMonth));
  const lastTxs   = txs.filter(t => t.date.startsWith(lastMonth));
  const prev2Txs  = txs.filter(t => t.date.startsWith(prev2Month));

  const curExpense  = curTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const curIncome   = curTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const lastExpense = lastTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth  = now.getDate();
  const daysLeft    = daysInMonth - dayOfMonth;
  const lastMonthName  = prevDate.toLocaleDateString('en-GB', { month: 'long' });

  // ─ helper to build category spend map ─────────────────────
  function catMap(txList) {
    const m = {};
    txList.filter(t => t.type === 'expense').forEach(t => {
      m[t.category] = (m[t.category] || 0) + t.amount;
    });
    return m;
  }
  const curCatMap   = catMap(curTxs);
  const lastCatMap  = catMap(lastTxs);
  const prev2CatMap = catMap(prev2Txs);
  const curBudgets  = budgets.filter(b => b.month === curMonth);

  // ─── TIP 1: ANOMALY ALERT (priority 1) ───────────────────
  const anomalies = curTxs.filter(t => t.is_anomaly);
  if (anomalies.length > 0) {
    const topAnomaly = anomalies.sort((a, b) => b.amount - a.amount)[0];
    tips.push({
      id:       'anomaly-alert',
      priority: 1,
      type:     'alert',
      badge:    '🚨 ALERT',
      title:    `${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''} detected`,
      body:     `Our ML model flagged <strong>${anomalies.length} transaction${anomalies.length > 1 ? 's' : ''}</strong> as unusually large this month. The biggest is <strong>${curr}${_fmt(topAnomaly.amount)}</strong> on "${topAnomaly.description}". Verify these are correct to avoid tracking errors.`,
      action:   { label: 'Review in ML Insights', page: 'ml-insights' },
    });
  }

  // ─── TIP 2: OVER BUDGET (priority 1 each) ────────────────
  curBudgets.forEach(b => {
    const spent = curCatMap[b.category] || 0;
    if (spent > b.limit) {
      const over   = spent - b.limit;
      const pct    = Math.round((spent / b.limit) * 100);
      tips.push({
        id:       `over-budget-${b.category}`,
        priority: 1,
        type:     'alert',
        badge:    '📛 BUDGET',
        title:    `Over budget on ${b.category} (${pct}%)`,
        body:     `You've spent <strong>${curr}${_fmt(spent)}</strong> on ${b.category} but your limit is <strong>${curr}${_fmt(b.limit)}</strong> — that's <strong>${curr}${_fmt(over)}</strong> over. Pause non-essential ${b.category} spending for the rest of the month.`,
        action:   { label: 'View Budgets', page: 'budgets' },
      });
    }
  });

  // ─── TIP 3: SPENDING DEFICIT (priority 1) ────────────────
  if (curIncome > 0 && curExpense > curIncome) {
    const deficit = curExpense - curIncome;
    tips.push({
      id:       'spending-deficit',
      priority: 1,
      type:     'alert',
      badge:    '🔴 SAVINGS',
      title:    `You're spending more than you earn`,
      body:     `Your expenses (<strong>${curr}${_fmt(curExpense)}</strong>) exceed your recorded income (<strong>${curr}${_fmt(curIncome)}</strong>) by <strong>${curr}${_fmt(deficit)}</strong> this month. Review non-essentials immediately to avoid debt.`,
      action:   { label: 'Review Transactions', page: 'transactions' },
    });
  }

  // ─── TIP 4: NEAR BUDGET LIMIT (priority 2) ───────────────
  curBudgets.forEach(b => {
    const spent = curCatMap[b.category] || 0;
    const pct   = spent / b.limit;
    if (pct >= 0.80 && pct <= 1.0) {
      const remaining  = b.limit - spent;
      const dailyAllow = daysLeft > 0 ? remaining / daysLeft : 0;
      tips.push({
        id:       `near-budget-${b.category}`,
        priority: 2,
        type:     'warn',
        badge:    '⚠️ BUDGET',
        title:    `${b.category} budget ${Math.round(pct * 100)}% used`,
        body:     `You have <strong>${curr}${_fmt(remaining)}</strong> left in your ${b.category} budget with <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong> to go. That's roughly <strong>${curr}${_fmt(dailyAllow)}/day</strong> — spend carefully to stay within your limit.`,
        action:   { label: 'View Budgets', page: 'budgets' },
      });
    }
  });

  // ─── TIP 5: LOW SAVINGS RATE (priority 2) ────────────────
  if (curIncome > 0 && curExpense <= curIncome) {
    const savings = curIncome - curExpense;
    const rate    = (savings / curIncome) * 100;
    if (rate >= 20) {
      tips.push({
        id:       'savings-great',
        priority: 3,
        type:     'good',
        badge:    '💰 SAVINGS',
        title:    `Excellent savings rate: ${rate.toFixed(0)}%`,
        body:     `You've saved <strong>${curr}${_fmt(savings)}</strong> this month — <strong>${rate.toFixed(0)}%</strong> of your income. Financial experts recommend 20%+ and you're hitting that target. Keep it up!`,
        action:   { label: 'View Goals', page: 'goals' },
      });
    } else if (rate >= 10) {
      // find top spending category as actionable lever
      const topCat = Object.entries(curCatMap).sort((a, b) => b[1] - a[1])[0];
      const potential = topCat ? Math.round(topCat[1] * 0.1) : 0;
      const newRate   = curIncome > 0 ? ((savings + potential) / curIncome * 100).toFixed(0) : 0;
      tips.push({
        id:       'savings-low',
        priority: 2,
        type:     'warn',
        badge:    '💸 SAVINGS',
        title:    `Savings rate is ${rate.toFixed(0)}% — room to grow`,
        body:     `You're saving <strong>${curr}${_fmt(savings)}</strong> (${rate.toFixed(0)}% of income). Cutting just 10% of ${topCat ? topCat[0] : 'your top category'} spending (~<strong>${curr}${_fmt(potential)}</strong>) could bring your savings rate up to <strong>${newRate}%</strong>.`,
        action:   { label: 'See Spending', page: 'analytics' },
      });
    } else {
      tips.push({
        id:       'savings-very-low',
        priority: 2,
        type:     'warn',
        badge:    '💸 SAVINGS',
        title:    `Savings rate critically low (${rate.toFixed(0)}%)`,
        body:     `You've only saved <strong>${curr}${_fmt(savings)}</strong> this month — just ${rate.toFixed(0)}% of income. Aim for at least 20%. Review your discretionary categories (Entertainment, Shopping, Dining) to find cuts.`,
        action:   { label: 'Review Categories', page: 'analytics' },
      });
    }
  }

  // ─── TIP 6: SPENDING PACE PROJECTION (priority 2) ────────
  if (dayOfMonth > 4 && curExpense > 0) {
    const projected  = (curExpense / dayOfMonth) * daysInMonth;
    const pctElapsed = dayOfMonth / daysInMonth;
    if (lastExpense > 0) {
      const overPace = projected > lastExpense * 1.25;
      const underPace = projected < lastExpense * 0.85;
      if (overPace) {
        const excess = projected - lastExpense;
        tips.push({
          id:       'pace-fast',
          priority: 2,
          type:     'warn',
          badge:    '📈 TREND',
          title:    `On pace to exceed last month by ${Math.round(((projected - lastExpense) / lastExpense) * 100)}%`,
          body:     `You've spent <strong>${curr}${_fmt(curExpense)}</strong> in ${dayOfMonth} days. Projected month-end total: <strong>${curr}${_fmt(projected)}</strong> — that's <strong>${curr}${_fmt(excess)}</strong> more than ${lastMonthName}. Slow down to course-correct.`,
          action:   { label: 'Check Transactions', page: 'transactions' },
        });
      } else if (underPace) {
        tips.push({
          id:       'pace-good',
          priority: 3,
          type:     'good',
          badge:    '📉 TREND',
          title:    `Great pace — projected spend below last month`,
          body:     `At your current rate, you'll spend ~<strong>${curr}${_fmt(projected)}</strong> by month-end — <strong>less</strong> than ${lastMonthName}'s <strong>${curr}${_fmt(lastExpense)}</strong>. You're trending in the right direction!`,
          action:   null,
        });
      }
    }
  }

  // ─── TIP 7: 3-MONTH RISING CATEGORY (priority 2) ─────────
  Object.keys(curCatMap).forEach(cat => {
    const c0 = prev2CatMap[cat] || 0;
    const c1 = lastCatMap[cat]  || 0;
    const c2 = curCatMap[cat]   || 0;
    if (c0 > 0 && c1 > c0 * 1.1 && c2 > c1 * 1.1) {
      const totalRise = ((c2 - c0) / c0 * 100).toFixed(0);
      tips.push({
        id:       `rising-cat-${cat}`,
        priority: 2,
        type:     'warn',
        badge:    '📊 TREND',
        title:    `${cat} spending up 3 months running`,
        body:     `Your ${cat} expenses have risen consistently: <strong>${curr}${_fmt(c0)}</strong> → <strong>${curr}${_fmt(c1)}</strong> → <strong>${curr}${_fmt(c2)}</strong> — a <strong>${totalRise}% increase</strong> over 3 months. Consider setting a budget limit to contain this trend.`,
        action:   { label: 'Set a Budget', page: 'budgets' },
      });
    }
  });

  // ─── TIP 8: GOAL PROGRESS (priority 2-3) ─────────────────
  if (goals && goals.length > 0) {
    goals.forEach(g => {
      if (!g.target || !g.saved) return;
      const pct  = (g.saved / g.target) * 100;
      const left = g.target - g.saved;
      if (pct >= 100) {
        tips.push({
          id:       `goal-done-${g.id}`,
          priority: 3,
          type:     'good',
          badge:    '🎯 GOAL',
          title:    `Goal achieved: ${g.name}!`,
          body:     `You've reached your <strong>${g.name}</strong> savings goal of <strong>${curr}${_fmt(g.target)}</strong>! Congratulations — consider setting your next challenge or moving the funds to your account.`,
          action:   { label: 'View Goals', page: 'goals' },
        });
      } else if (pct >= 75) {
        tips.push({
          id:       `goal-near-${g.id}`,
          priority: 3,
          type:     'good',
          badge:    '🎯 GOAL',
          title:    `${g.name} is ${pct.toFixed(0)}% funded`,
          body:     `You're almost there! Just <strong>${curr}${_fmt(left)}</strong> more to hit your <strong>${g.name}</strong> goal of <strong>${curr}${_fmt(g.target)}</strong>. A little extra discipline this month could finish it off.`,
          action:   { label: 'View Goals', page: 'goals' },
        });
      } else if (pct < 25 && g.target > 0) {
        const monthlySuggestion = Math.ceil(left / 6);
        tips.push({
          id:       `goal-behind-${g.id}`,
          priority: 3,
          type:     'info',
          badge:    '🎯 GOAL',
          title:    `${g.name} needs attention (${pct.toFixed(0)}% funded)`,
          body:     `Your <strong>${g.name}</strong> goal is only <strong>${pct.toFixed(0)}%</strong> complete. Setting aside <strong>${curr}${_fmt(monthlySuggestion)}/month</strong> would have you there in about 6 months.`,
          action:   { label: 'Update Goal', page: 'goals' },
        });
      }
    });
  }

  // ─── TIP 9: NO BUDGET FOR TOP CATEGORY (priority 3) ──────
  const budgetedCats = new Set(curBudgets.map(b => b.category));
  const topUnbudgeted = Object.entries(curCatMap)
    .filter(([cat]) => !budgetedCats.has(cat) && cat !== 'Income')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1);
  if (topUnbudgeted.length > 0) {
    const [cat, amt] = topUnbudgeted[0];
    tips.push({
      id:       `no-budget-${cat}`,
      priority: 3,
      type:     'info',
      badge:    '💡 TIP',
      title:    `No budget set for ${cat}`,
      body:     `You've spent <strong>${curr}${_fmt(amt)}</strong> on ${cat} this month but have no budget limit set for it. Setting a limit helps you spot overspending before it happens. Try capping it at your current spend.`,
      action:   { label: 'Set Budget', page: 'budgets' },
    });
  }

  // ─── TIP 10: SPENDING VS LAST MONTH (priority 3) ─────────
  if (lastExpense > 0 && curExpense > 0) {
    const delta    = ((curExpense - lastExpense) / lastExpense) * 100;
    const absDelta = Math.abs(delta).toFixed(0);
    if (delta <= -10) {
      tips.push({
        id:       'vs-last-month-good',
        priority: 3,
        type:     'good',
        badge:    '📉 TREND',
        title:    `Spending down ${absDelta}% vs last month`,
        body:     `You've spent <strong>${curr}${_fmt(curExpense)}</strong> so far this month vs <strong>${curr}${_fmt(lastExpense)}</strong> in ${lastMonthName}. That's a <strong>${absDelta}% reduction</strong> — excellent financial discipline!`,
        action:   null,
      });
    } else if (delta > 30) {
      tips.push({
        id:       'vs-last-month-bad',
        priority: 2,
        type:     'warn',
        badge:    '📈 TREND',
        title:    `Spending up ${absDelta}% vs last month`,
        body:     `You've spent <strong>${curr}${_fmt(curExpense)}</strong> this month vs <strong>${curr}${_fmt(lastExpense)}</strong> in ${lastMonthName} — an increase of <strong>${absDelta}%</strong>. Identify which categories are driving this rise and set limits.`,
        action:   { label: 'View Analytics', page: 'analytics' },
      });
    }
  } else if (curTxs.length > 0 && lastExpense === 0) {
    tips.push({
      id:       'first-month-tip',
      priority: 3,
      type:     'info',
      badge:    '💡 TIP',
      title:    `Great start — you're building your baseline`,
      body:     `This looks like your first full month of tracking. You've recorded <strong>${curr}${_fmt(curExpense)}</strong> in expenses. After two months, BudgetWise can compare your spending and generate much richer insights.`,
      action:   null,
    });
  }

  // ─── TIP 11: ALL BUDGETS UNDER CONTROL (priority 3) ──────
  if (curBudgets.length >= 2) {
    const allGood = curBudgets.every(b => (curCatMap[b.category] || 0) <= b.limit);
    if (allGood) {
      tips.push({
        id:       'all-budgets-ok',
        priority: 3,
        type:     'good',
        badge:    '✅ BUDGET',
        title:    `All ${curBudgets.length} budgets on track`,
        body:     `You're within your spending limits across all <strong>${curBudgets.length}</strong> budget categories this month. Excellent self-control — keeping this streak going builds long-term financial stability.`,
        action:   null,
      });
    }
  }

  // Sort by priority then deduplicate by id
  tips.sort((a, b) => a.priority - b.priority);
  return tips;
}

// Dismissed tips stored in localStorage
function _getDismissedTips() {
  try { return JSON.parse(localStorage.getItem('bw_dismissed_tips') || '[]'); } catch { return []; }
}
function _saveDismissedTips(list) {
  localStorage.setItem('bw_dismissed_tips', JSON.stringify(list));
}

function dismissTip(tipId) {
  const dismissed = _getDismissedTips();
  if (!dismissed.includes(tipId)) dismissed.push(tipId);
  _saveDismissedTips(dismissed);
  renderInsightsCard();
}

function dismissAllTips() {
  const dismissed = _getDismissedTips();
  _allTips.forEach(t => { if (!dismissed.includes(t.id)) dismissed.push(t.id); });
  _saveDismissedTips(dismissed);
  renderInsightsCard();
}

function refreshTips() {
  // Clear dismissed list and re-render
  localStorage.removeItem('bw_dismissed_tips');
  _tipShowCount = 4;
  const btn = document.getElementById('tips-refresh-btn');
  if (btn) {
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s ease';
    setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 500);
  }
  renderInsightsCard();
}

function showMoreTips() {
  _tipShowCount += 3;
  renderInsightsCard();
}

function _tipTypeClass(type) {
  return { alert: 'bad', warn: 'warn', good: 'good', info: 'info' }[type] || 'neutral';
}

function renderInsightsCard() {
  const txs      = DB.getTransactions();
  const budgets  = DB.getBudgets();
  const goals    = DB.getGoals ? DB.getGoals() : [];
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const now      = new Date();

  const bodyEl   = document.getElementById('insights-body');
  const emptyEl  = document.getElementById('insights-empty');
  const subEl    = document.getElementById('insights-period');
  const footerEl = document.getElementById('tips-footer');
  const countEl  = document.getElementById('tips-count-badge');
  if (!bodyEl) return;

  const monthName = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const curMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curTxs    = txs.filter(t => t.date.startsWith(curMonth));
  if (subEl) subEl.textContent = `${monthName} · personalised`;

  if (curTxs.length === 0) {
    bodyEl.innerHTML = '';
    if (emptyEl)  emptyEl.classList.remove('hidden');
    if (footerEl) footerEl.style.display = 'none';
    if (countEl)  countEl.textContent = '';
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  // Generate all tips
  _allTips = _generateTips(txs, budgets, goals, settings);

  // Filter out dismissed
  const dismissed = _getDismissedTips();
  const visible   = _allTips.filter(t => !dismissed.includes(t.id));

  if (visible.length === 0) {
    bodyEl.innerHTML = '<div class="tips-all-clear"><span>✨</span><p>You\'re all caught up — no tips right now. Check back after more transactions.</p></div>';
    if (footerEl) footerEl.style.display = 'none';
    if (countEl)  countEl.textContent = '';
    return;
  }

  // Count badge
  const urgentCount = visible.filter(t => t.priority === 1).length;
  if (countEl) {
    countEl.textContent  = urgentCount > 0 ? `${urgentCount} urgent` : `${visible.length} tips`;
    countEl.className    = 'tips-count-badge' + (urgentCount > 0 ? ' urgent' : '');
  }

  // Render visible slice
  const shown = visible.slice(0, _tipShowCount);
  bodyEl.innerHTML = '';
  shown.forEach(tip => {
    const cls = _tipTypeClass(tip.type);
    const el  = document.createElement('div');
    el.className = `tip-card ${cls}`;
    el.dataset.tipId = tip.id;
    el.innerHTML = `
      <div class="tip-card-top">
        <span class="tip-badge tip-badge-${tip.type}">${tip.badge}</span>
        <button class="tip-dismiss-btn" onclick="dismissTip('${tip.id}')" title="Dismiss this tip">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="tip-title">${tip.title}</div>
      <div class="tip-body">${tip.body}</div>
      ${tip.action ? `<button class="tip-action-btn" onclick="navigate('${tip.action.page}')">${tip.action.label} →</button>` : ''}
    `;
    bodyEl.appendChild(el);
  });

  // Footer
  if (footerEl) {
    const hasMore = visible.length > _tipShowCount;
    footerEl.style.display = (visible.length > 1) ? 'flex' : 'none';
    const moreBtn = document.getElementById('tips-show-more');
    if (moreBtn) {
      moreBtn.style.display = hasMore ? 'inline-flex' : 'none';
      moreBtn.textContent   = `Show ${Math.min(3, visible.length - _tipShowCount)} more tips`;
    }
  }
}

// ============================================================
// DEMO DATA LOADER
// ============================================================

async function loadDemoData() {
  if (!confirm(
    'This will add 4 months of realistic sample transactions, budgets, and goals.\n\nYour existing data will NOT be deleted. Continue?'
  )) return;

  const btn = document.getElementById('demo-load-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }

  try {
    const now = new Date();

    // Returns YYYY-MM-DD for (monthOffset, day), clamped to valid calendar dates
    function ds(monthOffset, day) {
      const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, daysInMonth));
      return d.toISOString().split('T')[0];
    }

    const today = now.toISOString().split('T')[0];

    const transactions = [
      // ── 3 months ago ─────────────────────────────────────────────
      { date: ds(-3,  1), type: 'income',  description: 'Monthly Salary',          category: 'Income',       amount: 150000 },
      { date: ds(-3,  3), type: 'expense', description: 'Electricity Bill',         category: 'Utilities',    amount: 18500  },
      { date: ds(-3,  6), type: 'expense', description: 'Grocery Shopping',         category: 'Food & Dining',amount: 22000  },
      { date: ds(-3,  9), type: 'expense', description: 'Uber rides',               category: 'Transport',    amount: 8500   },
      { date: ds(-3, 11), type: 'expense', description: 'Netflix subscription',     category: 'Entertainment',amount: 4600   },
      { date: ds(-3, 13), type: 'expense', description: 'Lunch at restaurant',      category: 'Food & Dining',amount: 6800   },
      { date: ds(-3, 15), type: 'income',  description: 'Freelance Project',        category: 'Income',       amount: 65000  },
      { date: ds(-3, 17), type: 'expense', description: 'New shoes',                category: 'Shopping',     amount: 28000  },
      { date: ds(-3, 19), type: 'expense', description: 'Internet bill',            category: 'Utilities',    amount: 12000  },
      { date: ds(-3, 21), type: 'expense', description: 'Doctor visit',             category: 'Healthcare',   amount: 15000  },
      { date: ds(-3, 24), type: 'expense', description: 'Fuel',                     category: 'Transport',    amount: 12000  },
      { date: ds(-3, 27), type: 'expense', description: 'Online course',            category: 'Education',    amount: 20000  },

      // ── 2 months ago ─────────────────────────────────────────────
      { date: ds(-2,  1), type: 'income',  description: 'Monthly Salary',          category: 'Income',       amount: 150000 },
      { date: ds(-2,  3), type: 'expense', description: 'Electricity Bill',         category: 'Utilities',    amount: 21000  },
      { date: ds(-2,  5), type: 'expense', description: 'Grocery Shopping',         category: 'Food & Dining',amount: 19500  },
      { date: ds(-2,  8), type: 'expense', description: 'Bus fare',                 category: 'Transport',    amount: 6000   },
      { date: ds(-2, 10), type: 'expense', description: 'Cinema tickets',           category: 'Entertainment',amount: 8000   },
      { date: ds(-2, 12), type: 'expense', description: 'Lunch & dinner out',       category: 'Food & Dining',amount: 14200  },
      { date: ds(-2, 14), type: 'expense', description: 'Phone accessories',        category: 'Shopping',     amount: 15000  },
      { date: ds(-2, 16), type: 'income',  description: 'Side hustle payment',      category: 'Income',       amount: 42000  },
      { date: ds(-2, 18), type: 'expense', description: 'Internet bill',            category: 'Utilities',    amount: 12000  },
      { date: ds(-2, 20), type: 'expense', description: 'Fuel',                     category: 'Transport',    amount: 9500   },
      { date: ds(-2, 22), type: 'expense', description: 'Laptop accessories',       category: 'Shopping',     amount: 95000  }, // anomaly
      { date: ds(-2, 25), type: 'expense', description: 'Pharmacy',                 category: 'Healthcare',   amount: 5500   },
      { date: ds(-2, 27), type: 'expense', description: 'Books & study material',   category: 'Education',    amount: 18000  },

      // ── Last month ───────────────────────────────────────────────
      { date: ds(-1,  1), type: 'income',  description: 'Monthly Salary',          category: 'Income',       amount: 150000 },
      { date: ds(-1,  2), type: 'expense', description: 'Electricity Bill',         category: 'Utilities',    amount: 19800  },
      { date: ds(-1,  4), type: 'expense', description: 'Grocery Shopping',         category: 'Food & Dining',amount: 24000  },
      { date: ds(-1,  6), type: 'expense', description: 'Uber rides',               category: 'Transport',    amount: 11000  },
      { date: ds(-1,  9), type: 'expense', description: 'Spotify + Netflix',         category: 'Entertainment',amount: 6600   },
      { date: ds(-1, 11), type: 'expense', description: 'Fast food & drinks',       category: 'Food & Dining',amount: 9800   },
      { date: ds(-1, 14), type: 'income',  description: 'Freelance Design Work',    category: 'Income',       amount: 78000  },
      { date: ds(-1, 15), type: 'expense', description: 'Clothes shopping',         category: 'Shopping',     amount: 32000  },
      { date: ds(-1, 18), type: 'expense', description: 'Internet bill',            category: 'Utilities',    amount: 12000  },
      { date: ds(-1, 20), type: 'expense', description: 'Fuel',                     category: 'Transport',    amount: 13500  },
      { date: ds(-1, 22), type: 'expense', description: 'Gym membership',           category: 'Healthcare',   amount: 8000   },
      { date: ds(-1, 24), type: 'expense', description: 'Online courses',           category: 'Education',    amount: 22000  },
      { date: ds(-1, 27), type: 'expense', description: 'Dinner with friends',      category: 'Food & Dining',amount: 18500  },

      // ── This month (partial — only dates up to today) ────────────
      { date: ds(0,  1), type: 'income',  description: 'Monthly Salary',           category: 'Income',       amount: 150000 },
      { date: ds(0,  2), type: 'expense', description: 'Electricity Bill',          category: 'Utilities',    amount: 20500  },
      { date: ds(0,  4), type: 'expense', description: 'Grocery Shopping',          category: 'Food & Dining',amount: 16000  },
      { date: ds(0,  6), type: 'expense', description: 'Uber rides',                category: 'Transport',    amount: 7000   },
      { date: ds(0,  8), type: 'expense', description: 'Cinema & snacks',           category: 'Entertainment',amount: 9500   },
      { date: ds(0,  9), type: 'expense', description: 'Restaurant lunch',          category: 'Food & Dining',amount: 7200   },
      { date: ds(0, 10), type: 'expense', description: 'Emergency home repair',     category: 'Utilities',    amount: 85000  }, // anomaly
      { date: ds(0, 12), type: 'expense', description: 'Fuel',                      category: 'Transport',    amount: 8500   },
      { date: ds(0, 14), type: 'expense', description: 'Pharmacy',                  category: 'Healthcare',   amount: 6200   },
      { date: ds(0, 15), type: 'income',  description: 'Bonus payment',             category: 'Income',       amount: 35000  },
    ].filter(t => t.date <= today); // never insert future dates

    let txCount = 0;
    for (const tx of transactions) {
      try { await DB.addTransaction({ ...tx, note: '' }); txCount++; } catch { /* skip */ }
    }

    // Budgets for current month
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const budgets = [
      { category: 'Food & Dining', limit: 35000, month: curMonth },
      { category: 'Transport',     limit: 15000, month: curMonth },
      { category: 'Shopping',      limit: 25000, month: curMonth },
      { category: 'Entertainment', limit: 12000, month: curMonth },
      { category: 'Utilities',     limit: 25000, month: curMonth },
      { category: 'Healthcare',    limit: 10000, month: curMonth },
    ];
    let budgetCount = 0;
    for (const b of budgets) {
      try { await DB.addBudget(b); budgetCount++; } catch { /* skip duplicates */ }
    }

    // Goals
    const goals = [
      { name: 'Emergency Fund',   target_amount: 500000, current_amount: 185000 },
      { name: 'New Laptop',       target_amount: 250000, current_amount: 227500 },
      { name: 'Vacation Savings', target_amount: 300000, current_amount:  45000 },
    ];
    let goalCount = 0;
    for (const g of goals) {
      try { await DB.addGoal(g); goalCount++; } catch { /* skip */ }
    }

    showToast(
      `Demo loaded — ${txCount} transactions, ${budgetCount} budgets, ${goalCount} goals added.`,
      'success', 5000
    );
    navigate('dashboard');

  } catch (e) {
    showToast('Could not load demo data. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Load demo data'; }
  }
}

// ============================================================
// NOTIFICATION CENTRE
// ============================================================

const NOTIF_KEY = 'bw_notifications';

function _loadNotifs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

function _saveNotifs(list) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify(list));
}

/**
 * Scan the current data and produce notifications.
 * Deduplicates by ID so repeated dashboard visits don't stack duplicates.
 */
function generateNotifications() {
  const txs      = DB.getTransactions();
  const budgets  = DB.getBudgets();
  const goals    = (typeof DB.getGoals === 'function') ? DB.getGoals() : [];
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const now      = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const curTxs   = txs.filter(t => t.date.startsWith(curMonth));

  const existing = _loadNotifs();
  const existIds = new Set(existing.map(n => n.id));
  const fresh    = [];

  // ── Budget alerts ────────────────────────────────────────────────────────
  const curBudgets = budgets.filter(b => b.month === curMonth);
  curBudgets.forEach(b => {
    const spent = curTxs
      .filter(t => t.type === 'expense' && t.category === b.category)
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;

    if (pct >= 100) {
      const id = `budget-over-${curMonth}-${b.category}`;
      if (!existIds.has(id)) {
        fresh.push({
          id, type: 'danger', read: false, ts: Date.now(),
          title: `Budget exceeded — ${b.category}`,
          body:  `You've spent ${curr}${Math.round(spent).toLocaleString()} of your ${curr}${Math.round(b.limit).toLocaleString()} budget (${Math.round(pct)}%).`,
        });
      }
    } else if (pct >= 80) {
      const id = `budget-warn-${curMonth}-${b.category}`;
      if (!existIds.has(id)) {
        fresh.push({
          id, type: 'warning', read: false, ts: Date.now(),
          title: `Budget almost full — ${b.category}`,
          body:  `${Math.round(pct)}% used. ${curr}${Math.round(b.limit - spent).toLocaleString()} remaining this month.`,
        });
      }
    }
  });

  // ── ML anomaly alerts ────────────────────────────────────────────────────
  const anomalies = curTxs.filter(t => t.is_anomaly);
  if (anomalies.length > 0) {
    const id = `anomaly-${curMonth}-${anomalies.length}`;
    if (!existIds.has(id)) {
      fresh.push({
        id, type: 'warning', read: false, ts: Date.now(),
        title: `${anomalies.length} unusual transaction${anomalies.length > 1 ? 's' : ''} detected`,
        body:  `The ML model flagged ${anomalies.length} suspicious transaction${anomalies.length > 1 ? 's' : ''} this month. Review them in ML Insights.`,
      });
    }
  }

  // ── Goal alerts ──────────────────────────────────────────────────────────
  goals.forEach(g => {
    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
    if (pct >= 100) {
      const id = `goal-done-${g.id}`;
      if (!existIds.has(id)) {
        fresh.push({
          id, type: 'success', read: false, ts: Date.now(),
          title: `Goal reached — ${g.name}`,
          body:  `You've hit your ${curr}${Math.round(g.target_amount).toLocaleString()} target. Congratulations!`,
        });
      }
    } else if (pct >= 90) {
      const id = `goal-near-${g.id}`;
      if (!existIds.has(id)) {
        fresh.push({
          id, type: 'info', read: false, ts: Date.now(),
          title: `Almost there — ${g.name}`,
          body:  `${Math.round(pct)}% of your goal reached. Just ${curr}${Math.round(g.target_amount - g.current_amount).toLocaleString()} to go!`,
        });
      }
    }
  });

  // Merge fresh notifications at the front (newest first)
  if (fresh.length > 0) {
    _saveNotifs([...fresh, ...existing].slice(0, 50)); // cap at 50
    renderNotifPanel();
  }
}

/**
 * Render the notification panel list and update the badge.
 */
function renderNotifPanel() {
  const list    = _loadNotifs();
  const listEl  = document.getElementById('notif-list');
  const emptyEl = document.getElementById('notif-empty');
  const badge   = document.getElementById('notif-badge');
  if (!listEl) return;

  const unread = list.filter(n => !n.read).length;

  // Badge
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.toggle('hidden', unread === 0);
  }

  // Remove existing items (keep empty placeholder)
  listEl.querySelectorAll('.notif-item').forEach(el => el.remove());

  if (list.length === 0) {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const typeIcons = { danger: '🔴', warning: '🟡', success: '🟢', info: '🔵' };

  list.forEach(n => {
    const item = document.createElement('div');
    item.className = `notif-item notif-${n.type}${n.read ? '' : ' unread'}`;
    item.innerHTML = `
      <span class="notif-icon">${typeIcons[n.type] || '🔵'}</span>
      <div class="notif-content">
        <div class="notif-title">${n.title}</div>
        <div class="notif-body">${n.body}</div>
      </div>
      ${!n.read ? '<span class="notif-dot"></span>' : ''}
    `;
    // Clicking marks it as read
    item.addEventListener('click', () => {
      const all = _loadNotifs();
      const idx = all.findIndex(x => x.id === n.id);
      if (idx !== -1) { all[idx].read = true; _saveNotifs(all); renderNotifPanel(); }
    });
    listEl.appendChild(item);
  });
}

function toggleNotifPanel() {
  const panel   = document.getElementById('notif-panel');
  const overlay = document.getElementById('notif-overlay');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    if (overlay) overlay.classList.remove('hidden');
    renderNotifPanel();
  } else {
    closeNotifPanel();
  }
}

function closeNotifPanel() {
  document.getElementById('notif-panel')?.classList.add('hidden');
  document.getElementById('notif-overlay')?.classList.add('hidden');
}

function markAllNotifsRead() {
  const all = _loadNotifs().map(n => ({ ...n, read: true }));
  _saveNotifs(all);
  renderNotifPanel();
}

function clearAllNotifs() {
  _saveNotifs([]);
  renderNotifPanel();
}

// NOTE: Auto-login on page load is handled in auth.js (DOMContentLoaded listener).
// initApp() is called by auth.js after DB.loadAll() completes successfully.
