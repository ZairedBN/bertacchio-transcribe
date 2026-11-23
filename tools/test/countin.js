(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const key = k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
  const file = bufToWav(makeSong(120, 30, 0.5));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const H = Looper.wave.hooks, r = [];
  H.setRegion(4.5, 8.5);
  $('pauseMode').value = 'bar1'; $('pauseMode').dispatchEvent(new Event('change'));
  $('countFirst').checked = true;
  // il brano sta suonando (conteggio già fatto), poi Spazio
  $('countFirst').checked = false; H.seek(5); $('play').click(); await wait(600);
  $('countFirst').checked = true;
  r.push('prima di Spazio: suona ' + !a.paused + ' t=' + a.currentTime.toFixed(2));
  key(' '); await wait(400);
  const t1 = a.currentTime; await wait(600);
  r.push('durante il conteggio: in pausa ' + a.paused + ', testina ferma ' + (Math.abs(a.currentTime - t1) < 0.01) + ' t=' + a.currentTime.toFixed(2));
  await wait(1400);
  r.push('dopo il conteggio: suona ' + !a.paused + ' t=' + a.currentTime.toFixed(2) + ' (atteso poco dopo 4.5)');
  // pulsante Ricomincia
  $('restartBtn').click(); await wait(500);
  r.push('Ricomincia: in pausa durante il conteggio ' + a.paused);
  a.pause(); key('p'); key('p');
  // pulsanti avanti/indietro
  $('pauseMode').value = 'none'; $('pauseMode').dispatchEvent(new Event('change'));
  a.pause(); H.seek(5.2); $('nextBtn').click(); r.push('» da 5.2: ' + a.currentTime.toFixed(2) + ' (atteso 6.50)');
  $('prevBtn').click(); r.push('« : ' + a.currentTime.toFixed(2) + ' (atteso 4.50)');
  H.seek(3); $('aMini').click(); r.push('A dal telefono: inizio ' + Looper.state.region.start.toFixed(2));
  return r.join('\n');
})()
