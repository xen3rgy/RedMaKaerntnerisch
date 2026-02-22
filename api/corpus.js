/**
 * Serverless API for Supabase corpus entries (read/write/like).
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Serverless API for Supabase corpus entries (read/write/like).
// ------------------------------------------------------------

// Vercel Serverless Function: /api/corpus
// Persists the community corpus in Supabase (server-side only).


async function readJson(req) {
  if (req && req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function mapRowToEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    hd: row.hd,
    dialect: row.dialect,
    source: row.source || '',
    created: row.created,
    likes: Number.isFinite(row.likes) ? row.likes : 0,
    likedBy: Array.isArray(row.liked_by) ? row.liked_by : [],
  };
}

function mapEntryToRow(entry) {
  return {
    id: entry.id,
    hd: entry.hd,
    dialect: entry.dialect,
    source: entry.source || '',
    created: entry.created,
    likes: Number.isFinite(entry.likes) ? entry.likes : 0,
    liked_by: Array.isArray(entry.likedBy) ? entry.likedBy : [],
  };
}

async function supabaseFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    const err = new Error('Supabase env missing (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    err.statusCode = 500;
    throw err;
  }

  const r = await fetch(url.replace(/\/$/, '') + path, {
    method,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      ...headers,
    },
    body,
  });

  return r;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const r = await supabaseFetch(
        '/rest/v1/corpus_entries?select=id,hd,dialect,source,created,likes,liked_by&order=created.desc',
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );
      const data = await r.json();
      if (!r.ok) return json(res, r.status, { error: 'fetch failed', details: data });
      return json(res, 200, (Array.isArray(data) ? data.map(mapRowToEntry).filter(Boolean) : []));
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      const hd = String(body.hd || '').trim();
      const dialect = String(body.dialect || '').trim();
      const id = String(body.id || '').trim();

      if (!id || !hd || !dialect) {
        return json(res, 400, { error: 'id, hd and dialect are required' });
      }

      // Basic sanity limits (prevents abuse / huge payloads)
      if (hd.length > 400 || dialect.length > 400) {
        return json(res, 400, { error: 'Text too long' });
      }

      const entry = {
        id,
        hd,
        dialect,
        source: String(body.source || '').trim().slice(0, 200),
        created: (body.created ? String(body.created) : new Date().toISOString()),
        likes: 0,
        likedBy: [],
      };

      const row = mapEntryToRow(entry);

      const r = await supabaseFetch('/rest/v1/corpus_entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(row),
      });

      const data = await r.json();
      if (!r.ok) return json(res, r.status, { error: 'insert failed', details: data });
      const mapped = Array.isArray(data) ? data.map(mapRowToEntry) : [mapRowToEntry(data)];
      return json(res, 200, mapped.filter(Boolean));
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (body.action !== 'toggle_like') {
        return json(res, 400, { error: 'Unsupported action' });
      }

      const id = String(body.id || '').trim();
      const clientId = String(body.clientId || '').trim();
      if (!id || !clientId) return json(res, 400, { error: 'id and clientId required' });

      // Load current row
      const getR = await supabaseFetch(
        `/rest/v1/corpus_entries?select=id,likes,liked_by,hd,dialect,source,created&id=eq.${encodeURIComponent(id)}`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );

      const rows = await getR.json();
      if (!getR.ok) return json(res, getR.status, { error: 'fetch failed', details: rows });
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row) return json(res, 404, { error: 'not found' });

      const likedBy = Array.isArray(row.liked_by) ? row.liked_by.slice() : [];
      let likes = Number.isFinite(row.likes) ? row.likes : 0;

      const idx = likedBy.indexOf(clientId);
      if (idx >= 0) {
        likedBy.splice(idx, 1);
        likes = Math.max(0, likes - 1);
      } else {
        likedBy.push(clientId);
        likes = likes + 1;
      }

      const patchR = await supabaseFetch(`/rest/v1/corpus_entries?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ likes, liked_by: likedBy }),
      });

      const updated = await patchR.json();
      if (!patchR.ok) return json(res, patchR.status, { error: 'update failed', details: updated });
      const mapped = Array.isArray(updated) ? updated.map(mapRowToEntry) : [mapRowToEntry(updated)];
      return json(res, 200, mapped.filter(Boolean));
    }

    if (req.method === 'DELETE') {
      const adminToken = req.headers['x-admin-token'];
      const expected = process.env.CORPUS_ADMIN_TOKEN;
      if (!expected || !adminToken || String(adminToken) !== String(expected)) {
        return json(res, 401, { error: 'Unauthorized' });
      }

      const urlObj = new URL(req.url, 'http://localhost');
      const id = urlObj.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'id required' });

      const delR = await supabaseFetch(`/rest/v1/corpus_entries?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' },
      });

      if (!delR.ok) {
        const d = await delR.text();
        return json(res, delR.status, { error: 'delete failed', details: d });
      }
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const status = e?.statusCode || 500;
    return json(res, status, { error: e?.message || 'server error' });
  }
};
