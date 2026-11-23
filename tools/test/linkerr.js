// Errori di "Carica link" nella lingua scelta (serve il server Windows acceso).
// Per ogni lingua: link non valido (errore del server) e pagina inesistente (errore di yt-dlp).
(async () => {
  const $ = id => document.getElementById(id), wait = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 30 && !Looper.hasServer; i++) await wait(100);
  if (!Looper.hasServer) return 'server non rilevato: avvia server.ps1';
  const out = [];
  async function tryLink(url) {
    $('linkIn').value = url;
    $('linkBtn').click();
    for (let i = 0; i < 600 && $('linkBtn').disabled; i++) await wait(100);
    return $('linkMsg').textContent;
  }
  for (const lang of ['en', 'fr', 'it']) {
    Looper.setLang(lang);
    out.push(lang + ' link non valido: ' + await tryLink('nonvalido'));
    if (lang !== 'it') out.push(lang + ' pagina inesistente: ' + await tryLink('https://example.com/pagina-che-non-esiste'));
  }
  Looper.setLang('fr'); await tryLink('https://example.com/pagina-che-non-esiste');   // per lo screenshot
  // senza header X-Looper il server rifiuta, con un codice traducibile
  const r = await fetch('/api/ping');
  out.push('senza header: ' + r.status + ' ' + JSON.stringify(await r.json()) + ' (atteso 403, code forbidden)');
  return out.join('\n');
})()
