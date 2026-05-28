// ============================================================
// AUTH MODULE — Login, Register, Logout, Google OAuth
// All calls go to the Flask API. JWT token is stored in
// localStorage under the key 'bw_token'.
// ============================================================

// ── Google Sign-In ───────────────────────────────────────────
//
// Uses Google Identity Services (GSI) renderButton() — the most reliable
// approach for button-triggered sign-in. GSI calls window.onGoogleLibraryLoad
// when it's ready, so there are no timing issues with async script loading.

let _googleClientId = null;

// GSI calls this automatically as soon as its script finishes loading.
// We fetch the client ID, then render Google's button into both form containers.
window.onGoogleLibraryLoad = async function () {
  try {
    const res = await fetch('/api/auth/google-client-id');
    if (!res.ok) return;   // Google Sign-In not configured on this server
    const data = await res.json();
    if (!data.client_id) return;

    _googleClientId = data.client_id;

    // Initialise GSI with our credential callback
    google.accounts.id.initialize({
      client_id: _googleClientId,
      callback:  handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Render Google's official button into both form containers
    const btnOptions = {
      theme: 'outline',
      size:  'large',
      text:  'continue_with',
      shape: 'rectangular',
      width: 360,          // matches auth card width
    };

    const loginWrap    = document.getElementById('google-btn-login');
    const registerWrap = document.getElementById('google-btn-register');

    if (loginWrap) {
      google.accounts.id.renderButton(loginWrap, btnOptions);
      loginWrap.classList.remove('hidden');
    }
    if (registerWrap) {
      google.accounts.id.renderButton(registerWrap, btnOptions);
      registerWrap.classList.remove('hidden');
    }

    // Show the "or use email" dividers
    document.querySelectorAll('.auth-divider').forEach(el => el.classList.remove('hidden'));

  } catch (e) {
    // Google Sign-In unavailable — silently leave button containers hidden
    console.warn('Google Sign-In init failed:', e);
  }
};

// Called by GSI after the user selects their Google account in the popup
async function handleGoogleCredential(response) {
  try {
    const res = await API.post('/auth/google', { credential: response.credential });
    localStorage.setItem('bw_token', res.token);
    await DB.loadAll();
    launchApp(DB.getSession());
  } catch (e) {
    const msg = e.message || 'Google Sign-In failed. Please try again.';
    // Show error on whichever tab is currently visible
    const loginForm = document.getElementById('login-form');
    const errEl = loginForm && !loginForm.classList.contains('hidden')
      ? document.getElementById('login-error')
      : document.getElementById('reg-error');
    if (errEl) showAuthError(errEl, msg);
  }
}

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
