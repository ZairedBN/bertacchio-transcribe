// telefono: i pulsanti della riga A/B (con ↶) non devono tagliare il testo in nessuna lingua
(() => {
  const r = [];
  for (const lang of ['it', 'en', 'es', 'de', 'fr']) {
    Looper.setLang(lang);
    const cut = [...document.querySelectorAll('.ab button')].filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent);
    r.push(lang + ': ' + [...document.querySelectorAll('.ab button')].map(b => b.textContent).join(' | ') + (cut.length ? '  TAGLIATI → ' + cut.join(', ') : '  ok'));
  }
  Looper.setLang('it');
  return r.join('\n');
})();
