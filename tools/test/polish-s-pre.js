// prepara il tasto S "vero" (inviato da DevTools): passaggio presente, nessun elemento con il focus
(() => { Looper.wave.hooks.setRegion(12.5, 14.5); if (document.activeElement) document.activeElement.blur(); return 'pronto per S'; })();
