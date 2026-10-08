/**
 * FinTrack Pro - Data Store & State Management
 * Handles local persistence, transaction CRUD, state subscription, and demo data generator.
 */

const STORAGE_KEY = 'fintrack_pro_storage_v2';

const DEFAULT_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen (¥)' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar (CA$)' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar (AU$)' },
  { code: 'SGD', symbol: 'SG$', name: 'Singapore Dollar (SG$)' },
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
    { name: 'Freelance & Projects', icon: 'laptop', color: '#06B6D4' },
    { name: 'Investments & Dividends', icon: 'chart-pie', color: '#8B5CF6' },
    { name: 'Business Income', icon: 'building', color: '#3B82F6' },
    { name: 'Rental Income', icon: 'key', color: '#F59E0B' },
    { name: 'Cashback & Refunds', icon: 'arrow-down-left', color: '#14B8A6' },
    { name: 'Gifts & Rewards', icon: 'gift', color: '#EC4899' },
    { name: 'Other Income', icon: 'plus-circle', color: '#64748B' }
  ]
};

const DEFAULT_PAYMENT_METHODS = [
  'Bank Account',
  'UPI / Digital Wallet',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Net Banking',
  'PayPal / Other'
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

  // Load from LocalStorage or initialize with defaults
  loadState() {
    try {
      // Clear legacy storage v1 if present
      localStorage.removeItem('fintrack_pro_storage_v1');

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          transactions: parsed.transactions || [],
          budgets: parsed.budgets || { ...DEFAULT_BUDGETS },
          savingsGoal: parsed.savingsGoal || { target: 200000, name: 'Emergency & Growth Fund' },
          currency: parsed.currency || 'INR',
          theme: parsed.theme || 'dark',
          categories: parsed.categories || JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
          paymentMethods: parsed.paymentMethods || [...DEFAULT_PAYMENT_METHODS],
          filter: {
            timeframe: 'this-month',
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
      console.warn('Could not load stored state, initializing defaults', e);
    }

    return {
      transactions: [],
      budgets: { ...DEFAULT_BUDGETS },
      savingsGoal: { target: 200000, name: 'Emergency & Growth Fund' },
      currency: 'INR',
      theme: 'dark',
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      paymentMethods: [...DEFAULT_PAYMENT_METHODS],
      filter: {
        timeframe: 'this-month',
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

  // Persist state to local storage
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
      console.error('Failed to save state to localStorage', e);
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

  // Currency helpers
  getCurrencyInfo() {
    return DEFAULT_CURRENCIES.find(c => c.code === this.state.currency) || DEFAULT_CURRENCIES[0];
  }

  setCurrency(code) {
    this.state.currency = code;
    this.notify('currency_changed', code);
  }

  // Theme toggle
  setTheme(theme) {
    this.state.theme = theme;
    this.notify('theme_changed', theme);
  }

  // Transaction CRUD
  addTransaction(tx) {
    const newTx = {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      details: tx.details.trim(),
      amount: parseFloat(tx.amount),
      type: tx.type, // 'credit' or 'debit'
      category: tx.category,
      paymentMethod: tx.paymentMethod || 'Bank Account',
      date: tx.date || new Date().toISOString().split('T')[0],
      time: tx.time || new Date().toTimeString().split(' ')[0].substring(0, 5),
      notes: (tx.notes || '').trim(),
      tags: tx.tags ? (Array.isArray(tx.tags) ? tx.tags : tx.tags.split(',').map(t => t.trim()).filter(Boolean)) : []
    };

    this.state.transactions.unshift(newTx);
    this.notify('transaction_added', newTx);
    return newTx;
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

  // Budgets
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

  // Filter Management
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

  // Query Transactions based on active filter or custom query
  getFilteredTransactions(overrideFilter = null) {
    const filter = overrideFilter || this.state.filter;
    let list = [...this.state.transactions];

    // Timeframe filtering
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

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

    // Type filter
    if (filter.type && filter.type !== 'all') {
      list = list.filter(t => t.type === filter.type);
    }

    // Category filter
    if (filter.category && filter.category !== 'all') {
      list = list.filter(t => t.category === filter.category);
    }

    // Payment method filter
    if (filter.paymentMethod && filter.paymentMethod !== 'all') {
      list = list.filter(t => t.paymentMethod === filter.paymentMethod);
    }

    // Search query
    if (filter.search && filter.search.trim()) {
      const q = filter.search.toLowerCase().trim();
      list = list.filter(t => {
        return (
          t.details.toLowerCase().includes(q) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.paymentMethod && t.paymentMethod.toLowerCase().includes(q)) ||
          (t.notes && t.notes.toLowerCase().includes(q)) ||
          (t.amount.toString().includes(q)) ||
          (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
        );
      });
    }

    // Sorting
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

  // Key Financial Aggregates
  getSummaryMetrics(transactionsList = null) {
    const list = transactionsList !== null ? transactionsList : this.getFilteredTransactions();

    let totalCredit = 0; // Income
    let totalDebit = 0;  // Expenses
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

  // Load realistic demo data
  loadDemoData() {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const formatDate = (offsetDays) => {
      const d = new Date(now);
      d.setDate(d.getDate() - offsetDays);
      return d.toISOString().split('T')[0];
    };

    const demoTransactions = [
      // Current Month
      { details: 'Monthly Salary - Tech Systems', amount: 85000.00, type: 'credit', category: 'Monthly Salary', paymentMethod: 'Bank Account', date: formatDate(1), time: '09:00', notes: 'Monthly salary credited' },
      { details: 'Apartment Rent Payment', amount: 22000.00, type: 'debit', category: 'Housing & Rent', paymentMethod: 'Net Banking', date: formatDate(2), time: '10:30', notes: 'Monthly house rent' },
      { details: 'Supermarket Groceries & Essentials', amount: 3850.00, type: 'debit', category: 'Groceries', paymentMethod: 'UPI / Digital Wallet', date: formatDate(3), time: '17:45', notes: 'Monthly kitchen ration' },
      { details: 'Freelance Project Milestone', amount: 25000.00, type: 'credit', category: 'Freelance & Projects', paymentMethod: 'Bank Account', date: formatDate(4), time: '14:20', notes: 'Frontend dashboard contract' },
      { details: 'High-Speed Broadband Bill', amount: 1199.00, type: 'debit', category: 'Utilities & Bills', paymentMethod: 'UPI / Digital Wallet', date: formatDate(5), time: '11:15', notes: 'Airtel Fiber 200Mbps' },
      { details: 'Family Dinner at Barbeque Nation', amount: 3200.00, type: 'debit', category: 'Food & Dining', paymentMethod: 'Credit Card', date: formatDate(6), time: '20:10', notes: 'Weekend celebration dinner' },
      { details: 'Mutual Fund Dividend Distribution', amount: 2450.00, type: 'credit', category: 'Investments & Dividends', paymentMethod: 'Bank Account', date: formatDate(7), time: '08:00', notes: 'Nifty 50 dividend' },
      { details: 'Petrol & Vehicle Fuel', amount: 2500.00, type: 'debit', category: 'Transportation', paymentMethod: 'UPI / Digital Wallet', date: formatDate(8), time: '16:00', notes: 'Full tank fuel' },
      { details: 'Wireless Noise Cancelling Earbuds', amount: 4999.00, type: 'debit', category: 'Shopping', paymentMethod: 'Credit Card', date: formatDate(9), time: '13:40', notes: 'Electronics sale' },
      { details: 'Netflix & OTT Entertainment', amount: 649.00, type: 'debit', category: 'Entertainment', paymentMethod: 'Credit Card', date: formatDate(10), time: '02:00', notes: 'Monthly OTT subscription' },
      { details: 'Fresh Vegetables & Milk Delivery', amount: 1250.00, type: 'debit', category: 'Groceries', paymentMethod: 'UPI / Digital Wallet', date: formatDate(11), time: '18:25', notes: 'Daily organic vegetables' },
      { details: 'Specialty Coffee & Snacks', amount: 380.00, type: 'debit', category: 'Food & Dining', paymentMethod: 'UPI / Digital Wallet', date: formatDate(12), time: '08:45', notes: 'Cafe visit' },
      { details: 'Gym Annual Membership Installment', amount: 1800.00, type: 'debit', category: 'Health & Medical', paymentMethod: 'Debit Card', date: formatDate(14), time: '09:00', notes: 'Fitness center dues' },
      { details: 'Technical Consulting Fee', amount: 15000.00, type: 'credit', category: 'Freelance & Projects', paymentMethod: 'Bank Account', date: formatDate(15), time: '15:30', notes: 'Architecture advisory' },
      { details: 'Electricity Statement Bill', amount: 2350.00, type: 'debit', category: 'Utilities & Bills', paymentMethod: 'UPI / Digital Wallet', date: formatDate(16), time: '12:00', notes: 'State electricity board' },
      { details: 'Amazon Essentials & Book Purchases', amount: 1450.00, type: 'debit', category: 'Shopping', paymentMethod: 'Credit Card', date: formatDate(18), time: '21:10', notes: 'Reading books' },
      { details: 'Cab Rides & Metro Travel', amount: 780.00, type: 'debit', category: 'Transportation', paymentMethod: 'UPI / Digital Wallet', date: formatDate(19), time: '06:30', notes: 'Office commute' },
      { details: 'Weekend Resort Trip Stay', amount: 6500.00, type: 'debit', category: 'Travel & Vacations', paymentMethod: 'Credit Card', date: formatDate(21), time: '19:40', notes: 'Weekend resort booking' },
      { details: 'Credit Card Cashback Reward', amount: 750.00, type: 'credit', category: 'Cashback & Refunds', paymentMethod: 'Credit Card', date: formatDate(23), time: '11:00', notes: 'Rewards cashback' },
      { details: 'Routine Health Checkup & Dental', amount: 2000.00, type: 'debit', category: 'Health & Medical', paymentMethod: 'UPI / Digital Wallet', date: formatDate(25), time: '10:00', notes: 'Health clinic' },

      // Previous Month
      { details: 'Monthly Salary - Tech Systems', amount: 85000.00, type: 'credit', category: 'Monthly Salary', paymentMethod: 'Bank Account', date: formatDate(32), time: '09:00', notes: 'Previous month salary' },
      { details: 'Apartment Rent Payment', amount: 22000.00, type: 'debit', category: 'Housing & Rent', paymentMethod: 'Net Banking', date: formatDate(33), time: '10:30', notes: 'Rent transfer' },
      { details: 'Monthly Hypermarket Provisions', amount: 6200.00, type: 'debit', category: 'Groceries', paymentMethod: 'Debit Card', date: formatDate(35), time: '16:00', notes: 'Provisions' },
      { details: 'Train Tickets - Festival Travel', amount: 3400.00, type: 'debit', category: 'Travel & Vacations', paymentMethod: 'UPI / Digital Wallet', date: formatDate(38), time: '22:15', notes: 'Holiday tickets' },
      { details: 'Side Business Profits', amount: 12000.00, type: 'credit', category: 'Business Income', paymentMethod: 'Bank Account', date: formatDate(40), time: '13:00', notes: 'Product sales' },
      { details: 'Team Lunch Outing', amount: 1850.00, type: 'debit', category: 'Food & Dining', paymentMethod: 'UPI / Digital Wallet', date: formatDate(42), time: '19:30', notes: 'Team lunch' },
      { details: 'Mobile Postpaid Recharge', amount: 799.00, type: 'debit', category: 'Utilities & Bills', paymentMethod: 'UPI / Digital Wallet', date: formatDate(45), time: '10:00', notes: 'Cellular bill' },
      { details: 'Systematic Investment Plan (SIP)', amount: 15000.00, type: 'debit', category: 'Investments', paymentMethod: 'Bank Account', date: formatDate(48), time: '09:15', notes: 'Monthly SIP' },
      { details: 'Gift Received from Parents', amount: 5000.00, type: 'credit', category: 'Gifts & Rewards', paymentMethod: 'Bank Account', date: formatDate(50), time: '18:00', notes: 'Festival gift' }
    ];

    this.state.transactions = demoTransactions.map((tx, idx) => ({
      id: 'demo_tx_' + (Date.now() + idx),
      ...tx,
      tags: tx.category === 'Food & Dining' ? ['food', 'social'] : tx.category === 'Groceries' ? ['essentials'] : []
    }));

    this.state.budgets = { ...DEFAULT_BUDGETS };
    this.state.savingsGoal = { target: 250000, name: 'Financial Freedom & Emergency Vault' };
    this.notify('demo_data_loaded', this.state.transactions);
  }

  // Clear all data
  clearAll() {
    this.state.transactions = [];
    this.state.budgets = { ...DEFAULT_BUDGETS };
    this.notify('all_data_cleared', null);
  }

  // Import full JSON data
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

// Export singleton
window.store = new Store();
