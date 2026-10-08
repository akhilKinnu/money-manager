/**
 * FinTrack Pro - UI Utilities, Toast Notification System & Modals
 */

const UI = {
  // Format currency with proper symbols and commas
  formatCurrency(amount, withSign = false) {
    const currency = window.store ? window.store.getCurrencyInfo() : { symbol: '₹', code: 'INR' };
    const num = Math.abs(parseFloat(amount) || 0);
    const locale = currency.code === 'INR' ? 'en-IN' : undefined;
    const formattedNum = num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    let prefix = currency.symbol;
    if (currency.code === 'AED') {
      prefix = 'AED ';
    }

    if (withSign) {
      const sign = (parseFloat(amount) || 0) < 0 ? '-' : '+';
      return `${sign}${prefix}${formattedNum}`;
    }

    return `${prefix}${formattedNum}`;
  },

  // Format short currency for chart tooltips or small KPI chips (e.g. ₹5.2k, ₹1.5L, $5.2k)
  formatCompactCurrency(amount) {
    const currency = window.store ? window.store.getCurrencyInfo() : { symbol: '₹', code: 'INR' };
    const num = parseFloat(amount) || 0;
    if (currency.code === 'INR') {
      if (Math.abs(num) >= 10000000) {
        return `${currency.symbol}${(num / 10000000).toFixed(1)} Cr`;
      }
      if (Math.abs(num) >= 100000) {
        return `${currency.symbol}${(num / 100000).toFixed(1)}L`;
      }
      if (Math.abs(num) >= 1000) {
        return `${currency.symbol}${(num / 1000).toFixed(1)}k`;
      }
      return `${currency.symbol}${num.toFixed(0)}`;
    }

    if (Math.abs(num) >= 1000000) {
      return `${currency.symbol}${(num / 1000000).toFixed(1)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${currency.symbol}${(num / 1000).toFixed(1)}k`;
    }
    return `${currency.symbol}${num.toFixed(0)}`;
  },

  // Format Date for UI (e.g. "Oct 08, 2026")
  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateString;
    } catch {
      return dateString;
    }
  },

  // Get Relative date (e.g., "Today", "Yesterday", "3 days ago")
  getRelativeDate(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (dateString === todayStr) return 'Today';

    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    if (dateString === yest.toISOString().split('T')[0]) return 'Yesterday';

    return this.formatDate(dateString);
  },

  // Toast Notification System
  showToast(message, type = 'info', duration = 3800) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-3 opacity-0 z-50 ${
      type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
        : type === 'error'
        ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
        : type === 'warning'
        ? 'bg-amber-950/90 border-amber-500/40 text-amber-100'
        : 'bg-slate-900/90 border-indigo-500/40 text-slate-100'
    }`;

    const iconSvg = {
      success: `<svg class="w-5 h-5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`,
      error: `<svg class="w-5 h-5 text-rose-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`,
      warning: `<svg class="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
      info: `<svg class="w-5 h-5 text-indigo-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    }[type] || '';

    toast.innerHTML = `
      ${iconSvg}
      <span class="text-sm font-medium tracking-wide flex-1">${message}</span>
      <button class="text-slate-400 hover:text-white text-xs ml-2 opacity-70 hover:opacity-100 transition-opacity" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto dismiss
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-x-4');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Modal helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');

    // Trigger animation
    const content = modal.querySelector('.modal-box');
    if (content) {
      content.classList.remove('scale-95', 'opacity-0');
      content.classList.add('scale-100', 'opacity-100');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    const content = modal.querySelector('.modal-box');
    if (content) {
      content.classList.add('scale-95', 'opacity-0');
      content.classList.remove('scale-100', 'opacity-100');
    }
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.classList.remove('overflow-hidden');
    }, 150);
  },

  // Confetti trigger
  triggerCelebration() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 65,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#10B981', '#6366F1', '#3B82F6', '#F59E0B']
      });
    }
  },

  // Initialize theme
  applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    } else {
      html.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    }
    const themeIcon = document.getElementById('themeToggleIcon');
    if (themeIcon) {
      if (theme === 'dark') {
        themeIcon.innerHTML = `<svg class="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`;
      } else {
        themeIcon.innerHTML = `<svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
      }
    }
  }
};

window.UI = UI;
