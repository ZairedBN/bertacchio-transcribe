// nota lunga accanto all'avviso: deve leggersi tutta (niente "…"), senza scorrimento orizzontale
(async () => {
  const $ = id => document.getElementById(id);
  Looper.state.grid || (await new Promise(r => setTimeout(r, 500)));
  const n = $('bpmNote');
  n.textContent = Looper.t('tempo non regolare: griglia nascosta (attivala da Griglia ▾)');
  $('tempoRow').scrollIntoView({ block: 'center' });
  const cut = n.scrollWidth > n.clientWidth + 1;
  return innerWidth + ' px: nota tagliata ' + cut + ' (atteso false) · righe ' + Math.round(n.getBoundingClientRect().height / 16) +
    ' · scorrimento orizzontale ' + (document.documentElement.scrollWidth > innerWidth);
})()
