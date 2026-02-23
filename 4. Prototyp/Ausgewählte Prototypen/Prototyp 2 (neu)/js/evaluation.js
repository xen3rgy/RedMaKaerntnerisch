/*
  Evaluation helper for the bachelor project.
  Stores structured feedback locally (localStorage) and allows export.

  Data model:
  { id, createdAt, mode, input, output, authenticity, clarity, note }
*/

(() => {
  const STORAGE_KEY = 'rk-eval-log';

  function isAdmin() {
    try {
      return typeof window.Admin?.isAdmin === 'function' ? window.Admin.isAdmin() : false;
    } catch (_) {
      return false;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function uid() {
    return 'eval_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
  }

  function safeToast(msg, tone) {
    try {
      if (typeof window.showToast === 'function') return window.showToast(msg, tone);
    } catch (_) {}
    console.log('[Eval]', msg);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('Eval load failed:', e);
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Eval save failed:', e);
      safeToast('Konn Feedback ned speichern (Storage voll?).', 'error');
    }
  }

  function toCsv(rows) {
    const esc = (v) => {
      const s = String(v ?? '');
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const header = ['id', 'createdAt', 'mode', 'authenticity', 'clarity', 'input', 'output', 'note'];
    const lines = [header.map(esc).join(',')];

    for (const r of rows) {
      const line = [
        r.id,
        r.createdAt,
        r.mode,
        r.authenticity,
        r.clarity,
        r.input,
        r.output,
        r.note
      ].map(esc).join(',');
      lines.push(line);
    }

    return lines.join('\n');
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString('de-AT', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return iso;
    }
  }

  // Public API (auto-fill from other modules)
  let lastSample = { mode: 'translate_text', input: '', output: '' };

  function setLastSample(sample) {
    if (!sample || typeof sample !== 'object') return;

    lastSample = {
      mode: sample.mode || lastSample.mode,
      input: sample.input ?? lastSample.input,
      output: sample.output ?? lastSample.output
    };

    const modeEl = document.getElementById('evalMode');
    const inEl = document.getElementById('evalInput');
    const outEl = document.getElementById('evalOutput');

    if (modeEl && lastSample.mode) modeEl.value = lastSample.mode;
    if (inEl) inEl.value = String(lastSample.input || '');
    if (outEl) outEl.value = String(lastSample.output || '');
  }

  function updateUi() {
    const rows = load();
    const countEl = document.getElementById('evalCount');
    if (countEl) countEl.textContent = String(rows.length);

    const tbody = document.getElementById('evalRecent');
    if (!tbody) return;

    const recent = rows.slice(-8).reverse();
    tbody.innerHTML = recent.map(r => {
      return `
        <tr class="border-b border-slate-200/40 dark:border-slate-700/40">
          <td class="py-2 pr-2 text-xs text-gray-500 dark:text-gray-400">${fmtTime(r.createdAt)}</td>
          <td class="py-2 pr-2 text-xs">${(r.mode || '').replace(/_/g, ' ')}</td>
          <td class="py-2 pr-2 text-xs">${r.authenticity || '—'}</td>
          <td class="py-2 pr-2 text-xs">${r.clarity || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  function exportJson() {
    if (!isAdmin()) {
      safeToast('Export ist nur im Admin-Modus verfügbar.', 'error');
      return;
    }
    const rows = load();
    const payload = {
      exportedAt: nowIso(),
      count: rows.length,
      rows
    };
    download(`rk_evaluation_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2), 'application/json');
    safeToast('Evaluation exportiert (JSON).', 'success');
  }

  function exportCsv() {
    if (!isAdmin()) {
      safeToast('Export ist nur im Admin-Modus verfügbar.', 'error');
      return;
    }
    const rows = load();
    download(`rk_evaluation_${new Date().toISOString().slice(0,10)}.csv`, toCsv(rows), 'text/csv');
    safeToast('Evaluation exportiert (CSV).', 'success');
  }

  function clearAll() {
    if (!isAdmin()) {
      safeToast('Diese Funktion ist nur im Admin-Modus verfügbar.', 'error');
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    safeToast('Evaluation zurückgesetzt.', 'success');
    updateUi();
  }

  function onReady() {
    // Auto-fill if there is already something in lastSample
    setLastSample(lastSample);

    const form = document.getElementById('evalForm');
    const btnJson = document.getElementById('evalExportJson');
    const btnCsv = document.getElementById('evalExportCsv');
    const btnClear = document.getElementById('evalClear');

    if (btnJson) btnJson.addEventListener('click', exportJson);
    if (btnCsv) btnCsv.addEventListener('click', exportCsv);
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        const ok = confirm('Evaluation wirklich komplett löschen?');
        if (ok) clearAll();
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();

        const mode = document.getElementById('evalMode')?.value || lastSample.mode || 'translate_text';
        const input = (document.getElementById('evalInput')?.value || '').trim();
        const output = (document.getElementById('evalOutput')?.value || '').trim();
        const authenticity = document.getElementById('evalAuthenticity')?.value || '';
        const clarity = document.getElementById('evalClarity')?.value || '';
        const note = (document.getElementById('evalNote')?.value || '').trim();

        if (!input || !output) {
          safeToast('Bitte Eingabe und Ausgabe ausfüllen.', 'error');
          return;
        }

        const row = {
          id: uid(),
          createdAt: nowIso(),
          mode,
          authenticity,
          clarity,
          input,
          output,
          note
        };

        const rows = load();
        rows.push(row);
        save(rows);

        // reset only ratings + note (keep sample text for multiple raters)
        const aEl = document.getElementById('evalAuthenticity');
        const cEl = document.getElementById('evalClarity');
        const nEl = document.getElementById('evalNote');
        if (aEl) aEl.value = '';
        if (cEl) cEl.value = '';
        if (nEl) nEl.value = '';

        safeToast('Feedback gespeichert.', 'success');
        updateUi();
      });
    }

    updateUi();
  }

  document.addEventListener('DOMContentLoaded', onReady);

  window.RK_Eval = {
    setLastSample,
    exportJson,
    exportCsv,
    clearAll
  };
})();
