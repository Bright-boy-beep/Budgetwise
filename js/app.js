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
  document.getElementById('settings-name').value     = settings.name || user.name || '';
  document.getElementById('settings-email').value    = user.email || '';
  document.getElementById('settings-currency').value = settings.currency || '₦';
  document.getElementById('settings-theme').value    = settings.theme || 'light';

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
  const titles = { dashboard:'Dashboard', transactions:'Transactions', budgets:'Budgets', analytics:'Analytics', settings:'Settings' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  currentPage = page;

  // Render page-specific content
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'dashboard':
      updateSummaryCards();
      renderRecentTransactions();
      renderDashboardBudgets();
      renderAllCharts();
      break;
    case 'transactions':
      renderAllTransactions();
      break;
    case 'budgets':
      renderBudgets();
      break;
    case 'analytics':
      renderAnalyticsCharts();
      break;
    case 'settings':
      // Already set in initApp
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
  document.getElementById('sidebar').classList.toggle('open');
}

// ---- Theme ----

function applyTheme(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  // Re-render charts with correct colors
  setTimeout(() => {
    if (currentPage === 'dashboard') renderAllCharts();
    if (currentPage === 'analytics') renderAnalyticsCharts();
  }, 100);
}

// ---- Settings ----

function saveSettings() {
  const name     = document.getElementById('settings-name').value.trim();
  const currency = document.getElementById('settings-currency').value;
  const theme    = document.getElementById('settings-theme').value;

  DB.saveSettings({ name, currency, theme, email: DB.getSession()?.email || '' });
  applyTheme(theme);
  updateCurrencyLabels();

  // Update sidebar name
  if (name) document.getElementById('sidebar-name').textContent = name;

  showToast('Settings saved!');

  // Refresh current page to reflect currency changes
  refreshAll();
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
  showToast('Data exported!');
}

function clearAllData() {
  if (!confirm('This will delete ALL your transactions and budgets. This cannot be undone. Continue?')) return;
  if (!confirm('Are you absolutely sure?')) return;
  DB.clearUserData();
  showToast('All data cleared.');
  refreshAll();
}

// ---- Greeting ----

function setGreeting() {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const session = DB.getSession();
  const name = session?.name ? ', ' + session.name.split(' ')[0] : '';
  const el = document.getElementById('greeting');
  if (el) el.textContent = greeting + name + '!';
}

// ---- Toast ----

function showToast(msg, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ---- Init on DOMContentLoaded ----

document.addEventListener('DOMContentLoaded', () => {
  const session = DB.getSession();
  if (session) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp(session);
  }
});
