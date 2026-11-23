# DEV_NOTES — Bertacchio Transcribe

Elenco unico delle cose aperte e delle idee future (sostituisce `DA-FARE.md`, che resta nella cronologia git).
Ultimo controllo: 23/11/2026, versione online su `main` (SW `looper-v2-9`).

---

## 1. Da verificare con l'utente (prove reali)
- [ ] **Mixer a orecchio** su brani veri: soprattutto "voce ridotta" e "solo lati". I test sintetici passano (centro −15 dB, risposta piatta, niente saturazione), ma l'effetto su un mix reale non è mai stato ascoltato.
- [ ] **Android reale** (Chrome) e **Mac** (Safari/Chrome) sulla versione online. Mai provati su un dispositivo vero.
- [ ] **iPhone/iPad (Safari iOS)**: mai provato. Possibili problemi con AudioWorklet, autoplay e cursori verticali. Nei documenti iOS non viene citato apposta.
- [ ] **Caricamento da link** dall'inizio alla fine con lo zip nuovo (incolla link YouTube → download → forma d'onda). Finora verificato solo che il server parte e che `/api/ping` risponde `links: true`.
- [ ] Altre cose mai provate dal vivo:
  - "Apri cartella";
  - pedali Bluetooth;
  - scorrimento automatico vicino al bordo con lo zoom;
  - pizzico con dita vere;
  - doppio tocco sui cursori del mixer;
  - pressione lunga per i suggerimenti sul telefono.
- [ ] **Conteggio a orecchio**: ora il brano parte in anticipo e muto e si apre sul beat 1 con l'orologio audio (test `countsync`: 0–7 ms a 1×, prima −18…+15 ms). Da sentire su un dispositivo vero, anche con cuffie Bluetooth.
- [ ] **Traduzioni ES/DE/FR**: scritte da Claude, da far rileggere a un madrelingua. La terminologia musicale è la parte più delicata ("pasaje", "Einzähler", "décompte"…).

## 2. Limiti noti da migliorare
- [ ] **BPM al doppio o alla metà** sui tempi veloci.
  - Sintetici: 160 → 80, 174 → 87.
  - "Giant Steps" (~286) → 72.
  - "ACT!VE" dà 107,33 BPM (non intero): da sentire.
  - Idea: preferire l'ottava più vicina a 90–140 solo se la salienza è simile, oppure proporre "÷2 / ×2" con un suggerimento visibile.
- [ ] **Brani con cambi di tempo** (es. "SICKO MODE"): la griglia è unica per tutto il brano. Servirebbe una mappa del tempo a tratti (`steady` per blocchi esiste già in `js/bpm.js`).
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
- [x] Strumenti di test spostati in `tools/test/` (`run.ps1` lancia tutte le suite; vedi `tools/test/README.md`).
- [ ] Lo zip Windows va pubblicato come **Release** su GitHub, invece di passarlo a mano.

---

## 4. Funzioni future (idee discusse, non ancora decise)

### 4.1 Progressi della trascrizione / Esporta-Importa progetto — *rimandata dall'utente*
- Salvare tutto ciò che si fa su un brano: sezioni, BPM/griglia, mixer, velocità, appunti. Poi poterlo esportare e importare come file "progetto".
- Casella **"includi l'audio"**, attiva di default (scelta fatta dall'utente al momento dell'esportazione).
- L'utente non era sicuro di cosa vuole esattamente: **chiarire con lui prima di costruire**. Non implementare senza una richiesta esplicita.
- Base tecnica già pronta: `sections:<key>`, `tempo:<key>` in `localStorage`, audio in IndexedDB (`L.db`).

### 4.2 Riconoscimento degli accordi (stile Chordify / Capo)
- Mostrare gli accordi sopra la forma d'onda, allineati ai beat della griglia.
- Approccio leggero, tutto nel browser:
  1. cromagramma (FFT → 12 classi di altezza) per ogni beat;
  2. confronto con modelli di accordi (maggiore, minore, 7, dim…);
  3. smoothing (HMM/Viterbi) per evitare cambi continui.
- È fattibile in un Worker come `js/bpm.js`, senza servizi esterni.
- Precisione realistica: buona su pop/rock, scarsa su jazz con accordi estesi. Va presentato come "suggerimento".
- Da decidere: dove mostrarli (striscia sotto le sezioni?), modifica a mano, esportazione.

### 4.3 Separazione degli strumenti con l'IA (stile Moises)
- Voce, basso, batteria e "resto" come tracce separate, ognuna con il suo volume nel mixer.
- È la "separazione vera"; quella attuale ("voce ridotta", "solo lati") è solo un trucco stereo.
- Opzioni:
  - **Versione Windows**: Demucs (Python + PyTorch) chiamato da `server.ps1`, come yt-dlp. Qualità migliore, ma installazione pesante (diversi GB) e qualche minuto di calcolo per brano. Contrasta con il vincolo di semplicità: dovrebbe essere un componente aggiuntivo facoltativo.
  - **Nel browser**: modello ONNX (onnxruntime-web, WebGPU/WASM). Niente installazione, ma il modello pesa 50–150 MB e il calcolo è lento sui telefoni. Da valutare solo su computer.
  - **Servizio online**: semplice da usare, ma costa, richiede un server e caricare l'audio di terzi.
- In tutti i casi le tracce separate vanno salvate (IndexedDB o `cache/`) per non ricalcolarle.

### 4.4 Vista delle note / spettro (stile Transcribe!)
- Spettrogramma del passaggio selezionato con una **tastiera di pianoforte** a lato, così si vedono le note suonate (utile per trascrivere assoli e linee di basso).
- Tecnica: FFT a finestra lunga (o Constant-Q) sul passaggio in loop, con gli assi in semitoni. Si può fare tutto nel browser con un Worker.
- Possibile aggiunta: riconoscimento della nota più forte nel punto della testina.

### 4.5 Idee minori emerse lungo il lavoro
- Mappa del tempo per i brani con cambi di tempo (vedi sezione 2).
- Appunti di testo per ogni sezione (andrebbero insieme alla 4.1).
