/**
 * FinTrack Pro - Main Application Controller
 * Handles routing/views, timeframe filters, settings, shortcuts, and subscriptions.
 */

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.init();
  }

  init() {
    // 1. Apply saved theme
    UI.applyTheme(window.store.state.theme);

    // 2. Setup currency selector
    this.setupCurrencySelector();

    // 3. Setup Navigation tabs
    this.setupNavigation();

    // 4. Setup Timeframe buttons
    this.setupTimeframeFilters();

    // 5. Setup Keyboard shortcuts
    this.setupShortcuts();

    // 6. Setup Store listener to reactively update UI
    window.store.subscribe((event, data, state) => {
      this.refreshCurrentView();
    });

    // 7. Initialize view with clean records
    this.refreshCurrentView();

    // Initialize quick add categories
    window.transactions.populateCategorySelect('quickTxCategory', 'debit');
    window.transactions.populateCategorySelect('modalTxCategory', 'debit');

    // Setup file import listener
    const fileInput = document.getElementById('jsonFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => window.exportImport.handleFileImport(e));
    }
  }

  setupCurrencySelector() {
    const selector = document.getElementById('currencySelector');
    if (!selector) return;

    selector.value = window.store.state.currency;
    selector.addEventListener('change', (e) => {
      window.store.setCurrency(e.target.value);
      UI.showToast(`Currency changed to ${e.target.value}`, 'info');
    });
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll('[data-nav-view]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-nav-view');
        this.switchView(view);
      });
    });

    // Theme toggle button
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextTheme = window.store.state.theme === 'dark' ? 'light' : 'dark';
        window.store.setTheme(nextTheme);
        UI.applyTheme(nextTheme);
        // Refresh charts so their grid and text colors update
        window.analytics.renderAll();
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle active classes on nav buttons
    document.querySelectorAll('[data-nav-view]').forEach(btn => {
      const isTarget = btn.getAttribute('data-nav-view') === viewName;
      if (isTarget) {
        btn.classList.add('nav-active');
        btn.classList.remove('nav-inactive');
      } else {
        btn.classList.remove('nav-active');
        btn.classList.add('nav-inactive');
      }
    });

    // Show/hide view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      if (sec.id === `view-${viewName}`) {
        sec.classList.remove('hidden');
      } else {
        sec.classList.add('hidden');
      }
    });

    // Refresh contents
    this.refreshCurrentView();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setupTimeframeFilters() {
    const buttons = document.querySelectorAll('[data-timeframe]');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const timeframe = btn.getAttribute('data-timeframe');
        buttons.forEach(b => {
          b.classList.remove('timeframe-active');
          b.classList.add('timeframe-inactive');
        });
        btn.classList.add('timeframe-active');
        btn.classList.remove('timeframe-inactive');

        if (timeframe === 'custom') {
          const customPicker = document.getElementById('customDateRangePicker');
          if (customPicker) customPicker.classList.remove('hidden');
        } else {
          const customPicker = document.getElementById('customDateRangePicker');
          if (customPicker) customPicker.classList.add('hidden');
          window.store.setFilter({ timeframe, startDate: '', endDate: '' });
        }
      });
    });

    // Custom date range inputs
    const startInput = document.getElementById('customStartDate');
    const endInput = document.getElementById('customEndDate');
    const applyBtn = document.getElementById('applyCustomDateBtn');

    if (applyBtn && startInput && endInput) {
      applyBtn.addEventListener('click', () => {
        if (!startInput.value || !endInput.value) {
          UI.showToast('Please select both start and end dates', 'warning');
          return;
        }
        window.store.setFilter({
          timeframe: 'custom',
          startDate: startInput.value,
          endDate: endInput.value
        });
      });
    }
  }

  setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        if (e.key === 'Escape') {
          UI.closeModal('txModal');
          UI.closeModal('budgetModal');
          UI.closeModal('savingsGoalModal');
        }
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        window.transactions.openAddModal('debit');
      } else if (e.key === 'd' || e.key === 'D') {
        this.switchView('dashboard');
      } else if (e.key === 't' || e.key === 'T') {
        this.switchView('transactions');
      } else if (e.key === 'a' || e.key === 'A') {
        this.switchView('analytics');
      } else if (e.key === 'b' || e.key === 'B') {
        this.switchView('budgets');
      } else if (e.key === 'Escape') {
        UI.closeModal('txModal');
        UI.closeModal('budgetModal');
        UI.closeModal('savingsGoalModal');
      }
    });
  }

  refreshCurrentView() {
    // 1. Dashboard View
    window.analytics.renderAll();
    window.transactions.renderDashboardRecent();
    window.budgets.renderDashboardBudgets();

    // 2. Transactions View
    window.transactions.renderTable();

    // 3. Budgets View
    window.budgets.renderFullBudgets();

    // Update global status / stats
    const totalCountEl = document.getElementById('statTotalTransactions');
    if (totalCountEl) totalCountEl.textContent = window.store.state.transactions.length;
  }
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
