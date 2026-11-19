# Da fare — Looper v2 (branch `feature/v2`)

Problemi emersi dopo la v2 (19/11/2026), da sistemare durante la prova insieme alle correzioni dell'utente.

## Bug piccoli
- [ ] **L'allenatore resta attivo quando si cambia brano**: dovrebbe fermarsi da solo al caricamento di un nuovo brano (`js/app.js` → `loadSong`, `js/trainer.js`).
- [ ] **Frecce ↑/↓ "rubate"** per i pedali (play/pausa e ricomincia): impediscono di scorrere la pagina. Valutare di usare solo PagSu/PagGiù (`js/app.js`, gestione tastiera).

## Limiti da migliorare o da verificare con brani veri
- [ ] **BPM al doppio o alla metà** sui tempi veloci (sintetici: 160 → 80, 174 → 87); "Giant Steps" (~286) → 72, segnato "da verificare". La griglia presuppone un tempo costante.
- [ ] **Beat 1** riconosciuto dalla cassa: verificato solo su brani sintetici.
- [ ] **Memoria su telefoni economici**: il brano viene decodificato tutto (~100 MB per 5 min) più le copie per l'analisi del tempo.
- [ ] **Spazio dei Recenti**: fino a 40 brani interi nel browser; su Windows i brani scaricati restano anche in `cache/` (doppio spazio).
- [ ] **Precisione del conteggio**: usa timer normali, la ripartenza può tardare di qualche decina di ms. Da sentire con le orecchie.

## Non ancora provato
- [ ] Caricamento da link nella pagina v2, dall'inizio alla fine.
- [ ] "Apri cartella", pedali Bluetooth, scorrimento automatico vicino al bordo, qualità del suono, pizzico con dita vere.
- [ ] Android reale e Safari su Mac (dopo la pubblicazione su GitHub Pages).
- [ ] `LEGGIMI.txt` nello zip v2 contiene ancora "[link in arrivo]": non distribuire `dist/Looper-MP3-v2.zip` prima della pubblicazione online.

## Rimandato dall'utente (solo promemoria)
- [ ] "Progressi della trascrizione" / Esporta-Importa progetto con la casella "includi l'audio" (attiva di default). Da definire con l'utente.
