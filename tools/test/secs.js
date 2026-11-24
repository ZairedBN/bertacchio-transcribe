(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const S = Looper.state, b = k => S.grid.offset + k * 60 / S.grid.bpm;
  let names = ['Intro', 'Assolo di chitarra lungo'];
  Looper.ask = (m, o) => Promise.resolve(names.shift() || o.value);
  Looper.wave.hooks.setRegion(b(0), b(6)); $('saveSection').click();
  Looper.wave.hooks.setRegion(b(40), b(52)); $('saveSection').click();
  Looper.wave.setView(0, S.duration);
  await wait(200);
  const r = [];
  r.push('sezioni ' + S.sections.map(s => s.name).join(', '));
  // clic sulla banda della 3a sezione nella panoramica
  const ov = $('overview').getBoundingClientRect(), sec = S.sections[2];
  const x = ov.left + (sec.start + sec.end) / 2 / S.duration * ov.width, y = ov.bottom - 3;
  const ev = (t, o) => $('overview').dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 9, clientX: x, clientY: y, pointerType: 'mouse', ...o }));
  ev('pointerdown'); ev('pointerup');
  await wait(100);
  r.push('dopo clic banda: regione ' + S.region.start.toFixed(2) + '-' + S.region.end.toFixed(2) + ' attesa ' + sec.start.toFixed(2) + '-' + sec.end.toFixed(2));
  r.push('chip attive ' + document.querySelectorAll('.chip.on').length);
  // clic in alto sulla panoramica = solo spostamento
  const y2 = ov.top + 4, before = S.region.start;
  $('overview').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 10, clientX: ov.left + 10, clientY: y2 }));
  $('overview').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 10, clientX: ov.left + 10, clientY: y2 }));
  r.push('clic in alto: regione invariata ' + (S.region.start === before) + ', tempo ' + $('audio').currentTime.toFixed(2));
  // cursori: spento e testo
  $('eqLow').value = -30; $('eqLow').dispatchEvent(new Event('input'));
  r.push('bassi: ' + $('eqLowVal').textContent + ' off=' + $('eqLow').closest('.fader').classList.contains('off'));
  $('iso').value = 'novocal'; $('iso').dispatchEvent(new Event('change'));
  r.push('aiuto: ' + $('isoHelp').textContent);
  window.scrollTo(0, 0);
  return r.join('\n');
})()
