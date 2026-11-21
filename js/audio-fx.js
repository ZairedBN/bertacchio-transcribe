/* Looper — catena audio: Ascolta → isolatore a 3 bande → trasposizione → dissolvenza → volume → limitatore,
   più i click del conteggio */
(L => {
  'use strict';
  const { $ } = L;
  const audio = $('audio');
  L.FADE = 0.025; // secondi

  let ac = null, graph = null, clickNodes = [];

  // Q dei filtri passa-basso/passa-alto in Web Audio è in dB: −3,01 dB = Butterworth
  const BW = -3.0103;
  const XO = [250, 3000];   // incroci dell'isolatore a 3 bande (Hz)
  const EQ_OFF = -30;       // posizione più bassa del cursore = banda spenta

  // pitch shifter granulare: due prese di ritardo sfasate con dissolvenza incrociata
  const SHIFTER_SRC = `
    class Shifter {
      constructor(sr) {
        this.size = 1 << 16; this.mask = this.size - 1;
        this.bufs = [new Float32Array(this.size), new Float32Array(this.size)];
        this.w = 0; this.p = 0; this.G = Math.round(sr * 0.07); this.ratio = 1;
      }
      read(b, pos) {
        const i = Math.floor(pos), f = pos - i, m = this.mask;
        return b[i & m] * (1 - f) + b[(i + 1) & m] * f;
      }
      process(ins, outs, n) {
        const G = this.G, dp = (1 - this.ratio) / G, m = this.mask;
        let w = this.w, p = this.p;
        for (let i = 0; i < n; i++) {
          for (let c = 0; c < 2; c++) {
            const src = ins[c] || ins[0];
            this.bufs[c][w] = src ? src[i] : 0;
          }
          let p2 = p + 0.5; if (p2 >= 1) p2 -= 1;
          const s = Math.sin(Math.PI * p), g1 = s * s, g2 = 1 - g1;
          const d1 = p * G, d2 = p2 * G;
          for (let c = 0; c < outs.length; c++) {
            const b = this.bufs[c < 2 ? c : 0];
            outs[c][i] = g1 * this.read(b, w - d1) + g2 * this.read(b, w - d2);
          }
          w = (w + 1) & m;
          p += dp; if (p >= 1) p -= 1; else if (p < 0) p += 1;
        }
        this.w = w; this.p = p;
      }
    }`;
  const WORKLET_SRC = SHIFTER_SRC + `
    class ShifterProcessor extends AudioWorkletProcessor {
      constructor() { super(); this.s = new Shifter(sampleRate); this.port.onmessage = e => { this.s.ratio = e.data; }; }
      process(inputs, outputs) {
        const out = outputs[0];
        if (out.length) this.s.process(inputs[0] || [], out, out[0].length);
        return true;
      }
    }
    registerProcessor('looper-shifter', ShifterProcessor);`;

  // ======================================================================
  // Costruzione della catena (funziona anche su un OfflineAudioContext, per i test)
  // ======================================================================
  /** due biquad Butterworth in cascata = Linkwitz-Riley 24 dB/ottava */
  function lr4(c, type, f, keep) {
    const a = c.createBiquadFilter(), b = c.createBiquadFilter();
    for (const n of [a, b]) { n.type = type; n.frequency.value = f; n.Q.value = BW; if (keep) keep(n); }
    a.connect(b);
    return { input: a, output: b };
  }

  function softClipCurve() {
    const n = 4096, curve = new Float32Array(n), k = 0.8;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      const y = a <= k ? a : k + (1 - k) * Math.tanh((a - k) / (1 - k));
      curve[i] = Math.sign(x) * y;
    }
    return curve;
  }

  function buildGraph(c) {
    const g = {};
    g.isoIn = c.createGain();
    g.isoIn.channelCount = 2;
    g.isoIn.channelCountMode = 'explicit';
    g.isoIn.channelInterpretation = 'speakers';
    g.isoOut = c.createGain();
    g.isoSlot = null;
    // isolatore a 3 bande: bassi = LP1·AP2, medi = HP1·LP2, alti = HP1·HP2 → la somma è piatta
    const lp1 = lr4(c, 'lowpass', XO[0]), hp1 = lr4(c, 'highpass', XO[0]);
    const lp2 = lr4(c, 'lowpass', XO[1]), hp2 = lr4(c, 'highpass', XO[1]);
    const ap2 = c.createBiquadFilter(); ap2.type = 'allpass'; ap2.frequency.value = XO[1]; ap2.Q.value = Math.SQRT1_2;
    g.eqLow = c.createGain(); g.eqMid = c.createGain(); g.eqHigh = c.createGain();
    g.isoOut.connect(lp1.input); lp1.output.connect(ap2).connect(g.eqLow);
    g.isoOut.connect(hp1.input);
    hp1.output.connect(lp2.input); lp2.output.connect(g.eqMid);
    hp1.output.connect(hp2.input); hp2.output.connect(g.eqHigh);
    g.pitchIn = c.createGain();
    for (const k of ['eqLow', 'eqMid', 'eqHigh']) g[k].connect(g.pitchIn);
    g.shifter = null;
    g.fade = c.createGain();
    g.vol = c.createGain();
    // limitatore + taglio morbido: alzando volume o bande il suono non gracchia
    g.limiter = c.createDynamicsCompressor();
    g.limiter.threshold.value = -3; g.limiter.knee.value = 0; g.limiter.ratio.value = 20;
    g.limiter.attack.value = 0.002; g.limiter.release.value = 0.25;
    // il compressore del browser aggiunge da solo +1,7 dB ("makeup"): li togliamo per restare a livello
    g.trim = c.createGain(); g.trim.gain.value = Math.pow(10, -1.7 / 20);
    g.clip = c.createWaveShaper();
    g.clip.curve = softClipCurve();
    g.clip.oversample = '2x';
    g.pitchIn.connect(g.fade);
    g.fade.connect(g.vol).connect(g.limiter).connect(g.trim).connect(g.clip).connect(c.destination);
    return g;
  }

  /** guadagni delle 3 bande dalla posizione dei cursori (dB; −30 = spenta).
      Se una banda viene alzata, tutte scendono della stessa quantità: niente saturazione. */
  function bandGains(vals) {
    const boost = Math.max(0, vals.eqLow, vals.eqMid, vals.eqHigh);
    const out = {};
    for (const k in vals) out[k] = vals[k] <= EQ_OFF ? 0 : Math.pow(10, (vals[k] - boost) / 20);
    return out;
  }

  // ---------- modalità "Ascolta" ----------
  const ISO_HELP = {
    normal: '',
    novocal: 'Toglie ciò che sta al centro del mix (di solito la voce). Serve un brano stereo.',
    center: 'Tiene solo ciò che sta al centro: di solito voce, basso, cassa e rullante.',
    sides: 'Tiene solo ciò che è aperto a destra e a sinistra (chitarre, tastiere, cori). Serve un brano stereo.',
    left: 'Solo il canale sinistro, in entrambe le orecchie.',
    right: 'Solo il canale destro, in entrambe le orecchie.',
    bass: 'Solo sotto i 250 Hz: basso e cassa.',
    nobass: 'Toglie tutto sotto i 250 Hz (basso e cassa).',
  };
  const STEREO_MODES = ['novocal', 'center', 'sides', 'left', 'right'];

  /** catena di una modalità tra `input` (stereo) e `out`; restituisce i nodi creati */
  function buildIso(c, mode, input, out) {
    const nodes = [];
    const keep = n => (nodes.push(n), n);
    const gain = v => { const n = keep(c.createGain()); n.gain.value = v; return n; };
    const filt = (type, f) => lr4(c, type, f, keep);
    const both = node => {                 // un segnale mono su entrambi i canali
      const m = gain(1);
      m.channelCount = 1; m.channelCountMode = 'explicit';
      const mg = keep(c.createChannelMerger(2));
      node.connect(m);
      m.connect(mg, 0, 0); m.connect(mg, 0, 1);
      mg.connect(out);
    };
    const entry = gain(1);                 // primo nodo: è quello da scollegare da `input`
    input.connect(entry);
    if (mode === 'left' || mode === 'right') {
      const sp = keep(c.createChannelSplitter(2));
      entry.connect(sp);
      const ch = gain(1);
      sp.connect(ch, mode === 'left' ? 0 : 1);
      both(ch);
    } else if (mode === 'center') {
      const sp = keep(c.createChannelSplitter(2)), mid = gain(0.5);
      entry.connect(sp);
      sp.connect(mid, 0); sp.connect(mid, 1);
      both(mid);
    } else if (mode === 'novocal' || mode === 'sides') {
      // lati = sinistro − destro: ciò che è identico nei due canali (il centro) si annulla
      const sp = keep(c.createChannelSplitter(2));
      entry.connect(sp);
      const side = gain(mode === 'novocal' ? 1.2 : 1), inv = gain(-1);
      sp.connect(side, 0); sp.connect(inv, 1); inv.connect(side);
      const hp = filt('highpass', mode === 'novocal' ? 150 : 120);
      side.connect(hp.input);
      both(hp.output);
      if (mode === 'novocal') {
        // si tengono i bassi del mix e un filo di centro (−15 dB), così non suona vuoto
        const lp = filt('lowpass', 150);
        entry.connect(lp.input); lp.output.connect(out);
        const mid = gain(0.5 * 0.18), midHp = filt('highpass', 150);
        sp.connect(mid, 0); sp.connect(mid, 1);
        mid.connect(midHp.input);
        both(midHp.output);
      }
    } else if (mode === 'bass') {
      const lp = filt('lowpass', XO[0]), mk = gain(1.4);
      entry.connect(lp.input); lp.output.connect(mk); mk.connect(out);
    } else if (mode === 'nobass') {
      const hp = filt('highpass', XO[0]);
      entry.connect(hp.input); hp.output.connect(out);
    } else {
      entry.connect(out);
    }
    return { entry, nodes };
  }

  function ensure() {
    if (graph) {
      if (ac.state === 'suspended') ac.resume();
      return graph;
    }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaElementSource(audio);
      graph = buildGraph(ac);
      src.connect(graph.isoIn);
      audio.volume = 1;
      applyIso();
      applyEq();
      applyVolume();
      applyShift();
    } catch (e) {
      console.warn('Catena audio non disponibile', e);
      graph = null;
      $('soundNote').textContent = 'Il browser non supporta gli effetti audio: restano disponibili loop e velocità.';
    }
    return graph;
  }

  // ---------- Ascolta (cambio con dissolvenza incrociata: niente scatti) ----------
  const XFADE = 0.04;
  let stereoInfo = null;   // null = sconosciuto; true/false dopo il caricamento del brano
  function updateIsoUi() {
    const mode = $('iso').value;
    let help = ISO_HELP[mode] || '';
    if (stereoInfo === false && STEREO_MODES.includes(mode)) help = 'Questo brano è mono: questa modalità non ha effetto.';
    $('isoHelp').textContent = help;
    for (const o of $('iso').options) {
      if (!o.dataset.base) o.dataset.base = o.textContent;
      o.textContent = o.dataset.base + (stereoInfo === false && STEREO_MODES.includes(o.value) ? ' (serve un brano stereo)' : '');
    }
  }
  function connectIso(g, c, mode) {
    const now = c.currentTime;
    const slot = c.createGain();
    slot.connect(g.isoOut);
    const built = buildIso(c, mode, g.isoIn, slot);
    const old = g.isoSlot;
    g.isoSlot = { slot, ...built };
    if (!old) { slot.gain.value = 1; return; }
    slot.gain.setValueAtTime(0, now);
    slot.gain.linearRampToValueAtTime(1, now + XFADE);
    old.slot.gain.cancelScheduledValues(now);
    old.slot.gain.setValueAtTime(old.slot.gain.value, now);
    old.slot.gain.linearRampToValueAtTime(0, now + XFADE);
    setTimeout(() => {
      try { g.isoIn.disconnect(old.entry); } catch { /* già scollegato */ }
      old.entry.disconnect();
      old.nodes.forEach(n => n.disconnect());
      old.slot.disconnect();
    }, XFADE * 1000 + 100);
  }
  function applyIso() {
    L.store.set('iso', $('iso').value);
    updateIsoUi();
    if (graph) connectIso(graph, ac, $('iso').value);
  }
  /** dopo il caricamento del brano: è davvero stereo? (molti vecchi brani sono mono) */
  function setBufferInfo(buffer) {
    if (!buffer) stereoInfo = null;
    else if (buffer.numberOfChannels < 2) stereoInfo = false;
    else {
      const a = buffer.getChannelData(0), b = buffer.getChannelData(1);
      const step = Math.max(1, Math.floor(a.length / 200000));
      let side = 0, mid = 0;
      for (let i = 0; i < a.length; i += step) { const s = a[i] - b[i], m = a[i] + b[i]; side += s * s; mid += m * m; }
      stereoInfo = mid > 0 && side / mid > 1e-4;
    }
    updateIsoUi();
  }

  // ---------- isolatore a 3 bande ----------
  const eqText = v => v <= EQ_OFF ? 'spento' : (v > 0 ? '+' : '') + v + ' dB';
  const eqVals = () => ({ eqLow: +$('eqLow').value, eqMid: +$('eqMid').value, eqHigh: +$('eqHigh').value });
  function applyEq() {
    const vals = eqVals();
    for (const k in vals) {
      $(k + 'Val').textContent = eqText(vals[k]);
      $(k).closest('.fader').classList.toggle('off', vals[k] <= EQ_OFF);
    }
    L.store.set('eq', vals);
    if (!graph) return;
    const gains = bandGains(vals);
    for (const k in gains) graph[k].gain.setTargetAtTime(gains[k], ac.currentTime, 0.02);
  }

  // ---------- trasposizione ----------
  let shifterLoading = null;
  const shiftRatio = () => Math.pow(2, (+$('semi').value + +$('cents').value / 100) / 12);
  function applyShift() {
    const semi = +$('semi').value, cents = +$('cents').value;
    $('semiVal').textContent = (semi > 0 ? '+' : '') + semi + (Math.abs(semi) === 1 ? ' semitono' : ' semitoni');
    $('centsVal').textContent = (cents > 0 ? '+' : '') + cents + ' cent';
    L.store.set('shift', { semi, cents });
    if (!graph) return;
    const ratio = shiftRatio(), g = graph;
    if (Math.abs(ratio - 1) < 1e-6) {
      g.pitchIn.disconnect();
      if (g.shifter) g.shifter.disconnect();
      g.pitchIn.connect(g.fade);
      return;
    }
    if (g.shifter) {
      g.shifter.setRatio(ratio);
      g.pitchIn.disconnect();
      g.pitchIn.connect(g.shifter.node);
      g.shifter.node.disconnect();
      g.shifter.node.connect(g.fade);
      return;
    }
    if (!shifterLoading) {
      shifterLoading = createShifter().then(sh => {
        g.shifter = sh;
        applyShift();
      }).catch(e => {
        console.warn(e);
        g.pitchIn.disconnect();
        g.pitchIn.connect(g.fade);
        $('soundNote').textContent = 'Trasposizione non disponibile in questo browser.';
      });
    }
  }
  async function createShifter() {
    if (ac.audioWorklet && window.AudioWorkletNode) {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' }));
        await ac.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        const node = new AudioWorkletNode(ac, 'looper-shifter', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          channelCount: 2, channelCountMode: 'explicit',
        });
        return { node, setRatio: r => node.port.postMessage(r), disconnect: () => node.disconnect() };
      } catch (e) {
        console.warn('AudioWorklet non disponibile, uso ScriptProcessor', e);
      }
    }
    const Shifter = new Function(SHIFTER_SRC + '; return Shifter;')();
    const s = new Shifter(ac.sampleRate);
    const node = ac.createScriptProcessor(2048, 2, 2);
    node.onaudioprocess = e => {
      const ib = e.inputBuffer, ob = e.outputBuffer;
      const ins = [ib.getChannelData(0), ib.numberOfChannels > 1 ? ib.getChannelData(1) : ib.getChannelData(0)];
      s.process(ins, [ob.getChannelData(0), ob.getChannelData(1)], ob.length);
    };
    return { node, setRatio: r => { s.ratio = r; }, disconnect: () => node.disconnect() };
  }

  // ---------- dissolvenza ----------
  function fadeOut() {
    if (!graph) return;
    const g = graph.fade.gain, now = ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + L.FADE);
  }
  function fadeIn() {
    if (!graph) return;
    const g = graph.fade.gain, now = ac.currentTime;
    g.cancelScheduledValues(now);
    if ($('fade').checked) {
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(1, now + L.FADE);
    } else {
      g.setValueAtTime(1, now);
    }
  }
  function resetFade() {
    if (!graph) return;
    const g = graph.fade.gain, now = ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(1, now);
  }

  // ---------- volume ----------
  function applyVolume() {
    const v = +$('vol').value;
    $('volVal').textContent = v + '%';
    L.store.set('vol', v);
    if (graph) graph.vol.gain.setTargetAtTime(v / 100, ac.currentTime, 0.02);
    else audio.volume = L.clamp(v / 100, 0, 1);
  }

  // ---------- click del conteggio ----------
  /** n click distanziati di `interval` secondi; accento sul primo di ogni battuta */
  function playClicks(n, interval, beatsPerBar) {
    if (!ensure()) return;
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * interval;
      const osc = ac.createOscillator(), env = ac.createGain();
      osc.frequency.value = i % beatsPerBar === 0 ? 1600 : 1000;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.6, t + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(env).connect(graph.limiter);
      osc.start(t);
      osc.stop(t + 0.07);
      clickNodes.push(osc);
    }
    return 50; // ms di anticipo prima del primo click
  }
  function stopClicks() {
    clickNodes.forEach(n => { try { n.stop(); } catch { /* già fermo */ } });
    clickNodes = [];
  }

  // ---------- controlli ----------
  const withGraph = fn => () => { ensure(); fn(); };
  $('vol').addEventListener('input', applyVolume);
  $('iso').addEventListener('change', withGraph(applyIso));
  ['eqLow', 'eqMid', 'eqHigh'].forEach(id => $(id).addEventListener('input', withGraph(applyEq)));
  ['semi', 'cents'].forEach(id => $(id).addEventListener('input', withGraph(applyShift)));
  // fader del mixer: doppio clic o doppio tocco riporta al valore iniziale
  document.querySelectorAll('input.vfader').forEach(el => {
    const reset = () => { el.value = el.dataset.def; el.dispatchEvent(new Event('input')); };
    el.addEventListener('dblclick', reset);
    let lastTap = 0;
    el.addEventListener('pointerup', e => {
      if (e.pointerType !== 'touch') return;
      const now = performance.now();
      if (now - lastTap < 320) { reset(); lastTap = 0; } else lastTap = now;
    });
  });
  $('fade').addEventListener('change', () => { L.store.set('fade', $('fade').checked); resetFade(); });
  $('soundReset').addEventListener('click', () => {
    ['semi', 'cents', 'eqLow', 'eqMid', 'eqHigh'].forEach(id => { $(id).value = 0; });
    $('iso').value = 'normal';
    $('fade').checked = true;
    L.store.set('fade', true);
    applyEq(); applyShift(); applyIso();
  });

  // ripristino impostazioni salvate
  $('vol').value = L.store.get('vol', 100);
  const eq = L.store.get('eq', null);
  if (eq) { $('eqLow').value = eq.eqLow || 0; $('eqMid').value = eq.eqMid || 0; $('eqHigh').value = eq.eqHigh || 0; }
  const sh = L.store.get('shift', null);
  if (sh) { $('semi').value = sh.semi || 0; $('cents').value = sh.cents || 0; }
  $('iso').value = L.store.get('iso', 'normal');
  if (!$('iso').value) $('iso').value = 'normal';
  $('fade').checked = L.store.get('fade', true);
  applyVolume(); applyEq(); applyShift(); updateIsoUi();

  L.fx = {
    ensure, fadeIn, fadeOut, resetFade, playClicks, stopClicks, setBufferInfo,
    get active() { return !!graph; },
    // usati dai test con OfflineAudioContext
    _test: { buildGraph, buildIso, connectIso, bandGains, EQ_OFF },
  };
})(window.Looper);
