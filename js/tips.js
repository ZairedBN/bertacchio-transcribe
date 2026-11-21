/* Looper — suggerimenti al passaggio del mouse: a cosa serve un comando e con quale tasto */
(L => {
  'use strict';
  const { $ } = L;

  // id → [spiegazione, tasti]
  const TIPS = {
    recentBtn: ['Riapri al volo i brani già usati'],
    linkBtn: ['Scarica e apri il brano dal link incollato', ['Invio']],
    keysBtn: ['Elenco di tutti i tasti rapidi', ['?']],
    vol: ['Volume generale. Doppio clic: 100%'],
    eqLow: ['Bassi (sotto 250 Hz): basso e cassa. Giù del tutto = spenti. Doppio clic: zero'],
    eqMid: ['Medi (250–3000 Hz): voce, chitarre, piano. Giù del tutto = spenti. Doppio clic: zero'],
    eqHigh: ['Alti (sopra 3000 Hz): piatti, brillantezza. Giù del tutto = spenti. Doppio clic: zero'],
    iso: ['Cosa ascoltare del brano: voce ridotta, solo centro, solo lati, solo bassi…'],
    zoomOut: ['Riduci lo zoom', ['Ctrl + rotella']],
    zoomIn: ['Ingrandisci la forma d\'onda', ['Ctrl + rotella']],
    zoomSel: ['Ingrandisci il passaggio selezionato', ['Z']],
    zoomAll: ['Mostra tutto il brano', ['Z']],
    bpm: ['BPM del brano: puoi scriverli a mano'],
    tapBtn: ['Batti a tempo con la musica (almeno 4 volte) per registrare i BPM', ['T']],
    gridBtn: ['Griglia dei beat: mostra/nascondi, aggancio, ÷2 ×2, beat 1', ['G mostra/nasconde']],
    bpmHalf: ['Dimezza i BPM (griglia al doppio del tempo giusto)'],
    bpmX2: ['Raddoppia i BPM (griglia alla metà del tempo giusto)'],
    beatOne: ['La battuta inizia dove si trova ora la testina'],
    play: ['Play / pausa', ['P', 'Invio', '↓']],
    restartBtn: ['Ricomincia dall\'inizio del passaggio (o del brano)', ['Spazio', '↑']],
    stop: ['Stop: ferma e torna all\'inizio del passaggio'],
    prevBtn: ['Indietro: battuta precedente (con la griglia) oppure inizio di passaggio/sezione', ['←']],
    nextBtn: ['Avanti: battuta successiva (con la griglia) oppure fine di passaggio/sezione', ['→']],
    tapMini: ['Batti a tempo (almeno 4 volte) per registrare i BPM', ['T']],
    aMini: ['Inizio del passaggio dove si trova la testina', ['A']],
    bMini: ['Fine del passaggio dove si trova la testina', ['B']],
    loopBox: ['Ripeti il passaggio selezionato', ['L']],
    spDown: ['Più lento (5%)', ['−']],
    spUp: ['Più veloce (5%)', ['+']],
    speedMini: ['Velocità attuale', ['0 = 100%']],
    startDown: ['Sposta l\'inizio indietro di un beat'],
    startUp: ['Sposta l\'inizio avanti di un beat'],
    endDown: ['Sposta la fine indietro di un beat'],
    endUp: ['Sposta la fine avanti di un beat'],
    setA: ['Inizio del passaggio dove si trova la testina', ['A']],
    setB: ['Fine del passaggio dove si trova la testina', ['B']],
    clearReg: ['Cancella la selezione', ['Canc']],
    pauseMode: ['Cosa fare prima di ogni ripetizione: niente, una pausa o il conteggio a tempo'],
    saveSection: ['Salva il passaggio come sezione (Intro, Assolo…)', ['S']],
    chips: ['Clic per richiamare una sezione, doppio clic per rinominarla', ['1 – 9']],
    overviewWrap: ['Tutto il brano: clic per spostarti, trascina il riquadro per scorrere. Le bande colorate sono le sezioni', ['← →', 'Home', 'Fine']],
    speed: ['Velocità di riproduzione', ['+', '−', '0']],
    pitch: ['Rallentando il brano non diventa più grave'],
    trStartBtn: ['Avvia l\'allenamento: la velocità sale da sola a ogni ripetizione'],
  };

  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);

  for (const id in TIPS) {
    const el = $(id);
    if (!el) continue;
    el.dataset.tip = id;
    el.removeAttribute('title');
  }

  let timer = null, current = null;
  function show(el) {
    const [text, keys] = TIPS[el.dataset.tip];
    tip.textContent = text;
    if (keys) {
      const k = document.createElement('span');
      k.className = 'tip-keys';
      k.append('Tasto: ');
      keys.forEach((name, i) => {
        if (i) k.append(' · ');
        const kb = document.createElement('kbd');
        kb.textContent = name;
        k.append(kb);
      });
      tip.append(k);
    }
    const r = el.getBoundingClientRect();
    tip.style.left = '0px'; tip.style.top = '0px';
    tip.classList.add('show');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
    if (y + th > innerHeight - 8) y = r.top - th - 8;
    x = Math.max(8, Math.min(innerWidth - tw - 8, x));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hide() {
    clearTimeout(timer); timer = null; current = null;
    tip.classList.remove('show');
  }

  // telefono: pressione lunga su un pulsante = spiegazione (e il pulsante non scatta)
  let press = null, swallowClick = false;
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    swallowClick = false;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) return;
    const x = e.clientX, y = e.clientY;
    press = { el, x, y, timer: setTimeout(() => {
      swallowClick = true;
      show(el);
      if (navigator.vibrate) navigator.vibrate(15);
      timer = setTimeout(hide, 2500);
    }, 550) };
  }, true);
  const endPress = () => { if (press) { clearTimeout(press.timer); press = null; } };
  document.addEventListener('pointermove', e => {
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) endPress();
  }, true);
  document.addEventListener('pointerup', endPress, true);
  document.addEventListener('pointercancel', endPress, true);
  document.addEventListener('click', e => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault(); e.stopPropagation();
  }, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('[data-tip]')) e.preventDefault(); });

  document.addEventListener('pointerover', e => {
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (el === current) return;
    hide();
    if (!el) return;
    current = el;
    timer = setTimeout(() => show(el), 450);
  });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', hide, true);
  window.addEventListener('scroll', hide, true);
})(window.Looper);
