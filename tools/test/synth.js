// genera un brano sintetico: kick su 1 e 3, rullante su 2 e 4, hi-hat in ottavi, accordo tenuto
window.makeSong = (bpm, seconds = 60, first = 0.37, sr = 44100) => {
  const n = Math.floor(seconds * sr), L = new Float32Array(n), R = new Float32Array(n);
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const beat = 60 / bpm;
  const add = (t0, dur, fn) => { const s0 = Math.floor(t0 * sr), s1 = Math.min(n, s0 + Math.floor(dur * sr)); for (let i = Math.max(0, s0); i < s1; i++) { const v = fn((i - s0) / sr); L[i] += v; R[i] += v; } };
  for (let k = 0; first + k * beat / 2 < seconds; k++) {
    const t = first + k * beat / 2, b = k / 2;
    if (k % 2 === 0) {
      const bi = b % 4;
      if (bi === 0 || bi === 2) add(t, 0.25, x => (bi === 0 ? 0.9 : 0.5) * Math.sin(2 * Math.PI * (50 + 60 * Math.exp(-x * 30)) * x) * Math.exp(-x * 12));
      else add(t, 0.15, x => 0.35 * rnd() * Math.exp(-x * 25));
    }
    add(t, 0.04, x => 0.12 * rnd() * Math.exp(-x * 90));
  }
  for (let i = 0; i < n; i++) { const t = i / sr; const p = 0.05 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277.2 * t) + Math.sin(2 * Math.PI * 329.6 * t)); L[i] += p; R[i] += p * 0.9; }
  const buf = new AudioBuffer({ length: n, sampleRate: sr, numberOfChannels: 2 });
  buf.copyToChannel(L, 0); buf.copyToChannel(R, 1);
  return buf;
};
window.bufToWav = buf => {
  const n = buf.length, ch = buf.numberOfChannels, sr = buf.sampleRate, ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab);
  const ws = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, ch, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const d = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { v.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 32767, true); o += 2; }
  return new File([ab], 'sintetico.wav', { type: 'audio/wav' });
};
'ok'
