/* Looper — forma d'onda: disegno veloce, griglia dei beat, panoramica, mouse e touch */
(L => {
  'use strict';
  const { $, clamp } = L;

  // stato condiviso del brano
  const S = L.state = {
    buffer: null, duration: 0, region: null,
    view: { start: 0, end: 0 },
    grid: null,            // {bpm, offset, beatsPerBar}
    gridShow: true, snap: true,
  };

  const audio = $('audio');
  const wrap = $('waveWrap'), canvas = $('wave'), ctx = canvas.getContext('2d');
  const ovWrap = $('overviewWrap'), ov = $('overview'), octx = ov.getContext('2d');
  const stat = document.createElement('canvas'), sctx = stat.getContext('2d');    // forma d'onda statica
  const ovStat = document.createElement('canvas'), osctx = ovStat.getContext('2d');

  const hooks = { seek() {}, setRegion() {}, clearRegion() {}, dragEnd() {} };
  let dirty = true, ovDirty = true, needsDraw = true;
  let lastUserView = 0;

  // ======================================================================
  // Piramide dei picchi (calcolata una volta per brano)
  // ======================================================================
  const BASE = 64;
  let levels = [], globalPeak = 1;

  function buildPyramid(buffer) {
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(buffer.getChannelData(c));
    const len = buffer.length;
    let n = Math.ceil(len / BASE);
    let data = new Float32Array(n);
    for (let b = 0; b < n; b++) {
      const s0 = b * BASE, s1 = Math.min(len, s0 + BASE);
      let m = 0;
      for (const ch of chans) for (let i = s0; i < s1; i++) { const v = ch[i] < 0 ? -ch[i] : ch[i]; if (v > m) m = v; }
      data[b] = m;
    }
    levels = [{ block: BASE, data }];
    while (n > 1024) {
      const n2 = Math.ceil(n / 2), d2 = new Float32Array(n2);
      for (let i = 0; i < n2; i++) { const a = data[2 * i], b = data[2 * i + 1] || 0; d2[i] = a > b ? a : b; }
      levels.push({ block: levels[levels.length - 1].block * 2, data: d2 });
      data = d2; n = n2;
    }
    globalPeak = 0;
    for (let i = 0; i < data.length; i++) if (data[i] > globalPeak) globalPeak = data[i];
    globalPeak = globalPeak || 1;
  }

  /** picchi (0..1) per W colonne tra t0 e t1 */
  function peaksFor(W, t0, t1) {
    const buf = S.buffer, sr = buf.sampleRate, out = new Float32Array(W);
    const s0 = t0 * sr, spp = (t1 - t0) * sr / W;
    if (spp < BASE) {
      const chans = [];
      for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
      const len = buf.length;
      for (let x = 0; x < W; x++) {
        const i0 = Math.max(0, Math.floor(s0 + x * spp)), i1 = Math.min(len, Math.max(i0 + 1, Math.floor(s0 + (x + 1) * spp)));
        let m = 0;
        for (const ch of chans) for (let i = i0; i < i1; i++) { const v = ch[i] < 0 ? -ch[i] : ch[i]; if (v > m) m = v; }
        out[x] = m / globalPeak;
      }
      return out;
    }
    let lv = levels[0];
    for (const l of levels) if (l.block <= spp) lv = l;
    const d = lv.data, bs = lv.block;
    for (let x = 0; x < W; x++) {
      const b0 = Math.max(0, Math.floor((s0 + x * spp) / bs)), b1 = Math.min(d.length, Math.max(b0 + 1, Math.floor((s0 + (x + 1) * spp) / bs)));
      let m = 0;
      for (let i = b0; i < b1; i++) if (d[i] > m) m = d[i];
      out[x] = m / globalPeak;
    }
    return out;
  }

  // ======================================================================
  // Geometria
  // ======================================================================
  const span = () => Math.max(1e-6, S.view.end - S.view.start);
  const isZoomed = () => S.duration > 0 && span() < S.duration - 1e-6;
  const dpr = () => window.devicePixelRatio || 1;
  const timeToX = t => (t - S.view.start) / span() * canvas.width;          // pixel del canvas
  const xToTime = clientX => {
    const r = canvas.getBoundingClientRect();
    return clamp(S.view.start + (clientX - r.left) / r.width * span(), 0, S.duration);
  };
  const pxPerSec = () => canvas.getBoundingClientRect().width / span();       // pixel CSS

  function setView(s, sp) {
    if (!S.duration) return;
    sp = clamp(sp, Math.min(S.duration, 0.2), S.duration);
    s = clamp(s, 0, S.duration - sp);
    if (Math.abs(s - S.view.start) < 1e-9 && Math.abs(s + sp - S.view.end) < 1e-9) return;
    S.view = { start: s, end: s + sp };
    dirty = needsDraw = true;
    updateZoomUi();
  }
  function zoomBy(factor, centerT) {
    if (!S.duration) return;
    const t = audio.currentTime;
    const c = centerT !== undefined ? centerT : (t >= S.view.start && t <= S.view.end ? t : (S.view.start + S.view.end) / 2);
    setView(c - (c - S.view.start) / factor, span() / factor);
    lastUserView = performance.now();
  }
  function updateZoomUi() {
    const z = S.duration ? S.duration / span() : 1;
    $('zoomLabel').textContent = z > 1.01 ? 'Zoom ' + (z < 10 ? z.toFixed(1) : Math.round(z)) + '×' : '';
    $('zoomSel').disabled = !S.region;
  }

  // ======================================================================
  // Disegno
  // ======================================================================
  function resize() {
    const d = dpr();
    for (const [cv, w] of [[canvas, wrap], [ov, ovWrap]]) {
      const r = w.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width * d));
      cv.height = Math.max(1, Math.round(r.height * d));
    }
    stat.width = canvas.width; stat.height = canvas.height;
    ovStat.width = ov.width; ovStat.height = ov.height;
    dirty = ovDirty = true;
    frame();
  }

  function drawGrid(c, W, H) {
    const g = S.grid;
    if (!g || !S.gridShow) return;
    const bl = 60 / g.bpm, bpb = g.beatsPerBar || 4, pps = canvas.width / span();
    const beatPx = bl * pps, barPx = beatPx * bpb;
    if (barPx < 6) return;
    const showBeats = beatPx >= 6, showLabels = barPx >= 26 * dpr();
    const k0 = Math.ceil((S.view.start - g.offset) / bl), k1 = Math.floor((S.view.end - g.offset) / bl);
    const d = dpr();
    c.font = Math.round(10 * d) + 'px system-ui, sans-serif';
    c.textBaseline = 'top';
    for (let k = k0; k <= k1; k++) {
      const isBar = ((k % bpb) + bpb) % bpb === 0;
      if (!isBar && !showBeats) continue;
      const x = Math.round(timeToX(g.offset + k * bl));
      c.fillStyle = isBar ? L.colors['grid-bar'] : L.colors.grid;
      c.fillRect(x, 0, isBar ? Math.max(1, Math.round(d)) : 1, H);
      if (isBar && showLabels) {
        const bar = Math.floor(k / bpb) + 1;
        if (bar >= 1) { c.fillStyle = L.colors.muted; c.fillText(String(bar), x + 3 * d, 3 * d); }
      }
    }
  }

  function drawStatic() {
    const W = stat.width, H = stat.height, c = sctx;
    c.clearRect(0, 0, W, H);
    if (!S.duration) return;
    const R = S.region;
    if (R) {
      const x1 = timeToX(R.start), x2 = timeToX(R.end);
      c.fillStyle = L.colors.region;
      c.fillRect(x1, 0, x2 - x1, H);
    }
    drawGrid(c, W, H);
    if (S.buffer) {
      const pk = peaksFor(W, S.view.start, S.view.end);
      const mid = H / 2, amp = H / 2 - 6 * dpr();
      const rs = R ? timeToX(R.start) : -1, re = R ? timeToX(R.end) : -1;
      const pIn = new Path2D(), pOut = new Path2D();
      for (let x = 0; x < W; x++) {
        const h = Math.max(1, pk[x] * amp);
        (x >= rs && x <= re ? pIn : pOut).rect(x, mid - h, 1, h * 2);
      }
      c.fillStyle = L.colors.wave; c.fill(pOut);
      c.fillStyle = L.colors['wave-active']; c.fill(pIn);
    }
    dirty = false;
  }

  function drawOverviewStatic() {
    const W = ovStat.width, H = ovStat.height, c = osctx;
    c.clearRect(0, 0, W, H);
    if (S.buffer) {
      const pk = peaksFor(W, 0, S.duration), mid = H / 2, amp = H / 2 - 2 * dpr();
      const p = new Path2D();
      for (let x = 0; x < W; x++) { const h = Math.max(0.5, pk[x] * amp); p.rect(x, mid - h, 1, h * 2); }
      c.fillStyle = L.colors.wave; c.fill(p);
    }
    ovDirty = false;
  }

  function frame() {
    needsDraw = false;
    const W = canvas.width, H = canvas.height, d = dpr();
    ctx.clearRect(0, 0, W, H);
    octx.clearRect(0, 0, ov.width, ov.height);
    if (!S.duration) return;
    if (dirty) drawStatic();
    ctx.drawImage(stat, 0, 0);

    const R = S.region;
    if (R) {
      ctx.fillStyle = L.colors.handle;
      for (const t of [R.start, R.end]) {
        const x = timeToX(t);
        if (x < -10 * d || x > W + 10 * d) continue;
        ctx.fillRect(x - d, 0, 2 * d, H);
        ctx.fillRect(x - 6 * d, 0, 12 * d, 7 * d);
        ctx.fillRect(x - 6 * d, H - 7 * d, 12 * d, 7 * d);
      }
    }
    ctx.fillStyle = L.colors.playhead;
    ctx.fillRect(timeToX(audio.currentTime) - d, 0, 2 * d, H);

    // panoramica: tutto il brano, regione, finestra visibile, testina
    const OW = ov.width, OH = ov.height, ox = t => t / S.duration * OW;
    if (ovDirty) drawOverviewStatic();
    if (R) { octx.fillStyle = L.colors.region; octx.fillRect(ox(R.start), 0, Math.max(1, ox(R.end) - ox(R.start)), OH); }
    octx.drawImage(ovStat, 0, 0);
    if (isZoomed()) {
      const x1 = ox(S.view.start), x2 = ox(S.view.end);
      octx.fillStyle = L.colors.view;
      octx.fillRect(x1, 0, Math.max(2, x2 - x1), OH);
      octx.strokeStyle = L.colors.accent;
      octx.lineWidth = 1.5 * d;
      octx.strokeRect(x1 + 0.75 * d, 0.75 * d, Math.max(2, x2 - x1) - 1.5 * d, OH - 1.5 * d);
    }
    octx.fillStyle = L.colors.playhead;
    octx.fillRect(ox(audio.currentTime) - d / 2, 0, d, OH);
  }

  // ======================================================================
  // Aggancio ai beat
  // ======================================================================
  function snap(t, e, touch) {
    const g = S.grid;
    if (!g || !S.snap || !S.gridShow || (e && e.altKey)) return t;
    const bt = L.nearestBeat(g, t);
    const tol = (touch ? 16 : 10) / pxPerSec();
    return Math.abs(bt - t) <= tol ? clamp(bt, 0, S.duration) : t;
  }

  // ======================================================================
  // Interazione sulla forma d'onda: mouse, penna, dita
  // ======================================================================
  const pointers = new Map();
  let drag = null, pinch = null, ignoreRest = false, autoRaf = 0;

  function regionCopy() { return S.region ? { ...S.region } : null; }

  function applyDrag(clientX, e) {
    const touch = drag.touch;
    const t = snap(xToTime(clientX), e, touch);
    const R = S.region;
    if (drag.mode === 'new') hooks.setRegion(Math.min(drag.anchor, t), Math.max(drag.anchor, t));
    else if (drag.mode === 'start') {
      if (t > R.end) { drag.mode = 'end'; hooks.setRegion(R.end, t); } else hooks.setRegion(t, R.end);
    } else if (drag.mode === 'end') {
      if (t < R.start) { drag.mode = 'start'; hooks.setRegion(t, R.start); } else hooks.setRegion(R.start, t);
    }
  }

  // scorrimento automatico quando si trascina vicino ai bordi con lo zoom attivo
  function autoScroll() {
    autoRaf = 0;
    if (!drag || !drag.moved || !isZoomed()) return;
    const r = canvas.getBoundingClientRect(), edge = drag.touch ? 36 : 24;
    let dir = 0;
    if (drag.lastX < r.left + edge) dir = -1; else if (drag.lastX > r.right - edge) dir = 1;
    if (dir) {
      setView(S.view.start + dir * span() * 0.012, span());
      applyDrag(drag.lastX, drag.lastE);
    }
    autoRaf = requestAnimationFrame(autoScroll);
  }

  canvas.addEventListener('pointerdown', e => {
    if (!S.duration) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    pointers.set(e.pointerId, { x: e.clientX });
    if (pointers.size === 2) {
      // secondo dito: zoom a pizzico (annulla l'eventuale selezione appena iniziata)
      if (drag && drag.moved) {
        if (drag.before) hooks.setRegion(drag.before.start, drag.before.end); else hooks.clearRegion();
      }
      drag = null;
      const [a, b] = [...pointers.values()];
      const cx = (a.x + b.x) / 2;
      pinch = { d0: Math.max(20, Math.abs(a.x - b.x)), span0: span(), t0: xToTime(cx) };
      return;
    }
    if (pointers.size > 2 || ignoreRest) return;
    const touch = e.pointerType === 'touch';
    const t = xToTime(e.clientX), pps = pxPerSec(), R = S.region;
    let mode = 'new';
    if (R) {
      const ds = Math.abs(t - R.start) * pps, de = Math.abs(t - R.end) * pps, tol = touch ? 24 : 8;
      if (Math.min(ds, de) <= tol) mode = ds <= de ? 'start' : 'end';
    }
    drag = { mode, anchor: snap(t, e, touch), startX: e.clientX, lastX: e.clientX, lastE: e, moved: false, touch, before: regionCopy() };
  });

  canvas.addEventListener('pointermove', e => {
    if (!S.duration) return;
    const p = pointers.get(e.pointerId);
    if (p) p.x = e.clientX;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const factor = Math.max(20, Math.abs(a.x - b.x)) / pinch.d0;
      const sp = clamp(pinch.span0 / factor, Math.min(S.duration, 0.2), S.duration);
      const r = canvas.getBoundingClientRect(), cx = (a.x + b.x) / 2;
      setView(pinch.t0 - (cx - r.left) / r.width * sp, sp);
      lastUserView = performance.now();
      return;
    }
    if (!drag) {
      if (e.pointerType === 'mouse') {
        let near = false;
        const R = S.region;
        if (R) { const t = xToTime(e.clientX); near = Math.min(Math.abs(t - R.start), Math.abs(t - R.end)) * pxPerSec() <= 8; }
        canvas.style.cursor = near ? 'ew-resize' : 'crosshair';
      }
      return;
    }
    drag.lastX = e.clientX; drag.lastE = e;
    if (!drag.moved && Math.abs(e.clientX - drag.startX) > (drag.touch ? 8 : 3)) {
      drag.moved = true;
      if (!autoRaf) autoRaf = requestAnimationFrame(autoScroll);
    }
    if (drag.moved) applyDrag(e.clientX, e);
  });

  function pointerEnd(e, cancelled) {
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size < 2) { pinch = null; ignoreRest = pointers.size > 0; }
      return;
    }
    if (pointers.size === 0) ignoreRest = false;
    if (!drag) return;
    const d = drag;
    drag = null;
    if (autoRaf) { cancelAnimationFrame(autoRaf); autoRaf = 0; }
    if (cancelled) return;
    if (!d.moved) hooks.seek(xToTime(e.clientX));
    else hooks.dragEnd();
  }
  canvas.addEventListener('pointerup', e => pointerEnd(e, false));
  canvas.addEventListener('pointercancel', e => pointerEnd(e, true));

  canvas.addEventListener('wheel', e => {
    if (!S.duration) return;
    if (e.ctrlKey) {                       // anche il pizzico sul trackpad del Mac
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.01), xToTime(e.clientX));
    } else if (isZoomed()) {
      e.preventDefault();
      const dd = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setView(S.view.start + dd / canvas.getBoundingClientRect().width * span(), span());
      lastUserView = performance.now();
    }
  }, { passive: false });

  // ---------- panoramica ----------
  let ovDrag = null;
  const ovTime = clientX => {
    const r = ov.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * S.duration;
  };
  ov.addEventListener('pointerdown', e => {
    if (!S.duration) return;
    try { ov.setPointerCapture(e.pointerId); } catch { /* ignora */ }
    const t = ovTime(e.clientX);
    const inside = isZoomed() && t >= S.view.start && t <= S.view.end;
    ovDrag = { startX: e.clientX, moved: false, grab: inside ? t - S.view.start : span() / 2 };
  });
  ov.addEventListener('pointermove', e => {
    if (!ovDrag) return;
    if (Math.abs(e.clientX - ovDrag.startX) > 3) ovDrag.moved = true;
    if (!ovDrag.moved) return;
    const t = ovTime(e.clientX);
    if (isZoomed()) { setView(t - ovDrag.grab, span()); lastUserView = performance.now(); }
    else hooks.seek(t);
  });
  ov.addEventListener('pointerup', e => {
    if (!ovDrag) return;
    if (!ovDrag.moved) {
      const t = ovTime(e.clientX);
      hooks.seek(t);
      if (isZoomed() && (t < S.view.start || t > S.view.end)) setView(t - span() * 0.3, span());
    }
    ovDrag = null;
  });
  ov.addEventListener('pointercancel', () => { ovDrag = null; });

  // ---------- pulsanti zoom ----------
  $('zoomIn').addEventListener('click', () => zoomBy(2));
  $('zoomOut').addEventListener('click', () => zoomBy(0.5));
  $('zoomAll').addEventListener('click', () => setView(0, S.duration));
  $('zoomSel').addEventListener('click', () => zoomToRegion());
  function zoomToRegion() {
    const R = S.region;
    if (!R) return;
    const len = R.end - R.start, pad = len * 0.08;
    setView(R.start - pad, len + 2 * pad);
    lastUserView = performance.now();
  }

  // ---------- la vista segue la testina durante la riproduzione ----------
  function follow(t, looping) {
    if (!isZoomed() || drag || pinch || ovDrag || performance.now() - lastUserView < 2500) return;
    const R = S.region;
    if (looping && R && R.start >= S.view.start && R.end <= S.view.end) return;   // il loop è già tutto visibile
    const sp = span();
    if (t < S.view.start || t > S.view.start + sp * 0.3) setView(t - sp * 0.3, sp);
  }

  // ---------- ridimensionamento e tema ----------
  if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
  else window.addEventListener('resize', resize);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { L.readColors(); dirty = ovDirty = true; frame(); });
  L.readColors();

  L.wave = {
    hooks,
    frame,
    resize,
    invalidate() { dirty = needsDraw = true; },
    requestDraw() { needsDraw = true; },
    get needsDraw() { return needsDraw; },
    setBuffer(buffer) {
      S.buffer = buffer;
      if (buffer) buildPyramid(buffer); else levels = [];
      dirty = ovDirty = needsDraw = true;
    },
    setView, zoomBy, zoomToRegion, isZoomed, follow, updateZoomUi,
    get dragging() { return !!(drag || pinch); },
  };
})(window.Looper);
