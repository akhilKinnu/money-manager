/**
 * FinTrack Pro - Analytics Engine & Chart Visualizations
 * Provides a variety of analytics: Cashflow trends, category distributions,
 * day-of-week patterns, payment methods, monthly burn rate, and top expenses.
 */

class AnalyticsManager {
  constructor() {
    this.charts = {};
  }

  // Helper to get theme-aware colors
  getThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
      text: isDark ? '#94A3B8' : '#475569',
      heading: isDark ? '#F8FAFC' : '#0F172A',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      tooltipBg: isDark ? '#0F172A' : '#FFFFFF',
      tooltipText: isDark ? '#F8FAFC' : '#0F172A',
      tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    };
  }

  // Destroy existing chart to prevent memory leaks and redraw issues
  destroyChart(key) {
    if (this.charts[key]) {
      this.charts[key].destroy();
      delete this.charts[key];
    }
  }

  // Master update call for all analytics views
  renderAll() {
    const transactions = window.store.getFilteredTransactions();
    const allTransactions = window.store.state.transactions;

    this.renderKPICards(transactions);
    this.renderCashflowTrendChart(transactions);
    this.renderCategoryExpenseChart(transactions);
    this.renderIncomeSourceChart(transactions);
    this.renderMonthlyComparisonChart(allTransactions);
    this.renderDayOfWeekChart(transactions);
    this.renderPaymentMethodChart(transactions);
    this.renderTopExpensesList(transactions);
  }

  // 1. KPI Cards
  renderKPICards(transactions) {
    const metrics = window.store.getSummaryMetrics(transactions);
    const currency = window.store.getCurrencyInfo();

    // Total Net Balance
    const balanceEl = document.getElementById('kpiNetBalance');
    if (balanceEl) {
      balanceEl.textContent = UI.formatCurrency(metrics.netBalance);
      balanceEl.className = `text-2xl lg:text-3xl font-bold tracking-tight ${
        metrics.netBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'
      }`;
    }

    // Total Income
    const incomeEl = document.getElementById('kpiTotalIncome');
    if (incomeEl) {
      incomeEl.textContent = UI.formatCurrency(metrics.totalCredit);
    }

    // Total Expense
    const expenseEl = document.getElementById('kpiTotalExpense');
    if (expenseEl) {
      expenseEl.textContent = UI.formatCurrency(metrics.totalDebit);
    }

    // Savings Rate
    const savingsEl = document.getElementById('kpiSavingsRate');
    if (savingsEl) {
      const rate = metrics.savingsRate.toFixed(1);
      savingsEl.textContent = `${rate}%`;
      const badge = document.getElementById('kpiSavingsBadge');
      if (badge) {
        if (metrics.savingsRate >= 30) {
          badge.textContent = 'Excellent';
          badge.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        } else if (metrics.savingsRate > 0) {
          badge.textContent = 'Moderate';
          badge.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
        } else {
          badge.textContent = 'Deficit';
          badge.className = 'text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }
      }
    }

    // Counts
    const incomeCountEl = document.getElementById('kpiIncomeCount');
    if (incomeCountEl) incomeCountEl.textContent = `${metrics.creditCount} transactions`;

    const expenseCountEl = document.getElementById('kpiExpenseCount');
    if (expenseCountEl) expenseCountEl.textContent = `${metrics.debitCount} transactions`;
  }

  // 2. Cash Flow Trend Chart (Area / Line)
  renderCashflowTrendChart(transactions) {
    const canvas = document.getElementById('chartCashflowTrend');
    if (!canvas) return;

    this.destroyChart('cashflowTrend');

    // Group transactions by date
    const dateMap = {};
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    // If empty, generate empty placeholder
    if (sorted.length === 0) {
      this.renderEmptyChartNotice('chartCashflowTrendNotice', true);
      return;
    } else {
      this.renderEmptyChartNotice('chartCashflowTrendNotice', false);
    }

    sorted.forEach(t => {
      if (!dateMap[t.date]) {
        dateMap[t.date] = { income: 0, expense: 0 };
      }
      if (t.type === 'credit') dateMap[t.date].income += t.amount;
      if (t.type === 'debit') dateMap[t.date].expense += t.amount;
    });

    const labels = Object.keys(dateMap).map(d => UI.formatDate(d));
    const incomeData = Object.values(dateMap).map(v => v.income);
    const expenseData = Object.values(dateMap).map(v => v.expense);

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    // Gradients
    const incomeGradient = ctx.createLinearGradient(0, 0, 0, 300);
    incomeGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
    incomeGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    const expenseGradient = ctx.createLinearGradient(0, 0, 0, 300);
    expenseGradient.addColorStop(0, 'rgba(244, 63, 94, 0.4)');
    expenseGradient.addColorStop(1, 'rgba(244, 63, 94, 0.0)');

    this.charts['cashflowTrend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income (Credit)',
            data: incomeData,
            borderColor: '#10B981',
            backgroundColor: incomeGradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: labels.length > 20 ? 1 : 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10B981'
          },
          {
            label: 'Expense (Debit)',
            data: expenseData,
            borderColor: '#F43F5E',
            backgroundColor: expenseGradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointRadius: labels.length > 20 ? 1 : 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#F43F5E'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.heading,
              font: { family: 'Inter', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${UI.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              font: { family: 'Inter', size: 11 },
              maxTicksLimit: 8
            }
          },
          y: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => UI.formatCompactCurrency(val)
            }
          }
        }
      }
    });
  }

  // 3. Category Expense Breakdown (Doughnut)
  renderCategoryExpenseChart(transactions) {
    const canvas = document.getElementById('chartExpenseCategory');
    if (!canvas) return;

    this.destroyChart('expenseCategory');

    const expenses = transactions.filter(t => t.type === 'debit');
    if (expenses.length === 0) {
      this.renderEmptyChartNotice('chartExpenseCategoryNotice', true);
      const legendEl = document.getElementById('categoryLegendContainer');
      if (legendEl) legendEl.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">No expenses recorded yet.</p>';
      return;
    } else {
      this.renderEmptyChartNotice('chartExpenseCategoryNotice', false);
    }

    const categoryMap = {};
    expenses.forEach(t => {
      const cat = t.category || 'Miscellaneous';
      categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
    });

    // Sort categories descending by amount
    const sortedCats = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
    const labels = sortedCats.map(c => c[0]);
    const data = sortedCats.map(c => c[1]);
    const total = data.reduce((a, b) => a + b, 0);

    const colors = [
      '#F97316', '#10B981', '#3B82F6', '#F59E0B', '#6366F1',
      '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#06B6D4',
      '#D946EF', '#84CC16', '#64748B'
    ];

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    this.charts['expenseCategory'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: document.documentElement.classList.contains('dark') ? '#0F172A' : '#FFFFFF',
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${UI.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Update center label
    const centerTotalEl = document.getElementById('expenseCategoryCenterTotal');
    if (centerTotalEl) {
      centerTotalEl.textContent = UI.formatCompactCurrency(total);
    }

    // Render HTML custom breakdown list
    const legendEl = document.getElementById('categoryLegendContainer');
    if (legendEl) {
      legendEl.innerHTML = sortedCats.map(([cat, amount], idx) => {
        const color = colors[idx % colors.length];
        const pct = ((amount / total) * 100).toFixed(1);
        return `
          <div class="flex items-center justify-between text-xs py-1.5 border-b border-slate-700/20 dark:border-slate-800/60 last:border-0 hover:bg-slate-800/10 dark:hover:bg-slate-800/30 px-2 rounded-lg transition-colors">
            <div class="flex items-center gap-2 truncate">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color}"></span>
              <span class="font-medium text-slate-700 dark:text-slate-300 truncate">${cat}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-slate-500 font-mono">${pct}%</span>
              <span class="font-semibold text-slate-900 dark:text-slate-100 font-mono">${UI.formatCurrency(amount)}</span>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Income Sources Breakdown
  renderIncomeSourceChart(transactions) {
    const canvas = document.getElementById('chartIncomeSources');
    if (!canvas) return;

    this.destroyChart('incomeSources');

    const credits = transactions.filter(t => t.type === 'credit');
    if (credits.length === 0) {
      this.renderEmptyChartNotice('chartIncomeSourcesNotice', true);
      return;
    } else {
      this.renderEmptyChartNotice('chartIncomeSourcesNotice', false);
    }

    const sourceMap = {};
    credits.forEach(t => {
      const cat = t.category || 'Other Income';
      sourceMap[cat] = (sourceMap[cat] || 0) + t.amount;
    });

    const sortedSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]);
    const labels = sortedSources.map(s => s[0]);
    const data = sortedSources.map(s => s[1]);
    const total = data.reduce((a, b) => a + b, 0);

    const colors = ['#10B981', '#06B6D4', '#8B5CF6', '#3B82F6', '#F59E0B', '#14B8A6', '#EC4899', '#64748B'];
    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    this.charts['incomeSources'] = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length).map(c => c + 'CC'),
          borderWidth: 1,
          borderColor: theme.grid
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: theme.heading,
              font: { family: 'Inter', size: 11 },
              boxWidth: 10
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.r;
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${ctx.label}: ${UI.formatCurrency(val)} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          r: {
            ticks: { display: false },
            grid: { color: theme.grid }
          }
        }
      }
    });
  }

  // 5. Monthly Burn Rate & Comparison (Side by side Bar Chart)
  renderMonthlyComparisonChart(allTransactions) {
    const canvas = document.getElementById('chartMonthlyComparison');
    if (!canvas) return;

    this.destroyChart('monthlyComparison');

    if (allTransactions.length === 0) {
      this.renderEmptyChartNotice('chartMonthlyNotice', true);
      return;
    } else {
      this.renderEmptyChartNotice('chartMonthlyNotice', false);
    }

    // Build last 6 months bucket
    const monthKeys = [];
    const monthNames = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthNames.push(d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }));
    }

    const incomeMap = {};
    const expenseMap = {};
    monthKeys.forEach(k => {
      incomeMap[k] = 0;
      expenseMap[k] = 0;
    });

    allTransactions.forEach(t => {
      const key = t.date.substring(0, 7);
      if (incomeMap[key] !== undefined) {
        if (t.type === 'credit') incomeMap[key] += t.amount;
        if (t.type === 'debit') expenseMap[key] += t.amount;
      }
    });

    const incomeData = monthKeys.map(k => incomeMap[k]);
    const expenseData = monthKeys.map(k => expenseMap[k]);

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    this.charts['monthlyComparison'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: monthNames,
        datasets: [
          {
            label: 'Income (Credit)',
            data: incomeData,
            backgroundColor: '#10B981',
            borderRadius: 6,
            maxBarThickness: 32
          },
          {
            label: 'Expense (Debit)',
            data: expenseData,
            backgroundColor: '#F43F5E',
            borderRadius: 6,
            maxBarThickness: 32
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: theme.heading,
              font: { family: 'Inter', size: 12, weight: 600 },
              usePointStyle: true,
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${UI.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => UI.formatCompactCurrency(val)
            }
          }
        }
      }
    });
  }

  // 6. Day of the Week Spending Pattern
  renderDayOfWeekChart(transactions) {
    const canvas = document.getElementById('chartDayOfWeek');
    if (!canvas) return;

    this.destroyChart('dayOfWeek');

    const expenses = transactions.filter(t => t.type === 'debit');
    if (expenses.length === 0) {
      this.renderEmptyChartNotice('chartDayNotice', true);
      return;
    } else {
      this.renderEmptyChartNotice('chartDayNotice', false);
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];

    expenses.forEach(t => {
      const parts = t.date.split('-');
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const dayIdx = d.getDay();
        dayTotals[dayIdx] += t.amount;
      }
    });

    const maxDayVal = Math.max(...dayTotals);
    const backgroundColors = dayTotals.map(val =>
      val === maxDayVal && val > 0 ? '#EC4899' : '#6366F1'
    );

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    this.charts['dayOfWeek'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: shortDays,
        datasets: [{
          label: 'Total Spent',
          data: dayTotals,
          backgroundColor: backgroundColors,
          borderRadius: 6,
          maxBarThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => `Spent on ${days[ctx.dataIndex]}: ${UI.formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: theme.text, font: { family: 'Inter', size: 11 } }
          },
          y: {
            grid: { color: theme.grid },
            ticks: {
              color: theme.text,
              font: { family: 'Inter', size: 11 },
              callback: (val) => UI.formatCompactCurrency(val)
            }
          }
        }
      }
    });
  }

  // 7. Payment Methods Distribution
  renderPaymentMethodChart(transactions) {
    const canvas = document.getElementById('chartPaymentMethod');
    if (!canvas) return;

    this.destroyChart('paymentMethod');

    if (transactions.length === 0) {
      this.renderEmptyChartNotice('chartPaymentNotice', true);
      return;
    } else {
      this.renderEmptyChartNotice('chartPaymentNotice', false);
    }

    const methodMap = {};
    transactions.forEach(t => {
      const m = t.paymentMethod || 'Other';
      methodMap[m] = (methodMap[m] || 0) + t.amount;
    });

    const labels = Object.keys(methodMap);
    const data = Object.values(methodMap);
    const colors = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#64748B'];

    const theme = this.getThemeColors();
    const ctx = canvas.getContext('2d');

    this.charts['paymentMethod'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: document.documentElement.classList.contains('dark') ? '#0F172A' : '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.heading,
              font: { family: 'Inter', size: 11 },
              boxWidth: 8
            }
          },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.tooltipText,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${UI.formatCurrency(ctx.parsed)}`
            }
          }
        }
      }
    });
  }

  // 8. Top 5 Largest Expenses List
  renderTopExpensesList(transactions) {
    const listEl = document.getElementById('topExpensesList');
    if (!listEl) return;

    const topDebits = transactions
      .filter(t => t.type === 'debit')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    if (topDebits.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-slate-500 text-center py-6">No expenses found.</p>';
      return;
    }

    const totalExpense = transactions
      .filter(t => t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0);

    listEl.innerHTML = topDebits.map((tx, idx) => {
      const pct = totalExpense > 0 ? ((tx.amount / totalExpense) * 100).toFixed(1) : 0;
      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/60 transition-all">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center shrink-0">
              #${idx + 1}
            </span>
            <div>
              <p class="font-semibold text-slate-200 text-sm truncate max-w-[160px] sm:max-w-xs">${tx.details}</p>
              <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>${tx.category}</span>
                <span>•</span>
                <span>${UI.formatDate(tx.date)}</span>
              </div>
            </div>
          </div>
          <div class="text-right">
            <p class="font-bold text-rose-400 text-sm font-mono">${UI.formatCurrency(tx.amount)}</p>
            <p class="text-[11px] text-slate-500 font-mono">${pct}% of spend</p>
          </div>
        </div>
      `;
    }).join('');
  }

  // Empty state notice helper
  renderEmptyChartNotice(elementId, show) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (show) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }
}

window.analytics = new AnalyticsManager();
