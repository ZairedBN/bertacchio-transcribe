// velocità ricordata per brano, annulla dell'eliminazione di una sezione, tasti fermi con la finestra "Tasti" aperta
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  const key = (k, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const S = Looper.state, H = Looper.wave.hooks, r = [];
  Object.keys(localStorage).filter(k => /sections:|tempo:|speed:/.test(k)).forEach(k => localStorage.removeItem(k));
  const load = async (bpm, len, name) => {
    const f0 = bufToWav(makeSong(bpm, len, 0.5)), f = new File([f0], name, { type: 'audio/wav' });
    const dt = new DataTransfer(); dt.items.add(f);
    S.grid = null;
    $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
    for (let i = 0; i < 100 && !S.grid; i++) await wait(100);
  };
  const sp = () => a.playbackRate.toFixed(2);

  // ---------- velocità per brano ----------
  await load(120, 20, 'brano-a.wav');
  r.push('brano A nuovo: ' + sp() + ' (atteso 1.00)');
  Looper.app.applySpeed(0.7);
  await load(100, 20, 'brano-b.wav');
  r.push('brano B nuovo (dopo A a 0.70): ' + sp() + ' (atteso 1.00)');
  Looper.app.applySpeed(0.85);
  await load(120, 20, 'brano-a.wav');
  r.push('riapro A: ' + sp() + ' (atteso 0.70)');
  await load(100, 20, 'brano-b.wav');
  r.push('riapro B: ' + sp() + ' (atteso 0.85)');

  // ---------- annulla l'eliminazione di una sezione ----------
  const dlg = $('askDlg');
  const save = async (s, e, n) => { H.setRegion(s, e); $('saveSection').click(); await wait(30); $('askIn').value = n; $('askOk').click(); await wait(30); };
  await save(2.5, 6.5, 'Intro');
  await save(8.5, 12.5, 'Strofa');
  H.setRegion(14, 16);
  document.querySelectorAll('.chip button.x')[0].click(); await wait(30);
  $('askOk').click(); await wait(30);
  r.push('eliminata Intro: ' + S.sections.map(s => s.name).join(', ') + ' · ↶ attivo ' + !$('undoReg').disabled);
  key('z', { ctrlKey: true }); await wait(20);
  r.push('Ctrl+Z: ' + S.sections.map(s => s.name).join(', ') + ' (atteso Intro, Strofa) · passaggio invariato ' + (S.region.start === 14));
  r.push('salvata anche in memoria: ' + JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.includes('sections:local:brano-b')))).length + ' (attese 2)');
  key('y', { ctrlKey: true }); await wait(20);
  r.push('Ctrl+Y: ' + S.sections.map(s => s.name).join(', ') + ' (atteso Strofa)');
  $('undoReg').click(); await wait(20);
  r.push('↶: ' + S.sections.map(s => s.name).join(', ') + ' (atteso Intro, Strofa)');
  $('undoReg').click(); await wait(20);
  r.push('↶ ancora: passaggio ' + (S.region ? S.region.start.toFixed(2) + '-' + S.region.end.toFixed(2) : 'nessuno') + ' (atteso 14.00-16.00: niente altro da annullare)');

  // ---------- finestra "Tasti" aperta ----------
  a.pause(); H.seek(5);
  $('keysBtn').click(); await wait(30);
  key(' '); key('p'); key('a'); await wait(50);
  r.push('Tasti aperta, Spazio/P/A: brano fermo ' + a.paused + ' · testina ' + a.currentTime.toFixed(2) + ' (atteso 5.00)');
  key('?'); await wait(30);
  r.push('? la chiude: ' + !$('keysDlg').open);
  return r.join('\n');
})();
