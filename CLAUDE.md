# CLAUDE.md — Bertacchio Transcribe

Web app per musicisti: si carica un brano, si sceglie un passaggio, lo si mette in loop e lo si rallenta per studiarlo e trascriverlo.
- **Online**: https://zairedbn.github.io/bertacchio-transcribe/ (GitHub Pages dal ramo `main`, repo `ZairedBN/bertacchio-transcribe`).
- **Windows**: zip facoltativo con `avvia-looper.bat` + `server.ps1` + `bin/yt-dlp.exe`, solo per caricare brani da link.
- Cose aperte e idee future: **`DEV_NOTES.md`**. Va tenuto aggiornato a ogni lavoro.

## L'utente
- Musicista, non programmatore. Scrive in italiano: **rispondere in italiano semplice**, spiegare cosa cambia per chi usa l'app, non il codice.
- Prova le modifiche ricaricando la pagina e dà riscontri a orecchio e a occhio.
- **Semplicità prima di tutto**: le nuove funzioni non devono complicare il primo utilizzo né l'installazione. Le cose avanzate vanno in pannelli chiusi o menu.
- **Non implementare senza richiesta** la funzione "progressi / esporta-importa progetto" (vedi `DEV_NOTES.md` 4.1): è rimandata.

## Struttura
```
index.html            tutta l'interfaccia: markup + CSS (token colore in :root, tema chiaro/scuro)
js/util.js            namespace window.Looper (L), store (localStorage), api server, colori, utilità
js/storage.js         L.db: brani recenti in IndexedDB (fino a 40, audio compreso)
js/i18n.js            lingue IT/EN/ES/DE/FR: L.t(), traduzione automatica dei testi statici, menu lingua
js/bpm.js             rilevamento BPM/beat 1/"steady" in un Worker; L.tap, L.nearestBeat, L.stepBeat
js/audio-fx.js        L.fx: catena Web Audio (Ascolta → isolatore 3 bande → pitch shift → dissolvenza → volume → limitatore), click del conteggio
js/waveform.js        L.state (S) + L.wave: forma d'onda, panoramica, griglia, sezioni, mouse/touch/pizzico
js/trainer.js         L.trainer: allenatore di velocità
js/app.js             L.app: caricamento, passaggio A–B, tempo/griglia, sezioni, riproduzione/conteggio, tastiera, avvio
js/tips.js            suggerimenti al passaggio del mouse / pressione lunga (tabella TIPS per id)
sw.js                 service worker (offline, prima la rete); manifest.webmanifest; icons/
server.ps1            server locale Windows (porta 8765): /api/ping, load, recent, touch, upload, remove, open-cache, /media/
avvia-looper.bat      avvio del server su Windows
LEGGIMI.txt / README.txt   istruzioni per gli utenti (IT / EN)
bin/ cache/ dist/     yt-dlp, brani scaricati, zip: NON sono nel repository (.gitignore)
```
Ordine degli script (conta): `util → storage → i18n → bpm → audio-fx → waveform → trainer → app → tips`.

## Convenzioni
- **JavaScript vanilla**, script classici (niente moduli, niente build, niente dipendenze esterne). Ogni file è `(L => { 'use strict'; … })(window.Looper);` ed espone un oggetto su `L`.
- Commenti e nomi delle funzioni in italiano, come il resto del codice.
- Impostazioni piccole: `L.store.get/set` (chiavi con prefisso `looper:`). Dati per brano: `sections:<key>`, `tempo:<key>` (`{bpm, offset, beatsPerBar, detected, steady, show}`). La chiave del brano è `local:<nome>:<dimensione>` oppure la chiave del server.
- **Testi visibili sempre tradotti**:
  - nel JS si usa `L.t('Testo italiano {x}', { x })`: il testo italiano è la chiave;
  - poi si aggiunge la riga `[it, en, es, de, fr]` in `ROWS` dentro `js/i18n.js`;
  - i testi statici in `index.html` (nodi di testo, `title`, `placeholder`, `aria-label`) si traducono da soli se il testo italiano esatto è in `ROWS`;
  - i blocchi con `<kbd>` usano `data-i18n-html` + `HTML` in `i18n.js`;
  - i testi generati dal codice vanno ridisegnati in `refreshTexts()` (`js/app.js`) al cambio lingua.
