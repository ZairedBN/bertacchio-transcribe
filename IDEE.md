# IDEE — Bertacchio Transcribe

Idee e funzioni possibili per il futuro, **non ancora decise**. Le cose aperte (verifiche, limiti, pulizia) stanno in `DEV_NOTES.md`.
Quando un'idea viene decisa e costruita, si toglie da qui.

## Linee guida (decise il 23/11/2026)
- Il sito è per **chiunque**, non solo per noi: deve funzionare anche su telefoni economici e PC vecchi.
- I calcoli si fanno **nel browser**, senza contare su dispositivi potenti.
- **Niente server a pagamento.**
- Le cose avanzate vanno in pannelli chiusi o menu: il primo utilizzo resta semplice.

---

## Progressi della trascrizione / Esporta-Importa progetto — *rimandata dall'utente*
- Salvare tutto ciò che si fa su un brano: sezioni, BPM/griglia, mixer, velocità, appunti. Poi poterlo esportare e importare come file "progetto".
- Casella **"includi l'audio"**, attiva di default (scelta fatta dall'utente al momento dell'esportazione).
- L'utente non era sicuro di cosa vuole esattamente: **chiarire con lui prima di costruire**. Non implementare senza una richiesta esplicita.
- Base tecnica già pronta: `sections:<key>`, `tempo:<key>` in `localStorage`, audio in IndexedDB (`L.db`).

## Riconoscimento degli accordi (stile Chordify / Capo)
- Mostrare gli accordi sopra la forma d'onda, allineati ai beat della griglia.
- Approccio leggero, tutto nel browser:
  1. cromagramma (FFT → 12 classi di altezza) per ogni beat;
  2. confronto con modelli di accordi (maggiore, minore, 7, dim…);
  3. smoothing (HMM/Viterbi) per evitare cambi continui.
- È fattibile in un Worker come `js/bpm.js`, senza servizi esterni.
- Precisione realistica: buona su pop/rock, scarsa su jazz con accordi estesi. Va presentato come "suggerimento".
- Da decidere: dove mostrarli (striscia sotto le sezioni?), modifica a mano, esportazione.

## Vista delle note / spettro (stile Transcribe!)
- Spettrogramma del passaggio selezionato con una **tastiera di pianoforte** a lato, così si vedono le note suonate (utile per trascrivere assoli e linee di basso).
- Tecnica: FFT a finestra lunga (o Constant-Q) sul passaggio in loop, con gli assi in semitoni. Si può fare tutto nel browser con un Worker.
- Possibile aggiunta: riconoscimento della nota più forte nel punto della testina.

## Idee minori
- Appunti di testo per ogni sezione (andrebbero insieme a Esporta-Importa progetto).
