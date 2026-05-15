/* ============================================================
   reports.js — Monthly Financial Report
   Renders a live preview and downloads a PDF via html2canvas + jsPDF
   ============================================================ */

let _reportMonth = '';

/* ── Entry point ─────────────────────────────────────────────────────────── */
function renderReports() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const sel = document.getElementById('report-month-select');
  if (sel && !sel.value) sel.value = defaultMonth;
  _reportMonth = sel ? sel.value : defaultMonth;

  _buildReportPreview(_reportMonth);
}

function onReportMonthChange() {
  const sel = document.getElementById('report-month-select');
  if (!sel) return;
  _reportMonth = sel.value;
  _buildReportPreview(_reportMonth);
}

/* ── Build the live preview ──────────────────────────────────────────────── */
function _buildReportPreview(monthStr) {
  const container = document.getElementById('report-preview');
  if (!container) return;

  const txs      = DB.getTransactions();
  const budgets  = DB.getBudgets();
  const settings = DB.getSettings();
  const curr     = settings.currency || '₦';
  const session  = DB.getSession();
  const userName = settings.name || session?.name || 'User';

  // ── Current month figures ────────────────────────────────────────────
  const monthTxs  = txs.filter(t => t.date.startsWith(monthStr));
  const incomeTxs = monthTxs.filter(t => t.type === 'income');
  const expTxs    = monthTxs.filter(t => t.type === 'expense');
  const income    = incomeTxs.reduce((s, t) => s + t.amount, 0);
  const expense   = expTxs.reduce((s, t) => s + t.amount, 0);
  const net       = income - expense;
  const savRate   = income > 0 ? (income - expense) / income * 100 : 0;

  // ── Previous month figures (for comparison) ──────────────────────────
  const [y, m] = monthStr.split('-').map(Number);
  const prevDate     = new Date(y, m - 2, 1);
  const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthName = prevDate.toLocaleDateString('en-GB', { month: 'long' });
  const prevTxs    = txs.filter(t => t.date.startsWith(prevMonthStr));
  const prevIncome  = prevTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const prevExpense = prevTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const prevNet     = prevIncome - prevExpense;
  const hasPrev     = prevTxs.length > 0;

  // ── Category breakdown ───────────────────────────────────────────────
  const byCategory = {};
  expTxs.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const topCats   = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCatAmt = topCats[0]?.[1] || 1;

  // ── Budget performance ───────────────────────────────────────────────
  const monthBudgets = budgets.filter(b => b.month === monthStr);
  const overBudget   = monthBudgets.filter(b => (byCategory[b.category] || 0) > b.limit);
  const anomalies    = monthTxs.filter(t => t.is_anomaly);

  // ── Date labels ──────────────────────────────────────────────────────
  const monthLabel = new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const generated  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmt        = v => curr + Math.round(v).toLocaleString();

  // ── Executive summary narrative ──────────────────────────────────────
  const parts = [];
  if (monthTxs.length === 0) {
    parts.push(`No financial activity was recorded for ${monthLabel}. Please select a different reporting period to view a summary.`);
  } else {
    // Opening
    if (income > 0 && expense > 0) {
      parts.push(`During ${monthLabel}, ${_resc(userName)} recorded total income of ${fmt(income)} across ${incomeTxs.length} receipt${incomeTxs.length !== 1 ? 's' : ''} and total expenditure of ${fmt(expense)} across ${expTxs.length} transaction${expTxs.length !== 1 ? 's' : ''}.`);
    } else if (income > 0) {
      parts.push(`During ${monthLabel}, ${_resc(userName)} recorded income of ${fmt(income)} with no expenditure logged.`);
    } else if (expense > 0) {
      parts.push(`During ${monthLabel}, ${_resc(userName)} recorded expenditure of ${fmt(expense)} with no income entries logged.`);
    }
    // Net
    if (income > 0 && expense > 0) {
      if (net > 0) {
        parts.push(`This resulted in a net surplus of ${fmt(net)}, reflecting a savings rate of ${savRate.toFixed(1)}%${savRate >= 20 ? ' — above the recommended 20% benchmark for sound personal finance' : '. Financial planning guidelines generally recommend a minimum savings rate of 20%'}.`);
      } else if (net < 0) {
        parts.push(`Expenditure exceeded income by ${fmt(Math.abs(net))}, resulting in a net deficit for the period. A review of discretionary spending categories is advisable.`);
      } else {
        parts.push(`Income and expenditure were exactly balanced this month, with no net surplus or deficit recorded.`);
      }
    }
    // Month-on-month
    if (hasPrev && expense > 0 && prevExpense > 0) {
      const chg = ((expense - prevExpense) / prevExpense) * 100;
      if (Math.abs(chg) >= 3) {
        parts.push(chg > 0
          ? `Compared to ${prevMonthName}, total spending increased by ${chg.toFixed(0)}% (from ${fmt(prevExpense)} to ${fmt(expense)}), indicating higher outgoings this period.`
          : `Compared to ${prevMonthName}, total spending decreased by ${Math.abs(chg).toFixed(0)}% (from ${fmt(prevExpense)} to ${fmt(expense)}), suggesting improved expenditure control.`
        );
      } else {
        parts.push(`Spending levels were broadly consistent with ${prevMonthName} (${fmt(prevExpense)}), with only a marginal ${chg > 0 ? 'increase' : 'decrease'} of ${Math.abs(chg).toFixed(0)}%.`);
      }
    }
    // Top category
    if (topCats.length > 0) {
      const [topCat, topAmt] = topCats[0];
      const topPct = expense > 0 ? Math.round((topAmt / expense) * 100) : 0;
      parts.push(`The largest area of expenditure was ${topCat} at ${fmt(topAmt)}, representing ${topPct}% of total spending for the month.`);
    }
  }
  const narrative = parts.join(' ');

  // ── Key observations ─────────────────────────────────────────────────
  const obs = [];
  if (monthBudgets.length > 0) {
    if (overBudget.length === 0) {
      obs.push(`All ${monthBudgets.length} budget categories were kept within their set limits this month.`);
    } else {
      obs.push(`${overBudget.length} of ${monthBudgets.length} budget ${overBudget.length === 1 ? 'category' : 'categories'} exceeded its limit: ${overBudget.map(b => b.category).join(', ')}.`);
    }
  }
  if (topCats.length > 1) {
    const [cat2, amt2] = topCats[1];
    const pct2 = expense > 0 ? Math.round((amt2 / expense) * 100) : 0;
    obs.push(`${cat2} was the second largest expense category at ${fmt(amt2)} (${pct2}% of total expenditure).`);
  }
  if (anomalies.length > 0) {
    obs.push(`${anomalies.length} transaction${anomalies.length > 1 ? 's were' : ' was'} flagged as statistically unusual by the system's anomaly detection model and may warrant further review.`);
  }
  if (savRate >= 20 && income > 0) {
    obs.push(`The savings rate of ${savRate.toFixed(1)}% exceeds the recommended 20% threshold, indicating healthy financial management for this period.`);
  } else if (savRate > 0 && savRate < 20 && income > 0) {
    obs.push(`The current savings rate of ${savRate.toFixed(1)}% is below the 20% recommended benchmark. Reducing spending in higher-cost categories could help improve this.`);
  }
  if (monthTxs.length > 0 && obs.length === 0) {
    obs.push(`No budget targets were set for this period. Setting monthly budgets allows BudgetWise to track and report on spending adherence.`);
  }

  // ── Month-on-month comparison rows ───────────────────────────────────
  function momChange(cur, prev) {
    if (!prev) return '<span class="rpt-change-flat">—</span>';
    const chg = ((cur - prev) / prev) * 100;
    if (Math.abs(chg) < 0.5) return '<span class="rpt-change-flat">No change</span>';
    return chg > 0
      ? `<span class="rpt-change-up">+${chg.toFixed(0)}%</span>`
      : `<span class="rpt-change-down">${chg.toFixed(0)}%</span>`;
  }

  const momSection = hasPrev ? `
    <div class="rpt-narrative-section">
      <div class="rpt-section-title">Month-on-Month Comparison</div>
      <table class="rpt-mom-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>${prevMonthName}</th>
            <th>${monthLabel.split(' ')[0]}</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total Income</td>
            <td>${fmt(prevIncome)}</td>
            <td>${fmt(income)}</td>
            <td>${momChange(income, prevIncome)}</td>
          </tr>
          <tr>
            <td>Total Expenditure</td>
            <td>${fmt(prevExpense)}</td>
            <td>${fmt(expense)}</td>
            <td>${momChange(expense, prevExpense)}</td>
          </tr>
          <tr>
            <td>Net Position</td>
            <td>${prevNet >= 0 ? '+' : ''}${fmt(Math.abs(prevNet))}</td>
            <td>${net >= 0 ? '+' : ''}${fmt(Math.abs(net))}</td>
            <td>${momChange(net, prevNet)}</td>
          </tr>
        </tbody>
      </table>
    </div>` : '';

  // ── Render ─────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div id="report-printable" class="report-printable">

      <!-- Letterhead -->
      <div class="rpt-header">
        <div class="rpt-brand">
          <img src="assets/images/logo-mark.svg" alt="BudgetWise"
               style="width:44px;height:auto;background:#fff;border-radius:6px;padding:4px;margin-right:10px;vertical-align:middle;display:inline-block"/>
          <div style="display:inline-block;vertical-align:middle">
            <div class="rpt-brand-name">BudgetWise</div>
            <div class="rpt-brand-tagline">Personal Finance Report</div>
          </div>
        </div>
        <div class="rpt-header-right">
          <div class="rpt-period">${monthLabel}</div>
          <div class="rpt-meta">Prepared for: ${_resc(userName)}</div>
          <div class="rpt-meta">Date generated: ${generated}</div>
        </div>
      </div>

      <!-- KPI strip -->
      <div class="rpt-summary-row">
        <div class="rpt-summary-card income">
          <div class="rpt-summary-label">Total Income</div>
          <div class="rpt-summary-value">${fmt(income)}</div>
          <div class="rpt-summary-sub">${incomeTxs.length} receipt${incomeTxs.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="rpt-summary-card expense">
          <div class="rpt-summary-label">Total Expenditure</div>
          <div class="rpt-summary-value">${fmt(expense)}</div>
          <div class="rpt-summary-sub">${expTxs.length} transaction${expTxs.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="rpt-summary-card ${net >= 0 ? 'net-pos' : 'net-neg'}">
          <div class="rpt-summary-label">Net Position</div>
          <div class="rpt-summary-value">${net >= 0 ? '+' : ''}${fmt(Math.abs(net))}</div>
          <div class="rpt-summary-sub">${net >= 0 ? 'Surplus' : 'Deficit'} for period</div>
        </div>
        <div class="rpt-summary-card savings">
          <div class="rpt-summary-label">Savings Rate</div>
          <div class="rpt-summary-value">${income > 0 ? savRate.toFixed(1) + '%' : 'N/A'}</div>
          <div class="rpt-summary-sub">${savRate >= 20 ? 'Above target' : income > 0 ? 'Below 20% target' : 'No income recorded'}</div>
        </div>
      </div>

      <!-- Executive summary -->
      <div class="rpt-narrative-section">
        <div class="rpt-section-title">Executive Summary</div>
        <p class="rpt-narrative">${narrative}</p>
      </div>

      <!-- Key observations -->
      ${obs.length > 0 ? `
      <div class="rpt-narrative-section">
        <div class="rpt-section-title">Key Observations</div>
        <ul class="rpt-obs-list">
          ${obs.map(o => `<li><span class="rpt-obs-dot"></span><span>${o}</span></li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Month-on-month comparison -->
      ${momSection}

      <!-- Category breakdown + budget performance -->
      <div class="rpt-two-col">
        <div class="rpt-section">
          <div class="rpt-section-title">Expenditure by Category</div>
          ${topCats.length === 0
            ? '<div class="rpt-empty">No expenses recorded.</div>'
            : topCats.map(([cat, amt]) => {
                const pct    = Math.round((amt / maxCatAmt) * 100);
                const ofExp  = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                const color  = getCategoryColor(cat);
                return `<div class="rpt-cat-row">
                  <div class="rpt-cat-top">
                    <span class="rpt-cat-name">${_resc(cat)}</span>
                    <span class="rpt-cat-amt">${fmt(amt)}</span>
                  </div>
                  <div class="rpt-bar-track">
                    <div class="rpt-bar-fill" style="width:${pct}%;background:${color}"></div>
                  </div>
                  <div class="rpt-cat-pct">${ofExp}% of total expenditure</div>
                </div>`;
              }).join('')
          }
        </div>

        <div class="rpt-section">
          <div class="rpt-section-title">Budget Performance</div>
          ${monthBudgets.length === 0
            ? '<div class="rpt-empty">No budgets set for this period.</div>'
            : monthBudgets.map(b => {
                const spent = byCategory[b.category] || 0;
                const pct   = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0;
                const over  = spent > b.limit;
                return `<div class="rpt-cat-row">
                  <div class="rpt-cat-top">
                    <span class="rpt-cat-name">${_resc(b.category)}</span>
                    <span class="rpt-cat-amt ${over ? 'rpt-text-red' : ''}">${fmt(spent)} of ${fmt(b.limit)}</span>
                  </div>
                  <div class="rpt-bar-track">
                    <div class="rpt-bar-fill" style="width:${pct}%;background:${over ? '#b91c1c' : '#15803d'}"></div>
                  </div>
                  <div class="rpt-cat-pct ${over ? 'rpt-text-red' : ''}">
                    ${over
                      ? 'Exceeded by ' + fmt(spent - b.limit)
                      : pct + '% utilised &mdash; ' + fmt(b.limit - spent) + ' remaining'}
                  </div>
                </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- Transaction ledger -->
      <div class="rpt-section rpt-section-full">
        <div class="rpt-section-title">Transaction Ledger</div>
        ${monthTxs.length === 0
          ? '<div class="rpt-empty">No transactions recorded for this period.</div>'
          : `<table class="rpt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th style="text-align:right">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${monthTxs
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map(t => {
                    const sign    = t.type === 'income' ? '+' : '-';
                    const dateStr = new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
                    return `<tr>
                      <td class="rpt-td-date">${dateStr}</td>
                      <td>${_resc(t.description)}${t.note ? `<span class="rpt-note"> &mdash; ${_resc(t.note)}</span>` : ''}${t.is_anomaly ? ' <span style="font-size:10px;color:#b91c1c;font-weight:600">FLAGGED</span>' : ''}</td>
                      <td><span class="rpt-cat-badge">${_resc(t.category)}</span></td>
                      <td><span class="rpt-type-badge ${t.type}">${t.type}</span></td>
                      <td class="rpt-td-amt ${t.type}">${sign}${curr}${t.amount.toLocaleString()}</td>
                    </tr>`;
                  }).join('')}
              </tbody>
            </table>`
        }
      </div>

      <!-- Footer -->
      <div class="rpt-footer">
        <span>${_resc(userName)} &mdash; ${monthLabel}</span>
        <span>Generated by BudgetWise on ${generated}</span>
      </div>
      <div class="rpt-disclaimer">
        This report is generated automatically from transaction data entered into BudgetWise and is intended for personal financial reference only.
        It does not constitute professional financial advice. All figures are in ${curr === '₦' ? 'Nigerian Naira (NGN)' : curr}.
      </div>

    </div>
  `;
}

/* ── PDF Download ─────────────────────────────────────────────────────────── */
async function downloadReport() {
  const el  = document.getElementById('report-printable');
  const btn = document.getElementById('report-download-btn');
  if (!el) { showToast('No report to download. Select a month first.'); return; }

  // Update button state
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px;animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>Generating…`;
  }

  try {
    const canvas = await html2canvas(el, {
      scale:           2,
      backgroundColor: '#ffffff',
      useCORS:         true,
      logging:         false,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageW  = 210;  // A4 width  in mm
    const pageH  = 297;  // A4 height in mm
    const imgW   = pageW;
    const imgH   = (canvas.height * imgW) / canvas.width;

    let heightLeft = imgH;
    let position   = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
    heightLeft -= pageH;

    while (heightLeft > 0) {
      position = heightLeft - imgH;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const [y, m] = _reportMonth.split('-');
    const slug = new Date(y, m - 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      .replace(/\s+/g, '-');
    pdf.save(`BudgetWise-Report-${slug}.pdf`);
    showToast('Report downloaded.', 'success');

  } catch (err) {
    console.error('PDF generation error:', err);
    showToast('Could not generate PDF. Please try again.', 'error');
  } finally {
    if (btn) {
      btn.disabled  = false;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:5px">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>Download PDF`;
    }
  }
}

/* ── Utility ─────────────────────────────────────────────────────────────── */
function _resc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
