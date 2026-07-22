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
  document.getElementById('forgot-form').classList.add('hidden');
  document.getElementById('reset-form').classList.add('hidden');
  document.getElementById('auth-tabs').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active',
      (i === 0 && tab === 'login') || (i === 1 && tab === 'register')
    );
  });
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('reg-error').classList.add('hidden');
}

// Show the forgot-password form
function showForgotPassword() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('auth-tabs').classList.add('hidden');
  document.getElementById('forgot-form').classList.remove('hidden');
  document.getElementById('reset-form').classList.add('hidden');
  document.getElementById('forgot-email').value = '';
  document.getElementById('forgot-error').classList.add('hidden');
  document.getElementById('forgot-success').classList.add('hidden');
}

// Return to the login tab from any sub-form
function showLoginForm() {
  switchAuthTab('login');
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

// ── Forgot Password ───────────────────────────────────────────

async function handleForgotPassword() {
  const email   = document.getElementById('forgot-email').value.trim();
  const errEl   = document.getElementById('forgot-error');
  const succEl  = document.getElementById('forgot-success');
  const btn     = document.getElementById('forgot-btn');
  errEl.classList.add('hidden');
  succEl.classList.add('hidden');

  if (!email) { showAuthError(errEl, 'Please enter your email address.'); return; }
  if (!email.includes('@')) { showAuthError(errEl, 'Please enter a valid email address.'); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';
  try {
    const res = await API.post('/auth/forgot-password', { email });
    succEl.textContent = res.message || 'Check your email for a reset link.';
    succEl.classList.remove('hidden');
    btn.textContent = 'Sent!';
  } catch (e) {
    showAuthError(errEl, e.message || 'Something went wrong. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}

// ── Reset Password ─────────────────────────────────────────────

async function handleResetPassword() {
  const password = document.getElementById('reset-password').value;
  const confirm  = document.getElementById('reset-confirm').value;
  const errEl    = document.getElementById('reset-error');
  const succEl   = document.getElementById('reset-success');
  const btn      = document.getElementById('reset-btn');
  const token    = new URLSearchParams(window.location.search).get('reset_token');

  errEl.classList.add('hidden');
  succEl.classList.add('hidden');

  if (!password)             { showAuthError(errEl, 'Please enter a new password.'); return; }
  if (password.length < 6)   { showAuthError(errEl, 'Password must be at least 6 characters.'); return; }
  if (password !== confirm)  { showAuthError(errEl, 'Passwords do not match.'); return; }

  btn.disabled = true;
  btn.textContent = 'Updating…';
  try {
    const res = await API.post('/auth/reset-password', { token, password });
    succEl.textContent = res.message || 'Password updated! You can now sign in.';
    succEl.classList.remove('hidden');
    btn.textContent = 'Done!';
    // Clean the token from the URL and redirect to login after 2s
    setTimeout(() => {
      window.history.replaceState({}, '', '/');
      showLoginForm();
    }, 2000);
  } catch (e) {
    showAuthError(errEl, e.message || 'Reset failed. The link may have expired.');
    btn.disabled = false;
    btn.textContent = 'Update Password';
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

// ── Password visibility toggle ────────────────────────────────

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.querySelector('.eye-show').style.display = show ? 'none'  : '';
  btn.querySelector('.eye-hide').style.display = show ? ''      : 'none';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
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
  // If the URL contains ?reset_token=, show the reset-password form immediately
  const resetToken = new URLSearchParams(window.location.search).get('reset_token');
  if (resetToken) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('auth-tabs').classList.add('hidden');
    document.getElementById('reset-form').classList.remove('hidden');
    return;   // Don't attempt auto-login when handling a reset link
  }

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
