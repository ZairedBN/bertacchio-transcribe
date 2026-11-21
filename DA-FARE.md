# Da fare — Looper v2 (branch `feature/v2`)

Problemi emersi dopo la v2 (19/11/2026), da sistemare durante la prova insieme alle correzioni dell'utente.

## Fatto nella v2.1 (21/11/2026)
- [x] Tap: il pulsante non si sposta più (larghezza fissa, nota dopo il pulsante, conta "1/4 … 4/4").
- [x] Interfaccia riorganizzata: testata compatta, mixer con cursori verticali e allenatore in una colonna a destra su PC, menu "Griglia ▾", tema rosso.
- [x] Griglia nascosta di default se il brano non è a tempo fisso (misura `steady` in `js/bpm.js`, soglia 0.6 in `js/app.js`). Brani reali: jazz 0.32–0.36 → nascosta; rap/pop 0.74–1.00 → visibile. La scelta viene salvata per brano.
- [x] L'allenatore si ferma quando si carica un nuovo brano.

## Fatto il 21/11/2026 (pomeriggio)
- [x] Logo: colibrì stilizzato.
- [x] Sezioni: schede colorate (numero, inizio–fine, velocità) e bande colorate su forma d'onda e panoramica (clic = richiama).
- [x] Mixer:
  - limitatore e compensazione automatica, così il suono non gracchia più;
  - Bassi/Medi/Alti diventano un isolatore a 3 bande (250 Hz / 3 kHz, cursore da "spento" a +12 dB);
  - "Ascolta" con le nuove modalità (solo centro, solo lati, voce ridotta migliorata), cambio senza scatti e avviso per i brani mono.
- [ ] Da sentire a orecchio su brani veri: il mixer nuovo (soprattutto voce ridotta / solo lati).

## Bug piccoli
- [ ] **Frecce ↑/↓ "rubate"** per i pedali (play/pausa e ricomincia): restano così per compatibilità con i pedali Bluetooth. ←/→ ora saltano per battute o tra sezioni.

## Limiti da migliorare o da verificare con brani veri
- [ ] **BPM al doppio o alla metà** sui tempi veloci (sintetici: 160 → 80, 174 → 87); "Giant Steps" (~286) → 72. Anche "ACT!VE" dà 107,33 BPM (valore non intero, forse sbagliato): da sentire.
- [ ] **Brani con cambi di tempo** (es. "SICKO MODE"): la griglia è unica per tutto il brano.
- [ ] **Beat 1** riconosciuto dalla cassa: verificato solo su brani sintetici.
- [ ] **Memoria su telefoni economici**: il brano viene decodificato tutto (~100 MB per 5 min) più le copie per l'analisi del tempo.
- [ ] **Spazio dei Recenti**: fino a 40 brani interi nel browser; su Windows i brani scaricati restano anche in `cache/` (doppio spazio).
- [ ] **Precisione del conteggio**: usa timer normali, la ripartenza può tardare di qualche decina di ms. Da sentire con le orecchie.
- [ ] **Cursori verticali**: richiedono browser recenti (Chrome/Edge 124+, Safari 17+); su browser vecchi appaiono orizzontali.

## Non ancora provato
- [ ] Caricamento da link nella pagina v2, dall'inizio alla fine.
- [ ] "Apri cartella", pedali Bluetooth, scorrimento automatico vicino al bordo, qualità del suono, pizzico con dita vere, doppio tocco sui cursori del mixer.
- [ ] Android reale e Safari su Mac (dopo la pubblicazione su GitHub Pages).
- [x] Zip rigenerato con il link e il nuovo nome (i vecchi `Looper-MP3*.zip` in `dist/` non vanno più distribuiti).

## Rimandato dall'utente (solo promemoria)
- [ ] "Progressi della trascrizione" / Esporta-Importa progetto con la casella "includi l'audio" (attiva di default). Da definire con l'utente in futuro.

## Lingue e pubblicazione (21/11/2026)
- [x] Interfaccia in italiano, inglese, spagnolo, tedesco e francese (`js/i18n.js`): lingua del browser in automatico, menu IT/EN/ES/DE/FR in alto. `README.txt` in inglese.
- [ ] Far rileggere le traduzioni a un madrelingua (soprattutto ES/DE/FR, fatte da Claude).
- [ ] I messaggi di errore del server Windows (`server.ps1`) restano in italiano.
- [x] Pubblicato su GitHub Pages: https://zairedbn.github.io/bertacchio-transcribe/ (repo ZairedBN/bertacchio-transcribe, ramo `main`). Link inserito in LEGGIMI/README; zip nuovo `dist/Bertacchio-Transcribe-Windows.zip` (cartella "Bertacchio Transcribe").
