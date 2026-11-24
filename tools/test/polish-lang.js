// testi nuovi nelle altre lingue: pulsante Aggiorna, matita, finestra, suggerimento di ↶
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const r = [];
  $('askNo').click();      // chiude la finestra lasciata aperta dal tasto S
  for (const lang of ['en', 'de', 'fr', 'es']) {
    Looper.setLang(lang);
    document.querySelector('.chip button.name').click(); await wait(30);
    const ren = document.querySelector('.chip.on button.ren');
    $('endUp').dispatchEvent(new PointerEvent('pointerdown', { button: 0 })); $('endUp').dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
    const upd = $('updSection').textContent;
    $('saveSection').click(); await wait(30);
    const dlg = $('askText').textContent + ' [' + $('askNo').textContent + ' / ' + $('askOk').textContent + ']';
    $('askNo').click();
    $('undoReg').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    await wait(600);
    const tip = document.querySelector('.tip').textContent;
    $('undoReg').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
    r.push(lang + ': "' + upd + '" · ✎ "' + (ren && ren.title) + '" · ' + dlg + ' · ↶ "' + tip + '" aria "' + $('undoReg').getAttribute('aria-label') + '"');
  }
  Looper.setLang('it');
  return r.join('\n');
})();
