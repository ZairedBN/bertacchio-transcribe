(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const key = (k, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const file = bufToWav(makeSong(120, 30, 0.5));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, H = Looper.wave.hooks, r = [], f = x => x.toFixed(2);
  $('pauseMode').value = 'none'; $('pauseMode').dispatchEvent(new Event('change'));
  r.push('griglia ' + JSON.stringify(S.grid) + ' visibile ' + S.gridShow);
  H.setRegion(4.5, 8.5);
  H.seek(6.3);
  key(' '); await wait(300);
  r.push('Spazio: playing ' + !a.paused + ' t=' + f(a.currentTime) + ' (atteso ~4.5)');
  key('p'); await wait(100);
  r.push('P: in pausa ' + a.paused);
  key('Enter'); await wait(150); r.push('Invio: suona ' + !a.paused); key('p'); await wait(100);
  // frecce con griglia (battuta = 2 s, offset 0.5)
  H.seek(5.2); key('ArrowRight'); r.push('→ da 5.2 con griglia: ' + f(a.currentTime) + ' (atteso 6.50)');
  key('ArrowLeft'); r.push('← da 6.5: ' + f(a.currentTime) + ' (atteso 4.50)');
  key('ArrowLeft', { shiftKey: true }); r.push('Maiusc+← : ' + f(a.currentTime) + ' (atteso 2.50)');
  // senza griglia
  key('g'); r.push('G: griglia visibile ' + S.gridShow);
  Looper.ask = (m, o) => Promise.resolve(o && o.value !== undefined ? o.value : true);
  H.setRegion(12, 16); key('s'); await wait(50); H.setRegion(4.5, 8.5);
  H.seek(5); key('ArrowRight'); r.push('→ da 5 senza griglia: ' + f(a.currentTime) + ' (atteso 8.50, fine passaggio)');
  key('ArrowRight'); r.push('→ ancora: ' + f(a.currentTime) + ' (atteso 12.00, sezione)');
  key('ArrowLeft'); r.push('← : ' + f(a.currentTime) + ' (atteso 8.50)');
  key('Home'); r.push('Home: ' + f(a.currentTime));
  key('0'); r.push('0: velocità ' + a.playbackRate);
  key('z'); r.push('Z: zoom ' + Looper.wave.isZoomed()); key('z'); r.push('Z di nuovo: zoom ' + Looper.wave.isZoomed());
  key('g');
  // tap con T: 4 colpi a 120 BPM
  for (let i = 0; i < 5; i++) { key('t'); await wait(500); }
  r.push('T x5 a 500 ms: BPM ' + S.grid.bpm + ' nota ' + $('bpmNote').textContent);
  // suggerimento
  $('tapBtn').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  await wait(700);
  const tip = document.querySelector('.tip');
  r.push('suggerimento Tap: "' + tip.textContent + '" visibile ' + tip.classList.contains('show'));
  return r.join('\n');
})()
