/**
 * Evaluation/feedback UI (submit + render) and export helpers for admin.
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Evaluation/feedback UI (submit + render) and export helpers for admin.
// ------------------------------------------------------------

/*
  Evaluation helper for the bachelor project.
  Stores structured feedback locally (localStorage) and allows export.

  Data model:
  { id, createdAt, mode, input, output, authenticity, clarity, usability, speed, tag, note }
*/

(() => {
  const STORAGE_KEY = 'rk-eval-log';
  const CLOUD_ENDPOINT = '/api/evaluation';

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
    // Use a real UUID so Supabase can store it as uuid primary key.
    // Fallback keeps local-only IDs; the server will ignore non-UUID ids.
    try {
      if (crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (_) {}
    return 'eval_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
  }

  function isUuid(v) {
    return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

  async function cloudInsert(localRow) {
    // Best-effort: if /api isn't available, we just keep local storage.
    try {
      const payload = {
        // Only send id if it's a UUID (table column is uuid).
        ...(isUuid(localRow.id) ? { id: localRow.id } : {}),
        created_at: localRow.createdAt,
        mode: localRow.mode,
        input_text: localRow.input,
        output_text: localRow.output,
        dialect_authenticity: localRow.authenticity ? Number(localRow.authenticity) : null,
        clarity: localRow.clarity ? Number(localRow.clarity) : null,
        ux: localRow.usability ? Number(localRow.usability) : null,
        speed: localRow.speed ? Number(localRow.speed) : null,
        category: localRow.tag || null,
        note: localRow.note || null,
      };

      const res = await fetch(CLOUD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.warn('[Eval] Cloud insert failed:', res.status, t);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('[Eval] Cloud insert error:', e);
      return false;
    }
  }

  async function cloudFetchAll() {
    try {
      const res = await fetch(CLOUD_ENDPOINT, { method: 'GET' });
      if (!res.ok) return [];
      const rows = await res.json();
      if (!Array.isArray(rows)) return [];
      return rows
        .map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          mode: r.mode,
          authenticity: r.dialect_authenticity ?? '',
          clarity: r.clarity ?? '',
          usability: r.ux ?? '',
          speed: r.speed ?? '',
          tag: r.category ?? '',
          input: r.input_text ?? '',
          output: r.output_text ?? '',
          note: r.note ?? '',
        }))
        .filter((x) => x.id);
    } catch (_) {
      return [];
    }
  }

  function mergeRows(localRows, cloudRows) {
    const byId = new Map();
    (Array.isArray(localRows) ? localRows : []).forEach((r) => r?.id && byId.set(r.id, r));
    (Array.isArray(cloudRows) ? cloudRows : []).forEach((r) => r?.id && byId.set(r.id, r));
    // keep same ordering logic as existing UI (oldest -> newest)
    return Array.from(byId.values()).sort((a, b) => {
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return da - db;
    });
  }

  async function syncFromCloud() {
    const cloud = await cloudFetchAll();
    if (!cloud.length) return false;
    const local = load();
    const merged = mergeRows(local, cloud);
    save(merged);
    return true;
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

    const header = ['id', 'createdAt', 'mode', 'authenticity', 'clarity', 'usability', 'speed', 'tag', 'input', 'output', 'note'];
    const lines = [header.map(esc).join(',')];

    for (const r of rows) {
      const line = [
        r.id,
        r.createdAt,
        r.mode,
        r.authenticity,
        r.clarity,
        r.usability,
        r.speed,
        r.tag,
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

  function normalizeMode(mode, modeEl) {
    let m = String(mode || '').trim();
    if (!m) return '';
    if (m.endsWith('_fallback')) m = m.slice(0, -'_fallback'.length);
    if (modeEl) {
      const ok = Array.from(modeEl.options || []).some(o => o.value === m);
      if (!ok) return modeEl.value || 'translate_text';
    }
    return m;
  }

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

    if (modeEl && lastSample.mode) modeEl.value = normalizeMode(lastSample.mode, modeEl);
    if (inEl) inEl.value = String(lastSample.input || '');
    if (outEl) outEl.value = String(lastSample.output || '');
  }

  function updateUi() {
    const rows = load();
    const countEl = document.getElementById('evalCount');
    if (countEl) countEl.textContent = String(rows.length);

    const avgAuthEl = document.getElementById('evalAvgAuth');
    const avgClarityEl = document.getElementById('evalAvgClarity');
    const avgUsabilityEl = document.getElementById('evalAvgUsability');
    const avgSpeedEl = document.getElementById('evalAvgSpeed');

    const avg = (key) => {
      const vals = rows.map(r => Number(r[key])).filter(v => Number.isFinite(v) && v > 0);
      if (!vals.length) return '—';
      const s = vals.reduce((a,b) => a + b, 0) / vals.length;
      return s.toFixed(2);
    };

    if (avgAuthEl) avgAuthEl.textContent = avg('authenticity');
    if (avgClarityEl) avgClarityEl.textContent = avg('clarity');
    if (avgUsabilityEl) avgUsabilityEl.textContent = avg('usability');
    if (avgSpeedEl) avgSpeedEl.textContent = avg('speed');

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
          <td class="py-2 pr-2 text-xs">${r.usability || '—'}</td>
          <td class="py-2 pr-2 text-xs">${r.speed || '—'}</td>
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

        const modeEl = document.getElementById('evalMode');
        const selectedMode = modeEl?.value || 'translate_text';
        const mode = (lastSample?.mode && String(lastSample.mode).endsWith('_fallback') && normalizeMode(lastSample.mode, modeEl) === selectedMode)
          ? lastSample.mode
          : selectedMode;

        const input = (document.getElementById('evalInput')?.value || '').trim();
        const output = (document.getElementById('evalOutput')?.value || '').trim();
        const authenticity = document.getElementById('evalAuthenticity')?.value || '';
        const clarity = document.getElementById('evalClarity')?.value || '';
        const usability = document.getElementById('evalUsability')?.value || '';
        const speed = document.getElementById('evalSpeed')?.value || '';
        const tag = document.getElementById('evalTag')?.value || '';
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
          usability,
          speed,
          tag,
          input,
          output,
          note
        };

        const rows = load();
        rows.push(row);
        save(rows);

        // Push to Supabase (if backend exists). Do not block UI.
        cloudInsert(row).then((ok) => {
          if (!ok) return;
          // Merge server state back into local so admin view is consistent across devices.
          syncFromCloud().then((changed) => {
            if (changed) updateUi();
          });
        });

        // reset only ratings + tag + note (keep sample text for multiple raters)
        const aEl = document.getElementById('evalAuthenticity');
        const cEl = document.getElementById('evalClarity');
        const uEl = document.getElementById('evalUsability');
        const sEl = document.getElementById('evalSpeed');
        const tEl = document.getElementById('evalTag');
        const nEl = document.getElementById('evalNote');
        if (aEl) aEl.value = '';
        if (cEl) cEl.value = '';
        if (uEl) uEl.value = '';
        if (sEl) sEl.value = '';
        if (tEl) tEl.value = '';
        if (nEl) nEl.value = '';

        safeToast('Feedback gespeichert.', 'success');
        updateUi();
      });
    }

    updateUi();
    // Merge cloud entries on load (no-op if /api isn't available)
    syncFromCloud().then((changed) => {
      if (changed) updateUi();
    });
  }

  document.addEventListener('DOMContentLoaded', onReady);

  window.RK_Eval = {
    setLastSample,
    exportJson,
    exportCsv,
    clearAll
  };
})();
