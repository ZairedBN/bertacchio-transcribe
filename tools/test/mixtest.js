(async () => {
  const T = Looper.fx._test, sr = 44100, out = [];
  const db = x => (20 * Math.log10(x)).toFixed(1);
  // segnale: fn(i) -> [L, R]
  async function render(fn, secs, opts) {
    const n = Math.floor(secs * sr), c = new OfflineAudioContext(2, n, sr);
    const b = c.createBuffer(2, n, sr), l = b.getChannelData(0), r = b.getChannelData(1);
    for (let i = 0; i < n; i++) { const v = fn(i); l[i] = v[0]; r[i] = v[1]; }
    const g = T.buildGraph(c);
    T.connectIso(g, c, opts.mode || 'normal');
    const gains = T.bandGains(opts.eq || { eqLow: 0, eqMid: 0, eqHigh: 0 });
    for (const k in gains) g[k].gain.value = gains[k];
    g.vol.gain.value = opts.vol || 1;
    const s = c.createBufferSource(); s.buffer = b; s.connect(g.isoIn); s.start();
    if (opts.switchAt) c.suspend(opts.switchAt).then(() => { T.connectIso(g, c, opts.switchTo); c.resume(); });
    const res = await c.startRendering();
    return [res.getChannelData(0), res.getChannelData(1)];
  }
  const rms = (a, from) => { let s = 0, k = 0; for (let i = Math.floor(from * sr); i < a.length; i++) { s += a[i] * a[i]; k++; } return Math.sqrt(s / k); };
  const sine = (f, a) => i => { const v = a * Math.sin(2 * Math.PI * f * i / sr); return [v, v]; };
  // 1) risposta piatta e banda spenta
  for (const f of [60, 250, 1000, 3000, 9000]) {
    const flat = await render(sine(f, 0.3), 0.6, {});
    const offLow = await render(sine(f, 0.3), 0.6, { eq: { eqLow: -30, eqMid: 0, eqHigh: 0 } });
    const offMid = await render(sine(f, 0.3), 0.6, { eq: { eqLow: 0, eqMid: -30, eqHigh: 0 } });
    const ref = 0.3 / Math.SQRT2;
    out.push(`${f}Hz piatto ${db(rms(flat[0], .3) / ref)} dB | bassi spenti ${db(rms(offLow[0], .3) / ref)} | medi spenti ${db(rms(offMid[0], .3) / ref)}`);
  }
  // 2) saturazione: rumore a piena scala, bassi +12, volume 150%
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  let lp = 0;
  const loud = await render(() => { lp = 0.9 * lp + 0.1 * rnd() * 8; const v = Math.max(-1, Math.min(1, lp)); return [v, v]; }, 2, { eq: { eqLow: 12, eqMid: 0, eqHigh: 0 }, vol: 1.5 });
  let pk = 0; for (const ch of loud) for (const v of ch) pk = Math.max(pk, Math.abs(v));
  out.push('picco con bassi +12 e volume 150%: ' + pk.toFixed(3));
  // 3) Ascolta: centro (1 kHz uguale nei due canali) + lato (500 Hz solo a sinistra)
  const mixFn = i => { const c = 0.3 * Math.sin(2 * Math.PI * 1000 * i / sr), s = 0.3 * Math.sin(2 * Math.PI * 500 * i / sr); return [c + s, c]; };
  const band = (a, f) => { // ampiezza della componente a f (DFT su 0.3..0.8s)
    let re = 0, im = 0; const i0 = Math.floor(.3 * sr), i1 = Math.floor(.8 * sr);
    for (let i = i0; i < i1; i++) { re += a[i] * Math.cos(2 * Math.PI * f * i / sr); im += a[i] * Math.sin(2 * Math.PI * f * i / sr); }
    return 2 * Math.hypot(re, im) / (i1 - i0);
  };
  for (const mode of ['normal', 'novocal', 'center', 'sides', 'bass', 'nobass', 'left']) {
    const o = await render(mixFn, 0.9, { mode });
    out.push(`${mode}: centro 1k ${db(band(o[0], 1000) / 0.3)} dB, lato 500 ${db(band(o[0], 500) / 0.3)} dB (L) / ${db(band(o[1], 500) / 0.3)} dB (R)`);
  }
  // 4) scatti al cambio di modalità
  for (const [a, b2] of [['normal', 'bass'], ['normal', 'sides'], ['novocal', 'normal']]) {
    const o = await render(sine(220, 0.3), 1, { mode: a, switchAt: 0.5, switchTo: b2 });
    let mx = 0; for (let i = Math.floor(.45 * sr); i < Math.floor(.65 * sr); i++) mx = Math.max(mx, Math.abs(o[0][i] - o[0][i - 1]));
    out.push(`cambio ${a}→${b2}: salto massimo tra campioni ${mx.toFixed(4)} (normale ≈ 0.0094)`);
  }
  return out.join('\n');
})()
