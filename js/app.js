/* Looper — applicazione: caricamento, passaggio in loop, tempo, sezioni, riproduzione */
(L => {
  'use strict';
  const { $, clamp, fmt, parseTime, store } = L;
  const S = L.state, audio = $('audio');

  let objectUrl = null, prevTime = 0, songKey = null, sections = [];
  let loopCount = 0, waiting = false, waitTimer = null, fadingOut = false, tempoToken = 0;
  let gridMeta = { steady: null, show: true };   // per brano: quanto è regolare il tempo e se la griglia è visibile

  // ======================================================================
  // Caricamento brano
  // ======================================================================
  const localKey = f => 'local:' + f.name + ':' + f.size;

  /** opts: {key, source, serverFile, save: 'put' | 'touch' | false} */
  async function loadSong(file, opts = {}) {
    if (!file) return;
    stopWaiting();
    if (L.trainer.active) L.trainer.stop();
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    applySpeed(audio.playbackRate || 1);
    applyPitchPreserve();

    songKey = opts.key || localKey(file);
    $('filename').textContent = file.name;
    $('placeholder').textContent = 'Caricamento…';
    $('placeholder').hidden = false;
    S.region = null; S.duration = 0; S.view = { start: 0, end: 0 }; S.grid = null;
    gridMeta = { steady: null, show: true };
    $('gridShow').checked = S.gridShow = true;
    setNote('');
    L.wave.setBuffer(null);
    resetLoopCount();
    loadSections();
    updateTempoUi();
    L.wave.requestDraw();

    if (opts.save === 'put') {
      L.db.put({ key: songKey, title: file.name, source: opts.source || 'File dal dispositivo', size: file.size, type: file.type, blob: file, serverFile: opts.serverFile })
        .catch(e => console.warn('Salvataggio nei recenti non riuscito', e));
    } else if (opts.save === 'touch') {
      L.db.touch(songKey).catch(() => {});
    }

    let buffer = null;
    try {
      const data = await file.arrayBuffer();
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      buffer = await new Promise((res, rej) => {
        const p = actx.decodeAudioData(data, res, rej);
        if (p && p.then) p.then(res, rej);
      });
      actx.close && actx.close();
      S.duration = buffer.duration;
      S.view = { start: 0, end: S.duration };
      L.wave.setBuffer(buffer);
      $('placeholder').hidden = true;
    } catch {
      $('placeholder').textContent = 'Impossibile leggere la forma d\'onda (il brano potrebbe comunque essere riproducibile).';
    }
    setEnabled(true);
    updateRegionUi();
    updateTime();
    L.wave.updateZoomUi();
    L.wave.requestDraw();
    if (buffer) loadTempo(buffer);
  }

  audio.addEventListener('loadedmetadata', () => {
    if (!S.duration && isFinite(audio.duration)) {
      S.duration = audio.duration;
      S.view = { start: 0, end: S.duration };
    }
    setEnabled(true);
    updateTime();
    L.wave.requestDraw();
  });

  function setEnabled(on) {
    ['play', 'stop', 'startIn', 'endIn', 'setA', 'setB', 'zoomIn', 'zoomOut', 'zoomAll'].forEach(id => $(id).disabled = !on);
  }

  $('file').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) loadSong(f, { save: 'put', source: 'File dal dispositivo' });
    e.target.value = '';
  });

  // trascina e rilascia
  const wrap = $('waveWrap');
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); wrap.classList.add('drop'); }));
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) wrap.classList.remove('drop'); });
  document.addEventListener('drop', e => {
    e.preventDefault();
    wrap.classList.remove('drop');
    const f = e.dataTransfer.files[0];
    if (f) loadSong(f, { save: 'put', source: 'File dal dispositivo' });
  });

  // ---------- da link (solo con il server Windows) ----------
  const linkIn = $('linkIn'), linkBtn = $('linkBtn'), linkMsg = $('linkMsg');
  const showMsg = (text, isErr) => { linkMsg.textContent = text; linkMsg.classList.toggle('err', !!isErr); };

  async function loadLink() {
    const url = linkIn.value.trim();
    if (!url) { linkIn.focus(); return; }
    linkBtn.disabled = true;
    showMsg('Scaricamento in corso… (può richiedere qualche secondo)');
    try {
      const j = await L.api('/api/load?url=' + encodeURIComponent(url));
      showMsg('Caricamento audio…');
      const r = await fetch(j.file);
      if (!r.ok) throw new Error('Impossibile leggere il file audio');
      const blob = await r.blob();
      await loadSong(new File([blob], j.title || 'audio', { type: blob.type }), { key: j.key, source: url, serverFile: j.key, save: 'put' });
      showMsg('');
      linkIn.value = '';
    } catch (e) {
      showMsg(L.netError(e), true);
    } finally {
      linkBtn.disabled = false;
    }
  }
  linkBtn.addEventListener('click', loadLink);
  linkIn.addEventListener('keydown', e => { if (e.key === 'Enter') loadLink(); });

  // ======================================================================
  // Recenti (salvati nel browser)
  // ======================================================================
  const recentBtn = $('recentBtn'), recentPanel = $('recentPanel'), recentList = $('recentList');
  const sourceLabel = src => {
    if (!src || !/^https?:/i.test(src)) return 'File';
    try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return src; }
  };
  const dateLabel = ms => {
    const d = new Date(ms);
    return isNaN(d) ? '' : d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const emptyMsg = text => {
    recentList.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'recent-empty';
    d.textContent = text;
    recentList.append(d);
  };

  async function renderRecent() {
    emptyMsg('Caricamento…');
    let items;
    try { items = await L.db.list(); }
    catch (e) { emptyMsg('I recenti non sono disponibili in questo browser (' + e.message + ').'); return; }
    if (!items.length) { emptyMsg('Nessun brano recente. I brani che apri compariranno qui.'); return; }
    recentList.innerHTML = '';
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'recent-item';
      const open = document.createElement('button');
      open.className = 'open';
      const strong = document.createElement('strong');
      strong.textContent = it.title || it.key;
      const span = document.createElement('span');
      span.textContent = sourceLabel(it.source) + ' · ' + dateLabel(it.lastUsed) + (it.size ? ' · ' + (it.size / 1048576).toFixed(1) + ' MB' : '');
      open.append(strong, span);
      open.title = it.source || '';
      open.addEventListener('click', () => openRecent(it.key));
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '✕';
      del.title = 'Rimuovi dai recenti';
      del.addEventListener('click', async () => {
        if (!confirm('Rimuovere “' + (it.title || it.key) + '” dai recenti?')) return;
        try {
          await L.db.remove(it.key);
          if (L.hasServer && it.serverFile) L.api('/api/remove?file=' + encodeURIComponent(it.serverFile), { method: 'POST' }).catch(() => {});
        } catch (e) { alert(e.message); }
        renderRecent();
      });
      row.append(open, del);
      recentList.append(row);
    }
  }

  async function openRecent(key) {
    closeRecent();
    try {
      const s = await L.db.get(key);
      if (!s || !s.blob) throw new Error('Brano non trovato');
      await loadSong(new File([s.blob], s.title || 'audio', { type: s.type || s.blob.type }), { key: s.key, source: s.source, save: 'touch' });
      showMsg('');
    } catch (e) {
      showMsg('Impossibile aprire il brano: ' + e.message, true);
    }
  }

  // menu a comparsa: uno aperto alla volta, si chiudono cliccando fuori o con Esc
  const popovers = [];
  function popover(btn, panel, onOpen) {
    const close = () => { panel.hidden = true; };
    popovers.push(close);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = panel.hidden;
      popovers.forEach(c => c());
      panel.hidden = !open;
      if (open && onOpen) onOpen();
    });
    document.addEventListener('click', e => {
      if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) close();
    });
    return close;
  }
  const closeAllPopovers = () => popovers.forEach(c => c());
  const closeRecent = popover(recentBtn, recentPanel, renderRecent);
  popover($('gridBtn'), $('gridPanel'));
  $('openCache').addEventListener('click', () => { L.api('/api/open-cache', { method: 'POST' }).catch(e => alert(L.netError(e))); });

  // ======================================================================
  // Tempo: BPM, griglia, tap
  // ======================================================================
  function setNote(t) { const n = $('bpmNote'); n.textContent = t; n.title = t; }
  const STEADY_MIN = 0.6;    // sotto questa soglia il brano non sembra quantizzato: griglia nascosta

  function applyGridShow(show) {
    gridMeta.show = S.gridShow = $('gridShow').checked = !!show;
    L.wave.invalidate();
  }

  async function loadTempo(buffer) {
    const token = ++tempoToken;
    updateTempoUi();
    const saved = store.get('tempo:' + songKey, null);
    // i tempi rilevati dalla v2.0 non sapevano se il brano è a tempo fisso: si rianalizzano
    if (saved && saved.bpm && (saved.steady != null || !saved.detected)) {
      gridMeta.steady = saved.steady != null ? saved.steady : null;
      applyGridShow(saved.show != null ? saved.show : store.get('gridShow', true));
      setGrid(saved, false);
      setNote(!S.gridShow ? 'griglia nascosta (attivala da Griglia ▾)' : saved.detected ? '(rilevato)' : '');
      return;
    }
    setNote('analisi in corso…');
    const r = await L.detectTempo(buffer);
    if (token !== tempoToken) return;
    if (!r || !r.bpm) {
      setNote('non rilevato: usa Tap');
      updateTempoUi();
      return;
    }
    const regular = r.steady >= STEADY_MIN && r.confidence >= 2;
    gridMeta.steady = Math.round(r.steady * 100) / 100;
    applyGridShow(regular);
    setGrid({ bpm: r.bpm, offset: r.offset, beatsPerBar: 4, detected: true }, true);
    setNote(!regular ? 'tempo non regolare: griglia nascosta (attivala da Griglia ▾)'
      : r.confidence < 3 ? '(rilevato, da verificare)' : '(rilevato)');
  }

  function saveTempo(detected) {
    if (songKey && S.grid) store.set('tempo:' + songKey, { ...S.grid, detected: !!detected, steady: gridMeta.steady, show: gridMeta.show });
  }

  function setGrid(g, save = true) {
    if (g && g.bpm > 0) {
      const bpb = g.beatsPerBar || 4, bar = 60 / g.bpm * bpb;
      let off = g.offset % bar; if (off < 0) off += bar;
      S.grid = { bpm: Math.round(g.bpm * 100) / 100, offset: off, beatsPerBar: bpb };
      if (save) saveTempo(g.detected);
    } else {
      S.grid = null;
    }
    updateTempoUi();
    L.wave.invalidate();
    L.trainer.updateUi();
  }

  function updateTempoUi() {
    $('tempoRow').hidden = !S.duration && !S.buffer;
    const g = S.grid;
    for (const id of ['bpm', 'bpm2']) if (document.activeElement !== $(id)) $(id).value = g ? g.bpm : '';
    $('meter').value = String(g ? g.beatsPerBar : 4);
    $('beatOne').disabled = $('bpmX2').disabled = $('bpmHalf').disabled = !g;
    updateCountUi();
  }

  function onBpmInput(e) {
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (!(v >= 20 && v <= 300)) { updateTempoUi(); return; }
    setGrid(S.grid ? { ...S.grid, bpm: v } : { bpm: v, offset: 0, beatsPerBar: +$('meter').value || 4 });
    setNote('');
  }
  $('bpm').addEventListener('change', onBpmInput);
  $('bpm2').addEventListener('change', onBpmInput);
  $('bpmX2').addEventListener('click', () => { if (S.grid && S.grid.bpm * 2 <= 300) { setGrid({ ...S.grid, bpm: S.grid.bpm * 2 }); setNote(''); } });
  $('bpmHalf').addEventListener('click', () => { if (S.grid && S.grid.bpm / 2 >= 20) { setGrid({ ...S.grid, bpm: S.grid.bpm / 2 }); setNote(''); } });
  $('meter').addEventListener('change', () => {
    if (S.grid) setGrid({ ...S.grid, beatsPerBar: +$('meter').value });
  });
  $('beatOne').addEventListener('click', () => {
    if (!S.grid) return;
    setGrid({ ...S.grid, offset: audio.currentTime });
  });

  // il pulsante ha larghezza fissa e la nota sta dopo: niente si sposta mentre batti
  // modalità tap: dopo il primo tocco su Tap (o T), per 2 s anche Spazio batte il tempo invece di play/pausa
  let tapReset = null, tapMode = false;
  function tap() {
    if (!S.duration) return;
    const r = L.tap();
    const btn = $('tapBtn');
    btn.textContent = r.count < 4 ? 'Tap ' + r.count + '/4' : 'Tap ✓';
    clearTimeout(tapReset);
    tapMode = true; btn.classList.add('on');
    tapReset = setTimeout(() => { btn.textContent = 'Tap'; tapMode = false; btn.classList.remove('on'); }, 2000);
    if (!r.bpm) { setNote('continua a battere…'); return; }
    const playing = !audio.paused;
    const bpm = playing ? r.bpm / audio.playbackRate : r.bpm;     // BPM del brano, non della velocità attuale
    const offset = playing ? audio.currentTime - 0.05 * audio.playbackRate : (S.grid ? S.grid.offset : 0);
    setGrid({ bpm: Math.round(bpm * 10) / 10, offset, beatsPerBar: S.grid ? S.grid.beatsPerBar : (+$('meter').value || 4) });
    setNote(S.gridShow ? '(da Tap)' : '(da Tap) · griglia nascosta');
  }
  // il tap conta alla pressione (più preciso, senza il ritardo del tocco); il click solo da tastiera
  $('tapBtn').addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); tap(); } });
  $('tapBtn').addEventListener('click', e => { if (e.detail === 0) tap(); });

  $('gridShow').addEventListener('change', () => {
    applyGridShow($('gridShow').checked);
    saveTempo((store.get('tempo:' + songKey, null) || {}).detected);
    if (S.grid) setNote(S.gridShow ? '' : 'griglia nascosta');
  });
  $('snap').addEventListener('change', () => { S.snap = $('snap').checked; store.set('snap', S.snap); });

  // ======================================================================
  // Passaggio (intervallo A–B)
  // ======================================================================
  function setRegion(s, e) {
    s = clamp(s, 0, S.duration); e = clamp(e, 0, S.duration);
    if (e < s) [s, e] = [e, s];
    const R = S.region;
    const changed = !R || Math.abs(R.start - s) > 1e-4 || Math.abs(R.end - e) > 1e-4;
    S.region = { start: s, end: e };
    if (changed) resetLoopCount();
    L.wave.invalidate();
    updateRegionUi();
  }
  function clearRegion() {
    S.region = null;
    resetLoopCount();
    L.wave.invalidate();
    updateRegionUi();
  }
  function updateRegionUi() {
    const R = S.region, sIn = $('startIn'), eIn = $('endIn');
    if (document.activeElement !== sIn) sIn.value = R ? fmt(R.start) : '';
    if (document.activeElement !== eIn) eIn.value = R ? fmt(R.end) : '';
    ['clearReg', 'saveSection', 'startDown', 'startUp', 'endDown', 'endUp'].forEach(id => $(id).disabled = !R);
    L.wave.updateZoomUi();
    updateCounter();
    renderChips();
  }
  function commitInputs() {
    const R = S.region;
    let s = parseTime($('startIn').value), e = parseTime($('endIn').value);
    if (isNaN(s)) s = R ? R.start : 0;
    if (isNaN(e)) e = R ? R.end : S.duration;
    if (e - s >= 0.05) setRegion(s, e);
    updateRegionUi();
  }
  ['startIn', 'endIn'].forEach(id => {
    const el = $(id);
    el.addEventListener('change', commitInputs);
    el.addEventListener('blur', () => setTimeout(updateRegionUi, 0));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { commitInputs(); el.blur(); } });
  });

  // ritocco dei bordi: un beat se c'è la griglia, altrimenti 0,05 s
  function nudge(edge, dir) {
    const R = S.region;
    if (!R) return;
    const t = edge === 'start' ? R.start : R.end;
    const g = S.gridShow ? S.grid : null;      // a beat solo se la griglia è visibile
    let t2 = g ? L.stepBeat(g, t, dir) : t + dir * 0.05;
    t2 = clamp(t2, 0, S.duration);
    if (edge === 'start' && t2 < R.end - 0.05) setRegion(t2, R.end);
    if (edge === 'end' && t2 > R.start + 0.05) setRegion(R.start, t2);
  }
  L.holdRepeat($('startDown'), () => nudge('start', -1));
  L.holdRepeat($('startUp'), () => nudge('start', 1));
  L.holdRepeat($('endDown'), () => nudge('end', -1));
  L.holdRepeat($('endUp'), () => nudge('end', 1));

  function setA() {
    const t = audio.currentTime, R = S.region;
    if (R && t < R.end) setRegion(t, R.end); else setRegion(t, S.duration);
  }
  function setB() {
    const t = audio.currentTime, R = S.region;
    if (R && t > R.start) setRegion(R.start, t); else setRegion(0, t);
  }
  $('setA').addEventListener('click', setA);
  $('setB').addEventListener('click', setB);
  $('clearReg').addEventListener('click', clearRegion);

  // collegamenti con la forma d'onda
  Object.assign(L.wave.hooks, {
    seek,
    setRegion,
    clearRegion,
    dragEnd() {
      const R = S.region;
      if (R && R.end - R.start < 0.05) clearRegion();
      else if (R && inLoopMode() && !audio.paused && (audio.currentTime < R.start || audio.currentTime > R.end)) seek(R.start);
    },
  });

  // ======================================================================
  // Sezioni salvate
  // ======================================================================
  function loadSections() {
    sections = songKey ? store.get('sections:' + songKey, []) : [];
    if (!Array.isArray(sections)) sections = [];
    renderChips();
  }
  const saveSections = () => { if (songKey) store.set('sections:' + songKey, sections); };

  function renderChips() {
    const box = $('chips');
    box.innerHTML = '';
    if (!sections.length) {
      const s = document.createElement('span');
      s.className = 'muted';
      s.textContent = 'Seleziona un passaggio e salvalo per ritrovarlo subito.';
      box.append(s);
      return;
    }
    const R = S.region;
    sections.forEach((sec, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      if (R && Math.abs(R.start - sec.start) < 0.01 && Math.abs(R.end - sec.end) < 0.01) chip.classList.add('on');
      const name = document.createElement('button');
      name.className = 'name';
      name.textContent = sec.name;
      if (i < 9) { const k = document.createElement('small'); k.textContent = i + 1; name.append(k); }
      name.title = fmt(sec.start) + ' → ' + fmt(sec.end) + ' · ' + sec.speed.toFixed(2) + '× (doppio clic per rinominare)';
      name.addEventListener('click', () => recallSection(i));
      name.addEventListener('dblclick', () => {
        const n = prompt('Nuovo nome della sezione:', sec.name);
        if (n && n.trim()) { sec.name = n.trim(); saveSections(); renderChips(); }
      });
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '✕';
      x.title = 'Elimina sezione';
      x.addEventListener('click', () => {
        if (!confirm('Eliminare la sezione “' + sec.name + '”?')) return;
        sections.splice(i, 1); saveSections(); renderChips();
      });
      chip.append(name, x);
      box.append(chip);
    });
  }

  function recallSection(i) {
    const sec = sections[i];
    if (!sec || !S.duration) return;
    const wasPlaying = !audio.paused || waiting;
    stopWaiting();
    if (!L.trainer.active) applySpeed(sec.speed);
    setRegion(sec.start, sec.end);
    L.trainer.onSectionChange();
    if (L.wave.isZoomed() && (sec.start < S.view.start || sec.end > S.view.end)) L.wave.zoomToRegion();
    seek(sec.start);
    if (wasPlaying) play();
  }

  $('saveSection').addEventListener('click', () => {
    const R = S.region;
    if (!R) return;
    const n = prompt('Nome della sezione (es. Intro, Assolo, Ritornello):', 'Sezione ' + (sections.length + 1));
    if (n === null) return;
    sections.push({ name: n.trim() || 'Sezione ' + (sections.length + 1), start: R.start, end: R.end, speed: audio.playbackRate });
    sections.sort((a, b) => a.start - b.start);
    saveSections();
    renderChips();
  });

  // ======================================================================
  // Riproduzione, loop, conteggio
  // ======================================================================
  function seek(t) {
    audio.currentTime = clamp(t, 0, S.duration || 0);
    prevTime = audio.currentTime;
    fadingOut = false;
    L.fx.resetFade();
    updateTime();
    L.wave.requestDraw();
  }
  const play = () => { const p = audio.play(); if (p && p.catch) p.catch(() => {}); };
  const inLoopMode = () => !!S.region && $('loop').checked;
  const isCountMode = () => /^bar/.test($('pauseMode').value);

  function updatePlayLabel() {
    $('play').textContent = (!audio.paused || waiting) ? '❚❚ Pausa' : '▶ Play';
  }

  function togglePlay() {
    if (!audio.src || !S.duration) return;
    if (waiting) { stopWaiting(); return; }
    if (audio.paused) {
      L.fx.ensure();
      const R = S.region;
      if (inLoopMode() && (audio.currentTime < R.start || audio.currentTime >= R.end - 0.01)) seek(R.start);
      if (isCountMode() && $('countFirst').checked) startWaiting();
      else play();
    } else {
      audio.pause();
    }
  }
  function pause() { stopWaiting(); audio.pause(); }
  function stop() {
    stopWaiting();
    audio.pause();
    seek(S.region ? S.region.start : 0);
    resetLoopCount();
  }
  /** riparte dall'inizio del passaggio (con il conteggio, se impostato) */
  function restartRegion() {
    if (!S.duration) return;
    stopWaiting();
    L.fx.ensure();
    seek(S.region ? S.region.start : 0);
    if (isCountMode() && $('countFirst').checked) startWaiting(); else play();
  }
  $('play').addEventListener('click', togglePlay);
  $('stop').addEventListener('click', stop);
  audio.addEventListener('play', updatePlayLabel);
  audio.addEventListener('pause', updatePlayLabel);
  audio.addEventListener('ended', () => { if (inLoopMode() && S.region.end >= S.duration - 0.05) onLoopEnd(); });

  function onLoopEnd() {
    loopCount++;
    updateCounter();
    L.trainer.onLoop();
    if ($('pauseMode').value === 'none') {
      audio.currentTime = S.region.start;
      prevTime = S.region.start;
      fadingOut = false;
      L.fx.fadeIn();
      if (audio.paused) play();
      return;
    }
    audio.pause();
    seek(S.region.start);
    startWaiting();
  }

  // pausa o conteggio, poi si riparte
  function startWaiting() {
    const mode = $('pauseMode').value;
    waiting = true;
    updatePlayLabel();
    let ms;
    if (/^bar/.test(mode)) {
      const g = S.grid, bpb = g ? g.beatsPerBar : 4, bpm = g ? g.bpm : 100;
      const n = (mode === 'bar2' ? 2 : 1) * bpb;
      const interval = 60 / (bpm * audio.playbackRate);       // i click seguono la velocità attuale
      const lead = L.fx.playClicks(n, interval, bpb) || 0;
      ms = lead + n * interval * 1000 - 15;
    } else {
      ms = 2000;
    }
    waitTimer = setTimeout(() => {
      waitTimer = null;
      if (!waiting) return;
      waiting = false;
      seek(S.region ? S.region.start : audio.currentTime);
      L.fx.fadeIn();
      play();
      updatePlayLabel();
    }, Math.max(0, ms));
  }
  function stopWaiting() {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    L.fx.stopClicks();
    if (waiting) { waiting = false; updatePlayLabel(); }
  }

  function updateCountUi() {
    const count = isCountMode();
    $('bpm2Box').hidden = !count;
    $('countFirstBox').hidden = !count;
    const hint = $('countHint');
    if (!count) { hint.textContent = ''; return; }
    if (!S.grid) {
      hint.textContent = S.duration
        ? 'BPM del brano non disponibili: il conteggio usa 100 BPM. Puoi impostarli con Tap nella riga Tempo.'
        : 'Il conteggio segue i BPM del brano (rilevati quando lo carichi).';
    } else {
      const eff = Math.round(S.grid.bpm * audio.playbackRate);
      hint.textContent = 'Conteggio a ' + eff + ' BPM (' + S.grid.bpm + ' BPM del brano × velocità ' + audio.playbackRate.toFixed(2) + '×).';
    }
  }
  $('pauseMode').addEventListener('change', () => { store.set('pauseMode2', $('pauseMode').value); updateCountUi(); });
  $('countFirst').addEventListener('change', () => store.set('countFirst', $('countFirst').checked));

  // ---------- contatore ----------
  function resetLoopCount() { loopCount = 0; updateCounter(); }
  function updateCounter() { $('counter').textContent = S.region && S.duration ? 'Ripetizioni: ' + loopCount : ''; }

  // ---------- ciclo principale ----------
  function tick() {
    const t = audio.currentTime, playing = !audio.paused, R = S.region;
    if (inLoopMode() && playing && !L.wave.dragging && !waiting) {
      if ($('fade').checked && L.fx.active && !fadingOut && prevTime <= R.end &&
          t >= R.end - L.FADE * audio.playbackRate && t < R.end) {
        fadingOut = true;
        L.fx.fadeOut();
      }
      if (prevTime <= R.end && t >= R.end) onLoopEnd();
    }
    prevTime = audio.currentTime;
    if (playing) { L.wave.follow(audio.currentTime, inLoopMode()); updateTime(); }
    if (playing || L.wave.needsDraw) L.wave.frame();
    requestAnimationFrame(tick);
  }
  function updateTime() { $('time').textContent = fmt(audio.currentTime) + ' / ' + fmt(S.duration); }

  // ======================================================================
  // Velocità
  // ======================================================================
  function applySpeed(v) {
    v = clamp(Math.round(v * 100) / 100, 0.1, 4);
    if (isNaN(v)) return;
    audio.playbackRate = v;
    audio.defaultPlaybackRate = v;
    $('speed').value = clamp(v, 0.1, 2);
    $('speedVal').textContent = $('speedMini').textContent = v.toFixed(2) + '×';
    if (document.activeElement !== $('speedIn')) $('speedIn').value = v;
    document.querySelectorAll('.preset').forEach(b => b.classList.toggle('on', Math.abs(parseFloat(b.dataset.v) - v) < 0.001));
    L.trainer.updateUi();
    updateCountUi();
  }
  function applyPitchPreserve() {
    const on = $('pitch').checked;
    audio.preservesPitch = on;
    audio.mozPreservesPitch = on;
    audio.webkitPreservesPitch = on;
  }
  $('speed').addEventListener('input', () => applySpeed(parseFloat($('speed').value)));
  $('speedIn').addEventListener('change', () => applySpeed(parseFloat($('speedIn').value)));
  document.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => applySpeed(parseFloat(b.dataset.v))));
  L.holdRepeat($('spDown'), () => applySpeed(audio.playbackRate - 0.05));
  L.holdRepeat($('spUp'), () => applySpeed(audio.playbackRate + 0.05));
  $('pitch').addEventListener('change', applyPitchPreserve);

  // ======================================================================
  // Tastiera (anche pedali Bluetooth: PagGiù/PagSu, frecce su/giù)
  // ======================================================================
  document.addEventListener('keydown', e => {
    const t = e.target, tag = (t.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'textarea') return;
    if (tag === 'input' && t.type !== 'checkbox' && t.type !== 'range') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { closeAllPopovers(); return; }
    if (!S.duration) return;
    switch (e.key) {
      case ' ': e.preventDefault(); if (tapMode) { if (!e.repeat) tap(); } else togglePlay(); break;
      case 'PageDown': case 'ArrowDown': e.preventDefault(); togglePlay(); break;
      case 'PageUp': case 'ArrowUp': e.preventDefault(); restartRegion(); break;
      case 'a': case 'A': setA(); break;
      case 'b': case 'B': setB(); break;
      case 'l': case 'L': $('loop').checked = !$('loop').checked; break;
      case 't': case 'T': tap(); break;
      case 'ArrowLeft': e.preventDefault(); seek(audio.currentTime - 2); break;
      case 'ArrowRight': e.preventDefault(); seek(audio.currentTime + 2); break;
      case '+': case '=': applySpeed(audio.playbackRate + 0.05); break;
      case '-': case '_': applySpeed(audio.playbackRate - 0.05); break;
      default:
        if (/^[1-9]$/.test(e.key)) recallSection(+e.key - 1);
    }
  });

  // togli il focus dai controlli dopo l'uso, così Spazio/frecce restano scorciatoie globali
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b) b.blur(); });
  document.addEventListener('change', e => {
    if (e.target.type === 'checkbox' || e.target.type === 'range' || e.target.tagName === 'SELECT') e.target.blur();
  });

  // ======================================================================
  // Avvio
  // ======================================================================
  L.app = {
    applySpeed, togglePlay, pause, restartRegion,
    setLoop(on) { $('loop').checked = on; },
    isWaiting: () => waiting,
  };

  document.querySelectorAll('details[data-key]').forEach(d => {
    const def = d.dataset.default === 'open' || (d.dataset.default === 'wide' && innerWidth > 700);
    d.open = !!store.get('open:' + d.dataset.key, def);
    d.addEventListener('toggle', () => store.set('open:' + d.dataset.key, d.open));
  });

  // modalità pausa (con conversione dalle versioni precedenti)
  let pm = store.get('pauseMode2', null);
  if (!pm) {
    const old = store.get('pauseMode', '0');
    pm = old === 'count' ? 'bar1' : (['1', '2', '3'].includes(old) ? 'p2' : 'none');
  }
  $('pauseMode').value = pm;
  if (!$('pauseMode').value) $('pauseMode').value = 'none';
  $('countFirst').checked = store.get('countFirst', true);
  S.snap = $('snap').checked = store.get('snap', true);

  applyPitchPreserve();
  applySpeed(1);
  updateRegionUi();
  updateTempoUi();
  L.trainer.updateUi();
  requestAnimationFrame(tick);

  // server Windows: abilita i link e importa i vecchi recenti
  (async () => {
    if (!L.served) {
      if (/Win/.test(navigator.platform)) showMsg('Per caricare brani da un link avvia il looper con avvia-looper.bat.');
      return;
    }
    try {
      const ctl = new AbortController();
      setTimeout(() => ctl.abort(), 1500);
      const r = await fetch('api/ping', { headers: { 'X-Looper': '1' }, signal: ctl.signal });
      if (!r.ok) return;
      const j = await r.json();
      if (!j.ok) return;
      L.hasServer = true;
      $('linkRow').hidden = false;
      $('openCache').hidden = false;
      L.importServerRecents();
    } catch { /* nessun server: versione online */ }
  })();

  // app installabile e utilizzabile offline
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker non registrato', e));
  }
})(window.Looper);
