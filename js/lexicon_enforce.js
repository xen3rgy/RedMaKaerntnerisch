/**
 * Deterministic dialect normalization (lexicon enforcement + output cleanup).
 *
 * NOTE: Parts of this project were developed with the support of AI tools (e.g., ChatGPT).
 * The project team reviewed, tested, and integrated the final code and content.
 */

// ------------------------------------------------------------
// Deterministic dialect normalization (lexicon enforcement + output cleanup).
// ------------------------------------------------------------

// lexicon_enforce.js
// Enforces dialect lexicon deterministically and normalizes common model glitches.
// Comments intentionally in English.

(function () {
  "use strict";

  // --- Helpers ---
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isWordChar(ch) {
    return /[A-Za-z0-9_ÄÖÜäöüß]/.test(ch);
  }

  function capLike(repl, original) {
    if (!original || !repl) return repl;
    const isUpper = original[0] === original[0].toUpperCase();
    return isUpper ? repl.charAt(0).toUpperCase() + repl.slice(1) : repl;
  }

  function replaceWithBoundaries(text, search, replacement) {
    if (!search) return text;
    const pattern = new RegExp(escapeRegExp(search), "gi");

    return text.replace(pattern, (match, offset) => {
      const before = offset > 0 ? text[offset - 1] : "";
      const after = offset + match.length < text.length ? text[offset + match.length] : "";
      const beforeOk = !before || !isWordChar(before);
      const afterOk = !after || !isWordChar(after);
      if (beforeOk && afterOk) return capLike(replacement, match);
      return match;
    });
  }

  function replaceWord(text, from, to) {
    return replaceWithBoundaries(text, from, to);
  }

  function getLexiconEntries() {
    const lex =
      window.DIALECT_LEXICON && typeof window.DIALECT_LEXICON === "object"
        ? window.DIALECT_LEXICON
        : {};

    return Object.entries(lex)
      .filter(([k, v]) => typeof k === "string" && k.trim() && typeof v === "string")
      .sort((a, b) => b[0].length - a[0].length);
  }

  function applyLexiconOnly(text) {
    if (!text) return text;
    const entries = getLexiconEntries();
    if (!entries.length) return text;

    let out = text;
    for (const [hd, dial] of entries) {
      out = replaceWithBoundaries(out, hd.trim(), dial);
    }
    return out;
  }

  // ------------------------------------------------------------
  // Grammar Layer (Way 1): Enforce canonical conjugations from dialect_rules.json
  //
  // Goal:
  // - You already maintain preferred conjugations in dialect_rules.json.
  // - Prompt rules are "soft"; the model can still output variants (kimmt/kummt, i glaub/i glab, ...).
  // - This layer reads your conjugation table and deterministically rewrites matches to your canonical forms.
  //
  // Design:
  // - Only enforces when a personal pronoun is present (i/du/er/se/es/wia/ihr/se).
  // - Uses a small set of German + common dialect variants per verb/person to catch model slips.
  // - Canonical output is taken from your dialect_rules.json table.
  // ------------------------------------------------------------

  let __CONJ_CACHE = null;

  function getDialectRules() {
    return (window.DIALECT_RULES && typeof window.DIALECT_RULES === 'object') ? window.DIALECT_RULES : null;
  }

  function tokenLast(str) {
    if (!str || typeof str !== 'string') return '';
    const parts = str.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }

  function buildGermanConjugations(inf) {
    // Minimal German conjugation helper (used only as variants to catch slips)
    // Irregular verbs are defined explicitly.
    const irr = {
      'sein':     { ich: 'bin', du: 'bist', er_sie_es: 'ist', wir: 'sind', ihr: 'seid', sie_plural: 'sind' },
      'haben':    { ich: 'habe', du: 'hast', er_sie_es: 'hat', wir: 'haben', ihr: 'habt', sie_plural: 'haben' },
      'machen':    { ich: 'mache', du: 'machst', er_sie_es: 'macht', wir: 'machen', ihr: 'macht', sie_plural: 'machen' },
      'glauben':    { ich: 'glaube', du: 'glaubst', er_sie_es: 'glaubt', wir: 'glauben', ihr: 'glaubt', sie_plural: 'glauben' },
      'kommen':   { ich: 'komme', du: 'kommst', er_sie_es: 'kommt', wir: 'kommen', ihr: 'kommt', sie_plural: 'kommen' },
      'gehen':    { ich: 'gehe', du: 'gehst', er_sie_es: 'geht', wir: 'gehen', ihr: 'geht', sie_plural: 'gehen' },
      'geben':    { ich: 'gebe', du: 'gibst', er_sie_es: 'gibt', wir: 'geben', ihr: 'gebt', sie_plural: 'geben' },
      'finden':   { ich: 'finde', du: 'findest', er_sie_es: 'findet', wir: 'finden', ihr: 'findet', sie_plural: 'finden' },
      'lassen':   { ich: 'lasse', du: 'lässt', er_sie_es: 'lässt', wir: 'lassen', ihr: 'lasst', sie_plural: 'lassen' },
      'können':   { ich: 'kann', du: 'kannst', er_sie_es: 'kann', wir: 'können', ihr: 'könnt', sie_plural: 'können' },
      'müssen':   { ich: 'muss', du: 'musst', er_sie_es: 'muss', wir: 'müssen', ihr: 'müsst', sie_plural: 'müssen' },
      'wollen':   { ich: 'will', du: 'willst', er_sie_es: 'will', wir: 'wollen', ihr: 'wollt', sie_plural: 'wollen' },
      'brauchen':    { ich: 'brauche', du: 'brauchst', er_sie_es: 'braucht', wir: 'brauchen', ihr: 'braucht', sie_plural: 'brauchen' },
    };
    if (irr[inf]) return irr[inf];

    // Regular fallback: -en verbs (machen, sagen, glauben, brauchen)
    // Note: this is only used as *variants*; canonical output always comes from your dialect table.
    let stem = inf;
    if (stem.endsWith('en')) stem = stem.slice(0, -2);
    else if (stem.endsWith('n')) stem = stem.slice(0, -1);

    return {
      ich: stem + 'e',
      du: stem + 'st',
      er_sie_es: stem + 't',
      wir: inf,          // "wir" uses infinitive in German
      ihr: stem + 't',
      sie_plural: inf,
    };
  }

  function buildConjugationCache() {
    const rules = getDialectRules();
    if (!rules) return null;

    const ex = rules?.grammar_rules?.verb_conjugation_guidelines?.examples || {};
    const verbs = Object.keys(ex);
    if (!verbs.length) return null;

    const pron = {
      ich: { re: /(i|ich)/i },
      du: { re: /(du)/i },
      er_sie_es: { re: /(er|se|sie|es)/i },
      wir: { re: /(wia|wir)/i },
      ihr: { re: /(ihr)/i },
      sie_plural: { re: /(se|sie)/i },
    };

    const cache = [];

    for (const v of verbs) {
      const row = ex[v] || {};
      const de = buildGermanConjugations(v);

      const canonical = {
        ich: tokenLast(row.ich),
        du: tokenLast(row.du),
        er_sie_es: tokenLast(row.er_sie_es),
        wir: tokenLast(row.wir),
        ihr: tokenLast(row.ihr),
        sie_plural: tokenLast(row.sie_plural),
      };

      // Build variants per person (to catch slips)
      const variants = {};
      for (const p of Object.keys(canonical)) {
        const set = new Set();
        if (canonical[p]) set.add(canonical[p]);
        if (de[p]) set.add(de[p]);

        // Common dialect slips that the model produces
        // - "kimmt" vs "kummt" for kommen
        if (/^kumm/.test(canonical[p])) set.add(canonical[p].replace(/^kumm/, 'kimm'));
        if (/^kimm/.test(canonical[p])) set.add(canonical[p].replace(/^kimm/, 'kumm'));

        // - "glaub" vs "glab" (project convention prefers your table form)
        if (/^glab/.test(canonical[p])) set.add('glaub');
        if (/^glaub/.test(canonical[p])) set.add('glab');

        // - "findst" short form (model sometimes uses it)
        if (v === 'finden' && p === 'du') set.add('findst');

        variants[p] = Array.from(set).filter(Boolean);
      }

      cache.push({ verb: v, canonical, variants, pron });
    }

    return cache;
  }

  function enforceConjugations(text) {
    if (!text) return text;
    if (!__CONJ_CACHE) __CONJ_CACHE = buildConjugationCache();
    if (!__CONJ_CACHE) return text;

    let out = text;

    for (const item of __CONJ_CACHE) {
      const { canonical, variants, pron } = item;

      for (const personKey of Object.keys(canonical)) {
        const canonVerb = canonical[personKey];
        if (!canonVerb) continue;

        const pronRe = pron?.[personKey]?.re;
        if (!pronRe) continue;

        // Build a regex for variants: (kommt|kimmt|kummt|...)
        const varList = (variants[personKey] || []).map(escapeRegExp);
        if (!varList.length) continue;

        // Match: <pronoun> <verbVariant>
        const r = new RegExp(
          `\\b(${pronRe.source})\\b\\s+(${varList.join('|')})\\b`,
          'gi'
        );

        out = out.replace(r, (m, pPron) => {
          // Preserve the original pronoun casing; enforce the verb form.
          return `${pPron} ${canonVerb}`;
        });
      }
    }

    return out;
  }

  // Hard normalization for stable evaluation outputs
  function normalizeDialectOutput(text) {
    if (!text) return text;
    let out = text;

    // --- Fix core function words (guarantee consistency) ---
    out = replaceWord(out, "wir", "wia");

    out = replaceWord(out, "der", "da");
    out = replaceWord(out, "die", "de");
    out = replaceWord(out, "das", "des");
	// Adjective inflection: "a schen Tog" -> "a schena Tog"
	out = out.replace(/\b(a)\s+schen\s+(tog)\b/gi, "a schena Tog");

    // Avoid pronoun confusion: prefer "se" for plural pronoun
    // (Article "de" stays for "die")
    out = replaceWord(out, "sie", "se"); // NOTE: this is broad; if you don't want it, remove this line.

    // Keep the question word "wie" readable (project convention):
    // "Wia geht's ..." -> "Wie geht's ..."
    // (Do NOT touch the pronoun "wia" = "wir".)
    out = out.replace(
      /(^|[.!?\n]\s*)(wia)\s+(geht(?:['’]?s|s)?|schaut(?:s)?|gehts|geht['’]?s)\b/gi,
      (m, p1, w, v) => {
        const cap = (w && w[0] === w[0].toUpperCase());
        const wie = cap ? 'Wie' : 'wie';
        return p1 + wie + ' ' + v;
      }
    );

    // Sentence-level fix: subject "Mir/Mia/Wir ... haben/ham/hom"
    out = out.replace(
      /(^|[.!?\n]\s*)(Mir|Mia|Wir)\s+(ham|hom|haben|hab['’]?n)\b/gi,
      (m, p1) => p1 + "Wia hobn"
    );

    // --- Typical model glitches ---
    out = out.replace(/\bggangen\b/gi, "gongen");
    out = out.replace(/\bgegangen\b/gi, "gongen");

    // Make "gehen" shorter if it shows up in HD form
    out = out.replace(/\bgehen\b/gi, "gehn");

    // "i lass" / "lass'n" -> "i loss" / "lossn"
    out = out.replace(/\b(i)\s+lass\b/gi, "i loss");
    out = out.replace(/\blass(['’]?n|n)\b/gi, "lossn");
    out = replaceWord(out, "lass", "loss");
    out = replaceWord(out, "lasse", "loss");

    // "hab'n" style
    out = out.replace(/\bhab(['’]?n)\b/gi, "hobn");


    // Normalize "können" conjugations (model often slips into Standard German)
    out = out.replace(/\bkann(['’]?s)\b/gi, "konn$1");
    out = out.replace(/\bkannst\b/gi, "konnst");
    out = out.replace(/\bkann\b/gi, "konn");

    // Prefer dialect pronoun "i" over "ich"
    out = replaceWord(out, "ich", "i");

    // Avoid apostrophes for dropped letters at word end: Vorhersag'n -> Vorhersagn
    out = out.replace(/([A-Za-zÄÖÜäöüß])['’]n\b/g, "$1n");
    // Specific high-impact phrasing fixes you complained about
    out = out.replace(/\bzum Sitzen\b/gi, "zum Sitzn");
    out = out.replace(/\bgenieße\b/gi, "gnieß");
    out = out.replace(/\bgenießen\b/gi, "gnießn");

    // "schena Plätzchen" -> "schens Plätzchen" (targeted, safe)
    out = out.replace(/\b(a)\s+schena\s+Plätzchen\b/gi, "a schens Plätzchen");

    // "gehen mochn möcht'n" nonsense -> "gehn möcht'n"
    out = out.replace(/\bgehen\s+mochn\s+möcht['’]?n\b/gi, "gehn möcht'n");
	
	out = out.replace(/\bfindst\b/gi, "findest");
	out = out.replace(/\bfindts\b/gi, "findets"); // optional (falls das Modell "findts" bringt)

    // --- Grammar Layer: enforce canonical conjugations (from dialect_rules.json) ---
    out = enforceConjugations(out);

    // Cleanup (double spaces)
    out = out.replace(/\s{2,}/g, " ").trim();
    return out;
  }

  function applyForOutput(text) {
    const lexed = applyLexiconOnly(text);
    return normalizeDialectOutput(lexed);
  }

  // Public API
  window.RK_Lexicon = {
    apply: applyLexiconOnly,   // for user input (no forced dialect)
    applyOut: applyForOutput   // for model output (stable dialect)
  };
})();
