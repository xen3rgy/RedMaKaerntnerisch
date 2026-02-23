// Rule-based bot for the demo with optional LLM hand-off in 'live' mode.
const Bot = (() => {
  const kb = {
    facts: [
      { key: 'fh', q: ['fh kärnten','fh kaernten','fhk','campus','villach'], a: 'Die FH Kärnten hat u. a. einen Campus in Villach. Fürs Projekt reicht zuerst ein Frontend-Prototyp mit Demo-Korpus und klarer Evaluationsplanung.' },
      { key: 'projekt', q: ['projekt','bachelor','chatbot','dialekt'], a: 'Ziel: Hochdeutsch verstehen und logisch antworten, dann Dialekt-Postprocessing. Diese Demo macht die Antwort lokal; produktiv nutzt du ein LLM-Backend.' },
      { key: 'seen', q: ['wörthersee','faaker see','ossiacher see'], a: 'Große Kärntner Seen: Wörthersee, Faaker See, Ossiacher See. Im Sommer Events, Wassersport.' },
      { key: 'zeit', q: ['uhr','zeit','spät'], a: () => `Es ist jetzt ${new Date().toLocaleTimeString('de-AT',{hour:'2-digit',minute:'2-digit'})} Uhr.` },
      { key: 'gruß', q: ['hallo','hi','servus','servas','grias'], a: 'Servas! Wie kann i da helfn?' },
      { key: 'hilfe', q: ['hilfe','wie geht','funktion','erklären','help'], a: 'Frag normal in Hochdeutsch; i antworte logisch und verwandle dann in Dialekt. „Wissen“-Tab erweitert den Korpus.' },
      // New intents
      { key: 'meeting', q: ['meeting','besprechung','prof','betreuerin'], a: 'Tipp: Zeig den Live-Chat, die Korpus-Editierbarkeit und das Dialekt-Postprocessing. Erkläre klar die geplante Server-Architektur (Proxy + LLM) und den Evaluationsplan (WER/MOS/UX).' },
      { key: 'wetter_stub', q: ['wetter','temperatur','regen'], a: 'Wetter ist in der Demo offline. In der Live-Version bindest du eine Wetter-API an und beantwortest dann in Dialekt.' },
      { key: 'villach', q: ['villach','kärnten','carinthia'], a: 'Villach: zweitgrößte Stadt Kärntens, Nähe Faaker/Ossiacher See. Bekannt für Kirchtag und Technologie-Standort.' },
    ],
    smalltalk: [
      'Passt! Magst no wås wissn?',
      'Jo, des kriag ma hi.',
      'Klingt guat. Wås interessiert di genau?',
    ]
  };

  function classify(msg) {
    const m = msg.toLowerCase();
    for (const f of kb.facts) {
      if (f.q.some(q => m.includes(q))) return f;
    }
    if (/^(hallo|hi|servus|servas|grias)/.test(m)) return kb.facts.find(x=>x.key==='gruß');
    if (/zeit|uhr/.test(m)) return kb.facts.find(x=>x.key==='zeit');
    return null;
  }

  async function answer(userText) {
    if (typeof AppConfig !== 'undefined' && AppConfig.mode === 'live') {
      try {
        const llm = await llmAnswer(userText);
        return llm;
      } catch (e) {
        console.warn(e);
        // Fallback to demo logic
      }
    }
    // DEMO logic
    const f = classify(userText);
    let base;
    if (f) {
      base = (typeof f.a === 'function') ? f.a() : f.a;
    } else {
      const corpus = (window.CORPUS || []);
      const hit = corpus.find(e => userText.toLowerCase().includes((e.hoch || '').toLowerCase()));
      if (hit) {
        base = `Zu „${hit.hoch}“: Im Dialekt oft „${hit.dialekt}“. ${hit.desc ? hit.desc : ''}`.trim();
      } else {
        const st = kb.smalltalk[Math.floor(Math.random()*kb.smalltalk.length)];
        base = st + ' (Demo-Antwort)';
      }
    }
    return base;
  }

  return { answer };
})();
