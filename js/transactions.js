/**
 * FinTrack Pro - Transaction Management Controller
 * Handles CRUD operations, modal forms, table rendering, search/filter, and pagination.
 */

class TransactionManager {
  constructor() {
    this.currentPage = 1;
    this.pageSize = 10;
    this.selectedIds = new Set();
    this.editingId = null;

    this.initEventListeners();
  }

  initEventListeners() {
    // Quick Add inline form on Dashboard
    const quickAddForm = document.getElementById('quickAddForm');
    if (quickAddForm) {
      quickAddForm.addEventListener('submit', (e) => this.handleQuickAdd(e));
    }

    // Modal Add/Edit form
    const txModalForm = document.getElementById('txModalForm');
    if (txModalForm) {
      txModalForm.addEventListener('submit', (e) => this.handleModalSubmit(e));
    }

    // Modal Credit / Debit toggle pills
    const btnTypeCredit = document.getElementById('modalTypeCredit');
    const btnTypeDebit = document.getElementById('modalTypeDebit');
    if (btnTypeCredit && btnTypeDebit) {
      btnTypeCredit.addEventListener('click', () => this.setModalType('credit'));
      btnTypeDebit.addEventListener('click', () => this.setModalType('debit'));
    }

    // Quick Add Credit / Debit toggle
    const quickCredit = document.getElementById('quickTypeCredit');
    const quickDebit = document.getElementById('quickTypeDebit');
    if (quickCredit && quickDebit) {
      quickCredit.addEventListener('click', () => this.setQuickType('credit'));
      quickDebit.addEventListener('click', () => this.setQuickType('debit'));
    }

    // Search bar live filter
    const searchInput = document.getElementById('tableSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        window.store.setFilter({ search: e.target.value });
        this.currentPage = 1;
      });
    }

    // Filter dropdowns
    const filterType = document.getElementById('filterTypeSelect');
    if (filterType) {
      filterType.addEventListener('change', (e) => {
        window.store.setFilter({ type: e.target.value });
        this.currentPage = 1;
      });
    }

    const filterCategory = document.getElementById('filterCategorySelect');
    if (filterCategory) {
      filterCategory.addEventListener('change', (e) => {
        window.store.setFilter({ category: e.target.value });
        this.currentPage = 1;
      });
    }

    const filterSort = document.getElementById('filterSortSelect');
    if (filterSort) {
      filterSort.addEventListener('change', (e) => {
        window.store.setFilter({ sortBy: e.target.value });
      });
    }

    // Select All Checkbox
    const selectAllCheckbox = document.getElementById('selectAllTx');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        const transactions = window.store.getFilteredTransactions();
        if (e.target.checked) {
          transactions.forEach(t => this.selectedIds.add(t.id));
        } else {
          this.selectedIds.clear();
        }
        this.renderTable();
        this.updateBulkActionBar();
      });
    }

    // Bulk Delete button
    const btnBulkDelete = document.getElementById('btnBulkDelete');
    if (btnBulkDelete) {
      btnBulkDelete.addEventListener('click', () => this.handleBulkDelete());
    }
  }

  // Populate Category options based on current type (credit vs debit)
  populateCategorySelect(selectId, type, selectedCategory = '') {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;

    const categories = window.store.state.categories[type] || [];
    selectEl.innerHTML = categories.map(cat => `
      <option value="${cat.name}" ${cat.name === selectedCategory ? 'selected' : ''}>
        ${cat.name}
      </option>
    `).join('');
  }

  // Set modal type and update visual buttons
  setModalType(type) {
    const hiddenType = document.getElementById('modalTxType');
    const btnCredit = document.getElementById('modalTypeCredit');
    const btnDebit = document.getElementById('modalTypeDebit');
    const modalCategory = document.getElementById('modalTxCategory');

    if (hiddenType) hiddenType.value = type;

    if (type === 'credit') {
      btnCredit.className = 'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm bg-emerald-500 text-white shadow-emerald-500/20';
      btnDebit.className = 'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-slate-700/60';
    } else {
      btnDebit.className = 'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all shadow-sm bg-rose-500 text-white shadow-rose-500/20';
      btnCredit.className = 'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition-all text-slate-400 hover:text-slate-200 bg-slate-800/40 border border-slate-700/60';
    }

    this.populateCategorySelect('modalTxCategory', type);
  }

  // Set quick add type on dashboard
  setQuickType(type) {
    const hiddenType = document.getElementById('quickTxType');
    const btnCredit = document.getElementById('quickTypeCredit');
    const btnDebit = document.getElementById('quickTypeDebit');

    if (hiddenType) hiddenType.value = type;

    if (type === 'credit') {
      btnCredit.className = 'py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-emerald-500 text-white shadow-sm';
      btnDebit.className = 'py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700';
    } else {
      btnDebit.className = 'py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-rose-500 text-white shadow-sm';
      btnCredit.className = 'py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700';
    }

    this.populateCategorySelect('quickTxCategory', type);
  }

  // Open Modal for New Transaction
  openAddModal(defaultType = 'debit') {
    this.editingId = null;
    const form = document.getElementById('txModalForm');
    if (form) form.reset();

    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.textContent = 'Add Transaction';

    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Save Transaction';

    const dateInput = document.getElementById('modalTxDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    this.setModalType(defaultType);
    UI.openModal('txModal');

    // Autofocus amount input
    setTimeout(() => {
      const amountInput = document.getElementById('modalTxAmount');
      if (amountInput) amountInput.focus();
    }, 100);
  }

  // Open Modal for Editing Transaction
  openEditModal(id) {
    const tx = window.store.state.transactions.find(t => t.id === id);
    if (!tx) return;

    this.editingId = id;
    const titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.textContent = 'Edit Transaction';

    const submitBtn = document.getElementById('modalSubmitBtn');
    if (submitBtn) submitBtn.textContent = 'Update Transaction';

    document.getElementById('modalTxDetails').value = tx.details;
    document.getElementById('modalTxAmount').value = tx.amount;
    document.getElementById('modalTxDate').value = tx.date;
    document.getElementById('modalTxPaymentMethod').value = tx.paymentMethod || 'Bank Account';
    document.getElementById('modalTxNotes').value = tx.notes || '';

    this.setModalType(tx.type);
    document.getElementById('modalTxCategory').value = tx.category;

    UI.openModal('txModal');
  }

  // Handle Quick Add form submission
  handleQuickAdd(e) {
    e.preventDefault();
    const detailsInput = document.getElementById('quickTxDetails');
    const amountInput = document.getElementById('quickTxAmount');
    const typeInput = document.getElementById('quickTxType');
    const categoryInput = document.getElementById('quickTxCategory');

    const details = detailsInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const type = typeInput.value || 'debit';
    const category = categoryInput.value;

    if (!details) {
      UI.showToast('Please enter details / description', 'warning');
      detailsInput.focus();
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      UI.showToast('Please enter a valid amount greater than 0', 'warning');
      amountInput.focus();
      return;
    }

    const newTx = window.store.addTransaction({
      details,
      amount,
      type,
      category,
      paymentMethod: 'Bank Account',
      date: new Date().toISOString().split('T')[0]
    });

    detailsInput.value = '';
    amountInput.value = '';

    UI.showToast(`Added ${type === 'credit' ? 'Income' : 'Expense'}: ${UI.formatCurrency(amount)}`, 'success');
    if (type === 'credit') UI.triggerCelebration();
  }

  // Handle Modal Form Submit
  handleModalSubmit(e) {
    e.preventDefault();
    const details = document.getElementById('modalTxDetails').value.trim();
    const amount = parseFloat(document.getElementById('modalTxAmount').value);
    const type = document.getElementById('modalTxType').value || 'debit';
    const category = document.getElementById('modalTxCategory').value;
    const date = document.getElementById('modalTxDate').value;
    const paymentMethod = document.getElementById('modalTxPaymentMethod').value;
    const notes = document.getElementById('modalTxNotes').value.trim();

    if (!details) {
      UI.showToast('Please enter details or description', 'warning');
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      UI.showToast('Please enter a valid amount greater than 0', 'warning');
      return;
    }

    if (this.editingId) {
      window.store.updateTransaction(this.editingId, {
        details,
        amount,
        type,
        category,
        date,
        paymentMethod,
        notes
      });
      UI.showToast('Transaction updated successfully', 'success');
    } else {
      window.store.addTransaction({
        details,
        amount,
        type,
        category,
        date,
        paymentMethod,
        notes
      });
      UI.showToast(`Transaction added: ${UI.formatCurrency(amount)}`, 'success');
      if (type === 'credit') UI.triggerCelebration();
    }

    UI.closeModal('txModal');
    this.editingId = null;
  }

  // Duplicate a transaction
  duplicateTransaction(id) {
    const tx = window.store.state.transactions.find(t => t.id === id);
    if (!tx) return;

    window.store.addTransaction({
      details: `${tx.details} (Copy)`,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      date: new Date().toISOString().split('T')[0],
      notes: tx.notes
    });

    UI.showToast('Transaction duplicated', 'info');
  }

  // Delete transaction with confirmation
  confirmDelete(id) {
    const tx = window.store.state.transactions.find(t => t.id === id);
    if (!tx) return;

    if (confirm(`Are you sure you want to delete "${tx.details}" (${UI.formatCurrency(tx.amount)})?`)) {
      window.store.deleteTransaction(id);
      this.selectedIds.delete(id);
      UI.showToast('Transaction deleted', 'info');
    }
  }

  // Bulk Delete
  handleBulkDelete() {
    if (this.selectedIds.size === 0) return;
    const count = this.selectedIds.size;
    if (confirm(`Are you sure you want to delete ${count} selected transactions?`)) {
      window.store.deleteBatchTransactions(Array.from(this.selectedIds));
      this.selectedIds.clear();
      this.updateBulkActionBar();
      UI.showToast(`Deleted ${count} transactions`, 'info');
    }
  }

  // Update Bulk Bar Visibility
  updateBulkActionBar() {
    const bar = document.getElementById('bulkActionBar');
    const countEl = document.getElementById('bulkSelectedCount');
    if (!bar) return;

    if (this.selectedIds.size > 0) {
      bar.classList.remove('hidden');
      if (countEl) countEl.textContent = `${this.selectedIds.size} selected`;
    } else {
      bar.classList.add('hidden');
    }
  }

  // Render Recent Transactions on Dashboard
  renderDashboardRecent() {
    const container = document.getElementById('dashboardRecentTxList');
    if (!container) return;

    const transactions = window.store.getFilteredTransactions().slice(0, 7);

    if (transactions.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-slate-500">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          <p class="font-medium text-slate-400">No transactions yet</p>
          <p class="text-xs text-slate-500 mt-1">Add your first transaction above or click "Load Demo Data" to explore.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = transactions.map(tx => {
      const isCredit = tx.type === 'credit';
      return `
        <div class="group flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 hover:border-slate-600/70 transition-all">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCredit ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }">
              ${isCredit ? `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M7 11l5-5m0 0l5 5m-5-5v12"></path></svg>
              ` : `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17 13l-5 5m0 0l-5-5m5 5V6"></path></svg>
              `}
            </div>
            <div class="min-w-0">
              <p class="font-semibold text-slate-100 text-sm truncate">${tx.details}</p>
              <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span class="inline-block px-2 py-0.5 rounded-md bg-slate-700/50 text-slate-300 font-medium">${tx.category}</span>
                <span>•</span>
                <span>${UI.getRelativeDate(tx.date)}</span>
                <span class="hidden sm:inline">• ${tx.paymentMethod}</span>
              </div>
            </div>
          </div>
          <div class="text-right shrink-0 ml-3">
            <p class="font-bold text-sm lg:text-base font-mono ${isCredit ? 'text-emerald-400' : 'text-rose-400'}">
              ${isCredit ? '+' : '-'}${UI.formatCurrency(tx.amount)}
            </p>
            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
              <button onclick="window.transactions.openEditModal('${tx.id}')" title="Edit" class="p-1 text-slate-400 hover:text-indigo-400 rounded">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </button>
              <button onclick="window.transactions.confirmDelete('${tx.id}')" title="Delete" class="p-1 text-slate-400 hover:text-rose-400 rounded">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Full Transaction Table (Transactions Page)
  renderTable() {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    const filtered = window.store.getFilteredTransactions();
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / this.pageSize) || 1;

    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const startIdx = (this.currentPage - 1) * this.pageSize;
    const paged = filtered.slice(startIdx, startIdx + this.pageSize);

    // Update pagination stats
    const pageStatsEl = document.getElementById('tablePaginationStats');
    if (pageStatsEl) {
      const from = totalItems === 0 ? 0 : startIdx + 1;
      const to = Math.min(startIdx + this.pageSize, totalItems);
      pageStatsEl.textContent = `Showing ${from} - ${to} of ${totalItems} transactions`;
    }

    const prevBtn = document.getElementById('tablePrevBtn');
    const nextBtn = document.getElementById('tableNextBtn');
    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;

    const pageIndicator = document.getElementById('tablePageIndicator');
    if (pageIndicator) pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages}`;

    if (totalItems === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="py-12 text-center text-slate-500">
            <p class="text-base font-medium text-slate-400">No transactions match your current filters</p>
            <p class="text-xs text-slate-500 mt-1">Try clearing search terms or changing your timeframe.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = paged.map(tx => {
      const isCredit = tx.type === 'credit';
      const isSelected = this.selectedIds.has(tx.id);
      return `
        <tr class="border-b border-slate-800/80 hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''}">
          <td class="p-4 w-10">
            <input type="checkbox" class="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer" ${isSelected ? 'checked' : ''} onchange="window.transactions.toggleSelection('${tx.id}', this.checked)">
          </td>
          <td class="p-4">
            <div class="flex items-center gap-3">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isCredit ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              }">
                ${isCredit ? 'Credit (Income)' : 'Debit (Expense)'}
              </span>
              <span class="font-medium text-slate-100 text-sm">${tx.details}</span>
              ${tx.notes ? `<span title="${tx.notes}" class="text-slate-500 cursor-help text-xs">📝</span>` : ''}
            </div>
          </td>
          <td class="p-4">
            <span class="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/60 text-xs font-medium text-slate-300">
              ${tx.category}
            </span>
          </td>
          <td class="p-4 text-xs text-slate-400 font-mono">
            ${UI.formatDate(tx.date)}
            <span class="text-slate-500 ml-1 font-sans">${tx.paymentMethod}</span>
          </td>
          <td class="p-4 text-right font-mono font-bold text-sm ${isCredit ? 'text-emerald-400' : 'text-rose-400'}">
            ${isCredit ? '+' : '-'}${UI.formatCurrency(tx.amount)}
          </td>
          <td class="p-4 text-right">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="window.transactions.openEditModal('${tx.id}')" title="Edit" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              </button>
              <button onclick="window.transactions.duplicateTransaction('${tx.id}')" title="Duplicate" class="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
              </button>
              <button onclick="window.transactions.confirmDelete('${tx.id}')" title="Delete" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  toggleSelection(id, isChecked) {
    if (isChecked) {
      this.selectedIds.add(id);
    } else {
      this.selectedIds.delete(id);
    }
    this.updateBulkActionBar();
  }

  nextPage() {
    this.currentPage++;
    this.renderTable();
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderTable();
    }
  }
}

window.transactions = new TransactionManager();
