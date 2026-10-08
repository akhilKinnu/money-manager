/**
 * FinTrack Pro - Multi-Cloud Sync Engine
 * Supports:
 * 1. Firebase Firestore (Google Login, Real-time 2-way sync)
 * 2. Supabase (PostgreSQL, Email/Password Auth, Row Level Security)
 * 3. Google Drive (Direct file backup/restore via Drive API)
 */

const CLOUD_STORAGE_KEYS = {
  ACTIVE_PROVIDER: 'fintrack_cloud_provider',
  FIREBASE_CONFIG: 'fintrack_firebase_config',
  SUPABASE_CONFIG: 'fintrack_supabase_config',
  GDRIVE_CONFIG: 'fintrack_gdrive_config'
};

class CloudSyncManager {
  constructor() {
    this.activeProvider = localStorage.getItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER) || 'none';
    this.firebaseApp = null;
    this.firebaseAuth = null;
    this.firestoreDb = null;
    this.firebaseUnsubscribe = null;

    this.supabaseClient = null;
    this.supabaseChannel = null;

    this.gdriveTokenClient = null;
    this.gdriveAccessToken = null;

    this.currentUser = null;
    this.isSyncing = false;
    this.syncTimeout = null;
    this.isRemoteUpdate = false; // Flag to prevent infinite sync loops

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupAutoSyncHook();

