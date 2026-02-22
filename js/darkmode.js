/**
 * Theme toggle + persistence (light/dark) across reloads.
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Theme toggle + persistence (light/dark) across reloads.
// ------------------------------------------------------------

// Dark mode toggle with persistence
(function () {
  const root = document.documentElement;
  const btn = document.getElementById('darkToggle');
  if (!btn) return;

  // Apply stored theme or system preference on first load
  function applyInitialTheme() {
    let stored = null;
    try {
      stored = localStorage.getItem('rk-dark');
    } catch (e) {
      stored = null;
    }

    if (stored === '1') {
      root.classList.add('dark');
    } else if (stored === '0') {
      root.classList.remove('dark');
    } else {
      // No stored value: fall back to system preference
      if (window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }

  function syncLabel() {
    btn.textContent = root.classList.contains('dark') ? '☀️ Hell' : '🌙 Dunkel';
  }

  applyInitialTheme();
  syncLabel();

  btn.addEventListener('click', function () {
    const isDark = root.classList.toggle('dark');
    try {
      localStorage.setItem('rk-dark', isDark ? '1' : '0');
    } catch (e) {
      // ignore
    }
    syncLabel();
  });
})();

// Footer year
(function () {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
})();
