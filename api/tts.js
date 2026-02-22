/**
 * Serverless proxy for ElevenLabs TTS (audio generation).
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Serverless proxy for ElevenLabs TTS (audio generation).
// ------------------------------------------------------------

// Vercel Serverless Function: /api/tts
// Proxy to ElevenLabs TTS (keeps API key server-side)


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

function isAllowedVoice(requested) {
  const allow = (process.env.ELEVENLABS_ALLOWED_VOICES || '').trim();
  if (!allow) return true; // no allowlist configured
  const allowed = allow.split(',').map(s => s.trim()).filter(Boolean);
  return allowed.includes(requested);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'ELEVENLABS_API_KEY is not set on the server' }));
    }

    const { text, voiceId } = await readJson(req);
    const t = String(text || '').trim();
    if (!t) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'text missing' }));
    }

    let vid = (process.env.ELEVENLABS_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL').trim();
    if (voiceId && typeof voiceId === 'string' && voiceId.trim()) {
      const reqVid = voiceId.trim();
      if (isAllowedVoice(reqVid)) vid = reqVid;
    }

    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: t,
        voice_settings: { stability: 0.4, similarity_boost: 0.85 },
        model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      }),
    });

    if (!r.ok) {
      const errTxt = await r.text();
      res.statusCode = r.status;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'TTS request failed', details: errTxt }));
    }

    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(buf);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'tts proxy failed' }));
  }
};
