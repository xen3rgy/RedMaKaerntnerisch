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

  // Hard normalization for stable evaluation outputs
  function normalizeDialectOutput(text) {
    if (!text) return text;
    let out = text;

    // --- Fix core function words (guarantee consistency) ---
    out = replaceWord(out, "wir", "wia");

    out = replaceWord(out, "der", "da");
    out = replaceWord(out, "die", "de");
    out = replaceWord(out, "das", "des");

    // Avoid pronoun confusion: prefer "se" for plural pronoun
    // (Article "de" stays for "die")
    out = replaceWord(out, "sie", "se"); // NOTE: this is broad; if you don't want it, remove this line.

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
