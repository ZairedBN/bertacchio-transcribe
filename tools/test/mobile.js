(async () => {
  const out = [], log = (k, v) => out.push(k + ': ' + v), $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const overflow = () => document.documentElement.scrollWidth - window.innerWidth;
  log('schermo', innerWidth + 'x' + innerHeight + ', touch ' + matchMedia('(hover: none) and (pointer: coarse)').matches);
  log('scorrimento orizzontale (px in più) a vuoto', overflow());
  const tr = $('transport'), trs = getComputedStyle(tr), rr = tr.getBoundingClientRect();
  log('barra comandi', trs.position + ', in basso: ' + (Math.abs(rr.bottom - innerHeight) < 2) + ', altezza ' + Math.round(rr.height));
  const small = [...document.querySelectorAll('button:not(.small):not([hidden])')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 43).map(b => b.id || b.textContent);
  log('pulsanti sotto 44 px', small.length ? small.join(', ') : 'nessuno');
  log('suggerimenti tastiera nascosti', getComputedStyle(document.querySelector('.kbd-hint')).display === 'none');
  // carica un brano
  const file = bufToWav(makeSong(128, 30));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, b = k => S.grid.offset + k * 60 / S.grid.bpm;
  window.prompt = (m, d) => d;
  Looper.wave.hooks.setRegion(b(8), b(16));
  $('saveSection').click();
  document.querySelector('#trainerBox').open = true;
  await wait(400);
  log('scorrimento orizzontale con brano', overflow());
  const wide = [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).map(el => el.id || el.className || el.tagName).slice(0, 8);
  log('elementi oltre il bordo', wide.length ? wide.join(', ') : 'nessuno');
  // casi limite del rilevamento: silenzio e accordi senza batteria
  const sil = new AudioBuffer({ length: 44100 * 10, sampleRate: 44100, numberOfChannels: 1 });
  log('silenzio', JSON.stringify(await Looper.detectTempo(sil)));
  const n = 44100 * 20, pad = new AudioBuffer({ length: n, sampleRate: 44100, numberOfChannels: 1 }), d = pad.getChannelData(0);
  const ch = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [165, 208, 247]];
  for (let i = 0; i < n; i++) { const t = i / 44100, c = ch[Math.floor(t / 2.5) % 4]; d[i] = 0.1 * (Math.sin(6.283 * c[0] * t) + Math.sin(6.283 * c[1] * t) + Math.sin(6.283 * c[2] * t)); }
  const rp = await Looper.detectTempo(pad);
  log('solo accordi (cambio ogni 2,5 s)', rp ? rp.bpm + ' BPM, confidenza ' + rp.confidence.toFixed(1) : 'null');
  window.scrollTo(0, 0);
  return out.join('\n');
})()
