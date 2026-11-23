(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const file = bufToWav(makeSong(120, 30, 0.5));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, H = Looper.wave.hooks, r = [];
  window.prompt = (m, d) => d;
  H.setRegion(4.5, 8.5); $('saveSection').click();
  H.setRegion(12.5, 16.5); $('saveSection').click();
  H.clearRegion(); await wait(100);
  r.push('loop senza sezione: ' + getComputedStyle($('loopBox')).borderColor);
  const cv = $('wave'), rc = cv.getBoundingClientRect();
  const fire = (t, x, y, type, id) => cv.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: id, clientX: x, clientY: y, pointerType: type, button: 0 }));
  const xOf = t => rc.left + t / S.duration * rc.width;
  // clic sinistro del mouse sul marcatore della sezione 2
  fire('pointerdown', xOf(14), rc.bottom - 6, 'mouse', 1); fire('pointerup', xOf(14), rc.bottom - 6, 'mouse', 1);
  await wait(100);
  r.push('clic marcatore 2: regione ' + S.region.start + '-' + S.region.end + ' | loop ' + getComputedStyle($('loopBox')).backgroundColor);
  // tocco singolo sul marcatore della sezione 1 (un po' sopra la striscia)
  fire('pointerdown', xOf(6), rc.bottom - 26, 'touch', 2); fire('pointerup', xOf(6), rc.bottom - 26, 'touch', 2);
  await wait(100);
  r.push('tocco marcatore 1: regione ' + S.region.start + '-' + S.region.end + ' | loop ' + getComputedStyle($('loopBox')).backgroundColor);
  // clic in mezzo all'onda: solo spostamento
  fire('pointerdown', xOf(20), rc.top + rc.height / 2, 'mouse', 3); fire('pointerup', xOf(20), rc.top + rc.height / 2, 'mouse', 3);
  r.push('clic in mezzo: regione invariata ' + (S.region.start === 4.5) + ' t=' + $('audio').currentTime.toFixed(2));
  // trascinando dal marcatore si seleziona
  fire('pointerdown', xOf(13), rc.bottom - 6, 'mouse', 4);
  fire('pointermove', xOf(18), rc.bottom - 6, 'mouse', 4); fire('pointerup', xOf(18), rc.bottom - 6, 'mouse', 4);
  r.push('trascina dal marcatore: regione ' + S.region.start.toFixed(2) + '-' + S.region.end.toFixed(2) + ' | loop sezione ' + $('loopBox').classList.contains('sec'));
  H.setRegion(12.5, 16.5); await wait(100);
  window.scrollTo(0, 0);
  return r.join('\n');
})()
