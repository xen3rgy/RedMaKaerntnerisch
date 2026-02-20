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
        [/nicht\\s+gewusst/gi, 'ned gwusst'],
        [/nicht/gi, 'ned'],
        [/kein/gi, 'kan'],
        [/klein/gi, 'klan'],
        [/ganz/gi, 'gonz'],
        [/sehr gut/gi, 'ur leiwaund'],
        [/gut/gi, 'guat'],
        [/sehr/gi, 'voll'],
        [/was/gi, 'wos'],
        [/wie/gi, 'wie'],
        [/auch/gi, 'a'],
        [/euch/gi, 'eich'],
        [/euer/gi, 'eia'],
        [/mir/gi, 'mia'],
        [/dir/gi, 'dir'],
        [/ich/gi, 'I'],
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
    const openaiKeyInput = document.getElementById('openaiKeyInput');
    const apiUrlInput = document.getElementById('apiUrlInput');
    const apiModelInput = document.getElementById('apiModelInput');
    const apiTempInput = document.getElementById('apiTempInput');
    const settingsReset = document.getElementById('settingsReset');

    const elevenKeyInput = document.getElementById("elevenKeyInput");
const elevenVoiceInput = document.getElementById("elevenVoiceInput");

    // --- Security UX: mask secret inputs and block copy/cut/context menu (UI only) ---
    function lockSecretInput(el) {
      if (!el) return;
      try {
        el.setAttribute("type", "password");
        el.setAttribute("autocomplete", "off");
        // Prevent copying secrets from the input field (does not protect against DevTools).
        ["copy", "cut", "dragstart"].forEach((evt) => {
          el.addEventListener(evt, (e) => e.preventDefault());
        });
        el.addEventListener("contextmenu", (e) => e.preventDefault());
      } catch (_) {}
    }
    lockSecretInput(apiKeyInput);
    lockSecretInput(openaiKeyInput);
    lockSecretInput(elevenKeyInput);


