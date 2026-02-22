// Vercel Serverless Function: /api/chat
// Proxy to OpenAI Chat Completions (keeps API key server-side)


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

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const { model, messages, temperature } = await readJson(req);

    if (!process.env.OPENAI_API_KEY) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set on the server' }));
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'messages missing' }));
    }

    const payload = {
      model: model || 'gpt-4o',
      messages,
      temperature: typeof temperature === 'number' && !Number.isNaN(temperature) ? temperature : 0.3,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const txt = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(txt);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'chat proxy failed' }));
  }
};
