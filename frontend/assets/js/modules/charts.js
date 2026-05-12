// ============================================================
// CHARTS MODULE — Chart.js based visualizations
// Soft-UI Purple theme (#7B5CF5) — BudgetWise
// ============================================================

let barChartInst     = null;
let doughnutInst     = null;
let lineChartInst    = null;
let incomeChartInst  = null;
let dailyChartInst   = null;

function getChartColors() {
  const isDark = document.body.classList.contains('dark');
  return {
    gridColor:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(123,92,245,0.07)',
    textColor:   isDark ? '#9E99B8' : '#6B6080',
    tooltipBg:   isDark ? '#16112E' : '#ffffff',
    tooltipText: isDark ? '#F0EBF8' : '#1A1033',
  };
}

function getMonthLabels(n = 6) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      year:  d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

function getWeekLabels() {
  const days = [];
  const now  = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push({
      label:   d.toLocaleDateString('en-GB', { weekday: 'short' }),
      dateStr: d.toISOString().split('T')[0],
    });
  }
  return days;
}

// Apply Outfit font globally
Chart.defaults.font.family = "'Outfit', sans-serif";

// ============================================================
// DASHBOARD — Expense Statistics Chart (area / bar)
// ============================================================

function renderBarChart(period = 'month6') {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;

  const txs      = DB.getTransactions();
  const colors   = getChartColors();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  if (barChartInst) { barChartInst.destroy(); barChartInst = null; }

  if (period === 'week') {
    // ---- Weekly view: daily expense bars ----
    const days = getWeekLabels();
    const data = days.map(d =>
      txs
        .filter(t => t.type === 'expense' && t.date === d.dateStr)
        .reduce((s, t) => s + t.amount, 0)
    );

    barChartInst = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: days.map(d => d.label),
        datasets: [{
          label: 'Daily Expenses',
          data,
          backgroundColor: data.map(v => v > 0 ? 'rgba(123,92,245,0.80)' : 'rgba(123,92,245,0.12)'),
          borderRadius: 8,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: '#7B5CF5',
            borderColor: 'rgba(123,92,245,0.20)',
            borderWidth: 1,
            callbacks: { label: c => ` ${curr}${c.raw.toLocaleString()}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.textColor, font: { size: 11 } } },
          y: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, callback: v => curr + v.toLocaleString() },
            beginAtZero: true,
          },
        },
      },
    });

  } else {
    // ---- 6-Month view: expense area (line) chart ----
    const months      = getMonthLabels(6);
    const expenseData = months.map(m => getMonthlyTotals(txs, m.year, m.month).expense);

    barChartInst = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months.map(m => m.label),
        datasets: [{
          label: 'Monthly Expenses',
          data: expenseData,
          borderColor: '#7B5CF5',
          backgroundColor: function(context) {
            const chart = context.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return 'rgba(123,92,245,0.12)';
            const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(123,92,245,0.30)');
            gradient.addColorStop(1, 'rgba(123,92,245,0.01)');
            return gradient;
          },
          borderWidth: 2.5,
          fill: true,
          tension: 0.42,
          pointBackgroundColor: '#7B5CF5',
          pointBorderColor:     '#ffffff',
          pointBorderWidth:     2,
          pointRadius:          5,
          pointHoverRadius:     7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.tooltipText,
            bodyColor: '#7B5CF5',
            borderColor: 'rgba(123,92,245,0.20)',
            borderWidth: 1,
            callbacks: { label: c => ` ${curr}${c.raw.toLocaleString()}` },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: colors.textColor, font: { size: 11 } } },
          y: {
            grid: { color: colors.gridColor },
            ticks: { color: colors.textColor, callback: v => curr + v.toLocaleString() },
            beginAtZero: true,
          },
        },
      },
    });
  }
}

// Called by the dropdown in the dashboard HTML:
// <select onchange="updateDashChart(this.value)">
function updateDashChart(period) {
  renderBarChart(period);
}

// ============================================================
// DASHBOARD — Doughnut (hidden canvas, kept for JS compat)
// ============================================================

function renderDoughnutChart() {
  const ctx = document.getElementById('doughnutChart');
  if (!ctx || ctx.style.display === 'none') return; // hidden in new layout
  // Spending by category for the dashboard (legacy fallback)
  _renderSpendingPie(ctx, 'doughnutInst');
}

// ============================================================
// ANALYTICS — Spending by Category (doughnut) + Legend
// ============================================================

function renderIncomeChart() {
  const ctx = document.getElementById('incomeChart');
  if (!ctx) return;

  const txs      = DB.getTransactions();
  const now      = new Date();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  // Monthly expenses grouped by category
  const monthExpenses = txs.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense'
      && d.getFullYear() === now.getFullYear()
      && d.getMonth()    === now.getMonth();
  });

  const byCategory = {};
  monthExpenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(e => e[0]);
  const data   = sorted.map(e => e[1]);
  const colors = labels.map(l => getCategoryColor(l));

  if (incomeChartInst) { incomeChartInst.destroy(); incomeChartInst = null; }

  if (data.length === 0) {
    const parent = ctx.parentElement;
    const msg = parent.querySelector('.chart-empty-msg');
    if (!msg) {
      const el = document.createElement('div');
      el.className = 'chart-empty-msg';
      el.style.cssText = 'text-align:center;color:var(--text-muted);font-size:14px;padding:2rem 0';
      el.textContent = 'No expense data this month';
      parent.appendChild(el);
    }
    return;
  }

  incomeChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'transparent',
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: c => ` ${curr}${c.raw.toLocaleString()}` },
        },
      },
    },
  });

  // Populate analytics legend
  const legend = document.getElementById('analytics-legend') || document.getElementById('chart-legend');
  if (legend) {
    legend.innerHTML = '';
    labels.forEach((l, i) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `<div class="legend-dot" style="background:${colors[i]}"></div><span>${l}</span>`;
      legend.appendChild(item);
    });
  }
}

// ============================================================
// ANALYTICS — Spending Trend Line Chart (6 months)
// ============================================================

function renderLineChart() {
  const ctx = document.getElementById('lineChart');
  if (!ctx) return;

  const txs      = DB.getTransactions();
  const months   = getMonthLabels(6);
  const colors   = getChartColors();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  const expenseData = months.map(m => getMonthlyTotals(txs, m.year, m.month).expense);
  const incomeData  = months.map(m => getMonthlyTotals(txs, m.year, m.month).income);

  if (lineChartInst) { lineChartInst.destroy(); lineChartInst = null; }

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#7B5CF5',
          backgroundColor: 'rgba(123,92,245,0.10)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#7B5CF5',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#16A34A',
          backgroundColor: 'rgba(22,163,74,0.07)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#16A34A',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: colors.textColor, font: { size: 12 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: c => ` ${curr}${c.raw.toLocaleString()}` } },
      },
      scales: {
        x: { grid: { color: colors.gridColor }, ticks: { color: colors.textColor } },
        y: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor, callback: v => curr + v.toLocaleString() },
          beginAtZero: true,
        },
      },
    },
  });
}

// ============================================================
// ANALYTICS — Daily Spending Bar Chart
// ============================================================

function renderDailyChart() {
  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;

  const txs          = DB.getTransactions();
  const now          = new Date();
  const colors       = getChartColors();
  const settings     = DB.getSettings();
  const curr         = settings.currency || '₦';
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const day     = String(i + 1).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`;
    return txs.filter(t => t.type === 'expense' && t.date === dateStr).reduce((s, t) => s + t.amount, 0);
  });

  if (dailyChartInst) { dailyChartInst.destroy(); dailyChartInst = null; }

  dailyChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      datasets: [{
        label: 'Daily Spend',
        data:  daily,
        backgroundColor: daily.map(v => v > 0 ? 'rgba(123,92,245,0.78)' : 'rgba(123,92,245,0.08)'),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${curr}${c.raw.toLocaleString()}` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.textColor, font: { size: 10 } } },
        y: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor, callback: v => curr + v.toLocaleString() },
          beginAtZero: true,
        },
      },
    },
  });
}

// ============================================================
// RENDER GROUPS
// ============================================================

function renderAllCharts() {
  renderBarChart('month6');
  renderDoughnutChart();
}

function renderAnalyticsCharts() {
  renderLineChart();
  renderIncomeChart();
  renderDailyChart();
  renderTopCategories();
}
