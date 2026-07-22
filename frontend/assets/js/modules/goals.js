/* ============================================================
   goals.js — Savings Goals page module
   ============================================================ */

const GOAL_CATEGORIES = [
  { name: 'Emergency Fund', color: '#DC2626',
    svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { name: 'Travel',         color: '#DB2777',
    svg: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-4 2-4 2l-8.6-1.8c-.6-.1-1.3.1-1.7.5L3 6a1 1 0 0 0 .3 1.6l6.9 4.4L8 15H5l-3 3 4 1 1 4 3-3v-3l4.2-2.2 4.4 6.9c.3.5 1 .7 1.6.3l1.7-1.7c.4-.4.6-1.1.5-1.7z"/>' },
  { name: 'Education',      color: '#EA580C',
    svg: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>' },
  { name: 'Technology',     color: '#0891B2',
    svg: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>' },
  { name: 'Home',           color: '#16A34A',
    svg: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { name: 'Car',            color: '#CA8A04',
    svg: '<path d="M5 17H3a2 2 0 0 1-2-2V9l3.5-5h11l3.5 5v6a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/><path d="M10 17h4"/>' },
  { name: 'Investment',     color: '#10B981',
    svg: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>' },
  { name: 'Wedding',        color: '#EC4899',
    svg: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' },
  { name: 'Health',         color: '#2563EB',
    svg: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
  { name: 'Other',          color: '#7B5CF5',
    svg: '<circle cx="12" cy="12" r="10"/><polyline points="12 8 12 12 14 14"/>' },
];

const CIRCUMFERENCE = 2 * Math.PI * 42; // for r=42 SVG circle

/* ── Entry point ─────────────────────────────────────────────────────────── */
function renderGoals() {
  const list    = document.getElementById('goals-list');
  const empty   = document.getElementById('goals-empty');
  const summary = document.getElementById('goals-summary');
  if (!list) return;

  const goals = DB.getGoals();
  const curr  = DB.getSettings().currency || '₦';

  // Summary bar
  if (summary) {
    const total      = goals.length;
    const completed  = goals.filter(g => g.completed).length;
    const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
    const totalSaved  = goals.reduce((s, g) => s + g.saved_amount, 0);
    summary.innerHTML = total === 0 ? '' : `
      <div class="goals-summary-inner">
        <div class="goals-stat">
          <span class="goals-stat-val">${total}</span>
          <span class="goals-stat-label">Goals</span>
        </div>
        <div class="goals-stat">
          <span class="goals-stat-val green">${completed}</span>
          <span class="goals-stat-label">Completed</span>
        </div>
        <div class="goals-stat">
          <span class="goals-stat-val">${curr}${totalSaved.toLocaleString()}</span>
          <span class="goals-stat-label">Total Saved</span>
        </div>
        <div class="goals-stat">
          <span class="goals-stat-val">${curr}${totalTarget.toLocaleString()}</span>
          <span class="goals-stat-label">Total Target</span>
        </div>
      </div>`;
  }

  list.innerHTML = '';
  if (goals.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  goals.forEach(g => list.appendChild(_renderGoalCard(g, curr)));
}

/* ── Goal card ───────────────────────────────────────────────────────────── */
function _renderGoalCard(g, curr) {
  const cat    = GOAL_CATEGORIES.find(c => c.name === g.category) || GOAL_CATEGORIES[GOAL_CATEGORIES.length - 1];
  const color  = g.color || cat.color;
  const pct    = Math.min(g.percent || 0, 100);
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;
  const remaining = Math.max(g.target_amount - g.saved_amount, 0);

  // Deadline label
  let deadlineHTML = '';
  if (g.deadline) {
    const daysLeft = Math.ceil((new Date(g.deadline) - new Date()) / 86400000);
    const label    = daysLeft < 0
      ? `<span class="goal-deadline overdue">Overdue by ${Math.abs(daysLeft)}d</span>`
      : daysLeft === 0
      ? `<span class="goal-deadline today">Due today</span>`
      : `<span class="goal-deadline">${daysLeft} days left</span>`;
    deadlineHTML = label;
  }

  const div = document.createElement('div');
  div.className = `goal-card${g.completed ? ' goal-completed' : ''}`;
  div.innerHTML = `
    <div class="goal-card-top">
      <div class="goal-icon-wrap" style="background:${color}18;color:${color}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${cat.svg}
        </svg>
      </div>
      <div class="goal-card-actions">
        ${deadlineHTML}
        ${g.completed ? '<span class="goal-done-badge">✓ Done</span>' : ''}
        <button class="goal-btn-icon" onclick="openContributeModal('${g.id}')" title="Add funds"
          ${g.completed ? 'disabled' : ''}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </button>
        <button class="goal-btn-icon" onclick="openEditGoalModal('${g.id}')" title="Edit goal">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="goal-btn-icon danger" onclick="deleteGoal('${g.id}')" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="goal-body">
      <!-- Ring -->
      <div class="goal-ring-wrap">
        <svg class="goal-ring" viewBox="0 0 100 100">
          <circle class="goal-ring-bg" cx="50" cy="50" r="42"/>
          <circle class="goal-ring-fill" cx="50" cy="50" r="42"
            stroke="${color}"
            stroke-dasharray="${CIRCUMFERENCE.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}"/>
        </svg>
        <div class="goal-ring-pct" style="color:${color}">${Math.round(pct)}%</div>
      </div>

      <!-- Info -->
      <div class="goal-info">
        <div class="goal-name">${_gesc(g.name)}</div>
        <div class="goal-cat">${_gesc(g.category)}</div>
        <div class="goal-amounts">
          <span class="goal-saved" style="color:${color}">${curr}${g.saved_amount.toLocaleString()}</span>
          <span class="goal-sep">of</span>
          <span class="goal-target">${curr}${g.target_amount.toLocaleString()}</span>
        </div>
        ${remaining > 0
          ? `<div class="goal-remaining">${curr}${remaining.toLocaleString()} to go</div>`
          : `<div class="goal-remaining green">Goal reached! 🎉</div>`}
      </div>
    </div>

    <!-- Bar (narrow version) -->
    <div class="goal-bar-track">
      <div class="goal-bar-fill" style="width:${pct}%;background:${color}"></div>
    </div>
  `;
  return div;
}

/* ── Add Goal Modal ──────────────────────────────────────────────────────── */
function openGoalModal() {
  // Populate category select
  const catSel = document.getElementById('goal-category');
  if (catSel) {
    catSel.innerHTML = GOAL_CATEGORIES.map(c =>
      `<option value="${c.name}">${c.name}</option>`
    ).join('');
    _syncGoalColor();
  }
  document.getElementById('goal-edit-id').value      = '';
  document.getElementById('goal-name').value         = '';
  document.getElementById('goal-target').value       = '';
  document.getElementById('goal-saved-init').value   = '';
  document.getElementById('goal-deadline').value     = '';
  // Restore "Add" mode labels
  document.getElementById('goal-modal-title').textContent  = 'New Savings Goal';
  document.getElementById('goal-submit-btn').textContent   = 'Create Goal';
  const savedWrap = document.getElementById('goal-saved-init-wrap');
  if (savedWrap) savedWrap.style.display = '';
  document.getElementById('add-goal-modal').classList.remove('hidden');
}

/* ── Edit Goal Modal ─────────────────────────────────────────────────────── */
function openEditGoalModal(id) {
  const goal = DB.getGoals().find(g => g.id === String(id));
  if (!goal) return;

  // Populate category select
  const catSel = document.getElementById('goal-category');
  if (catSel) {
    catSel.innerHTML = GOAL_CATEGORIES.map(c =>
      `<option value="${c.name}"${c.name === goal.category ? ' selected' : ''}>${c.name}</option>`
    ).join('');
  }

  // Pre-fill all fields with current values
  document.getElementById('goal-edit-id').value    = goal.id;
  document.getElementById('goal-name').value       = goal.name;
  document.getElementById('goal-target').value     = goal.target_amount;
  document.getElementById('goal-deadline').value   = goal.deadline || '';
  document.getElementById('goal-color').value      = goal.color || '#7B5CF5';

  // Hide "Already Saved" — saved amount is managed via contributions only
  const savedWrap = document.getElementById('goal-saved-init-wrap');
  if (savedWrap) savedWrap.style.display = 'none';

  // Switch modal to "Edit" mode labels
  document.getElementById('goal-modal-title').textContent  = 'Edit Goal';
  document.getElementById('goal-submit-btn').textContent   = 'Save Changes';

  document.getElementById('add-goal-modal').classList.remove('hidden');
}

function _syncGoalColor() {
  const catSel   = document.getElementById('goal-category');
  const colorInp = document.getElementById('goal-color');
  if (!catSel || !colorInp) return;
  const cat = GOAL_CATEGORIES.find(c => c.name === catSel.value);
  if (cat) colorInp.value = cat.color;
}

async function saveGoal() {
  const editId   = document.getElementById('goal-edit-id').value;
  const name     = document.getElementById('goal-name').value.trim();
  const target   = parseFloat(document.getElementById('goal-target').value);
  const category = document.getElementById('goal-category').value;
  const deadline = document.getElementById('goal-deadline').value || null;
  const color    = document.getElementById('goal-color').value;

  if (!name)                  { showToast('Please enter a goal name.'); return; }
  if (!target || target <= 0) { showToast('Please enter a valid target amount.'); return; }

  const btn = document.getElementById('goal-submit-btn');
  if (btn) btn.disabled = true;

  if (editId) {
    // ── Edit existing goal ──────────────────────────────────────
    try {
      await DB.updateGoal(editId, { name, target_amount: target, category, deadline, color });
      closeModal('add-goal-modal');
      showToast('Goal updated.', 'success');
      renderGoals();
    } catch (e) {
      showToast('Could not update goal. Please try again.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  } else {
    // ── Create new goal ─────────────────────────────────────────
    const savedInit = parseFloat(document.getElementById('goal-saved-init').value) || 0;
    try {
      await DB.addGoal({ name, target_amount: target, saved_amount: savedInit, category, deadline, color });
      closeModal('add-goal-modal');
      showToast('Goal created.', 'success');
      renderGoals();
    } catch (e) {
      showToast('Could not create goal. Please try again.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  }
}

/* ── Contribute Modal ────────────────────────────────────────────────────── */
function openContributeModal(id) {
  const goal = DB.getGoals().find(g => g.id === id);
  if (!goal) return;
  const curr = DB.getSettings().currency || '₦';

  document.getElementById('contribute-goal-id').value = id;
  document.getElementById('contribute-goal-name').textContent = goal.name;
  document.getElementById('contribute-remaining').textContent =
    `${curr}${Math.max(goal.target_amount - goal.saved_amount, 0).toLocaleString()} remaining`;
  document.getElementById('contribute-amount').value = '';
  document.getElementById('contribute-modal').classList.remove('hidden');
}

async function saveContribution() {
  const id     = document.getElementById('contribute-goal-id').value;
  const amount = parseFloat(document.getElementById('contribute-amount').value);
  if (!amount || amount <= 0) { showToast('Enter a valid amount.'); return; }

  const btn = document.querySelector('#contribute-modal .btn-primary');
  if (btn) btn.disabled = true;
  try {
    await DB.contributeToGoal(id, amount);
    closeModal('contribute-modal');
    const curr = DB.getSettings().currency || '₦';
    showToast(`${curr}${amount.toLocaleString()} added to your goal.`, 'success');
    renderGoals();
  } catch (e) {
    showToast('Could not save contribution. Please try again.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ── Delete ──────────────────────────────────────────────────────────────── */
async function deleteGoal(id) {
  if (!confirm('Delete this savings goal? This cannot be undone.')) return;
  try {
    await DB.deleteGoal(id);
    showToast('Goal removed.');
    renderGoals();
  } catch (e) {
    showToast('Could not remove goal. Please try again.', 'error');
  }
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function _gesc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
