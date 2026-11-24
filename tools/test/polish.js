// Rifiniture del 24/11/2026: annulla, aggiorna sezione, velocità della sezione, A/B e beat 1 a tempo,
// finestra per nomi/conferme, matita per rinominare, rotella per lo zoom
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const key = (k, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  Object.keys(localStorage).filter(k => k.includes('sections:') || k.includes('tempo:')).forEach(k => localStorage.removeItem(k));
  const file = bufToWav(makeSong(120, 30, 0.5));    // beat ogni 0,5 s a partire da 0,5
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, H = Looper.wave.hooks, r = [], f = x => x == null ? 'null' : x.toFixed(2);
  const reg = () => S.region ? f(S.region.start) + '-' + f(S.region.end) : 'nessuna';
  $('pauseMode').value = 'none'; $('pauseMode').dispatchEvent(new Event('change'));
  r.push('griglia ' + JSON.stringify(S.grid));
  r.push('Annulla disattivo all\'inizio: ' + $('undoReg').disabled + ' (atteso true)');

  // ---------- annulla ----------
  const cv = $('wave'), rc = cv.getBoundingClientRect(), xOf = t => rc.left + (t - S.view.start) / (S.view.end - S.view.start) * rc.width;
  const fire = (t, x, id = 1) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: id, clientX: x, clientY: rc.top + rc.height / 2, pointerType: 'mouse', button: 0 }));
  const dragWave = async (t0, t1) => { fire('pointerdown', xOf(t0)); for (let i = 1; i <= 5; i++) fire('pointermove', xOf(t0 + (t1 - t0) * i / 5)); fire('pointerup', xOf(t1)); await wait(30); };
  await dragWave(4.5, 8.5);
  r.push('selezione trascinata: ' + reg() + ' (atteso 4.50-8.50)');
  await dragWave(14.5, 20.5);                     // trascinamento "per sbaglio"
  r.push('seconda selezione: ' + reg());
  key('z', { ctrlKey: true });
  r.push('Ctrl+Z: ' + reg() + ' (atteso 4.50-8.50)');
  key('y', { ctrlKey: true });
  r.push('Ctrl+Y: ' + reg() + ' (atteso 14.50-20.50)');
  key('z', { ctrlKey: true });
  key('Delete');
  r.push('Canc: ' + reg());
  $('undoReg').click();
  r.push('pulsante ↶ dopo Canc: ' + reg() + ' (atteso 4.50-8.50)');
  // tenere premuto + sulla fine: diventa un solo passo
  for (let i = 0; i < 4; i++) { $('endUp').dispatchEvent(new PointerEvent('pointerdown', { button: 0 })); $('endUp').dispatchEvent(new PointerEvent('pointerup', { button: 0 })); }
  r.push('fine +4 beat: ' + reg() + ' (atteso 4.50-10.50)');
  key('z', { ctrlKey: true });
  r.push('un solo Ctrl+Z: ' + reg() + ' (atteso 4.50-8.50)');
  key('z', { ctrlKey: true });
  r.push('ancora Ctrl+Z: ' + reg() + ' (atteso nessuna)');
  r.push('Annulla disattivo a fine storia: ' + $('undoReg').disabled);

  // ---------- sezioni: salva, aggiorna, velocità ----------
  const realAsk = Looper.ask;
  Looper.ask = (m, o) => Promise.resolve(o && o.value !== undefined ? o.value : true);
  H.setRegion(4.5, 8.5); $('saveSection').click(); await wait(30);
  H.setRegion(12.5, 16.5); $('saveSection').click(); await wait(30);
  r.push('sezioni: ' + S.sections.map(s => s.name + ' ' + f(s.start) + '-' + f(s.end)).join(' | '));
  key('1');
  r.push('richiamata 1: ' + reg() + ' · Aggiorna nascosto ' + $('updSection').hidden);
  $('endUp').dispatchEvent(new PointerEvent('pointerdown', { button: 0 })); $('endUp').dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  r.push('dopo ritocco: Aggiorna visibile ' + !$('updSection').hidden + ' testo "' + $('updSection').textContent + '"');
  $('updSection').click();
  r.push('dopo Aggiorna: sezione 1 ' + f(S.sections[0].start) + '-' + f(S.sections[0].end) + ' (atteso 4.50-9.00) · scheda attiva ' + document.querySelectorAll('.chip.on').length + ' · pulsante nascosto ' + $('updSection').hidden);
  H.setRegion(22, 26);
  r.push('selezione lontana: Aggiorna nascosto ' + $('updSection').hidden);
  key('1'); key('-'); key('-');          // 0.90
  key('2');
  r.push('sezione 2: velocità ' + a.playbackRate + ' (attesa 1)');
  key('1');
  r.push('di nuovo sezione 1: velocità ' + a.playbackRate + ' (attesa 0.9) · scheda "' + document.querySelector('.chip.on small').textContent + '"');
  r.push('sezione 2 non toccata: ' + S.sections[1].speed);
  key('0');

  // ---------- matita e finestra vera ----------
  Looper.ask = realAsk;
  r.push('matita sulla scheda attiva: ' + document.querySelectorAll('.chip.on button.ren').length + ', sulle altre: ' + document.querySelectorAll('.chip:not(.on) button.ren').length);
  r.push('Looper.ask vera: ' + (typeof Looper.ask));
  return r.join('\n');
})();
