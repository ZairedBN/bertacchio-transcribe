# DEV_NOTES — Bertacchio Transcribe

Cose aperte: verifiche, limiti, pulizia. Le idee per il futuro sono in **`IDEE.md`**.
Ultimo controllo: 26/11/2026, versione online (SW `looper-v2-11`).

---

## Ultime modifiche
Si tengono solo le ultime 1–2 versioni; il resto è nella cronologia git.

**v2-11 (26/11/2026)** — BPM giusto sui brani veloci, avviso "Forse è …?"
- **Tempi fino a 300 BPM**: prima il rilevamento si fermava a 200 ("Giant Steps" non poteva uscire giusto).
- **Scelta tra doppio e metà più affidabile**: conta quanto i colpi cadono sui beat rispetto a metà tra un beat e l'altro; l'hi-hat in ottavi non trascina più verso la metà. Corretto anche un falso picco sui brani lenti con pochi colpi (60 → 150).
- **Avviso "Forse è 160?"** accanto al BPM quando l'app è indecisa tra doppio e metà: un tocco usa quel tempo. Sparisce anche cambiando il BPM a mano, con Tap, ÷2 o ×2. Resta salvato con il brano. La nota accanto al BPM ora va a capo invece di essere tagliata con "…".
- I brani già aperti con le versioni precedenti vengono rianalizzati una volta (non quelli con il tempo corretto a mano; la scelta mostra/nascondi griglia resta).
- Nuova suite di test `bpmoct`: 49 brani sintetici (5 ritmi, 60–286 BPM) → 45 giusti, 4 sbagliati ma con l'avviso giusto, 0 errori senza avviso.
- **Zip Windows** rifatto: va passato a chi usa la versione Windows.

**v2-10 (24/11/2026)** — rifiniture contro le piccole frustrazioni
- **Annulla / ripristina il passaggio**: Ctrl+Z / Ctrl+Y e pulsante ↶ accanto a "Cancella". Vale per trascinamenti, A/B, −/+ (tenere premuto conta come un passo solo), Canc, campi inizio/fine e richiamo delle sezioni.
- **Aggiorna sezione**: se si ritoccano i bordi della sezione in ascolto compare "↻ Aggiorna «nome»", che salva i nuovi bordi e la velocità.
- **La sezione ricorda l'ultima velocità usata** su di essa (non quella dell'allenatore).
- **A/B al volo sul beat**: con griglia e aggancio attivi, A e B durante l'ascolto vanno sul beat più vicino a quello che si è sentito (si tolgono 50 ms di reazione + il ritardo d'uscita audio). Da fermo si agganciano solo se già vicini a un beat.
- **"Il beat 1 è qui"** sceglie il beat della griglia più vicino a quello sentito: sposta la battuta senza rovinare la fase dei beat.
- **Finestra nella pagina** al posto di prompt()/confirm() del browser (nome sezione, rinomina, elimina sezione, rimuovi dai recenti): più grande sul telefono, tradotta, Esc/clic fuori per annullare.
- **Matita ✎** sulla scheda della sezione in ascolto per rinominarla (sul telefono il doppio tocco non funzionava).
- **Rotella = zoom** sulla forma d'onda (dove si trova il puntatore); Maiusc+rotella o rotella orizzontale per scorrere. A brano intero la rotella in giù lascia scorrere la pagina.
- **Ogni brano ricorda la sua velocità** (`speed:<chiave>`); un brano nuovo parte da 100% invece di ereditare quella del brano precedente.
- **Sezione eliminata per errore**: Ctrl+Z / ↶ la rimette (Ctrl+Y la toglie di nuovo).
- Con la finestra "Tasti" aperta i tasti non comandano più il brano (prima Spazio lo faceva ripartire).
- Testi tradotti che restavano in italiano: "Impossibile leggere la forma d'onda…", "Caricamento…" nei Recenti.
- Nuovo test `polish`.
- **Zip Windows** rifatto: va passato a chi usa la versione Windows.

## 1. Da verificare con l'utente (prove reali)
- [ ] **Mixer a orecchio** su brani veri: soprattutto "voce ridotta" e "solo lati". I test sintetici passano (centro −15 dB, risposta piatta, niente saturazione), ma l'effetto su un mix reale non è mai stato ascoltato.
- [ ] **Android reale** (Chrome) e **Mac** (Safari/Chrome) sulla versione online. Mai provati su un dispositivo vero.
- [ ] **iPhone/iPad (Safari iOS)**: mai provato. Possibili problemi con AudioWorklet, autoplay e cursori verticali. Nei documenti iOS non viene citato apposta.
- [ ] **Caricamento da link** dall'inizio alla fine con lo zip nuovo (incolla link YouTube → download → forma d'onda). Finora verificato solo che il server parte e che `/api/ping` risponde `links: true`. Controllare anche che un errore vero (video privato, link sbagliato) appaia tradotto e comprensibile.
- [ ] Altre cose mai provate dal vivo:
  - "Apri cartella";
  - pedali Bluetooth;
  - scorrimento automatico vicino al bordo con lo zoom;
  - pizzico con dita vere;
  - doppio tocco sui cursori del mixer;
  - pressione lunga per i suggerimenti sul telefono.
