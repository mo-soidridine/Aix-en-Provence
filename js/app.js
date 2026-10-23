(() => {
  'use strict';

  // ---- Sémiologie (identique à la carte statique) ----
  const COLORS = ['#1a9641', '#a6d96a', '#ffffbf', '#fdae61', '#d7191c'];
  const LABELS = ['0-5 min', '5-10 min', '10-15 min', '15-20 min', '> 20 min'];
  const BG = '#424245';
  const fmt = (x, d = 1) => x.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const $ = (s) => document.querySelector(s);

  const CARTO = (v) => [`a`, `b`, `c`, `d`].map(s => `https://${s}.basemaps.cartocdn.com/${v}/{z}/{x}/{y}@2x.png`);
  const style = {
    version: 8,
    sources: {
      dark:   { type: 'raster', tiles: CARTO('dark_nolabels'),  tileSize: 256, maxzoom: 20, attribution: '' },
      light:  { type: 'raster', tiles: CARTO('light_nolabels'), tileSize: 256, maxzoom: 20 },
      sat:    { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19 },
      labelsD:{ type: 'raster', tiles: CARTO('dark_only_labels'),  tileSize: 256, maxzoom: 20 },
      labelsL:{ type: 'raster', tiles: CARTO('light_only_labels'), tileSize: 256, maxzoom: 20 },
      bat:    { type: 'geojson', data: 'data/batiments.geojson', tolerance: 0.4, buffer: 32, maxzoom: 16 },
      arrets: { type: 'geojson', data: 'data/arrets.geojson' },
      lim:    { type: 'geojson', data: 'data/limites.geojson' },
      sel:    { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': BG } },
      // Fond sombre : plancher relevé pour retrouver le gris #424245 de la carte statique
      { id: 'dark', type: 'raster', source: 'dark',
        paint: { 'raster-brightness-min': 0.255, 'raster-brightness-max': 0.8, 'raster-contrast': 0.05, 'raster-fade-duration': 0 } },
      { id: 'light', type: 'raster', source: 'light', layout: { visibility: 'none' } },
      { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: 'none' }, paint: { 'raster-brightness-max': 0.85 } },
      // Bâtiments : une couche par classe, les moins bien desservis dessinés au-dessus
      ...COLORS.map((col, k) => ({
        id: 'bat' + k, type: 'fill', source: 'bat', filter: ['==', ['get', 'c'], k],
        paint: { 'fill-color': col, 'fill-outline-color': col, 'fill-antialias': true }
      })),
      { id: 'bat-hover', type: 'line', source: 'bat', filter: ['==', ['get', 'c'], -1],
        paint: { 'line-color': '#fff', 'line-width': 2 } },
      { id: 'lim', type: 'line', source: 'lim', paint: { 'line-color': '#1c1c1e', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 14, 2.4] } },
      { id: 'arrets', type: 'circle', source: 'arrets', paint: {
          'circle-color': '#000',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1, 11, 1.6, 12, 2.4, 14, 4, 17, 7],
          'circle-stroke-color': 'rgba(255,255,255,.55)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 0, 16, 1.2] } },
      { id: 'sel-ring', type: 'circle', source: 'sel', paint: {
          'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2.5 } },
      { id: 'labelsD', type: 'raster', source: 'labelsD', layout: { visibility: 'none' } },
      { id: 'labelsL', type: 'raster', source: 'labelsL', layout: { visibility: 'none' } }
    ]
  };

  const mobile = () => matchMedia('(max-width:760px)').matches;
  const map = new maplibregl.Map({
    container: 'map', style, center: [5.45, 43.52], zoom: 11.2, minZoom: 8, maxZoom: 19,
    dragRotate: false, pitchWithRotate: false, touchPitch: false, attributionControl: false,
    fadeDuration: 0
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 160 }), 'bottom-left');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  // ---- Stats : légende, barre empilée, tableau méthodologie ----
  fetch('data/stats.json').then(r => r.json()).then(st => {
    const ul = $('#legend-classes');
    st.classes.forEach((c, k) => {
      const li = document.createElement('li');
      li.innerHTML = `<label><input type="checkbox" data-k="${k}" checked>
        <span class="sw" style="background:${COLORS[k]}"></span>
        <span class="lg-label">${LABELS[k]}</span>
        <span class="pct" title="${c.n.toLocaleString('fr-FR')} bâtiments">${fmt(c.pct)} %</span></label>`;
      ul.appendChild(li);
    });
    ul.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      map.setLayoutProperty('bat' + k, 'visibility', e.target.checked ? 'visible' : 'none');
    });

    $('#statbar').innerHTML = st.classes.map((c, k) =>
      `<i style="width:${c.pct}%;background:${COLORS[k]}" title="${LABELS[k]} : ${fmt(c.pct)} %"></i>`).join('');
    const near = st.classes[0], far = st.classes[3].pct + st.classes[4].pct;
    $('#keytext').innerHTML = `<b>${fmt(near.pct)} %</b> des ${st.n_batiments.toLocaleString('fr-FR')} bâtiments sont à moins de 5&nbsp;min à pied d'un arrêt ; ` +
      `<b>${fmt(far)} %</b> en sont à plus de 15&nbsp;min. Temps médian&nbsp;: <b>${fmt(st.mediane_min)} min</b>.`;
    $('#keyfig').hidden = false;

    $('#m-nstops').textContent = st.n_arrets.toLocaleString('fr-FR');
    $('#m-nbat').textContent = st.n_batiments.toLocaleString('fr-FR');
    $('#m-med').textContent = fmt(st.mediane_min);
    $('#m-mean').textContent = fmt(st.moyenne_min);
    $('#m-table tbody').innerHTML = st.classes.map((c, k) =>
      `<tr><td><span class="dot" style="background:${COLORS[k]}"></span>${LABELS[k]}</td>
       <td>${c.n.toLocaleString('fr-FR')}</td><td>${fmt(c.pct)} %</td><td>${fmt(c.pct_surface)} %</td></tr>`).join('');
  }).catch(console.error);

  // ---- Cadrage initial sur la commune ----
  fetch('data/limites.geojson').then(r => r.json()).then(g => {
    let [x0, y0, x1, y1] = [180, 90, -180, -90];
    const walk = (a) => typeof a[0] === 'number'
      ? (x0 = Math.min(x0, a[0]), x1 = Math.max(x1, a[0]), y0 = Math.min(y0, a[1]), y1 = Math.max(y1, a[1]))
      : a.forEach(walk);
    g.features.forEach(f => walk(f.geometry.coordinates));
    window.__bounds = [[x0, y0], [x1, y1]];
    map.fitBounds(window.__bounds, { padding: mobile() ? { top: 130, bottom: 110, left: 10, right: 10 } : { top: 30, bottom: 50, left: 420, right: 40 }, duration: 0 });
  });

  // ---- Interactions ----
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', offset: 6 });
  const hoverPop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
  const batLayers = COLORS.map((_, k) => 'bat' + k);
  let stopsData = null;
  fetch('data/arrets.geojson').then(r => r.json()).then(g => stopsData = g.features);

  map.on('click', (e) => {
    const sf = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers: ['arrets'] })[0];
    if (sf) { const p = sf.properties;
      popup.setLngLat(sf.geometry.coordinates).setHTML(`<div class="pop-t">🚏 ${esc(p.n)}</div><div class="pop-s">${esc(p.v || '')}</div>`).addTo(map); return; }
    const f = map.queryRenderedFeatures(e.point, { layers: batLayers })[0];
    if (!f) { popup.remove(); clearSel(); return; }
    const p = f.properties, stop = stopsData && stopsData[p.a];
    const mins = Number(p.t), min = Math.floor(mins), sec = Math.round((mins - min) * 60);
    popup.setLngLat(e.lngLat).setHTML(
      `<div class="pop-t"><i style="background:${COLORS[p.c]}"></i>${fmt(mins)} min</div>
       <div class="pop-s">${LABELS[p.c]} · ${p.d} m à vol d'oiseau</div>` +
      (stop ? `<div class="pop-stop">Arrêt le plus proche<br><b>${esc(stop.properties.n)}</b> <span class="pop-s">${esc(stop.properties.v || '')}</span></div>` : '')
    ).addTo(map);
    map.setFilter('bat-hover', ['all', ['==', ['get', 'a'], p.a], ['==', ['get', 'd'], p.d], ['==', ['get', 't'], p.t]]);
    if (stop) map.getSource('sel').setData({ type: 'FeatureCollection', features: [stop] });
  });
  popup.on('close', clearSel);
  function clearSel() {
    map.setFilter('bat-hover', ['==', ['get', 'c'], -1]);
    map.getSource('sel').setData({ type: 'FeatureCollection', features: [] });
  }
  map.on('mousemove', (e) => {
    const s = map.queryRenderedFeatures([[e.point.x - 5, e.point.y - 5], [e.point.x + 5, e.point.y + 5]], { layers: ['arrets'] })[0];
    const b = !s && map.queryRenderedFeatures(e.point, { layers: batLayers }).length;
    map.getCanvas().style.cursor = (s || b) ? 'pointer' : '';
    if (s) hoverPop.setLngLat(s.geometry.coordinates).setHTML(`<b>${esc(s.properties.n)}</b>`).addTo(map); else hoverPop.remove();
  });
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---- Arrêts, fonds, toponymes ----
  $('#chk-stops').addEventListener('change', (e) => {
    map.setLayoutProperty('arrets', 'visibility', e.target.checked ? 'visible' : 'none');
    if (!e.target.checked) hoverPop.remove();
  });
  let base = 'dark';
  const applyBase = () => {
    ['dark', 'light', 'sat'].forEach(b => map.setLayoutProperty(b, 'visibility', b === base ? 'visible' : 'none'));
    const on = $('#chk-labels').checked;
    map.setLayoutProperty('labelsD', 'visibility', on && base !== 'light' ? 'visible' : 'none');
    map.setLayoutProperty('labelsL', 'visibility', on && base === 'light' ? 'visible' : 'none');
    // le contour de la commune reste lisible sur fond clair/satellite
    map.setPaintProperty('lim', 'line-color', base === 'dark' ? '#1c1c1e' : '#222');
  };
  document.querySelectorAll('[data-base]').forEach(b => b.addEventListener('click', () => {
    base = b.dataset.base;
    document.querySelectorAll('[data-base]').forEach(x => x.classList.toggle('on', x === b));
    applyBase();
  }));
  $('#chk-labels').addEventListener('change', applyBase);

  // ---- Méthodologie ----
  const drawer = $('#drawer');
  const setDrawer = (open) => {
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    $('#btn-method').setAttribute('aria-expanded', String(open));
    if (open) drawer.focus(); else $('#btn-method').focus({ preventScroll: true });
    history.replaceState(null, '', open ? '#methodologie' : location.pathname + location.search);
  };
  $('#btn-method').addEventListener('click', () => setDrawer(!drawer.classList.contains('open')));
  $('#drawer-close').addEventListener('click', () => setDrawer(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawer(false); });
  if (location.hash === '#methodologie') setDrawer(true);

  // ---- Panneau mobile ----
  const panel = $('#panel'), tgl = $('#panel-toggle');
  if (mobile()) { panel.classList.add('collapsed'); tgl.setAttribute('aria-expanded', 'false'); }
  tgl.addEventListener('click', () => {
    const c = panel.classList.toggle('collapsed'); tgl.setAttribute('aria-expanded', String(!c));
  });

  // ---- Fin du chargement ----
  map.once('idle', () => $('#loader').classList.add('done'));
  setTimeout(() => $('#loader').classList.add('done'), 15000);
  window.__map = map;
})();
