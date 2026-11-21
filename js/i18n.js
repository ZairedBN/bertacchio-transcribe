/* Looper — lingue: italiano (testo di partenza), inglese, spagnolo, tedesco, francese.
   Il testo italiano fa da chiave: L.t('Testo italiano {n}', {n: 3}).
   I testi fissi della pagina (nodi di testo, title, placeholder, aria-label) vengono tradotti da soli. */
(L => {
  'use strict';
  const LANGS = [['it', 'Italiano'], ['en', 'English'], ['es', 'Español'], ['de', 'Deutsch'], ['fr', 'Français']];
  const COLS = LANGS.map(l => l[0]);

  // [italiano, inglese, spagnolo, tedesco, francese]
  const ROWS = [
    // ---------- testata e apertura brani ----------
    ['⌨ Tasti', '⌨ Keys', '⌨ Teclas', '⌨ Tasten', '⌨ Touches'],
    ['Lingua', 'Language', 'Idioma', 'Sprache', 'Langue'],
    ['Apri file…', 'Open file…', 'Abrir archivo…', 'Datei öffnen…', 'Ouvrir un fichier…'],
    ['Recenti ▾', 'Recent ▾', 'Recientes ▾', 'Zuletzt ▾', 'Récents ▾'],
    ['Salvati su questo dispositivo', 'Saved on this device', 'Guardados en este dispositivo', 'Auf diesem Gerät gespeichert', 'Enregistrés sur cet appareil'],
    ['Apri cartella', 'Open folder', 'Abrir carpeta', 'Ordner öffnen', 'Ouvrir le dossier'],
    ['…oppure incolla un link (YouTube, SoundCloud…)', '…or paste a link (YouTube, SoundCloud…)', '…o pega un enlace (YouTube, SoundCloud…)', '…oder einen Link einfügen (YouTube, SoundCloud…)', '…ou collez un lien (YouTube, SoundCloud…)'],
    ['Carica link', 'Load link', 'Cargar enlace', 'Link laden', 'Charger le lien'],

    // ---------- mixer ----------
    ['Mixer', 'Mixer', 'Mezclador', 'Mixer', 'Mixeur'],
    ['Volume', 'Volume', 'Volumen', 'Lautstärke', 'Volume'],
    ['Bassi', 'Bass', 'Graves', 'Bässe', 'Graves'],
    ['Medi', 'Mids', 'Medios', 'Mitten', 'Médiums'],
    ['Alti', 'Highs', 'Agudos', 'Höhen', 'Aigus'],
    ['Abbassa del tutto un cursore per spegnere quella banda. Doppio clic (o doppio tocco) lo riporta a zero.',
      'Pull a fader all the way down to switch that band off. Double-click (or double-tap) resets it to zero.',
      'Baja del todo un fader para apagar esa banda. Doble clic (o doble toque) lo devuelve a cero.',
      'Einen Regler ganz nach unten ziehen schaltet das Band aus. Doppelklick (oder Doppeltippen) setzt ihn auf null.',
      'Baissez complètement un curseur pour couper cette bande. Double-clic (ou double appui) le remet à zéro.'],
    ['Ascolta', 'Listen to', 'Escuchar', 'Anhören', 'Écouter'],
    ['tutto il brano', 'the whole track', 'toda la canción', 'den ganzen Song', 'tout le morceau'],
    ['voce ridotta (karaoke)', 'reduced vocals (karaoke)', 'voz reducida (karaoke)', 'Gesang reduziert (Karaoke)', 'voix réduite (karaoké)'],
    ['solo centro (voce, basso, batteria)', 'center only (vocals, bass, drums)', 'solo centro (voz, bajo, batería)', 'nur Mitte (Gesang, Bass, Schlagzeug)', 'centre seul (voix, basse, batterie)'],
    ['solo lati (chitarre, tastiere)', 'sides only (guitars, keys)', 'solo laterales (guitarras, teclados)', 'nur Seiten (Gitarren, Keyboards)', 'côtés seuls (guitares, claviers)'],
    ['solo bassi', 'bass only', 'solo graves', 'nur Bässe', 'graves seuls'],
    ['senza bassi', 'no bass', 'sin graves', 'ohne Bässe', 'sans graves'],
    ['solo canale sinistro', 'left channel only', 'solo canal izquierdo', 'nur linker Kanal', 'canal gauche seul'],
    ['solo canale destro', 'right channel only', 'solo canal derecho', 'nur rechter Kanal', 'canal droit seul'],
    [' (serve un brano stereo)', ' (needs a stereo track)', ' (requiere una canción estéreo)', ' (benötigt Stereo)', ' (morceau stéréo requis)'],
    ['Toglie ciò che sta al centro del mix (di solito la voce). Serve un brano stereo.',
      'Removes what sits in the center of the mix (usually the vocals). Needs a stereo track.',
      'Quita lo que está en el centro de la mezcla (normalmente la voz). Requiere una canción estéreo.',
      'Entfernt, was in der Mitte des Mixes liegt (meist der Gesang). Benötigt Stereo.',
      'Supprime ce qui est au centre du mixage (en général la voix). Morceau stéréo requis.'],
    ['Tiene solo ciò che sta al centro: di solito voce, basso, cassa e rullante.',
      'Keeps only the center: usually vocals, bass, kick and snare.',
      'Deja solo el centro: normalmente voz, bajo, bombo y caja.',
      'Behält nur die Mitte: meist Gesang, Bass, Bassdrum und Snare.',
      'Garde seulement le centre : en général voix, basse, grosse caisse et caisse claire.'],
    ['Tiene solo ciò che è aperto a destra e a sinistra (chitarre, tastiere, cori). Serve un brano stereo.',
      'Keeps only what is panned left and right (guitars, keys, backing vocals). Needs a stereo track.',
      'Deja solo lo que está abierto a izquierda y derecha (guitarras, teclados, coros). Requiere una canción estéreo.',
      'Behält nur, was links und rechts liegt (Gitarren, Keyboards, Chöre). Benötigt Stereo.',
      'Garde seulement ce qui est à gauche et à droite (guitares, claviers, chœurs). Morceau stéréo requis.'],
    ['Solo il canale sinistro, in entrambe le orecchie.', 'Left channel only, in both ears.', 'Solo el canal izquierdo, en ambos oídos.', 'Nur der linke Kanal, auf beiden Ohren.', 'Canal gauche seul, dans les deux oreilles.'],
    ['Solo il canale destro, in entrambe le orecchie.', 'Right channel only, in both ears.', 'Solo el canal derecho, en ambos oídos.', 'Nur der rechte Kanal, auf beiden Ohren.', 'Canal droit seul, dans les deux oreilles.'],
    ['Solo sotto i 250 Hz: basso e cassa.', 'Only below 250 Hz: bass and kick.', 'Solo por debajo de 250 Hz: bajo y bombo.', 'Nur unter 250 Hz: Bass und Bassdrum.', 'Seulement sous 250 Hz : basse et grosse caisse.'],
    ['Toglie tutto sotto i 250 Hz (basso e cassa).', 'Removes everything below 250 Hz (bass and kick).', 'Quita todo por debajo de 250 Hz (bajo y bombo).', 'Entfernt alles unter 250 Hz (Bass und Bassdrum).', 'Supprime tout sous 250 Hz (basse et grosse caisse).'],
    ['Questo brano è mono: questa modalità non ha effetto.', 'This track is mono: this mode has no effect.', 'Esta canción es mono: este modo no tiene efecto.', 'Dieser Song ist mono: dieser Modus wirkt nicht.', 'Ce morceau est mono : ce mode est sans effet.'],
    ['spento', 'off', 'apagado', 'aus', 'coupé'],
    ['Dissolvenza ai bordi del loop', 'Fade at the loop edges', 'Fundido en los bordes del loop', 'Blende an den Loop-Grenzen', 'Fondu aux bords de la boucle'],
    ['Tonalità', 'Pitch', 'Tonalidad', 'Tonhöhe', 'Tonalité'],
    ['Trasposizione', 'Transpose', 'Transposición', 'Transponieren', 'Transposition'],
    ['Accordatura', 'Fine tuning', 'Afinación', 'Feinstimmung', 'Accordage'],
    ['{n} semitono', '{n} semitone', '{n} semitono', '{n} Halbton', '{n} demi-ton'],
    ['{n} semitoni', '{n} semitones', '{n} semitonos', '{n} Halbtöne', '{n} demi-tons'],
    ['0 semitoni', '0 semitones', '0 semitonos', '0 Halbtöne', '0 demi-tons'],
    ['Cambia la tonalità senza cambiare la velocità (es. per il capotasto o uno strumento accordato diversamente). Qualità adatta allo studio.',
      'Changes the pitch without changing the speed (e.g. for a capo or an instrument tuned differently). Quality suited to practice.',
      'Cambia la tonalidad sin cambiar la velocidad (p. ej. para la cejilla o un instrumento con otra afinación). Calidad adecuada para estudiar.',
      'Ändert die Tonhöhe ohne das Tempo zu ändern (z. B. für ein Capo oder ein anders gestimmtes Instrument). Qualität fürs Üben ausreichend.',
      'Change la tonalité sans changer la vitesse (p. ex. pour un capodastre ou un instrument accordé autrement). Qualité adaptée au travail.'],
    ['Reimposta suono', 'Reset sound', 'Restablecer sonido', 'Klang zurücksetzen', 'Réinitialiser le son'],
    ['Il browser non supporta gli effetti audio: restano disponibili loop e velocità.',
      'This browser does not support audio effects: loop and speed still work.',
      'El navegador no admite efectos de audio: el loop y la velocidad siguen disponibles.',
      'Der Browser unterstützt keine Audioeffekte: Loop und Tempo funktionieren weiterhin.',
      'Le navigateur ne prend pas en charge les effets audio : la boucle et la vitesse restent disponibles.'],
    ['Trasposizione non disponibile in questo browser.', 'Transposing is not available in this browser.', 'La transposición no está disponible en este navegador.', 'Transponieren ist in diesem Browser nicht verfügbar.', 'La transposition n\'est pas disponible dans ce navigateur.'],

    // ---------- forma d'onda e tempo ----------
    ['Nessun brano caricato', 'No track loaded', 'Ninguna canción cargada', 'Kein Song geladen', 'Aucun morceau chargé'],
    ['Riduci zoom', 'Zoom out', 'Alejar', 'Herauszoomen', 'Dézoomer'],
    ['Aumenta zoom', 'Zoom in', 'Acercar', 'Hineinzoomen', 'Zoomer'],
    ['Ingrandisci il passaggio selezionato', 'Zoom to the selected passage', 'Ampliar el pasaje seleccionado', 'Auf die gewählte Passage zoomen', 'Zoomer sur le passage sélectionné'],
    ['Mostra tutto il brano', 'Show the whole track', 'Mostrar toda la canción', 'Ganzen Song zeigen', 'Afficher tout le morceau'],
    ['Selezione', 'Selection', 'Selección', 'Auswahl', 'Sélection'],
    ['Tutto', 'All', 'Todo', 'Alles', 'Tout'],
    ['Trascina qui un file audio oppure usa “Apri file…”', 'Drop an audio file here or use “Open file…”', 'Arrastra aquí un archivo de audio o usa “Abrir archivo…”', 'Audiodatei hierher ziehen oder „Datei öffnen…“ verwenden', 'Déposez un fichier audio ici ou utilisez « Ouvrir un fichier… »'],
    ['Caricamento…', 'Loading…', 'Cargando…', 'Wird geladen…', 'Chargement…'],
    ['Impossibile leggere la forma d\'onda (il brano potrebbe comunque essere riproducibile).',
      'Could not read the waveform (the track may still play).',
      'No se pudo leer la forma de onda (puede que la canción se reproduzca igualmente).',
      'Wellenform konnte nicht gelesen werden (der Song lässt sich eventuell trotzdem abspielen).',
      'Impossible de lire la forme d\'onde (le morceau peut quand même être lu).'],
    ['Panoramica: tocca per spostarti, trascina il riquadro per scorrere', 'Overview: tap to move, drag the box to scroll', 'Vista general: toca para moverte, arrastra el recuadro para desplazarte', 'Übersicht: tippen zum Springen, Rahmen ziehen zum Scrollen', 'Vue d\'ensemble : touchez pour vous déplacer, faites glisser le cadre pour défiler'],
    ['Battiti al minuto (BPM)', 'Beats per minute (BPM)', 'Pulsos por minuto (BPM)', 'Schläge pro Minute (BPM)', 'Battements par minute (BPM)'],
    ['Griglia ▾', 'Grid ▾', 'Cuadrícula ▾', 'Raster ▾', 'Grille ▾'],
    ['Griglia dei beat', 'Beat grid', 'Cuadrícula de pulsos', 'Beat-Raster', 'Grille des temps'],
    ['Mostra la griglia', 'Show the grid', 'Mostrar la cuadrícula', 'Raster anzeigen', 'Afficher la grille'],
    ['Aggancia la selezione ai beat', 'Snap the selection to beats', 'Ajustar la selección a los pulsos', 'Auswahl am Beat einrasten', 'Aimanter la sélection aux temps'],
    ['Dimezza i BPM', 'Halve the BPM', 'Dividir los BPM a la mitad', 'BPM halbieren', 'Diviser les BPM par deux'],
    ['Raddoppia i BPM', 'Double the BPM', 'Duplicar los BPM', 'BPM verdoppeln', 'Doubler les BPM'],
    ['Sposta la griglia: il beat 1 cade dove si trova ora la testina', 'Move the grid: beat 1 falls where the playhead is now', 'Mueve la cuadrícula: el pulso 1 cae donde está ahora el cursor', 'Raster verschieben: Schlag 1 liegt an der aktuellen Abspielposition', 'Déplacer la grille : le temps 1 tombe sur la tête de lecture'],
    ['Il beat 1 è qui', 'Beat 1 is here', 'El pulso 1 está aquí', 'Schlag 1 ist hier', 'Le temps 1 est ici'],
    ['Tempo in chiave', 'Time signature', 'Compás', 'Taktart', 'Mesure'],
    ['Funziona con i brani a tempo costante. Se il tempo non è regolare (jazz, rubato, dal vivo) la griglia parte nascosta.',
      'Works with tracks in steady tempo. If the tempo is not steady (jazz, rubato, live) the grid starts hidden.',
      'Funciona con canciones de tempo constante. Si el tempo no es regular (jazz, rubato, en directo) la cuadrícula empieza oculta.',
      'Funktioniert bei Songs mit festem Tempo. Ist das Tempo nicht gleichmäßig (Jazz, Rubato, live), ist das Raster anfangs ausgeblendet.',
      'Fonctionne avec les morceaux à tempo constant. Si le tempo n\'est pas régulier (jazz, rubato, live), la grille est masquée au départ.'],
    ['griglia nascosta (attivala da Griglia ▾)', 'grid hidden (turn it on from Grid ▾)', 'cuadrícula oculta (actívala en Cuadrícula ▾)', 'Raster ausgeblendet (über Raster ▾ einschalten)', 'grille masquée (activez-la dans Grille ▾)'],
    ['(rilevato)', '(detected)', '(detectado)', '(erkannt)', '(détecté)'],
    ['(rilevato, da verificare)', '(detected, please check)', '(detectado, por verificar)', '(erkannt, bitte prüfen)', '(détecté, à vérifier)'],
    ['analisi in corso…', 'analyzing…', 'analizando…', 'wird analysiert…', 'analyse en cours…'],
    ['non rilevato: usa Tap', 'not detected: use Tap', 'no detectado: usa Tap', 'nicht erkannt: Tap verwenden', 'non détecté : utilisez Tap'],
    ['tempo non regolare: griglia nascosta (attivala da Griglia ▾)', 'unsteady tempo: grid hidden (turn it on from Grid ▾)', 'tempo irregular: cuadrícula oculta (actívala en Cuadrícula ▾)', 'ungleichmäßiges Tempo: Raster ausgeblendet (über Raster ▾ einschalten)', 'tempo irrégulier : grille masquée (activez-la dans Grille ▾)'],
    ['continua a battere…', 'keep tapping…', 'sigue marcando…', 'weiter tippen…', 'continuez à taper…'],
    ['(da Tap)', '(from Tap)', '(por Tap)', '(per Tap)', '(par Tap)'],
    ['(da Tap) · griglia nascosta', '(from Tap) · grid hidden', '(por Tap) · cuadrícula oculta', '(per Tap) · Raster ausgeblendet', '(par Tap) · grille masquée'],
    ['griglia nascosta', 'grid hidden', 'cuadrícula oculta', 'Raster ausgeblendet', 'grille masquée'],

    // ---------- comandi ----------
    ['▶ Play', '▶ Play', '▶ Play', '▶ Play', '▶ Lecture'],
    ['❚❚ Pausa', '❚❚ Pause', '❚❚ Pausa', '❚❚ Pause', '❚❚ Pause'],
    ['Ricomincia', 'Restart', 'Reiniciar', 'Neu starten', 'Recommencer'],
    ['Indietro', 'Back', 'Atrás', 'Zurück', 'Arrière'],
    ['Avanti', 'Forward', 'Adelante', 'Vor', 'Avant'],
    ['Stop', 'Stop', 'Detener', 'Stopp', 'Arrêt'],
    ['Più lento', 'Slower', 'Más lento', 'Langsamer', 'Plus lent'],
    ['Più veloce', 'Faster', 'Más rápido', 'Schneller', 'Plus rapide'],
    ['Imposta A', 'Set A', 'Fijar A', 'A setzen', 'Définir A'],
    ['Imposta B', 'Set B', 'Fijar B', 'B setzen', 'Définir B'],

    // ---------- passaggio ----------
    ['Passaggio', 'Passage', 'Pasaje', 'Passage', 'Passage'],
    ['Inizio prima', 'Start earlier', 'Inicio antes', 'Anfang früher', 'Début plus tôt'],
    ['Inizio dopo', 'Start later', 'Inicio después', 'Anfang später', 'Début plus tard'],
    ['Fine prima', 'End earlier', 'Final antes', 'Ende früher', 'Fin plus tôt'],
    ['Fine dopo', 'End later', 'Final después', 'Ende später', 'Fin plus tard'],
    ['inizio', 'start', 'inicio', 'Anfang', 'début'],
    ['fine', 'end', 'final', 'Ende', 'fin'],
    ['Inizio', 'Start', 'Inicio', 'Anfang', 'Début'],
    ['Fine', 'End', 'Fin', 'Ende', 'Fin'],
    ['Tasto A', 'Key A', 'Tecla A', 'Taste A', 'Touche A'],
    ['Tasto B', 'Key B', 'Tecla B', 'Taste B', 'Touche B'],
    ['Cancella', 'Clear', 'Borrar', 'Löschen', 'Effacer'],
    ['Prima di ripartire', 'Before restarting', 'Antes de reiniciar', 'Vor dem Neustart', 'Avant de reprendre'],
    ['riparti subito', 'restart at once', 'reiniciar enseguida', 'sofort neu starten', 'reprendre aussitôt'],
    ['conteggio di 1 battuta', '1-bar count-in', 'cuenta previa de 1 compás', '1 Takt Einzähler', 'décompte d\'1 mesure'],
    ['conteggio di 2 battute', '2-bar count-in', 'cuenta previa de 2 compases', '2 Takte Einzähler', 'décompte de 2 mesures'],
    ['pausa di 2 secondi', '2-second pause', 'pausa de 2 segundos', '2 Sekunden Pause', 'pause de 2 secondes'],
    ['BPM del conteggio', 'Count-in BPM', 'BPM de la cuenta', 'Einzähler-BPM', 'BPM du décompte'],
    ['anche al primo Play', 'also on the first Play', 'también en el primer Play', 'auch beim ersten Play', 'aussi à la première lecture'],
    ['Ripetizioni: {n}', 'Repeats: {n}', 'Repeticiones: {n}', 'Wiederholungen: {n}', 'Répétitions : {n}'],
    ['BPM del brano non disponibili: il conteggio usa 100 BPM. Puoi impostarli con Tap nella riga Tempo.',
      'Track BPM not available: the count-in uses 100 BPM. You can set them with Tap.',
      'BPM de la canción no disponibles: la cuenta usa 100 BPM. Puedes fijarlos con Tap.',
      'Song-BPM nicht verfügbar: der Einzähler nutzt 100 BPM. Du kannst sie mit Tap festlegen.',
      'BPM du morceau indisponibles : le décompte utilise 100 BPM. Vous pouvez les définir avec Tap.'],
    ['Il conteggio segue i BPM del brano (rilevati quando lo carichi).', 'The count-in follows the track BPM (detected when you load it).', 'La cuenta sigue los BPM de la canción (detectados al cargarla).', 'Der Einzähler folgt den Song-BPM (beim Laden erkannt).', 'Le décompte suit les BPM du morceau (détectés au chargement).'],
    ['Conteggio a {eff} BPM ({bpm} BPM del brano × velocità {rate}×).', 'Count-in at {eff} BPM ({bpm} track BPM × speed {rate}×).', 'Cuenta a {eff} BPM ({bpm} BPM de la canción × velocidad {rate}×).', 'Einzähler mit {eff} BPM ({bpm} Song-BPM × Tempo {rate}×).', 'Décompte à {eff} BPM ({bpm} BPM du morceau × vitesse {rate}×).'],

    // ---------- sezioni ----------
    ['Sezioni', 'Sections', 'Secciones', 'Abschnitte', 'Sections'],
    ['＋ Salva sezione', '＋ Save section', '＋ Guardar sección', '＋ Abschnitt speichern', '＋ Enregistrer la section'],
    ['Seleziona un passaggio e salvalo per ritrovarlo subito.', 'Select a passage and save it to find it again instantly.', 'Selecciona un pasaje y guárdalo para encontrarlo al instante.', 'Wähle eine Passage und speichere sie, um sie sofort wiederzufinden.', 'Sélectionnez un passage et enregistrez-le pour le retrouver tout de suite.'],
    ['Nome della sezione (es. Intro, Assolo, Ritornello):', 'Section name (e.g. Intro, Solo, Chorus):', 'Nombre de la sección (p. ej. Intro, Solo, Estribillo):', 'Name des Abschnitts (z. B. Intro, Solo, Refrain):', 'Nom de la section (p. ex. Intro, Solo, Refrain) :'],
    ['Nuovo nome della sezione:', 'New section name:', 'Nuevo nombre de la sección:', 'Neuer Name des Abschnitts:', 'Nouveau nom de la section :'],
    ['Sezione {n}', 'Section {n}', 'Sección {n}', 'Abschnitt {n}', 'Section {n}'],
    ['Elimina sezione', 'Delete section', 'Eliminar sección', 'Abschnitt löschen', 'Supprimer la section'],
    ['Eliminare la sezione “{name}”?', 'Delete the section “{name}”?', '¿Eliminar la sección “{name}”?', 'Abschnitt „{name}“ löschen?', 'Supprimer la section « {name} » ?'],

    // ---------- recenti e link ----------
    ['Rimuovi dai recenti', 'Remove from recent', 'Quitar de recientes', 'Aus „Zuletzt“ entfernen', 'Retirer des récents'],
    ['Rimuovere “{name}” dai recenti?', 'Remove “{name}” from recent?', '¿Quitar “{name}” de recientes?', '„{name}“ aus „Zuletzt“ entfernen?', 'Retirer « {name} » des récents ?'],
    ['I recenti non sono disponibili in questo browser ({msg}).', 'Recent tracks are not available in this browser ({msg}).', 'Los recientes no están disponibles en este navegador ({msg}).', '„Zuletzt“ ist in diesem Browser nicht verfügbar ({msg}).', 'Les récents ne sont pas disponibles dans ce navigateur ({msg}).'],
    ['Nessun brano recente. I brani che apri compariranno qui.', 'No recent tracks. The tracks you open will appear here.', 'No hay canciones recientes. Las que abras aparecerán aquí.', 'Keine zuletzt geöffneten Songs. Geöffnete Songs erscheinen hier.', 'Aucun morceau récent. Les morceaux que vous ouvrez apparaîtront ici.'],
    ['Brano non trovato', 'Track not found', 'Canción no encontrada', 'Song nicht gefunden', 'Morceau introuvable'],
    ['Impossibile aprire il brano: {msg}', 'Could not open the track: {msg}', 'No se pudo abrir la canción: {msg}', 'Song konnte nicht geöffnet werden: {msg}', 'Impossible d\'ouvrir le morceau : {msg}'],
    ['Scaricamento in corso… (può richiedere qualche secondo)', 'Downloading… (this may take a few seconds)', 'Descargando… (puede tardar unos segundos)', 'Wird heruntergeladen… (kann einige Sekunden dauern)', 'Téléchargement… (peut prendre quelques secondes)'],
    ['Caricamento audio…', 'Loading audio…', 'Cargando audio…', 'Audio wird geladen…', 'Chargement de l\'audio…'],
    ['Impossibile leggere il file audio', 'Could not read the audio file', 'No se pudo leer el archivo de audio', 'Audiodatei konnte nicht gelesen werden', 'Impossible de lire le fichier audio'],
    ['Per caricare brani da un link avvia il looper con avvia-looper.bat.', 'To load tracks from a link, start the app with avvia-looper.bat.', 'Para cargar canciones desde un enlace, inicia la app con avvia-looper.bat.', 'Um Songs per Link zu laden, starte die App mit avvia-looper.bat.', 'Pour charger des morceaux depuis un lien, lancez l\'appli avec avvia-looper.bat.'],
    ['Server non raggiungibile: è ancora aperta la finestra di avvia-looper.bat?', 'Server not reachable: is the avvia-looper.bat window still open?', 'Servidor no disponible: ¿sigue abierta la ventana de avvia-looper.bat?', 'Server nicht erreichbar: ist das Fenster von avvia-looper.bat noch offen?', 'Serveur injoignable : la fenêtre d\'avvia-looper.bat est-elle encore ouverte ?'],
    ['Risposta non valida dal server (errore {n})', 'Invalid response from the server (error {n})', 'Respuesta no válida del servidor (error {n})', 'Ungültige Antwort vom Server (Fehler {n})', 'Réponse invalide du serveur (erreur {n})'],
    ['Errore {n}', 'Error {n}', 'Error {n}', 'Fehler {n}', 'Erreur {n}'],
    ['Archivio del browser non disponibile', 'Browser storage not available', 'Almacenamiento del navegador no disponible', 'Browser-Speicher nicht verfügbar', 'Stockage du navigateur indisponible'],
    ['Salvataggio non riuscito (spazio esaurito?)', 'Saving failed (out of space?)', 'No se pudo guardar (¿sin espacio?)', 'Speichern fehlgeschlagen (Speicher voll?)', 'Échec de l\'enregistrement (plus d\'espace ?)'],

    // ---------- tasti rapidi (finestra) ----------
    ['Tasti rapidi', 'Keyboard shortcuts', 'Atajos de teclado', 'Tastenkürzel', 'Raccourcis clavier'],
    ['Chiudi', 'Close', 'Cerrar', 'Schließen', 'Fermer'],
    ['Riproduzione', 'Playback', 'Reproducción', 'Wiedergabe', 'Lecture'],
    ['Spostarsi', 'Moving around', 'Desplazarse', 'Navigieren', 'Se déplacer'],
    ['Passaggio e sezioni', 'Passage and sections', 'Pasaje y secciones', 'Passage und Abschnitte', 'Passage et sections'],
    ['Tempo', 'Tempo', 'Tempo', 'Tempo', 'Tempo'],
    ['Spazio', 'Space', 'Espacio', 'Leertaste', 'Espace'],
    ['Invio', 'Enter', 'Intro', 'Enter', 'Entrée'],
    ['PagGiù', 'PgDn', 'AvPág', 'Bild↓', 'PgSuiv'],
    ['PagSu', 'PgUp', 'RePág', 'Bild↑', 'PgPréc'],
    ['Maiusc', 'Shift', 'Mayús', 'Umschalt', 'Maj'],
    ['Home', 'Home', 'Inicio', 'Pos1', 'Début'],
    ['Canc', 'Del', 'Supr', 'Entf', 'Suppr'],
    ['+ trascina', '+ drag', '+ arrastrar', '+ ziehen', '+ glisser'],
    ['+ rotella', '+ wheel', '+ rueda', '+ Mausrad', '+ molette'],
    ['torna all\'inizio del passaggio (o del brano) e suona', 'back to the start of the passage (or track) and play', 'vuelve al inicio del pasaje (o de la canción) y reproduce', 'zurück zum Anfang der Passage (oder des Songs) und abspielen', 'retour au début du passage (ou du morceau) et lecture'],
    ['play / pausa', 'play / pause', 'play / pausa', 'Play / Pause', 'lecture / pause'],
    ['loop sì / no', 'loop on / off', 'loop sí / no', 'Loop an / aus', 'boucle oui / non'],
    ['velocità su / giù (5%)', 'speed up / down (5%)', 'velocidad arriba / abajo (5%)', 'Tempo rauf / runter (5 %)', 'vitesse + / − (5 %)'],
    ['velocità normale (100%)', 'normal speed (100%)', 'velocidad normal (100%)', 'normales Tempo (100 %)', 'vitesse normale (100 %)'],
    ['play / pausa (pedali Bluetooth)', 'play / pause (Bluetooth pedals)', 'play / pausa (pedales Bluetooth)', 'Play / Pause (Bluetooth-Pedale)', 'lecture / pause (pédales Bluetooth)'],
    ['ricomincia (pedali Bluetooth)', 'restart (Bluetooth pedals)', 'reiniciar (pedales Bluetooth)', 'neu starten (Bluetooth-Pedale)', 'recommencer (pédales Bluetooth)'],
    ['con la griglia: battuta precedente / successiva.', 'with the grid: previous / next bar.', 'con cuadrícula: compás anterior / siguiente.', 'mit Raster: vorheriger / nächster Takt.', 'avec la grille : mesure précédente / suivante.'],
    ['Senza griglia: inizio o fine di passaggio e sezioni', 'Without the grid: start or end of passage and sections', 'Sin cuadrícula: inicio o final del pasaje y las secciones', 'Ohne Raster: Anfang oder Ende von Passage und Abschnitten', 'Sans grille : début ou fin du passage et des sections'],
    ['indietro / avanti di 2 secondi', 'back / forward 2 seconds', 'atrás / adelante 2 segundos', '2 Sekunden zurück / vor', 'reculer / avancer de 2 secondes'],
    ['inizio / fine del brano', 'start / end of the track', 'inicio / final de la canción', 'Anfang / Ende des Songs', 'début / fin du morceau'],
    ['zoom sul passaggio / tutto il brano', 'zoom to the passage / whole track', 'zoom al pasaje / toda la canción', 'Zoom auf Passage / ganzen Song', 'zoom sur le passage / tout le morceau'],
    ['inizio / fine del passaggio dove si trova la testina', 'passage start / end at the playhead', 'inicio / final del pasaje donde está el cursor', 'Anfang / Ende der Passage an der Abspielposition', 'début / fin du passage à la tête de lecture'],
    ['cancella la selezione', 'clear the selection', 'borra la selección', 'Auswahl löschen', 'effacer la sélection'],
    ['salva il passaggio come sezione', 'save the passage as a section', 'guarda el pasaje como sección', 'Passage als Abschnitt speichern', 'enregistrer le passage comme section'],
    ['richiama una sezione salvata', 'recall a saved section', 'recupera una sección guardada', 'gespeicherten Abschnitt aufrufen', 'rappeler une section enregistrée'],
    ['tap: batti a tempo (almeno 4 volte) per registrare i BPM', 'tap: tap along (at least 4 times) to set the BPM', 'tap: marca el pulso (al menos 4 veces) para fijar los BPM', 'Tap: im Takt tippen (mindestens 4-mal), um die BPM festzulegen', 'tap : tapez en rythme (au moins 4 fois) pour définir les BPM'],
    ['mostra / nascondi la griglia dei beat', 'show / hide the beat grid', 'muestra / oculta la cuadrícula', 'Beat-Raster ein- / ausblenden', 'afficher / masquer la grille'],
    ['seleziona senza agganciarti ai beat', 'select without snapping to beats', 'selecciona sin ajustarse a los pulsos', 'auswählen ohne Einrasten am Beat', 'sélectionner sans aimantation aux temps'],
    ['zoom sulla forma d\'onda', 'zoom the waveform', 'zoom en la forma de onda', 'Zoom auf die Wellenform', 'zoom sur la forme d\'onde'],
    ['Sul telefono: un dito per selezionare, due dita per lo zoom. Tocca la barra sotto la forma d\'onda per spostarti nel brano, tocca le bande colorate in fondo alla forma d\'onda per richiamare le sezioni. Tieni premuto un pulsante per sapere a cosa serve.',
      'On a phone: one finger to select, two fingers to zoom. Tap the bar under the waveform to move through the track, tap the colored bands at the bottom of the waveform to recall sections. Press and hold a button to see what it does.',
      'En el teléfono: un dedo para seleccionar, dos dedos para el zoom. Toca la barra bajo la forma de onda para moverte por la canción y las bandas de colores al pie de la forma de onda para recuperar las secciones. Mantén pulsado un botón para saber para qué sirve.',
      'Am Handy: ein Finger zum Auswählen, zwei Finger zum Zoomen. Tippe auf die Leiste unter der Wellenform, um im Song zu springen, und auf die farbigen Bänder unten in der Wellenform, um Abschnitte aufzurufen. Halte eine Taste gedrückt, um zu sehen, was sie tut.',
      'Sur téléphone : un doigt pour sélectionner, deux doigts pour zoomer. Touchez la barre sous la forme d\'onde pour vous déplacer, et les bandes colorées en bas de la forme d\'onde pour rappeler les sections. Maintenez un bouton appuyé pour savoir à quoi il sert.'],

    // ---------- velocità e allenatore ----------
    ['Velocità e allenatore', 'Speed and trainer', 'Velocidad y entrenador', 'Tempo und Trainer', 'Vitesse et entraîneur'],
    ['Velocità', 'Speed', 'Velocidad', 'Tempo', 'Vitesse'],
    ['Velocità esatta', 'Exact speed', 'Velocidad exacta', 'Genaues Tempo', 'Vitesse exacte'],
    ['Mantieni intonazione', 'Keep pitch', 'Mantener afinación', 'Tonhöhe beibehalten', 'Conserver la hauteur'],
    ['Allenatore di velocità', 'Speed trainer', 'Entrenador de velocidad', 'Tempo-Trainer', 'Entraîneur de vitesse'],
    ['Parti lento: a ogni ripetizione del passaggio la velocità sale da sola fino all\'obiettivo.', 'Start slow: with every repeat of the passage the speed goes up by itself to the target.', 'Empieza lento: con cada repetición del pasaje la velocidad sube sola hasta el objetivo.', 'Langsam anfangen: mit jeder Wiederholung der Passage steigt das Tempo von selbst bis zum Ziel.', 'Commencez lentement : à chaque répétition du passage, la vitesse augmente toute seule jusqu\'à l\'objectif.'],
    ['Partenza', 'Start', 'Inicio', 'Start', 'Départ'],
    ['Obiettivo', 'Target', 'Objetivo', 'Ziel', 'Objectif'],
    ['Aumento', 'Increase', 'Aumento', 'Steigerung', 'Hausse'],
    ['Graduale', 'Gentle', 'Gradual', 'Sanft', 'Progressive'],
    ['Normale', 'Normal', 'Normal', 'Normal', 'Normale'],
    ['Veloce', 'Fast', 'Rápido', 'Schnell', 'Rapide'],
    ['Personalizza', 'Custom', 'Personalizar', 'Eigene', 'Personnaliser'],
    ['% ogni', '% every', '% cada', '% alle', '% tous les'],
    ['giri', 'loops', 'vueltas', 'Durchgänge', 'tours'],
    ['+{step}% ogni giro', '+{step}% every loop', '+{step}% cada vuelta', '+{step} % pro Durchgang', '+{step} % à chaque tour'],
    ['+{step}% ogni {n} giri', '+{step}% every {n} loops', '+{step}% cada {n} vueltas', '+{step} % alle {n} Durchgänge', '+{step} % tous les {n} tours'],
    ['▶ Avvia allenamento', '▶ Start training', '▶ Iniciar entrenamiento', '▶ Training starten', '▶ Démarrer l\'entraînement'],
    ['▶ Riprendi', '▶ Resume', '▶ Reanudar', '▶ Fortsetzen', '▶ Reprendre'],
    ['↺ Ricomincia', '↺ Restart', '↺ Reiniciar', '↺ Neu starten', '↺ Recommencer'],
    ['■ Ferma', '■ Stop', '■ Detener', '■ Stopp', '■ Arrêter'],
    ['🎉 Obiettivo raggiunto: {v}. Continua a ripetere o premi Ricomincia.', '🎉 Target reached: {v}. Keep repeating or press Restart.', '🎉 Objetivo alcanzado: {v}. Sigue repitiendo o pulsa Reiniciar.', '🎉 Ziel erreicht: {v}. Weiter wiederholen oder Neu starten drücken.', '🎉 Objectif atteint : {v}. Continuez ou appuyez sur Recommencer.'],
    ['Giro {n} · {v} · prossimo aumento tra 1 giro', 'Loop {n} · {v} · next increase in 1 loop', 'Vuelta {n} · {v} · próximo aumento en 1 vuelta', 'Durchgang {n} · {v} · nächste Steigerung in 1 Durchgang', 'Tour {n} · {v} · prochaine hausse dans 1 tour'],
    ['Giro {n} · {v} · prossimo aumento tra {left} giri', 'Loop {n} · {v} · next increase in {left} loops', 'Vuelta {n} · {v} · próximo aumento en {left} vueltas', 'Durchgang {n} · {v} · nächste Steigerung in {left} Durchgängen', 'Tour {n} · {v} · prochaine hausse dans {left} tours'],
    ['Prima seleziona sulla forma d\'onda il passaggio da studiare (o scegli una sezione salvata).', 'First select the passage to practice on the waveform (or pick a saved section).', 'Primero selecciona en la forma de onda el pasaje a estudiar (o elige una sección guardada).', 'Wähle zuerst in der Wellenform die Passage zum Üben (oder einen gespeicherten Abschnitt).', 'Sélectionnez d\'abord sur la forme d\'onde le passage à travailler (ou choisissez une section enregistrée).'],

    // ---------- suggerimenti al passaggio del mouse ----------
    ['Tasto: ', 'Key: ', 'Tecla: ', 'Taste: ', 'Touche : '],
    ['Riapri al volo i brani già usati', 'Quickly reopen tracks you used before', 'Vuelve a abrir al instante las canciones ya usadas', 'Bereits genutzte Songs schnell wieder öffnen', 'Rouvrir en un clic les morceaux déjà utilisés'],
    ['Scarica e apri il brano dal link incollato', 'Download and open the track from the pasted link', 'Descarga y abre la canción del enlace pegado', 'Song vom eingefügten Link laden und öffnen', 'Télécharger et ouvrir le morceau du lien collé'],
    ['Elenco di tutti i tasti rapidi', 'List of all keyboard shortcuts', 'Lista de todos los atajos de teclado', 'Liste aller Tastenkürzel', 'Liste de tous les raccourcis clavier'],
    ['Scegli la lingua', 'Choose the language', 'Elige el idioma', 'Sprache wählen', 'Choisir la langue'],
    ['Volume generale. Doppio clic: 100%', 'Master volume. Double-click: 100%', 'Volumen general. Doble clic: 100%', 'Gesamtlautstärke. Doppelklick: 100 %', 'Volume général. Double-clic : 100 %'],
    ['Bassi (sotto 250 Hz): basso e cassa. Giù del tutto = spenti. Doppio clic: zero', 'Bass (below 250 Hz): bass and kick. All the way down = off. Double-click: zero', 'Graves (bajo 250 Hz): bajo y bombo. Abajo del todo = apagados. Doble clic: cero', 'Bässe (unter 250 Hz): Bass und Bassdrum. Ganz unten = aus. Doppelklick: null', 'Graves (sous 250 Hz) : basse et grosse caisse. Tout en bas = coupés. Double-clic : zéro'],
    ['Medi (250–3000 Hz): voce, chitarre, piano. Giù del tutto = spenti. Doppio clic: zero', 'Mids (250–3000 Hz): vocals, guitars, piano. All the way down = off. Double-click: zero', 'Medios (250–3000 Hz): voz, guitarras, piano. Abajo del todo = apagados. Doble clic: cero', 'Mitten (250–3000 Hz): Gesang, Gitarren, Klavier. Ganz unten = aus. Doppelklick: null', 'Médiums (250–3000 Hz) : voix, guitares, piano. Tout en bas = coupés. Double-clic : zéro'],
    ['Alti (sopra 3000 Hz): piatti, brillantezza. Giù del tutto = spenti. Doppio clic: zero', 'Highs (above 3000 Hz): cymbals, brightness. All the way down = off. Double-click: zero', 'Agudos (sobre 3000 Hz): platillos, brillo. Abajo del todo = apagados. Doble clic: cero', 'Höhen (über 3000 Hz): Becken, Brillanz. Ganz unten = aus. Doppelklick: null', 'Aigus (au-dessus de 3000 Hz) : cymbales, brillance. Tout en bas = coupés. Double-clic : zéro'],
    ['Cosa ascoltare del brano: voce ridotta, solo centro, solo lati, solo bassi…', 'What to hear: reduced vocals, center only, sides only, bass only…', 'Qué escuchar: voz reducida, solo centro, solo laterales, solo graves…', 'Was du hörst: Gesang reduziert, nur Mitte, nur Seiten, nur Bässe…', 'Quoi écouter : voix réduite, centre seul, côtés seuls, graves seuls…'],
    ['Riduci lo zoom', 'Zoom out', 'Alejar', 'Herauszoomen', 'Dézoomer'],
    ['Ingrandisci la forma d\'onda', 'Zoom into the waveform', 'Ampliar la forma de onda', 'In die Wellenform zoomen', 'Agrandir la forme d\'onde'],
    ['BPM del brano: puoi scriverli a mano', 'Track BPM: you can type them in', 'BPM de la canción: puedes escribirlos a mano', 'Song-BPM: du kannst sie eintippen', 'BPM du morceau : vous pouvez les saisir'],
    ['Batti a tempo con la musica (almeno 4 volte) per registrare i BPM', 'Tap along with the music (at least 4 times) to set the BPM', 'Marca el pulso con la música (al menos 4 veces) para fijar los BPM', 'Im Takt der Musik tippen (mindestens 4-mal), um die BPM festzulegen', 'Tapez en rythme avec la musique (au moins 4 fois) pour définir les BPM'],
    ['Griglia dei beat: mostra/nascondi, aggancio, ÷2 ×2, beat 1', 'Beat grid: show/hide, snapping, ÷2 ×2, beat 1', 'Cuadrícula: mostrar/ocultar, ajuste, ÷2 ×2, pulso 1', 'Beat-Raster: ein/aus, Einrasten, ÷2 ×2, Schlag 1', 'Grille : afficher/masquer, aimantation, ÷2 ×2, temps 1'],
    ['G mostra/nasconde', 'G shows/hides', 'G muestra/oculta', 'G ein/aus', 'G affiche/masque'],
    ['Dimezza i BPM (griglia al doppio del tempo giusto)', 'Halve the BPM (grid at double the right tempo)', 'Divide los BPM a la mitad (cuadrícula al doble del tempo correcto)', 'BPM halbieren (Raster im doppelten Tempo)', 'Diviser les BPM par deux (grille au double du bon tempo)'],
    ['Raddoppia i BPM (griglia alla metà del tempo giusto)', 'Double the BPM (grid at half the right tempo)', 'Duplica los BPM (cuadrícula a la mitad del tempo correcto)', 'BPM verdoppeln (Raster im halben Tempo)', 'Doubler les BPM (grille à la moitié du bon tempo)'],
    ['La battuta inizia dove si trova ora la testina', 'The bar starts where the playhead is now', 'El compás empieza donde está ahora el cursor', 'Der Takt beginnt an der aktuellen Abspielposition', 'La mesure commence à la tête de lecture'],
    ['Play / pausa', 'Play / pause', 'Play / pausa', 'Play / Pause', 'Lecture / pause'],
    ['Ricomincia dall\'inizio del passaggio (o del brano)', 'Restart from the start of the passage (or track)', 'Reinicia desde el inicio del pasaje (o de la canción)', 'Neu starten ab Anfang der Passage (oder des Songs)', 'Recommencer au début du passage (ou du morceau)'],
    ['Stop: ferma e torna all\'inizio del passaggio', 'Stop: stop and go back to the start of the passage', 'Stop: detiene y vuelve al inicio del pasaje', 'Stopp: anhalten und zum Anfang der Passage', 'Stop : arrête et revient au début du passage'],
    ['Indietro: battuta precedente (con la griglia) oppure inizio di passaggio/sezione', 'Back: previous bar (with the grid) or start of passage/section', 'Atrás: compás anterior (con cuadrícula) o inicio de pasaje/sección', 'Zurück: vorheriger Takt (mit Raster) oder Anfang von Passage/Abschnitt', 'Arrière : mesure précédente (avec la grille) ou début du passage/de la section'],
    ['Avanti: battuta successiva (con la griglia) oppure fine di passaggio/sezione', 'Forward: next bar (with the grid) or end of passage/section', 'Adelante: compás siguiente (con cuadrícula) o final de pasaje/sección', 'Vor: nächster Takt (mit Raster) oder Ende von Passage/Abschnitt', 'Avant : mesure suivante (avec la grille) ou fin du passage/de la section'],
    ['Batti a tempo (almeno 4 volte) per registrare i BPM', 'Tap along (at least 4 times) to set the BPM', 'Marca el pulso (al menos 4 veces) para fijar los BPM', 'Im Takt tippen (mindestens 4-mal), um die BPM festzulegen', 'Tapez en rythme (au moins 4 fois) pour définir les BPM'],
    ['Inizio del passaggio dove si trova la testina', 'Passage start at the playhead', 'Inicio del pasaje donde está el cursor', 'Anfang der Passage an der Abspielposition', 'Début du passage à la tête de lecture'],
    ['Fine del passaggio dove si trova la testina', 'Passage end at the playhead', 'Final del pasaje donde está el cursor', 'Ende der Passage an der Abspielposition', 'Fin du passage à la tête de lecture'],
    ['Ripeti il passaggio selezionato', 'Repeat the selected passage', 'Repite el pasaje seleccionado', 'Gewählte Passage wiederholen', 'Répéter le passage sélectionné'],
    ['Più lento (5%)', 'Slower (5%)', 'Más lento (5%)', 'Langsamer (5 %)', 'Plus lent (5 %)'],
    ['Più veloce (5%)', 'Faster (5%)', 'Más rápido (5%)', 'Schneller (5 %)', 'Plus rapide (5 %)'],
    ['Velocità attuale', 'Current speed', 'Velocidad actual', 'Aktuelles Tempo', 'Vitesse actuelle'],
    ['Sposta l\'inizio indietro di un beat', 'Move the start back one beat', 'Mueve el inicio un pulso atrás', 'Anfang einen Schlag nach vorn', 'Reculer le début d\'un temps'],
    ['Sposta l\'inizio avanti di un beat', 'Move the start forward one beat', 'Mueve el inicio un pulso adelante', 'Anfang einen Schlag nach hinten', 'Avancer le début d\'un temps'],
    ['Sposta la fine indietro di un beat', 'Move the end back one beat', 'Mueve el final un pulso atrás', 'Ende einen Schlag nach vorn', 'Reculer la fin d\'un temps'],
    ['Sposta la fine avanti di un beat', 'Move the end forward one beat', 'Mueve el final un pulso adelante', 'Ende einen Schlag nach hinten', 'Avancer la fin d\'un temps'],
    ['Cancella la selezione', 'Clear the selection', 'Borra la selección', 'Auswahl löschen', 'Effacer la sélection'],
    ['Cosa fare prima di ogni ripetizione: niente, una pausa o il conteggio a tempo', 'What to do before each repeat: nothing, a pause or a count-in', 'Qué hacer antes de cada repetición: nada, una pausa o una cuenta previa', 'Was vor jeder Wiederholung passiert: nichts, eine Pause oder ein Einzähler', 'Que faire avant chaque répétition : rien, une pause ou un décompte'],
    ['Salva il passaggio come sezione (Intro, Assolo…)', 'Save the passage as a section (Intro, Solo…)', 'Guarda el pasaje como sección (Intro, Solo…)', 'Passage als Abschnitt speichern (Intro, Solo…)', 'Enregistrer le passage comme section (Intro, Solo…)'],
    ['Clic per richiamare una sezione, doppio clic per rinominarla', 'Click to recall a section, double-click to rename it', 'Clic para recuperar una sección, doble clic para renombrarla', 'Klick ruft einen Abschnitt auf, Doppelklick benennt ihn um', 'Clic pour rappeler une section, double-clic pour la renommer'],
    ['Tutto il brano: clic per spostarti, trascina il riquadro per scorrere. Le bande colorate sono le sezioni', 'Whole track: click to move, drag the box to scroll. The colored bands are the sections', 'Toda la canción: clic para moverte, arrastra el recuadro para desplazarte. Las bandas de colores son las secciones', 'Ganzer Song: Klick zum Springen, Rahmen ziehen zum Scrollen. Die farbigen Bänder sind die Abschnitte', 'Tout le morceau : cliquez pour vous déplacer, faites glisser le cadre pour défiler. Les bandes colorées sont les sections'],
    ['Velocità di riproduzione', 'Playback speed', 'Velocidad de reproducción', 'Wiedergabetempo', 'Vitesse de lecture'],
    ['Rallentando il brano non diventa più grave', 'Slowing down does not lower the pitch', 'Al ralentizar, la canción no se vuelve más grave', 'Beim Verlangsamen wird der Song nicht tiefer', 'En ralentissant, le morceau ne devient pas plus grave'],
    ['Avvia l\'allenamento: la velocità sale da sola a ogni ripetizione', 'Start training: the speed goes up by itself with every repeat', 'Inicia el entrenamiento: la velocidad sube sola en cada repetición', 'Training starten: das Tempo steigt mit jeder Wiederholung von selbst', 'Démarrer l\'entraînement : la vitesse augmente toute seule à chaque répétition'],
    ['Ctrl + rotella', 'Ctrl + wheel', 'Ctrl + rueda', 'Strg + Mausrad', 'Ctrl + molette'],
    ['0 = 100%', '0 = 100%', '0 = 100%', '0 = 100 %', '0 = 100 %'],
  ];

  // aiuto della tastiera sotto la pagina (contiene <kbd>, quindi è un blocco HTML intero)
  const HTML = {
    kbdHint: {
      en: 'Drag on the waveform to select the passage, drag its edges to adjust it, click to move. The colored bands at the bottom of the waveform and under the overview are the sections: one click recalls them. <kbd>Ctrl</kbd>+wheel (or pinch) to zoom, <kbd>Alt</kbd> while dragging to avoid snapping to beats.<br>Main keys: <kbd>Space</kbd> restart · <kbd>P</kbd> / <kbd>Enter</kbd> play/pause · <kbd>T</kbd> tap tempo · <kbd>←</kbd> <kbd>→</kbd> previous/next bar or section · <kbd>A</kbd> / <kbd>B</kbd> start/end · <kbd>?</kbd> full list of keys. Hover over a button to see what it does.',
      es: 'Arrastra sobre la forma de onda para seleccionar el pasaje, arrastra los bordes para ajustarlo, haz clic para moverte. Las bandas de colores al pie de la forma de onda y bajo la vista general son las secciones: un clic las recupera. <kbd>Ctrl</kbd>+rueda (o pellizco) para el zoom, <kbd>Alt</kbd> mientras arrastras para no ajustarte a los pulsos.<br>Teclas principales: <kbd>Espacio</kbd> reiniciar · <kbd>P</kbd> / <kbd>Intro</kbd> play/pausa · <kbd>T</kbd> tap · <kbd>←</kbd> <kbd>→</kbd> compás o sección anterior/siguiente · <kbd>A</kbd> / <kbd>B</kbd> inicio/final · <kbd>?</kbd> lista completa de teclas. Pasa el ratón por un botón para ver para qué sirve.',
      de: 'In der Wellenform ziehen, um die Passage auszuwählen, Ränder ziehen zum Anpassen, klicken zum Springen. Die farbigen Bänder unten in der Wellenform und unter der Übersicht sind die Abschnitte: ein Klick ruft sie auf. <kbd>Strg</kbd>+Mausrad (oder Zwei-Finger-Geste) zum Zoomen, <kbd>Alt</kbd> beim Ziehen, um nicht am Beat einzurasten.<br>Wichtige Tasten: <kbd>Leertaste</kbd> neu starten · <kbd>P</kbd> / <kbd>Enter</kbd> Play/Pause · <kbd>T</kbd> Tap · <kbd>←</kbd> <kbd>→</kbd> vorheriger/nächster Takt oder Abschnitt · <kbd>A</kbd> / <kbd>B</kbd> Anfang/Ende · <kbd>?</kbd> alle Tasten. Fahre mit der Maus über eine Taste, um zu sehen, was sie tut.',
      fr: 'Faites glisser sur la forme d\'onde pour sélectionner le passage, faites glisser ses bords pour l\'ajuster, cliquez pour vous déplacer. Les bandes colorées en bas de la forme d\'onde et sous la vue d\'ensemble sont les sections : un clic les rappelle. <kbd>Ctrl</kbd>+molette (ou pincement) pour zoomer, <kbd>Alt</kbd> en faisant glisser pour éviter l\'aimantation aux temps.<br>Touches principales : <kbd>Espace</kbd> recommencer · <kbd>P</kbd> / <kbd>Entrée</kbd> lecture/pause · <kbd>T</kbd> tap · <kbd>←</kbd> <kbd>→</kbd> mesure ou section précédente/suivante · <kbd>A</kbd> / <kbd>B</kbd> début/fin · <kbd>?</kbd> liste complète des touches. Survolez un bouton pour savoir à quoi il sert.',
    },
  };

  // ---------- dizionari ----------
  const IT_KEYS = new Set(ROWS.map(r => r[0]));
  const DICT = {};
  COLS.forEach((c, ci) => { DICT[c] = new Map(ROWS.map(r => [r[0], r[ci] != null ? r[ci] : r[0]])); });

  const pick = () => {
    const saved = L.store.get('lang', null);
    if (saved && COLS.includes(saved)) return saved;
    for (const l of navigator.languages || [navigator.language || 'en']) {
      const c = String(l).slice(0, 2).toLowerCase();
      if (COLS.includes(c)) return c;
    }
    return 'en';
  };
  L.lang = pick();
  L.LANGS = LANGS;

  /** traduce un testo italiano nella lingua corrente; {nome} viene sostituito da vars.nome */
  L.t = (s, vars) => {
    let out = L.lang === 'it' ? s : (DICT[L.lang].get(s) ?? s);
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  };

  // ---------- testi fissi della pagina ----------
  const SKIP = '#chips, #recentList, #filename, script, style, textarea';
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const trWs = v => {             // conserva gli spazi attorno al testo
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(v);
    return m[1] + L.t(m[2]) + m[3];
  };
  function applyStatic(root = document.body) {
    document.documentElement.lang = L.lang;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest(SKIP) || p.closest('[data-i18n-html]')) continue;
      if (n.__it === undefined) {
        if (!IT_KEYS.has(n.nodeValue.trim())) continue;
        n.__it = n.nodeValue;
      }
      n.nodeValue = trWs(n.__it);
    }
    root.querySelectorAll('*').forEach(el => {
      if (el.closest(SKIP)) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v == null) continue;
        el.__itAttr = el.__itAttr || {};
        if (el.__itAttr[a] === undefined) {
          if (!IT_KEYS.has(v.trim())) continue;
          el.__itAttr[a] = v;
        }
        el.setAttribute(a, trWs(el.__itAttr[a]));
      }
    });
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      if (el.__itHTML === undefined) el.__itHTML = el.innerHTML;
      const tr = HTML[el.dataset.i18nHtml];
      el.innerHTML = (L.lang !== 'it' && tr && tr[L.lang]) || el.__itHTML;
    });
  }
  L.applyStatic = applyStatic;

  /** cambia lingua, la ricorda e aggiorna tutta la pagina */
  L.setLang = code => {
    if (!COLS.includes(code) || code === L.lang) return;
    L.lang = code;
    L.store.set('lang', code);
    applyStatic();
    const s = document.getElementById('langSel');
    if (s) s.value = code;
    document.dispatchEvent(new CustomEvent('looper-lang'));
  };

  // menu lingua nella testata
  const sel = document.getElementById('langSel');
  if (sel) {
    for (const [c, name] of LANGS) {
      const o = document.createElement('option');
      o.value = c; o.textContent = c.toUpperCase(); o.title = name;
      sel.append(o);
    }
    sel.value = L.lang;
    sel.addEventListener('change', () => { L.setLang(sel.value); sel.blur(); });
  }
  applyStatic();
})(window.Looper);