- **Colori**: solo tramite token CSS in `:root`, ridefiniti per il tema scuro. Le canvas leggono i colori con `L.readColors()`. Le sezioni usano `--sec1…--sec8`.
- **Disposizione**:
  - ≥1200 px: tre colonne (mixer | onda | velocità/allenatore);
  - 701–1199 px: onda sopra, mixer e velocità affiancati;
  - ≤700 px: una colonna, con la barra comandi fissa in basso su due righe.
  - Sul telefono ogni elemento toccabile deve essere alto **≥44 px** e la pagina non deve mai scorrere in orizzontale.
- **Tastiera**: nuove scorciatoie in `js/app.js` (keydown). Vanno aggiornati insieme la finestra "Tasti" (`index.html`, `#keysDlg`), `js/tips.js`, `LEGGIMI.txt`, `README.txt` e le traduzioni.
- **Service worker**: a ogni rilascio aumentare `VERSION` in `sw.js`; ogni nuovo file JS va aggiunto a `SHELL`.
- Percorsi sempre relativi (il sito vive in `/bertacchio-transcribe/`). Solo le chiamate al server locale usano `/api/…` e `/media/…`.

## Verifica (prima di dire "fatto")
- Server di sviluppo: `powershell -ExecutionPolicy Bypass -File server.ps1`, poi http://localhost:8765. Senza server si perde solo "Carica link".
- Su questa macchina **non c'è Python** e **non c'è `gh`**. Si usano Bash/PowerShell ed Edge headless.
- **Test nel browser vero: `tools/test/`** (istruzioni in `tools/test/README.md`).
  - `powershell -ExecutionPolicy Bypass -File tools\test\run.ps1` lancia tutte le suite. Con `-Suite keys,mobile` se ne scelgono alcune, con `-Url <indirizzo online>` si prova il sito pubblicato.
  - Il server locale deve essere acceso: dopo un riavvio del PC non lo è. Avviarlo in background con `server.ps1`.
  - Per una funzione nuova si aggiunge un file `.js` che restituisce righe "valore (atteso …)" e una `suite-<nome>.json`.
  - Gli screenshot vanno in `tools/test/out/` (non versionata) e si guardano con Read.
  - Lingua del browser: `Page.enable` + `Page.addScriptToEvaluateOnNewDocument` che ridefinisce `navigator.languages`.
- **Brano di prova sintetico**: si genera in pagina un `AudioBuffer` (cassa, rullante, hi-hat, accordo) a BPM noti, si converte in WAV e lo si passa a `#file` con `DataTransfer`.
- Cosa controllare di solito:
  - nessun errore JS;
  - selezione e aggancio ai beat; conteggio; allenatore; tap; zoom e pizzico; sezioni;
  - telefono: nessuno scorrimento orizzontale, pulsanti ≥44 px;
  - offline dopo il primo caricamento;
  - nessun testo italiano rimasto nelle altre lingue.
- **Audio**: si verifica con `OfflineAudioContext` tramite `L.fx._test` (`buildGraph`, `buildIso`, `connectIso`, `bandGains`). Si misurano i livelli con seni e rumore. Quello che non si può sentire va detto all'utente come "da provare a orecchio".

## Git e pubblicazione
- Si lavora su **`main`**. Commit in italiano, uno per ogni modifica completata e verificata.
- **Push = pubblicazione**: `git push origin main` aggiorna il sito in 1–2 minuti. Va fatto quando l'utente lo chiede o conferma. L'autenticazione passa da Git Credential Manager.
- Dopo il push conviene controllare il sito pubblicato: `curl` sull'indirizzo, poi una prova con Edge headless sull'URL online.
- **Zip Windows** (`dist/Bertacchio-Transcribe-Windows.zip`): cartella "Bertacchio Transcribe" con `index.html`, `manifest.webmanifest`, `sw.js`, `server.ps1`, `avvia-looper.bat`, `LEGGIMI.txt`, `README.txt`, `js/`, `icons/`, `bin/yt-dlp.exe`. Senza `DEV_NOTES.md` e `CLAUDE.md`. Va rifatto quando cambiano i file dell'app e va provato estraendolo e avviando `server.ps1` su un'altra porta.
- Non mettere mai nel repository `cache/` (brani dell'utente), `bin/` o `dist/`.
