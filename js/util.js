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

  // errori del server: il codice si traduce qui, nella lingua scelta (il server scrive solo in italiano)
  const SERVER_ERRORS = {
    'forbidden': 'Richiesta non consentita',
    'no-ytdlp': 'Manca bin\\yt-dlp.exe. Scaricalo da https://github.com/yt-dlp/yt-dlp/releases/latest e mettilo nella cartella bin.',
    'bad-link': 'Link non valido: deve iniziare con http:// o https://',
    'too-big': 'File troppo grande',
    'empty': 'File vuoto',
    'bad-name': 'Nome file non valido',
    'not-found': 'Non trovato',
    'method': 'Richiesta non valida',
  };
  // casi frequenti di yt-dlp (messaggi in inglese) → frase chiara
  const YTDLP_HINTS = [
    [/unsupported url/i, 'Questo sito non è supportato.'],
    [/private video|video unavailable|not available in your country|has been removed|does not exist/i, 'Video non disponibile, privato o bloccato nel tuo paese.'],
    [/sign in|confirm your age|not a bot|members-only|login/i, 'Il video richiede l\'accesso (limite di età o verifica "non sono un robot").'],
    [/http error 403|requested format is not available|unable to extract|nsig/i, 'Forse yt-dlp è da aggiornare: scarica l\'ultima versione e mettila in bin\\yt-dlp.exe.'],
    [/http error 404|unable to download webpage/i, 'Pagina non trovata: controlla il link.'],
    [/timed out|getaddrinfo|network is unreachable|connection/i, 'Problema di connessione: controlla internet e riprova.'],
  ];
  function serverError(j, status) {
    const detail = j.detail ? String(j.detail).replace(/\s*\(caused by [\s\S]*\)\s*$/i, '') : '';
    if (j.code === 'download') {
      const hint = YTDLP_HINTS.find(([re]) => re.test(detail));
      return (L.t('Download non riuscito.') + ' ' + (hint ? L.t(hint[1]) + ' (' + detail + ')' : detail)).trim();
    }
    if (j.code === 'internal') return L.t('Errore del server: {d}', { d: detail });
    if (SERVER_ERRORS[j.code]) return L.t(SERVER_ERRORS[j.code]);
    return j.error || L.t('Errore {n}', { n: status });   // server vecchio, senza codice
  }

  L.api = async (path, opts = {}) => {
    const r = await fetch(path, { ...opts, headers: { 'X-Looper': '1', ...(opts.headers || {}) } });
    let j;
    try { j = await r.json(); } catch { throw new Error(L.t('Risposta non valida dal server (errore {n})', { n: r.status })); }
    if (!r.ok || j.error) throw new Error(serverError(j, r.status));
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

  // finestra dentro la pagina al posto di prompt()/confirm(), più comoda sul telefono.
  // L.ask(testo, {value, ok, danger}) → con `value` chiede un testo (null se annullata),
  // senza `value` chiede una conferma (true / null)
  let askDone = null;
  L.ask = (text, opts = {}) => {
    const d = L.$('askDlg'), inp = L.$('askIn'), ok = L.$('askOk');
    const withInput = opts.value !== undefined;
    if (!d || !d.showModal) {     // browser senza <dialog>
      return Promise.resolve(withInput ? prompt(text, opts.value) : (confirm(text) || null));
    }
    if (askDone) askDone(null);
    L.$('askText').textContent = text;
    inp.hidden = !withInput;
    inp.value = withInput ? opts.value : '';
    ok.textContent = opts.ok || 'OK';
    ok.classList.toggle('danger', !!opts.danger);
    L.$('askNo').textContent = L.t ? L.t('Annulla') : 'Annulla';
    if (!d.open) d.showModal();
    if (withInput) { inp.focus(); inp.select(); } else ok.focus();
    return new Promise(res => { askDone = v => { askDone = null; res(v); }; });
  };
  document.addEventListener('DOMContentLoaded', () => {
    const d = L.$('askDlg');
    if (!d) return;
    L.$('askForm').addEventListener('submit', e => {
      e.preventDefault();
      const v = L.$('askIn').hidden ? true : L.$('askIn').value;
      if (askDone) askDone(v);
      d.close();
    });
    L.$('askNo').addEventListener('click', () => d.close());
    d.addEventListener('close', () => { if (askDone) askDone(null); });
    d.addEventListener('click', e => { if (e.target === d) d.close(); });   // clic fuori dalla finestra
  });

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
