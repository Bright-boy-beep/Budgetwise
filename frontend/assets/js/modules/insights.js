/* ============================================================
   insights.js — ML Insights page module
   Renders: forecast chart, anomalies, budget suggestions,
            category classifier, spending trend chart.
   ============================================================ */

let _mlForecastChart = null;
let _mlTrendChart    = null;
let _classifyTimer   = null;

/* ── Entry point (called from renderPage in app.js) ─────────────────────── */
async function renderMLInsights() {
  const loading  = document.getElementById('ml-loading');
  const empty    = document.getElementById('ml-empty');
  const content  = document.getElementById('ml-content');

  // Show loading
  loading.classList.remove('hidden');
  empty.classList.add('hidden');
  content.classList.add('hidden');

  try {
    const data = await API.get('/ml/insights');
    loading.classList.add('hidden');

    const txCount = DB.getTransactions().length;
    if (txCount < 3) {
      empty.classList.remove('hidden');
      return;
    }

    content.classList.remove('hidden');

    _renderForecast(data.forecast);
    _renderAnomalies(data.anomalies);
    _renderSuggestions(data.budget_suggestions);
    _renderTrend(data.trend);
  } catch (err) {
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
    console.error('ML Insights error:', err);
  }
}

/* ── 1. Next-Month Forecast Chart ────────────────────────────────────────── */
function _renderForecast(forecast) {
  const badge = document.getElementById('ml-forecast-month');
  if (badge && forecast.month) {
    const [y, m] = forecast.month.split('-');
    badge.textContent = new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  const predictions = forecast.predictions || [];
  const noDataEl    = document.getElementById('ml-forecast-empty');

  if (predictions.length === 0) {
    if (noDataEl) noDataEl.classList.remove('hidden');
    return;
  }
  if (noDataEl) noDataEl.classList.add('hidden');

  const labels  = predictions.map(p => p.category);
  const amounts = predictions.map(p => p.predicted_amount);
  const currency = DB.getSettings().currency || '₦';

  const ctx = document.getElementById('mlForecastChart').getContext('2d');
  if (_mlForecastChart) _mlForecastChart.destroy();

  _mlForecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Predicted Spend',
        data: amounts,
        backgroundColor: [
          '#7B5CF5','#9B7FF7','#B89FFB','#5A3FD4','#4B2CB3',
          '#3D1E9B','#6B4EE5','#8A6AF3','#A585F9','#C3A8FC',
          '#D4BFFE','#E8DEFF',
        ],
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${currency}${ctx.parsed.y.toLocaleString('en-NG', { minimumFractionDigits: 0 })}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: '#6B6080', maxRotation: 35 }
        },
        y: {
          grid: { color: 'rgba(123,92,245,0.07)' },
          ticks: {
            color: '#6B6080', font: { size: 11 },
            callback: v => currency + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v),
          }
        }
      }
    }
  });
}

/* ── 2. Anomaly Alerts ───────────────────────────────────────────────────── */
function _renderAnomalies(anomalies) {
  const container = document.getElementById('ml-anomalies-list');
  if (!container) return;

  if (!anomalies || anomalies.length === 0) {
    container.innerHTML = `
      <div class="ml-no-data">
        <span class="ml-no-data-icon">✅</span>
        <span>No unusual spending detected. Your patterns look healthy!</span>
      </div>`;
    return;
  }

  const currency = DB.getSettings().currency || '₦';
  const items    = anomalies.slice(0, 8);   // show top 8

  container.innerHTML = items.map(a => {
    const sign     = a.z_score > 0 ? '↑' : '↓';
    const severity = Math.abs(a.z_score) >= 3.5 ? 'high' : Math.abs(a.z_score) >= 2.5 ? 'med' : 'low';
    return `
      <div class="anomaly-item anomaly-${severity}">
        <div class="anomaly-top">
          <span class="anomaly-desc">${_esc(a.description)}</span>
          <span class="anomaly-amount">${sign}${currency}${a.amount.toLocaleString('en-NG')}</span>
        </div>
        <div class="anomaly-meta">
          <span class="anomaly-cat">${_esc(a.category)}</span>
          <span class="anomaly-date">${a.date}</span>
          <span class="anomaly-z">z = ${a.z_score}</span>
        </div>
        <div class="anomaly-reason">${_esc(a.reason)}</div>
      </div>`;
  }).join('');
}

