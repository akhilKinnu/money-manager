/**
 * FinTrack Pro - Budgets & Savings Goals Manager
 * Tracks category-specific spending caps, calculates remaining allowances,
 * and monitors savings target progress.
 */

class BudgetManager {
  constructor() {
    this.initEventListeners();
  }

  initEventListeners() {
    // Set Budget form modal
    const budgetForm = document.getElementById('budgetModalForm');
    if (budgetForm) {
      budgetForm.addEventListener('submit', (e) => this.handleBudgetSubmit(e));
    }

    // Savings Goal form modal
    const goalForm = document.getElementById('savingsGoalForm');
    if (goalForm) {
      goalForm.addEventListener('submit', (e) => this.handleGoalSubmit(e));
    }
  }

  // Calculate spending per category for current month
  getCurrentMonthCategorySpend() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlyDebits = window.store.state.transactions.filter(t => {
      if (t.type !== 'debit') return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const spendMap = {};
    monthlyDebits.forEach(t => {
      const cat = t.category || 'Miscellaneous';
      spendMap[cat] = (spendMap[cat] || 0) + t.amount;
    });

    return spendMap;
  }

  // Render Dashboard mini budget list
  renderDashboardBudgets() {
    const container = document.getElementById('dashboardBudgetList');
    if (!container) return;

    const budgets = window.store.state.budgets || {};
    const spendMap = this.getCurrentMonthCategorySpend();
    const budgetEntries = Object.entries(budgets);

    if (budgetEntries.length === 0) {
      container.innerHTML = '<p class="text-xs text-slate-500 py-3 text-center">No budgets set. Click "Budgets" tab to configure.</p>';
      return;
    }

    // Show top 4 categories with budgets
    container.innerHTML = budgetEntries.slice(0, 4).map(([category, limit]) => {
      const spent = spendMap[category] || 0;
      const pct = Math.min(100, Math.round((spent / limit) * 100));
      const isOver = spent > limit;

      let barColor = 'bg-emerald-500';
      if (pct > 90) barColor = 'bg-rose-500';
      else if (pct > 75) barColor = 'bg-amber-500';

      return `
        <div class="space-y-1.5 py-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-200 truncate max-w-[140px]">${category}</span>
            <div class="flex items-center gap-1.5">
              <span class="font-mono ${isOver ? 'text-rose-400 font-bold' : 'text-slate-300'}">${UI.formatCurrency(spent)}</span>
              <span class="text-slate-500 font-mono">/ ${UI.formatCurrency(limit)}</span>
            </div>
          </div>
          <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Full Budgets Page
  renderFullBudgets() {
    const grid = document.getElementById('fullBudgetsGrid');
    if (!grid) return;

    const budgets = window.store.state.budgets || {};
    const spendMap = this.getCurrentMonthCategorySpend();
    const categories = window.store.state.categories.debit || [];

    // Also render categories that don't have a budget yet so user can set one easily
    const allDebitCategoryNames = categories.map(c => c.name);

    let html = '';

    // Render active budgets first
    Object.entries(budgets).forEach(([category, limit]) => {
      const spent = spendMap[category] || 0;
      const remaining = limit - spent;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isOver = spent > limit;

      let statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">On Track</span>`;
      let barColor = 'bg-emerald-500';

      if (isOver) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">Exceeded</span>`;
        barColor = 'bg-rose-500';
      } else if (pct >= 80) {
        statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Near Limit</span>`;
        barColor = 'bg-amber-500';
      }

      html += `
        <div class="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h4 class="font-bold text-slate-100 text-base">${category}</h4>
              <p class="text-xs text-slate-400 mt-0.5">Monthly Spending Cap</p>
            </div>
            <div class="flex items-center gap-2">
              ${statusBadge}
              <button onclick="window.budgets.openEditBudgetModal('${category}', ${limit})" class="text-slate-400 hover:text-indigo-400 p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </button>
            </div>
          </div>

          <div class="my-4">
            <div class="flex justify-between items-baseline mb-1.5">
              <span class="text-2xl font-bold font-mono text-slate-100">${UI.formatCurrency(spent)}</span>
              <span class="text-sm font-mono text-slate-400">Limit: ${UI.formatCurrency(limit)}</span>
            </div>
            <div class="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
              <div class="h-full rounded-full ${barColor} transition-all duration-500" style="width: ${Math.min(100, pct)}%"></div>
            </div>
            <div class="flex justify-between items-center text-xs mt-2 text-slate-400">
              <span>${pct}% used</span>
              <span class="${isOver ? 'text-rose-400 font-semibold' : 'text-slate-300'}">
                ${isOver ? `Over by ${UI.formatCurrency(Math.abs(remaining))}` : `${UI.formatCurrency(remaining)} remaining`}
              </span>
            </div>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html || '<p class="text-slate-400">No category budgets yet. Click "+ Set Budget" to define one.</p>';

    // Render Savings Goal
    this.renderSavingsGoal();
  }

  // Render Savings Goal Banner / Widget
  renderSavingsGoal() {
    const goal = window.store.state.savingsGoal || { target: 10000, name: 'Savings Goal' };
    const allMetrics = window.store.getSummaryMetrics(window.store.state.transactions);
    const savedSoFar = Math.max(0, allMetrics.netBalance);
    const pct = goal.target > 0 ? Math.min(100, Math.round((savedSoFar / goal.target) * 100)) : 0;

    const goalNameEl = document.getElementById('savingsGoalName');
    const goalCurrentEl = document.getElementById('savingsGoalCurrent');
    const goalTargetEl = document.getElementById('savingsGoalTarget');
    const goalPctEl = document.getElementById('savingsGoalPct');
    const goalBarEl = document.getElementById('savingsGoalBar');

    if (goalNameEl) goalNameEl.textContent = goal.name;
    if (goalCurrentEl) goalCurrentEl.textContent = UI.formatCurrency(savedSoFar);
    if (goalTargetEl) goalTargetEl.textContent = UI.formatCurrency(goal.target);
    if (goalPctEl) goalPctEl.textContent = `${pct}% Achieved`;
    if (goalBarEl) goalBarEl.style.width = `${pct}%`;
  }

  // Open Edit Budget Modal
  openEditBudgetModal(category = '', limit = '') {
    const select = document.getElementById('budgetCategorySelect');
    const input = document.getElementById('budgetAmountInput');
    if (!select || !input) return;

    const debitCategories = window.store.state.categories.debit || [];
    select.innerHTML = debitCategories.map(c => `
      <option value="${c.name}" ${c.name === category ? 'selected' : ''}>${c.name}</option>
    `).join('');

    input.value = limit || '';
    UI.openModal('budgetModal');
  }

  handleBudgetSubmit(e) {
    e.preventDefault();
    const select = document.getElementById('budgetCategorySelect');
    const input = document.getElementById('budgetAmountInput');

    const cat = select.value;
    const amount = parseFloat(input.value);

    if (isNaN(amount) || amount <= 0) {
      UI.showToast('Please enter a valid monthly budget limit', 'warning');
      return;
    }

    window.store.setBudget(cat, amount);
    UI.closeModal('budgetModal');
    UI.showToast(`Budget for ${cat} set to ${UI.formatCurrency(amount)}`, 'success');
  }

  // Open Goal Modal
  openGoalModal() {
    const goal = window.store.state.savingsGoal;
    const nameInput = document.getElementById('goalNameInput');
    const targetInput = document.getElementById('goalTargetInput');

    if (nameInput) nameInput.value = goal.name;
    if (targetInput) targetInput.value = goal.target;

    UI.openModal('savingsGoalModal');
  }

  handleGoalSubmit(e) {
    e.preventDefault();
    const nameInput = document.getElementById('goalNameInput');
    const targetInput = document.getElementById('goalTargetInput');

    const name = nameInput.value.trim() || 'Savings Goal';
    const target = parseFloat(targetInput.value);

    if (isNaN(target) || target <= 0) {
      UI.showToast('Please enter a valid target amount', 'warning');
      return;
    }

    window.store.setSavingsGoal({ name, target });
    UI.closeModal('savingsGoalModal');
    UI.showToast('Savings target updated!', 'success');
  }
}

window.budgets = new BudgetManager();
