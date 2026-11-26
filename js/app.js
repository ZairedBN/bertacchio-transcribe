/* Looper — applicazione: caricamento, passaggio in loop, tempo, sezioni, riproduzione */
(L => {
  'use strict';
  const { $, clamp, fmt, parseTime, store } = L;
  const S = L.state, audio = $('audio');

  let objectUrl = null, prevTime = 0, songKey = null, sections = [];
  let loopCount = 0, waiting = false, waitTimer = null, fadingOut = false, tempoToken = 0;
  let editSec = null;    // sezione richiamata per ultima: se se ne ritoccano i bordi, si può aggiornarla
  let userPos = false;   // la testina è stata spostata a mano: Play parte da lì anche fuori dal passaggio
  // per brano: quanto è regolare il tempo, se la griglia è visibile, BPM alternativo da proporre (doppio/metà)
  let gridMeta = { steady: null, show: true, alt: null };

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
    songKey = opts.key || localKey(file);
    $('filename').textContent = file.name;
    $('placeholder').textContent = L.t('Caricamento…');
    $('placeholder').hidden = false;
    S.region = null; S.duration = 0; S.view = { start: 0, end: 0 }; S.grid = null;
    undoStack.length = redoStack.length = 0;
    editSec = null;
    applySpeed(store.get('speed:' + songKey, 1));    // ogni brano riparte dalla sua ultima velocità (nuovo: 100%)
    applyPitchPreserve();
    gridMeta = { steady: null, show: true, alt: null };
    $('gridShow').checked = S.gridShow = true;
    setNote('');
    L.wave.setBuffer(null);
    L.fx.setBufferInfo(null);
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
      L.fx.setBufferInfo(buffer);
      $('placeholder').hidden = true;
    } catch {
      $('placeholder').textContent = L.t('Impossibile leggere la forma d\'onda (il brano potrebbe comunque essere riproducibile).');
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
    ['play', 'restartBtn', 'prevBtn', 'nextBtn', 'tapMini', 'aMini', 'bMini', 'stop', 'startIn', 'endIn', 'setA', 'setB', 'zoomIn', 'zoomOut', 'zoomAll'].forEach(id => $(id).disabled = !on);
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
    showMsg(L.t('Scaricamento in corso… (può richiedere qualche secondo)'));
    try {
      const j = await L.api('/api/load?url=' + encodeURIComponent(url));
      showMsg(L.t('Caricamento audio…'));
      const r = await fetch(j.file);
      if (!r.ok) throw new Error(L.t('Impossibile leggere il file audio'));
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
    return isNaN(d) ? '' : d.toLocaleString(L.lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const emptyMsg = text => {
    recentList.innerHTML = '';
    const d = document.createElement('div');
    d.className = 'recent-empty';
    d.textContent = text;
    recentList.append(d);
  };

  async function renderRecent() {
    emptyMsg(L.t('Caricamento…'));
    let items;
    try { items = await L.db.list(); }
    catch (e) { emptyMsg(L.t('I recenti non sono disponibili in questo browser ({msg}).', { msg: e.message })); return; }
    if (!items.length) { emptyMsg(L.t('Nessun brano recente. I brani che apri compariranno qui.')); return; }
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
      open.title = /^https?:/i.test(it.source || '') ? it.source : L.t(it.source || 'File dal dispositivo');
      open.addEventListener('click', () => openRecent(it.key));
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '✕';
      del.title = L.t('Rimuovi dai recenti');
      del.addEventListener('click', async () => {
        if (!await L.ask(L.t('Rimuovere “{name}” dai recenti?', { name: it.title || it.key }), { ok: L.t('Rimuovi'), danger: true })) return;
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
      if (!s || !s.blob) throw new Error(L.t('Brano non trovato'));
      await loadSong(new File([s.blob], s.title || 'audio', { type: s.type || s.blob.type }), { key: s.key, source: s.source, save: 'touch' });
      showMsg('');
    } catch (e) {
      showMsg(L.t('Impossibile aprire il brano: {msg}', { msg: e.message }), true);
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
      // i clic nella finestra di conferma (es. "Rimuovere dai recenti?") non chiudono il menu
      if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target) && !e.target.closest('dialog')) close();
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
  let noteRaw = '';   // testo della nota in italiano (chiave), così si può ritradurre al cambio lingua
  function setNote(t) { noteRaw = t; const n = $('bpmNote'); n.textContent = n.title = L.t(t); }
  const STEADY_MIN = 0.6;    // sotto questa soglia il brano non sembra quantizzato: griglia nascosta

  function applyGridShow(show) {
    gridMeta.show = S.gridShow = $('gridShow').checked = !!show;
    L.wave.invalidate();
  }

  async function loadTempo(buffer) {
    const token = ++tempoToken;
    updateTempoUi();
    const saved = store.get('tempo:' + songKey, null);
    // i tempi rilevati prima della v2-11 non sapevano proporre il doppio/la metà (né, dalla v2.0, se il
    // brano è a tempo fisso): si rianalizzano una volta. Quelli corretti a mano (detected: false) restano.
    if (saved && saved.bpm && (!saved.detected || (saved.steady != null && 'alt' in saved))) {
      gridMeta.steady = saved.steady != null ? saved.steady : null;
      applyGridShow(saved.show != null ? saved.show : store.get('gridShow', true));
      setGrid(saved, false);
      gridMeta.alt = saved.alt || null;
      updateAlt();
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
    applyGridShow(saved && saved.show != null ? saved.show : regular);   // rianalisi: la scelta mostra/nascondi resta
    setGrid({ bpm: r.bpm, offset: r.offset, beatsPerBar: 4, detected: true }, false);
    gridMeta.alt = r.alt >= 20 && r.alt <= 300 ? r.alt : null;
    saveTempo(true);
    updateAlt();
    setNote(!S.gridShow ? (regular ? 'griglia nascosta (attivala da Griglia ▾)' : 'tempo non regolare: griglia nascosta (attivala da Griglia ▾)')
      : r.confidence < 3 ? '(rilevato, da verificare)' : '(rilevato)');
  }

  function saveTempo(detected) {
    if (songKey && S.grid) store.set('tempo:' + songKey, { ...S.grid, detected: !!detected, steady: gridMeta.steady, show: gridMeta.show, alt: gridMeta.alt });
  }

  /** "Forse è 160?": l'app non era sicura tra doppio e metà; un tocco usa l'altro valore */
  function updateAlt() {
    const b = $('bpmAlt'), alt = S.grid && gridMeta.alt;
    b.hidden = !alt;
    if (alt) b.textContent = L.t('Forse è {bpm}?', { bpm: Math.round(alt * 10) / 10 });
  }
  $('bpmAlt').addEventListener('click', () => {
    if (!S.grid || !gridMeta.alt) return;
    setGrid({ ...S.grid, bpm: gridMeta.alt, detected: true });
    setNote('');
  });

  function setGrid(g, save = true) {
    // il BPM cambia (a mano, Tap, ÷2, ×2 o dall'avviso): l'avviso non serve più
    if (gridMeta.alt && S.grid && g && Math.abs(g.bpm - S.grid.bpm) > 0.01) { gridMeta.alt = null; updateAlt(); }
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
    updateAlt();
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
    // di solito i beat sono già giusti e va spostata solo la battuta: si sceglie il beat più vicino
    // a quello che si è sentito (tenendo conto del ritardo di reazione durante l'ascolto)
    const t = heardTime(), bt = L.nearestBeat(S.grid, t);
    setGrid({ ...S.grid, offset: Math.abs(bt - t) <= L.beatLen(S.grid) * 0.3 ? bt : t });
  });

  /** punto del brano che si stava sentendo quando si è premuto: durante l'ascolto
      il suono esce in ritardo (casse/cuffie) e il dito arriva un po' dopo il colpo */
  const REACTION = 0.05;
  function heardTime() {
    const t = audio.currentTime;
    if (audio.paused) return t;
    return Math.max(0, t - (REACTION + L.fx.latency()) * audio.playbackRate);
  }
  /** punto per A/B: con griglia e aggancio attivi va sul beat; da fermo solo se è già vicino a un beat */
  function markTime() {
    const t = audio.currentTime, g = S.grid;
    if (!g || !S.gridShow || !S.snap) return t;
    if (!audio.paused) return clamp(L.nearestBeat(g, heardTime()), 0, S.duration);
    const bt = L.nearestBeat(g, t);
    return Math.abs(bt - t) <= L.beatLen(g) * 0.15 ? clamp(bt, 0, S.duration) : t;
  }

  // il pulsante ha larghezza fissa e la nota sta dopo: niente si sposta mentre batti
  // modalità tap: dopo il primo tocco su Tap (o T), per 2 s anche Spazio batte il tempo invece di play/pausa
  let tapReset = null;
  function tap() {
    if (!S.duration) return;
    const r = L.tap();
    const btn = $('tapBtn');
    btn.textContent = r.count < 4 ? 'Tap ' + r.count + '/4' : 'Tap ✓';
    $('tapMini').textContent = r.count < 4 ? r.count + '/4' : '✓';
    clearTimeout(tapReset);
    btn.classList.add('on'); $('tapMini').classList.add('on');
    tapReset = setTimeout(() => { btn.textContent = 'Tap'; $('tapMini').textContent = 'Tap'; btn.classList.remove('on'); $('tapMini').classList.remove('on'); }, 2000);
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
  $('tapMini').addEventListener('pointerdown', e => { if (e.button === 0) { e.preventDefault(); tap(); } });
  $('tapMini').addEventListener('click', e => { if (e.detail === 0) tap(); });

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
    if (changed) { resetLoopCount(); userPos = false; }
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
    updateUndoUi();
    renderChips();
  }
  function commitInputs() {
    const R = S.region;
    let s = parseTime($('startIn').value), e = parseTime($('endIn').value);
    if (isNaN(s)) s = R ? R.start : 0;
    if (isNaN(e)) e = R ? R.end : S.duration;
    if (e - s >= 0.05 && !sameReg(R, { start: s, end: e })) { remember(); setRegion(s, e); }
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
    remember('nudge-' + edge);
    if (edge === 'start' && t2 < R.end - 0.05) setRegion(t2, R.end);
    if (edge === 'end' && t2 > R.start + 0.05) setRegion(R.start, t2);
  }
  L.holdRepeat($('startDown'), () => nudge('start', -1));
  L.holdRepeat($('startUp'), () => nudge('start', 1));
  L.holdRepeat($('endDown'), () => nudge('end', -1));
  L.holdRepeat($('endUp'), () => nudge('end', 1));

  function setA() {
    const t = markTime(), R = S.region;
    remember();
    if (R && t < R.end - 0.05) setRegion(t, R.end); else setRegion(t, S.duration);
  }
  function setB() {
    const t = markTime(), R = S.region;
    remember();
    if (R && t > R.start + 0.05) setRegion(R.start, t); else setRegion(0, t);
  }
  function userClear() { if (S.region) { remember(); clearRegion(); } }
  $('setA').addEventListener('click', setA);
  $('setB').addEventListener('click', setB);
  $('clearReg').addEventListener('click', userClear);

  // ---------- annulla / ripristina le modifiche al passaggio ----------
  const undoStack = [], redoStack = [];
  const sameReg = (a, b) => (!a && !b) || (!!a && !!b && Math.abs(a.start - b.start) < 1e-4 && Math.abs(a.end - b.end) < 1e-4);
  let lastKind = '', lastAt = 0;
  /** da chiamare prima di ogni modifica fatta dall'utente. Le modifiche ripetute dello
      stesso tipo (tenere premuto − / +) diventano un solo passo */
  function remember(kind = '') {
    const now = performance.now();
    const merge = kind && kind === lastKind && now - lastAt < 1000;
    lastKind = kind; lastAt = now;
    if (merge) return;
    const cur = S.region ? { ...S.region } : null;
    if (!undoStack.length || !sameReg(undoStack[undoStack.length - 1], cur)) undoStack.push(cur);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    updateUndoUi();
  }
  function stepHistory(from, to) {
    while (from.length && sameReg(from[from.length - 1], S.region)) from.pop();
    if (!from.length) { updateUndoUi(); return; }
    const r = from.pop();
    lastKind = '';
    if (r && r.sec) {        // sezione eliminata: annulla la rimette, ripristina la toglie di nuovo
      const k = sections.indexOf(r.sec);
      if (k >= 0) { sections.splice(k, 1); if (editSec === r.sec) editSec = null; }
      else { sections.push(r.sec); sections.sort((a, b) => a.start - b.start); }
      to.push(r);
      saveSections(); renderChips(); updateUndoUi();
      return;
    }
    to.push(S.region ? { ...S.region } : null);
    if (r) {
      setRegion(r.start, r.end);
      if (L.wave.isZoomed() && (r.start < S.view.start || r.end > S.view.end)) L.wave.zoomToRegion();
      if (inLoopMode() && !audio.paused && !waiting && (audio.currentTime < r.start || audio.currentTime > r.end)) seek(r.start);
    } else clearRegion();
  }
  const undo = () => stepHistory(undoStack, redoStack);
  const redo = () => stepHistory(redoStack, undoStack);
  function updateUndoUi() { $('undoReg').disabled = !undoStack.some(r => !sameReg(r, S.region)); }
  $('undoReg').addEventListener('click', undo);

  // collegamenti con la forma d'onda
  Object.assign(L.wave.hooks, {
    seek: userSeek,
    setRegion,
    clearRegion,
    beginEdit: () => remember(),     // inizio di un trascinamento sulla forma d'onda
    dragEnd() {
      const R = S.region;
      if (R && R.end - R.start < 0.05) clearRegion();
      else if (R && inLoopMode() && !audio.paused && (audio.currentTime < R.start || audio.currentTime > R.end)) seek(R.start);
    },
    recallSection: i => recallSection(i),
  });

  // ======================================================================
  // Sezioni salvate
  // ======================================================================
  const fmtShort = t => { const m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(1).padStart(4, '0'); };
  function loadSections() {
    sections = songKey ? store.get('sections:' + songKey, []) : [];
    if (!Array.isArray(sections)) sections = [];
    renderChips();
  }
  const saveSections = () => { if (songKey) store.set('sections:' + songKey, sections); };

  const isSecRegion = (sec, R) => !!R && Math.abs(R.start - sec.start) < 0.01 && Math.abs(R.end - sec.end) < 0.01;
  /** indice della sezione che coincide con il passaggio attuale (-1 = nessuna) */
  const activeSection = () => sections.findIndex(s => isSecRegion(s, S.region));

  async function renameSection(sec) {
    const n = await L.ask(L.t('Nuovo nome della sezione:'), { value: sec.name });
    if (n && n.trim()) { sec.name = n.trim(); saveSections(); renderChips(); }
  }

  /** pulsante "Aggiorna": il passaggio è stato ritoccato partendo da una sezione */
  function updateSectionBtn() {
    const btn = $('updSection'), R = S.region;
    const sec = editSec && sections.includes(editSec) ? editSec : null;
    const show = !!(R && sec && !isSecRegion(sec, R) && R.start < sec.end && R.end > sec.start);
    btn.hidden = !show;
    if (!show) return;
    btn.textContent = L.t('↻ Aggiorna “{name}”', { name: sec.name });
    btn.style.setProperty('--upd-c', L.sectionColorVar(sections.indexOf(sec)));
  }
  $('updSection').addEventListener('click', () => {
    const R = S.region, sec = editSec;
    if (!R || !sec || !sections.includes(sec)) return;
    sec.start = R.start; sec.end = R.end;
    if (!L.trainer.active) sec.speed = audio.playbackRate;
    sections.sort((a, b) => a.start - b.start);
    saveSections();
    renderChips();
  });

  function renderChips() {
    const box = $('chips');
    box.innerHTML = '';
    S.sections = sections;
    L.wave.invalidate();
    updateSectionBtn();
    // il pulsante Loop prende il colore della sezione in ascolto
    const active = activeSection();
    const loopBox = $('loopBox');
    if (active >= 0) loopBox.style.setProperty('--loop-c', L.sectionColorVar(active));
    else loopBox.style.removeProperty('--loop-c');
    loopBox.classList.toggle('sec', active >= 0);
    if (!sections.length) {
      const s = document.createElement('span');
      s.className = 'muted';
      s.textContent = L.t('Seleziona un passaggio e salvalo per ritrovarlo subito.');
      box.append(s);
      return;
    }
    const R = S.region;
    sections.forEach((sec, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.setProperty('--c', L.sectionColorVar(i));
      const on = isSecRegion(sec, R);
      if (on) chip.classList.add('on');
      const name = document.createElement('button');
      name.className = 'name';
      const key = document.createElement('span');
      key.className = 'key';
      key.textContent = i < 9 ? i + 1 : '·';
      const txt = document.createElement('span');
      txt.className = 'txt';
      const strong = document.createElement('strong');
      strong.textContent = sec.name;
      const small = document.createElement('small');
      small.textContent = fmtShort(sec.start) + ' – ' + fmtShort(sec.end) + ' · ' + Math.round(sec.speed * 100) + '%';
      txt.append(strong, small);
      name.append(key, txt);
      name.addEventListener('click', () => recallSection(i));
      name.addEventListener('dblclick', () => renameSection(sec));
      chip.append(name);
      // sulla sezione in ascolto compare la matita per rinominarla (sul telefono il doppio tocco non va)
      if (on) {
        const ren = document.createElement('button');
        ren.className = 'ren';
        ren.textContent = '✎';
        ren.title = L.t('Rinomina sezione');
        ren.setAttribute('aria-label', ren.title);
        ren.addEventListener('click', () => renameSection(sec));
        chip.append(ren);
      }
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '✕';
      x.title = L.t('Elimina sezione');
      x.addEventListener('click', async () => {
        if (!await L.ask(L.t('Eliminare la sezione “{name}”?', { name: sec.name }), { ok: L.t('Elimina'), danger: true })) return;
        const k = sections.indexOf(sec);
        if (k < 0) return;
        sections.splice(k, 1);
        if (editSec === sec) editSec = null;
        undoStack.push({ sec }); redoStack.length = 0; lastKind = '';   // Ctrl+Z / ↶ la rimettono
        saveSections(); renderChips(); updateUndoUi();
      });
      chip.append(x);
      box.append(chip);
    });
  }

  function recallSection(i) {
    const sec = sections[i];
    if (!sec || !S.duration) return;
    const wasPlaying = !audio.paused || waiting;
    stopWaiting();
    if (!isSecRegion(sec, S.region)) remember();
    editSec = sec;
    setRegion(sec.start, sec.end);          // prima il passaggio, poi la velocità (che si salva nella sezione attiva)
    if (!L.trainer.active) applySpeed(sec.speed);
    L.trainer.onSectionChange();
    if (L.wave.isZoomed() && (sec.start < S.view.start || sec.end > S.view.end)) L.wave.zoomToRegion();
    seek(sec.start);
    userPos = false;
    if (wasPlaying) play();
  }

  $('saveSection').addEventListener('click', async () => {
    const R = S.region;
    if (!R) return;
    const n = await L.ask(L.t('Nome della sezione (es. Intro, Assolo, Ritornello):'), { value: L.t('Sezione {n}', { n: sections.length + 1 }), ok: L.t('Salva') });
    if (n === null) return;
    const sec = { name: n.trim() || L.t('Sezione {n}', { n: sections.length + 1 }), start: R.start, end: R.end, speed: audio.playbackRate };
    sections.push(sec);
    editSec = sec;
    sections.sort((a, b) => a.start - b.start);
    saveSections();
    renderChips();
  });

  // ======================================================================
  // Riproduzione, loop, conteggio
  // ======================================================================
  /** spostamento scelto dall'utente (clic sulla forma d'onda, frecce): Play partirà da lì */
  function userSeek(t) {
    userPos = true;
    if (pre) pre.from = clamp(t, 0, S.duration || 0);   // durante il conteggio: si ripartirà da qui, a tempo
    if (pre && pre.started) S.heldTime = pre.from;
    if (pre && pre.started) {   // il brano sta già scorrendo muto: niente seek(), che lo renderebbe udibile
      pre.last = null; pre.errs = [];
      audio.currentTime = Math.max(0, pre.from - Math.max(0, pre.T - L.fx.now()) * audio.playbackRate);
      updateTime(); L.wave.requestDraw();
      return;
    }
    seek(t);
  }
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
    $('play').textContent = L.t((!audio.paused || waiting) ? '❚❚ Pausa' : '▶ Play');
  }

  function togglePlay() {
    if (!audio.src || !S.duration) return;
    if (waiting) { stopWaiting(); return; }
    if (audio.paused) {
      L.fx.ensure();
      const R = S.region;
      if (inLoopMode() && !userPos && (audio.currentTime < R.start || audio.currentTime >= R.end - 0.01)) seek(R.start);
      if (isCountMode() && $('countFirst').checked) startWaiting(audio.currentTime);
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
    userPos = false;
    resetLoopCount();
  }
  /** riparte dall'inizio del passaggio (con il conteggio, se impostato) */
  function restartRegion() {
    if (!S.duration) return;
    stopWaiting();
    L.fx.ensure();
    seek(S.region ? S.region.start : 0);
    if (isCountMode() && $('countFirst').checked) {
      audio.pause();            // durante il conteggio il brano resta fermo
      startWaiting();
    } else play();
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

  /** pausa o conteggio, poi si riparte da `from` (di default l'inizio del passaggio) */
  function startWaiting(from) {
    if (from === undefined) from = S.region ? S.region.start : audio.currentTime;
    const mode = $('pauseMode').value;
    waiting = true;
    updatePlayLabel();
    if (/^bar/.test(mode)) {
      const g = S.grid, bpb = g ? g.beatsPerBar : 4, bpm = g ? g.bpm : 100;
      const n = (mode === 'bar2' ? 2 : 1) * bpb;
      const interval = 60 / (bpm * audio.playbackRate);       // i click seguono la velocità attuale
      const downbeat = L.fx.playClicks(n, interval, bpb);
      if (downbeat) { startOnBeat(from, downbeat); return; }
      waitThen(from, n * interval * 1000);                    // senza catena audio: niente click, solo l'attesa
    } else {
      waitThen(from, 2000);
    }
  }
  function waitThen(from, ms) {
    waitTimer = setTimeout(() => {
      waitTimer = null;
      if (!waiting) return;
      waiting = false;
      seek(from);
      L.fx.fadeIn();
      play();
      updatePlayLabel();
    }, Math.max(0, ms));
  }

  // Ripartenza a tempo dopo il conteggio. Un <audio> non si può far partire a un istante preciso,
  // il volume sì: il brano parte un po' prima, muto, e si apre esattamente sul beat 1
  // (stesso orologio dei click). Mentre è muto se ne corregge la posizione.
  const PREROLL = 0.5;   // secondi di anticipo
  let pre = null;        // { from, T, started, fixes, last, errs }
  function startOnBeat(from, T) {
    const me = pre = { from, T, started: false, fixes: 0, last: null, errs: [] };
    const rate = () => audio.playbackRate;
    const finish = () => { if (pre !== me) return; pre = null; S.heldTime = null; waiting = false; updatePlayLabel(); };
    const step = () => {
      waitTimer = null;
      if (pre !== me || !waiting) return;
      const now = L.fx.now(), left = T - now;
      const lead = Math.min(PREROLL, me.from / rate());       // prima dell'inizio del brano non si può
      if (!me.started) {
        if (left > lead + 0.02) { waitTimer = setTimeout(step, Math.min(40, (left - lead - 0.01) * 1000)); return; }
        me.started = true;
        S.heldTime = me.from;                                   // la testina resta ferma dove ripartirà
        L.fx.muteUntil(T);
        const pos = Math.max(0, me.from - Math.max(0, left) * rate());
        audio.currentTime = pos; prevTime = pos; fadingOut = false;
        play();
        if (left <= 0) { finish(); return; }
        waitTimer = setTimeout(step, 10);
        return;
      }
      if (left <= 0.005) { finish(); return; }
      // correzione della posizione mentre il brano è ancora muto, solo quando scorre con regolarità.
      // L'orologio audio avanza a scatti (~10 ms): si decide sulla mediana di 5 letture.
      const t = audio.currentTime, prev = me.last;
      me.last = { t, now };
      if (!audio.paused && prev && me.fixes < 3 && left > 0.1) {
        const speed = (t - prev.t) / (now - prev.now);
        if (Math.abs(speed / rate() - 1) < 0.3) {
          me.errs.push(t + left * rate() - me.from);          // dove sarebbe il brano all'istante T
          if (me.errs.length >= 5) {
            const err = me.errs.sort((a, b) => a - b)[2];
            me.errs = [];
            if (Math.abs(err) > 0.004 * rate()) { audio.currentTime = t - err; prevTime = audio.currentTime; me.fixes++; me.last = null; }
          }
        } else me.errs = [];
      }
      waitTimer = setTimeout(step, Math.min(9, left * 1000));
    };
    step();
  }
  function stopWaiting() {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    L.fx.stopClicks();
    if (pre) {
      // interrotto mentre il brano partiva muto: torna fermo al punto di partenza
      const from = pre.from, started = pre.started;
      pre = null; S.heldTime = null;
      if (started) { audio.pause(); seek(from); }
    }
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
        ? L.t('BPM del brano non disponibili: il conteggio usa 100 BPM. Puoi impostarli con Tap nella riga Tempo.')
        : L.t('Il conteggio segue i BPM del brano (rilevati quando lo carichi).');
    } else {
      const eff = Math.round(S.grid.bpm * audio.playbackRate);
      hint.textContent = L.t('Conteggio a {eff} BPM ({bpm} BPM del brano × velocità {rate}×).', { eff, bpm: S.grid.bpm, rate: audio.playbackRate.toFixed(2) });
    }
  }
  $('pauseMode').addEventListener('change', () => { store.set('pauseMode2', $('pauseMode').value); updateCountUi(); });
  $('countFirst').addEventListener('change', () => store.set('countFirst', $('countFirst').checked));

  // ---------- contatore ----------
  function resetLoopCount() { loopCount = 0; updateCounter(); }
  function updateCounter() { $('counter').textContent = S.region && S.duration ? L.t('Ripetizioni: {n}', { n: loopCount }) : ''; }

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
    if (playing) { L.wave.follow(L.shownTime(), inLoopMode()); updateTime(); }
    if (playing || L.wave.needsDraw) L.wave.frame();
    requestAnimationFrame(tick);
  }
  function updateTime() { $('time').textContent = fmt(L.shownTime()) + ' / ' + fmt(S.duration); }

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
    // la sezione in ascolto ricorda l'ultima velocità usata (non quella dell'allenatore, che cambia da sola)
    if (!L.trainer.active && S.duration) {
      if (songKey) store.set('speed:' + songKey, v);
      const i = activeSection();
      if (i >= 0 && Math.abs(sections[i].speed - v) > 1e-3) { sections[i].speed = v; saveSections(); renderChips(); }
    }
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
  /** frecce ←/→: con la griglia visibile si salta di una battuta, senza griglia ai bordi
      di passaggio, sezioni e brano; con Maiusc sempre ±2 secondi */
  function arrowJump(dir, fine) {
    const now = audio.currentTime;
    if (fine) { userSeek(now + dir * 2); return; }
    const tolBack = audio.paused ? 0.01 : 0.35;    // in riproduzione: ← subito dopo un punto va a quello prima
    let target;
    const g = S.grid;
    if (g && S.gridShow) {
      const bar = 60 / g.bpm * g.beatsPerBar;
      target = dir < 0
        ? g.offset + Math.floor((now - tolBack - g.offset) / bar) * bar
        : g.offset + (Math.floor((now + 0.01 - g.offset) / bar) + 1) * bar;
      if (target < 0) target = 0;
    } else {
      const pts = [0, S.duration];
      if (S.region) pts.push(S.region.start, S.region.end);
      for (const s of sections) pts.push(s.start, s.end);
      pts.sort((a, b) => a - b);
      target = dir < 0
        ? pts.filter(p => p < now - tolBack).pop()
        : pts.find(p => p > now + 0.01);
      if (target === undefined) target = dir < 0 ? 0 : S.duration;
    }
    // la fine del passaggio in loop farebbe ricominciare subito: ci si posiziona appena dopo
    if (inLoopMode() && Math.abs(target - S.region.end) < 0.01 && S.region.end < S.duration - 0.05) target = S.region.end + 0.02;
    userSeek(target);
  }

  function toggleZoom() {
    if (L.wave.isZoomed() || !S.region) L.wave.setView(0, S.duration);
    else L.wave.zoomToRegion();
  }

  document.addEventListener('keydown', e => {
    const t = e.target, tag = (t.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'textarea') return;
    if (tag === 'input' && t.type !== 'checkbox' && t.type !== 'range') return;
    if (t.closest && t.closest('#askDlg')) return;          // finestra per nomi e conferme aperta
    if ($('keysDlg').open && e.key !== '?') return;         // finestra "Tasti" aperta: i tasti non comandano il brano
    if ((e.ctrlKey || e.metaKey) && !e.altKey && S.duration) {
      const c = e.key.toLowerCase();
      if (c === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (c === 'y' || (c === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { closeAllPopovers(); return; }
    if (e.key === '?') { e.preventDefault(); openKeys(); return; }
    if (!S.duration) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    switch (k) {
      case ' ': e.preventDefault(); if (!e.repeat) restartRegion(); break;
      case 'Enter':
        if (tag === 'button' || tag === 'summary' || tag === 'label') return;
        e.preventDefault(); togglePlay(); break;
      case 'p': case 'PageDown': case 'ArrowDown': e.preventDefault(); togglePlay(); break;
      case 'PageUp': case 'ArrowUp': e.preventDefault(); restartRegion(); break;
      case 'Home': e.preventDefault(); userSeek(0); break;
      case 'End': e.preventDefault(); userSeek(Math.max(0, S.duration - 0.05)); break;
      case 'ArrowLeft': e.preventDefault(); arrowJump(-1, e.shiftKey); break;
      case 'ArrowRight': e.preventDefault(); arrowJump(1, e.shiftKey); break;
      case 'a': setA(); break;
      case 'b': setB(); break;
      case 'Delete': case 'Backspace': e.preventDefault(); userClear(); break;
      case 'l': $('loop').checked = !$('loop').checked; break;
      case 't': if (!e.repeat) tap(); break;
      case 'g': $('gridShow').checked = !$('gridShow').checked; $('gridShow').dispatchEvent(new Event('change')); break;
      case 's': e.preventDefault(); if (S.region) $('saveSection').click(); break;   // senza preventDefault la «s» finirebbe nel nome
      case 'z': toggleZoom(); break;
      case '+': case '=': applySpeed(audio.playbackRate + 0.05); break;
      case '-': case '_': applySpeed(audio.playbackRate - 0.05); break;
      case '0': applySpeed(1); break;
      default:
        if (/^[1-9]$/.test(k)) recallSection(+k - 1);
    }
  });

  // finestra con l'elenco dei tasti (tasto ? o pulsante "Tasti" nella testata)
  function openKeys() {
    const d = $('keysDlg');
    if (d.open) { d.close(); return; }
    closeAllPopovers();
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('keysBtn').addEventListener('click', openKeys);
  $('keysClose').addEventListener('click', () => $('keysDlg').close());
  $('keysDlg').addEventListener('click', e => { if (e.target === $('keysDlg')) $('keysDlg').close(); });
  $('restartBtn').addEventListener('click', restartRegion);
  $('prevBtn').addEventListener('click', () => arrowJump(-1, false));
  $('nextBtn').addEventListener('click', () => arrowJump(1, false));
  $('aMini').addEventListener('click', setA);
  $('bMini').addEventListener('click', setB);

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

  // ---------- lingua: riscrive i testi generati dal codice ----------
  function refreshTexts() {
    if (!songKey) $('filename').textContent = L.t('Nessun brano caricato');
    if (!$('placeholder').hidden && !songKey) $('placeholder').textContent = L.t('Trascina qui un file audio oppure usa “Apri file…”');
    setNote(noteRaw);
    updateAlt();
    updatePlayLabel();
    updateCountUi();
    updateCounter();
    renderChips();
    L.trainer.updateUi();
    L.fx.refreshTexts();
    L.wave.updateZoomUi();
    if (!linkMsg.classList.contains('err')) showMsg(!L.served && /Win/.test(navigator.platform) ? L.t('Per caricare brani da un link avvia il looper con avvia-looper.bat.') : '');
    if (!recentPanel.hidden) renderRecent();
  }
  document.addEventListener('looper-lang', refreshTexts);
  if (!songKey) $('filename').textContent = L.t('Nessun brano caricato');

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
      if (/Win/.test(navigator.platform)) showMsg(L.t('Per caricare brani da un link avvia il looper con avvia-looper.bat.'));
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
