// Precisione del conteggio: registra l'uscita della catena audio e misura quanto il beat 1
// (cassa del brano sintetico) cade lontano dal punto dove dovrebbe, cioè un intervallo dopo l'ultimo click.
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms)), a = $('audio');
  // registratore: si aggancia a tutto ciò che va verso l'uscita del contesto
  let ctx = null, rec = null;
  const chunks = [];
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = origConnect.call(this, dest, ...rest);
    if (dest instanceof AudioDestinationNode && this !== rec) {
      if (!rec) {
        ctx = dest.context;
        rec = ctx.createScriptProcessor(1024, 1, 1);
        rec.onaudioprocess = e => { if (window.__recOn) chunks.push({ t: e.playbackTime, d: e.inputBuffer.getChannelData(0).slice() }); };
        origConnect.call(rec, ctx.destination);
      }
      origConnect.call(this, rec);
    }
    return r;
  };
  // istante (orologio audio) del primo click di ogni conteggio
  let clickT0 = null, clickInterval = null, clickN = null;
  const origClicks = Looper.fx.playClicks;
  Looper.fx.playClicks = function (n, interval, bpb) {
    Looper.fx.ensure();
    if (ctx) { clickT0 = ctx.currentTime + 0.05; clickInterval = interval; clickN = n; }
    return origClicks.apply(this, arguments);
  };

  const file = bufToWav(makeSong(120, 40, 0.5));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const H = Looper.wave.hooks, out = [];
  $('pauseMode').value = 'bar1'; $('pauseMode').dispatchEvent(new Event('change'));
  $('countFirst').checked = true;

  // analisi: primo click (sopra soglia) e prima cassa (filtro passa-basso) dopo il conteggio
  function analyse(regionStart, rate) {
    const sr = ctx.sampleRate;
    let firstClick = null, kick = null, lp = 0;
    const k = 1 - Math.exp(-2 * Math.PI * 150 / sr);
    const nextKick = 0.5 + Math.max(0, Math.ceil(regionStart - 0.5 - 1e-6));   // casse a 0,5 · 1,5 · 2,5 …
    // si misura la seconda cassa dopo il beat 1: la prima è coperta dalla dissolvenza d'ingresso
    const downbeat = clickT0 + clickN * clickInterval + (nextKick + 1 - regionStart) / rate;
    for (const c of chunks) {
      for (let i = 0; i < c.d.length; i++) {
        const t = c.t + i / sr, v = c.d[i];
        lp += k * (v - lp);
        if (firstClick === null && t > clickT0 - 0.2 && Math.abs(v) > 0.05) firstClick = t;
        if (kick === null && firstClick !== null && t > downbeat - 0.15 && Math.abs(lp) > 0.2) kick = t;
      }
    }
    if (firstClick === null || kick === null) return 'non misurabile (click ' + firstClick + ', cassa ' + kick + ')';
    const delay = firstClick - clickT0;                 // ritardo comune della catena (limitatore, registratore)
    const err = (kick - delay - downbeat) * 1000;
    return err.toFixed(1) + ' ms';
  }

  let busy = null;   // pagina sotto sforzo: blocchi di calcolo da 25 ms ogni 40 ms
  const startBusy = () => { busy = setInterval(() => { const e = performance.now() + 25; while (performance.now() < e); }, 40); };
  const stopBusy = () => { clearInterval(busy); busy = null; };

  async function trial(start, rate, label, load) {
    H.setRegion(start, start + 4);
    $('speedIn').value = rate; $('speedIn').dispatchEvent(new Event('change'));
    a.pause(); await wait(300);
    chunks.length = 0; window.__recOn = true;
    if (load) startBusy();
    $('restartBtn').click();
    const interval = 60 / (120 * rate);
    await wait((4 * interval + 1.4 / rate + 0.3) * 1000);
    window.__recOn = false;
    stopBusy();
    a.pause();
    out.push(label + ': scarto beat 1 = ' + analyse(start, rate) + ' ' + (rate !== 1 && $('pitch').checked ? '(atteso |x| < 35 ms: con "mantieni intonazione" il browser sposta i colpi da solo)' : '(atteso |x| < 10 ms, sotto sforzo < 20 ms; positivo = brano in ritardo)'));
  }

  for (let i = 0; i < 4; i++) await trial(4.5, 1, 'velocità 1×, prova ' + (i + 1));
  await trial(4.5, 0.5, 'velocità 0,5×');
  await trial(6.5, 0.75, 'velocità 0,75×');
  await trial(8.5, 1.5, 'velocità 1,5×');
  await trial(0.5, 1, 'passaggio vicino all\'inizio (0:00,5)');
  await trial(0, 1, 'passaggio da 0:00 (niente spazio per partire prima)');
  // senza "mantieni intonazione": a velocità diverse da 1× l'algoritmo del browser sposta i colpi di ±15 ms da solo
  $('pitch').checked = false; $('pitch').dispatchEvent(new Event('change'));
  await trial(4.5, 0.5, 'velocità 0,5× senza "mantieni intonazione"');
  await trial(4.5, 1.5, 'velocità 1,5× senza "mantieni intonazione"');
  $('pitch').checked = true; $('pitch').dispatchEvent(new Event('change'));
  for (let i = 0; i < 3; i++) await trial(4.5, 1, 'pagina sotto sforzo, prova ' + (i + 1), true);
  await trial(4.5, 0.5, 'pagina sotto sforzo, 0,5×', true);
  $('speedIn').value = 1; $('speedIn').dispatchEvent(new Event('change'));
  out.push('contesto audio: ' + (ctx ? ctx.state + ', ' + ctx.sampleRate + ' Hz' : 'assente'));
  return out.join('\n');
})()
