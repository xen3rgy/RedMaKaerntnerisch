// --- Community corpus (Korpus & Wissensbasis) ---
(function () {
  const STORAGE_KEY = 'rk-community-corpus';

  function loadEntries() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse community corpus from localStorage', e);
      return [];
    }
  }

  function saveEntries(entries) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save community corpus', e);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('corpusForm');
    const hdInput = document.getElementById('hdInput');
    const dialectInput = document.getElementById('dialectInput');
    const sourceInput = document.getElementById('sourceInput');
    const listBody = document.getElementById('corpusList');
    const counterEl = document.getElementById('corpusCount');
    const emptyState = document.getElementById('corpusEmpty');
    const clearBtn = document.getElementById('corpusClear');

    // If main elements are missing, abort
    if (!form || !hdInput || !dialectInput || !listBody) {
      console.warn('[corpus] Required DOM elements not found, corpus feature disabled on this page.');
      return;
    }

    let entries = loadEntries();

    function updateCounter() {
      if (counterEl) {
        counterEl.textContent = String(entries.length);
      }
    }

    function render() {
      listBody.innerHTML = '';

      if (!entries.length) {
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
      }

      entries
        .slice()
        .sort((a, b) => (a.created < b.created ? 1 : -1)) // newest first
        .forEach(entry => {
          const tr = document.createElement('tr');
          tr.className = 'border-b last:border-0 border-slate-200/60 dark:border-slate-700/60';

          const hdTd = document.createElement('td');
          hdTd.className = 'px-2 sm:px-3 py-2 align-top text-sm';
          hdTd.textContent = entry.hd;

          const dialectTd = document.createElement('td');
          dialectTd.className = 'px-2 sm:px-3 py-2 align-top text-sm font-medium text-emerald-700 dark:text-emerald-300';
          dialectTd.textContent = entry.dialect;

          const srcTd = document.createElement('td');
          srcTd.className = 'px-2 sm:px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line';
          srcTd.textContent = entry.source || '—';

          const metaTd = document.createElement('td');
          metaTd.className = 'px-2 sm:px-3 py-2 align-top text-xs text-slate-500 dark:text-slate-400 text-right whitespace-nowrap';
          const d = new Date(entry.created);
          metaTd.textContent =
            d.toLocaleDateString() + " " +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });


          const actionTd = document.createElement('td');
          actionTd.className = 'px-2 sm:px-3 py-2 align-top text-right';

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn btn-ghost btn-xs text-[11px] text-red-600 dark:text-red-400';
          delBtn.textContent = 'Löschen';

          delBtn.addEventListener('click', function () {
            if (!confirm('Diesen Eintrag wirklich löschen?')) return;
            entries = entries.filter(e => e.id !== entry.id);
            saveEntries(entries);
            render();
          });

          actionTd.appendChild(delBtn);

          tr.appendChild(hdTd);
          tr.appendChild(dialectTd);
          tr.appendChild(srcTd);
          tr.appendChild(metaTd);
          tr.appendChild(actionTd);

          listBody.appendChild(tr);
        });

      updateCounter();
    }

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();

      const hd = hdInput.value.trim();
      const dialect = dialectInput.value.trim();
      const source = sourceInput ? sourceInput.value.trim() : '';

      if (!hd || !dialect) {
        alert('Bitte gib mindestens Hochdeutsch und Kärntnerisch an.');
        return;
      }

      const newEntry = {
        id: Date.now() + '-' + Math.random().toString(16).slice(2),
        hd,
        dialect,
        source,
        created: new Date().toISOString()
      };

      entries.push(newEntry);
      saveEntries(entries);
      render();

      form.reset();
      hdInput.focus();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!entries.length) return;
        if (!confirm('Alle lokalen Einträge löschen?')) return;
        entries = [];
        saveEntries(entries);
        render();
      });
    }

    // Initial render
    render();
  });
})();
