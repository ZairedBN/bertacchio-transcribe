/* Looper — catena audio: isolamento → EQ → trasposizione → dissolvenza → volume, più i click del conteggio */
(L => {
  'use strict';
  const { $ } = L;
  const audio = $('audio');
  L.FADE = 0.025; // secondi

  let ac = null, graph = null, clickNodes = [];

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

  function ensure() {
    if (graph) {
      if (ac.state === 'suspended') ac.resume();
      return graph;
    }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaElementSource(audio);
      const g = {};
      g.isoIn = ac.createGain();
      g.isoIn.channelCount = 2;
      g.isoIn.channelCountMode = 'explicit';
      g.isoIn.channelInterpretation = 'speakers';
      g.isoOut = ac.createGain();
      g.isoNodes = [];
      g.eqLow = ac.createBiquadFilter(); g.eqLow.type = 'lowshelf'; g.eqLow.frequency.value = 250;
      g.eqMid = ac.createBiquadFilter(); g.eqMid.type = 'peaking'; g.eqMid.frequency.value = 1000; g.eqMid.Q.value = 0.9;
      g.eqHigh = ac.createBiquadFilter(); g.eqHigh.type = 'highshelf'; g.eqHigh.frequency.value = 4000;
      g.pitchIn = ac.createGain();
      g.shifter = null;
      g.fade = ac.createGain();
      g.vol = ac.createGain();
      src.connect(g.isoIn);
      g.isoOut.connect(g.eqLow).connect(g.eqMid).connect(g.eqHigh).connect(g.pitchIn);
      g.fade.connect(g.vol).connect(ac.destination);
      graph = g;
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

  // ---------- isolamento ----------
  function applyIso() {
    L.store.set('iso', $('iso').value);
    if (!graph) return;
    const g = graph;
    g.isoIn.disconnect();
    g.isoNodes.forEach(n => n.disconnect());
    g.isoNodes = [];
    const keep = n => (g.isoNodes.push(n), n);
    const filt = (type, f) => { const b = keep(ac.createBiquadFilter()); b.type = type; b.frequency.value = f; b.Q.value = 0.707; return b; };
    const mode = $('iso').value;

    if (mode === 'left' || mode === 'right') {
      const sp = keep(ac.createChannelSplitter(2)), mg = keep(ac.createChannelMerger(2));
      const ch = mode === 'left' ? 0 : 1;
      g.isoIn.connect(sp);
      sp.connect(mg, ch, 0);
      sp.connect(mg, ch, 1);
      mg.connect(g.isoOut);
    } else if (mode === 'novocal') {
      // sinistro − destro elimina ciò che è al centro (di solito la voce); i bassi vengono conservati a parte
      const sp = keep(ac.createChannelSplitter(2)), mg = keep(ac.createChannelMerger(2));
      const inv = keep(ac.createGain()); inv.gain.value = -1;
      const diff = keep(ac.createGain());
      const hp = filt('highpass', 180);
      g.isoIn.connect(sp);
      sp.connect(diff, 0);
      sp.connect(inv, 1);
      inv.connect(diff);
      diff.connect(hp);
      hp.connect(mg, 0, 0);
      hp.connect(mg, 0, 1);
      mg.connect(g.isoOut);
      const lp1 = filt('lowpass', 180), lp2 = filt('lowpass', 180);
      g.isoIn.connect(lp1); lp1.connect(lp2); lp2.connect(g.isoOut);
    } else if (mode === 'bass') {
      const a = filt('lowpass', 250), b = filt('lowpass', 250);
      g.isoIn.connect(a); a.connect(b); b.connect(g.isoOut);
    } else if (mode === 'nobass') {
      const a = filt('highpass', 250), b = filt('highpass', 250);
      g.isoIn.connect(a); a.connect(b); b.connect(g.isoOut);
    } else {
      g.isoIn.connect(g.isoOut);
    }
  }

  // ---------- equalizzatore ----------
  function applyEq() {
    const vals = { eqLow: +$('eqLow').value, eqMid: +$('eqMid').value, eqHigh: +$('eqHigh').value };
    for (const k in vals) $(k + 'Val').textContent = (vals[k] > 0 ? '+' : '') + vals[k] + ' dB';
    L.store.set('eq', vals);
    if (!graph) return;
    for (const k in vals) graph[k].gain.setTargetAtTime(vals[k], ac.currentTime, 0.02);
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
      osc.connect(env).connect(ac.destination);
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
  applyVolume(); applyEq(); applyShift();

  L.fx = {
    ensure, fadeIn, fadeOut, resetFade, playClicks, stopClicks,
    get active() { return !!graph; },
  };
})(window.Looper);
