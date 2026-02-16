// --- Community corpus (Korpus & Wissensbasis) ---
(function () {
  const STORAGE_KEY = 'rk-community-corpus';
  const CLIENT_ID_KEY = 'rk-community-client-id';

  function getClientId() {
    // One id per browser/device to prevent unlimited self-likes.
    // NOTE: This does NOT sync across devices without a backend.
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = (crypto?.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2)));
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  }

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
    const sortSelect = document.getElementById('corpusSort');
    const exportJsonBtn = document.getElementById('corpusExportJson');
    const exportCsvBtn = document.getElementById('corpusExportCsv');
    const importBtn = document.getElementById('corpusImportBtn');
    const importFile = document.getElementById('corpusImportFile');
    const toastEl = document.getElementById('toast');
    let toastTimeout = null;

    function notify(msg, tone = 'info') {
      if (!toastEl) return alert(msg);
      toastEl.textContent = msg;
      toastEl.classList.remove('hidden');
      toastEl.classList.toggle('border-emerald-400', tone === 'success');
      toastEl.classList.toggle('border-amber-400', tone === 'info');
      toastEl.classList.toggle('border-red-400', tone === 'error');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => toastEl.classList.add('hidden'), 4200);
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_) {} }, 2500);
    }

    function exportAsJson() {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: entries,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadBlob(blob, `rk-community-backup-${stamp}.json`);
      notify('Backup exportiert (JSON).', 'success');
    }

    function escapeCsv(val) {
      const s = String(val ?? '');
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }

    function exportAsCsv() {
      const header = ['id','hochdeutsch','kaerntnerisch','quelle','datum','likes','likedBy'];
      const rows = entries.map(e => [
        e.id,
        e.hd,
        e.dialect,
        e.source || '',
        e.created || '',
        Number.isFinite(e.likes) ? e.likes : 0,
        Array.isArray(e.likedBy) ? e.likedBy.join('|') : ''
      ].map(escapeCsv).join(','));
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadBlob(blob, `rk-community-backup-${stamp}.csv`);
      notify('Backup exportiert (CSV).', 'success');
    }

    function normalizeEntry(e) {
      if (!e || typeof e !== 'object') return null;
      const hd = String(e.hd ?? '').trim();
      const dialect = String(e.dialect ?? '').trim();
      if (!hd || !dialect) return null;
      return {
        id: String(e.id ?? (Date.now() + '-' + Math.random().toString(16).slice(2))),
        hd,
        dialect,
        source: String(e.source ?? ''),
        created: e.created ? String(e.created) : new Date().toISOString(),
        likes: Number.isFinite(e.likes) ? e.likes : 0,
        likedBy: Array.isArray(e.likedBy) ? e.likedBy.map(String) : [],
      };
    }

    async function importFromFile(file) {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const arr = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : null);
        if (!arr) throw new Error('Ungültiges Backup-Format');
        const normalized = arr.map(normalizeEntry).filter(Boolean);
        if (!normalized.length) throw new Error('Keine gültigen Einträge im Backup');

        if (!confirm(`Import ersetzt die aktuellen ${entries.length} Einträge durch ${normalized.length} Einträge. Fortfahren?`)) {
          return;
        }
        entries = normalized;
        saveEntries(entries);
        updateCounter();
        render();
        notify('Backup importiert.', 'success');
      } catch (err) {
        console.error('[corpus] import failed', err);
        notify('Import fehlgeschlagen: ' + (err?.message || err), 'error');
      } finally {
        if (importFile) importFile.value = '';
      }
    }

    const clientId = getClientId();

    const isAdmin = () => !!(window.Admin && typeof window.Admin.isAdmin === 'function' && window.Admin.isAdmin());

    // Re-render when admin mode changes (e.g. after unlock)
    window.addEventListener('adminmodechange', () => {
      render();
    });

    // If main elements are missing, abort
    if (!form || !hdInput || !dialectInput || !listBody) {
      console.warn('[corpus] Required DOM elements not found, corpus feature disabled on this page.');
      return;
    }

    let entries = loadEntries().map(e => ({
      ...e,
      likes: Number.isFinite(e.likes) ? e.likes : 0,
      likedBy: Array.isArray(e.likedBy) ? e.likedBy : []
    }));

    let sortMode = (sortSelect && sortSelect.value) ? sortSelect.value : 'top';

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

      const sorted = entries.slice().sort((a, b) => {
        if (sortMode === 'new') {
          return (a.created < b.created ? 1 : -1);
        }

        // default: ranking by likes, tie-breaker: newest
        const la = Number.isFinite(a.likes) ? a.likes : 0;
        const lb = Number.isFinite(b.likes) ? b.likes : 0;
        if (lb !== la) return lb - la;
        return (a.created < b.created ? 1 : -1);
      });

      sorted.forEach(entry => {
          const tr = document.createElement('tr');
          tr.className = 'border-b last:border-0 border-slate-200/60 dark:border-slate-700/60';

          const hdTd = document.createElement('td');
          hdTd.className = 'px-2 sm:px-3 py-2 align-top text-sm';
          hdTd.textContent = entry.hd;

          const dialectTd = document.createElement('td');
          dialectTd.className = 'px-2 sm:px-3 py-2 align-top text-sm font-medium text-emerald-700 dark:text-emerald-300';
          dialectTd.textContent = entry.dialect;

          const likeTd = document.createElement('td');
          likeTd.className = 'px-2 sm:px-3 py-2 align-top text-sm whitespace-nowrap';

          const liked = entry.likedBy.includes(clientId);

          const likeBtn = document.createElement('button');
          likeBtn.type = 'button';
          likeBtn.className = 'btn btn-ghost btn-xs flex items-center gap-2 ' + (liked ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300');
          likeBtn.setAttribute('aria-label', liked ? 'Like entfernen' : 'Like geben');
          likeBtn.innerHTML = `
            <span class="text-base" aria-hidden="true">${liked ? '❤️' : '🤍'}</span>
            <span class="text-[12px] font-semibold">${entry.likes || 0}</span>
          `;

          likeBtn.addEventListener('click', function () {
            const target = entries.find(e => e.id === entry.id);
            if (!target) return;

            const alreadyLiked = target.likedBy.includes(clientId);
            if (alreadyLiked) {
              target.likedBy = target.likedBy.filter(x => x !== clientId);
              target.likes = Math.max(0, (target.likes || 0) - 1);
            } else {
              target.likedBy.push(clientId);
              target.likes = (target.likes || 0) + 1;
            }

            saveEntries(entries);
            render();
          });

          likeTd.appendChild(likeBtn);

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

          if (isAdmin()) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn btn-ghost btn-xs text-[11px] text-red-600 dark:text-red-400';
            delBtn.textContent = 'Löschen';

            delBtn.addEventListener('click', function () {
              if (!isAdmin()) {
                alert('Nur Admin darf Einträge löschen.');
                return;
              }
              if (!confirm('Diesen Eintrag wirklich löschen?')) return;
              entries = entries.filter(e => e.id !== entry.id);
              saveEntries(entries);
              render();
            });

            actionTd.appendChild(delBtn);
          }

          tr.appendChild(hdTd);
          tr.appendChild(dialectTd);
          tr.appendChild(likeTd);
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
        created: new Date().toISOString(),
        likes: 0,
        likedBy: []
      };

      entries.push(newEntry);
      saveEntries(entries);
      render();

      form.reset();
      hdInput.focus();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (!isAdmin()) {
          alert('Nur Admin darf Einträge löschen.');
          return;
        }
        if (!entries.length) return;
        if (!confirm('Alle lokalen Einträge löschen?')) return;
        entries = [];
        saveEntries(entries);
        render();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', function () {
        sortMode = sortSelect.value;
        render();
      });
    }


    // Backup/Export (Admin only UI is handled via .admin-only)
    if (exportJsonBtn) {
      exportJsonBtn.addEventListener('click', () => {
        if (!isAdmin()) { alert('Nur Admin darf exportieren.'); return; }
        exportAsJson();
      });
    }
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', () => {
        if (!isAdmin()) { alert('Nur Admin darf exportieren.'); return; }
        exportAsCsv();
      });
    }
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => {
        if (!isAdmin()) { alert('Nur Admin darf importieren.'); return; }
        importFile.click();
      });
      importFile.addEventListener('change', () => {
        const file = importFile.files && importFile.files[0];
        if (!file) return;
        importFromFile(file);
      });
    }

    // Initial render
    render();
  });
})();