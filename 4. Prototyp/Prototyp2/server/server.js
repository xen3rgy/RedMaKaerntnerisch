import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('[WARN] OPENAI_API_KEY ist nicht gesetzt. Live-Mode wird fehlschlagen.');
}

app.post('/chat', async (req, res) => {
  try {
    const { message, model = 'gpt-4o-mini', system = 'You are a helpful assistant.' } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message required' });
    }
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });
    }

    // Minimal Chat Completions call (compatible endpoint)
    const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: message }
        ],
        temperature: 0.3
      })
    });

    if (!apiRes.ok) {
      const text = await apiRes.text().catch(()=>'');
      return res.status(apiRes.status).json({ error: 'upstream error', details: text });
    }
    const data = await apiRes.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'proxy failure' });
  }
});

app.listen(PORT, () => {
  console.log(`[proxy] listening on http://localhost:${PORT}`);
});
