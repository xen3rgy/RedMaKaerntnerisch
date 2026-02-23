// App wiring
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

const state = {
  intensity: 70,
  phonetics: true,
  latency: 200,
  botOnly: true,
  localCorpus: null,
};

function loadSettings() {
  const s = JSON.parse(localStorage.getItem('k_chat_settings') || '{}');
  Object.assign(state, s);
  $('#intensity').value = state.intensity ?? 70;
  $('#phoneticsToggle').checked = state.phonetics ?? true;
  $('#latency').value = state.latency ?? 200;
  $('#botOnly').checked = state.botOnly ?? true;
}

function saveSettings() {
  const s = {
    intensity: +$('#intensity').value,
    phonetics: $('#phoneticsToggle').checked,
    latency: +$('#latency').value,
    botOnly: $('#botOnly').checked,
  };
  Object.assign(state, s);
  localStorage.setItem('k_chat_settings', JSON.stringify(s));
}

function setTab(id) {
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $$('.tabpanel').forEach(p => p.classList.toggle('active', p.id === id));
}

async function loadCorpus() {
  try {
    const local = JSON.parse(localStorage.getItem('k_corpus') || 'null');
    if (local) {
      state.localCorpus = local;
      window.CORPUS = local;
      renderExamples(local);
      return;
    }
    const res = await fetch('data/corpus.json');
    const corpus = await res.json();
    window.CORPUS = corpus;
    renderExamples(corpus);
  } catch (e) {
    console.error('Corpus load failed', e);
    window.CORPUS = [];
  }
}

function renderExamples(corpus) {
  const ul = $('#examples');
  ul.innerHTML = '';
  corpus.forEach(e => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${e.hoch}</strong> → ${e.dialekt} <span class="meta">${e.desc || ''}</span>`;
    ul.appendChild(li);
  });
}

function toDialekt(text) {
  return Dialekt.applyRules(text, state.intensity, state.phonetics);
}

// Translator behavior
function wireTranslator() {
  const upd = () => {
    const src = $('#src').value;
    const result = toDialekt(src);
    $('#out').textContent = result;
  };
  $('#src').addEventListener('input', upd);
  $('#intensity').addEventListener('input', () => { saveSettings(); upd(); });
  $('#phoneticsToggle').addEventListener('change', () => { saveSettings(); upd(); });
  $('#copyOut').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('#out').textContent);
  });
  upd();
}

// Chat behavior
function pushMsg(role, text) {
  const el = document.createElement('div');
  el.className = `msg ${role}`;
  el.innerHTML = `<div class="bubble">${text}</div>`;
  $('#chatStream').appendChild(el);
  $('#chatStream').scrollTop = $('#chatStream').scrollHeight;
}

function wireChat() {
  $('#chatForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#chatMsg').value.trim();
    if (!msg) return;
    $('#chatMsg').value = '';
    pushMsg('user', msg);

    // simulate latency
    await new Promise(r => setTimeout(r, state.latency));

    let base = await Bot.answer(msg);
    const answer = toDialekt(base);
    pushMsg('bot', state.botOnly ? answer : `${answer}`);
  });
}

// Knowledge add/save
function wireKnowledge() {
  $('#addEntry').addEventListener('click', () => {
    const hd = $('#newHd').value.trim();
    const dl = $('#newDialekt').value.trim();
    const desc = $('#newDesc').value.trim();
    if (!hd || !dl) return;
    const entry = { hoch: hd, dialekt: dl, desc };
    const cur = (state.localCorpus || window.CORPUS || []);
    cur.push(entry);
    state.localCorpus = cur;
    renderExamples(cur);
    $('#newHd').value=''; $('#newDialekt').value=''; $('#newDesc').value='';
  });

  $('#saveLocal').addEventListener('click', () => {
    if (state.localCorpus) {
      localStorage.setItem('k_corpus', JSON.stringify(state.localCorpus));
      alert('Lokal gespeichert.');
    } else {
      alert('Nix zu speichern.');
    }
  });

  $('#resetLocal').addEventListener('click', () => {
    localStorage.removeItem('k_corpus');
    state.localCorpus = null;
    loadCorpus();
  });

  $('#downloadKB').addEventListener('click', (e) => {
    e.preventDefault();
    const blob = new Blob([JSON.stringify(window.CORPUS || [], null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'corpus_export.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Settings, export, dark toggle
function wireChrome() {
  $('#openSettings').addEventListener('click', () => $('#settings').showModal());
  $('#saveSettings').addEventListener('click', (e) => { e.preventDefault(); saveSettings(); $('#settings').close(); });

  $('#darkToggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('k_theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });
  const t = localStorage.getItem('k_theme');
  if (t === 'light') document.documentElement.classList.add('light');

  $('#exportChat').addEventListener('click', () => {
    const items = Array.from(document.querySelectorAll('.chat-stream .msg')).map(x => ({
      role: x.classList.contains('user') ? 'user' : 'bot',
      text: x.textContent.trim()
    }));
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), items }, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'chat_export.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// Tabs
function wireTabs() {
  $$('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
}

// Init
(async function init() {
  loadSettings();
  wireTabs();
  wireChrome();
  await loadCorpus();
  wireTranslator();
  wireChat();
})();
