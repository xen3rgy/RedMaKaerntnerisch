// --- Community corpus (Korpus & Wissensbasis) ---
// Public deployment (Variante B):
// - Entries are stored server-side via /api/corpus (Supabase behind the scenes)
// - Fallback: if /api/corpus is not available (e.g., opened locally), it uses localStorage

(function () {
  const LOCAL_STORAGE_KEY = 'rk-community-corpus';
  const CLIENT_ID_KEY = 'rk-community-client-id';
  const ADMIN_TOKEN_KEY = 'rk-admin-token';

  const API_URL = '/api/corpus';

  function getClientId() {
    // One id per browser/device to prevent unlimited self-likes.
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = (crypto?.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2)));
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  }

  function loadLocalEntries() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to parse community corpus from localStorage', e);
      return [];
    }
  }

  function saveLocalEntries(entries) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save community corpus', e);
    }
  }

  async function apiList() {
    const res = await fetch(API_URL, { method: 'GET' });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function apiCreate(entry) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    // API returns the inserted row (array or object)
    if (Array.isArray(data)) return data[0] || null;
    return data;
  }

  async function apiToggleLike(id, clientId) {
    const res = await fetch(API_URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_like', id, clientId }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    if (Array.isArray(data)) return data[0] || null;
    return data;
  }

  async function apiDelete(id, adminToken) {
    const res = await fetch(`${API_URL}?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminToken ? { 'x-admin-token': adminToken } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return true;
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
        version: 2,
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
      const header = ['id', 'hochdeutsch', 'kaerntnerisch', 'quelle', 'datum', 'likes', 'likedBy'];
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

        if (!confirm(`Import fügt ${normalized.length} Einträge hinzu. Fortfahren?`)) {
          return;
        }

        if (remoteEnabled) {
          let ok = 0;
          for (const e of normalized) {
            try {
              await apiCreate(e);
              ok++;
            } catch (err) {
              console.warn('[corpus] import item failed', err);
            }
          }
          entries = await apiList();
          notify(`Import fertig: ${ok}/${normalized.length} Einträge hochgeladen.`, ok ? 'success' : 'error');
        } else {
          entries = normalized;
          saveLocalEntries(entries);
          notify('Backup importiert (lokal).', 'success');
        }

        updateCounter();
        render();
      } catch (err) {
        console.error('[corpus] import failed', err);
        notify('Import fehlgeschlagen: ' + (err?.message || err), 'error');
      } finally {
        if (importFile) importFile.value = '';
      }
    }

    const clientId = getClientId();

    const isAdmin = () => !!(window.Admin && typeof window.Admin.isAdmin === 'function' && window.Admin.isAdmin());

    // Re-render when admin mode changes
    window.addEventListener('adminmodechange', () => {
      render();
    });

    // Abort if main elements are missing
    if (!form || !hdInput || !dialectInput || !listBody) {
      console.warn('[corpus] Required DOM elements not found, corpus feature disabled on this page.');
      return;
    }

    let entries = [];
    let sortMode = (sortSelect && sortSelect.value) ? sortSelect.value : 'top';
    let remoteEnabled = true;

    function updateCounter() {
      if (counterEl) counterEl.textContent = String(entries.length);
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

        const liked = Array.isArray(entry.likedBy) && entry.likedBy.includes(clientId);

        const likeBtn = document.createElement('button');
        likeBtn.type = 'button';
        likeBtn.className = 'btn btn-ghost btn-xs flex items-center gap-2 ' + (liked ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300');
        likeBtn.setAttribute('aria-label', liked ? 'Like entfernen' : 'Like geben');
        // NOTE: Don't use the white-heart emoji (🤍) for the unliked state.
        // It becomes invisible in light mode. Use text hearts that can be styled via CSS.
        const HEART_ON = "\u2665\uFE0E";  // ♥︎ (text-style heart)
        const HEART_OFF = "\u2661";       // ♡ (outline heart)

        likeBtn.innerHTML = `
          <span class="text-base leading-none" aria-hidden="true">${liked ? HEART_ON : HEART_OFF}</span>
          <span class="text-[12px] font-semibold">${entry.likes || 0}</span>
        `;

        likeBtn.addEventListener('click', async function () {
          const target = entries.find(e => e.id === entry.id);
          if (!target) return;

          // Local fallback
          if (!remoteEnabled) {
            const alreadyLiked = target.likedBy.includes(clientId);
            if (alreadyLiked) {
              target.likedBy = target.likedBy.filter(x => x !== clientId);
              target.likes = Math.max(0, (target.likes || 0) - 1);
            } else {
              target.likedBy.push(clientId);
              target.likes = (target.likes || 0) + 1;
            }
            saveLocalEntries(entries);
            render();
            return;
          }

          try {
            likeBtn.disabled = true;
            const updated = await apiToggleLike(entry.id, clientId);
            if (updated) {
              const idx = entries.findIndex(e => e.id === entry.id);
              if (idx >= 0) entries[idx] = updated;
              render();
            }
          } catch (err) {
            console.error('[corpus] toggle like failed', err);
            notify('Like fehlgeschlagen: ' + (err?.message || err), 'error');
          } finally {
            likeBtn.disabled = false;
          }
        });

        likeTd.appendChild(likeBtn);

        const srcTd = document.createElement('td');
        srcTd.className = 'px-2 sm:px-3 py-2 align-top text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line';
        srcTd.textContent = entry.source || '—';

        const metaTd = document.createElement('td');
        metaTd.className = 'px-2 sm:px-3 py-2 align-top text-xs text-slate-500 dark:text-slate-400 text-right whitespace-nowrap';
        const d = new Date(entry.created);
        metaTd.textContent =
          d.toLocaleDateString() + ' ' +
          d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const actionTd = document.createElement('td');
        actionTd.className = 'admin-only px-2 sm:px-3 py-2 align-top text-right';
        if (!isAdmin()) actionTd.classList.add('hidden');

        if (isAdmin()) {
          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn btn-ghost btn-xs text-[11px] text-red-600 dark:text-red-400';
          delBtn.textContent = 'Löschen';

          delBtn.addEventListener('click', async function () {
            if (!isAdmin()) {
              alert('Nur Admin darf Einträge löschen.');
              return;
            }
            if (!confirm('Diesen Eintrag wirklich löschen?')) return;

            if (!remoteEnabled) {
              entries = entries.filter(e => e.id !== entry.id);
              saveLocalEntries(entries);
              render();
              return;
            }

            try {
              // Admin token is required server-side. Store it only in your browser.
              let token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
              if (!token) {
                token = prompt('Admin-Token (für Löschen):');
                if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
              }
              if (!token) {
                notify('Kein Admin-Token gesetzt.', 'error');
                return;
              }

              await apiDelete(entry.id, token);
              entries = entries.filter(e => e.id !== entry.id);
              render();
              updateCounter();
              notify('Eintrag gelöscht.', 'success');
            } catch (err) {
              console.error('[corpus] delete failed', err);
              notify('Löschen fehlgeschlagen: ' + (err?.message || err), 'error');
            }
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

    async function initialLoad() {
      // Try remote first
      try {
        entries = await apiList();
        remoteEnabled = true;
        notify('Community-Korpus: Online-Sync aktiv.', 'success');
      } catch (e) {
        console.warn('[corpus] remote not available, falling back to localStorage', e);
        entries = loadLocalEntries().map(x => ({
          ...x,
          likes: Number.isFinite(x.likes) ? x.likes : 0,
          likedBy: Array.isArray(x.likedBy) ? x.likedBy : []
        }));
        remoteEnabled = false;
        notify('Community-Korpus: Offline-Modus (nur lokal im Browser).', 'info');
      }
      render();
    }

    form.addEventListener('submit', async function (evt) {
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

      // Remote
      if (remoteEnabled) {
        try {
          const inserted = await apiCreate(newEntry);
          if (inserted) entries.push(inserted);
          render();
          notify('Eintrag gespeichert (online).', 'success');
        } catch (err) {
          console.error('[corpus] create failed', err);
          notify('Speichern fehlgeschlagen: ' + (err?.message || err), 'error');
          return;
        }
      } else {
        // Local fallback
        entries.push(newEntry);
        saveLocalEntries(entries);
        render();
        notify('Eintrag gespeichert (lokal).', 'success');
      }

      form.reset();
      hdInput.focus();
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', async function () {
        if (!isAdmin()) {
          alert('Nur Admin darf Einträge löschen.');
          return;
        }
        if (!entries.length) return;
        if (!confirm('Alle Einträge löschen?')) return;

        if (!remoteEnabled) {
          entries = [];
          saveLocalEntries(entries);
          render();
          return;
        }

        // Remote clear: delete items one by one (admin token required)
        try {
          let token = localStorage.getItem(ADMIN_TOKEN_KEY) || '';
          if (!token) {
            token = prompt('Admin-Token (für Alle löschen):');
            if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
          }
          if (!token) {
            notify('Kein Admin-Token gesetzt.', 'error');
            return;
          }

          let ok = 0;
          for (const e of entries.slice()) {
            try {
              await apiDelete(e.id, token);
              ok++;
            } catch (_) {}
          }
          entries = [];
          render();
          updateCounter();
          notify(`Gelöscht: ${ok} Einträge.`, ok ? 'success' : 'error');
        } catch (err) {
          console.error('[corpus] clear failed', err);
          notify('Löschen fehlgeschlagen: ' + (err?.message || err), 'error');
        }
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

    initialLoad();
  });
})();
