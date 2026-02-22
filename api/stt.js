/**
 * Serverless proxy for OpenAI Whisper STT (audio transcription).
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Serverless proxy for OpenAI Whisper STT (audio transcription).
// ------------------------------------------------------------

// Vercel Serverless Function: /api/stt
// Proxy to OpenAI Whisper (keeps API key server-side)


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
    if (!process.env.OPENAI_API_KEY) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'OPENAI_API_KEY is not set on the server' }));
    }

    const { audioBase64, mimeType, language } = await readJson(req);
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'audioBase64 missing' }));
    }

    const buffer = Buffer.from(audioBase64, 'base64');
    const mt = (typeof mimeType === 'string' && mimeType.trim()) ? mimeType.trim() : 'audio/webm';

    // Node 18+ supports Blob/FormData globally.
    const blob = new Blob([buffer], { type: mt });
    const fd = new FormData();
    fd.append('file', blob, 'audio.webm');
    fd.append('model', 'whisper-1');
    if (language) fd.append('language', String(language));

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: fd,
    });

    const txt = await r.text();
    res.statusCode = r.status;
    res.setHeader('Content-Type', 'application/json');
    return res.end(txt);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'stt proxy failed' }));
  }
};
