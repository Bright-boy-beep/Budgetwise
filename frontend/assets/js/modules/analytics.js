// ============================================================
// ANALYTICS MODULE
// ============================================================

function renderTopCategories() {
    const container = document.getElementById('top-categories');
    if (!container) return;

    const txs = DB.getTransactions();
    const now = new Date();
    const settings = DB.getSettings();
    const curr = settings.currency || '₦';

    const monthExpenses = txs.filter(t => {
      const d = new Date(t.date);
      return t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });

    const byCategory = {};
    monthExpenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

    const sorted = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 6);
    const max    = sorted[0]?.[1] || 1;

    container.innerHTML = '';

    if (sorted.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:14px;padding:2rem 0">No data for this month</p>';
      return;
    }

    sorted.forEach(([cat, amount]) => {
      const pct = Math.round((amount / max) * 100);
      const color = getCategoryColor(cat);
      const row = document.createElement('div');
      row.className = 'top-cat-item';
      row.innerHTML = `
        <div class="top-cat-name">${getCategoryIcon(cat)} ${cat.split(' ')[0]}</div>
        <div class="top-cat-bar"><div class="top-cat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="top-cat-val">${curr}${amount.toLocaleString()}</div>
      `;
      container.appendChild(row);
    });
  }
