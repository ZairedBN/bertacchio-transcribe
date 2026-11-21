# Pubblicare Bertacchio Transcribe su GitHub Pages

Chi apre il sito non deve registrarsi né installare nulla: basta il link o il QR code.
L'account GitHub serve solo a te, per pubblicare.

## Una volta sola
1. Crea un account gratuito su https://github.com.
2. Crea un repository **pubblico**: pulsante "New", nome per esempio `bertacchio-transcribe`, senza README.
   GitHub Pages gratis funziona solo con i repository pubblici, quindi il codice sarà visibile a tutti.
   I brani in `cache/`, i programmi in `bin/` e gli zip in `dist/` restano fuori (sono in `.gitignore`).
3. Chiedi a Claude di fare il "push", cioè di caricare il codice su GitHub: ti chiederà di accedere con
   `gh auth login`, oppure ti preparerà i comandi.
4. Su GitHub apri il repository → **Settings → Pages**:
   - Source: "Deploy from a branch"
   - Branch: `main`, cartella `/ (root)` → Save
5. Dopo un paio di minuti il sito è online all'indirizzo
   `https://<tuo-nome-utente>.github.io/bertacchio-transcribe/`

## Link e QR code
- Il link è quello del punto 5: va messo al posto di "[link in arrivo]" in `LEGGIMI.txt` e `README.txt`.
- QR code: apri il sito con Chrome sul computer → menu ⋮ → "Trasmetti, salva e condividi" →
  "Crea codice QR" (oppure usa un qualsiasi generatore di QR code online).

## Aggiornamenti
Ogni volta che il ramo `main` cambia su GitHub, il sito si aggiorna da solo in un paio di minuti.
Chi l'ha installato come app riceve la versione nuova alla successiva apertura con internet
(per questo in `sw.js` va aumentato `VERSION` a ogni pubblicazione).

## Versione Windows con i link (facoltativa)
"Carica link" (YouTube, SoundCloud…) funziona solo con lo zip per Windows (`avvia-looper.bat` + `bin/yt-dlp.exe`),
perché GitHub Pages non può eseguire programmi. Lo zip si può allegare a una "Release" del repository.
