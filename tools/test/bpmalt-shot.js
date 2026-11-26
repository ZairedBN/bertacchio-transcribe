// per lo screenshot: un brano nuovo a 160 con l'avviso visibile; controlla la larghezza della pagina
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const f = bufToWav(makeSong(160, 20)), file = new File([f], 'foto' + innerWidth + '.wav', { type: 'audio/wav' });
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  await wait(300);
  for (let i = 0; i < 150 && (!Looper.state.grid || $('bpmNote').textContent.includes('…')); i++) await wait(100);
  await wait(300);
  $('tempoRow').scrollIntoView({ block: 'center' });
  const r = $('bpmAlt').getBoundingClientRect();
  return innerWidth + ' px: BPM ' + $('bpm').value + ', avviso ' + ($('bpmAlt').hidden ? 'nascosto' : '"' + $('bpmAlt').textContent + '" ' + Math.round(r.width) + '×' + Math.round(r.height)) +
    ', scorrimento orizzontale ' + (document.documentElement.scrollWidth > innerWidth ? 'SÌ' : 'no');
})()
