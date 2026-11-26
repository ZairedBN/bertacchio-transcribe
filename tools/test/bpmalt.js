// avviso "Forse è …?" accanto al BPM: compare, si traduce, un tocco applica il valore, sparisce con ÷2/×2/Tap/a mano
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const S = Looper.state, out = [];
  const load = async (bpm, name) => {
    const f = bufToWav(makeSong(bpm, 30)), file = new File([f], name, { type: 'audio/wav' });
    const dt = new DataTransfer(); dt.items.add(file);
    $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
    await wait(300);
    for (let i = 0; i < 150 && (!S.grid || $('bpmNote').textContent.includes('…')); i++) await wait(100);
    await wait(200);
  };
  const alt = () => $('bpmAlt').hidden ? 'nascosto' : '"' + $('bpmAlt').textContent + '"';
  const key = () => Object.keys(localStorage).find(k => k.startsWith('looper:tempo:') && k.includes(document.getElementById('filename').textContent));

  // brano di prova a 160: il rilevamento sceglie 160 o 80 e propone l'altro
  await load(160, 'veloce160.wav');
  const b0 = +$('bpm').value, a0 = Math.round(b0 === 160 ? 80 : 160);
  out.push('160: BPM ' + b0 + ', avviso ' + alt() + ' (atteso 160 o 80, con l’altro nell’avviso)');
  const rect = $('bpmAlt').getBoundingClientRect();
  out.push('larghezza riga tempo ok: ' + ($('tempoRow').scrollWidth <= $('tempoRow').clientWidth + 1) + ', avviso ' + Math.round(rect.width) + '×' + Math.round(rect.height));
  out.push('salvato: ' + JSON.stringify(JSON.parse(localStorage.getItem(key()) || 'null')?.alt) + ' (atteso ' + a0 + ')');
  for (const lang of ['en', 'es', 'de', 'fr']) { Looper.setLang(lang); out.push(lang + ': ' + alt()); }
  Looper.setLang('it');
  $('bpmAlt').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
  await wait(600);
  const tip = document.querySelector('.tip');
  out.push('suggerimento: "' + (tip && tip.textContent) + '"');
  $('bpmAlt').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }));
  $('bpmAlt').click();
  out.push('dopo il tocco: BPM ' + $('bpm').value + ', avviso ' + alt() + ', salvato ' + JSON.parse(localStorage.getItem(key())).alt + ' (atteso ' + a0 + ', nascosto, null)');

  // brano a 120 (proposta 60): ÷2 fa sparire l'avviso
  await load(120, 'medio120.wav');
  out.push('120: BPM ' + $('bpm').value + ', avviso ' + alt());
  $('bpmHalf').click();
  out.push('dopo ÷2: BPM ' + $('bpm').value + ', avviso ' + alt() + ' (atteso nascosto)');

  // di nuovo il brano a 160: resta il valore scelto con l’avviso, senza avviso
  await load(160, 'veloce160.wav');
  out.push('riaperto 160: BPM ' + $('bpm').value + ', avviso ' + alt() + ' (atteso ' + a0 + ', nascosto)');

  // brano a 90: nessun dubbio, nessun avviso
  await load(90, 'lento90.wav');
  out.push('90: BPM ' + $('bpm').value + ', avviso ' + alt() + ' (atteso 90, nascosto)');
  return out.join('\n');
})()
