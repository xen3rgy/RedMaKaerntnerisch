// Lightweight LLM client for 'live' mode via your local proxy (server/server.js)
async function llmAnswer(userText) {
  if (AppConfig.mode !== 'live') {
    throw new Error('LLM called in demo mode');
  }
  const res = await fetch(AppConfig.live.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userText,
      model: AppConfig.live.model,
      system: AppConfig.live.system_prompt
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>'');
    throw new Error('Proxy error: ' + res.status + ' ' + t);
  }
  const data = await res.json();
  // expected shape: { text: "..." }
  if (!data || typeof data.text !== 'string') {
    throw new Error('Unexpected proxy response');
  }
  return data.text;
}
