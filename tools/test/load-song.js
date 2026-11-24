(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const file = bufToWav(makeSong(128, 30));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  await wait(500);
  // un passaggio e una sezione, per vedere la griglia e i chip
  const S = Looper.state, b = k => S.grid.offset + k * 60 / S.grid.bpm;
  Looper.ask = (m, o) => Promise.resolve(o && o.value !== undefined ? o.value : true);
  Looper.wave.hooks.setRegion(b(8), b(16));
  $('saveSection').click();
  return 'caricato, BPM ' + $('bpm').value + ', sw ' + !!navigator.serviceWorker.controller;
})()
