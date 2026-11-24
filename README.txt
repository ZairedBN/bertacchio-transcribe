BERTACCHIO TRANSCRIBE - practice songs with your instrument
==========================================================

Load a track, pick a passage, loop it and slow it down (without changing
the pitch) until you can play it.


1. WHERE IT WORKS
-----------------
- ANYWHERE, NOTHING TO INSTALL: open the online version with Chrome, Edge or
  Safari (computer, Android, Mac). A link or QR code is all you need, no sign-up.
  Everything works except "Load link": tracks are opened from the device's files.
  Online version: https://zairedbn.github.io/bertacchio-transcribe/
  You can install it as an app: on Android, browser menu > "Add to Home screen";
  on a computer with Chrome/Edge, the "Install" icon in the address bar.
  After the first visit it also works offline.
- WINDOWS WITH LINKS (this folder, optional): only needed to load tracks from a
  link (YouTube, SoundCloud, Bandcamp...). Requires Chrome or Edge.
- LANGUAGE: Italian, English, Spanish, German and French. The app follows the
  browser language; you can change it from the menu at the top right.


2. FIRST START ON WINDOWS (links only)
--------------------------------------
1) Extract the zip: right-click the .zip file > "Extract All..."
   (e.g. to the Desktop). Do NOT run it from inside the zip.
2) Open the "Bertacchio Transcribe" folder and double-click  avvia-looper.bat
3) A black window opens, then the browser with the app.
   Keep the black window open while you use the app; close it to quit.

If Windows shows "Windows protected your PC":
   click "More info" > "Run anyway".
If the browser does not open by itself, go to:  http://localhost:8765


3. BASICS
---------
- LOADING A TRACK: "Open file..." or drop an audio file on the page.
  "Recent" reopens tracks you used before.
- CHOOSING THE PASSAGE: drag on the waveform; the highlighted area is the loop.
  Drag its edges to adjust it, or use the - and + buttons next to start and end
  (one beat at a time). The overview under the waveform shows the whole track.
  The mouse wheel on the waveform zooms; Shift + wheel scrolls.
  If you get a selection wrong, the  ↶  button (or Ctrl+Z) brings it back.
- LOOP AND SPEED: press Play and the passage repeats by itself. Play starts where
  you clicked on the waveform; Stop goes back to the start of the passage.
  "Keep pitch" stops the track from getting lower when you slow it down.
- MIXER: Volume, Bass (below 250 Hz), Mids (250-3000 Hz) and Highs (above
  3000 Hz). Pull a fader all the way down to switch that band OFF. Boosting does
  not distort: the app lowers the rest and a limiter prevents clipping.
  Double-click (or double-tap) a fader to reset it.
- LISTEN TO: reduced vocals (karaoke), center only, sides only (these three need
  a stereo track), bass only / no bass, left / right channel only.


4. TEMPO (BPM) AND BEAT GRID
----------------------------
The app detects the BPM and, for tracks in steady tempo, draws a beat grid; the
selection snaps to beats (hold Alt to avoid it). For unsteady tempo (jazz,
rubato, live) the grid starts hidden: turn it on from "Grid".
If the BPM is wrong, press "Tap" along with the music (at least 4 times), use
/2 or x2 in the "Grid" menu, or type it in.


5. PRACTICE TOOLS
-----------------
- BEFORE RESTARTING: choose a 1- or 2-bar count-in; with "also on the first Play"
  the track stays still during the clicks and starts right after.
- SECTIONS: select a passage and press "+ Save section". Each section has its own
  color, shown as a card and as a band at the bottom of the waveform: click (or
  tap) it, or press 1-9, to recall it. The Loop button takes the section color.
  If you adjust the edges of a section, "Update" appears: it saves the new edges
  in the section. A section also remembers the last speed you used. To rename it:
  double-click its name, or use the pencil on the section you are playing.
- SPEED TRAINER: choose start (e.g. 70%) and target (100%), the increase rate and
  press "Start training": the speed goes up by itself with every repeat.
- PITCH: transpose by semitones (e.g. for a capo) and fine tuning.


6. ON PHONES AND TABLETS
------------------------
- One finger on the waveform to select, two fingers to zoom.
- The bottom bar replaces the keyboard:
    row 1:  |<< restart   << back   Play   >> forward   A   B
    row 2:  Loop   - speed +   Tap   Stop
- Press and hold a button to see what it does.


7. KEYBOARD SHORTCUTS (computer)
--------------------------------
Press  ?  (or the "Keys" button at the top) for the full list in the app.

  Space ............. restart the passage (or track) and play
  P / Enter ......... play / pause
  L ................. loop on / off
  + / - ............. speed up / down      0 ... normal speed (100%)
  left / right ...... with the grid: previous / next bar
                      without the grid: start or end of passage and sections
  Shift + arrows .... back / forward 2 seconds
  Home / End ........ start / end of the track
  A / B ............. set passage start / end at the playhead
                      (with the grid: on the nearest beat)
  Del ............... clear the selection
  Ctrl+Z / Ctrl+Y ... undo / redo the last change to the passage
  S ................. save the passage as a section
  1 - 9 ............. recall a saved section
  T ................. tap tempo
  G ................. show / hide the grid
  Z ................. zoom to the passage / whole track
  wheel ............. zoom the waveform   (Shift + wheel: scroll)
  PgDn / down ....... play / pause   (Bluetooth pedals)
  PgUp / up ......... restart the passage


8. TROUBLESHOOTING (Windows version)
------------------------------------
- A link does not load: YouTube changes often; update the downloader by opening
  a Command Prompt in the folder and typing:   bin\yt-dlp.exe -U
- "Server not reachable": you closed the black window. Run avvia-looper.bat again.
- Your antivirus flags bin\yt-dlp.exe: it is a widely used open source program
  (github.com/yt-dlp/yt-dlp), sometimes flagged by mistake.

Recent tracks, sections and BPM are saved in the browser of the device
(up to 40 tracks).

Note: downloading audio from YouTube is against its terms of service;
use the app for personal practice.
