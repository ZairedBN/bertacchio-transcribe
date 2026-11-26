// ottava del BPM (doppio / metà): brani sintetici con ritmi diversi a tanti tempi.
// Giusto = BPM corretto (±0,5), oppure BPM sbagliato di ×2/÷2 ma con l'avviso (alt) sul valore corretto.
// Sbagliare senza avviso è un errore. Un avviso su un BPM già giusto è "avviso inutile" (da tenere basso).
(async () => {
  const sr = 22050;
  const song = (bpm, style, seconds = 40) => {
    const n = Math.floor(seconds * sr), X = new Float32Array(n);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const beat = 60 / bpm, first = 0.41;
    const add = (t0, dur, fn) => { const s0 = Math.floor(t0 * sr), s1 = Math.min(n, s0 + Math.floor(dur * sr)); for (let i = Math.max(0, s0); i < s1; i++) X[i] += fn((i - s0) / sr); };
    const kick = (t, g = 0.9) => add(t, 0.25, x => g * Math.sin(2 * Math.PI * (50 + 60 * Math.exp(-x * 30)) * x) * Math.exp(-x * 12));
    // rullante: rumore + corpo a 180 Hz; hi-hat: rumore filtrato sugli acuti (come i piatti veri)
    const snare = (t, g = 0.4) => add(t, 0.15, x => g * (0.8 * rnd() + 0.5 * Math.sin(2 * Math.PI * 180 * x)) * Math.exp(-x * 25));
    const hat = (t, g = 0.12) => { let p1 = 0, p2 = 0; add(t, 0.05, x => { const w = rnd(), h = (w - 2 * p1 + p2) / 4; p2 = p1; p1 = w; return g * 2 * h * Math.exp(-x * 70); }); };
    for (let k = 0; first + k * beat < seconds; k++) {
      const t = first + k * beat, bi = k % 4;
      if (style === 'rock' || style === 'nohat' || style === 'hat16') {
        if (bi === 0 || bi === 2) kick(t, bi === 0 ? 0.9 : 0.6); else snare(t);
      } else if (style === 'halftime') {
        if (bi === 0) kick(t); if (bi === 2) snare(t, 0.5);
      } else if (style === 'dance') {
        kick(t); if (bi === 1 || bi === 3) snare(t, 0.3);
      }
      if (style === 'rock' || style === 'halftime') { hat(t); hat(t + beat / 2); }
      if (style === 'hat16') for (let j = 0; j < 4; j++) hat(t + j * beat / 4, j ? 0.08 : 0.12);
      if (style === 'dance') hat(t + beat / 2, 0.2);
    }
    for (let i = 0; i < n; i++) { const t = i / sr; X[i] += 0.05 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t)); }
    const buf = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 1 });
    buf.copyToChannel(X, 0);
    return buf;
  };
  const near = (a, b) => a != null && Math.abs(a - b) <= 0.5;
  // half-time (rullante solo sul 3): anche un musicista può contarlo pieno o a metà, vanno bene tutti e due
  const fits = (v, bpm, style) => near(v, bpm) || (style === 'halftime' && near(v, bpm / 2));
  const tempos = [60, 70, 85, 100, 120, 140, 160, 174, 200, 240, 286];
  const styles = ['rock', 'nohat', 'hat16', 'halftime', 'dance'];
  const out = []; let ok = 0, warned = 0, wrong = 0, useless = 0;
  for (const style of styles) for (const bpm of tempos) {
    if (style === 'halftime' && (bpm < 120 || bpm > 200)) continue;   // half-time vero: solo a tempi medi/veloci (a 100 sarebbe una sensazione di 50 BPM)
    const r = await Looper.detectTempo(song(bpm, style));
    const got = r && r.bpm, alt = r && r.alt;
    let v;
    if (fits(got, bpm, style)) { const inutile = alt && !fits(alt, bpm, style); v = inutile ? 'giusto (avviso inutile ' + alt + ')' : 'giusto'; ok++; if (inutile) useless++; }
    else if (fits(alt, bpm, style)) { v = 'sbagliato ma con avviso'; warned++; }
    else { v = 'ERRORE'; wrong++; }
    out.push(style + ' ' + bpm + ': ' + got + (alt ? ' (forse ' + alt + ')' : '') + ' → ' + v);
  }
  out.push('TOTALE: giusti ' + ok + ', con avviso ' + warned + ', errori ' + wrong + ' (atteso 0), avvisi inutili ' + useless + ' (atteso pochi)');
  return out.join('\n');
})()
