// ============================================================
// AUTH MODULE — Login, Register, Logout
// ============================================================

function switchAuthTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
}

function handleLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!email || !password) {
    showAuthError(errEl, 'Please fill in all fields.');
    return;
  }

  if (!email.includes('@')) {
    showAuthError(errEl, 'Please enter a valid email address.');
    return;
  }

  const user = DB.findUser(email);
  if (!user || user.password !== password) {
    showAuthError(errEl, 'Incorrect email or password. Please try again.');
    return;
  }

  loginUser(user);
}

function handleRegister() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('reg-error');
  errEl.classList.add('hidden');

  if (!name || !email || !password) {
    showAuthError(errEl, 'Please fill in all fields.');
    return;
  }

  if (password.length < 6) {
    showAuthError(errEl, 'Password must be at least 6 characters.');
    return;
  }

  if (!email.includes('@')) {
    showAuthError(errEl, 'Please enter a valid email address.');
    return;
  }

  const user = DB.createUser(name, email, password);
  if (!user) {
    showAuthError(errEl, 'An account with this email already exists.');
    return;
  }

  // Save default settings for this new user
  DB.setSession(user);
  DB.saveSettings({ currency: '₦', theme: 'light', name: user.name, email: user.email });
  DB.clearSession();

  loginUser(user);
}

function loginUser(user) {
  DB.setSession(user);
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  initApp(user);
}

function handleLogout() {
  if (!confirm('Are you sure you want to sign out?')) return;
  DB.clearSession();
  location.reload();
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---- Auto-login if a session already exists in localStorage ----
(function checkSession() {
  const session = DB.getSession();
  if (session) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    window.addEventListener('DOMContentLoaded', () => initApp(session));
  }
})();
