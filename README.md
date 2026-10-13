# FinTrack Pro - HDFC Bank Gmail Expense & Income Manager

A modern, zero-database web application that reads your **Gmail inbox**, filters out transaction emails from **HDFC Bank** (both recent and historical/previous emails), and populates a real-time financial dashboard and analytics suite in **INR (₹)**.

---

## 🚀 Quick Start

### Option 1: Start Local Web Server (Required for Google OAuth)
Double-click **`start-server.bat`** (or run `.\server.ps1` in PowerShell).  
This opens **`http://localhost:8080`** in your browser so Google OAuth (`gmail.readonly`) can authorize securely.

### Option 2: Direct Launch
Double-click **`start.bat`** or open **`index.html`**.

---

## ✨ Key Features

### 1. HDFC Bank Gmail Inbox Reader (`js/gmailScanner.js`)
- **Strict HDFC Bank Filtering**: Queries your Gmail inbox specifically for emails from `hdfcbank.net`, `hdfcbank.com`, or `"HDFC Bank"` (`alerts@hdfcbank.net`, `instaalerts@hdfcbank.net`, etc.).
- **Recent & Historical Emails**: Scan the last 7 days, 30 days, 90 days, 6 months, 1 year, all previous HDFC emails in your inbox, or a custom date range.
- **Smart HDFC Parser**:
  - **HDFC UPI**: Extracts `Rs.`/`INR` amount, VPA (`swiggy@axisbank`, etc.), and reference number.
  - **HDFC Credit Card & Debit Card**: Extracts merchant name (`at MERCHANT on...`) and card channel.
  - **HDFC NetBanking / IMPS / NEFT / RTGS**: Extracts beneficiary/remitter and account credits/debits.
  - **Noise Filtering**: Automatically skips OTPs, promotional offers, and non-transaction alerts.
- **Duplicate Prevention**: Uses Gmail's unique `message.id` so scanning the same timeframe twice never creates duplicate entries.

### 2. Zero External Database / No Demo Data
- **No Cloud DB**: Zero Firebase, Supabase, or external database dependencies.
- **No Demo Data**: Starts completely clean and only displays real data synced from your HDFC Gmail alerts (or manual entries you add).
- **Default Currency**: Configured to **INR (`₹`)** with Indian numbering format (`₹1,25,000.00`).

### 3. Dashboard & 7 Analytical Visualizations
1. **Cash Flow Evolution (Timeline)**
2. **Category Expense Allocation (Doughnut)**
3. **Income Streams Distribution (Polar Area)**
4. **Monthly Burn Rate & Net Cashflow Comparison**
5. **Day-of-Week Spending Pattern**
6. **HDFC Payment Channel Breakdown** (`HDFC UPI`, `HDFC Credit Card`, `HDFC Debit Card`, `HDFC NetBanking`, `HDFC Bank Account`)
7. **Top 5 Largest Spends Ranking**