const elevenConfig = {
  key: localStorage.getItem("rk-eleven-key") || "",
  voice: localStorage.getItem("rk-eleven-voice") || "EXAVITQu4vr4xnSDxMaL",
};

    const openaiSttConfig = {
      key: localStorage.getItem('rk-openai-key') || ''
    };

    function applySettingsToForm() {
      if (apiKeyInput) apiKeyInput.value = apiConfig.key;
      if (apiUrlInput) apiUrlInput.value = apiConfig.url;
      if (apiModelInput) apiModelInput.value = apiConfig.model;
      if (apiTempInput) apiTempInput.value = apiConfig.temperature ?? 0.3;
      if (openaiKeyInput) openaiKeyInput.value = openaiSttConfig.key;

      if (elevenKeyInput) elevenKeyInput.value = elevenConfig.key;
  if (elevenVoiceInput) elevenVoiceInput.value = elevenConfig.voice;
      
    }

    function openSettings() {
      // Admin-only
      if (window.Admin && !window.Admin.isAdmin()) {
        showToast('API-Einstellungen sind nur im Admin-Modus verfügbar.', 'error');
        return;
      }
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
      const t = evt.target;
      if (t === settingsModal || (t && t.classList && t.classList.contains('modal-backdrop'))) {
        closeSettings();
      }
    });

    settingsForm?.addEventListener('submit', (evt) => {
      evt.preventDefault();
      apiConfig.key = apiKeyInput.value.trim();
      apiConfig.url = apiUrlInput.value.trim();
      apiConfig.model = apiModelInput.value.trim() || 'gpt-4o-mini';
      apiConfig.temperature = parseFloat(apiTempInput.value || '0.3');
      if (Number.isNaN(apiConfig.temperature)) apiConfig.temperature = 0.3;

      openaiSttConfig.key = (openaiKeyInput?.value || '').trim();

        elevenConfig.key = (elevenKeyInput?.value || "").trim();
  elevenConfig.voice = (elevenVoiceInput?.value || "").trim() || "EXAVITQu4vr4xnSDxMaL";

      if (openaiSttConfig.key) {
        localStorage.setItem('rk-openai-key', openaiSttConfig.key);
      } else {
        localStorage.removeItem('rk-openai-key');
      }

      localStorage.setItem("rk-eleven-key", document.getElementById("elevenKeyInput").value.trim());
      localStorage.setItem("rk-eleven-voice", document.getElementById("elevenVoiceInput").value.trim());

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
      openaiSttConfig.key = '';

      elevenConfig.key = "";
  elevenConfig.voice = "EXAVITQu4vr4xnSDxMaL";

      localStorage.removeItem('rk-api-key');
      localStorage.removeItem('rk-api-url');
      localStorage.removeItem('rk-api-model');
      localStorage.removeItem('rk-api-temp');
      localStorage.removeItem('rk-openai-key');
      localStorage.removeItem("rk-eleven-key");
  localStorage.removeItem("rk-eleven-voice");
  
      applySettingsToForm();
      showToast('API‑Einstellungen zurückgesetzt. Fallback‑Regeln werden verwendet.', 'info');
    });

    applySettingsToForm();

    async function callLLM(messages, { purpose } = {}) {
      const payload = {
        model: apiConfig.model || 'gpt-4o-mini',
        messages,
        temperature: typeof apiConfig.temperature === 'number' && !Number.isNaN(apiConfig.temperature)
          ? apiConfig.temperature : 0.3,
      };

      // Option A (Admin/Dev): direct call with a user-provided key.
      // Option B (Public deployment): no key in the browser, use the server-side proxy at /api/chat.
      const hasDirectKey = !!(apiConfig.key && String(apiConfig.key).trim());

      // --- Direct mode ---
      if (hasDirectKey) {
        const endpoint = (apiConfig.url || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';

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

      // --- Proxy mode (recommended for public website) ---
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errTxt = await res.text();
        throw new Error('Server‑Fehler (' + res.status + '): ' + errTxt);
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

  window.DIALECT_LEXICON = DIALECT_LEXICON;
}
const dialectReady = loadDialectResources();

function buildLexiconText(mode = 'chat') {
  const entries = Object.entries(DIALECT_LEXICON || {});
  if (!entries.length) return '';
  const lines = entries.map(([hd, dial]) => `"${hd}" -> "${dial}"`);

  if (mode === 'translate') {
    // Translation mode: the mapping can be used directly to translate the input.
    return (
      'FESTES WÖRTERLEXIKON (immer genau so verwenden, keine Alternativen):\n' +
      lines.join('\n')
    );
  }

  // Chat mode: the lexicon is a set of forced spellings for YOUR answers.
  // Important: do NOT output the mapping table, and do NOT "translate" the user's message.
  return (
    'LEXIKON (Formvorgaben für deine Antworten):\n' +
    '- Verwende die Dialektform (rechte Seite) exakt, wenn der Begriff/die Phrase in deiner Antwort vorkommt.\n' +
    '- Gib NIE die Tabelle selbst als Antwort aus.\n' +
    '- Übersetze NICHT den User-Text. Antworte inhaltlich auf die Absicht/Frage.\n' +
    lines.join('\n')
  );
}


function buildExamplesText() {
  if (!DIALECT_EXAMPLES) return '';
  return 'BEISPIELE FÜR DIALEKT-SÄTZE:\n' + DIALECT_EXAMPLES;
}


function buildRulesText() {
  const r = DIALECT_RULES || {};
  const meta = r.meta || {};
  const lines = [];

  lines.push('DIALEKT-REGELWERK (Richtlinien; nur anwenden, wenn es natürlich klingt):');
  if (meta.variant || meta.region) {
    const vr = [meta.variant, meta.region].filter(Boolean).join(' – ');
    if (vr) lines.push('Variante/Region: ' + vr);
  }
  if (meta.description) lines.push('Hinweis: ' + String(meta.description));

  function appendHintBlock(title, arr, maxItems) {
    if (!Array.isArray(arr) || !arr.length) return;
    lines.push(title + ':');
    arr.slice(0, maxItems || 4).forEach((it) => {
      const d = (it && it.description) ? String(it.description) : '';
      const f = (it && it.from) ? String(it.from) : '';
      const t = (it && it.to) ? (Array.isArray(it.to) ? it.to.join('/') : String(it.to)) : '';
      const hint = [d, (f && t) ? ('(' + f + ' → ' + t + ')') : ''].filter(Boolean).join(' ');
      if (hint) lines.push('- ' + hint);
    });
  }

  appendHintBlock('Vokal-Hinweise', r.vowel_rules, 4);
  appendHintBlock('Konsonanten-Hinweise', r.consonant_rules, 3);

  const gr = r.grammar_rules || {};
  const pron = gr.personal_pronouns || {};
  const art = gr.articles || {};
  const aux = gr.auxiliary_verbs || {};

  if (Object.keys(pron).length) {
    lines.push('Personalpronomen (Bevorzugungen):');
    Object.entries(pron).forEach(([k, v]) => lines.push('- ' + k + ' → ' + v));
  }
  if (Object.keys(art).length) {
    lines.push('Artikel (Bevorzugungen):');
    Object.entries(art).forEach(([k, v]) => lines.push('- ' + k + ' → ' + v));
  }
  if (Object.keys(aux).length) {
    lines.push('Hilfsverben (Tendenzen):');
    Object.entries(aux).forEach(([k, v]) => lines.push('- ' + k + ' → ' + v));
  }
  if (Array.isArray(gr.notes) && gr.notes.length) {
    lines.push('Grammatik-Notizen:');
    gr.notes.forEach((n) => lines.push('- ' + String(n)));
  }

  const ar = r.application_rules || {};
  if (Array.isArray(ar.never_change) && ar.never_change.length) {
    lines.push('Niemals verändern (Beispiele): ' + ar.never_change.slice(0, 12).join(', ') + (ar.never_change.length > 12 ? ' …' : ''));
  }
  if (Array.isArray(ar.notes) && ar.notes.length) {
    lines.push('Anwendungs-Notizen:');
    ar.notes.forEach((n) => lines.push('- ' + String(n)));
  }

  return lines.join('\n');
}





    const translatorSystemPrompt = `Du bist eine Übersetzungs-Engine für Hochdeutsch → mittelkärntnerischen Dialekt (Villach/Klagenfurt).
AUFGABE: Übersetze den Input 1:1 in Dialekt.

AUSGABE-REGELN:
- Gib NUR die Übersetzung zurück (kein Zusatztext, keine Erklärungen, keine Labels).
- Antworte NICHT auf Fragen. Wenn der Input eine Frage ist, gib dieselbe Frage im Dialekt zurück.
- Stelle keine Rückfragen und füge keine neuen Inhalte hinzu.
- Keine Ich-Antworten wie „mir geht …“ oder „i bin …“, außer diese Bedeutung steht im Input.
- Wenn der Input nur ein einzelnes Wort oder eine kurze Phrase ist, gib nur dieses Wort/diese Phrase im Dialekt zurück.
- Schreibe „wie“ immer als „wie“ (niemals „wia“).
- Behalte Bedeutung, Struktur und Höflichkeit bei.
`.trim();
    // const chatSystemPrompt = DIALECT_SYSTEM_PROMPT;

function looksLikeAnswerInsteadOfTranslation(input, output) {
  const i = (input || '').trim().toLowerCase();
  const o = (output || '').trim().toLowerCase();
  if (!i || !o) return false;

  const iHasQ = i.includes('?');
  const oHasQ = o.includes('?');

  // If the input is NOT a question but the output asks one, it's likely a chat reply.
  if (!iHasQ && oHasQ) return true;

  // Typical "answer" fragments that should never be invented by a translator.
  const inventedChecks = [
    { out: 'mir geht', inp: ['mir geht', 'mir geht es', "i bin guat", 'i bin', 'ich bin', 'mir is'] },
    { out: 'und dir', inp: ['und dir', 'und bei dir'] },
    { out: 'wos is los', inp: ['was ist los', 'wos is los'] },
    { out: 'wie schauts', inp: ['wie schaut', 'wie schauts'] },
    { out: 'danke', inp: ['danke', 'thx'] },
  ];

  for (const chk of inventedChecks) {
    if (o.includes(chk.out) && !chk.inp.some(s => i.includes(s))) return true;
  }

  // Single word / very short input should not become a full sentence.
  const iWords = i.split(/\s+/).filter(Boolean).length;
  const oWords = o.split(/\s+/).filter(Boolean).length;
  if (iWords <= 2 && oWords >= 6) return true;

  // Output significantly longer than input is suspicious for translation.
  if (iWords > 0 && oWords > iWords * 3) return true;

  return false;
}

async function translateHDToDialekt(text) {
  await dialectReady;

  // 1) Pre-enforce lexicon on user input (keeps known spellings consistent)
  const pre = window.RK_Lexicon ? window.RK_Lexicon.apply(text) : text;

  // IMPORTANT: Translator must NOT use the chat-oriented system_prompt.txt.
  // Use a dedicated translation prompt and only attach lexicon + rules as knowledge.
  let sysPrompt = translatorSystemPrompt;

  const lexText = buildLexiconText('translate');
  const rulesText = buildRulesText();

  if (lexText) sysPrompt += '\n\n' + lexText;
  if (rulesText) sysPrompt += '\n\n' + rulesText;

  sysPrompt += '\n\nMODUS: ÜBERSETZEN. Gib NUR die Übersetzung des Inputs zurück. Antworte nie auf den Inhalt.';

  const userPayload = 'TEXT ZU ÜBERSETZEN:\n' + pre;

  let raw = await callLLM(
    [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPayload }
    ],
    { purpose: 'translate' }
  );

  // Guard: if the model answered instead of translating, retry once with an explicit correction.
  if (looksLikeAnswerInsteadOfTranslation(text, raw)) {
    const fixPrompt =
      sysPrompt +
      '\n\nKORREKTUR: Du hast geantwortet statt übersetzt. ' +
      'Gib JETZT NUR die Übersetzung von TEXT ZU ÜBERSETZEN zurück. ' +
      'Keine neuen Inhalte, keine Fragen, keine Ich-Antworten, keine Zusatzsätze.';
    raw = await callLLM(
      [
        { role: 'system', content: fixPrompt },
        { role: 'user', content: userPayload }
      ],
      { purpose: 'translate' }
    );
  }

  // 2) Post-enforce lexicon on model output
  const post = window.RK_Lexicon
  ? (window.RK_Lexicon.applyOut ? window.RK_Lexicon.applyOut(raw) : window.RK_Lexicon.apply(raw))
  : raw;


  return post;
}



async function chatWithDialect(history) {
  await dialectReady;

  let sysPrompt =
    DIALECT_SYSTEM_PROMPT &&
    DIALECT_SYSTEM_PROMPT.trim().length > 0
      ? DIALECT_SYSTEM_PROMPT.trim()
      : 'Du bist ein KI-Modell, das konsequent im mittelkärntnerischen Dialekt (Villach/Klagenfurt) antwortet. Antwort immer im Dialekt, ohne Erklärungen.';

  const lexText = buildLexiconText('chat');
  const exText = buildExamplesText();
  const rulesText = buildRulesText();

  if (lexText) {
    sysPrompt += '\n\n' + lexText;
  }
  if (exText) {
    sysPrompt += '\n\n' + exText;
  }
  if (rulesText) {
    sysPrompt += '\n\n' + rulesText;
  }

  // Chat mode hard rule: answer in dialect, do not translate unless explicitly requested.
  sysPrompt += "\n\nMODUS: CHAT. Antworte inhaltlich im Dialekt. Übersetze nur, wenn der User ausdrücklich um eine Übersetzung bittet (z. B. 'übersetze ...'). Gib keine reine Umformulierung des User-Textes zurück.";

  const msgs = [{ role: 'system', content: sysPrompt }, ...history];
  const raw = await callLLM(msgs, { purpose: 'chat' });

  const post = window.RK_Lexicon
  ? (window.RK_Lexicon.applyOut ? window.RK_Lexicon.applyOut(raw) : window.RK_Lexicon.apply(raw))
  : raw;

  return post;
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
        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'translate_text', input: t, output: translated });
        }
	      } catch (err) {
        console.error(err);
        messages.removeChild(thinking);
	        // Use double quotes here so the apostrophe in "probier's" doesn't break JS parsing.
	        const fallback = toKaerntnerisch(t) || "I bin ma ned sicher – probier's no amoi."; //Test Push
        addBubble(messages, fallback, 'assistant');
        if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
          window.RK_Eval.setLastSample({ mode: 'translate_text_fallback', input: t, output: fallback });
        }
        showToast(err.message, 'error');
      }
    }

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    sendBtn?.addEventListener('click', sendMessage);

    document.querySelectorAll('.ex-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.ex || '';
        input.focus();
      });
    });

