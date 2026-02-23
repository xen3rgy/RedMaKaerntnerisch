// lexicon_enforce.js
// Enforces dialect lexicon deterministically (pre + post processing).
// Comments intentionally in English.

(function () {
  "use strict";

  // --- Helpers ---
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isWordChar(ch) {
    // Basic word-char check: letters, numbers, underscore, german umlauts
    return /[A-Za-z0-9_ÄÖÜäöüß]/.test(ch);
  }

  function replaceWithBoundaries(text, search, replacement) {
    // Replace whole-word occurrences (approx. word boundary) case-insensitive.
    // We do manual boundary checks to avoid \b issues with umlauts.
    if (!search) return text;

    const pattern = new RegExp(escapeRegExp(search), "gi");
    return text.replace(pattern, (match, offset) => {
      const before = offset > 0 ? text[offset - 1] : "";
      const after = offset + match.length < text.length ? text[offset + match.length] : "";

      const beforeOk = !before || !isWordChar(before);
      const afterOk = !after || !isWordChar(after);

      if (beforeOk && afterOk) return replacement;
      return match; // keep original if not a full-word match
    });
  }

  function getLexiconEntries() {
    // DIALECT_LEXICON is loaded by your existing resource loader
    const lex = (window.DIALECT_LEXICON && typeof window.DIALECT_LEXICON === "object")
      ? window.DIALECT_LEXICON
      : {};

    // Convert to array and sort by key length (longer first)
    return Object.entries(lex)
      .filter(([k, v]) => typeof k === "string" && k.trim() && typeof v === "string")
      .sort((a, b) => b[0].length - a[0].length);
  }

  function applyLexicon(text) {
    if (!text) return text;
    const entries = getLexiconEntries();
    if (!entries.length) return text;

    let out = text;

    // Apply longest keys first (helps multi-word phrases)
    for (const [hd, dial] of entries) {
      out = replaceWithBoundaries(out, hd.trim(), dial);
    }
    return out;
  }

  // Public API
  window.RK_Lexicon = {
    apply: applyLexicon,
  };
})();
