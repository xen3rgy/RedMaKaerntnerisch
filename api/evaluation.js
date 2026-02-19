// Vercel Serverless Function: /api/evaluation
// Persists evaluation/feedback entries in Supabase (server-side only).

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

function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function safeSlice(value, maxLen) {
  if (value == null) return null;
  return String(value).slice(0, maxLen);
}

async function supabaseFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    const err = new Error('Supabase env missing (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)');
    err.statusCode = 500;
    throw err;
  }

  return fetch(url.replace(/\/$/, '') + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...headers,
    },
    body,
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      // Latest first.
      const r = await supabaseFetch(
        '/rest/v1/evaluation_entries?select=id,created_at,mode,input_text,output_text,dialect_authenticity,clarity,ux,speed,category,note&order=created_at.desc',
        { method: 'GET', headers: { Accept: 'application/json' } }
      );
      const data = await r.json();
      if (!r.ok) return json(res, r.status, { error: 'fetch failed', details: data });
      return json(res, 200, Array.isArray(data) ? data : []);
    }

    if (req.method === 'POST') {
      const body = await readJson(req);

      const mode = String(body.mode || '').trim();
      if (!mode) return json(res, 400, { error: 'mode is required' });

      const input_text = safeSlice(body.input_text, 4000);
      const output_text = safeSlice(body.output_text, 4000);

      const row = {
        ...(body.id ? { id: String(body.id) } : {}),
        created_at: body.created_at ? String(body.created_at) : undefined,
        mode,
        input_text,
        output_text,
        dialect_authenticity: clampInt(body.dialect_authenticity, 1, 5),
        clarity: clampInt(body.clarity, 1, 5),
        ux: clampInt(body.ux, 1, 5),
        speed: clampInt(body.speed, 1, 5),
        category: safeSlice(body.category, 200),
        note: safeSlice(body.note, 2000),
      };

      Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);

      const r = await supabaseFetch('/rest/v1/evaluation_entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify(row),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, r.status, { error: 'insert failed', details: data });
      return json(res, 200, Array.isArray(data) ? data[0] : data);
    }

    return json(res, 405, { error: 'method not allowed' });
  } catch (err) {
    return json(res, err.statusCode || 500, { error: String(err.message || err) });
  }
};
