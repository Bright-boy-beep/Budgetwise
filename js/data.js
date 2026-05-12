// ============================================================
// DATA LAYER — localStorage management
// All data is namespaced per user so multiple accounts work
// ============================================================

const DB = {
    // ---- Keys ----
    USERS: 'bw_users',
    SESSION: 'bw_session',
    prefix(key) { return `bw_${this.currentUser()}_${key}`; },
    currentUser() {
      const s = localStorage.getItem(DB.SESSION);
      return s ? JSON.parse(s).email.replace(/[^a-z0-9]/gi, '_') : 'guest';
    },
  
    // ---- Users ----
    getUsers() { return JSON.parse(localStorage.getItem(DB.USERS) || '[]'); },
    saveUsers(users) { localStorage.setItem(DB.USERS, JSON.stringify(users)); },
    findUser(email) { return this.getUsers().find(u => u.email === email.toLowerCase()); },
    createUser(name, email, password) {
      const users = this.getUsers();
      if (users.find(u => u.email === email.toLowerCase())) return null;
      const user = { name, email: email.toLowerCase(), password };
      users.push(user);
      this.saveUsers(users);
      return user;
    },
  
    // ---- Session ----
    getSession() { return JSON.parse(localStorage.getItem(DB.SESSION) || 'null'); },
    setSession(user) { localStorage.setItem(DB.SESSION, JSON.stringify(user)); },
    clearSession() { localStorage.removeItem(DB.SESSION); },
  
    // ---- Transactions ----
    getTransactions() {
      return JSON.parse(localStorage.getItem(this.prefix('txs')) || '[]');
    },
    saveTransactions(txs) {
      localStorage.setItem(this.prefix('txs'), JSON.stringify(txs));
    },
    addTransaction(tx) {
      const txs = this.getTransactions();
      tx.id = Date.now().toString();
      tx.createdAt = new Date().toISOString();
      txs.unshift(tx);
      this.saveTransactions(txs);
      return tx;
    },
    updateTransaction(id, updates) {
      const txs = this.getTransactions();
      const idx = txs.findIndex(t => t.id === id);
      if (idx !== -1) { txs[idx] = { ...txs[idx], ...updates }; this.saveTransactions(txs); }
    },
    deleteTransaction(id) {
      const txs = this.getTransactions().filter(t => t.id !== id);
      this.saveTransactions(txs);
    },
  
    // ---- Budgets ----
    getBudgets() {
      return JSON.parse(localStorage.getItem(this.prefix('budgets')) || '[]');
    },
    saveBudgets(bs) {
      localStorage.setItem(this.prefix('budgets'), JSON.stringify(bs));
    },
    addBudget(b) {
      const bs = this.getBudgets();
      b.id = Date.now().toString();
      const existing = bs.findIndex(x => x.category === b.category && x.month === b.month);
      if (existing !== -1) { bs[existing] = { ...bs[existing], ...b }; }
      else { bs.push(b); }
      this.saveBudgets(bs);
      return b;
    },
    deleteBudget(id) {
      const bs = this.getBudgets().filter(b => b.id !== id);
      this.saveBudgets(bs);
    },
  
    // ---- Settings ----
    getSettings() {
      const defaults = { currency: '₦', theme: 'light', name: '', email: '' };
      return { ...defaults, ...JSON.parse(localStorage.getItem(this.prefix('settings')) || '{}') };
    },
    saveSettings(s) {
      localStorage.setItem(this.prefix('settings'), JSON.stringify(s));
    },
  
    // ---- Helpers ----
    clearUserData() {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(`bw_${this.currentUser()}`));
      keys.forEach(k => localStorage.removeItem(k));
    }
  };
  
  // ---- Category definitions ----
  const CATEGORIES = {
    expense: [
      { name: 'Food & Dining',    icon: '🍽️' },
      { name: 'Transportation',   icon: '🚗' },
      { name: 'Housing',          icon: '🏠' },
      { name: 'Entertainment',    icon: '🎬' },
      { name: 'Healthcare',       icon: '💊' },
      { name: 'Shopping',         icon: '🛍️' },
      { name: 'Education',        icon: '📚' },
      { name: 'Utilities',        icon: '💡' },
      { name: 'Travel',           icon: '✈️' },
      { name: 'Personal Care',    icon: '💆' },
      { name: 'Savings',          icon: '🏦' },
      { name: 'Other',            icon: '📌' },
    ],
    income: [
      { name: 'Salary',           icon: '💼' },
      { name: 'Freelance',        icon: '💻' },
      { name: 'Business',         icon: '🏢' },
      { name: 'Investment',       icon: '📈' },
      { name: 'Gift',             icon: '🎁' },
      { name: 'Rental',           icon: '🏘️' },
      { name: 'Other Income',     icon: '💰' },
    ]
  };
  
  const CATEGORY_COLORS = [
    '#2A6EF5','#18A05A','#E53935','#F4A100','#9B51E0',
    '#00BCD4','#FF5722','#607D8B','#E91E63','#795548',
    '#4CAF50','#FF9800'
  ];
  
  function getCategoryIcon(name) {
    const all = [...CATEGORIES.expense, ...CATEGORIES.income];
    const found = all.find(c => c.name === name);
    return found ? found.icon : '📌';
  }
  
  function getCategoryColor(name) {
    const all = [...CATEGORIES.expense, ...CATEGORIES.income];
    const idx = all.findIndex(c => c.name === name);
    return CATEGORY_COLORS[idx % CATEGORY_COLORS.length] || '#888';
  }
  
  // ---- Seed demo data for demo account ----
  function seedDemoData() {
    const key = 'bw_demo_budgetwisecom_txs';
    if (localStorage.getItem(key)) return;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const fmt = (yr, mo, d) => `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  
    const txs = [
      // Current month
      { id:'d1', type:'income',  description:'Monthly Salary',      amount:450000, category:'Salary',        date:fmt(y,m,1),  note:'', createdAt:new Date(y,m,1).toISOString() },
      { id:'d2', type:'expense', description:'Rent Payment',         amount:80000,  category:'Housing',       date:fmt(y,m,2),  note:'', createdAt:new Date(y,m,2).toISOString() },
      { id:'d3', type:'expense', description:'Supermarket Shopping', amount:22000,  category:'Food & Dining', date:fmt(y,m,4),  note:'', createdAt:new Date(y,m,4).toISOString() },
      { id:'d4', type:'expense', description:'Uber Ride',            amount:3500,   category:'Transportation',date:fmt(y,m,5),  note:'', createdAt:new Date(y,m,5).toISOString() },
      { id:'d5', type:'income',  description:'Freelance Project',    amount:75000,  category:'Freelance',     date:fmt(y,m,6),  note:'', createdAt:new Date(y,m,6).toISOString() },
      { id:'d6', type:'expense', description:'Netflix Subscription', amount:4500,   category:'Entertainment', date:fmt(y,m,7),  note:'', createdAt:new Date(y,m,7).toISOString() },
      { id:'d7', type:'expense', description:'Hospital Visit',       amount:15000,  category:'Healthcare',    date:fmt(y,m,9),  note:'', createdAt:new Date(y,m,9).toISOString() },
      { id:'d8', type:'expense', description:'Restaurant Dinner',    amount:12000,  category:'Food & Dining', date:fmt(y,m,11), note:'', createdAt:new Date(y,m,11).toISOString() },
      { id:'d9', type:'expense', description:'Electricity Bill',     amount:18000,  category:'Utilities',     date:fmt(y,m,12), note:'', createdAt:new Date(y,m,12).toISOString() },
      { id:'d10',type:'expense', description:'Online Shopping',      amount:35000,  category:'Shopping',      date:fmt(y,m,14), note:'', createdAt:new Date(y,m,14).toISOString() },
      { id:'d11',type:'income',  description:'Investment Dividend',  amount:25000,  category:'Investment',    date:fmt(y,m,15), note:'', createdAt:new Date(y,m,15).toISOString() },
      { id:'d12',type:'expense', description:'Gym Membership',       amount:8000,   category:'Personal Care', date:fmt(y,m,16), note:'', createdAt:new Date(y,m,16).toISOString() },
      // Previous month
      { id:'d13',type:'income',  description:'Monthly Salary',       amount:450000, category:'Salary',        date:fmt(y,m-1,1),note:'', createdAt:new Date(y,m-1,1).toISOString() },
      { id:'d14',type:'expense', description:'Rent Payment',         amount:80000,  category:'Housing',       date:fmt(y,m-1,2),note:'', createdAt:new Date(y,m-1,2).toISOString() },
      { id:'d15',type:'expense', description:'Groceries',            amount:28000,  category:'Food & Dining', date:fmt(y,m-1,5),note:'', createdAt:new Date(y,m-1,5).toISOString() },
      { id:'d16',type:'expense', description:'Fuel',                 amount:15000,  category:'Transportation',date:fmt(y,m-1,8),note:'', createdAt:new Date(y,m-1,8).toISOString() },
      { id:'d17',type:'income',  description:'Side Business',        amount:60000,  category:'Business',      date:fmt(y,m-1,10),note:'',createdAt:new Date(y,m-1,10).toISOString() },
      { id:'d18',type:'expense', description:'Data Plan',            amount:9000,   category:'Utilities',     date:fmt(y,m-1,12),note:'',createdAt:new Date(y,m-1,12).toISOString() },
      { id:'d19',type:'expense', description:'Books & Courses',      amount:20000,  category:'Education',     date:fmt(y,m-1,15),note:'',createdAt:new Date(y,m-1,15).toISOString() },
      { id:'d20',type:'expense', description:'Weekend Getaway',      amount:45000,  category:'Travel',        date:fmt(y,m-1,20),note:'',createdAt:new Date(y,m-1,20).toISOString() },
    ];
  
    localStorage.setItem(key, JSON.stringify(txs));
  
    const budgetKey = 'bw_demo_budgetwisecom_budgets';
    const budgets = [
      { id:'b1', category:'Food & Dining', limit:50000,  month:fmt(y,m,1).slice(0,7) },
      { id:'b2', category:'Transportation',limit:20000,  month:fmt(y,m,1).slice(0,7) },
      { id:'b3', category:'Entertainment', limit:10000,  month:fmt(y,m,1).slice(0,7) },
      { id:'b4', category:'Shopping',      limit:30000,  month:fmt(y,m,1).slice(0,7) },
      { id:'b5', category:'Healthcare',    limit:20000,  month:fmt(y,m,1).slice(0,7) },
    ];
    localStorage.setItem(budgetKey, JSON.stringify(budgets));
  
    const settingsKey = 'bw_demo_budgetwisecom_settings';
    localStorage.setItem(settingsKey, JSON.stringify({ currency:'₦', theme:'light', name:'Demo User', email:'demo@budgetwise.com' }));
  }
  