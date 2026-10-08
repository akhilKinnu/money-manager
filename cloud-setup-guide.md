# FinTrack Pro - Cloud Sync & Deployment Guide

This guide explains how to connect your preferred cloud service and deploy FinTrack Pro so you can access your expenses from your phone, laptop, or any browser.

---

## 🚀 Option 1: Firebase Firestore (Recommended for Real-Time Sync)

Firebase offers a free tier (1 GB storage, 50,000 reads/day) and provides real-time 2-way sync across all devices with Google Login.

### 2-Minute Setup:
1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **"Add project"** (e.g., name it `My Finances`).
2. In your project dashboard:
   - Click the **Web (`</>`)** icon to register a web app.
   - Copy the `firebaseConfig` object (you only need `apiKey`, `authDomain`, `projectId`, and `appId`).
3. Under **Build > Authentication**:
   - Click **Get Started**.
   - Enable **Google** (and optionally **Email/Password**) sign-in providers.
4. Under **Build > Firestore Database**:
   - Click **Create database** (start in Test Mode or Production Mode).
   - In the **Rules** tab, allow authenticated reads/writes:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /fintrack_vault/{userId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
     ```
5. In **FinTrack Pro**:
   - Click the **"Cloud Sync"** badge in the top header.
   - Under the **Firebase** tab, paste your credentials or click **Sign In With Google**.
   - Your data now automatically syncs across all devices!

---

## ⚡ Option 2: Supabase (PostgreSQL Cloud)

Supabase gives you a full PostgreSQL database with Row-Level Security (RLS) so only your account can access your records.

### 2-Minute Setup:
1. Go to [supabase.com](https://supabase.com) and create a free project.
2. In your project dashboard, go to **SQL Editor**:
   - Copy the contents of [`supabase-schema.sql`](file:///d:/Myself/Money%20Manager/supabase-schema.sql) and click **Run**.
3. Go to **Project Settings > API**:
   - Copy your **Project URL** (`https://xyz.supabase.co`).
   - Copy your **anon / public** key.
4. In **FinTrack Pro**:
   - Click the **"Cloud Sync"** badge in the top header.
   - Go to the **Supabase** tab, paste your URL & Key, enter your email and password, and click **Login** or **Register**.
   - Your transactions are now securely stored in cloud PostgreSQL!

---

## 📁 Option 3: Google Drive Sync ("Bring Your Own Cloud")

Sync your financial vault directly to your personal Google Drive with 0 database setup.

### Setup:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable the **Google Drive API**.
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Application type: **Web Application**).
   - Add your app origin (e.g., `http://localhost`, `https://your-app.vercel.app`, or `https://username.github.io`) to **Authorized JavaScript Origins**.
4. In **FinTrack Pro**:
   - Click **"Cloud Sync" > Google Drive**.
   - Paste your **Client ID** and click **Authorize & Connect Google Drive**.
   - Click **Backup Vault to Drive** anytime to save your `FinTrack_Pro_Vault.json`.

---

## 📱 Option 4: Deploying Live to Your Phone

To access FinTrack Pro from your smartphone, deploy it for free using either Vercel or GitHub Pages:

### A. Deploy to Vercel (Fastest — 30 Seconds)
1. Sign up for free at [vercel.com](https://vercel.com).
2. Go to [vercel.com/new](https://vercel.com/new).
3. Drag & drop the `D:\Myself\Money Manager` folder, or import the GitHub repository.
4. Click **Deploy**.
5. Vercel will give you a live HTTPS URL (e.g., `https://fintrack-pro.vercel.app`).
6. Open this URL on your phone's browser!

### B. Deploy to GitHub Pages
1. Create a repository on GitHub (e.g., `money-manager`).
2. In your terminal, run:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/money-manager.git
   git branch -M main
   git push -u origin main
   ```
3. In GitHub, go to **Settings > Pages**:
   - Under **Build and deployment > Source**, select **GitHub Actions**.
   - The workflow [`.github/workflows/deploy.yml`](file:///d:/Myself/Money%20Manager/.github/workflows/deploy.yml) will deploy it automatically!
4. Your app is live at `https://YOUR_USERNAME.github.io/money-manager`.

### 📲 Add to Phone Home Screen (PWA Style)
- **iPhone (Safari)**: Open your live URL, tap the **Share** button &rarr; **Add to Home Screen**.
- **Android (Chrome)**: Open your live URL, tap the **Three Dots** &rarr; **Add to Home screen** (or **Install App**).
- FinTrack Pro will now open in fullscreen like a native mobile app!
