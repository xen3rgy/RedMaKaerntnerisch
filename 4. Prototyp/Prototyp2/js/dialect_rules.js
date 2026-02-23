// Simple Mittelkärnten transformation rules (prototype).
// Intensity controls how aggressive phonetic rules are applied.
const Dialekt = (() => {
  const lex = [
    [/\bGuten Tag\b/gi, 'Grias di'],
    [/\bGuten Morgen\b/gi, 'Grias enk am Morgn'],
    [/\bGuten Abend\b/gi, 'Grias enk am Obnd'],
    [/\bHallo\b/gi, 'Servas'],
    [/\bTschüss\b/gi, 'Pfiat di'],
  ];

  const morph = [
    [/\bich\b/gi, 'i'],
    [/\bdu\b/gi, 'du'],
    [/\ber\b/gi, 'a'],
    [/\bsie\b/gi, 'sie'],
    [/\bwir\b/gi, 'mia'],
    [/\bihr\b/gi, 'ia'],
    [/\beuch\b/gi, 'enk'],
    [/\beuer\b/gi, 'enker'],
    [/\bmich\b/gi, 'mi'],
    [/\bdich\b/gi, 'di'],
    [/\bmir\b/gi, 'ma'],
    [/\bdir\b/gi, 'da'],
    [/\bmein\b/gi, 'mei'],
    [/\bmeine\b/gi, 'meine'],
    [/\bdein\b/gi, 'dei'],
    [/\bdeine\b/gi, 'deine'],
    [/\bnicht\b/gi, 'ned'],
    [/\bkein\b/gi, 'kan'],
    [/\bkeine\b/gi, 'ka'],
    [/\bauch\b/gi, 'aa'],
    [/\baber\b/gi, 'oba'],
    [/\bsehr\b/gi, 'vü'],
    [/\bklein\b/gi, 'klans'],
    [/\bgroß\b/gi, 'groß'],
    [/\bhabe\b/gi, 'hob'],
    [/\bhaben\b/gi, 'hom'],
    [/\bbin\b/gi, 'bin i'],
    [/\bbist\b/gi, 'bist'],
    [/\bsind\b/gi, 'san'],
    [/\bwerde\b/gi, 'werd'],
    [/\bwerdet\b/gi, 'werds'],
    [/\bwerde(n)?\b/gi, 'werdn'],
    [/\bgehen\b/gi, 'gehn'],
    [/\bgehen wir\b/gi, 'gemma'],
    [/\bmal\b/gi, 'amoi'],
    [/\bsehr gut\b/gi, 'leiwaund'],
  ];

  const phonetic = [
    // drop some 'g' endings
    [/ig\b/gi, 'ig'], // keep
    [/en\b/gi, 'n'],
    [/chen\b/gi, 'l'],
    [/\bzu\b/gi, 'zua'],
    [/\bjetzt\b/gi, 'etz'],
    [/\berst\b/gi, 'erst'],
    [/\baden\b/gi, 'bådn'],
    [/\bzeit\b/gi, 'zeitl'],
  ];

  function applyRules(str, intensity=70, usePhonetics=true) {
    let out = str;
    lex.forEach(([r, t]) => out = out.replace(r, t));
    morph.forEach(([r, t]) => out = out.replace(r, t));

    if (usePhonetics) {
      const cutoff = intensity / 100;
      phonetic.forEach(([r, t]) => {
        if (Math.random() <= cutoff) out = out.replace(r, t);
      });
    }

    // simple punctuation spacing fixes
    out = out.replace(/\s+([.,!?;:])/g, '$1');
    return out;
  }

  return { applyRules };
})();
