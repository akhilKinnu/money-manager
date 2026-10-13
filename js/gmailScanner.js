/**
 * FinTrack Pro - HDFC Bank Gmail Inbox Scanner & Smart Parser
 * Reads through the user's Gmail inbox, filters out HDFC Bank transaction emails
 * (recent and historical/previous), and populates the expense dashboard.
 */

class GmailScanner {
  constructor() {
    this.tokenClient = null;
    this.accessToken = null;
    this.clientId = localStorage.getItem('fintrack_gmail_client_id') || '';
    this.detectedTransactions = [];
    this.isScanning = false;

    this.init();
  }

  init() {
    this.setupEventListeners();

    // Check if redirected from file:// with clientId in URL query params
    try {
      const params = new URLSearchParams(window.location.search);
      const urlClientId = params.get('clientId');
      if (urlClientId) {
        this.saveClientId(urlClientId);
      }
      if (params.get('openGmail') === '1') {
        setTimeout(() => UI.openModal('gmailModal'), 300);
        // Clean URL bar
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {}

    // Pre-fill saved client ID if present
    const input = document.getElementById('gmailClientIdInput');
    if (input && this.clientId) {
      input.value = this.clientId;
    }
  }

  saveClientId(clientId) {
    this.clientId = clientId.trim();
    localStorage.setItem('fintrack_gmail_client_id', this.clientId);
  }

  // Authorize with Google Identity Services (gmail.readonly)
  connectGmail(callback = null) {
    const input = document.getElementById('gmailClientIdInput');
    const clientId = (input && input.value.trim()) || this.clientId;

    if (!clientId) {
      UI.showToast('Please enter your Google OAuth Client ID first', 'warning');
      if (input) input.focus();
      return;
    }

    this.saveClientId(clientId);

    // Google OAuth strictly blocks origin=file:// (Error 400: invalid_request)
    if (window.location.protocol === 'file:') {
      UI.showToast('Redirecting from file:// to http://localhost:8080 for Google OAuth...', 'info');
      window.location.href = `http://localhost:8080/?clientId=${encodeURIComponent(clientId)}&openGmail=1`;
      return;
    }

    if (!window.google || !window.google.accounts) {
      UI.showToast('Google Identity library not loaded. Check your internet connection.', 'error');
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
            UI.showToast('Connected to Gmail! Ready to scan HDFC Bank emails.', 'success');
            if (callback) {
              callback();
            } else {
              const timeframeSelect = document.getElementById('gmailTimeframeSelect');
              const tf = timeframeSelect ? timeframeSelect.value : '30days';
              this.scanEmails(tf);
            }
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
    const headerStatusEl = document.getElementById('headerGmailStatusText');
    const headerDotEl = document.getElementById('headerGmailDot');
    const btnConnect = document.getElementById('btnConnectGmail');

    if (statusEl) {
      statusEl.innerHTML = isConnected
        ? `<span class="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Gmail Connected</span>`
        : `<span class="text-slate-400 text-xs">Not connected</span>`;
    }

    if (headerStatusEl) {
      headerStatusEl.textContent = isConnected ? 'Gmail: Connected (HDFC)' : 'Sync HDFC Gmail';
    }
    if (headerDotEl) {
      headerDotEl.className = isConnected ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-rose-400';
    }

    if (btnConnect) {
      btnConnect.textContent = isConnected ? 'Reconnect Gmail' : 'Authorize Gmail';
    }
  }

  // Build Gmail Search Query specifically targeting HDFC Bank transaction alerts
  buildHDFCSearchQuery(timeframe, customQuery = '', startDate = '', endDate = '') {
    // Target HDFC Bank official domains & subjects
    const hdfcSenderFilter = '(from:hdfcbank.net OR from:hdfcbank.com OR "HDFC Bank")';
    const txKeywords = '(debited OR credited OR spent OR "alert" OR "transaction" OR "UPI" OR "VPA" OR "Acct" OR "A/c" OR "Card ending")';
    const excludePromos = '-"pre-approved" -"personal loan" -"apply now" -"OTP is" -"One Time Password"';

    let queryParts = [hdfcSenderFilter, txKeywords, excludePromos];

    if (customQuery && customQuery.trim()) {
      queryParts.push(`(${customQuery.trim()})`);
    }

    const now = new Date();
    const getAfterDateStr = (daysAgo) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0].replace(/-/g, '/');
    };

    if (timeframe === '7days') {
      queryParts.push(`after:${getAfterDateStr(7)}`);
    } else if (timeframe === '30days') {
      queryParts.push(`after:${getAfterDateStr(30)}`);
    } else if (timeframe === '90days') {
      queryParts.push(`after:${getAfterDateStr(90)}`);
    } else if (timeframe === '180days') {
      queryParts.push(`after:${getAfterDateStr(180)}`);
    } else if (timeframe === '1year') {
      queryParts.push(`after:${getAfterDateStr(365)}`);
    } else if (timeframe === 'custom') {
      if (startDate) queryParts.push(`after:${startDate.replace(/-/g, '/')}`);
      if (endDate) queryParts.push(`before:${endDate.replace(/-/g, '/')}`);
    }
    // If timeframe === 'all-history', no date restriction is added so it reads all previous HDFC emails!

    return queryParts.join(' ');
  }

  // Fetch list of message IDs from Gmail with pagination support
  async fetchMessageList(query, maxTotal = 100) {
    let messages = [];
    let pageToken = null;

    while (messages.length < maxTotal) {
      const batchLimit = Math.min(100, maxTotal - messages.length);
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${batchLimit}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (!res.ok) {
        if (res.status === 401) {
          this.accessToken = null;
          this.updateConnectedUI(false);
          throw new Error('Gmail session expired. Please click Authorize Gmail again.');
        }
        throw new Error(`Gmail API returned status ${res.status}`);
      }

      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        messages = messages.concat(data.messages);
      }

      if (!data.nextPageToken || messages.length >= maxTotal) {
        break;
      }
      pageToken = data.nextPageToken;
    }

    return messages;
  }

