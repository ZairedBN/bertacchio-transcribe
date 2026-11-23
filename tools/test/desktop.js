(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  const file = bufToWav(makeSong(128, 30));
  const dt = new DataTransfer(); dt.items.add(file);
  $('file').files = dt.files; $('file').dispatchEvent(new Event('change'));
  for (let i = 0; i < 100 && !Looper.state.grid; i++) await wait(100);
  const S = Looper.state, b = k => S.grid.offset + k * 60 / S.grid.bpm;
  window.prompt = (m, d) => d;
  Looper.wave.hooks.setRegion(b(8), b(16)); $('saveSection').click();
  Looper.wave.hooks.setRegion(b(24), b(32)); $('saveSection').click();
  Looper.wave.setView(b(4), b(36) - b(4));
  Looper.wave.hooks.seek(b(26));
  $('pauseMode').value = 'bar1'; $('pauseMode').dispatchEvent(new Event('change'));
  const sil = await Looper.detectTempo(new AudioBuffer({ length: 441000, sampleRate: 44100, numberOfChannels: 1 }));
  await wait(400);
  window.scrollTo(0, 0);
  return 'ok, silenzio → ' + JSON.stringify(sil);
})()