    // Auto-restore previously connected provider if credentials exist
    setTimeout(() => {
      this.restoreActiveConnection();
    }, 400);
  }

  // Hook into Store mutations to auto-sync to whichever cloud is active
  setupAutoSyncHook() {
    if (window.store) {
      window.store.subscribe((event, data, state) => {
        // Skip syncing if the event was triggered by a remote cloud download
        if (this.isRemoteUpdate) return;

        // Skip internal filter/theme changes
        if (['filter_changed', 'theme_changed'].includes(event)) return;

        if (this.activeProvider !== 'none' && this.currentUser) {
          this.scheduleCloudPush();
        }
      });
    }
  }

  // Debounced auto-push to cloud
  scheduleCloudPush() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.updateCloudStatus('syncing', 'Syncing changes...');

    this.syncTimeout = setTimeout(() => {
      this.pushToActiveCloud();
    }, 800);
  }

  async pushToActiveCloud() {
    if (this.activeProvider === 'firebase') {
      await this.pushToFirebase();
    } else if (this.activeProvider === 'supabase') {
      await this.pushToSupabase();
    } else if (this.activeProvider === 'gdrive') {
      await this.uploadToGoogleDrive();
    }
  }

  // Restore stored session on page load
  async restoreActiveConnection() {
    if (this.activeProvider === 'firebase') {
      const savedConfig = this.loadFirebaseConfig();
      if (savedConfig && savedConfig.apiKey) {
        this.initFirebase(savedConfig, false);
      }
    } else if (this.activeProvider === 'supabase') {
      const savedConfig = this.loadSupabaseConfig();
      if (savedConfig && savedConfig.url && savedConfig.anonKey) {
        this.initSupabase(savedConfig.url, savedConfig.anonKey, false);
      }
    } else if (this.activeProvider === 'gdrive') {
      const savedConfig = this.loadGDriveConfig();
      if (savedConfig && savedConfig.clientId) {
        this.initGoogleDrive(savedConfig.clientId, false);
      }
    } else {
      this.updateCloudStatus('disconnected', 'Local Storage Only');
    }
  }

  // =========================================================================
  // 1. FIREBASE FIRESTORE SYNC
  // =========================================================================

  loadFirebaseConfig() {
    try {
      const raw = localStorage.getItem(CLOUD_STORAGE_KEYS.FIREBASE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveFirebaseConfig(config) {
    localStorage.setItem(CLOUD_STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(config));
  }

  initFirebase(config, showToast = true) {
    try {
      if (typeof firebase === 'undefined') {
        throw new Error('Firebase SDK not loaded. Check internet connection.');
      }

      if (!firebase.apps.length) {
        this.firebaseApp = firebase.initializeApp(config);
      } else {
        this.firebaseApp = firebase.app();
      }

      this.firebaseAuth = firebase.auth();
      this.firestoreDb = firebase.firestore();

      this.saveFirebaseConfig(config);

      // Listen to Auth state changes
      this.firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = {
            id: user.uid,
            email: user.email || 'Google User',
            name: user.displayName || 'User',
            provider: 'firebase'
          };
          this.activeProvider = 'firebase';
          localStorage.setItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER, 'firebase');
          this.updateCloudStatus('connected', `Firebase: ${this.currentUser.email}`);
          this.listenToFirestoreChanges(user.uid);
          if (showToast) UI.showToast(`Signed into Firebase as ${this.currentUser.email}`, 'success');
        } else {
          if (this.activeProvider === 'firebase') {
            this.currentUser = null;
            this.updateCloudStatus('disconnected', 'Firebase: Signed Out');
          }
        }
      });

      return true;
    } catch (err) {
      console.error('Firebase initialization failed', err);
      if (showToast) UI.showToast(`Firebase Error: ${err.message}`, 'error');
      return false;
    }
  }

  // Sign In With Google (Firebase)
  async signInFirebaseGoogle() {
    if (!this.firebaseAuth) {
      const config = this.loadFirebaseConfig();
      if (!config) {
        UI.showToast('Please save your Firebase project configuration first', 'warning');
        return;
      }
      this.initFirebase(config);
    }

    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await this.firebaseAuth.signInWithPopup(provider);
      UI.showToast(`Welcome ${result.user.displayName || result.user.email}!`, 'success');
      UI.closeModal('cloudSyncModal');
    } catch (err) {
      console.error('Firebase Google sign-in failed', err);
      UI.showToast(`Google Sign-In: ${err.message}`, 'error');
    }
  }

  // Sign In With Email (Firebase)
  async signInFirebaseEmail(email, password) {
    if (!this.firebaseAuth) return;
    try {
      await this.firebaseAuth.signInWithEmailAndPassword(email, password);
      UI.closeModal('cloudSyncModal');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }

  // Sign Up With Email (Firebase)
  async signUpFirebaseEmail(email, password) {
    if (!this.firebaseAuth) return;
    try {
      await this.firebaseAuth.createUserWithEmailAndPassword(email, password);
      UI.showToast('Firebase account created & signed in!', 'success');
      UI.closeModal('cloudSyncModal');
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }

  // Push local data to Firestore
  async pushToFirebase() {
    if (!this.firestoreDb || !this.currentUser) return;
    try {
      this.updateCloudStatus('syncing', 'Saving to Firestore...');
      const payload = {
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        currency: window.store.state.currency,
        budgets: window.store.state.budgets,
        savingsGoal: window.store.state.savingsGoal,
        categories: window.store.state.categories,
        paymentMethods: window.store.state.paymentMethods,
        transactions: window.store.state.transactions
      };

      await this.firestoreDb.collection('fintrack_vault').doc(this.currentUser.id).set(payload, { merge: true });
      this.updateCloudStatus('connected', `Firebase: ${this.currentUser.email} (Synced)`);
    } catch (err) {
      console.error('Firestore push failed', err);
      this.updateCloudStatus('error', 'Firestore sync failed');
    }
  }

  // Realtime snapshot listener for multi-device sync
  listenToFirestoreChanges(userId) {
    if (this.firebaseUnsubscribe) this.firebaseUnsubscribe();

    this.firebaseUnsubscribe = this.firestoreDb.collection('fintrack_vault').doc(userId).onSnapshot((doc) => {
      if (doc.exists) {
        const remoteData = doc.data();
        if (remoteData && Array.isArray(remoteData.transactions)) {
          // If remote data has transactions and local is currently different, merge/update
          const localCount = window.store.state.transactions.length;
          const remoteCount = remoteData.transactions.length;

          // Check if remote data differs from local
          if (remoteCount !== localCount || JSON.stringify(remoteData.transactions) !== JSON.stringify(window.store.state.transactions)) {
            this.isRemoteUpdate = true;
            window.store.state.transactions = remoteData.transactions;
            if (remoteData.budgets) window.store.state.budgets = remoteData.budgets;
            if (remoteData.savingsGoal) window.store.state.savingsGoal = remoteData.savingsGoal;
            if (remoteData.currency) window.store.state.currency = remoteData.currency;
            window.store.saveState();
            window.store.notify('cloud_sync_received', remoteData);
            this.isRemoteUpdate = false;
            UI.showToast('Synced latest updates from cloud!', 'info');
          }
        }
      } else {
        // Doc doesn't exist yet on cloud, push current local data as initial seed
        this.pushToFirebase();
      }
    }, (error) => {
      console.warn('Firestore snapshot error', error);
    });
  }

  // Sign out Firebase
  async signOutFirebase() {
    if (this.firebaseAuth) {
      await this.firebaseAuth.signOut();
    }
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }
    this.currentUser = null;
    this.activeProvider = 'none';
    localStorage.removeItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER);
    this.updateCloudStatus('disconnected', 'Local Storage Only');
    UI.showToast('Disconnected from Firebase', 'info');
  }

  // =========================================================================
  // 2. SUPABASE POSTGRESQL SYNC
  // =========================================================================

  loadSupabaseConfig() {
    try {
      const raw = localStorage.getItem(CLOUD_STORAGE_KEYS.SUPABASE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveSupabaseConfig(url, anonKey) {
    localStorage.setItem(CLOUD_STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify({ url, anonKey }));
  }

  initSupabase(url, anonKey, showToast = true) {
    try {
      if (!window.supabase) {
        throw new Error('Supabase client SDK not loaded.');
      }

      this.supabaseClient = window.supabase.createClient(url, anonKey);
      this.saveSupabaseConfig(url, anonKey);

      // Check current session
      this.supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session && session.user) {
          this.handleSupabaseUserLogin(session.user);
        } else {
          if (this.activeProvider === 'supabase') {
            this.updateCloudStatus('disconnected', 'Supabase: Ready (Signed out)');
          }
        }
      });

      // Listen to auth state change
      this.supabaseClient.auth.onAuthStateChange((event, session) => {
        if (session && session.user) {
          this.handleSupabaseUserLogin(session.user);
        } else if (event === 'SIGNED_OUT') {
          if (this.activeProvider === 'supabase') {
            this.currentUser = null;
            this.updateCloudStatus('disconnected', 'Supabase: Signed Out');
          }
        }
      });

      return true;
    } catch (err) {
      console.error('Supabase init failed', err);
      if (showToast) UI.showToast(`Supabase Error: ${err.message}`, 'error');
      return false;
    }
  }

  handleSupabaseUserLogin(user) {
    this.currentUser = {
      id: user.id,
      email: user.email,
      provider: 'supabase'
    };
    this.activeProvider = 'supabase';
    localStorage.setItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER, 'supabase');
    this.updateCloudStatus('connected', `Supabase: ${user.email}`);
    this.fetchFromSupabase();
    this.listenToSupabaseRealtime(user.id);
  }

  // Supabase Sign In with Email
  async signInSupabase(email, password) {
    if (!this.supabaseClient) {
      UI.showToast('Please configure Supabase URL & Anon Key first', 'warning');
      return;
    }
    const { data, error } = await this.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      UI.showToast(`Supabase Login: ${error.message}`, 'error');
    } else {
      UI.showToast(`Signed into Supabase as ${data.user.email}!`, 'success');
      UI.closeModal('cloudSyncModal');
    }
  }

  // Supabase Sign Up with Email
  async signUpSupabase(email, password) {
    if (!this.supabaseClient) {
      UI.showToast('Please configure Supabase URL & Anon Key first', 'warning');
      return;
    }
    const { data, error } = await this.supabaseClient.auth.signUp({ email, password });
    if (error) {
      UI.showToast(`Supabase Sign-Up: ${error.message}`, 'error');
    } else {
      UI.showToast('Account created! Please check your email to confirm, or login.', 'info');
    }
  }

  // Push local data to Supabase PostgreSQL table
  async pushToSupabase() {
    if (!this.supabaseClient || !this.currentUser) return;
    try {
      this.updateCloudStatus('syncing', 'Saving to Supabase...');
      const payload = {
        currency: window.store.state.currency,
        budgets: window.store.state.budgets,
        savingsGoal: window.store.state.savingsGoal,
        categories: window.store.state.categories,
        paymentMethods: window.store.state.paymentMethods,
        transactions: window.store.state.transactions
      };

      const { error } = await this.supabaseClient
        .from('fintrack_vault')
        .upsert({
          user_id: this.currentUser.id,
          data: payload,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;
      this.updateCloudStatus('connected', `Supabase: ${this.currentUser.email} (Synced)`);
    } catch (err) {
      console.error('Supabase push error', err);
      this.updateCloudStatus('error', 'Supabase sync failed');
    }
  }

  // Fetch data from Supabase
  async fetchFromSupabase() {
    if (!this.supabaseClient || !this.currentUser) return;
    try {
      const { data, error } = await this.supabaseClient
        .from('fintrack_vault')
        .select('data')
        .eq('user_id', this.currentUser.id)
        .maybeSingle();

      if (error) throw error;

      if (data && data.data && Array.isArray(data.data.transactions)) {
        this.isRemoteUpdate = true;
        window.store.state.transactions = data.data.transactions;
        if (data.data.budgets) window.store.state.budgets = data.data.budgets;
        if (data.data.savingsGoal) window.store.state.savingsGoal = data.data.savingsGoal;
        if (data.data.currency) window.store.state.currency = data.data.currency;
        window.store.saveState();
        window.store.notify('cloud_sync_received', data.data);
        this.isRemoteUpdate = false;
        UI.showToast('Supabase data loaded successfully', 'success');
      } else {
        // First time, seed initial data
        this.pushToSupabase();
      }
    } catch (err) {
      console.warn('Supabase fetch error', err);
    }
  }

  // Real-time changes from Supabase
  listenToSupabaseRealtime(userId) {
    if (this.supabaseChannel) {
      this.supabaseClient.removeChannel(this.supabaseChannel);
    }

    this.supabaseChannel = this.supabaseClient
      .channel('fintrack_vault_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fintrack_vault', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.new && payload.new.data) {
            this.isRemoteUpdate = true;
            window.store.state.transactions = payload.new.data.transactions || [];
            if (payload.new.data.budgets) window.store.state.budgets = payload.new.data.budgets;
            if (payload.new.data.savingsGoal) window.store.state.savingsGoal = payload.new.data.savingsGoal;
            window.store.saveState();
            window.store.notify('cloud_sync_received', payload.new.data);
            this.isRemoteUpdate = false;
            UI.showToast('Real-time update received from Supabase!', 'info');
          }
        }
      )
      .subscribe();
  }

  // Sign out Supabase
  async signOutSupabase() {
    if (this.supabaseClient) {
      await this.supabaseClient.auth.signOut();
    }
    if (this.supabaseChannel) {
      this.supabaseClient.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
    this.currentUser = null;
    this.activeProvider = 'none';
    localStorage.removeItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER);
    this.updateCloudStatus('disconnected', 'Local Storage Only');
    UI.showToast('Disconnected from Supabase', 'info');
  }

  // =========================================================================
  // 3. GOOGLE DRIVE SYNC (Direct File Backup)
  // =========================================================================

  loadGDriveConfig() {
    try {
      const raw = localStorage.getItem(CLOUD_STORAGE_KEYS.GDRIVE_CONFIG);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveGDriveConfig(clientId) {
    localStorage.setItem(CLOUD_STORAGE_KEYS.GDRIVE_CONFIG, JSON.stringify({ clientId }));
  }

  initGoogleDrive(clientId, showToast = true) {
    if (!window.google || !window.google.accounts) {
      if (showToast) UI.showToast('Google Identity API not loaded. Check internet.', 'error');
      return false;
    }

    this.saveGDriveConfig(clientId);

    this.gdriveTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          this.gdriveAccessToken = tokenResponse.access_token;
          this.activeProvider = 'gdrive';
          localStorage.setItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER, 'gdrive');
          this.currentUser = { provider: 'gdrive', name: 'Google Drive User' };
          this.updateCloudStatus('connected', 'Google Drive: Connected');
          UI.showToast('Connected to Google Drive!', 'success');
          UI.closeModal('cloudSyncModal');
          // Automatically backup on connect
          this.uploadToGoogleDrive();
        }
      }
    });

    return true;
  }

  // Request Drive Authorization
  connectGoogleDrive() {
    const clientIdInput = document.getElementById('gdriveClientIdInput');
    const clientId = clientIdInput ? clientIdInput.value.trim() : '';

    if (!clientId) {
      const saved = this.loadGDriveConfig();
      if (saved && saved.clientId) {
        this.initGoogleDrive(saved.clientId);
        this.gdriveTokenClient.requestAccessToken({ prompt: 'consent' });
        return;
      }
      UI.showToast('Please enter your Google OAuth Client ID first', 'warning');
      return;
    }

    if (this.initGoogleDrive(clientId)) {
      this.gdriveTokenClient.requestAccessToken({ prompt: 'consent' });
    }
  }

  // Upload/Save FinTrack Vault file to Google Drive
  async uploadToGoogleDrive() {
    if (!this.gdriveAccessToken) {
      UI.showToast('Please authorize Google Drive first', 'warning');
      return;
    }

    try {
      this.updateCloudStatus('syncing', 'Backing up to Drive...');
      const fileName = 'FinTrack_Pro_Vault.json';
      const fileData = JSON.stringify({
        version: '2.0',
        updatedAt: new Date().toISOString(),
        currency: window.store.state.currency,
        budgets: window.store.state.budgets,
        savingsGoal: window.store.state.savingsGoal,
        categories: window.store.state.categories,
        paymentMethods: window.store.state.paymentMethods,
        transactions: window.store.state.transactions
      }, null, 2);

      // 1. Search if file already exists
      const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${this.gdriveAccessToken}` }
      });
      const searchData = await searchRes.json();
      const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

      if (existingFile) {
        // Update existing file
        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.gdriveAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileData
        });
      } else {
        // Create new file metadata + content
        const metadata = { name: fileName, mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileData], { type: 'application/json' }));

        await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.gdriveAccessToken}` },
          body: form
        });
      }

      this.updateCloudStatus('connected', 'Google Drive: Synced');
      UI.showToast('Successfully backed up to Google Drive!', 'success');
    } catch (err) {
      console.error('Google Drive upload error', err);
      this.updateCloudStatus('error', 'Drive upload failed');
      UI.showToast(`Drive upload failed: ${err.message}`, 'error');
    }
  }

  // Restore/Download FinTrack Vault file from Google Drive
  async downloadFromGoogleDrive() {
    if (!this.gdriveAccessToken) {
      UI.showToast('Please authorize Google Drive first', 'warning');
      return;
    }

    try {
      this.updateCloudStatus('syncing', 'Fetching from Drive...');
      const fileName = 'FinTrack_Pro_Vault.json';
      const query = encodeURIComponent(`name = '${fileName}' and trashed = false`);
      const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${this.gdriveAccessToken}` }
      });
      const searchData = await searchRes.json();
      const existingFile = searchData.files && searchData.files.length > 0 ? searchData.files[0] : null;

      if (!existingFile) {
        UI.showToast('No FinTrack vault file found in your Google Drive', 'info');
        this.updateCloudStatus('connected', 'Google Drive: Connected');
        return;
      }

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
        headers: { Authorization: `Bearer ${this.gdriveAccessToken}` }
      });
      const vaultData = await fileRes.json();

      if (vaultData && Array.isArray(vaultData.transactions)) {
        if (confirm(`Restore ${vaultData.transactions.length} transactions from Google Drive? This will update your local data.`)) {
          this.isRemoteUpdate = true;
          window.store.importJSON(vaultData);
          this.isRemoteUpdate = false;
          UI.showToast(`Restored ${vaultData.transactions.length} transactions from Google Drive!`, 'success');
        }
      }
      this.updateCloudStatus('connected', 'Google Drive: Synced');
    } catch (err) {
      console.error('Google Drive download error', err);
      UI.showToast(`Drive restore error: ${err.message}`, 'error');
    }
  }

  signOutGoogleDrive() {
    this.gdriveAccessToken = null;
    this.currentUser = null;
    this.activeProvider = 'none';
    localStorage.removeItem(CLOUD_STORAGE_KEYS.ACTIVE_PROVIDER);
    this.updateCloudStatus('disconnected', 'Local Storage Only');
    UI.showToast('Disconnected from Google Drive', 'info');
  }

  // =========================================================================
  // STATUS INDICATOR & EVENT HANDLERS
  // =========================================================================

  updateCloudStatus(status, text) {
    const badge = document.getElementById('cloudStatusBadge');
    const badgeText = document.getElementById('cloudStatusText');
    const dot = document.getElementById('cloudStatusDot');

    if (!badge || !badgeText || !dot) return;

    badgeText.textContent = text;

    if (status === 'connected') {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-pointer hover:bg-emerald-500/25 transition-all';
    } else if (status === 'syncing') {
      dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-spin';
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 cursor-pointer transition-all';
    } else if (status === 'error') {
      dot.className = 'w-2 h-2 rounded-full bg-rose-400';
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 cursor-pointer transition-all';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-slate-500';
      badge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700/80 cursor-pointer hover:bg-slate-700 transition-all';
    }
  }

  setupEventListeners() {
    // Open Cloud Sync modal when clicking header badge
    const badge = document.getElementById('cloudStatusBadge');
    if (badge) {
      badge.addEventListener('click', () => UI.openModal('cloudSyncModal'));
    }

    // Modal Provider Tabs (Firebase, Supabase, Google Drive, Deploy)
    const providerTabs = document.querySelectorAll('[data-cloud-tab]');
    providerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-cloud-tab');
        providerTabs.forEach(t => {
          t.classList.remove('border-indigo-500', 'text-indigo-400');
          t.classList.add('border-transparent', 'text-slate-400');
        });
        tab.classList.add('border-indigo-500', 'text-indigo-400');
        tab.classList.remove('border-transparent', 'text-slate-400');

        document.querySelectorAll('.cloud-tab-content').forEach(content => {
          if (content.id === `cloudTab-${target}`) {
            content.classList.remove('hidden');
          } else {
            content.classList.add('hidden');
          }
        });
      });
    });

    // Firebase Google Sign In button
    const btnFbGoogle = document.getElementById('btnFirebaseGoogle');
    if (btnFbGoogle) {
      btnFbGoogle.addEventListener('click', () => this.signInFirebaseGoogle());
    }

    // Firebase Email Login form
    const formFbEmail = document.getElementById('formFirebaseEmail');
    if (formFbEmail) {
      formFbEmail.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('fbEmailInput').value;
        const pass = document.getElementById('fbPassInput').value;
        this.signInFirebaseEmail(email, pass);
      });
    }

    // Firebase Email Register
    const btnFbRegister = document.getElementById('btnFirebaseRegister');
    if (btnFbRegister) {
      btnFbRegister.addEventListener('click', () => {
        const email = document.getElementById('fbEmailInput').value;
        const pass = document.getElementById('fbPassInput').value;
        if (!email || !pass) {
          UI.showToast('Please enter email and password', 'warning');
          return;
        }
        this.signUpFirebaseEmail(email, pass);
      });
    }

    // Firebase Config Form
    const formFbConfig = document.getElementById('formFirebaseConfig');
    if (formFbConfig) {
      formFbConfig.addEventListener('submit', (e) => {
        e.preventDefault();
        const apiKey = document.getElementById('fbApiKey').value.trim();
        const authDomain = document.getElementById('fbAuthDomain').value.trim();
        const projectId = document.getElementById('fbProjectId').value.trim();
        const appId = document.getElementById('fbAppId').value.trim();

        const cfg = { apiKey, authDomain, projectId, appId };
        if (this.initFirebase(cfg, true)) {
          UI.showToast('Firebase configuration saved!', 'success');
        }
      });
    }

    // Supabase Form
    const formSupabaseAuth = document.getElementById('formSupabaseAuth');
    if (formSupabaseAuth) {
      formSupabaseAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('supabaseUrlInput').value.trim();
        const anonKey = document.getElementById('supabaseKeyInput').value.trim();
        const email = document.getElementById('supabaseEmailInput').value.trim();
        const pass = document.getElementById('supabasePassInput').value;

        if (this.initSupabase(url, anonKey)) {
          this.signInSupabase(email, pass);
        }
      });
    }

    const btnSupabaseRegister = document.getElementById('btnSupabaseRegister');
    if (btnSupabaseRegister) {
      btnSupabaseRegister.addEventListener('click', () => {
        const url = document.getElementById('supabaseUrlInput').value.trim();
        const anonKey = document.getElementById('supabaseKeyInput').value.trim();
        const email = document.getElementById('supabaseEmailInput').value.trim();
        const pass = document.getElementById('supabasePassInput').value;

        if (this.initSupabase(url, anonKey)) {
          this.signUpSupabase(email, pass);
        }
      });
    }

    // Google Drive Connect button
    const btnGDriveConnect = document.getElementById('btnGDriveConnect');
    if (btnGDriveConnect) {
      btnGDriveConnect.addEventListener('click', () => this.connectGoogleDrive());
    }

    const btnGDriveBackup = document.getElementById('btnGDriveBackup');
    if (btnGDriveBackup) {
      btnGDriveBackup.addEventListener('click', () => this.uploadToGoogleDrive());
    }

    const btnGDriveRestore = document.getElementById('btnGDriveRestore');
    if (btnGDriveRestore) {
      btnGDriveRestore.addEventListener('click', () => this.downloadFromGoogleDrive());
    }
  }
}

window.cloudSync = new CloudSyncManager();
