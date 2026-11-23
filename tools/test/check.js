(() => {
  const de = document.documentElement, r = [];
  r.push('overflowX ' + (de.scrollWidth > de.clientWidth) + ' scrollH ' + de.scrollHeight + '/' + innerHeight);
  const side = document.querySelector('.side').getBoundingClientRect(), main = document.querySelector('.main-col').getBoundingClientRect();
  r.push('main ' + Math.round(main.left) + '-' + Math.round(main.right) + ' side ' + Math.round(side.left) + '-' + Math.round(side.right) + ' top ' + Math.round(side.top));
  const v = document.getElementById('eqLow').getBoundingClientRect();
  r.push('fader ' + Math.round(v.width) + 'x' + Math.round(v.height));
  r.push('grid ' + JSON.stringify(Looper.state.grid) + ' show ' + Looper.state.gridShow + ' note ' + document.getElementById('bpmNote').textContent);
  return r.join('\n');
})()
