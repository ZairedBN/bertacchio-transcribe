(async () => {
  const $ = id => document.getElementById(id);
  return 'offline: pagina ' + (typeof Looper !== 'undefined' && !!Looper.app) + ', titolo "' + document.title + '", campo link visibile ' + !$('linkRow').hidden +
    ', recenti ' + (await Looper.db.list()).length;
})()