//     document.querySelectorAll('.chat-ex').forEach(btn => {
//   btn.addEventListener('click', () => {
//     chatInput.value = btn.dataset.ex || '';
//     chatInput.focus();
//     // optional: direkt abschicken:
//     // sendChat();
//   });
// });



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
      if (/wie geht/.test(t)) return 'Jo passt, danke – a bissl stressig, oba geht scho. Wie schauts bei dir aus?';
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
          let answer = await chatWithDialect(chatHistory);

          // Guard: if the model echoes/translates the user's short input, force a real answer.
          const norm = (x) => (x || '').toLowerCase().replace(/\s+/g, ' ').trim();
          const candidate = window.RK_Lexicon ? window.RK_Lexicon.apply(t) : t;
          const looksLikeTranslate =
            norm(answer) === norm(candidate) ||
            (norm(answer).length > 0 && norm(answer).length <= norm(t).length + 6 && norm(answer).includes(norm(candidate)));

          if (looksLikeTranslate) {
            answer = await chatWithDialect([
              ...chatHistory,
              { role: 'user', content: 'Hinweis: Antworte bitte inhaltlich auf meine Frage (im Dialekt) und gib keine reine Übersetzung/Umformulierung meines Textes zurück.' }
            ]);
          }
          chatHistory.push({ role: 'assistant', content: answer });
          chatMsgs.removeChild(thinking);
          addBubble(chatMsgs, answer, 'assistant');
          if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
            window.RK_Eval.setLastSample({ mode: 'chat_text', input: t, output: answer });
          }
        } catch (err) {
          console.error(err);
          chatMsgs.removeChild(thinking);
          const fallback = replyFor(t);
          chatHistory.push({ role: 'assistant', content: fallback });
          addBubble(chatMsgs, fallback, 'assistant');
          if (window.RK_Eval && typeof window.RK_Eval.setLastSample === 'function') {
            window.RK_Eval.setLastSample({ mode: 'chat_text_fallback', input: t, output: fallback });
          }
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
    const tabAudio = document.getElementById('tabAudio');
    const panelTrans = document.getElementById('panelTrans');
    const panelChat = document.getElementById('panelChat');
    const panelAudio = document.getElementById('panelAudio');

    function activate(tab) {
      const isTrans = tab === 'trans';
      const isChat = tab === 'chat';
      const isAudio = tab === 'audio';

      tabTrans?.classList.toggle('tab-active', isTrans);
      tabChat?.classList.toggle('tab-active', isChat);
      tabAudio?.classList.toggle('tab-active', isAudio);

      panelTrans?.classList.toggle('hidden', !isTrans);
      panelChat?.classList.toggle('hidden', !isChat);
      panelAudio?.classList.toggle('hidden', !isAudio);
    }

    tabTrans?.addEventListener('click', () => activate('trans'));
    tabChat?.addEventListener('click', () => activate('chat'));
    tabAudio?.addEventListener('click', () => activate('audio'));

    // Default
    activate('trans');
