/* Looper MP3 — logica della pagina */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const served = location.protocol === 'http:' || location.protocol === 'https:';
  const audio = $('audio'), canvas = $('wave'), ctx = canvas.getContext('2d'), wrap = $('waveWrap');

  // ======================================================================
  // Utilità
  // ======================================================================
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const fmt = t => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0');
  };
  const parseTime = str => {
    str = String(str).trim().replace(',', '.');
    if (!str) return NaN;
    const parts = str.split(':');
    if (parts.length > 3) return NaN;
    let t = 0;
    for (const p of parts) {
      const n = parseFloat(p);
      if (isNaN(n)) return NaN;
      t = t * 60 + n;
    }
    return t;
  };
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem('looper:' + k); return v === null ? d : JSON.parse(v); }
      catch { return d; }
    },
    set(k, v) { try { localStorage.setItem('looper:' + k, JSON.stringify(v)); } catch { /* ignora */ } },
  };
  const netError = e => e && e.message === 'Failed to fetch'
    ? 'Server non raggiungibile: è ancora aperta la finestra di avvia-looper.bat?'
    : (e && e.message) || String(e);

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { 'X-Looper': '1', ...(opts.headers || {}) } });
    let j;
    try { j = await r.json(); } catch { throw new Error('Risposta non valida dal server (errore ' + r.status + ')'); }
    if (!r.ok || j.error) throw new Error(j.error || ('Errore ' + r.status));
    return j;
  }

  // ======================================================================
  // Stato
  // ======================================================================
  let buffer = null;          // AudioBuffer (solo per la forma d'onda)
  let globalPeak = 1;
  let duration = 0;
  let region = null;          // {start, end} in secondi
  let view = { start: 0, end: 0 };   // porzione visibile (zoom)
  let objectUrl = null;
  let prevTime = 0;
  let songKey = null;
  let sections = [];
  let loopCount = 0;
  let waiting = false;        // pausa / conteggio tra una ripetizione e l'altra
  let waitTimer = null;
  let clickNodes = [];
  let fadingOut = false;

  // ======================================================================
  // Caricamento brano
  // ======================================================================
  async function loadFile(file, key) {
    if (!file) return;
    stopWaiting();
    audio.pause();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    applySpeed(parseFloat($('speedIn').value) || 1);
    applyPitchPreserve();

    songKey = key || ('local:' + file.name + ':' + file.size);
    $('filename').textContent = file.name;
    $('placeholder').textContent = 'Caricamento…';
    $('placeholder').style.display = 'flex';
    region = null;
    buffer = null;
    duration = 0;
    view = { start: 0, end: 0 };
    peaks = null;
    resetLoopCount();
    loadSections();
    draw();

    try {
      const data = await file.arrayBuffer();
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      buffer = await actx.decodeAudioData(data);
      actx.close();
      duration = buffer.duration;
      view = { start: 0, end: duration };
      globalPeak = computeGlobalPeak(buffer);
      $('placeholder').style.display = 'none';
    } catch {
      $('placeholder').textContent = 'Impossibile leggere la forma d\'onda (il brano potrebbe comunque essere riproducibile).';
    }
    setEnabled(true);
    updateRegionUi();
    updateTime();
    draw();
  }

  audio.addEventListener('loadedmetadata', () => {
    if (!duration && isFinite(audio.duration)) {
      duration = audio.duration;
      view = { start: 0, end: duration };
    }
    setEnabled(true);
    updateTime();
    draw();
  });

  function setEnabled(on) {
    ['play', 'stop', 'startIn', 'endIn', 'setA', 'setB', 'zoomIn', 'zoomOut', 'zoomAll'].forEach(id => $(id).disabled = !on);
    updateRegionUi();
  }

  // file dal PC
  async function openLocal(file) {
    if (!file) return;
    await loadFile(file);
    if (served) {
      // copia nei Recenti (in background)
      fetch('/api/upload', {
        method: 'POST',
        headers: { 'X-Looper': '1', 'X-Filename': encodeURIComponent(file.name) },
        body: file,
      }).catch(e => console.warn('Copia nei recenti non riuscita', e));
    }
  }
  $('file').addEventListener('change', e => { openLocal(e.target.files[0]); e.target.value = ''; });

  // drag & drop
  ['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
    e.preventDefault(); wrap.classList.add('drop');
  }));
  document.addEventListener('dragleave', e => {
    if (!e.relatedTarget) wrap.classList.remove('drop');
  });
  document.addEventListener('drop', e => {
    e.preventDefault();
    wrap.classList.remove('drop');
    const f = e.dataTransfer.files[0];
    if (f) openLocal(f);
  });

  // ---------- da link ----------
  const linkIn = $('linkIn'), linkBtn = $('linkBtn'), linkMsg = $('linkMsg');
  const showLinkMsg = (text, isErr) => {
    linkMsg.textContent = text;
    linkMsg.classList.toggle('err', !!isErr);
  };
  if (!served) {
    showLinkMsg('Per usare i link e i Recenti avvia il looper con avvia-looper.bat (la pagina aperta direttamente supporta solo i file).');
  }

  async function fetchAndLoad(fileUrl, title, key) {
    const r = await fetch(fileUrl);
    if (!r.ok) throw new Error('Impossibile leggere il file audio');
    const blob = await r.blob();
    await loadFile(new File([blob], title || 'audio', { type: blob.type }), key);
  }

  async function loadLink() {
    const url = linkIn.value.trim();
    if (!url) { linkIn.focus(); return; }
    if (!served) { showLinkMsg('Per usare i link avvia il looper con avvia-looper.bat.', true); return; }
    linkBtn.disabled = true;
    showLinkMsg('Scaricamento in corso… (può richiedere qualche secondo)');
    try {
      const j = await api('/api/load?url=' + encodeURIComponent(url));
      showLinkMsg('Caricamento audio…');
      await fetchAndLoad(j.file, j.title, j.key);
      showLinkMsg('');
      linkIn.value = '';
    } catch (e) {
      showLinkMsg(netError(e), true);
    } finally {
      linkBtn.disabled = false;
    }
  }
  linkBtn.addEventListener('click', loadLink);
  linkIn.addEventListener('keydown', e => { if (e.key === 'Enter') loadLink(); });

  // ======================================================================
  // Recenti
  // ======================================================================
  const recentBtn = $('recentBtn'), recentPanel = $('recentPanel'), recentList = $('recentList');

  function sourceLabel(src) {
    if (!src || !/^https?:/i.test(src)) return 'File dal PC';
    try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return src; }
  }
  function dateLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  async function renderRecent() {
    recentList.innerHTML = '<div class="recent-empty">Caricamento…</div>';
    let items;
    try {
      items = (await api('/api/recent')).items || [];
    } catch (e) {
      recentList.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'recent-empty';
      d.textContent = netError(e);
      recentList.append(d);
      return;
    }
    recentList.innerHTML = '';
    if (!items.length) {
      recentList.innerHTML = '<div class="recent-empty">Nessun brano recente. I brani che apri o scarichi compariranno qui.</div>';
      return;
    }
    for (const it of items) {
      const row = document.createElement('div');
      row.className = 'recent-item';
      const open = document.createElement('button');
      open.className = 'open';
      const strong = document.createElement('strong');
      strong.textContent = it.title || it.file;
      const span = document.createElement('span');
      const mb = it.size ? ' · ' + (it.size / 1048576).toFixed(1) + ' MB' : '';
      span.textContent = sourceLabel(it.source) + ' · ' + dateLabel(it.lastUsed) + mb;
      open.append(strong, span);
      open.title = it.source || '';
      open.addEventListener('click', () => openRecent(it));
      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '✕';
      del.title = 'Rimuovi dai recenti (elimina il file dalla cache)';
      del.addEventListener('click', async () => {
        if (!confirm('Rimuovere “' + (it.title || it.file) + '” dai recenti?\nIl file verrà eliminato dalla cache.')) return;
        try { await api('/api/remove?file=' + encodeURIComponent(it.file), { method: 'POST' }); }
        catch (e) { alert(netError(e)); }
        renderRecent();
      });
      row.append(open, del);
      recentList.append(row);
    }
  }

  async function openRecent(it) {
    closeRecent();
    showLinkMsg('Caricamento di “' + (it.title || it.file) + '”…');
    try {
      const isLink = /^https?:/i.test(it.source || '');
      // i file dal PC usano la stessa chiave di quando sono stati aperti (nome + dimensione)
      await fetchAndLoad('/media/' + encodeURIComponent(it.file), it.title, isLink ? it.file : undefined);
      showLinkMsg('');
      api('/api/touch?file=' + encodeURIComponent(it.file), { method: 'POST' }).catch(() => {});
    } catch (e) {
      showLinkMsg(netError(e), true);
    }
  }

  function closeRecent() { recentPanel.hidden = true; }
  recentBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!served) { showLinkMsg('I Recenti sono disponibili avviando il looper con avvia-looper.bat.', true); return; }
    recentPanel.hidden = !recentPanel.hidden;
    if (!recentPanel.hidden) renderRecent();
  });
  document.addEventListener('click', e => {
    if (!recentPanel.hidden && !recentPanel.contains(e.target) && e.target !== recentBtn) closeRecent();
  });
  $('openCache').addEventListener('click', () => {
    api('/api/open-cache', { method: 'POST' }).catch(e => alert(netError(e)));
  });

  // ======================================================================
  // Forma d'onda e zoom
  // ======================================================================
  let peaks = null, peaksSig = '';

  function computeGlobalPeak(buf) {
    let max = 0;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      const inc = Math.max(1, Math.floor(d.length / 2e6));
      for (let i = 0; i < d.length; i += inc) { const v = Math.abs(d[i]); if (v > max) max = v; }
    }
    return max || 1;
  }

  function computePeaks(width) {
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    const sr = buffer.sampleRate, len = chans[0].length;
    const s0 = view.start * sr, step = (view.end - view.start) * sr / width;
    const out = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const s = Math.floor(s0 + x * step);
      const e = Math.min(len, Math.max(s + 1, Math.floor(s0 + (x + 1) * step)));
      let max = 0;
      const inc = Math.max(1, Math.floor((e - s) / 400));
      for (const ch of chans) for (let i = Math.max(0, s); i < e; i += inc) {
        const v = Math.abs(ch[i]);
        if (v > max) max = v;
      }
      out[x] = max / globalPeak;
    }
    return out;
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = wrap.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    peaks = null;
    draw();
  }
  window.addEventListener('resize', resize);

  const viewSpan = () => Math.max(1e-6, view.end - view.start);
  const timeToX = t => (t - view.start) / viewSpan() * canvas.width;
  const xToTime = clientX => {
    const r = canvas.getBoundingClientRect();
    return clamp(view.start + (clientX - r.left) / r.width * viewSpan(), 0, duration);
  };
  const pxPerSec = () => canvas.getBoundingClientRect().width / viewSpan();

  function draw() {
    const W = canvas.width, H = canvas.height, dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);
    if (!duration) return;

    if (region) {
      const x1 = timeToX(region.start), x2 = timeToX(region.end);
      ctx.fillStyle = css('--region');
      ctx.fillRect(x1, 0, x2 - x1, H);
    }

    if (buffer) {
      const sig = W + ':' + view.start + ':' + view.end;
      if (!peaks || peaksSig !== sig) { peaks = computePeaks(W); peaksSig = sig; }
      const mid = H / 2, amp = H / 2 - 6 * dpr;
      const rs = region ? timeToX(region.start) : -1, re = region ? timeToX(region.end) : -1;
      const waveCol = css('--wave'), activeCol = css('--wave-active');
      for (let x = 0; x < W; x++) {
        const h = Math.max(1, peaks[x] * amp);
        ctx.fillStyle = (x >= rs && x <= re) ? activeCol : waveCol;
        ctx.fillRect(x, mid - h, 1, h * 2);
      }
    }

    if (region) {
      ctx.fillStyle = css('--handle');
      for (const t of [region.start, region.end]) {
        const x = timeToX(t);
        ctx.fillRect(x - dpr, 0, 2 * dpr, H);
        ctx.fillRect(x - 5 * dpr, 0, 10 * dpr, 6 * dpr);
        ctx.fillRect(x - 5 * dpr, H - 6 * dpr, 10 * dpr, 6 * dpr);
      }
    }

    ctx.fillStyle = css('--playhead');
    ctx.fillRect(timeToX(audio.currentTime) - dpr, 0, 2 * dpr, H);
  }

  function setView(s, span) {
    if (!duration) return;
    span = clamp(span, Math.min(duration, 0.25), duration);
    s = clamp(s, 0, duration - span);
    view = { start: s, end: s + span };
    updateZoomUi();
    draw();
  }
  function zoomBy(factor, centerT) {
    if (!duration) return;
    const c = centerT !== undefined ? centerT
      : (audio.currentTime >= view.start && audio.currentTime <= view.end ? audio.currentTime : (view.start + view.end) / 2);
    const span = viewSpan() / factor;
    setView(c - (c - view.start) / factor, span);
  }
  function updateZoomUi() {
    const z = duration ? duration / viewSpan() : 1;
    $('zoomLabel').textContent = z > 1.01 ? 'Zoom ' + (z < 10 ? z.toFixed(1) : Math.round(z)) + '×' : '';
    $('zoomSel').disabled = !region;
  }
  $('zoomIn').addEventListener('click', () => zoomBy(2));
  $('zoomOut').addEventListener('click', () => zoomBy(0.5));
  $('zoomAll').addEventListener('click', () => setView(0, duration));
  $('zoomSel').addEventListener('click', () => {
    if (!region) return;
    const len = region.end - region.start, pad = len * 0.08;
    setView(region.start - pad, len + 2 * pad);
  });
  canvas.addEventListener('wheel', e => {
    if (!duration) return;
    if (e.ctrlKey) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.25 : 0.8, xToTime(e.clientX));
    } else if (viewSpan() < duration - 1e-6) {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setView(view.start + d / canvas.getBoundingClientRect().width * viewSpan(), viewSpan());
    }
  }, { passive: false });

  // ---------- interazione ----------
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (!duration) return;
    canvas.setPointerCapture(e.pointerId);
    const t = xToTime(e.clientX), pps = pxPerSec();
    let mode = 'new';
    if (region) {
      const ds = Math.abs(t - region.start) * pps, de = Math.abs(t - region.end) * pps;
      if (Math.min(ds, de) <= 8) mode = ds <= de ? 'start' : 'end';
    }
    drag = { mode, anchor: t, startX: e.clientX, moved: false };
  });
  canvas.addEventListener('pointermove', e => {
    if (!duration) return;
    const t = xToTime(e.clientX);
    if (!drag) {
      let near = false;
      if (region) near = Math.min(Math.abs(t - region.start), Math.abs(t - region.end)) * pxPerSec() <= 8;
      canvas.style.cursor = near ? 'ew-resize' : 'crosshair';
      return;
    }
    if (Math.abs(e.clientX - drag.startX) > 3) drag.moved = true;
    if (!drag.moved) return;
    if (drag.mode === 'new') setRegion(Math.min(drag.anchor, t), Math.max(drag.anchor, t));
    else if (drag.mode === 'start') {
      if (t > region.end) { drag.mode = 'end'; setRegion(region.end, t); } else setRegion(t, region.end);
    } else {
      if (t < region.start) { drag.mode = 'start'; setRegion(t, region.start); } else setRegion(region.start, t);
    }
  });
  canvas.addEventListener('pointerup', e => {
    if (!drag) return;
    if (!drag.moved) seek(xToTime(e.clientX));
    else if (region && region.end - region.start < 0.05) clearRegion();
    else if (region && $('loop').checked && !audio.paused &&
             (audio.currentTime < region.start || audio.currentTime > region.end)) seek(region.start);
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  // ======================================================================
  // Intervallo
  // ======================================================================
  function setRegion(s, e) {
    s = clamp(s, 0, duration); e = clamp(e, 0, duration);
    if (e < s) [s, e] = [e, s];
    const changed = !region || Math.abs(region.start - s) > 1e-4 || Math.abs(region.end - e) > 1e-4;
    region = { start: s, end: e };
    if (changed) { resetLoopCount(); trainerRestart(); }
    updateRegionUi();
    draw();
  }
  function clearRegion() {
    region = null;
    resetLoopCount();
    updateRegionUi();
    draw();
  }
  function updateRegionUi() {
    const sIn = $('startIn'), eIn = $('endIn');
    if (document.activeElement !== sIn) sIn.value = region ? fmt(region.start) : '';
    if (document.activeElement !== eIn) eIn.value = region ? fmt(region.end) : '';
    $('clearReg').disabled = !region;
    $('saveSection').disabled = !region;
    updateZoomUi();
    renderChips();
  }
  function commitInputs() {
    let s = parseTime($('startIn').value), e = parseTime($('endIn').value);
    if (isNaN(s)) s = region ? region.start : 0;
    if (isNaN(e)) e = region ? region.end : duration;
    if (e - s >= 0.05) setRegion(s, e);
    updateRegionUi();
  }
  ['startIn', 'endIn'].forEach(id => {
    const el = $(id);
    el.addEventListener('change', commitInputs);
    el.addEventListener('blur', () => setTimeout(updateRegionUi, 0));
    el.addEventListener('keydown', e => { if (e.key === 'Enter') { commitInputs(); el.blur(); } });
  });
  function setA() {
    const t = audio.currentTime;
    if (region && t < region.end) setRegion(t, region.end); else setRegion(t, duration);
  }
  function setB() {
    const t = audio.currentTime;
    if (region && t > region.start) setRegion(region.start, t); else setRegion(0, t);
  }
  $('setA').addEventListener('click', setA);
  $('setB').addEventListener('click', setB);
  $('clearReg').addEventListener('click', clearRegion);

  // ======================================================================
  // Sezioni salvate
  // ======================================================================
  function loadSections() {
    sections = songKey ? store.get('sections:' + songKey, []) : [];
    if (!Array.isArray(sections)) sections = [];
    renderChips();
  }
  function saveSections() { if (songKey) store.set('sections:' + songKey, sections); }

  function renderChips() {
    const box = $('chips');
    box.innerHTML = '';
    if (!sections.length) {
      const s = document.createElement('span');
      s.className = 'muted';
      s.textContent = 'Seleziona un intervallo e salvalo per ritrovarlo subito.';
      box.append(s);
      return;
    }
    sections.forEach((sec, i) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      if (region && Math.abs(region.start - sec.start) < 0.01 && Math.abs(region.end - sec.end) < 0.01) chip.classList.add('on');
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
    if (!sec || !duration) return;
    const wasPlaying = !audio.paused || waiting;
    stopWaiting();
    if (!$('trainerOn').checked) applySpeed(sec.speed);
    setRegion(sec.start, sec.end);
    if (viewSpan() < duration - 1e-6 && (sec.start < view.start || sec.end > view.end)) $('zoomSel').click();
    seek(sec.start);
    if (wasPlaying) audio.play();
  }

  $('saveSection').addEventListener('click', () => {
    if (!region) return;
    const n = prompt('Nome della sezione (es. Intro, Assolo, Ritornello):', 'Sezione ' + (sections.length + 1));
    if (n === null) return;
    sections.push({ name: n.trim() || 'Sezione ' + (sections.length + 1), start: region.start, end: region.end, speed: audio.playbackRate });
    sections.sort((a, b) => a.start - b.start);
    saveSections();
    renderChips();
  });

  // ======================================================================
  // Riproduzione, loop, pausa/conteggio
  // ======================================================================
  function seek(t) {
    audio.currentTime = clamp(t, 0, duration);
    prevTime = audio.currentTime;
    fadingOut = false;
    resetFade();
    draw();
    updateTime();
  }

  function updatePlayLabel() {
    $('play').textContent = (!audio.paused || waiting) ? '❚❚ Pausa' : '▶ Play';
  }

  function inLoopMode() { return region && $('loop').checked; }

  function togglePlay() {
    if (!audio.src || !duration) return;
    if (waiting) { stopWaiting(); return; }
    if (audio.paused) {
      ensureGraph();
      if (inLoopMode() && (audio.currentTime < region.start || audio.currentTime >= region.end - 0.01)) seek(region.start);
      if (inLoopMode() && $('pauseMode').value === 'count' && Math.abs(audio.currentTime - region.start) < 0.05) {
        startWaiting();
      } else {
        audio.play();
      }
    } else {
      audio.pause();
    }
  }
  function stop() {
    stopWaiting();
    audio.pause();
    seek(region ? region.start : 0);
    resetLoopCount();
    trainerRestart();
  }
  function restart() {
    if (!duration) return;
    stopWaiting();
    seek(region ? region.start : 0);
    if (audio.paused) togglePlay();
  }
  $('play').addEventListener('click', togglePlay);
  $('stop').addEventListener('click', stop);
  audio.addEventListener('play', updatePlayLabel);
  audio.addEventListener('pause', updatePlayLabel);
  audio.addEventListener('ended', () => {
    if (inLoopMode() && region.end >= duration - 0.05) onLoopEnd();
  });

  function onLoopEnd() {
    loopCount++;
    updateCounter();
    trainerOnLoop();
    const mode = $('pauseMode').value;
    if (mode === '0') {
      audio.currentTime = region.start;
      prevTime = region.start;
      fadingOut = false;
      fadeIn();
      if (audio.paused) audio.play();
      return;
    }
    audio.pause();
    seek(region.start);
    startWaiting();
  }

  // pausa o conteggio, poi riparte
  function startWaiting() {
    const mode = $('pauseMode').value;
    waiting = true;
    updatePlayLabel();
    let ms;
    if (mode === 'count') {
      const beat = 60 / clamp(parseFloat($('bpm').value) || 100, 30, 300);
      playClicks(4, beat);
      ms = 4 * beat * 1000;
    } else {
      ms = (parseFloat(mode) || 0) * 1000;
    }
    waitTimer = setTimeout(() => {
      waitTimer = null;
      if (!waiting) return;
      waiting = false;
      seek(region ? region.start : audio.currentTime);
      audio.play();
      updatePlayLabel();
    }, ms);
  }
  function stopWaiting() {
    if (waitTimer) clearTimeout(waitTimer);
    waitTimer = null;
    clickNodes.forEach(n => { try { n.stop(); } catch { /* già fermo */ } });
    clickNodes = [];
    if (waiting) { waiting = false; updatePlayLabel(); }
  }
  function playClicks(n, beat) {
    const g = ensureGraph();
    if (!g) return;
    const t0 = ac.currentTime + 0.05;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * beat;
      const osc = ac.createOscillator(), env = ac.createGain();
      osc.frequency.value = i === 0 ? 1600 : 1000;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.6, t + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(env).connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.07);
      clickNodes.push(osc);
    }
  }
  $('pauseMode').addEventListener('change', () => {
    $('bpmBox').hidden = $('pauseMode').value !== 'count';
    store.set('pauseMode', $('pauseMode').value);
  });
  $('bpm').addEventListener('change', () => store.set('bpm', $('bpm').value));

  // ---------- contatore ----------
  function resetLoopCount() { loopCount = 0; updateCounter(); }
  function updateCounter() {
    $('counter').textContent = region && duration ? 'Ripetizioni: ' + loopCount : '';
  }

  // ---------- ciclo principale ----------
  const FADE = 0.025; // secondi
  function tick() {
    const t = audio.currentTime;
    if (inLoopMode() && !audio.paused && !drag && !waiting) {
      // dissolvenza in uscita poco prima della fine
      if ($('fade').checked && graph && !fadingOut && prevTime <= region.end &&
          t >= region.end - FADE * audio.playbackRate && t < region.end) {
        fadingOut = true;
        fadeOut();
      }
      // fine dell'intervallo attraversata: ripeti
      if (prevTime <= region.end && t >= region.end) onLoopEnd();
    }
    prevTime = audio.currentTime;
    // durante la riproduzione con zoom, la vista segue la testina
    if (!audio.paused && !drag && viewSpan() < duration - 1e-6 &&
        (audio.currentTime > view.end || audio.currentTime < view.start)) {
      setView(audio.currentTime - viewSpan() * 0.1, viewSpan());
    }
    if (!audio.paused || drag) { draw(); updateTime(); }
    requestAnimationFrame(tick);
  }
  function updateTime() { $('time').textContent = fmt(audio.currentTime) + ' / ' + fmt(duration); }
  requestAnimationFrame(tick);

  // ======================================================================
  // Velocità e allenatore
  // ======================================================================
  function applySpeed(v) {
    v = clamp(Math.round(v * 100) / 100, 0.1, 4);
    if (isNaN(v)) return;
    audio.playbackRate = v;
    audio.defaultPlaybackRate = v;
    $('speed').value = clamp(v, 0.1, 2);
    $('speedVal').textContent = v.toFixed(2) + '×';
    if (document.activeElement !== $('speedIn')) $('speedIn').value = v;
    document.querySelectorAll('.preset').forEach(b =>
      b.classList.toggle('on', Math.abs(parseFloat(b.dataset.v) - v) < 0.001));
    updateTrainerStatus();
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
  $('pitch').addEventListener('change', applyPitchPreserve);

  // allenatore: la velocità sale ogni N ripetizioni
  let trainerLoops = 0;
  const trainerCfg = () => {
    const from = clamp(parseFloat($('trFrom').value) || 60, 10, 200);
    const to = clamp(parseFloat($('trTo').value) || 100, 10, 200);
    return {
      from, to,
      step: clamp(parseFloat($('trStep').value) || 5, 1, 50),
      every: clamp(Math.round(parseFloat($('trEvery').value) || 2), 1, 50),
    };
  };
  function trainerRestart() {
    trainerLoops = 0;
    if ($('trainerOn').checked) applySpeed(trainerCfg().from / 100);
    updateTrainerStatus();
  }
  function trainerOnLoop() {
    if (!$('trainerOn').checked) return;
    const c = trainerCfg();
    trainerLoops++;
    if (trainerLoops % c.every === 0) {
      const cur = Math.round(audio.playbackRate * 100);
      const next = c.to >= c.from ? Math.min(c.to, cur + c.step) : Math.max(c.to, cur - c.step);
      applySpeed(next / 100);
    }
    updateTrainerStatus();
  }
  function updateTrainerStatus() {
    const el = $('trainerStatus');
    if (!$('trainerOn').checked) { el.textContent = ''; return; }
    const c = trainerCfg();
    const cur = Math.round(audio.playbackRate * 100);
    if (cur === Math.round(c.to)) { el.textContent = 'Obiettivo raggiunto: ' + cur + '% 🎉'; return; }
    const left = c.every - (trainerLoops % c.every);
    el.textContent = 'Velocità attuale ' + cur + '% · prossimo cambio tra ' + left + (left === 1 ? ' giro' : ' giri') +
      (region ? '' : ' (seleziona un intervallo in loop)');
  }
  $('trainerOn').addEventListener('change', trainerRestart);
  ['trFrom', 'trTo', 'trStep', 'trEvery'].forEach(id => $(id).addEventListener('change', () => {
    store.set('trainer', trainerCfg());
    if (id === 'trFrom') trainerRestart(); else updateTrainerStatus();
  }));

  // ======================================================================
  // Catena audio: isolamento → EQ → trasposizione → dissolvenza → volume
  // ======================================================================
  let ac = null, graph = null;

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

  function ensureGraph() {
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
    store.set('iso', $('iso').value);
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
    store.set('eq', vals);
    if (!graph) return;
    for (const k in vals) graph[k].gain.setTargetAtTime(vals[k], ac.currentTime, 0.02);
  }

  // ---------- trasposizione ----------
  let shifterLoading = null;
  function shiftRatio() { return Math.pow(2, (+$('semi').value + +$('cents').value / 100) / 12); }
  function applyShift() {
    const semi = +$('semi').value, cents = +$('cents').value;
    $('semiVal').textContent = (semi > 0 ? '+' : '') + semi + (Math.abs(semi) === 1 ? ' semitono' : ' semitoni');
    $('centsVal').textContent = (cents > 0 ? '+' : '') + cents + ' cent';
    store.set('shift', { semi, cents });
    if (!graph) return;
    const ratio = shiftRatio();
    const g = graph;
    if (Math.abs(ratio - 1) < 1e-6) {
      // nessuna trasposizione: il modulo viene escluso
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
    // ripiego per browser senza AudioWorklet
    const Shifter = new Function(SHIFTER_SRC + '; return Shifter;')();
    const s = new Shifter(ac.sampleRate);
    const node = ac.createScriptProcessor(2048, 2, 2);
    node.onaudioprocess = e => {
      const ib = e.inputBuffer, ob = e.outputBuffer;
      const ins = [ib.getChannelData(0), ib.numberOfChannels > 1 ? ib.getChannelData(1) : ib.getChannelData(0)];
      const outs = [ob.getChannelData(0), ob.getChannelData(1)];
      s.process(ins, outs, ob.length);
    };
    return { node, setRatio: r => { s.ratio = r; }, disconnect: () => node.disconnect() };
  }

  // ---------- dissolvenza ----------
  function fadeOut() {
    if (!graph) return;
    const g = graph.fade.gain, now = ac.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + FADE);
  }
  function fadeIn() {
    if (!graph) return;
    const g = graph.fade.gain, now = ac.currentTime;
    g.cancelScheduledValues(now);
    if ($('fade').checked) {
      g.setValueAtTime(0, now);
      g.linearRampToValueAtTime(1, now + FADE);
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
    store.set('vol', v);
    if (graph) graph.vol.gain.setTargetAtTime(v / 100, ac.currentTime, 0.02);
    else audio.volume = clamp(v / 100, 0, 1);
  }
  $('vol').addEventListener('input', applyVolume);

  // collegamenti dei controlli del suono (creano la catena audio al primo uso)
  const withGraph = fn => () => { ensureGraph(); fn(); };
  $('iso').addEventListener('change', withGraph(applyIso));
  ['eqLow', 'eqMid', 'eqHigh'].forEach(id => $(id).addEventListener('input', withGraph(applyEq)));
  ['semi', 'cents'].forEach(id => $(id).addEventListener('input', withGraph(applyShift)));
  $('fade').addEventListener('change', () => { store.set('fade', $('fade').checked); resetFade(); });
  $('soundReset').addEventListener('click', () => {
    ['semi', 'cents', 'eqLow', 'eqMid', 'eqHigh'].forEach(id => { $(id).value = 0; });
    $('iso').value = 'normal';
    $('fade').checked = true;
    store.set('fade', true);
    applyEq(); applyShift(); applyIso();
  });

  // ======================================================================
  // Tastiera (anche pedali Bluetooth: PagGiù/PagSu, frecce su/giù)
  // ======================================================================
  document.addEventListener('keydown', e => {
    const t = e.target, tag = (t.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'textarea') return;
    if (tag === 'input' && t.type !== 'checkbox' && t.type !== 'range') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') { closeRecent(); return; }
    if (!duration) return;
    switch (e.key) {
      case ' ': case 'PageDown': case 'ArrowDown': e.preventDefault(); togglePlay(); break;
      case 'PageUp': case 'ArrowUp': e.preventDefault(); restart(); break;
      case 'a': case 'A': setA(); break;
      case 'b': case 'B': setB(); break;
      case 'l': case 'L': $('loop').checked = !$('loop').checked; break;
      case 'ArrowLeft': e.preventDefault(); seek(audio.currentTime - 2); break;
      case 'ArrowRight': e.preventDefault(); seek(audio.currentTime + 2); break;
      case '+': case '=': applySpeed(audio.playbackRate + 0.05); break;
      case '-': case '_': applySpeed(audio.playbackRate - 0.05); break;
      default:
        if (/^[1-9]$/.test(e.key)) recallSection(+e.key - 1);
    }
  });

  // togli il focus dai controlli dopo l'uso, così Spazio/frecce restano scorciatoie globali
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) b.blur();
  });
  document.addEventListener('change', e => {
    if (e.target.type === 'checkbox' || e.target.type === 'range' || e.target.tagName === 'SELECT') e.target.blur();
  });

  // ======================================================================
  // Avvio: ripristino impostazioni
  // ======================================================================
  document.querySelectorAll('details[data-key]').forEach(d => {
    d.open = !!store.get('open:' + d.dataset.key, false);
    d.addEventListener('toggle', () => store.set('open:' + d.dataset.key, d.open));
  });
  $('vol').value = store.get('vol', 100);
  $('pauseMode').value = store.get('pauseMode', '0');
  if (!$('pauseMode').value) $('pauseMode').value = '0';
  $('bpmBox').hidden = $('pauseMode').value !== 'count';
  $('bpm').value = store.get('bpm', 100);
  const tr = store.get('trainer', null);
  if (tr) { $('trFrom').value = tr.from; $('trTo').value = tr.to; $('trStep').value = tr.step; $('trEvery').value = tr.every; }
  const eq = store.get('eq', null);
  if (eq) { $('eqLow').value = eq.eqLow || 0; $('eqMid').value = eq.eqMid || 0; $('eqHigh').value = eq.eqHigh || 0; }
  const sh = store.get('shift', null);
  if (sh) { $('semi').value = sh.semi || 0; $('cents').value = sh.cents || 0; }
  $('iso').value = store.get('iso', 'normal');
  if (!$('iso').value) $('iso').value = 'normal';
  $('fade').checked = store.get('fade', true);

  applyVolume();
  applyEq();
  applyShift();
  applyPitchPreserve();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
  resize();
})();
