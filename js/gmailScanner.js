/**
 * FinTrack Pro - Gmail Expense Scanner & Smart Parser
 * Connects to Gmail API (via Google Identity Services), reads financial transaction emails
 * (recent or historical/previous), parses Amount, Type (Credit/Debit), Merchant, Date,
 * and seamlessly adds them to FinTrack Pro with duplicate prevention.
 */

class GmailScanner {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.clientId = localStorage.getItem('fintrack_gdrive_config') 
      ? JSON.parse(localStorage.getItem('fintrack_gdrive_config')).clientId 
      : (localStorage.getItem('fintrack_gmail_client_id') || '');
    this.detectedTransactions = [];
    this.isScanning = false;

    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  // Load or Save Client ID
  saveClientId(clientId) {
    this.clientId = clientId.trim();
    localStorage.setItem('fintrack_gmail_client_id', this.clientId);
  }

  // Authorize with Google Identity Services for Gmail Readonly scope
  connectGmail(callback = null) {
    const input = document.getElementById('gmailClientIdInput');
    const clientId = (input && input.value.trim()) || this.clientId;

    if (!clientId) {
      UI.showToast('Please enter your Google OAuth Client ID to connect Gmail', 'warning');
      return;
    }

    this.saveClientId(clientId);

    if (!window.google || !window.google.accounts) {
      UI.showToast('Google Identity library not loaded. Check internet.', 'error');
      return;
    }

    try {
      this.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            this.accessToken = tokenResponse.access_token;
            this.updateConnectedUI(true);
            UI.showToast('Gmail connected successfully!', 'success');
            if (callback) callback();
            else this.scanEmails('recent');
          } else if (tokenResponse && tokenResponse.error) {
            UI.showToast(`Gmail Auth Error: ${tokenResponse.error}`, 'error');
          }
        }
      });

      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      console.error('Failed to initialize Google Token Client', err);
      UI.showToast(`Auth error: ${err.message}`, 'error');
    }
  }

  updateConnectedUI(isConnected) {
    const statusEl = document.getElementById('gmailConnectionStatus');
    const btnConnect = document.getElementById('btnConnectGmail');
    const btnScan = document.getElementById('btnStartGmailScan');

    if (statusEl) {
      if (isConnected) {
        statusEl.innerHTML = `
          <div class="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Connected to Gmail
          </div>
        `;
      } else {
        statusEl.innerHTML = `<span class="text-slate-400 text-xs">Not connected</span>`;
      }
    }

    if (btnConnect) {
      btnConnect.textContent = isConnected ? 'Reconnect Gmail' : 'Authorize & Connect Gmail';
    }
    if (btnScan) {
      btnScan.disabled = !isConnected;
    }
  }

  // Build Gmail Search Query for Bank/Financial alerts
  buildSearchQuery(timeframe, customQuery = '', startDate = '', endDate = '') {
    // Keywords for Indian and international banks, UPI, cards, and payment alerts
    const financialKeywords = '(debited OR credited OR "spent" OR "transaction alert" OR "paid to" OR "received from" OR "UPI" OR "payment to" OR "order confirmed" OR "refund" OR "statement" OR "salary credited")';
    
    let queryParts = [financialKeywords];

    if (customQuery && customQuery.trim()) {
      queryParts.push(`(${customQuery.trim()})`);
    }

    const now = new Date();

    if (timeframe === 'recent' || timeframe === '7days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      const afterStr = d.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${afterStr}`);
    } else if (timeframe === '30days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      const afterStr = d.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${afterStr}`);
    } else if (timeframe === '90days') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      const afterStr = d.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${afterStr}`);
    } else if (timeframe === 'custom') {
      if (startDate) queryParts.push(`after:${startDate.replace(/-/g, '/')}`);
      if (endDate) queryParts.push(`before:${endDate.replace(/-/g, '/')}`);
    } else if (timeframe === 'all-previous') {
      // Look back up to 1 year
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      const afterStr = d.toISOString().split('T')[0].replace(/-/g, '/');
      queryParts.push(`after:${afterStr}`);
    }

    return queryParts.join(' ');
  }

  // Scan emails from Gmail API
  async scanEmails(timeframe = '30days', maxResults = 25) {
    if (!this.accessToken) {
      this.connectGmail(() => this.scanEmails(timeframe, maxResults));
      return;
    }

    const progressContainer = document.getElementById('gmailScanProgress');
    const progressBar = document.getElementById('gmailProgressBar');
    const progressText = document.getElementById('gmailProgressText');
    const resultsContainer = document.getElementById('gmailResultsContainer');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (progressText) progressText.textContent = 'Searching your Gmail messages...';
    if (progressBar) progressBar.style.width = '15%';

    const customFilter = document.getElementById('gmailCustomFilter') ? document.getElementById('gmailCustomFilter').value : '';
    const customStart = document.getElementById('gmailCustomStart') ? document.getElementById('gmailCustomStart').value : '';
    const customEnd = document.getElementById('gmailCustomEnd') ? document.getElementById('gmailCustomEnd').value : '';

    const query = this.buildSearchQuery(timeframe, customFilter, customStart, customEnd);

    try {
      this.isScanning = true;
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
      
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (!searchRes.ok) {
        if (searchRes.status === 401) {
          this.accessToken = null;
          throw new Error('Session expired. Please reconnect Gmail.');
        }
        throw new Error(`Gmail API error (${searchRes.status})`);
      }

      const searchData = await searchRes.json();
      const messages = searchData.messages || [];

      if (messages.length === 0) {
        if (progressContainer) progressContainer.classList.add('hidden');
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="py-12 text-center text-slate-500">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              <p class="font-medium text-slate-300">No transaction emails found</p>
              <p class="text-xs text-slate-500 mt-1">Try expanding the date range (e.g. Previous Emails / 90 Days) or clearing custom search terms.</p>
            </div>
          `;
        }
        UI.showToast('No transaction emails matched the search', 'info');
        this.isScanning = false;
        return;
      }

      if (progressText) progressText.textContent = `Found ${messages.length} potential emails. Reading details...`;
      if (progressBar) progressBar.style.width = '35%';

      // Fetch each message and parse
      this.detectedTransactions = [];
      const existingIds = new Set(window.store.state.transactions.map(t => t.gmailMessageId).filter(Boolean));

      for (let i = 0; i < messages.length; i++) {
        const msgId = messages[i].id;
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });

        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const parsed = this.parseGmailMessage(msgData);
          if (parsed) {
            parsed.alreadyImported = existingIds.has(msgId);
            this.detectedTransactions.push(parsed);
          }
        }

        const pct = Math.round(35 + ((i + 1) / messages.length) * 60);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Analyzed ${i + 1} of ${messages.length} emails (${this.detectedTransactions.length} transactions detected)...`;
      }

      if (progressContainer) progressContainer.classList.add('hidden');
      this.renderDetectedTransactions();
      UI.showToast(`Found ${this.detectedTransactions.length} transaction entries from Gmail!`, 'success');

    } catch (err) {
      console.error('Error scanning Gmail', err);
      if (progressContainer) progressContainer.classList.add('hidden');
      UI.showToast(`Scan error: ${err.message}`, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  // Helper to extract body text from Gmail payload
  extractBodyText(payload) {
    let text = '';

    const decodeBase64 = (b64) => {
      try {
        const clean = b64.replace(/-/g, '+').replace(/_/g, '/');
        return decodeURIComponent(escape(window.atob(clean)));
      } catch {
        return '';
      }
    };

    if (payload.body && payload.body.data) {
      text += decodeBase64(payload.body.data);
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      payload.parts.forEach(part => {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          text += ' ' + decodeBase64(part.body.data);
        } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
          // Strip basic HTML tags
          const html = decodeBase64(part.body.data);
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          text += ' ' + (tmp.textContent || tmp.innerText || '');
        } else if (part.parts) {
          text += ' ' + this.extractBodyText(part);
        }
      });
    }

    return text;
  }

  // Smart Parser for Indian & International Bank/UPI Alerts
  parseGmailMessage(msgData) {
    const headers = msgData.payload.headers || [];
    const getHeader = (name) => {
      const h = headers.find(x => x.name.toLowerCase() === name.toLowerCase());
      return h ? h.value : '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const dateHeader = getHeader('Date');

    // Parse date
    let dateStr = new Date().toISOString().split('T')[0];
    try {
      if (msgData.internalDate) {
        dateStr = new Date(parseInt(msgData.internalDate)).toISOString().split('T')[0];
      } else if (dateHeader) {
        dateStr = new Date(dateHeader).toISOString().split('T')[0];
      }
    } catch {}

    const bodyText = (subject + ' ' + this.extractBodyText(msgData.payload)).replace(/\s+/g, ' ');

    return this.parseFinancialText(bodyText, {
      id: msgData.id,
      subject,
      from,
      date: dateStr,
      snippet: msgData.snippet
    });
  }

  // Parse raw text for amount, type (credit/debit), merchant, and category
  parseFinancialText(text, meta = {}) {
    // 1. Detect Type (Credit vs Debit)
    let type = 'debit'; // default to expense
    const creditKeywords = [
      /credited/i, /received\s+(?:rs|inr|₹|\$)/i, /refund/i, /salary/i,
      /deposited/i, /cashback/i, /credited\s+with/i, /credited\s+by/i
    ];

    const debitKeywords = [
      /debited/i, /spent/i, /paid\s+to/i, /purchase\s+of/i, /withdrawn/i,
      /sent\s+(?:rs|inr|₹|\$)/i, /txn\s+of/i, /charged/i, /order\s+confirmed/i
    ];

    let isCredit = creditKeywords.some(regex => regex.test(text));
    let isDebit = debitKeywords.some(regex => regex.test(text));

    if (isCredit && !isDebit) {
      type = 'credit';
    } else if (isDebit) {
      type = 'debit';
    } else if (/credit/i.test(text) && !/credit\s+card/i.test(text)) {
      type = 'credit';
    }

    // 2. Detect Amount (₹, INR, Rs., USD $, etc.)
    // Matches formats: Rs. 1,250.00, INR 500, ₹499.50, $45.00
    const amountPatterns = [
      /(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:debited|credited|spent|paid|withdrawn|charged|txn of)\s*(?:by|for|with)?\s*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /\$\s*([\d,]+(?:\.\d{1,2})?)/,
      /(?:amount|amt)[\s:]*(?:INR|Rs\.?|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i
    ];

    let amount = 0;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && val < 50000000) { // filter out phone numbers/account numbers
          amount = val;
          break;
        }
      }
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return null; // Not a valid financial alert
    }

    // 3. Extract Merchant / Details / Beneficiary
    let details = 'Bank Transaction';
    const merchantPatterns = [
      /(?:paid to|transferred to|vpa|to VPA|info|at|spent at)\s+([A-Za-z0-9\s&'-]{3,25})(?:\s+on|\s+ref|\s+upi|\s+for|\.|\n)/i,
      /(?:order with|purchase at|merchant)\s+([A-Za-z0-9\s&'-]{3,25})/i,
      /(?:from VPA|received from|credited by)\s+([A-Za-z0-9\s&'-]{3,25})/i
    ];

    for (const p of merchantPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const cleanM = m[1].trim();
        if (cleanM && !cleanM.toLowerCase().includes('bank') && cleanM.length > 2) {
          details = cleanM;
          break;
        }
      }
    }

    // If details is still default, try subject or bank name
    if (details === 'Bank Transaction' && meta.subject) {
      const cleanSubject = meta.subject
        .replace(/(?:Fwd:|Re:|Notification:|Alert:)/gi, '')
        .replace(/(?:debited|credited|transaction|update)/gi, '')
        .trim();
      if (cleanSubject.length > 3) details = cleanSubject.substring(0, 32);
    }

    // 4. Smart Category & Payment Method Detection
    const lowerText = text.toLowerCase();
    let category = type === 'credit' ? 'Other Income' : 'Miscellaneous';
    let paymentMethod = 'Bank Account';

    if (lowerText.includes('upi') || lowerText.includes('vpa') || lowerText.includes('gpay') || lowerText.includes('phonepe') || lowerText.includes('paytm')) {
      paymentMethod = 'UPI / Digital Wallet';
    } else if (lowerText.includes('credit card')) {
      paymentMethod = 'Credit Card';
    } else if (lowerText.includes('debit card')) {
      paymentMethod = 'Debit Card';
    } else if (lowerText.includes('net banking') || lowerText.includes('neft') || lowerText.includes('rtgs') || lowerText.includes('imps')) {
      paymentMethod = 'Net Banking';
    }

    // Category mapping
    if (type === 'debit') {
      if (lowerText.includes('swiggy') || lowerText.includes('zomato') || lowerText.includes('restaurant') || lowerText.includes('cafe') || lowerText.includes('dining') || lowerText.includes('mcdonald') || lowerText.includes('starbucks') || lowerText.includes('burger')) {
        category = 'Food & Dining';
      } else if (lowerText.includes('blinkit') || lowerText.includes('zepto') || lowerText.includes('instamart') || lowerText.includes('grocery') || lowerText.includes('bigbasket') || lowerText.includes('supermarket') || lowerText.includes('milk')) {
        category = 'Groceries';
      } else if (lowerText.includes('uber') || lowerText.includes('ola') || lowerText.includes('rapido') || lowerText.includes('metro') || lowerText.includes('petrol') || lowerText.includes('fuel') || lowerText.includes('fuel station')) {
        category = 'Transportation';
      } else if (lowerText.includes('amazon') || lowerText.includes('flipkart') || lowerText.includes('myntra') || lowerText.includes('shopping') || lowerText.includes('retail') || lowerText.includes('store') || lowerText.includes('zara')) {
        category = 'Shopping';
      } else if (lowerText.includes('electricity') || lowerText.includes('bescom') || lowerText.includes('tneb') || lowerText.includes('airtel') || lowerText.includes('jio') || lowerText.includes('broadband') || lowerText.includes('water bill') || lowerText.includes('gas bill')) {
        category = 'Utilities & Bills';
      } else if (lowerText.includes('rent') || lowerText.includes('housing') || lowerText.includes('maintenance')) {
        category = 'Housing & Rent';
      } else if (lowerText.includes('netflix') || lowerText.includes('spotify') || lowerText.includes('prime video') || lowerText.includes('hotstar') || lowerText.includes('cinema') || lowerText.includes('pvr') || lowerText.includes('bookmyshow')) {
        category = 'Entertainment';
      } else if (lowerText.includes('hospital') || lowerText.includes('pharmacy') || lowerText.includes('apollo') || lowerText.includes('medplus') || lowerText.includes('clinic') || lowerText.includes('doctor')) {
        category = 'Health & Medical';
      } else if (lowerText.includes('zerodha') || lowerText.includes('groww') || lowerText.includes('mutual fund') || lowerText.includes('sip') || lowerText.includes('stocks') || lowerText.includes('investment')) {
        category = 'Investments';
      } else if (lowerText.includes('flight') || lowerText.includes('makemytrip') || lowerText.includes('irctc') || lowerText.includes('hotel') || lowerText.includes('airbnb') || lowerText.includes('travel')) {
        category = 'Travel & Vacations';
      }
    } else {
      if (lowerText.includes('salary') || lowerText.includes('payroll')) {
        category = 'Monthly Salary';
      } else if (lowerText.includes('dividend') || lowerText.includes('interest')) {
        category = 'Investments & Dividends';
      } else if (lowerText.includes('refund') || lowerText.includes('cashback')) {
        category = 'Cashback & Refunds';
      } else if (lowerText.includes('client') || lowerText.includes('freelance') || lowerText.includes('consulting')) {
        category = 'Freelance & Projects';
      }
    }

    return {
      gmailMessageId: meta.id || ('manual_' + Date.now()),
      details: details.trim(),
      amount,
      type,
      category,
      paymentMethod,
      date: meta.date || dateStr,
      notes: `Imported from email: "${(meta.subject || details).substring(0, 50)}"`,
      snippet: meta.snippet || text.substring(0, 100),
      rawSubject: meta.subject || ''
    };
  }

  // Render Detected Transactions in UI Modal
  renderDetectedTransactions() {
    const container = document.getElementById('gmailResultsContainer');
    const countBadge = document.getElementById('gmailDetectedCount');
    const actionsBar = document.getElementById('gmailActionsBar');

    if (!container) return;

    if (countBadge) countBadge.textContent = `${this.detectedTransactions.length} detected`;

    if (this.detectedTransactions.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center text-slate-500">
          <p class="font-medium text-slate-400">No transactions detected</p>
          <p class="text-xs text-slate-500 mt-1">Try scanning again or using the Manual Paste box below.</p>
        </div>
      `;
      if (actionsBar) actionsBar.classList.add('hidden');
      return;
    }

    if (actionsBar) actionsBar.classList.remove('hidden');

    container.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-400 px-3 py-1 bg-slate-800/60 rounded-lg">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="selectAllGmailTx" checked class="rounded border-slate-700 text-indigo-600 cursor-pointer" onchange="window.gmailScanner.toggleSelectAll(this.checked)">
            <span>Select All (${this.detectedTransactions.length})</span>
          </div>
          <span>Amount</span>
        </div>

        ${this.detectedTransactions.map((tx, idx) => {
          const isCredit = tx.type === 'credit';
          const isDuplicate = tx.alreadyImported;

          return `
            <div class="p-3 rounded-xl border transition-all ${
              isDuplicate 
                ? 'bg-slate-900/40 border-slate-800 opacity-60' 
                : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60'
            }">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-2.5 min-w-0">
                  <input type="checkbox" id="gmailTxCheck_${idx}" data-idx="${idx}" ${isDuplicate ? '' : 'checked'} class="mt-1 rounded border-slate-700 text-indigo-600 cursor-pointer">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCredit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }">
                        ${isCredit ? 'Credit (+)' : 'Debit (-)'}
                      </span>
                      <span class="font-semibold text-slate-200 text-xs truncate max-w-[180px] sm:max-w-xs">${tx.details}</span>
                      ${isDuplicate ? `<span class="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.2 rounded font-medium">Already Added</span>` : ''}
                    </div>

                    <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span class="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-medium">${tx.category}</span>
                      <span>•</span>
                      <span>${tx.date}</span>
                      <span>•</span>
                      <span>${tx.paymentMethod}</span>
                    </div>

                    <p class="text-[11px] text-slate-500 italic mt-1 line-clamp-1">${tx.rawSubject || tx.snippet}</p>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <span class="font-mono font-bold text-sm ${isCredit ? 'text-emerald-400' : 'text-rose-400'}">
                    ${isCredit ? '+' : '-'}${UI.formatCurrency(tx.amount)}
                  </span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  toggleSelectAll(isChecked) {
    this.detectedTransactions.forEach((tx, idx) => {
      const chk = document.getElementById(`gmailTxCheck_${idx}`);
      if (chk) chk.checked = isChecked && !tx.alreadyImported;
    });
  }

  // Import Selected Transactions into FinTrack Pro Ledger
  importSelectedTransactions() {
    const selected = [];
    this.detectedTransactions.forEach((tx, idx) => {
      const chk = document.getElementById(`gmailTxCheck_${idx}`);
      if (chk && chk.checked) {
        selected.push(tx);
      }
    });

    if (selected.length === 0) {
      UI.showToast('No transactions selected for import', 'warning');
      return;
    }

    let addedCount = 0;
    selected.forEach(tx => {
      window.store.addTransaction({
        details: tx.details,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        paymentMethod: tx.paymentMethod,
        date: tx.date,
        notes: tx.notes,
        gmailMessageId: tx.gmailMessageId
      });
      addedCount++;
    });

    UI.showToast(`Successfully imported ${addedCount} transactions from Gmail!`, 'success');
    UI.triggerCelebration();
    UI.closeModal('gmailModal');
  }

  // Manual Paste Email Parser (Zero-OAuth Quick Mode)
  parseManualEmailText() {
    const textarea = document.getElementById('manualEmailTextarea');
    if (!textarea || !textarea.value.trim()) {
      UI.showToast('Please paste email text first', 'warning');
      return;
    }

    const text = textarea.value.trim();
    const parsed = this.parseFinancialText(text, {
      subject: 'Pasted Email Alert',
      date: new Date().toISOString().split('T')[0]
    });

    if (!parsed) {
      UI.showToast('Could not detect financial amount or transaction details in this text', 'error');
      return;
    }

    // Add to detected list and show
    this.detectedTransactions = [parsed];
    this.renderDetectedTransactions();
    UI.showToast(`Detected: ${parsed.type.toUpperCase()} ${UI.formatCurrency(parsed.amount)} for ${parsed.details}!`, 'success');
  }

  setupEventListeners() {
    // Open Gmail Modal button
    const btnOpen = document.getElementById('btnOpenGmailModal');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => UI.openModal('gmailModal'));
    }

    // Connect Gmail button
    const btnConnect = document.getElementById('btnConnectGmail');
    if (btnConnect) {
      btnConnect.addEventListener('click', () => this.connectGmail());
    }

    // Start Scan button
    const btnScan = document.getElementById('btnStartGmailScan');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        const timeframeSelect = document.getElementById('gmailTimeframeSelect');
        const timeframe = timeframeSelect ? timeframeSelect.value : '30days';
        this.scanEmails(timeframe);
      });
    }

    // Timeframe selector change (toggle custom date range)
    const timeframeSelect = document.getElementById('gmailTimeframeSelect');
    if (timeframeSelect) {
      timeframeSelect.addEventListener('change', (e) => {
        const customDiv = document.getElementById('gmailCustomRangeGroup');
        if (customDiv) {
          if (e.target.value === 'custom') {
            customDiv.classList.remove('hidden');
          } else {
            customDiv.classList.add('hidden');
          }
        }
      });
    }

    // Import selected button
    const btnImport = document.getElementById('btnImportGmailSelected');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.importSelectedTransactions());
    }

    // Manual email paste parse button
    const btnParseManual = document.getElementById('btnParseManualEmail');
    if (btnParseManual) {
      btnParseManual.addEventListener('click', () => this.parseManualEmailText());
    }
  }
}

window.gmailScanner = new GmailScanner();
