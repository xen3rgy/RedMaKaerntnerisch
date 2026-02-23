/* Admin mode (client-side)
 * - Unlock via hidden key combo (Ctrl + Alt + A)
 * - Then password prompt
 * - Admin session stored in sessionStorage (resets when browser tab/window closes)
 *
 * IMPORTANT:
 * This is NOT real security. It only protects the UI from normal users.
 * Anyone with devtools could still manipulate the page. For real security you need a backend.
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ccv_is_admin_session';

  // New password: z33QKq-TRn-J-QfPTF
  // SHA-256 hash:
  const PASSWORD_HASH_SHA256 = 'a68ba88193b7c141f679392a1d5dd0fa60623954886954de82ac779eb0897e51';

  const ADMIN_ONLY_SELECTOR = '.admin-only';

  // Basic brute-force protection (client-side)
  const ATTEMPTS_KEY = 'ccv_admin_attempts';
  const LOCK_UNTIL_KEY = 'ccv_admin_lock_until';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 60 * 1000; // 60 seconds

  function now() {
    return Date.now();
  }

  function isLocked() {
    const until = parseInt(sessionStorage.getItem(LOCK_UNTIL_KEY) || '0', 10);
    return until > now();
  }

  function lockRemainingMs() {
    const until = parseInt(sessionStorage.getItem(LOCK_UNTIL_KEY) || '0', 10);
    return Math.max(0, until - now());
  }

  function getAttempts() {
    return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10);
  }

  function resetAttempts() {
    sessionStorage.setItem(ATTEMPTS_KEY, '0');
    sessionStorage.setItem(LOCK_UNTIL_KEY, '0');
  }

  function recordFailedAttempt() {
    const attempts = getAttempts() + 1;
    sessionStorage.setItem(ATTEMPTS_KEY, String(attempts));

    if (attempts >= MAX_ATTEMPTS) {
      sessionStorage.setItem(LOCK_UNTIL_KEY, String(now() + LOCK_MS));
      sessionStorage.setItem(ATTEMPTS_KEY, '0'); // reset counter after locking
    }
  }

  function isAdmin() {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  }

  function setAdmin(enabled) {
    sessionStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    applyAdminUI();
  }

  function hide(el) {
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
  }

  function show(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.removeAttribute('aria-hidden');
  }

  function applyAdminUI() {
    // Toggle all admin-only elements
    document.querySelectorAll(ADMIN_ONLY_SELECTOR).forEach(el => {
      if (isAdmin()) show(el);
      else hide(el);
    });

    // Optional: add/remove a small "Admin" badge + logout
    const host = document.querySelector('header .flex.items-center.gap-2') || document.querySelector('header');
    let badge = document.getElementById('adminBadge');

    if (isAdmin()) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'adminBadge';
        badge.className = 'flex items-center gap-2 ml-2';

        const pill = document.createElement('span');
        pill.className =
          'text-[11px] px-2 py-1 rounded-full border border-emerald-300/60 bg-emerald-50 text-emerald-700 ' +
          'dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200';
        pill.textContent = 'ADMIN';

        const logoutBtn = document.createElement('button');
        logoutBtn.type = 'button';
        logoutBtn.className = 'btn-ghost btn-xs';
        logoutBtn.textContent = 'Logout';
        logoutBtn.addEventListener('click', () => setAdmin(false));

        badge.appendChild(pill);
        badge.appendChild(logoutBtn);

        if (host) host.appendChild(badge);
      }
    } else {
      if (badge) badge.remove();
    }

    // Notify other modules (e.g. corpus render) to re-render if needed
    window.dispatchEvent(new CustomEvent('adminmodechange', { detail: { isAdmin: isAdmin() } }));
  }

  async function sha256Hex(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function unlockAdmin() {
    if (isLocked()) {
      const ms = lockRemainingMs();
      const secs = Math.ceil(ms / 1000);
      alert(`Zu viele Fehlversuche. Bitte ${secs}s warten und erneut versuchen.`);
      return;
    }

    const pw = prompt('Admin-Modus freischalten – Passwort eingeben:');
    if (!pw) return;

    try {
      const inputHash = await sha256Hex(pw);
      if (inputHash === PASSWORD_HASH_SHA256) {
        resetAttempts();
        setAdmin(true);
        alert('Admin-Modus aktiviert.');
      } else {
        recordFailedAttempt();
        if (isLocked()) {
          alert('Zu viele Fehlversuche. Admin-Login ist kurzzeitig gesperrt.');
        } else {
          alert('Falsches Passwort.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Fehler beim Aktivieren des Admin-Modus.');
    }
  }

  function keyHandler(e) {
    // Ctrl + Alt + A
    if (e.ctrlKey && e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      unlockAdmin();
    }
  }

  function init() {
    // Default: hide admin-only UI unless session is active
    if (!sessionStorage.getItem(STORAGE_KEY)) {
      sessionStorage.setItem(STORAGE_KEY, '0');
    }
    applyAdminUI();
    window.addEventListener('keydown', keyHandler);
  }

  // Expose only what is safe/useful (NO setAdmin export)
  window.Admin = {
    isAdmin,
    applyAdminUI
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
