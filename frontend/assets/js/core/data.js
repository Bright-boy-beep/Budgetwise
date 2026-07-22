// ============================================================
// DATA LAYER — API client + in-memory cache
//
// Architecture:
//   • API  → thin HTTP client that attaches the JWT to every request
//   • DB   → in-memory cache; reads are synchronous, writes are async
//             (they call the API and then update the local cache)
//
// This means all existing render functions work unchanged (they
// call DB.getTransactions() synchronously), while only the write
// operations (save/delete) need to be awaited by callers.
// ============================================================

// ── Base URL ─────────────────────────────────────────────────
// API base: use the same origin the app is served from (works when hosted,
// on a phone over the LAN, or via a tunnel). Falls back to localhost:5000
// only for the VS Code Live Server dev setup (port 5500) or file:// preview.
const API_BASE = (location.protocol === 'file:' || location.port === '5500' || location.port === '5501')
  ? 'http://localhost:5000/api'
  : location.origin + '/api';

// ============================================================
// API — HTTP client
// ============================================================
const API = {

  async request(method, path, body = null) {
    const token = localStorage.getItem('bw_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body !== null) opts.body = JSON.stringify(body);

    let res;
    try {
      res = await fetch(API_BASE + path, opts);
    } catch (_) {
      throw new Error('Backend server is not running. Please double-click start_server.bat in the backend folder, then try again.');
    }

    // Handle 204 No Content (e.g. DELETE)
    if (res.status === 204) return null;

    // Handle service-worker offline fallback (503) — treat same as network failure
    if (res.status === 503) {
      throw new Error('Backend server is not running. Please double-click start_server.bat in the backend folder, then try again.');
    }

    // If Flask returned HTML instead of JSON (routing misconfiguration), give a clear error
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server error (${res.status}). Restart Flask and try again.`);
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
    return data;
  },

  get:    (path)              => API.request('GET',    path),
  post:   (path, body)        => API.request('POST',   path, body),
  put:    (path, body)        => API.request('PUT',    path, body),
  delete: (path, body = null) => API.request('DELETE', path, body),
};

// ============================================================
// DB — In-memory cache + API sync
// ============================================================
const DB = {

  // ── Private cache ─────────────────────────────────────────
  _cache: {
    transactions: [],
    budgets:      [],
    goals:        [],
    settings:     { currency: '₦', theme: 'light', name: '', email: '', openingBalance: 0 },
    session:      null,
  },

  // ── Session helpers (persisted in localStorage for page reload) ──

  getSession() {
    if (this._cache.session) return this._cache.session;
    const raw = localStorage.getItem('bw_session');
    return raw ? JSON.parse(raw) : null;
  },

  setSession(user) {
    this._cache.session = user;
    localStorage.setItem('bw_session', JSON.stringify(user));
  },

  clearSession() {
    this._cache.session       = null;
    this._cache.transactions  = [];
    this._cache.budgets       = [];
    this._cache.settings      = { currency: '₦', theme: 'light', name: '', email: '', openingBalance: 0 };
    localStorage.removeItem('bw_session');
    localStorage.removeItem('bw_token');
  },

  // ── Load all user data from API (called once after login) ─────

  async loadAll() {
    // Process any due recurring transactions first, then load fresh data
    try { await API.post('/transactions/process-recurring', {}); } catch (_) {}

    const [txs, budgets, goals, user] = await Promise.all([
      API.get('/transactions/'),
      API.get('/budgets/'),
      API.get('/goals/'),
      API.get('/auth/me'),
    ]);

    // Normalise IDs to strings so onclick="fn('42')" comparisons work
    this._cache.transactions = txs.map(t => ({ ...t, id: String(t.id) }));
    this._cache.budgets      = budgets.map(b => ({ ...b, id: String(b.id) }));
    this._cache.goals        = goals.map(g => ({ ...g, id: String(g.id) }));

    this._cache.settings = {
      name:           user.name,
      email:          user.email,
      currency:       user.currency        || '₦',
      theme:          user.theme           || 'light',
      openingBalance: user.opening_balance || 0,
    };

    this.setSession(user);
    return user;
  },

  // ── Synchronous reads (callers stay unchanged) ────────────────

  getTransactions() { return this._cache.transactions; },
  getBudgets()      { return this._cache.budgets;      },
  getGoals()        { return this._cache.goals;        },
  getSettings()     { return this._cache.settings;     },

  // ── Async transaction writes ──────────────────────────────────

  async addTransaction(tx) {
    const saved = await API.post('/transactions/', tx);
    const norm  = { ...saved, id: String(saved.id) };
    this._cache.transactions.unshift(norm);
    return norm;
  },

  async updateTransaction(id, updates) {
    const saved = await API.put(`/transactions/${id}`, updates);
    const norm  = { ...saved, id: String(saved.id) };
    const idx   = this._cache.transactions.findIndex(t => t.id === String(id));
    if (idx !== -1) this._cache.transactions[idx] = norm;
    return norm;
  },

  async deleteTransaction(id) {
    await API.delete(`/transactions/${id}`);
    this._cache.transactions = this._cache.transactions.filter(t => t.id !== String(id));
  },

  async stopRecurrence(id) {
    const saved = await API.delete(`/transactions/${id}/recurrence`);
    const norm  = { ...saved, id: String(saved.id) };
    const idx   = this._cache.transactions.findIndex(t => t.id === String(id));
    if (idx !== -1) this._cache.transactions[idx] = norm;
    return norm;
  },

  // ── Async budget writes ───────────────────────────────────────

  async addBudget(b) {
    const saved = await API.post('/budgets/', b);
    const norm  = { ...saved, id: String(saved.id) };
    const idx   = this._cache.budgets.findIndex(
      x => x.category === norm.category && x.month === norm.month
    );
    if (idx !== -1) this._cache.budgets[idx] = norm;
    else            this._cache.budgets.push(norm);
    return norm;
  },

  async deleteBudget(id) {
    await API.delete(`/budgets/${id}`);
    this._cache.budgets = this._cache.budgets.filter(b => b.id !== String(id));
  },

  // ── Async goal writes ─────────────────────────────────────────

  async addGoal(g) {
    const saved = await API.post('/goals/', g);
    const norm  = { ...saved, id: String(saved.id) };
    this._cache.goals.unshift(norm);
    return norm;
  },

  async updateGoal(id, updates) {
    const saved = await API.put(`/goals/${id}`, updates);
    const norm  = { ...saved, id: String(saved.id) };
    const idx   = this._cache.goals.findIndex(g => g.id === String(id));
    if (idx !== -1) this._cache.goals[idx] = norm;
    return norm;
  },

  async contributeToGoal(id, amount) {
    const saved = await API.post(`/goals/${id}/contribute`, { amount });
    const norm  = { ...saved, id: String(saved.id) };
    const idx   = this._cache.goals.findIndex(g => g.id === String(id));
    if (idx !== -1) this._cache.goals[idx] = norm;
    return norm;
  },

  async deleteGoal(id) {
    await API.delete(`/goals/${id}`);
    this._cache.goals = this._cache.goals.filter(g => g.id !== String(id));
  },

  // ── Async settings save ───────────────────────────────────────

  async saveSettings(s) {
    const updated = await API.put('/auth/me', {
      name:            s.name,
      currency:        s.currency,
      theme:           s.theme,
      opening_balance: s.openingBalance || 0,
    });
    this._cache.settings = {
      name:           updated.name,
      email:          updated.email,
      currency:       updated.currency        || '₦',
      theme:          updated.theme           || 'light',
      openingBalance: updated.opening_balance || 0,
    };
    this.setSession(updated);
  },

  // ── Compat stub (used in clearAllData button in settings) ────
  clearUserData() { this.clearSession(); },
};

// ============================================================
// CATEGORIES
// ============================================================
const CATEGORIES = {
  expense: [
    { name: 'Food & Dining',   icon: '🍽️' },
    { name: 'Transportation',  icon: '🚗' },
    { name: 'Housing',         icon: '🏠' },
    { name: 'Entertainment',   icon: '🎬' },
    { name: 'Healthcare',      icon: '💊' },
    { name: 'Shopping',        icon: '🛍️' },
    { name: 'Education',       icon: '📚' },
    { name: 'Utilities',       icon: '💡' },
    { name: 'Travel',          icon: '✈️' },
    { name: 'Personal Care',   icon: '💆' },
    { name: 'Savings',         icon: '🏦' },
    { name: 'Other',           icon: '📌' },
  ],
  income: [
    { name: 'Salary',          icon: '💼' },
    { name: 'Freelance',       icon: '💻' },
    { name: 'Business',        icon: '🏢' },
    { name: 'Investment',      icon: '📈' },
    { name: 'Gift',            icon: '🎁' },
    { name: 'Rental',          icon: '🏘️' },
    { name: 'Other Income',    icon: '💰' },
  ],
};

const CATEGORY_COLORS = [
  // Expense categories (12)
  '#7B5CF5', // Food & Dining   — purple
  '#16A34A', // Transportation  — green
  '#DC2626', // Housing         — red
  '#CA8A04', // Entertainment   — amber
  '#2563EB', // Healthcare      — blue
  '#0891B2', // Shopping        — cyan
  '#EA580C', // Education       — orange
  '#9333EA', // Utilities       — violet
  '#DB2777', // Travel          — pink
  '#65A30D', // Personal Care   — lime
  '#059669', // Savings         — emerald
  '#6B7280', // Other           — gray
  // Income categories (7)
  '#0EA5E9', // Salary          — sky
  '#10B981', // Freelance       — teal
  '#6366F1', // Business        — indigo
  '#F59E0B', // Investment      — yellow
  '#EC4899', // Gift            — rose
  '#14B8A6', // Rental          — teal-alt
  '#8B5CF6', // Other Income    — violet-alt
];

function getCategoryIcon(name) {
  const all   = [...CATEGORIES.expense, ...CATEGORIES.income];
  const found = all.find(c => c.name === name);
  return found ? found.icon : '📌';
}

// Returns a proper inline SVG icon for each category (Lucide-style)
function getCategoryIconSVG(name) {
  const icons = {
    // ── Expense ───────────────────────────────────────────────
    'Food & Dining':  '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3"/><path d="M21 15v7"/>',
    'Transportation': '<path d="M5 17H3a2 2 0 0 1-2-2V9l3.5-5h11l3.5 5v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M10 17h4"/>',
    'Housing':        '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'Entertainment':  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
    'Healthcare':     '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'Shopping':       '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'Education':      '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    'Utilities':      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    'Travel':         '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-4 2-4 2l-8.6-1.8c-.6-.1-1.3.1-1.7.5L3 6a1 1 0 0 0 .3 1.6l6.9 4.4L8 15H5l-3 3 4 1 1 4 3-3v-3l4.2-2.2 4.4 6.9c.3.5 1 .7 1.6.3l1.7-1.7c.4-.4.6-1.1.5-1.7z"/>',
    'Personal Care':  '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',
    'Savings':        '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2h0V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><circle cx="16" cy="11" r="1" fill="currentColor"/>',
    'Other':          '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    // ── Income ────────────────────────────────────────────────
    'Salary':         '<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'Freelance':      '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    'Business':       '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v8h4"/><path d="M18 9h2a2 2 0 0 1 2 2v11h-4"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    'Investment':     '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'Gift':           '<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    'Rental':         '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    'Other Income':   '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  };

  const paths = icons[name] || icons['Other'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function getCategoryColor(name) {
  const all = [...CATEGORIES.expense, ...CATEGORIES.income];
  const idx  = all.findIndex(c => c.name === name);
  return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || '#888';
}