- [ ] **Conteggio a orecchio**: ora il brano parte in anticipo e muto e si apre sul beat 1 con l'orologio audio (test `countsync`: 0–7 ms a 1×, prima −18…+15 ms). Da sentire su un dispositivo vero, anche con cuffie Bluetooth.
- [ ] **Rifiniture v2-10 a orecchio e a mano**:
  - A/B premuti durante l'ascolto: cadono sul beat giusto o su quello dopo? (compensazione di 50 ms + ritardo d'uscita, da provare anche con cuffie Bluetooth);
  - rotella = zoom: con il **trackpad del Mac** lo scorrimento verticale a due dita ora fa zoom sull'onda. Se dà fastidio, tornare a Ctrl+rotella solo per il trackpad;
  - finestra dei nomi sul telefono vero (tastiera che si apre, pulsanti comodi).
- [ ] **Avviso "Forse è …?" (v2-11) su brani veri**: compare quando serve e non dà fastidio quando non serve? Il valore proposto per "Giant Steps" (291,7) e per i brani trap ("VIBEZ" 154 o 77) è quello che conteresti tu?
- [ ] **Traduzioni ES/DE/FR**: scritte da Claude, da far rileggere a un madrelingua. La terminologia musicale è la parte più delicata ("pasaje", "Einzähler", "décompte"…).

## 2. Limiti noti da migliorare
- [ ] **BPM doppio/metà, casi rimasti** (dopo v2-11; i pulsanti ÷2 / ×2 sono nel menu "Griglia ▾"):
  - brani veri in `cache/`: "Giant Steps" → 145,86 con "Forse è 291,7?"; "VIBEZ" → 154 (prima 77) con "Forse è 77?"; "ACT!VE" → 107,36 senza avviso (107,36 non intero: da sentire); "Get on the Floor" → 124,79 senza avviso;
  - "Pulse" (Vincent David) è passato da 121 a 75,35: tempo non regolare, griglia nascosta, ma il BPM mostrato è cambiato. Da sentire quale è giusto;
  - un "half-time" a 100 BPM (sensazione di 50) dà un valore sbagliato senza avviso: caso raro, escluso dal test;
  - per i tempi estremi (sopra 200, sotto 60) l'avviso compare solo se i colpi li confermano chiaramente (`ALT_EXTREME` in `js/bpm.js`): altrimenti ogni brano disco/funk con hi-hat in sedicesimi proporrebbe il doppio ("Get on the Floor": 249,6). Prezzo: cassa e rullante alternati a 200–290 BPM vengono letti a metà senza avviso (brano di prova di `synth.js`);
  - i brani in 6/8 o con terzine non sono provati.
- [ ] **Brani con cambi di tempo** (es. "SICKO MODE") — *prossimo lavoro sulla griglia*: la griglia è unica per tutto il brano. Servirebbe una mappa del tempo a tratti (`steady` per blocchi esiste già in `js/bpm.js`).
- [ ] **Beat 1** riconosciuto dalla cassa: verificato solo su brani sintetici.
- [ ] **Memoria su telefoni economici**: il brano viene decodificato tutto (~100 MB per 5 min), più le copie per l'analisi del tempo. Possibile ottimizzazione: analizzare un mono a 11 kHz e liberare le copie.
- [ ] **Spazio dei Recenti**: fino a 40 brani interi in IndexedDB. Su Windows i brani scaricati restano anche in `cache/` (doppio spazio). Manca un indicatore dello spazio occupato.
- [ ] **Cursori verticali**: richiedono Chrome/Edge 124+ o Safari 17+; sui browser vecchi appaiono orizzontali, ma funzionano.
- [ ] **Colpi spostati con "mantieni intonazione"**: a velocità diverse da 1× l'algoritmo del browser che rallenta senza cambiare l'intonazione sposta i colpi di ±15 ms (a 1,5× fino a +30 ms), anche a metà passaggio. Non dipende dal conteggio e non è costante, quindi non si può compensare; con l'intonazione libera lo scarto resta sotto i 10 ms.
- [ ] **Frecce ↑/↓** restano assegnate ai pedali Bluetooth (play/pausa, ricomincia), quindi da tastiera non fanno scorrere la pagina. È una scelta voluta, da rivalutare se dà fastidio.
- [ ] I **nomi predefiniti delle sezioni** ("Sezione 1", "Section 1"…) restano nella lingua in cui sono state create: sono dati dell'utente, quindi è voluto.
- [ ] `manifest.webmanifest` è solo in italiano (nome e descrizione dell'app installata).

## 3. Pulizia / manutenzione
- [ ] In `dist/` ci sono ancora i vecchi `Looper-MP3.zip` e `Looper-MP3-v2.zip`: superati, si possono cancellare. Lo zip attuale è `Bertacchio-Transcribe-Windows.zip`.
- [ ] I rami `feature/link`, `feature/studio` e `feature/v2` sono già tutti dentro `main`: si possono eliminare.
- [ ] Lo zip Windows va pubblicato come **Release** su GitHub, invece di passarlo a mano.

