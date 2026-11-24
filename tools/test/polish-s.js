// dopo il tasto S vero: la finestra è aperta e la «s» non è finita nel nome
(() => {
  const $ = id => document.getElementById(id);
  const out = 'tasto S vero: finestra ' + $('askDlg').open + ' valore "' + $('askIn').value + '" (atteso "Sezione 3", senza s in più)';
  return out;
})();
