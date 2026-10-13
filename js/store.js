/**
 * FinTrack Pro - State Store & Transaction Ledger
 * Manages transactions, budgets, categories, and filters (No external DB/Cloud or Demo Data).
 */

const STORAGE_KEY = 'fintrack_hdfc_ledger_v1';

const DEFAULT_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' }
];

const DEFAULT_CATEGORIES = {
  debit: [
    { name: 'Food & Dining', icon: 'utensils', color: '#F97316' },
    { name: 'Groceries', icon: 'shopping-cart', color: '#10B981' },
    { name: 'Housing & Rent', icon: 'home', color: '#3B82F6' },
    { name: 'Utilities & Bills', icon: 'zap', color: '#F59E0B' },
    { name: 'Transportation', icon: 'car', color: '#6366F1' },
    { name: 'Shopping', icon: 'bag-shopping', color: '#EC4899' },
    { name: 'Entertainment', icon: 'tv', color: '#8B5CF6' },
    { name: 'Health & Medical', icon: 'heart-pulse', color: '#EF4444' },
    { name: 'Education', icon: 'book-open', color: '#14B8A6' },
    { name: 'Travel & Vacations', icon: 'plane', color: '#06B6D4' },
    { name: 'Personal Care', icon: 'sparkles', color: '#D946EF' },
    { name: 'Investments', icon: 'trending-up', color: '#84CC16' },
    { name: 'Miscellaneous', icon: 'more-horizontal', color: '#64748B' }
  ],
  credit: [
    { name: 'Monthly Salary', icon: 'briefcase', color: '#10B981' },
    { name: 'UPI / Account Credit', icon: 'arrow-down-left', color: '#06B6D4' },
    { name: 'Freelance & Projects', icon: 'laptop', color: '#3B82F6' },
    { name: 'Investments & Dividends', icon: 'chart-pie', color: '#8B5CF6' },
    { name: 'Refunds & Cashback', icon: 'gift', color: '#14B8A6' },
    { name: 'Other Income', icon: 'plus-circle', color: '#64748B' }
  ]
};

const DEFAULT_PAYMENT_METHODS = [
  'HDFC UPI',
  'HDFC Credit Card',
  'HDFC Debit Card',
  'HDFC NetBanking',
  'HDFC Bank Account',
  'Cash'
];

const DEFAULT_BUDGETS = {
  'Food & Dining': 12000,
  'Groceries': 15000,
  'Housing & Rent': 25000,
  'Utilities & Bills': 4500,
  'Transportation': 5000,
  'Shopping': 8000,
  'Entertainment': 4000
};

class Store {
  constructor() {
    this.subscribers = [];
    this.state = this.loadState();
  }

