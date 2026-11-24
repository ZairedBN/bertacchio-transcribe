// segue polish.js (stesso brano: 120 BPM, beat ogni 0,5 s da 0,5): finestra vera, A/B e beat 1 a tempo, rotella
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const key = (k, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const S = Looper.state, H = Looper.wave.hooks, r = [], f = x => x == null ? 'null' : x.toFixed(2);
  const onBeat = t => Math.abs(Looper.nearestBeat(S.grid, t) - t) < 1e-3;
  const dlg = $('askDlg');

  // ---------- finestra per il nome ----------
  H.setRegion(22.5, 26.5);
  $('saveSection').click(); await wait(50);
  r.push('Salva: finestra aperta ' + dlg.open + ' · testo "' + $('askText').textContent + '" · valore "' + $('askIn').value + '" · OK "' + $('askOk').textContent + '"');
  $('askIn').value = 'Ponte';
  $('askOk').click(); await wait(50);
  r.push('dopo OK: finestra chiusa ' + !dlg.open + ' · sezioni ' + S.sections.map(s => s.name).join(', '));
  // Esc / Annulla non salvano
  H.setRegion(26.5, 28.5);
  $('saveSection').click(); await wait(50);
  $('askNo').click(); await wait(50);
  r.push('Annulla: sezioni ' + S.sections.length + ' (attese 3)');
  // matita: rinomina la sezione in ascolto
  key('3'); await wait(30);
  document.querySelector('.chip.on button.ren').click(); await wait(50);
  r.push('matita: finestra ' + dlg.open + ' valore "' + $('askIn').value + '" (atteso Ponte)');
  $('askIn').value = 'Bridge';
  $('askForm').requestSubmit(); await wait(50);
  r.push('rinominata: ' + S.sections[2].name);
  // elimina: pulsante rosso
  document.querySelectorAll('.chip button.x')[2].click(); await wait(50);
  r.push('elimina: finestra ' + dlg.open + ' · campo nascosto ' + $('askIn').hidden + ' · OK "' + $('askOk').textContent + '" rosso ' + $('askOk').classList.contains('danger'));
  $('askOk').click(); await wait(50);
  r.push('dopo Elimina: sezioni ' + S.sections.length + ' (attese 2)');
  // mentre la finestra è aperta, Spazio non fa ripartire il brano
  H.setRegion(4.5, 8.5);
  $('saveSection').click(); await wait(50);
  $('askOk').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  r.push('Spazio con la finestra aperta: brano fermo ' + a.paused);
  $('askNo').click(); await wait(30);

  // ---------- A / B ----------
  H.clearRegion();
  H.seek(5.2); key('a');
  r.push('A da fermo lontano dal beat: ' + f(S.region.start) + ' (atteso 5.20)');
  H.seek(5.03); key('a');
  r.push('A da fermo vicino al beat: ' + f(S.region.start) + ' (atteso 5.00)');
  H.seek(9.97); key('b');
  r.push('B da fermo vicino al beat: ' + f(S.region.end) + ' (atteso 10.00)');
  $('loop').checked = false;
  H.seek(3); a.play(); await wait(900);
  const tA = a.currentTime; key('a');
  r.push('A durante l\'ascolto: testina ' + f(tA) + ' → inizio ' + f(S.region.start) + ' sul beat ' + onBeat(S.region.start));
  await wait(1300);
  const tB = a.currentTime; key('b');
  r.push('B durante l\'ascolto: testina ' + f(tB) + ' → fine ' + f(S.region.end) + ' sul beat ' + onBeat(S.region.end));
  a.pause(); $('loop').checked = true;
  key('z', { ctrlKey: true });
  r.push('Ctrl+Z dopo B: inizio ' + f(S.region.start) + ' fine ' + f(S.region.end));
  // senza aggancio: punto esatto
  $('snap').checked = false; $('snap').dispatchEvent(new Event('change'));
  H.seek(5.03); key('a');
  r.push('A senza aggancio: ' + f(S.region.start) + ' (atteso 5.03)');
  $('snap').checked = true; $('snap').dispatchEvent(new Event('change'));

  // ---------- il beat 1 è qui ----------
  const off0 = S.grid.offset;
  H.seek(7.04); $('beatOne').click();
  r.push('beat 1 a 7.04: offset ' + f(S.grid.offset) + ' (atteso 1.00 = 7.0 modulo 2 s)');
  H.seek(7.25); $('beatOne').click();
  r.push('beat 1 a 7.25 (tra due beat): offset ' + f(S.grid.offset) + ' (atteso 1.25)');
  Looper.wave.hooks.seek(0);
  S.grid.offset = off0; Looper.wave.invalidate();

  // ---------- rotella ----------
  Looper.wave.setView(0, S.duration);
  const cv = $('wave'), rc = cv.getBoundingClientRect();
  const wheel = (dy, o = {}) => { const e = new WheelEvent('wheel', { deltaY: dy, clientX: rc.left + rc.width / 2, clientY: rc.top + 20, bubbles: true, cancelable: true, ...o }); cv.dispatchEvent(e); return e.defaultPrevented; };
  const giu = wheel(100);
  r.push('rotella giù senza zoom: pagina libera di scorrere ' + !giu + ' · zoom ' + Looper.wave.isZoomed());
  wheel(-100);
  const sp1 = S.view.end - S.view.start;
  r.push('rotella su: zoom ' + Looper.wave.isZoomed() + ' ampiezza ' + f(sp1) + ' (da ' + f(S.duration) + ', centro ' + f((S.view.start + S.view.end) / 2) + ')');
  const s0 = S.view.start; wheel(100, { shiftKey: true });
  r.push('Maiusc+rotella: scorre ' + (S.view.start > s0) + ' ampiezza invariata ' + (Math.abs(S.view.end - S.view.start - sp1) < 1e-6));
  wheel(100);
  r.push('rotella giù con zoom: ampiezza ' + f(S.view.end - S.view.start));
  for (let i = 0; i < 10; i++) wheel(100);
  r.push('dopo 10 scatti giù: zoom ' + Looper.wave.isZoomed());
  return r.join('\n');
})();
