// --- Dark mode button + footer year ---
(function () {
  const btn = document.getElementById('darkToggle');
  if (!btn) return; // wenn der Button nicht existiert, nichts tun

  function syncLabel() {
    const isDark = document.documentElement.classList.contains('dark');
    btn.textContent = isDark ? 'Light Mode' : 'Dark Mode';
  }

  // Startlabel setzen
  syncLabel();

  btn.addEventListener('click', function () {
    const isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('rk-dark', isDark ? '1' : '0');
    } catch (e) {}
    syncLabel();
  });
})();

// --- Year in footer ---
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}
