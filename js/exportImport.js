/**
 * FinTrack Pro - Data Export, Import & Reporting Engine
 * Supports CSV export, full JSON backup/restore, and Print preview.
 */

const ExportImport = {
  // Export active transactions to CSV
  exportToCSV() {
    const transactions = window.store.getFilteredTransactions();
    if (transactions.length === 0) {
      UI.showToast('No transactions to export', 'warning');
      return;
    }

    const headers = ['ID', 'Date', 'Time', 'Type', 'Details', 'Category', 'Payment Method', 'Amount', 'Notes'];
    const rows = transactions.map(t => [
      `"${t.id}"`,
      `"${t.date}"`,
      `"${t.time || ''}"`,
      `"${t.type}"`,
      `"${(t.details || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.paymentMethod || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `FinTrack_Transactions_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    UI.showToast(`Exported ${transactions.length} transactions to CSV`, 'success');
  },

  // Export full application state as JSON
  exportBackupJSON() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      currency: window.store.state.currency,
      budgets: window.store.state.budgets,
      savingsGoal: window.store.state.savingsGoal,
      categories: window.store.state.categories,
      paymentMethods: window.store.state.paymentMethods,
      transactions: window.store.state.transactions
    };

    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `FinTrack_Full_Backup_${dateStr}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    UI.showToast('Full JSON backup downloaded', 'success');
  },

  // Trigger file dialog to import JSON
  triggerImportJSON() {
    const input = document.getElementById('jsonFileInput');
    if (input) input.click();
  },

  // Handle selected JSON file
  handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || !Array.isArray(parsed.transactions)) {
          throw new Error('File does not contain valid FinTrack transactions.');
        }

        if (confirm(`Import ${parsed.transactions.length} transactions? This will update your current data.`)) {
          window.store.importJSON(parsed);
          UI.showToast(`Successfully imported ${parsed.transactions.length} transactions!`, 'success');
        }
      } catch (err) {
        UI.showToast(`Failed to parse file: ${err.message}`, 'error');
      }
      // Reset input so same file can be chosen again
      event.target.value = '';
    };

    reader.readAsText(file);
  },

  // Trigger browser print for financial statement
  printReport() {
    window.print();
  }
};

window.exportImport = ExportImport;
