/* Looper — utilità condivise */
window.Looper = window.Looper || {};
(L => {
  'use strict';

  L.$ = id => document.getElementById(id);
  L.clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  L.fmt = t => {
    if (!isFinite(t) || t < 0) t = 0;
    const m = Math.floor(t / 60);
    return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0');
  };

  L.parseTime = str => {
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

  // impostazioni e dati piccoli (localStorage, sempre protetto da try/catch)
  L.store = {
    get(k, d) {
      try { const v = localStorage.getItem('looper:' + k); return v === null ? d : JSON.parse(v); }
      catch { return d; }
    },
    set(k, v) { try { localStorage.setItem('looper:' + k, JSON.stringify(v)); } catch { /* ignora */ } },
    remove(k) { try { localStorage.removeItem('looper:' + k); } catch { /* ignora */ } },
  };

  // dispositivo touch (telefono/tablet)
  L.isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches;

  // server Windows (avvia-looper.bat): rilevato all'avvio con /api/ping
  L.hasServer = false;
  L.served = location.protocol === 'http:' || location.protocol === 'https:';

  L.netError = e => e && e.message === 'Failed to fetch'
    ? L.t('Server non raggiungibile: è ancora aperta la finestra di avvia-looper.bat?')
    : (e && e.message) || String(e);

  L.api = async (path, opts = {}) => {
    const r = await fetch(path, { ...opts, headers: { 'X-Looper': '1', ...(opts.headers || {}) } });
    let j;
    try { j = await r.json(); } catch { throw new Error(L.t('Risposta non valida dal server (errore {n})', { n: r.status })); }
    if (!r.ok || j.error) throw new Error(j.error || L.t('Errore {n}', { n: r.status }));
    return j;
  };

  // colori del tema, letti una volta e aggiornati al cambio chiaro/scuro
  L.colors = {};
  L.readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['wave', 'wave-active', 'region', 'handle', 'playhead', 'grid', 'grid-bar', 'muted', 'accent', 'view', 'panel'])
      L.colors[k] = cs.getPropertyValue('--' + k).trim();
    L.colors.sec = [];
    for (let i = 1; i <= L.SECTION_COLORS; i++) L.colors.sec.push(cs.getPropertyValue('--sec' + i).trim());
  };
  // ogni sezione salvata ha un colore (si ripetono dopo 8)
  L.SECTION_COLORS = 8;
  L.sectionColorVar = i => 'var(--sec' + (i % L.SECTION_COLORS + 1) + ')';
  L.sectionColor = i => L.colors.sec[i % L.SECTION_COLORS] || L.colors.accent;
  /** #rrggbb + trasparenza → rgba() */
  L.alpha = (hex, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  // pulsante che ripete l'azione se tenuto premuto
  L.holdRepeat = (el, fn) => {
    let t1 = null, t2 = null;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      fn();
      t1 = setTimeout(() => { t2 = setInterval(fn, 90); }, 400);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, stop));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  };
})(window.Looper);