  loadState() {
    try {
      // Remove any legacy keys
      localStorage.removeItem('fintrack_pro_storage_v1');
      localStorage.removeItem('fintrack_pro_storage_v2');

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          transactions: parsed.transactions || [],
          budgets: parsed.budgets || { ...DEFAULT_BUDGETS },
          savingsGoal: parsed.savingsGoal || { target: 200000, name: 'Savings Target' },
          currency: parsed.currency || 'INR',
          theme: parsed.theme || 'dark',
          categories: parsed.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
          paymentMethods: parsed.paymentMethods || [...DEFAULT_PAYMENT_METHODS],
          filter: {
            timeframe: 'all',
            startDate: '',
            endDate: '',
            type: 'all',
            category: 'all',
            paymentMethod: 'all',
            search: '',
            sortBy: 'date-desc'
          }
        };
      }
    } catch (e) {
      console.warn('Could not load state, initializing defaults', e);
    }

    return {
      transactions: [],
      budgets: { ...DEFAULT_BUDGETS },
      savingsGoal: { target: 200000, name: 'Savings Target' },
      currency: 'INR',
      theme: 'dark',
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      paymentMethods: [...DEFAULT_PAYMENT_METHODS],
      filter: {
        timeframe: 'all',
        startDate: '',
        endDate: '',
        type: 'all',
        category: 'all',
        paymentMethod: 'all',
        search: '',
        sortBy: 'date-desc'
      }
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        transactions: this.state.transactions,
        budgets: this.state.budgets,
        savingsGoal: this.state.savingsGoal,
        currency: this.state.currency,
        theme: this.state.theme,
        categories: this.state.categories,
        paymentMethods: this.state.paymentMethods
      }));
    } catch (e) {
      console.error('Failed to save state locally', e);
    }
  }

  subscribe(listener) {
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter(fn => fn !== listener);
    };
  }

  notify(event, data) {
    this.saveState();
    this.subscribers.forEach(listener => {
      try {
        listener(event, data, this.state);
      } catch (e) {
        console.error('Error in subscriber listener:', e);
      }
    });
  }

  getCurrencyInfo() {
    return DEFAULT_CURRENCIES.find(c => c.code === this.state.currency) || DEFAULT_CURRENCIES[0];
  }

  setCurrency(code) {
    this.state.currency = code;
    this.notify('currency_changed', code);
  }

  setTheme(theme) {
    this.state.theme = theme;
    this.notify('theme_changed', theme);
  }

  // Transaction CRUD
  addTransaction(tx, silent = false) {
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      details: tx.details.trim(),
      amount: parseFloat(tx.amount),
      type: tx.type, // 'credit' or 'debit'
      category: tx.category,
      paymentMethod: tx.paymentMethod || 'HDFC Bank Account',
      date: tx.date || new Date().toISOString().split('T')[0],
      time: tx.time || new Date().toTimeString().split(' ')[0].substring(0, 5),
      notes: (tx.notes || '').trim(),
      gmailMessageId: tx.gmailMessageId || null,
      tags: tx.tags ? (Array.isArray(tx.tags) ? tx.tags : tx.tags.split(',').map(t => t.trim()).filter(Boolean)) : []
    };

    this.state.transactions.unshift(newTx);
    if (!silent) {
      this.notify('transaction_added', newTx);
    }
    return newTx;
  }

  addBatchTransactions(txArray) {
    const existingGmailIds = new Set(
      this.state.transactions.map(t => t.gmailMessageId).filter(Boolean)
    );
    let addedCount = 0;

    txArray.forEach(tx => {
      if (tx.gmailMessageId && existingGmailIds.has(tx.gmailMessageId)) {
        return; // Skip duplicate email
      }
      this.addTransaction(tx, true);
      if (tx.gmailMessageId) existingGmailIds.add(tx.gmailMessageId);
      addedCount++;
    });

    if (addedCount > 0) {
      this.notify('transactions_batch_added', { count: addedCount });
    }
    return addedCount;
  }

  updateTransaction(id, updatedFields) {
    const index = this.state.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      this.state.transactions[index] = {
        ...this.state.transactions[index],
        ...updatedFields,
        amount: parseFloat(updatedFields.amount !== undefined ? updatedFields.amount : this.state.transactions[index].amount),
        details: updatedFields.details !== undefined ? updatedFields.details.trim() : this.state.transactions[index].details
      };
      this.notify('transaction_updated', this.state.transactions[index]);
      return this.state.transactions[index];
    }
    return null;
  }

  deleteTransaction(id) {
    const index = this.state.transactions.findIndex(t => t.id === id);
    if (index !== -1) {
      const removed = this.state.transactions.splice(index, 1)[0];
      this.notify('transaction_deleted', removed);
      return removed;
    }
    return null;
  }

  deleteBatchTransactions(ids) {
    const idSet = new Set(ids);
    const beforeCount = this.state.transactions.length;
    this.state.transactions = this.state.transactions.filter(t => !idSet.has(t.id));
    this.notify('transactions_batch_deleted', { count: beforeCount - this.state.transactions.length });
  }

  setBudget(category, amount) {
    this.state.budgets[category] = Math.max(0, parseFloat(amount));
    this.notify('budget_updated', { category, amount: this.state.budgets[category] });
  }

  deleteBudget(category) {
    delete this.state.budgets[category];
    this.notify('budget_deleted', { category });
  }

  setSavingsGoal(goal) {
    this.state.savingsGoal = {
      target: parseFloat(goal.target) || 0,
      name: goal.name || 'Savings Goal'
    };
    this.notify('savings_goal_updated', this.state.savingsGoal);
  }

  setFilter(updates) {
    this.state.filter = {
      ...this.state.filter,
      ...updates
    };
    this.notify('filter_changed', this.state.filter);
  }

  resetFilter() {
    this.state.filter = {
      timeframe: 'all',
      startDate: '',
      endDate: '',
      type: 'all',
      category: 'all',
      paymentMethod: 'all',
      search: '',
      sortBy: 'date-desc'
    };
    this.notify('filter_changed', this.state.filter);
  }

  getFilteredTransactions(overrideFilter = null) {
    const filter = overrideFilter || this.state.filter;
    let list = [...this.state.transactions];

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (filter.timeframe === 'today') {
      const todayStr = now.toISOString().split('T')[0];
      list = list.filter(t => t.date === todayStr);
    } else if (filter.timeframe === 'this-month') {
      list = list.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    } else if (filter.timeframe === 'last-month') {
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const lastMonthIndex = currentMonth === 0 ? 11 : currentMonth - 1;
      list = list.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonthIndex;
      });
    } else if (filter.timeframe === 'this-year') {
      list = list.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === currentYear;
      });
    } else if (filter.timeframe === 'last-30-days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      list = list.filter(t => new Date(t.date) >= thirtyDaysAgo);
    } else if (filter.timeframe === 'custom') {
      if (filter.startDate) {
        list = list.filter(t => t.date >= filter.startDate);
      }
      if (filter.endDate) {
        list = list.filter(t => t.date <= filter.endDate);
      }
    }

    if (filter.type && filter.type !== 'all') {
      list = list.filter(t => t.type === filter.type);
    }

    if (filter.category && filter.category !== 'all') {
      list = list.filter(t => t.category === filter.category);
    }

    if (filter.paymentMethod && filter.paymentMethod !== 'all') {
      list = list.filter(t => t.paymentMethod === filter.paymentMethod);
    }

    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(t => {
        return (
          t.details.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.amount.toString().includes(q))
        );
      });
    }

    list.sort((a, b) => {
      if (filter.sortBy === 'date-desc') {
        const cmp = b.date.localeCompare(a.date);
        return cmp !== 0 ? cmp : (b.time || '').localeCompare(a.time || '');
      } else if (filter.sortBy === 'date-asc') {
        const cmp = a.date.localeCompare(b.date);
        return cmp !== 0 ? cmp : (a.time || '').localeCompare(b.time || '');
      } else if (filter.sortBy === 'amount-desc') {
        return b.amount - a.amount;
      } else if (filter.sortBy === 'amount-asc') {
        return a.amount - b.amount;
      } else if (filter.sortBy === 'details-asc') {
        return a.details.localeCompare(b.details);
      }
      return 0;
    });

    return list;
  }

  getSummaryMetrics(transactionsList = null) {
    const list = transactionsList !== null ? transactionsList : this.getFilteredTransactions();

    let totalCredit = 0;
    let totalDebit = 0;
    let creditCount = 0;
    let debitCount = 0;

    list.forEach(t => {
      if (t.type === 'credit') {
        totalCredit += t.amount;
        creditCount++;
      } else if (t.type === 'debit') {
        totalDebit += t.amount;
        debitCount++;
      }
    });

    const netBalance = totalCredit - totalDebit;
    const savingsRate = totalCredit > 0 ? ((netBalance / totalCredit) * 100) : 0;
    const avgSpendPerTransaction = debitCount > 0 ? (totalDebit / debitCount) : 0;

    return {
      totalCredit,
      totalDebit,
      netBalance,
      savingsRate: Math.max(-100, Math.min(100, savingsRate)),
      creditCount,
      debitCount,
      totalCount: list.length,
      avgSpendPerTransaction
    };
  }

  clearAll() {
    this.state.transactions = [];
    this.state.budgets = { ...DEFAULT_BUDGETS };
    this.notify('all_data_cleared', null);
  }

  importJSON(jsonData) {
    if (!jsonData || !Array.isArray(jsonData.transactions)) {
      throw new Error('Invalid JSON format: missing transactions list');
    }
    this.state.transactions = jsonData.transactions;
    if (jsonData.budgets) this.state.budgets = jsonData.budgets;
    if (jsonData.savingsGoal) this.state.savingsGoal = jsonData.savingsGoal;
    if (jsonData.currency) this.state.currency = jsonData.currency;
    if (jsonData.categories) this.state.categories = jsonData.categories;
    this.notify('data_imported', this.state);
  }
}

window.store = new Store();