/* ── 3. Budget Suggestions ───────────────────────────────────────────────── */
function _renderSuggestions(suggestions) {
  const container = document.getElementById('ml-suggestions-list');
  if (!container) return;

  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = `
      <div class="ml-no-data">
        <span class="ml-no-data-icon">📊</span>
        <span>Add more transactions to generate budget recommendations.</span>
      </div>`;
    return;
  }

  const currency    = DB.getSettings().currency || '₦';
  const existBudgets = DB.getBudgets();
  const curMonth    = new Date().toISOString().slice(0, 7);

  container.innerHTML = suggestions.map(s => {
    const existing = existBudgets.find(
      b => b.category === s.category && b.month === curMonth
    );
    const hasBudget  = !!existing;
    const budgetVal  = existing ? existing.limit : null;
    const diff       = budgetVal ? s.suggested_limit - budgetVal : 0;
    const diffText   = budgetVal
      ? (diff > 0 ? `+${currency}${Math.abs(diff).toLocaleString('en-NG')} vs current` : `-${currency}${Math.abs(diff).toLocaleString('en-NG')} vs current`)
      : 'No budget set';
    const diffClass  = diff > 0 ? 'text-red' : diff < 0 ? 'text-green' : '';

    return `
      <div class="suggestion-item">
        <div class="suggestion-top">
          <span class="suggestion-cat">${_esc(s.category)}</span>
          <span class="suggestion-val">${currency}${s.suggested_limit.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</span>
        </div>
        <div class="suggestion-meta">
          <span>Based on avg spend: ${currency}${s.based_on.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</span>
          <span class="${diffClass}">${diffText}</span>
        </div>
      </div>`;
  }).join('');
}

/* ── 4. Spending Trend Chart ─────────────────────────────────────────────── */
function _renderTrend(trend) {
  if (!trend || trend.length === 0) return;

  const currency = DB.getSettings().currency || '₦';
  const labels   = trend.map(t => {
    const [y, m] = t.month.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  });
  const amounts = trend.map(t => t.total);

  const ctx = document.getElementById('mlTrendChart').getContext('2d');
  if (_mlTrendChart) _mlTrendChart.destroy();

  _mlTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Monthly Expenses',
        data: amounts,
        borderColor: '#7B5CF5',
        backgroundColor: 'rgba(123,92,245,0.10)',
        fill: true,
        tension: 0.45,
        pointBackgroundColor: '#7B5CF5',
        pointRadius: 5,
        pointHoverRadius: 7,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${currency}${ctx.parsed.y.toLocaleString('en-NG')}`,
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#6B6080', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(123,92,245,0.07)' },
          ticks: {
            color: '#6B6080', font: { size: 11 },
            callback: v => currency + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v),
          }
        }
      }
    }
  });
}

/* ── 5. Live Category Classifier ─────────────────────────────────────────── */
function classifyInput() {
  clearTimeout(_classifyTimer);
  _classifyTimer = setTimeout(_doClassify, 380);
}

async function _doClassify() {
  const input     = document.getElementById('classifier-input');
  const resultBox = document.getElementById('classifier-result');
  if (!input || !resultBox) return;

  const text = (input.value || '').trim();
  if (text.length < 3) {
    resultBox.classList.add('hidden');
    return;
  }

  try {
    const data = await API.post('/ml/classify', { description: text });
    const suggestions = data.suggestions || [];

    if (suggestions.length === 0) {
      resultBox.classList.add('hidden');
      return;
    }

    resultBox.classList.remove('hidden');
    resultBox.innerHTML = `
      <div class="classifier-label">Suggested categories:</div>
      <div class="classifier-chips">
        ${suggestions.map((s, i) => `
          <button class="classifier-chip ${i === 0 ? 'primary' : ''}"
                  onclick="pickCategory('${_esc(s.category)}')">
            ${_esc(s.category)}
            <span class="chip-confidence">${s.confidence}%</span>
          </button>
        `).join('')}
      </div>`;
  } catch (err) {
    resultBox.classList.add('hidden');
  }
}

function pickCategory(cat) {
  // If the Add Transaction modal is open, apply the category there
  const sel = document.getElementById('tx-category');
  if (sel) {
    for (let opt of sel.options) {
      if (opt.value === cat || opt.text === cat) {
        sel.value = opt.value;
        break;
      }
    }
  }
  // Fill the classifier input so the user sees what was selected
  const input = document.getElementById('classifier-input');
  if (input) input.dataset.selected = cat;
}

/* ── Category suggestion in Add Transaction modal ────────────────────────── */
function suggestCategory() {
  clearTimeout(_classifyTimer);
  _classifyTimer = setTimeout(_doSuggestInModal, 450);
}

async function _doSuggestInModal() {
  const descEl = document.getElementById('tx-description');
  const badgeEl = document.getElementById('tx-category-suggest');
  if (!descEl || !badgeEl) return;

  const text = (descEl.value || '').trim();
  if (text.length < 4) {
    badgeEl.classList.add('hidden');
    return;
  }

  try {
    const data  = await API.post('/ml/classify', { description: text });
    const top   = data.suggestions?.[0];
    if (!top || top.confidence < 30) {
      badgeEl.classList.add('hidden');
      return;
    }
    badgeEl.textContent = `AI suggests: ${top.category} (${top.confidence}%) — click to apply`;
    badgeEl.dataset.cat  = top.category;
    badgeEl.classList.remove('hidden');
  } catch (_) {
    badgeEl.classList.add('hidden');
  }
}

function applySuggestedCategory() {
  const badgeEl = document.getElementById('tx-category-suggest');
  const sel     = document.getElementById('tx-category');
  if (!badgeEl || !sel) return;
  const cat = badgeEl.dataset.cat;
  if (cat) {
    for (let opt of sel.options) {
      if (opt.value === cat || opt.text === cat) { sel.value = opt.value; break; }
    }
  }
  badgeEl.classList.add('hidden');
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