  // Scan HDFC emails from Gmail API
  async scanEmails(timeframe = '30days') {
    if (!this.accessToken) {
      this.connectGmail(() => this.scanEmails(timeframe));
      return;
    }

    const maxCountSelect = document.getElementById('gmailMaxLimitSelect');
    const maxResults = maxCountSelect ? parseInt(maxCountSelect.value, 10) || 50 : 50;

    const progressContainer = document.getElementById('gmailScanProgress');
    const progressBar = document.getElementById('gmailProgressBar');
    const progressText = document.getElementById('gmailProgressText');
    const resultsContainer = document.getElementById('gmailResultsContainer');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (progressText) progressText.textContent = 'Searching Gmail inbox for HDFC Bank emails...';
    if (progressBar) progressBar.style.width = '15%';

    const customFilter = document.getElementById('gmailCustomFilter') ? document.getElementById('gmailCustomFilter').value : '';
    const customStart = document.getElementById('gmailCustomStart') ? document.getElementById('gmailCustomStart').value : '';
    const customEnd = document.getElementById('gmailCustomEnd') ? document.getElementById('gmailCustomEnd').value : '';

    const query = this.buildHDFCSearchQuery(timeframe, customFilter, customStart, customEnd);

    try {
      this.isScanning = true;
      const messages = await this.fetchMessageList(query, maxResults);

      if (messages.length === 0) {
        if (progressContainer) progressContainer.classList.add('hidden');
        if (resultsContainer) {
          resultsContainer.innerHTML = `
            <div class="py-12 text-center text-slate-500">
              <svg class="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              <p class="font-medium text-slate-300">No HDFC Bank transaction emails found</p>
              <p class="text-xs text-slate-500 mt-1">Try selecting "All Previous HDFC Emails" or a wider timeframe above.</p>
            </div>
          `;
        }
        UI.showToast('No HDFC transaction emails found in this period', 'info');
        this.isScanning = false;
        return;
      }

      if (progressText) progressText.textContent = `Found ${messages.length} HDFC emails. Parsing transactions...`;
      if (progressBar) progressBar.style.width = '30%';

      this.detectedTransactions = [];
      const existingIds = new Set(window.store.state.transactions.map(t => t.gmailMessageId).filter(Boolean));

      for (let i = 0; i < messages.length; i++) {
        const msgId = messages[i].id;
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        });

        if (msgRes.ok) {
          const msgData = await msgRes.json();
          const parsed = this.parseHDFCMessage(msgData);
          if (parsed) {
            parsed.alreadyImported = existingIds.has(msgId);
            this.detectedTransactions.push(parsed);
          }
        }

        const pct = Math.round(30 + ((i + 1) / messages.length) * 65);
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressText) {
          progressText.textContent = `Reading email ${i + 1} of ${messages.length} (${this.detectedTransactions.length} HDFC transactions extracted)...`;
        }
      }

      if (progressContainer) progressContainer.classList.add('hidden');
      this.renderDetectedTransactions();

      // Check if Auto-Import checkbox is enabled
      const autoImportChk = document.getElementById('gmailAutoImportCheckbox');
      if (autoImportChk && autoImportChk.checked && this.detectedTransactions.length > 0) {
        const newItems = this.detectedTransactions.filter(t => !t.alreadyImported);
        if (newItems.length > 0) {
          const added = window.store.addBatchTransactions(newItems);
          UI.showToast(`Auto-imported ${added} new HDFC transactions into your dashboard!`, 'success');
          // Mark them as imported in the view
          this.detectedTransactions.forEach(t => { t.alreadyImported = true; });
          this.renderDetectedTransactions();
        } else {
          UI.showToast(`All ${this.detectedTransactions.length} HDFC transactions are already in your ledger.`, 'info');
        }
      } else {
        UI.showToast(`Extracted ${this.detectedTransactions.length} HDFC transactions! Review below.`, 'success');
      }

    } catch (err) {
      console.error('Error scanning HDFC Gmail', err);
      if (progressContainer) progressContainer.classList.add('hidden');
      UI.showToast(`Scan error: ${err.message}`, 'error');
    } finally {
      this.isScanning = false;
    }
  }

  // Decode base64url Gmail body parts
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

  // Parse Gmail message object
  parseHDFCMessage(msgData) {
    const headers = (msgData.payload && msgData.payload.headers) || [];
    const getHeader = (name) => {
      const h = headers.find(x => x.name.toLowerCase() === name.toLowerCase());
      return h ? h.value : '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const dateHeader = getHeader('Date');

    let dateStr = new Date().toISOString().split('T')[0];
    let timeStr = '12:00';
    try {
      const dObj = msgData.internalDate ? new Date(parseInt(msgData.internalDate)) : new Date(dateHeader);
      if (!isNaN(dObj.getTime())) {
        dateStr = dObj.toISOString().split('T')[0];
        timeStr = dObj.toTimeString().split(' ')[0].substring(0, 5);
      }
    } catch {}

    const bodyText = (subject + ' ' + this.extractBodyText(msgData.payload)).replace(/\s+/g, ' ');

    return this.parseHDFCText(bodyText, {
      id: msgData.id,
      subject,
      from,
      date: dateStr,
      time: timeStr,
      snippet: msgData.snippet
    });
  }

  // Specialized HDFC Bank Alert Parser
  parseHDFCText(text, meta = {}) {
    // Ignore OTPs, login alerts, or marketing offers without an actual transaction
    if (/one time password|otp is|pre-approved|loan offer|upgrade your credit limit|e-statement/i.test(text) && !/has been debited|has been credited|was spent|thank you for using/i.test(text)) {
      return null;
    }

    // 1. Determine Credit vs Debit
    let type = 'debit';
    const isDebitMatch = /(?:has been debited|debited from|was spent|spent on your|thank you for using your hdfc|withdrawn|paid to|sent to|debited for)/i.test(text);
    const isCreditMatch = /(?:has been credited|is successfully credited|credited to your|credited with|deposited in|refund of|reversal)/i.test(text);

    if (isCreditMatch && !isDebitMatch) {
      type = 'credit';
    } else if (isDebitMatch) {
      type = 'debit';
    } else if (/credited/i.test(text) && !/credit card/i.test(text)) {
      type = 'credit';
    }

    // 2. Extract Transaction Amount (Rs., INR, ₹)
    // HDFC patterns: "Rs.120.00 has been debited", "for Rs 2,340.00 at", "credited with INR 15,000.00"
    const amountPatterns = [
      /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*(?:has been|is successfully|was spent|debited|credited|withdrawn|deducted)/i,
      /(?:for|of|with|by|amount of)\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:debited|credited|spent|paid)\s*(?:by|with|for|of)?\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
      /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i
    ];

    let amount = 0;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const cleaned = match[1].replace(/,/g, '');
        const val = parseFloat(cleaned);
        if (!isNaN(val) && val > 0 && val < 50000000) {
          amount = val;
          break;
        }
      }
    }

    if (!amount || amount <= 0) {
      return null;
    }

    // 3. Extract Merchant / VPA / Counterparty from HDFC Alert
    let details = type === 'credit' ? 'HDFC Account Credit' : 'HDFC Bank Debit';

    const hdfcMerchantPatterns = [
      // HDFC UPI VPA pattern: "to VPA swiggy@axisbank (Name) on" or "to VPA merchant@okaxis on"
      /to VPA\s+([^\s]+(?:\s+\([^)]+\))?)\s+on/i,
      // HDFC Credit/Debit Card pattern: "for Rs 1,200.00 at AMAZON PAY on"
      /(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d{1,2})?\s+at\s+([A-Za-z0-9\s&.,'*-]{2,35}?)\s+on\s+\d/i,
      // HDFC UPI Info pattern: "towards UPI/P2M/12345/SWIGGY"
      /towards\s+([A-Za-z0-9\s/_.-]{3,35}?)(?:\s+on\s+|\s+Ref|\.)/i,
      // HDFC Credit by VPA/Sender: "by VPA sender@okicici" or "by NEFT/IMPS from Name"
      /(?:by VPA|from VPA|credited by)\s+([^\s.]+(?:\s+\([^)]+\))?)/i,
      // General "paid to" / "at"
      /(?:paid to|spent at|at)\s+([A-Za-z0-9\s&'-]{3,28}?)(?:\s+on|\s+ref|\s+using|\.)/i
    ];

    for (const pattern of hdfcMerchantPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        let extracted = match[1].trim();
        // Clean up VPA handle if readable name exists
        if (extracted.includes('@')) {
          const parenMatch = extracted.match(/\(([^)]+)\)/);
          if (parenMatch && parenMatch[1]) {
            extracted = parenMatch[1].trim();
          } else {
            extracted = extracted.split('@')[0].replace(/[._-]/g, ' ').toUpperCase();
          }
        }
        if (extracted.length >= 2) {
          details = extracted;
          break;
        }
      }
    }

    // 4. Detect HDFC Payment Channel
    const lowerText = text.toLowerCase();
    let paymentMethod = 'HDFC Bank Account';

    if (lowerText.includes('upi') || lowerText.includes('vpa')) {
      paymentMethod = 'HDFC UPI';
    } else if (lowerText.includes('credit card')) {
      paymentMethod = 'HDFC Credit Card';
    } else if (lowerText.includes('debit card') || lowerText.includes('atm')) {
      paymentMethod = 'HDFC Debit Card';
    } else if (lowerText.includes('netbanking') || lowerText.includes('neft') || lowerText.includes('imps') || lowerText.includes('rtgs') || lowerText.includes('billpay')) {
      paymentMethod = 'HDFC NetBanking';
    }

    // 5. Auto-Categorize based on merchant/keywords
    const combinedLower = (details + ' ' + lowerText).toLowerCase();
    let category = type === 'credit' ? 'UPI / Account Credit' : 'Miscellaneous';

    if (type === 'debit') {
      if (/swiggy|zomato|restaurant|cafe|food|dining|dominos|pizza|kfc|mcdonald|starbucks|barbeque|eatfit|haldiram|bakery/.test(combinedLower)) {
        category = 'Food & Dining';
      } else if (/blinkit|zepto|instamart|bigbasket|dmart|d-mart|reliance smart|grocery|supermarket|ratnadeep|more retail|milk|vegetables/.test(combinedLower)) {
        category = 'Groceries';
      } else if (/uber|ola|rapido|irctc|metro|petrol|fuel|hpcl|bpcl|indian oil|shell|fastag|parking|redbus/.test(combinedLower)) {
        category = 'Transportation';
      } else if (/amazon|flipkart|myntra|ajio|nykaa|meesho|decathlon|tata cliq|reliance digital|croma|ikea|zara|h&m|shopping|retail/.test(combinedLower)) {
        category = 'Shopping';
      } else if (/airtel|jio|vi |vodafone|bsnl|act fibernet|bescom|electricity|water|gas|indane|bharatgas|hp gas|billpay|recharge|dth|tataplay/.test(combinedLower)) {
        category = 'Utilities & Bills';
      } else if (/rent|landlord|nobroker|society|maintenance/.test(combinedLower)) {
        category = 'Housing & Rent';
      } else if (/netflix|spotify|prime|hotstar|youtube|bookmyshow|pvr|inox|gaming|steam|playstation/.test(combinedLower)) {
        category = 'Entertainment';
      } else if (/apollo|medplus|pharmeasy|1mg|netmeds|hospital|clinic|diagnostic|pharmacy|medical|doctor|health|cultfit|gym/.test(combinedLower)) {
        category = 'Health & Medical';
      } else if (/zerodha|groww|upstox|kuvera|coin|mutual fund|sip|nps|ppf|lic|insurance/.test(combinedLower)) {
        category = 'Investments';
      } else if (/makemytrip|goibibo|cleartrip|indigo|air india|vistara|airbnb|oyo|hotel|flight/.test(combinedLower)) {
        category = 'Travel & Vacations';
      }
    } else {
      if (/salary|payroll|stipend/.test(combinedLower)) {
        category = 'Monthly Salary';
      } else if (/dividend|interest|maturity/.test(combinedLower)) {
        category = 'Investments & Dividends';
      } else if (/refund|reversal|cashback/.test(combinedLower)) {
        category = 'Refunds & Cashback';
      }
    }

    return {
      gmailMessageId: meta.id || ('hdfc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)),
      details: details,
      amount,
      type,
      category,
      paymentMethod,
      date: meta.date || new Date().toISOString().split('T')[0],
      time: meta.time || '12:00',
      notes: `HDFC Email: ${(meta.subject || '').substring(0, 60)}`,
      snippet: meta.snippet || text.substring(0, 120),
      rawSubject: meta.subject || 'HDFC Bank Alert'
    };
  }

  renderDetectedTransactions() {
    const container = document.getElementById('gmailResultsContainer');
    const countBadge = document.getElementById('gmailDetectedCount');
    const actionsBar = document.getElementById('gmailActionsBar');

    if (!container) return;

    if (countBadge) countBadge.textContent = `${this.detectedTransactions.length} HDFC transactions found`;

    if (this.detectedTransactions.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center text-slate-500">
          <p class="font-medium text-slate-400">No HDFC transactions extracted yet</p>
          <p class="text-xs text-slate-500 mt-1">Click "Scan HDFC Emails" above or test with the paste box below.</p>
        </div>
      `;
      if (actionsBar) actionsBar.classList.add('hidden');
      return;
    }

    if (actionsBar) actionsBar.classList.remove('hidden');

    container.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-semibold text-slate-400 px-3 py-1.5 bg-slate-800/60 rounded-lg">
          <div class="flex items-center gap-2">
            <input type="checkbox" id="selectAllGmailTx" checked class="rounded border-slate-700 text-indigo-600 cursor-pointer" onchange="window.gmailScanner.toggleSelectAll(this.checked)">
            <span>Select All New</span>
          </div>
          <span>Detected Amount</span>
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
                      <span class="font-semibold text-slate-200 text-xs truncate max-w-[200px] sm:max-w-xs">${tx.details}</span>
                      ${isDuplicate ? `<span class="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-medium">✓ In Ledger</span>` : ''}
                    </div>

                    <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span class="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-medium">${tx.category}</span>
                      <span>•</span>
                      <span>${tx.date}</span>
                      <span>•</span>
                      <span class="text-indigo-400 font-medium">${tx.paymentMethod}</span>
                    </div>

                    <p class="text-[11px] text-slate-500 italic mt-1 line-clamp-1">${tx.snippet}</p>
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

  importSelectedTransactions() {
    const selected = [];
    this.detectedTransactions.forEach((tx, idx) => {
      const chk = document.getElementById(`gmailTxCheck_${idx}`);
      if (chk && chk.checked) {
        selected.push(tx);
      }
    });

    if (selected.length === 0) {
      UI.showToast('No transactions selected to import', 'warning');
      return;
    }

    const addedCount = window.store.addBatchTransactions(selected);
    UI.showToast(`Imported ${addedCount} HDFC transactions to your dashboard!`, 'success');
    UI.triggerCelebration();
    UI.closeModal('gmailModal');
  }

  parseManualEmailText() {
    const textarea = document.getElementById('manualEmailTextarea');
    if (!textarea || !textarea.value.trim()) {
      UI.showToast('Please paste an HDFC email/alert text first', 'warning');
      return;
    }

    const text = textarea.value.trim();
    const parsed = this.parseHDFCText(text, {
      subject: 'Manual HDFC Alert',
      date: new Date().toISOString().split('T')[0]
    });

    if (!parsed) {
      UI.showToast('Could not detect a valid transaction amount in the text', 'error');
      return;
    }

    this.detectedTransactions = [parsed];
    this.renderDetectedTransactions();
    UI.showToast(`Extracted: ${parsed.type.toUpperCase()} ${UI.formatCurrency(parsed.amount)} (${parsed.details})`, 'success');
  }

  setupEventListeners() {
    const btnOpen = document.getElementById('btnOpenGmailModal');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => UI.openModal('gmailModal'));
    }

    const btnConnect = document.getElementById('btnConnectGmail');
    if (btnConnect) {
      btnConnect.addEventListener('click', () => this.connectGmail());
    }

    const btnScan = document.getElementById('btnStartGmailScan');
    if (btnScan) {
      btnScan.addEventListener('click', () => {
        const timeframeSelect = document.getElementById('gmailTimeframeSelect');
        const timeframe = timeframeSelect ? timeframeSelect.value : '30days';
        this.scanEmails(timeframe);
      });
    }

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

    const btnImport = document.getElementById('btnImportGmailSelected');
    if (btnImport) {
      btnImport.addEventListener('click', () => this.importSelectedTransactions());
    }

    const btnParseManual = document.getElementById('btnParseManualEmail');
    if (btnParseManual) {
      btnParseManual.addEventListener('click', () => this.parseManualEmailText());
    }
  }
}

window.gmailScanner = new GmailScanner();
