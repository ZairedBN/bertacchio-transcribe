/* Looper — allenatore di velocità: parte lento e accelera da solo a ogni ripetizione */
(L => {
  'use strict';
  const { $, clamp } = L;
  const audio = $('audio');

  const PRESETS = {
    gentle: { step: 2, every: 2 },
    normal: { step: 5, every: 2 },
    fast: { step: 10, every: 1 },
  };

  const T = { active: false, loops: 0, preset: 'normal' };

  function cfg() {
    const start = clamp(+$('trStart').value || 70, 10, 200);
    const target = clamp(+$('trTarget').value || 100, 10, 200);
    const p = PRESETS[T.preset] || {
      step: clamp(Math.round(+$('trStep').value) || 5, 1, 50),
      every: clamp(Math.round(+$('trEvery').value) || 2, 1, 50),
    };
    return { start, target, step: p.step, every: p.every };
  }

  const pctToBpm = pct => {
    const g = L.state.grid;
    return g ? Math.round(g.bpm * pct / 100) : null;
  };
  const withBpm = pct => {
    const b = pctToBpm(pct);
    return pct + '%' + (b ? ' · ' + b + ' BPM' : '');
  };
  const curPct = () => Math.round(audio.playbackRate * 100);

  function updateUi() {
    const c = cfg();
    $('trStartVal').textContent = withBpm(c.start);
    $('trTargetVal').textContent = withBpm(c.target);
    document.querySelectorAll('.tr-preset').forEach(b => b.classList.toggle('on', b.dataset.p === T.preset));
    $('trCustom').hidden = T.preset !== 'custom';
    const p = PRESETS[T.preset];
    $('trPresetNote').textContent = p ? '+' + p.step + '% ogni ' + (p.every === 1 ? 'giro' : p.every + ' giri') : '';

    $('trIdle').hidden = T.active;
    $('trRun').hidden = !T.active;
    const st = $('trainerStatus');
    if (!T.active) {
      $('trBar').style.width = '0%';
      return;
    }
    const cur = curPct();
    const range = c.target - c.start;
    const frac = range === 0 ? 1 : clamp((cur - c.start) / range, 0, 1);
    $('trBar').style.width = (frac * 100).toFixed(1) + '%';
    $('trFrom').textContent = c.start + '%';
    $('trTo').textContent = c.target + '%';
    const reached = c.target >= c.start ? cur >= c.target : cur <= c.target;
    if (reached) {
      st.textContent = '🎉 Obiettivo raggiunto: ' + withBpm(cur) + '. Continua a ripetere o premi Ricomincia.';
    } else {
      const left = c.every - (T.loops % c.every);
      st.textContent = 'Giro ' + (T.loops + 1) + ' · ' + withBpm(cur) + ' · prossimo aumento tra ' + left + (left === 1 ? ' giro' : ' giri');
    }
    $('trPause').textContent = (!audio.paused || L.app.isWaiting()) ? '❚❚ Pausa' : '▶ Riprendi';
  }

  function start() {
    if (!L.state.region) {
      $('trainerStatus').textContent = '';
      $('trHint').textContent = 'Prima seleziona sulla forma d\'onda il passaggio da studiare (o scegli una sezione salvata).';
      return;
    }
    $('trHint').textContent = '';
    T.active = true;
    T.loops = 0;
    L.app.setLoop(true);
    L.app.applySpeed(cfg().start / 100);
    L.app.restartRegion();
    updateUi();
  }
  function restart() {
    T.loops = 0;
    L.app.applySpeed(cfg().start / 100);
    L.app.restartRegion();
    updateUi();
  }
  function stop() {
    T.active = false;
    L.app.pause();
    updateUi();
  }

  /** chiamata dall'app alla fine di ogni ripetizione */
  function onLoop() {
    if (!T.active) return;
    const c = cfg();
    T.loops++;
    if (T.loops % c.every === 0) {
      const cur = curPct();
      const next = c.target >= c.start ? Math.min(c.target, cur + c.step) : Math.max(c.target, cur - c.step);
      L.app.applySpeed(next / 100);
    }
    updateUi();
  }

  /** cambio di sezione durante l'allenamento: si riparte dalla velocità iniziale */
  function onSectionChange() {
    if (!T.active) return;
    T.loops = 0;
    L.app.applySpeed(cfg().start / 100);
    updateUi();
  }

  // ---------- controlli ----------
  const save = () => L.store.set('trainer2', { start: +$('trStart').value, target: +$('trTarget').value, preset: T.preset, step: +$('trStep').value, every: +$('trEvery').value });
  ['trStart', 'trTarget'].forEach(id => $(id).addEventListener('input', () => { save(); updateUi(); }));
  ['trStep', 'trEvery'].forEach(id => $(id).addEventListener('change', () => { save(); updateUi(); }));
  document.querySelectorAll('.tr-preset').forEach(b => b.addEventListener('click', () => { T.preset = b.dataset.p; save(); updateUi(); }));
  $('trStartBtn').addEventListener('click', start);
  $('trRestart').addEventListener('click', restart);
  $('trStop').addEventListener('click', stop);
  $('trPause').addEventListener('click', () => L.app.togglePlay());
  audio.addEventListener('play', updateUi);
  audio.addEventListener('pause', updateUi);

  const saved = L.store.get('trainer2', null);
  if (saved) {
    $('trStart').value = saved.start || 70;
    $('trTarget').value = saved.target || 100;
    $('trStep').value = saved.step || 5;
    $('trEvery').value = saved.every || 2;
    if (saved.preset) T.preset = saved.preset;
  }

  L.trainer = {
    onLoop, onSectionChange, updateUi, stop,
    get active() { return T.active; },
  };
})(window.Looper);
