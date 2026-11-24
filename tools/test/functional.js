(async () => {
  const out = [], log = (k, v) => out.push(k + ': ' + v), $ = id => document.getElementById(id);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (fn()) return true; await wait(50); } return false; };
  const errors = []; window.addEventListener('error', e => errors.push(e.message));
  Looper.ask = (m, o) => Promise.resolve(o && o.value !== undefined ? o.value : true);
  const S = Looper.state, audio = $('audio');
  const press = el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
  try {
    // carica un brano sintetico a 128 BPM
    const file = bufToWav(makeSong(128, 30));
    const dt = new DataTransfer(); dt.items.add(file);
    $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
    log('griglia rilevata', await until(() => S.grid));
    log('BPM nel campo', $('bpm').value + ' ' + $('bpmNote').textContent + ' | riga tempo visibile: ' + !$('tempoRow').hidden);
    await wait(300);
    log('Recenti contiene il brano', (await Looper.db.list()).some(s => s.key === 'local:sintetico.wav:' + file.size));
    log('tempo salvato', !!localStorage.getItem('looper:tempo:local:sintetico.wav:' + file.size));

    // selezione con il mouse vicino ai beat: deve agganciarsi
    const cv = $('wave'), r = cv.getBoundingClientRect();
    const xOf = t => r.left + (t - S.view.start) / (S.view.end - S.view.start) * r.width;
    const pe = (type, x, id = 1, pt = 'mouse', alt = false) => cv.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: r.top + 40, pointerId: id, pointerType: pt, bubbles: true, button: 0, isPrimary: id === 1, altKey: alt }));
    const beat = 60 / S.grid.bpm, b = k => S.grid.offset + k * beat;
    pe('pointerdown', xOf(b(8) + 0.05)); pe('pointermove', xOf(b(10))); pe('pointermove', xOf(b(16) - 0.06)); pe('pointerup', xOf(b(16) - 0.06));
    log('selezione agganciata ai beat', Math.abs(S.region.start - b(8)) < 0.002 && Math.abs(S.region.end - b(16)) < 0.002);
    pe('pointerdown', xOf(b(20) + 0.05), 1, 'mouse', true); pe('pointermove', xOf(b(24) + 0.05), 1, 'mouse', true); pe('pointerup', xOf(b(24) + 0.05), 1, 'mouse', true);
    log('con Alt nessun aggancio', Math.abs(S.region.start - b(20)) > 0.02);
    pe('pointerdown', xOf(b(8) + 0.05)); pe('pointermove', xOf(b(12))); pe('pointerup', xOf(b(12)));
    const s0 = S.region.start;
    press($('startUp'));
    log('+ sposta inizio di un beat', (S.region.start - s0).toFixed(4) + ' s (beat ' + beat.toFixed(4) + ')');
    const endBefore = S.region.end;
    pe('pointerdown', xOf(S.region.end) + 2); pe('pointermove', xOf(S.region.end + 0.3)); pe('pointermove', xOf(b(14))); pe('pointerup', xOf(b(14)));
    log('maniglia fine trascinata e agganciata', Math.abs(S.region.end - b(14)) < 0.002 && endBefore !== S.region.end);

    // conteggio: n click, intervallo = 60 / (BPM x velocità)
    const calls = []; const orig = Looper.fx.playClicks;
    Looper.fx.playClicks = (n, iv, bpb) => { calls.push([n, +iv.toFixed(4), bpb]); return orig(n, iv, bpb); };
    $('pauseMode').value = 'bar1'; $('pauseMode').dispatchEvent(new Event('change'));
    Looper.app.applySpeed(0.5);
    log('suggerimento conteggio', $('countHint').textContent);
    $('play').click(); await wait(300);
    log('conteggio al primo Play', JSON.stringify(calls[0]) + ' atteso [4,' + (60 / (128 * 0.5)) + ',4]');
    log('in attesa durante il conteggio', $('play').textContent + ' paused=' + audio.paused);
    await wait(4000);
    log('dopo il conteggio suona', !audio.paused + ' t=' + audio.currentTime.toFixed(2) + ' (inizio passaggio ' + S.region.start.toFixed(2) + ')');
    $('stop').click();
    $('meter').value = '3'; $('meter').dispatchEvent(new Event('change'));
    calls.length = 0; $('play').click(); await wait(200);
    log('conteggio in 3/4', JSON.stringify(calls[0]));
    $('play').click(); $('stop').click();
    $('meter').value = '4'; $('meter').dispatchEvent(new Event('change'));
    $('pauseMode').value = 'none'; $('pauseMode').dispatchEvent(new Event('change'));

    // allenatore: 60% -> 70%, Normale (+5% ogni 2 giri)
    pe('pointerdown', xOf(b(8) + 0.02)); pe('pointermove', xOf(b(9))); pe('pointermove', xOf(b(10))); pe('pointerup', xOf(b(10)));
    $('trStart').value = 60; $('trStart').dispatchEvent(new Event('input'));
    $('trTarget').value = 70; $('trTarget').dispatchEvent(new Event('input'));
    document.querySelector('.tr-preset[data-p=normal]').click();
    $('trStartBtn').click();
    await wait(300);
    log('allenatore avviato', $('trainerStatus').textContent + ' | velocità ' + audio.playbackRate);
    await until(() => audio.playbackRate >= 0.7, 12000);
    await wait(100);
    log('allenatore arrivato', $('trainerStatus').textContent + ' | velocità ' + audio.playbackRate + ' | barra ' + $('trBar').style.width);
    press($('endDown'));
    log('ritocco bordo non azzera allenatore', audio.playbackRate);
    $('trStop').click();

    // sezioni
    $('saveSection').click(); await wait(50);
    log('sezioni', [...document.querySelectorAll('.chip .name')].map(x => x.textContent).join('|'));

    // tap tempo (a brano fermo): 4 tocchi a 100 BPM
    for (let i = 0; i < 4; i++) { $('tapBtn').click(); await wait(600); }
    log('tap 100 BPM', $('bpm').value + ' ' + $('bpmNote').textContent);
    $('bpmX2').click(); log('x2', $('bpm').value); $('bpmHalf').click(); log('/2', $('bpm').value);

    // zoom + panoramica + pizzico
    Looper.wave.zoomBy(8);
    log('zoom', $('zoomLabel').textContent + ' vista ' + S.view.start.toFixed(2) + '-' + S.view.end.toFixed(2));
    const ov = $('overview'), orr = ov.getBoundingClientRect();
    ov.dispatchEvent(new PointerEvent('pointerdown', { clientX: orr.left + orr.width * 0.8, clientY: orr.top + 5, pointerId: 3, bubbles: true }));
    ov.dispatchEvent(new PointerEvent('pointerup', { clientX: orr.left + orr.width * 0.8, clientY: orr.top + 5, pointerId: 3, bubbles: true }));
    log('tocco panoramica a 80%', 'testina ' + audio.currentTime.toFixed(2) + ' vista ' + S.view.start.toFixed(2) + '-' + S.view.end.toFixed(2));
    const sp0 = S.view.end - S.view.start, cx = r.left + r.width / 2;
    pe('pointerdown', cx - 50, 11, 'touch'); pe('pointerdown', cx + 50, 12, 'touch');
    pe('pointermove', cx - 150, 11, 'touch'); pe('pointermove', cx + 150, 12, 'touch');
    pe('pointerup', cx - 150, 11, 'touch'); pe('pointerup', cx + 150, 12, 'touch');
    log('pizzico x3', 'ampiezza vista ' + sp0.toFixed(2) + ' -> ' + (S.view.end - S.view.start).toFixed(2));

    // prestazioni su 5 minuti
    const big = makeSong(120, 300);
    let t0 = performance.now(); Looper.wave.setBuffer(big); S.duration = big.duration; S.view = { start: 0, end: big.duration };
    log('piramide 5 min', Math.round(performance.now() - t0) + ' ms');
    const times = [];
    for (let i = 0; i < 40; i++) {
      Looper.wave.setView(i * 3, 10 + i);
      t0 = performance.now(); Looper.wave.frame(); times.push(performance.now() - t0);
    }
    times.sort((a, c) => a - c);
    log('frame con ridisegno (mediana / max)', times[20].toFixed(2) + ' / ' + times[39].toFixed(2) + ' ms');
    t0 = performance.now(); for (let i = 0; i < 40; i++) Looper.wave.frame(); log('frame senza ridisegno', ((performance.now() - t0) / 40).toFixed(2) + ' ms');
  } catch (e) { log('ECCEZIONE', e.message + ' ' + e.stack); }
  log('errori JS', errors.length ? errors.join(' | ') : 'nessuno');
  return out.join('\n');
})()
