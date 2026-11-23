(async () => {
  const out = [], log = (k, v) => out.push(k + ': ' + v), $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    log('pagina caricata', typeof Looper !== 'undefined' && !!Looper.app);
    log('service worker attivo', !!navigator.serviceWorker.controller);
    const list = await Looper.db.list();
    log('recenti dopo il ricaricamento', list.length + ' → ' + list.map(s => s.title).join(', '));
    $('recentBtn').click(); await wait(300);
    const first = document.querySelector('#recentList .open');
    log('voce nel pannello', first ? first.textContent : 'nessuna');
    first.click();
    for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
    log('riaperto dai recenti', $('filename').textContent + ', durata ' + Looper.state.duration.toFixed(1) + ' s, BPM ' + $('bpm').value + ' ' + $('bpmNote').textContent);
    log('sezioni ritrovate', [...document.querySelectorAll('.chip .name')].map(x => x.textContent).join('|'));
  } catch (e) { log('ECCEZIONE', e.message); }
  return out.join('\n');
})()
