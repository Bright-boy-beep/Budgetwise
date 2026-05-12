// ============================================================
// CHARTS MODULE — Chart.js based visualizations
// ============================================================

let barChartInst     = null;
let doughnutInst     = null;
let lineChartInst    = null;
let incomeChartInst  = null;
let dailyChartInst   = null;

function getChartColors() {
  const isDark = document.body.classList.contains('dark');
  return {
    gridColor:   isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    textColor:   isDark ? '#9A9898' : '#6B6866',
    tooltipBg:   isDark ? '#1A1D27' : '#fff',
    tooltipText: isDark ? '#F0EFE8' : '#1A1A1A',
  };
}

function getMonthLabels(n = 6) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

Chart.defaults.font.family = "'DM Sans', sans-serif";

function renderBarChart() {
  const ctx = document.getElementById('barChart');
  if (!ctx) return;
  const txs    = DB.getTransactions();
  const months = getMonthLabels(6);
  const { gridColor, textColor } = getChartColors();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  const incomeData  = months.map(m => getMonthlyTotals(txs, m.year, m.month).income);
  const expenseData = months.map(m => getMonthlyTotals(txs, m.year, m.month).expense);

  if (barChartInst) barChartInst.destroy();

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Income',   data: incomeData,  backgroundColor: 'rgba(24,160,90,0.8)',  borderRadius: 6, borderSkipped: false },
        { label: 'Expenses', data: expenseData, backgroundColor: 'rgba(229,57,53,0.8)',  borderRadius: 6, borderSkipped: false },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { size: 12 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${curr}${ctx.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => curr + v.toLocaleString() }, beginAtZero: true }
      }
    }
  });
}

function renderDoughnutChart() {
  const ctx = document.getElementById('doughnutChart');
  if (!ctx) return;
  const txs = DB.getTransactions();
  const { textColor } = getChartColors();
  const now = new Date();
  const settings = DB.getSettings();
  const curr = settings.currency || '₦';

  const monthExpenses = txs.filter(t => {
    const d = new Date(t.date);
    return t.type === 'expense' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const byCategory = {};
  monthExpenses.forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const sorted = Object.entries(byCategory).sort((a,b) => b[1]-a[1]).slice(0, 8);
  const labels = sorted.map(e => e[0]);
  const data   = sorted.map(e => e[1]);
  const colors = labels.map(l => getCategoryColor(l));

  if (doughnutInst) doughnutInst.destroy();

  if (data.length === 0) {
    ctx.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-muted);font-size:14px">No expense data yet</div>';
    return;
  }

  doughnutInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent', hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${curr}${ctx.raw.toLocaleString()}` } }
      }
    }
  });

  // Legend
  const legend = document.getElementById('chart-legend');
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

function renderLineChart() {
  const ctx = document.getElementById('lineChart');
  if (!ctx) return;
  const txs    = DB.getTransactions();
  const months = getMonthLabels(6);
  const { gridColor, textColor } = getChartColors();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';

  const expenseData = months.map(m => getMonthlyTotals(txs, m.year, m.month).expense);

  if (lineChartInst) lineChartInst.destroy();

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Monthly Spending',
        data: expenseData,
        borderColor: '#2A6EF5',
        backgroundColor: 'rgba(42,110,245,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2A6EF5',
        pointRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${curr}${ctx.raw.toLocaleString()}` } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => curr + v.toLocaleString() }, beginAtZero: true }
      }
    }
  });
}

function renderIncomeChart() {
  const ctx = document.getElementById('incomeChart');
  if (!ctx) return;
  const txs = DB.getTransactions();
  const now = new Date();
  const settings = DB.getSettings();
  const curr = settings.currency || '₦';

  const monthIncome = txs.filter(t => {
    const d = new Date(t.date);
    return t.type === 'income' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });

  const byCategory = {};
  monthIncome.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

  const sorted = Object.entries(byCategory).sort((a,b) => b[1]-a[1]);
  const labels = sorted.map(e => e[0]);
  const data   = sorted.map(e => e[1]);
  const colors = ['#18A05A','#2A6EF5','#F4A100','#9B51E0','#E53935'];

  if (incomeChartInst) incomeChartInst.destroy();

  if (data.length === 0) {
    ctx.parentElement.innerHTML += '<div style="text-align:center;color:var(--text-muted);font-size:14px;margin-top:2rem">No income data</div>';
    return;
  }

  incomeChartInst = new Chart(ctx, {
    type: 'pie',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${curr}${ctx.raw.toLocaleString()}` } }
      }
    }
  });
}

function renderDailyChart() {
  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;
  const txs = DB.getTransactions();
  const now = new Date();
  const { gridColor, textColor } = getChartColors();
  const settings = DB.getSettings();
  const curr = settings.currency || '₦';
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

  const daily = Array.from({length: daysInMonth}, (_,i) => {
    const day = String(i+1).padStart(2,'0');
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${day}`;
    return txs.filter(t => t.type === 'expense' && t.date === dateStr).reduce((s,t) => s+t.amount, 0);
  });

  if (dailyChartInst) dailyChartInst.destroy();

  dailyChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({length: daysInMonth}, (_,i) => i+1),
      datasets: [{
        label: 'Daily Spend',
        data: daily,
        backgroundColor: daily.map(v => v > 0 ? 'rgba(229,57,53,0.7)' : 'rgba(0,0,0,0.03)'),
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${curr}${ctx.raw.toLocaleString()}` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => curr + v.toLocaleString() }, beginAtZero: true }
      }
    }
  });
}

function renderAllCharts() {
  renderBarChart();
  renderDoughnutChart();
}

function renderAnalyticsCharts() {
  renderLineChart();
  renderIncomeChart();
  renderDailyChart();
  renderTopCategories();
}
