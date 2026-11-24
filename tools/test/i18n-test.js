(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const r = ['lingua iniziale: ' + Looper.lang + ' (html lang ' + document.documentElement.lang + ')'];
  const file = bufToWav(makeSong(120, 20, 0.5));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  Looper.ask = (m, o) => Promise.resolve(o && o.value !== undefined ? o.value : true);
  const IT = /\b(della|brano|Sezione|velocità|passaggio|griglia|Ripetizioni|conteggio|Tasti|Apri|Mostra|Allenatore|Partenza|semitoni|spento|Ascolta|ogni|giri|Cancella|Imposta|Chiudi|battuta|Riproduzione|sinistro|destro|Trascina|Ricomincia|tocca|rilevato|Scegli)\b/;
  const scan = tag => {
    const bad = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,#filename')) continue;
      const v = n.nodeValue.trim();
      if (v && IT.test(v)) bad.push(v.slice(0, 70));
    }
    document.querySelectorAll('[title],[placeholder],[aria-label]').forEach(el => {
      for (const a of ['title', 'placeholder', 'aria-label']) { const v = el.getAttribute(a); if (v && IT.test(v)) bad.push(a + ': ' + v.slice(0, 60)); }
    });
    r.push(tag + ': ' + (bad.length ? 'ITALIANO RIMASTO → ' + [...new Set(bad)].join(' | ') : 'ok'));
  };
  const H = Looper.wave.hooks;
  for (const lang of ['en', 'es', 'de', 'fr', 'it', 'en']) {
    Looper.setLang(lang); $('langSel').value = lang;
    H.setRegion(2.5, 6.5); if (lang === 'en') { $('saveSection').click(); }
    $('pauseMode').value = 'bar1'; $('pauseMode').dispatchEvent(new Event('change'));
    $('trStartBtn').click(); await wait(100);
    $('iso').value = 'novocal'; $('iso').dispatchEvent(new Event('change'));
    $('eqLow').value = -30; $('eqLow').dispatchEvent(new Event('input'));
    $('semi').value = 2; $('semi').dispatchEvent(new Event('input'));
    $('recentBtn').click(); await wait(300);
    $('tapBtn').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); await wait(600);
    if (lang !== 'it') scan(lang);
    r.push('  ' + lang + ' esempi: Play="' + $('play').textContent + '" nota="' + $('bpmNote').textContent + '" conteggio="' + $('countHint').textContent.slice(0, 40) + '" tip="' + document.querySelector('.tip').textContent.slice(0, 50) + '" bassi="' + $('eqLowVal').textContent + '" stato="' + $('trainerStatus').textContent.slice(0, 40) + '"');
    $('recentBtn').click();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }
  Looper.setLang('de');
  return r.join('\n');
})()
