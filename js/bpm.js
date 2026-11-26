/* Looper — rilevamento del tempo (BPM e posizione del beat 1) */
(L => {
  'use strict';

  // Codice di analisi: usato in un Worker (la pagina non si blocca) o, se non si può, direttamente.
  const TEMPO_SRC = `
  function analyzeTempo(x, sr) {
    const hop = Math.max(32, Math.round(sr / 172));        // ~5.8 ms
    const hopSec = hop / sr;
    const ALT_RATIO = 0.8;   // il doppio/la metà ha almeno l'80% del punteggio (senza la preferenza per 120): si propone
    const ALT_EXTREME = 1.1; // per un tempo sopra 200 o sotto 60 serve il 110%
    const N = Math.floor(x.length / hop);
    if (N < 400) return null;

    // 1) energia per frame (tutto lo spettro e solo bassi)
    const he = new Float32Array(N), hb = new Float32Array(N);
    const a = Math.exp(-2 * Math.PI * 150 / sr);
    let lp = 0;
    for (let n = 0; n < N; n++) {
      let se = 0, sb = 0;
      const s0 = n * hop, s1 = s0 + hop;
      for (let i = s0; i < s1; i++) {
        const v = x[i];
        se += v * v;
        lp = (1 - a) * v + a * lp;
        sb += lp * lp;
      }
      he[n] = se; hb[n] = sb;
    }
    // finestra di 4 passi (~23 ms) centrata: smorza i battimenti tra note tenute
    const e = new Float32Array(N), b = new Float32Array(N);
    let sumE = 0, sumB = 0;
    for (let n = 0; n < N; n++) {
      let se = 0, sb = 0;
      for (let k = n - 2; k <= n + 1; k++) if (k >= 0 && k < N) { se += he[k]; sb += hb[k]; }
      e[n] = se; b[n] = sb; sumE += se; sumB += sb;
    }
    const mE = sumE / N || 1e-12, mB = sumB / N || 1e-12;
    for (let n = 0; n < N; n++) { e[n] = Math.log(1 + 50 * e[n] / mE); b[n] = Math.log(1 + 50 * b[n] / mB); }

    // 2) forza degli attacchi (aumento di energia), meno la media locale
    const detrend = (arr) => {
      const W = Math.max(2, Math.round(0.04 / hopSec));   // finestra corta: restano solo gli attacchi netti
      const pre = new Float64Array(N + 1);
      for (let n = 0; n < N; n++) pre[n + 1] = pre[n] + arr[n];
      const out = new Float32Array(N);
      for (let n = 0; n < N; n++) {
        const lo = Math.max(0, n - W), hi = Math.min(N, n + W + 1);
        const v = arr[n] - (pre[hi] - pre[lo]) / (hi - lo);
        out[n] = v > 0 ? v : 0;
      }
      return out;
    };
    const fluxAll = new Float32Array(N), fluxLow = new Float32Array(N);
    for (let n = 1; n < N; n++) {
      const d1 = e[n] - e[n - 1], d2 = b[n] - b[n - 1];
      fluxAll[n] = d1 > 0 ? d1 : 0;
      fluxLow[n] = d2 > 0 ? d2 : 0;
    }
    const low = detrend(fluxLow);
    const fa = detrend(fluxAll);
    const O = new Float32Array(N);
    for (let n = 0; n < N; n++) O[n] = fa[n] + 0.3 * low[n];   // i bassi pesano poco: altrimenti la cassa sui beat 1 e 3 fa scegliere metà tempo

    // 3) autocorrelazione tra 50 e 200 BPM, con preferenza morbida intorno a 120
    //    (i tempi più veloci, fino a 300, arrivano dalla scelta dell'ottava più sotto)
    const lagOf = bpm => 60 / bpm / hopSec;
    const lagMin = Math.floor(lagOf(200)), lagMax = Math.ceil(lagOf(50));
    const maxLag = Math.min(N - 1, lagMax * 2 + 2);
    // sul segnale senza la sua media: altrimenti nei brani con pochi colpi il fondo piatto,
    // moltiplicato per la preferenza intorno a 120, vince su un picco vero lontano da 120
    let mO = 0;
    for (let n = 0; n < N; n++) mO += O[n];
    mO /= N;
    const Oc = new Float32Array(N);
    for (let n = 0; n < N; n++) Oc[n] = O[n] - mO;
    const r = new Float32Array(maxLag + 1);
    for (let L = lagMin; L <= maxLag; L++) {
      let s = 0;
      for (let n = 0, m = N - L; n < m; n++) s += Oc[n] * Oc[n + L];
      r[L] = Math.max(0, s / (N - L));
    }
    const score = new Float32Array(lagMax + 2);
    let best = -1, bestL = lagMin;
    for (let L = lagMin; L <= lagMax; L++) {
      const bpm = 60 / (L * hopSec);
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.7, 2));
      score[L] = (r[L] + 0.5 * (2 * L <= maxLag ? r[2 * L] : 0)) * prior;
      if (score[L] > best) { best = score[L]; bestL = L; }
    }
    const peakBpm = L0 => {
      let Lf = L0;
      if (L0 > lagMin && L0 < lagMax) {
        const y0 = score[L0 - 1], y1 = score[L0], y2 = score[L0 + 1];
        const den = y0 - 2 * y1 + y2;
        if (den < 0) Lf = L0 + 0.5 * (y0 - y2) / den;
      }
      return 60 / (Lf * hopSec);
    };
    let bpm0 = peakBpm(bestL);

    // 4) affinamento: allinea un pettine di beat su tutto il brano
    const comb = (bpm) => {
      const P = lagOf(bpm);
      let bestS = -1, bestPh = 0, sumS = 0, cnt = 0;
      for (let ph = 0; ph < P; ph += 1) {
        let s = 0, k = 0;
        for (let t = ph; t < N - 2; t += P, k++) {
          const i = Math.round(t);
          s += O[i] + 0.5 * ((i > 0 ? O[i - 1] : 0) + O[i + 1]);
        }
        s /= (k || 1);
        sumS += s; cnt++;
        if (s > bestS) { bestS = s; bestPh = ph; }
      }
      return { bpm, score: bestS, phase: bestPh, mean: sumS / (cnt || 1) };
    };
    // nei brani con pochi colpi il picco più alto può essere un tempo "storto" (es. 150 per un 60):
    // tra i picchi quasi altrettanto alti si tiene quello che cade meglio sui colpi
    {
      const salience = bpm => { const c = comb(bpm); return c.mean > 0 ? c.score / c.mean : 0; };
      let bestSal = salience(bpm0);
      for (let L = lagMin + 1; L < lagMax; L++) {
        if (L === bestL || !(score[L] >= score[L - 1] && score[L] > score[L + 1] && score[L] >= 0.6 * best)) continue;
        const b = peakBpm(L), ratio = b > bpm0 ? b / bpm0 : bpm0 / b;
        if ([1, 1.5, 2, 3].some(q => Math.abs(ratio / q - 1) < 0.04)) continue;   // stesso tempo o parente stretto
        const s = salience(b);
        if (s > bestSal * 1.15) { bestSal = s; bpm0 = b; }
      }
    }
    const at = i => O[i] + 0.5 * ((i > 0 ? O[i - 1] : 0) + O[i + 1]);
    // scelta dell'ottava (metà / stesso / doppio): al tempo giusto gli attacchi cadono sui beat e non
    // a metà tra un beat e l'altro (a metà tempo lì cadrebbe il rullante; al doppio metà dei beat restano vuoti)
    const contrast = bpm => {
      const Pc = lagOf(bpm);
      let raw = 0;
      for (let ph = 0; ph < Pc; ph += 1) {
        let on = 0, off = 0, k = 0;
        for (let t = ph; t + Pc / 2 < N - 2; t += Pc, k++) { on += at(Math.round(t)); off += at(Math.round(t + Pc / 2)); }
        // differenza × quanto è netta (a metà tempo la cassa sui beat batte il rullante a metà, ma di poco)
        const d = on - off;
        if (k && d > 0) raw = Math.max(raw, d * d / ((on + off) * k));
      }
      const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.0, 2));
      return { raw, v: raw * prior };
    };
    const cands = [];
    // solo metà / stesso / doppio: un terzo del tempo vincerebbe sempre (a metà tra i suoi beat non c'è nulla)
    for (const cand of [bpm0 / 2, bpm0, bpm0 * 2]) if (cand >= 50 && cand <= 300) cands.push({ bpm: cand, ...contrast(cand) });
    cands.sort((p, q) => q.v - p.v);
    const center = cands[0].bpm;
    // il doppio o la metà è quasi altrettanto probabile? allora l'app lo dice ("Forse è …?")
    // (tra doppio e metà si propone quello che i colpi confermano di più, senza la preferenza per 120)
    const oct = cands.filter(c => c.bpm !== center).sort((p, q) => q.raw - p.raw)[0];
    // tempi estremi (sopra 200, sotto 60) solo se i colpi li confermano chiaramente: un hi-hat in sedicesimi
    // farebbe proporre il doppio a ogni brano disco/funk
    const need = oct && (oct.bpm > 200 || oct.bpm < 59.5) ? ALT_EXTREME : ALT_RATIO;
    const rival = oct && cands[0].raw > 0 && oct.raw >= need * cands[0].raw ? (oct.bpm > center ? 2 : 0.5) : 0;
    let top = comb(center);
    for (let bb = center * 0.97; bb <= center * 1.03; bb += 0.05) {
      const c = comb(bb);
      if (c.score > top.score) top = c;
    }
    // i brani hanno quasi sempre BPM interi: preferisci l'intero vicino se va bene quasi uguale
    const ib = Math.round(top.bpm);
    if (Math.abs(ib - top.bpm) < 0.35) {
      const c = comb(ib);
      if (c.score >= top.score * 0.97) top = c;
    }

    if (!(top.score > 0) || !(top.mean > 0)) return null;   // silenzio o nessun attacco

    // 4b) il brano è "a tempo fisso"? (quantizzato: la griglia cade sugli attacchi per tutto il brano)
    // blocchi di 16 beat: in ognuno, per ogni beat si cerca l'attacco più forte entro ±1/4 di beat
    // dalla linea della griglia; il blocco è a tempo se lo scarto mediano (con segno: la griglia resta
    // allineata, anche se hi-hat e riempimenti spostano qualche attacco) è piccolo e sulla griglia
    // ci sono davvero più attacchi che altrove (salienza)
    const steady = (() => {
      const Pq = lagOf(top.bpm), half = Math.floor(Pq / 4), tol = 0.03 / hopSec;
      let good = 0, total = 0;
      for (let k0 = 0; ; k0 += 16) {
        if (top.phase + (k0 + 16) * Pq + half >= N - 2) break;
        const devs = [];
        let on = 0, all = 0, cnt = 0;
        for (let k = k0; k < k0 + 16; k++) {
          const c = Math.round(top.phase + k * Pq);
          let bi = c, bv = -1;
          for (let i = c - half; i <= c + half; i++) if (i > 0 && O[i] > bv) { bv = O[i]; bi = i; }
          if (bv > 0) devs.push(bi - c);
          on += at(c);
        }
        for (let d = 0; d < Pq; d += 2) {
          for (let k = k0; k < k0 + 16; k++) all += at(Math.round(top.phase + k * Pq + d));
          cnt++;
        }
        const sal = all > 0 ? on / (all / cnt) : 0;
        devs.sort((p, q) => p - q);
        const med = devs.length ? devs[devs.length >> 1] : Infinity;
        if (sal > 0) { total++; if (Math.abs(med) <= tol && sal >= 1.3) good++; }
      }
      return total ? good / total : 0;
    })();

    // 5) beat 1 della battuta: il beat con più energia nei bassi subito dopo l'attacco (4/4)
    const P = lagOf(top.bpm), win = Math.max(2, Math.round(0.06 / hopSec));
    let bestJ = 0, bestJS = -1;
    for (let j = 0; j < 4; j++) {
      let s = 0;
      for (let t = top.phase + j * P; t < N - win; t += 4 * P) {
        const i = Math.round(t);
        for (let k = i; k < i + win; k++) s += hb[k];
      }
      if (s > bestJS) { bestJS = s; bestJ = j; }
    }
    const beatSec = 60 / top.bpm;
    let offset = (top.phase + bestJ * P) * hopSec;
    offset = offset % (4 * beatSec);
    return {
      bpm: Math.round(top.bpm * 100) / 100,
      offset,
      confidence: top.mean > 0 ? top.score / top.mean : 0,
      steady,
      alt: rival ? Math.round(top.bpm * rival * 100) / 100 : null,
    };
  }`;

  let inlineFn = null;
  const runInline = (x, sr) => {
    if (!inlineFn) inlineFn = new Function(TEMPO_SRC + '; return analyzeTempo;')();
    return inlineFn(x, sr);
  };

  // audio mono a frequenza ridotta (basta per l'energia), al massimo 8 minuti
  function prepare(buffer) {
    const sr0 = buffer.sampleRate;
    const dec = sr0 > 32000 ? 2 : 1;
    const len = Math.min(buffer.length, Math.floor(sr0 * 480));
    const n = Math.floor(len / dec);
    const x = new Float32Array(n);
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    const k = 1 / (chans.length * dec);
    for (let i = 0; i < n; i++) {
      let s = 0;
      const base = i * dec;
      for (const ch of chans) for (let d = 0; d < dec; d++) s += ch[base + d];
      x[i] = s * k;
    }
    return { x, sr: sr0 / dec };
  }

  /** Restituisce {bpm, offset (s, inizio di una battuta), confidence, steady (0–1: quanto il tempo è fisso)} oppure null */
  L.detectTempo = buffer => new Promise(resolve => {
    const { x, sr } = prepare(buffer);
    const fallback = () => setTimeout(() => {
      try { resolve(runInline(x, sr)); } catch (e) { console.warn(e); resolve(null); }
    }, 0);
    let worker, url;
    try {
      url = URL.createObjectURL(new Blob([TEMPO_SRC + '\nonmessage = e => postMessage(analyzeTempo(e.data.x, e.data.sr));'], { type: 'text/javascript' }));
      worker = new Worker(url);
    } catch {
      if (url) URL.revokeObjectURL(url);
      fallback();
      return;
    }
    const done = () => { worker.terminate(); URL.revokeObjectURL(url); };
    worker.onmessage = e => { done(); resolve(e.data); };
    worker.onerror = e => { e.preventDefault(); done(); fallback(); };
    worker.postMessage({ x: x.slice(), sr });   // copia: x resta disponibile per il ripiego
  });

  // ---------- griglia ----------
  // grid: {bpm, offset, beatsPerBar}
  L.beatLen = g => 60 / g.bpm;

  /** tempo del beat più vicino a t */
  L.nearestBeat = (g, t) => {
    const bl = L.beatLen(g);
    return g.offset + Math.round((t - g.offset) / bl) * bl;
  };

  /** beat successivo (dir = +1) o precedente (dir = −1) rispetto a t */
  L.stepBeat = (g, t, dir) => {
    const bl = L.beatLen(g), k = (t - g.offset) / bl;
    const kn = dir > 0 ? Math.floor(k + 1e-6) + 1 : Math.ceil(k - 1e-6) - 1;
    return g.offset + kn * bl;
  };

  // ---------- tap tempo ----------
  const taps = [];
  /** registra un tocco; restituisce il BPM (del tempo reale) dopo almeno 4 tocchi */
  L.tap = () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 8) taps.shift();
    if (taps.length < 4) return { count: taps.length, bpm: null };
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    return { count: taps.length, bpm: 60000 / avg };
  };
})(window.Looper);
