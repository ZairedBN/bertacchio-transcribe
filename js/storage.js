/* Looper — brani recenti salvati nel browser (IndexedDB), su tutte le piattaforme */
(L => {
  'use strict';

  const DB_NAME = 'looper', STORE = 'songs', MAX_SONGS = 40;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error(L.t('Archivio del browser non disponibile'))); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error(L.t('Archivio del browser non disponibile')));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      let result;
      Promise.resolve(fn(st, r => { result = r; })).catch(reject);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error(L.t('Salvataggio non riuscito (spazio esaurito?)')));
    });
  }

  const reqResult = (req, set) => { req.onsuccess = () => set(req.result); };

  L.db = {
    /** song: {key, title, source, size, type, blob, serverFile?} */
    async put(song) {
      song = { ...song, lastUsed: Date.now() };
      await tx('readwrite', st => st.put(song));
      await L.db.prune();
    },

    async get(key) {
      return tx('readonly', (st, set) => reqResult(st.get(key), set));
    },

    /** elenco senza i dati audio, dal più recente */
    async list() {
      const all = await tx('readonly', (st, set) => reqResult(st.getAll(), set)) || [];
      return all
        .map(({ blob, ...meta }) => ({ ...meta, size: meta.size || (blob && blob.size) || 0 }))
        .sort((a, b) => b.lastUsed - a.lastUsed);
    },

    async touch(key) {
      const s = await L.db.get(key);
      if (s) { s.lastUsed = Date.now(); await tx('readwrite', st => st.put(s)); }
    },

    async remove(key) {
      await tx('readwrite', st => st.delete(key));
    },

    // tiene solo gli ultimi MAX_SONGS brani
    async prune() {
      const list = await L.db.list();
      for (const s of list.slice(MAX_SONGS)) await L.db.remove(s.key);
    },
  };

  // chiede al browser di non cancellare i dati quando lo spazio scarseggia
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // Windows: importa una sola volta i recenti salvati dal server nelle versioni precedenti
  L.importServerRecents = async () => {
    if (!L.hasServer || L.store.get('importedServerRecents', false)) return;
    try {
      const items = (await L.api('/api/recent')).items || [];
      for (const it of items.slice(0, MAX_SONGS).reverse()) {
        const isLink = /^https?:/i.test(it.source || '');
        const key = isLink ? it.file : 'local:' + it.title + ':' + it.size;
        if (await L.db.get(key)) continue;
        const r = await fetch('/media/' + encodeURIComponent(it.file));
        if (!r.ok) continue;
        const blob = await r.blob();
        await L.db.put({ key, title: it.title, source: isLink ? it.source : 'File dal PC', size: blob.size, type: blob.type, blob, serverFile: it.file });
      }
      L.store.set('importedServerRecents', true);
    } catch (e) {
      console.warn('Import dei recenti dal server non riuscito', e);
    }
  };
})(window.Looper);
