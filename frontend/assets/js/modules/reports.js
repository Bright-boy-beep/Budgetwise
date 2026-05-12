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

  // ── Totals ──────────────────────────────────────────────────────────────
  const monthTxs = txs.filter(t => t.date.startsWith(monthStr));
  const income   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense  = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net      = income - expense;
  const savingsRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

  // ── Category breakdown ────────────────────────────────────────────────
  const byCategory = {};
  monthTxs.filter(t => t.type === 'expense').forEach(t => {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });
  const topCats   = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const maxCatAmt = topCats[0]?.[1] || 1;

  // ── Budgets ──────────────────────────────────────────────────────────
  const monthBudgets = budgets.filter(b => b.month === monthStr);

  // ── Date labels ───────────────────────────────────────────────────────
  const [y, m]    = monthStr.split('-');
  const monthLabel = new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const generated  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // ── Render ─────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div id="report-printable" class="report-printable">

      <!-- ── Header ── -->
      <div class="rpt-header">
        <div class="rpt-brand">
          <div class="rpt-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="7 14.5 10.5 11 13 13.5 17 9"/>
            </svg>
          </div>
          <div>
            <div class="rpt-brand-name">BudgetWise</div>
            <div class="rpt-brand-tagline">Monthly Financial Report</div>
          </div>
        </div>
        <div class="rpt-header-right">
          <div class="rpt-period">${monthLabel}</div>
          <div class="rpt-meta">Prepared for ${_resc(userName)}</div>
          <div class="rpt-meta">Generated ${generated}</div>
        </div>
      </div>

      <!-- ── Summary row ── -->
      <div class="rpt-summary-row">
        <div class="rpt-summary-card income">
          <div class="rpt-summary-label">Total Income</div>
          <div class="rpt-summary-value">${curr}${income.toLocaleString()}</div>
          <div class="rpt-summary-sub">${monthTxs.filter(t => t.type === 'income').length} transactions</div>
        </div>
        <div class="rpt-summary-card expense">
          <div class="rpt-summary-label">Total Expenses</div>
          <div class="rpt-summary-value">${curr}${expense.toLocaleString()}</div>
          <div class="rpt-summary-sub">${monthTxs.filter(t => t.type === 'expense').length} transactions</div>
        </div>
        <div class="rpt-summary-card ${net >= 0 ? 'net-pos' : 'net-neg'}">
          <div class="rpt-summary-label">Net Balance</div>
          <div class="rpt-summary-value">${net >= 0 ? '+' : ''}${curr}${Math.abs(net).toLocaleString()}</div>
          <div class="rpt-summary-sub">${net >= 0 ? 'Surplus' : 'Deficit'} this month</div>
        </div>
        <div class="rpt-summary-card savings">
          <div class="rpt-summary-label">Savings Rate</div>
          <div class="rpt-summary-value">${savingsRate}%</div>
          <div class="rpt-summary-sub">${savingsRate >= 20 ? '✓ Healthy' : savingsRate > 0 ? '↑ Room to grow' : '— No income'}</div>
        </div>
      </div>

      <!-- ── Two-column: categories + budgets ── -->
      <div class="rpt-two-col">

        <!-- Category breakdown -->
        <div class="rpt-section">
          <div class="rpt-section-title">Spending by Category</div>
          ${topCats.length === 0
            ? '<div class="rpt-empty">No expenses recorded this month.</div>'
            : topCats.map(([cat, amt]) => {
                const color    = getCategoryColor(cat);
                const barPct   = Math.round((amt / maxCatAmt) * 100);
                const ofExpPct = expense > 0 ? Math.round((amt / expense) * 100) : 0;
                return `
                  <div class="rpt-cat-row">
                    <div class="rpt-cat-top">
                      <span class="rpt-cat-name">${_resc(cat)}</span>
                      <span class="rpt-cat-amt">${curr}${amt.toLocaleString()}</span>
                    </div>
                    <div class="rpt-bar-track">
                      <div class="rpt-bar-fill" style="width:${barPct}%;background:${color}"></div>
                    </div>
                    <div class="rpt-cat-pct">${ofExpPct}% of total expenses</div>
                  </div>`;
              }).join('')
          }
        </div>

        <!-- Budget vs actual -->
        <div class="rpt-section">
          <div class="rpt-section-title">Budget vs Actual</div>
          ${monthBudgets.length === 0
            ? '<div class="rpt-empty">No budgets set for this month.</div>'
            : monthBudgets.map(b => {
                const spent = byCategory[b.category] || 0;
                const pct   = b.limit > 0 ? Math.min(Math.round((spent / b.limit) * 100), 100) : 0;
                const over  = spent > b.limit;
                return `
                  <div class="rpt-cat-row">
                    <div class="rpt-cat-top">
                      <span class="rpt-cat-name">${_resc(b.category)}</span>
                      <span class="rpt-cat-amt ${over ? 'rpt-text-red' : ''}">${curr}${spent.toLocaleString()} / ${curr}${Number(b.limit).toLocaleString()}</span>
                    </div>
                    <div class="rpt-bar-track">
                      <div class="rpt-bar-fill" style="width:${pct}%;background:${over ? '#DC2626' : '#16A34A'}"></div>
                    </div>
                    <div class="rpt-cat-pct ${over ? 'rpt-text-red' : ''}">
                      ${over
                        ? '⚠ Over budget by ' + curr + (spent - b.limit).toLocaleString()
                        : pct + '% used · ' + curr + Math.max(b.limit - spent, 0).toLocaleString() + ' remaining'}
                    </div>
                  </div>`;
              }).join('')
          }
        </div>
      </div>

      <!-- ── Transaction table ── -->
      <div class="rpt-section rpt-section-full">
        <div class="rpt-section-title">Transaction History</div>
        ${monthTxs.length === 0
          ? '<div class="rpt-empty">No transactions recorded this month.</div>'
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
                    const dateStr = new Date(t.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                    const catColor = getCategoryColor(t.category);
                    return `
                      <tr>
                        <td class="rpt-td-date">${dateStr}</td>
                        <td>${_resc(t.description)}${t.note ? `<span class="rpt-note"> · ${_resc(t.note)}</span>` : ''}</td>
                        <td><span class="rpt-cat-badge" style="background:${catColor}18;color:${catColor}">${_resc(t.category)}</span></td>
                        <td><span class="rpt-type-badge ${t.type}">${t.type}</span></td>
                        <td class="rpt-td-amt ${t.type}">${sign}${curr}${t.amount.toLocaleString()}</td>
                      </tr>`;
                  }).join('')}
              </tbody>
            </table>`
        }
      </div>

      <!-- ── Footer ── -->
      <div class="rpt-footer">
        <span>BudgetWise Financial Report</span>
        <span>&mdash;</span>
        <span>${monthLabel}</span>
        <span>&mdash;</span>
        <span>Generated ${generated}</span>
        <span>&mdash;</span>
        <span>Confidential</span>
      </div>

    </div><!-- /report-printable -->
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
