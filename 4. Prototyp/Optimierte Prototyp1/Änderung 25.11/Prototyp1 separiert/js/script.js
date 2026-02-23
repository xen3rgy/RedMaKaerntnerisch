    // --- Simple rules Hochdeutsch -> Kärntnerisch (Mock) ---
    function toKaerntnerisch(text) {
      if (!text) return '';
      const rules = [
        [/guten tag/gi, 'Grias di'],
        [/hallo/gi, 'Servas'],
        [/ich habe/gi, 'I hob'],
        [/ich hab/gi, 'I hob'],
        [/ich bin/gi, 'I bin'],
        [/du bist/gi, 'Du bist'],
        [/nicht/gi, 'ned'],
        [/kein/gi, 'koan'],
        [/klein/gi, 'klaa'],
        [/ganz/gi, 'gonz'],
        [/gut/gi, 'leiwaund'],
        [/sehr/gi, 'voll'],
        [/vielleicht/gi, 'vielleichts'],
        [/was/gi, 'wos'],
        [/wie/gi, 'wia'],
        [/auch/gi, 'aa'],
        [/euch/gi, 'enk'],
        [/euer/gi, 'eich'],
        [/mir/gi, 'ma'],
        [/dir/gi, 'da'],
        [/mit/gi, 'mitn'],
        [/ich/gi, 'I'],
        [/nicht\\s+gewusst/gi, 'ned gwusst'],
        [/sehr gut/gi, 'ur leiwaund'],
      ];
      let out = text;
      rules.forEach(([re, subst]) => { out = out.replace(re, subst); });
      return out;
    }

    // ---------- Übersetzer: chat logic ----------
    const messages = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');

    function addBubble(container, text, role, opts = {}) {
      const div = document.createElement('div');
      if (role === 'user') {
        div.className = 'bubble bubble-user';
      } else if (role === 'assistant') {
        div.className = 'bubble bubble-assistant';
      } else {
        div.className = 'bubble bubble-meta';
      }
      if (opts.asHTML) {
        div.innerHTML = text;
      } else {
        div.textContent = text;
      }
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return div;
    }

    const toastEl = document.getElementById('toast');
    let toastTimeout;

    function showToast(message, tone = 'info') {
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.classList.remove('hidden');
      toastEl.classList.toggle('border-emerald-400', tone === 'success');
      toastEl.classList.toggle('border-amber-400', tone === 'info');
      toastEl.classList.toggle('border-red-400', tone === 'error');
      clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => toastEl.classList.add('hidden'), 4200);
    }

    const apiConfig = {
      key: localStorage.getItem('rk-api-key') || '',
      url: localStorage.getItem('rk-api-url') || '',
      model: localStorage.getItem('rk-api-model') || 'gpt-4o-mini',
      temperature: parseFloat(localStorage.getItem('rk-api-temp') || '0.3'),
    };

    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsClose = document.getElementById('settingsClose');
    const settingsForm = document.getElementById('settingsForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiUrlInput = document.getElementById('apiUrlInput');
    const apiModelInput = document.getElementById('apiModelInput');
    const apiTempInput = document.getElementById('apiTempInput');
    const settingsReset = document.getElementById('settingsReset');

    function applySettingsToForm() {
      if (apiKeyInput) apiKeyInput.value = apiConfig.key;
      if (apiUrlInput) apiUrlInput.value = apiConfig.url;
      if (apiModelInput) apiModelInput.value = apiConfig.model;
      if (apiTempInput) apiTempInput.value = apiConfig.temperature ?? 0.3;
    }

    function openSettings() {
      if (!settingsModal) return;
      settingsModal.classList.remove('hidden');
      settingsModal.classList.add('flex');
      applySettingsToForm();
    }

    function closeSettings() {
      if (!settingsModal) return;
      settingsModal.classList.add('hidden');
      settingsModal.classList.remove('flex');
    }

    settingsBtn?.addEventListener('click', openSettings);
    document.getElementById('settingsHintBtn')?.addEventListener('click', openSettings);
    settingsClose?.addEventListener('click', closeSettings);
    settingsModal?.addEventListener('click', (evt) => {
      if (evt.target === settingsModal) closeSettings();
    });

    settingsForm?.addEventListener('submit', (evt) => {
      evt.preventDefault();
      apiConfig.key = apiKeyInput.value.trim();
      apiConfig.url = apiUrlInput.value.trim();
      apiConfig.model = apiModelInput.value.trim() || 'gpt-4o-mini';
      apiConfig.temperature = parseFloat(apiTempInput.value || '0.3');
      if (Number.isNaN(apiConfig.temperature)) apiConfig.temperature = 0.3;
      localStorage.setItem('rk-api-key', apiConfig.key);
      localStorage.setItem('rk-api-url', apiConfig.url);
      localStorage.setItem('rk-api-model', apiConfig.model);
      localStorage.setItem('rk-api-temp', apiConfig.temperature.toString());
      closeSettings();
      showToast('API‑Einstellungen gespeichert.', 'success');
    });

    settingsReset?.addEventListener('click', () => {
      apiConfig.key = '';
      apiConfig.url = '';
      apiConfig.model = 'gpt-4o-mini';
      apiConfig.temperature = 0.3;
      localStorage.removeItem('rk-api-key');
      localStorage.removeItem('rk-api-url');
      localStorage.removeItem('rk-api-model');
      localStorage.removeItem('rk-api-temp');
      applySettingsToForm();
      showToast('API‑Einstellungen zurückgesetzt. Fallback‑Regeln werden verwendet.', 'info');
    });

    applySettingsToForm();

    async function callLLM(messages, { purpose } = {}) {
      if (!apiConfig.key) {
        throw new Error('Kein API‑Key konfiguriert. Öffne „API Setup“ und trage einen Schlüssel ein.');
      }
      const endpoint = (apiConfig.url || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
      const payload = {
        model: apiConfig.model || 'gpt-4o-mini',
        messages,
        temperature: typeof apiConfig.temperature === 'number' && !Number.isNaN(apiConfig.temperature)
          ? apiConfig.temperature : 0.3,
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiConfig.key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error('API‑Fehler (' + res.status + '): ' + errTxt);
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('Keine Antwort vom Modell erhalten.');
      return content;
    }

let DIALECT_SYSTEM_PROMPT = "";
let DIALECT_LEXICON = {};
let DIALECT_RULES = {};
let DIALECT_EXAMPLES = "";

async function loadDialectResources() {
  DIALECT_SYSTEM_PROMPT = await fetch("system_prompt.txt").then(r => r.text());
  DIALECT_LEXICON = await fetch("dialect_lexicon.json").then(r => r.json());
  DIALECT_RULES = await fetch("dialect_rules.json").then(r => r.json());
  DIALECT_EXAMPLES = await fetch("example_sentences.txt").then(r => r.text());
}
const dialectReady = loadDialectResources();

function buildLexiconText() {
  const entries = Object.entries(DIALECT_LEXICON || {});
  if (!entries.length) return '';
  const lines = entries.map(([hd, dial]) => `"${hd}" -> "${dial}"`);
  return (
    'FESTES WÖRTERLEXIKON (immer genau so verwenden, keine Alternativen):\n' +
    lines.join('\n')
  );
}

function buildExamplesText() {
  if (!DIALECT_EXAMPLES) return '';
  return 'BEISPIELE FÜR DIALEKT-SÄTZE:\n' + DIALECT_EXAMPLES;
}





    const translatorSystemPrompt = 'Du bist ein hochpräziser Übersetzer für mittelkärntnerischen Dialekt. Gib nur den übersetzten Satz zurück, keine Erklärungen. Pflege informellen, warmherzigen Ton, bleib logisch.';
    const chatSystemPrompt = DIALECT_SYSTEM_PROMPT;

    async function translateHDToDialekt(text) {
      const msgs = [
        { role: 'system', content: translatorSystemPrompt },
        { role: 'user', content: 'Übersetze ins mittelkärntnerische Dialektdeutsch. Gib nur den Dialekt zurück. Text: "' + text + '"' },
      ];
      return callLLM(msgs, { purpose: 'translate' });
    }

async function chatWithDialect(history) {
  await dialectReady;

  let sysPrompt =
    DIALECT_SYSTEM_PROMPT &&
    DIALECT_SYSTEM_PROMPT.trim().length > 0
      ? DIALECT_SYSTEM_PROMPT.trim()
      : 'Du bist ein KI-Modell, das konsequent im mittelkärntnerischen Dialekt (Villach/Klagenfurt) antwortet. Antwort immer im Dialekt, ohne Erklärungen.';

  const lexText = buildLexiconText();
  const exText = buildExamplesText();

  if (lexText) {
    sysPrompt += '\n\n' + lexText;
  }
  if (exText) {
    sysPrompt += '\n\n' + exText;
  }

  const msgs = [{ role: 'system', content: sysPrompt }, ...history];
  return callLLM(msgs, { purpose: 'chat' });
}





    function createThinking(container) {
      return addBubble(container, '<span class="spinner"></span><span class="align-middle">… denk nach</span>', 'assistant', { asHTML: true });
    }

    async function sendMessage() {
      const t = input.value.trim();
      if (!t) return;
      addBubble(messages, t, 'user');
      input.value = '';
      const thinking = createThinking(messages);
      try {
        const translated = await translateHDToDialekt(t);
        messages.removeChild(thinking);
        addBubble(messages, translated, 'assistant');
      } catch (err) {
        console.error(err);
        messages.removeChild(thinking);
        const fallback = toKaerntnerisch(t) || 'I bin ma ned sicher – probier da Key in da API‑Konfiguration ei zum tragen.';
        addBubble(messages, fallback, 'assistant');
        showToast(err.message, 'error');
      }
    }

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn?.addEventListener('click', sendMessage);

    document.querySelectorAll('.ex-btn').forEach(btn => {
      btn.addEventListener('click', () => { input.value = btn.dataset.ex; input.focus(); });
    });

    // ---------- Audio mock ----------
    const recBtn = document.getElementById('recBtn');
    const sttBtn = document.getElementById('sttBtn');
    const ttsBtn = document.getElementById('ttsBtn');
    const sttText = document.getElementById('sttText');
    const dialektText = document.getElementById('dialektText');
    let recording = false;

    recBtn?.addEventListener('click', () => {
      recording = !recording;
      recBtn.textContent = recording ? '● Aufnahme läuft (Mock)' : 'Aufnahme starten (Mock)';
      recBtn.classList.toggle('btn-recording', recording);
      recBtn.setAttribute('aria-pressed', recording ? 'true' : 'false');
    });

    sttBtn?.addEventListener('click', () => {
      const t = 'Hallo, ich bin gerade in Villach und brauche eine Auskunft.';
      sttText.textContent = t;
      dialektText.textContent = toKaerntnerisch(t);
    });

    ttsBtn?.addEventListener('click', () => {
      alert('TTS (Mock) – Dialekt wird abgespielt');
    });

    // ---------- Dialekt‑Chat: intent-based logic ----------
    const chatMsgs = document.getElementById('chatMsgs');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatResetBtn = document.getElementById('chatReset');
    const chatIntroText = chatMsgs?.querySelector('div')?.textContent?.trim() || 'Frag wos – i probier gscheit zu antwortn (im Dialekt).';

    const lokaltipps = [
      'Geh am Drauufer spaziern und hol da a Eis – simpel, oba guat.',
      'A gscheite Hauskost beim bodenständign Wirt – Preis passt, Portionen aa.',
      'Villacher Alpenstraße auffi – Aussicht is leiwaund (wennst a Auto host).',
      'Kleiner Stadtbummel am Hauptplatz, dann Kaffee – klassisch und gemütlich.'
    ];
    const studium = [
      'Lern täglich 45–60 Minuten fokussiert, ned marathonn.',
      'Schreib da a kurze Zusammenfassung nach jeder Einheit – bleibt bessa picken.',
      'Frag de Prof früh, wenn wos unklar is – spart da Nerven.',
      'Mach 2–3 Übungsbeispiele statt 20 Seiten Theorie lesen.'
    ];

    function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
    function timeNow(){ const d=new Date(); return d.toLocaleTimeString(); }
    function weekday(){ return ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][new Date().getDay()]; }

    function replyFor(text) {
      const t = text.toLowerCase();

      // Small knowledge base / intents
      if (/hallo|servus|gria[sß]|hi|hey/.test(t)) return 'Servas! Wos gibt’s?';
      if (/wie geht/.test(t)) return 'Jo passt, danke – a bissl stressig, oba geht scho. Wia schaugts bei da aus?';
      if (/wetter|regen|sonne|temperatur/.test(t)) return 'I bin ka Wetterfrosch, oba nimm a Joppe mit – in Kärnten wechselt’s gschwind.';
      if (/villach|klagenfurt|kärnten/.test(t)) return 'In '+(t.includes('villach')?'Villach':'Kärnten')+' geht imma wos: '+pick(lokaltipps);
      if (/essen|lokal|restaurant|mittag|mittagessen|abendessen/.test(t)) return 'I würd a bodenständign Wirt empfehlen: '+pick(lokaltipps);
      if (/hilfe|kannst du.*helfen|problem|fehler|bug/.test(t)) return 'Sicher. Erzähl gnaue – wos geht ned? Gemma Schritt für Schritt durch.';
      if (/studium|fh|prof|prüfung|lernen|examen|klausur/.test(t)) return 'Für’s Studium: '+pick(studium);
      if (/motivation|keine lust|prokrastinier/.test(t)) return 'Kloa Tipp: 10‑Minuten‑Regel. Fang klan an – meistens bleibst dann eh dabei.';
      if (/zeit|uhr|spät/.test(t)) return 'Es is grad '+timeNow()+' am '+weekday()+'. Pack zam, mach a Pause.';
      if (/danke|thx|dankeschön/.test(t)) return 'Gern gschehn! Wenn no wos is, sog einfach.';
      if (/sport|laufen|fitness|training/.test(t)) return 'A lockere 20‑Minuten‑Rundn reicht. Wichtig is: regelmäßig, ned extrem.';
      if (/projekt|chatbot|dialekt|korpus/.test(t)) return 'Fokus: Mittelkärntnerisch, klares Regelwerk und a Handvoll Beispiel‑Sätze, dann iteriern.';
      if (/idee|vorschlag|was soll ich machen/.test(t)) return 'Pick a klans Ziel für heit und bring des bis zum Ende. Danach belohn di – Kaffee oder Spaziern.';

      // Fallback
      return 'Klingt spannend. I würd sagen: mach langsam, denk a bissl nach und wennst magst, schaun ma glei drüber.';
    }

    function chatAdd(container, text, role) {
      addBubble(container, text, role);
    }

    let chatHistory = [];

    function sendChat() {
      const t = chatInput.value.trim();
      if (!t) return;
      chatAdd(chatMsgs, t, 'user');
      chatInput.value = '';
      chatHistory.push({ role: 'user', content: t });
      const thinking = createThinking(chatMsgs);
      chatMsgs.scrollTop = chatMsgs.scrollHeight;
      (async () => {
        try {
          const answer = await chatWithDialect(chatHistory);
          chatHistory.push({ role: 'assistant', content: answer });
          chatMsgs.removeChild(thinking);
          addBubble(chatMsgs, answer, 'assistant');
        } catch (err) {
          console.error(err);
          chatMsgs.removeChild(thinking);
          const fallback = replyFor(t);
          chatHistory.push({ role: 'assistant', content: fallback });
          addBubble(chatMsgs, fallback, 'assistant');
          showToast(err.message, 'error');
        }
      })();
    }

    chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
    chatSend?.addEventListener('click', sendChat);
    chatResetBtn?.addEventListener('click', () => {
      chatHistory = [];
      if (!chatMsgs) return;
      chatMsgs.innerHTML = '';
      addBubble(chatMsgs, chatIntroText, 'meta');
      showToast('Chat zurückgesetzt.', 'info');
    });
    document.querySelectorAll('.chat-ex').forEach(btn => { btn.addEventListener('click', () => { chatInput.value = btn.dataset.ex; chatInput.focus(); }); });

    // --- Tabs toggle ---
    const tabTrans = document.getElementById('tabTrans');
    const tabChat = document.getElementById('tabChat');
    const panelTrans = document.getElementById('panelTrans');
    const panelChat = document.getElementById('panelChat');

    function activate(tab) {
      if (tab === 'trans') {
        tabTrans.classList.add('tab-active');
        tabChat.classList.remove('tab-active');
        panelTrans.classList.remove('hidden');
        panelChat.classList.add('hidden');
      } else {
        tabChat.classList.add('tab-active');
        tabTrans.classList.remove('tab-active');
        panelChat.classList.remove('hidden');
        panelTrans.classList.add('hidden');
      }
    }
    tabTrans?.addEventListener('click', () => activate('trans'));
    tabChat?.addEventListener('click', () => activate('chat'));