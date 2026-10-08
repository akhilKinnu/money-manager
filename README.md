# FinTrack Pro - Modern Expense & Income Manager

A modern, user-friendly, top-notch web application for tracking personal and business finances. Built with a fintech aesthetic, real-time analytics, local persistence, and zero setup required.

---

## 🚀 Quick Start

### Option 1: Double Click
Simply double-click **`start.bat`** (or open **`index.html`** in any web browser such as Edge, Chrome, Firefox, or Brave).

### Option 2: PowerShell
Run:
```powershell
.\start.ps1
```

---

## ✨ Key Features

### 1. Intuitive Transaction Entry
- **Details & Amount**: Record any financial transaction in seconds.
- **Credit (Income) or Debit (Expense)**: Quick one-click toggle with distinct emerald and rose visual cues.
- **Smart Categories**: Context-aware category selectors for both Income (*Salary, Freelance, Dividends, Business, etc.*) and Expenses (*Food, Groceries, Rent, Utilities, Transport, Shopping, Healthcare, etc.*).
- **Payment Accounts**: Track payments across Bank Account, Credit Card, Debit Card, Cash, UPI / Digital Wallet, and PayPal.
- **Quick-Add Bar**: Inline fast-entry bar on the dashboard for instant recording without opening a modal.
- **Celebration Effects**: Confetti bursts when recording income or hitting savings milestones.

### 2. Dashboard & Varieties of Analytics
- **Executive KPI Cards**:
  - **Net Balance**: Instant surplus or deficit calculation.
  - **Total Income (Credit)**: Total earned with transaction counts.
  - **Total Expenses (Debit)**: Total spent with transaction counts.
  - **Savings Rate %**: Health rating (*Excellent, Moderate, Deficit*) based on earnings retained.
- **7 Dedicated Analytical Visualizations**:
  1. **Cash Flow Evolution (Timeline)**: Dual gradient area chart showing incoming vs outgoing trajectory.
  2. **Category Expense Allocation**: Interactive doughnut chart with center total and detailed percentage breakdown.
  3. **Income Streams Distribution**: Polar area chart showcasing where revenues originate.
  4. **Monthly Burn Rate & Comparison**: Grouped side-by-side bar chart evaluating 6 months of historical data.
  5. **Day-of-Week Spending Heatmap**: Bar chart highlighting weekend vs weekday expenditure patterns.
  6. **Payment Channel Breakdown**: Distribution across cards, bank transfers, cash, and digital wallets.
  7. **Top 5 Largest Spends Ranking**: Identifies the single highest-impact transactions.

### 3. Dynamic Filtering & Timeframes
- **Presets**: *Today*, *This Month*, *Last Month*, *Last 30 Days*, *This Year*, *All Time*.
- **Custom Date Range**: Pick exact start and end dates.
- **Multi-criteria Table Search**: Live search matching description, category, amount, payment method, and notes.

### 4. Budgets & Savings Targets
- Set monthly spending caps per category.
- Visual progress bars with color-coded warning thresholds:
  - 🟢 **Under 75%**: On track
  - 🟡 **75% - 95%**: Caution
  - 🔴 **100%+**: Over-budget alert with exact excess amount.
- **Savings Target Tracker**: Set customizable goal amount and monitor real-time completion.

### 5. Data Privacy & Portability
- **100% Client-Side**: All data stays private in your browser's `localStorage`. No external servers or telemetry.
- **Export CSV**: Spreadsheet ready for Microsoft Excel, Google Sheets, or Apple Numbers.
- **Full JSON Backup & Restore**: Download complete backups and restore anytime.
- **Printable Statements**: Clean, professional print view for physical filing or PDF exports.
- **Demo Data Generator**: Includes 30+ pre-filled realistic transactions to test all charts instantly.

### 6. Currency & Themes
- **Multi-Currency Support**: Switch on-the-fly between **USD ($)**, **EUR (€)**, **GBP (£)**, **INR (₹)**, **JPY (¥)**, **CAD (CA$)**, **AUD (AU$)**, **SGD (SG$)**, and **AED**.
- **Dark & Light Mode**: Premium Obsidian Dark theme with subtle glassmorphism and crisp Light theme.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>N</kbd> | Open New Transaction modal |
| <kbd>D</kbd> | Navigate to **Dashboard** |
| <kbd>T</kbd> | Navigate to **Transactions** ledger |
| <kbd>A</kbd> | Navigate to **Analytics Hub** |
| <kbd>B</kbd> | Navigate to **Budgets** |
| <kbd>Esc</kbd> | Close any open modal |

---

## 📁 Project Architecture

```
d:\Myself\Money Manager/
├── index.html              # Main application UI and views
├── css/
│   └── styles.css          # Glassmorphism, fintech design system, print styles
├── js/
│   ├── store.js            # State management, LocalStorage, demo data
│   ├── ui.js               # Toast system, modals, currency & date formatting
│   ├── analytics.js        # Chart.js engine with 7 analytics visualizations
│   ├── transactions.js     # CRUD operations, sorting, filters, pagination
│   ├── budgets.js          # Monthly spending caps & savings goal progress
│   ├── exportImport.js     # CSV/JSON export/import & report generation
│   └── app.js              # View router, shortcuts, and lifecycle
├── start.bat               # Windows one-click launcher
├── start.ps1               # PowerShell launcher
└── README.md               # Documentation
```
