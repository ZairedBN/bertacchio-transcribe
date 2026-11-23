(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const file = bufToWav(makeSong(120, 30));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, H = Looper.wave.hooks, r = [];
  const setMode = v => { $('pauseMode').value = v; $('pauseMode').dispatchEvent(new Event('change')); };
  $('loop').checked = true; $('loop').dispatchEvent(new Event('change'));
  H.setRegion(4, 12);
  // 1) senza conteggio, clic dentro il passaggio
  setMode('none');
  H.seek(8); $('play').click(); await wait(300);
  r.push('dentro, senza conteggio: parte da ' + a.currentTime.toFixed(2) + ' (atteso ~8)');
  $('play').click(); await wait(100);
  // 2) con conteggio al primo Play
  setMode('bar1'); $('countFirst').checked = true;
  H.seek(9); $('play').click(); await wait(2600);
  r.push('dentro, con conteggio: ' + a.currentTime.toFixed(2) + ' (atteso poco dopo 9)');
  $('play').click(); await wait(100);
  // 3) fuori dal passaggio
  setMode('none');
  H.seek(20); $('play').click(); await wait(300);
  r.push('fuori (dopo la fine): ' + a.currentTime.toFixed(2) + ' (atteso ~20)');
  $('play').click(); await wait(100);
  H.seek(1); $('play').click(); await wait(300);
  r.push('fuori (prima): ' + a.currentTime.toFixed(2) + ' (atteso ~1)');
  $('play').click(); await wait(100);
  // 4) nuova selezione con la testina altrove: Play parte dall'inizio del passaggio
  H.setRegion(14, 18); $('play').click(); await wait(300);
  r.push('nuova selezione: ' + a.currentTime.toFixed(2) + ' (atteso ~14)');
  $('play').click(); await wait(100);
  // 5) Stop riporta all'inizio
  H.seek(25); $('stop').click(); $('play').click(); await wait(300);
  r.push('dopo Stop: ' + a.currentTime.toFixed(2) + ' (atteso ~14)');
  a.pause();
  return r.join('\n');
})()
