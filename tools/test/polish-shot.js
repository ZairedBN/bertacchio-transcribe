// stato per gli screenshot: sezione 1 richiamata e ritoccata (compare "Aggiorna")
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  $('askNo').click();
  document.querySelector('.chip button.name').click();
  $('endUp').dispatchEvent(new PointerEvent('pointerdown', { button: 0 })); $('endUp').dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
  await wait(100);
  $('updSection').scrollIntoView({ block: 'center' });
  const small = [...document.querySelectorAll('#undoReg, #updSection, .chip button')].filter(b => !b.hidden && b.offsetParent)
    .map(b => (b.id || b.className) + ' ' + Math.round(b.getBoundingClientRect().height)).join(', ');
  return 'overflowX ' + (document.documentElement.scrollWidth > innerWidth) + ' · altezze: ' + small;
})();
