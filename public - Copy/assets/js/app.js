// ============================================================
// (مشكاة) — Global App Helpers
// ============================================================

// ── Auth ────────────────────────────────────────────────────

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password, hash) {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

function getSession() {
  return JSON.parse(localStorage.getItem('misykah_session') || 'null');
}

function setSession(user) {
  localStorage.setItem('misykah_session', JSON.stringify({
    userId: user.id,
    name: user.name,
    username: user.username
  }));
}

function requireAuth() {
  if (!getSession()) {
    window.location.href = 'index.html';
  }
}

function logout() {
  localStorage.removeItem('misykah_session');
  window.location.href = 'index.html';
}

// ── ID & Data Helpers ────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getUserData(key, userId) {
  return JSON.parse(localStorage.getItem(`misykah_${key}_${userId}`) || '[]');
}

function saveUserData(key, userId, data) {
  localStorage.setItem(`misykah_${key}_${userId}`, JSON.stringify(data));
}

function getGlobalData(key) {
  return JSON.parse(localStorage.getItem(`misykah_global_${key}`) || '[]');
}

function saveGlobalData(key, data) {
  localStorage.setItem(`misykah_global_${key}`, JSON.stringify(data));
}

function getUsers() {
  return JSON.parse(localStorage.getItem('misykah_users') || '[]');
}

function saveUsers(users) {
  localStorage.setItem('misykah_users', JSON.stringify(users));
}

// ── IndexedDB Blob Storage (Large File Support & Read-on-Demand) ──

const MisykahDB = {
  dbName: 'misykah_files_db',
  dbVersion: 1,
  storeName: 'files',
  _activeUrls: new Map(),

  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveFile(id, fileOrBlob, metadata = {}) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put({
        id: id,
        blob: fileOrBlob,
        name: fileOrBlob.name || metadata.name || '',
        type: fileOrBlob.type || metadata.type || '',
        size: fileOrBlob.size || metadata.size || 0,
        savedAt: Date.now()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getFile(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ? req.result.blob : null);
      req.onerror = () => reject(req.error);
    });
  },

  async deleteFile(id) {
    if (this._activeUrls.has(id)) {
      URL.revokeObjectURL(this._activeUrls.get(id));
      this._activeUrls.delete(id);
    }
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getFileUrl(id) {
    // If active url already exists, reuse it
    if (this._activeUrls.has(id)) {
      return this._activeUrls.get(id);
    }
    const blob = await this.getFile(id);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    this._activeUrls.set(id, url);
    return url;
  },

  revokeFileUrl(id) {
    if (this._activeUrls.has(id)) {
      URL.revokeObjectURL(this._activeUrls.get(id));
      this._activeUrls.delete(id);
    }
  },

  formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }
};

// ── Date Helpers ─────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getHijriDate() {
  // Simple Hijri approximation
  const today = new Date();
  const jd = Math.floor(today.getTime() / 86400000) + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) +
    (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
  l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) -
    (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;

  const hijriMonths = [
    'Muharram', 'Shafar', 'Rabi\'ul Awwal', 'Rabi\'ul Akhir',
    'Jumadil Awwal', 'Jumadil Akhir', 'Rajab', 'Sya\'ban',
    'Ramadhan', 'Syawwal', 'Dzulqa\'dah', 'Dzulhijjah'
  ];
  const mIdx = month - 1;
  return `${day} ${hijriMonths[mIdx >= 0 && mIdx < 12 ? mIdx : 0]} ${year} H`;
}

function getMiladiDate() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

// ── Toast Notifications ───────────────────────────────────────

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-container');
  let container = existing;
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Sidebar User Info ─────────────────────────────────────────

function initSidebar() {
  const session = getSession();
  if (!session) return;
  const el = document.getElementById('userInfo');
  if (el) {
    el.innerHTML = `
      <div class="user-avatar">${session.name.charAt(0).toUpperCase()}</div>
      <div class="user-details">
        <div class="user-name">${session.name}</div>
        <div class="user-username">@${session.username}</div>
      </div>`;
  }

  // Mobile hamburger
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (hamburger && sidebar) {
    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
}

// ── Modal Helpers ─────────────────────────────────────────────

function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// ── File to Base64 ────────────────────────────────────────────

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Islamic Quotes ────────────────────────────────────────────

const islamicQuotes = [
  { arabic: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', source: 'Q.S. Thaha: 114', indo: '"Dan katakanlah: Wahai Tuhanku, tambahkanlah ilmu kepadaku."' },
  { arabic: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ', source: 'Q.S. Al-\'Alaq: 1', indo: '"Bacalah dengan (menyebut) nama Tuhanmu yang menciptakan."' },
  { arabic: 'إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ', source: 'Q.S. Fatir: 28', indo: '"Sesungguhnya yang takut kepada Allah di antara hamba-hamba-Nya hanyalah para ulama."' },
  { arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ', source: 'H.R. Ibnu Majah', indo: '"Menuntut ilmu adalah kewajiban bagi setiap muslim."' },
  { arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', source: 'H.R. Bukhari', indo: '"Sebaik-baik kalian adalah yang mempelajari Al-Qur\'an dan mengajarkannya."' },
];

function getDailyQuote() {
  const idx = new Date().getDate() % islamicQuotes.length;
  return islamicQuotes[idx];
}


// ── Dark Mode / Theme Toggle ──────────────────────────────────

function initTheme() {
  const saved = localStorage.getItem('misykah_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  // Inject toggle button on every page (except auth)
  if (!document.querySelector('.auth-page') && !document.querySelector('.theme-toggle')) {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.title = 'Mode Gelap / Terang';
    btn.innerHTML = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    btn.onclick = toggleTheme;
    document.body.appendChild(btn);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? '' : 'dark';
  if (next) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('misykah_theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('misykah_theme', 'light');
  }
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.innerHTML = next === 'dark' ? '☀️' : '🌙';
}

// Auto-init theme on every page
document.addEventListener('DOMContentLoaded', initTheme);
// Also run immediately if DOM is already loaded
if (document.readyState !== 'loading') initTheme();

// ── Export Helper ──────────────────────────────────────────────

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ── Service Worker & PWA Registration ─────────────────────────
if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[Misykah PWA] Service Worker registered with scope:', reg.scope);
      })
      .catch(err => {
        console.warn('[Misykah PWA] Service Worker registration failed:', err);
      });
  });
}
