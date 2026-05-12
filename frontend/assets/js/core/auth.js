// ============================================================
// AUTH MODULE — Login, Register, Logout
// All calls go to the Flask API. JWT token is stored in
// localStorage under the key 'bw_token'.
// ============================================================

// ── Tab switching ─────────────────────────────────────────────

function switchAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active',
      (i === 0 && tab === 'login') || (i === 1 && tab === 'register')
    );
  });
  // Clear any lingering error messages on tab switch
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

// ── Login ─────────────────────────────────────────────────────

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) { showAuthError(errEl, 'Please fill in all fields.'); return; }
  if (!email.includes('@')) { showAuthError(errEl, 'Please enter a valid email address.'); return; }

  setAuthLoading(true, 'login');
  try {
    const res = await API.post('/auth/login', { email, password });
    localStorage.setItem('bw_token', res.token);
    await DB.loadAll();
    launchApp(DB.getSession());
  } catch (e) {
    showAuthError(errEl, e.message);
  } finally {
    setAuthLoading(false, 'login');
  }
}

// ── Register ──────────────────────────────────────────────────

async function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !password) { showAuthError(errEl, 'Please fill in all fields.'); return; }
  if (password.length < 6)          { showAuthError(errEl, 'Password must be at least 6 characters.'); return; }
  if (!email.includes('@'))         { showAuthError(errEl, 'Please enter a valid email address.'); return; }

  setAuthLoading(true, 'register');
  try {
    const res = await API.post('/auth/register', { name, email, password });
    localStorage.setItem('bw_token', res.token);
    await DB.loadAll();
    launchApp(DB.getSession());
  } catch (e) {
    showAuthError(errEl, e.message);
  } finally {
    setAuthLoading(false, 'register');
  }
}

// ── Logout ────────────────────────────────────────────────────

function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  DB.clearSession();
  location.reload();
}

// ── Launch app after successful auth ─────────────────────────

function launchApp(user) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp(user);
}

// ── UI helpers ────────────────────────────────────────────────

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setAuthLoading(on, form) {
  const btnId = form === 'login' ? 'login-btn' : 'reg-btn';
  const btn   = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? 'Please wait…' : (form === 'login' ? 'Sign In' : 'Create Account');
}

// ── Auto-login on page load (token already in localStorage) ──

window.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('bw_token');
  if (!token) return;   // No saved session → show login screen

  // Show a subtle loading state while we verify the token
  const authScreen = document.getElementById('auth-screen');
  const loadMsg    = document.createElement('p');
  loadMsg.id       = 'auth-loading-msg';
  loadMsg.style.cssText = 'text-align:center;color:var(--text-muted);font-size:14px;margin-top:1rem';
  loadMsg.textContent   = 'Signing you in…';
  if (authScreen) authScreen.appendChild(loadMsg);

  try {
    await DB.loadAll();          // Verify token + load all data
    launchApp(DB.getSession());  // Token valid — go straight to app
  } catch (_) {
    // Token expired or backend unreachable — fall back to login screen
    DB.clearSession();
    if (loadMsg) loadMsg.remove();
  }
});
