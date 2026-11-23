# Test nel browser (Edge headless via DevTools Protocol)

Niente Node, niente Python: solo PowerShell + Microsoft Edge.

```
powershell -ExecutionPolicy Bypass -File server.ps1                       # in un'altra finestra (porta 8765)
powershell -ExecutionPolicy Bypass -File tools\test\run.ps1               # tutte le suite
powershell -ExecutionPolicy Bypass -File tools\test\run.ps1 -Suite keys,mobile
powershell -ExecutionPolicy Bypass -File tools\test\run.ps1 -Url https://zairedbn.github.io/bertacchio-transcribe/
```

- `cdp.ps1`: apre Edge headless con `--remote-debugging-port` ed esegue in sequenza i passi di un file `suite-*.json`:
  - `{"eval": "file.js"}`: esegue il file nella pagina, con await sulla Promise, e stampa il valore restituito;
  - `{"method": "...", "params": {...}}`: comando DevTools, ad esempio `Emulation.setDeviceMetricsOverride`, `Emulation.setTouchEmulationEnabled`, `Emulation.setEmulatedMedia`, `Network.emulateNetworkConditions`, `Page.addScriptToEvaluateOnNewDocument` (questo richiede prima `Page.enable`);
  - `{"sleep": ms}`, `{"screenshot": "nome.png", "full": true}` → `out/`.
- `synth.js` definisce `makeSong(bpm, secondi, primoBeat)`, che crea un brano sintetico con BPM noti, e `bufToWav(buffer)`. Il brano si carica con `DataTransfer` su `#file` (vedi `desktop.js` / `keys.js`).
- I test stampano righe del tipo `valore (atteso …)`: vanno lette, non c'è un "pass/fail" automatico.
- Il profilo di Edge ha la lingua del sistema (italiano): i test che leggono testi si aspettano l'italiano. Per un'altra lingua: `suite-autolang.json`.

| Suite | Cosa controlla |
|---|---|
| functional | rilevamento BPM, aggancio, conteggio, allenatore, tap, zoom, pizzico, prestazioni, errori JS |
| offline | recenti dopo il ricaricamento, service worker, apertura offline |
| mobile | 390 px touch: niente scorrimento orizzontale, pulsanti ≥44 px, barra in basso |
| keys | tasti rapidi, suggerimento sul pulsante Tap, finestra Tasti |
| markers | clic/tocco sui marcatori delle sezioni, colore del Loop |
| countin | conteggio a brano fermo con Spazio/Ricomincia, pulsanti « » A del telefono |
| countsync | precisione del conteggio: registra l'uscita audio e misura lo scarto del beat 1 dopo i click (velocità diverse, passaggio da 0:00, pagina sotto sforzo) |
| startpos | Play parte dal punto cliccato (dentro/fuori dal passaggio, con conteggio) |
| sections | schede e bande delle sezioni, screenshot chiaro/scuro/telefono |
| mixer | catena audio con OfflineAudioContext (`L.fx._test`): risposta piatta, bande spente, niente saturazione, Ascolta, assenza di scatti |
| i18n | nessun testo italiano in EN/ES/DE/FR (in ES/FR "del" e "il" sono falsi positivi), larghezza a 390 px |
| autolang | lingua scelta dal browser (navigator.languages = fr) |
