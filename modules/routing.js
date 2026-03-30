// ============================================
// BAUSITE Geo — Routing Module
// Routing, Sperrungsverwaltung, Umfahrungsplanung
// Vanilla JS — MapLibre GL JS
// ============================================

const RoutingModule = (function () {
  'use strict';

  // ── Konstanten ──

  const COLORS = {
    navy:    '#1B2A4A',
    orange:  '#E8833A',
    blue:    '#2E86AB',
    success: '#22C55E',
    warning: '#F59E0B',
    danger:  '#EF4444',
    violet:  '#8B5CF6',
    white:   '#FFFFFF',
  };

  const VEHICLE_TYPES = [
    { id: 'pkw',       label: 'PKW' },
    { id: 'lkw',       label: 'LKW' },
    { id: 'lkw_heavy', label: 'LKW Schwer' },
    { id: 'blaulicht', label: 'Blaulicht' },
  ];

  const CLOSURE_TYPES = [
    { id: 'full',              label: 'Vollsperrung' },
    { id: 'partial_lsa',       label: 'Teilsperrung LSA' },
    { id: 'partial_priority',  label: 'Teilsperrung Vortritt' },
    { id: 'night_only',        label: 'Nachtsperrung' },
  ];

  const WIDTH_COLORS = [
    { min: 6,   color: COLORS.success },
    { min: 3.5, color: COLORS.warning },
    { min: 3,   color: COLORS.orange },
    { min: 0,   color: COLORS.danger },
  ];

  const LAYER_IDS = [
    'route-main', 'route-alt-1', 'route-alt-2',
    'closures-full', 'closures-partial', 'closures-active', 'streets-width',
    'materialplatz-fill', 'materialplatz-outline',
    'route-start-marker', 'route-end-marker',
  ];

  const SOURCE_IDS = [
    'route-main-src', 'route-alt-1-src', 'route-alt-2-src',
    'closures-full-src', 'closures-partial-src', 'closures-active-src', 'streets-width-src',
    'materialplatz-src', 'route-markers-src',
  ];

  // ── State ──

  let mode = 'none'; // 'route' | 'closure' | 'materialplatz' | 'none'
  let clickPoints = [];
  let clickMarkers = [];
  let closureVertices = [];
  let closureMarkers = [];
  let bannerEl = null;
  let infoBoxEl = null;
  let comparisonEl = null;
  let mapClickHandler = null;
  let mapDblClickHandler = null;
  let streetWidthsVisible = false;
  let closuresVisible = false;
  let closuresData = null;
  let widthLegendEl = null;
  let widthHoverPopup = null;
  let selectedVehicle = 'pkw';
  let activePopups = [];

  // ── Hilfsfunktionen ──

  function _formatNumber(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  function _formatDuration(seconds) {
    if (seconds < 60) return Math.round(seconds) + ' Sek.';
    const min = Math.floor(seconds / 60);
    const sec = Math.round(seconds % 60);
    if (min < 60) return min + ' Min.' + (sec > 0 ? ' ' + sec + ' Sek.' : '');
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ' Std.' + (m > 0 ? ' ' + m + ' Min.' : '');
  }

  function _apiBase() {
    return (typeof API_BASE !== 'undefined' && API_BASE !== null) ? API_BASE : window.location.origin + '/api';
  }

  function _isStatic() {
    return typeof STATIC_MODE !== 'undefined' && STATIC_MODE;
  }

  function _emptyGeoJSON() {
    return { type: 'FeatureCollection', features: [] };
  }

  function _lineFeature(coords, props) {
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: props || {},
    };
  }

  // ── Banner (Modus-Indikator oben auf der Karte) ──

  function _showBanner(title, hint) {
    _hideBanner();
    const container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    bannerEl = document.createElement('div');
    bannerEl.className = 'drawing-banner';
    bannerEl.innerHTML = `
      <span>${title}</span>
      <span class="banner-hint">${hint}</span>
      <button class="banner-cancel" onclick="RoutingModule.cleanup()">Abbrechen</button>
    `;
    container.appendChild(bannerEl);
  }

  function _hideBanner() {
    if (bannerEl && bannerEl.parentElement) {
      bannerEl.parentElement.removeChild(bannerEl);
    }
    bannerEl = null;
  }

  // ── Info-Box (unten rechts) ──

  function _showInfoBox(html) {
    _hideInfoBox();
    const container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    infoBoxEl = document.createElement('div');
    infoBoxEl.style.cssText =
      'position:absolute;bottom:40px;right:12px;background:var(--navy,#1B2A4A);color:#fff;' +
      'border-radius:10px;padding:14px 18px;min-width:220px;max-width:320px;z-index:900;' +
      'font-size:13px;line-height:1.5;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
    infoBoxEl.innerHTML = html;
    container.appendChild(infoBoxEl);
  }

  function _hideInfoBox() {
    if (infoBoxEl && infoBoxEl.parentElement) {
      infoBoxEl.parentElement.removeChild(infoBoxEl);
    }
    infoBoxEl = null;
  }

  // ── Vergleichstabelle (Overlay) ──

  function _showComparison(routes) {
    _hideComparison();
    const container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    comparisonEl = document.createElement('div');
    comparisonEl.style.cssText =
      'position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:#fff;' +
      'border-radius:10px;padding:16px 20px;z-index:900;font-size:12px;' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.25);min-width:380px;';

    const colors = [COLORS.success, COLORS.blue, COLORS.violet];
    const labels = ['Beste Route', 'Alternative 1', 'Alternative 2'];
    let rows = routes.map(function (r, i) {
      const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colors[i]};margin-right:6px;"></span>`;
      return `<tr>
        <td style="padding:4px 10px;">${dot}${labels[i]}</td>
        <td style="padding:4px 10px;text-align:right;">${_formatNumber(r.distance_m)} m</td>
        <td style="padding:4px 10px;text-align:right;">${_formatDuration(r.duration_s)}</td>
        <td style="padding:4px 10px;text-align:right;">${r.road_types || '—'}</td>
      </tr>`;
    }).join('');

    comparisonEl.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:${COLORS.navy};">Routenvergleich</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:2px solid #eee;">
          <th style="text-align:left;padding:4px 10px;">Route</th>
          <th style="text-align:right;padding:4px 10px;">Distanz</th>
          <th style="text-align:right;padding:4px 10px;">Fahrzeit</th>
          <th style="text-align:right;padding:4px 10px;">Strassentypen</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <button onclick="RoutingModule.cleanup()" style="margin-top:10px;padding:5px 14px;border:none;border-radius:6px;background:${COLORS.navy};color:#fff;cursor:pointer;font-size:12px;">Schliessen</button>
    `;
    container.appendChild(comparisonEl);
  }

  function _hideComparison() {
    if (comparisonEl && comparisonEl.parentElement) {
      comparisonEl.parentElement.removeChild(comparisonEl);
    }
    comparisonEl = null;
  }

  // ── MapLibre Quellen & Layer ──

  function _ensureSource(id, data) {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: data || _emptyGeoJSON() });
    } else {
      map.getSource(id).setData(data || _emptyGeoJSON());
    }
  }

  function _ensureLineLayer(layerId, sourceId, color, width, dasharray) {
    if (map.getLayer(layerId)) return;
    const paint = { 'line-color': color, 'line-width': width, 'line-opacity': 0.85 };
    if (dasharray) paint['line-dasharray'] = dasharray;
    map.addLayer({ id: layerId, type: 'line', source: sourceId, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: paint });
  }

  function _ensureMarkerLayer(layerId, sourceId, textField, textColor, circleColor, circleRadius) {
    if (map.getLayer(layerId)) return;
    map.addLayer({
      id: layerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': textField,
        'text-size': 14,
        'text-font': ['Open Sans Bold'],
        'text-allow-overlap': true,
        'icon-allow-overlap': true,
      },
      paint: {
        'text-color': textColor,
        'text-halo-color': circleColor,
        'text-halo-width': 10,
      },
    });
  }

  function _removeLayer(id) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  function _removeSource(id) {
    if (map.getSource(id)) map.removeSource(id);
  }

  function _clearRouteLayers() {
    ['route-main', 'route-alt-1', 'route-alt-2', 'route-start-marker', 'route-end-marker'].forEach(_removeLayer);
    ['route-main-src', 'route-alt-1-src', 'route-alt-2-src', 'route-markers-src'].forEach(_removeSource);
  }

  function _clearClosureLayers() {
    _removeLayer('closures-full');
    _removeLayer('closures-partial');
    _removeLayer('closures-active');
    _removeSource('closures-full-src');
    _removeSource('closures-partial-src');
    _removeSource('closures-active-src');
    closuresVisible = false;
    closuresData = null;
    map._routingClosureClick = null;
    var btn = document.getElementById('btn-closures-toggle');
    if (btn) btn.classList.remove('active');
  }

  function _clearStreetWidthLayers() {
    _removeLayer('streets-width');
    _removeSource('streets-width-src');
    _hideWidthLegend();
    _unbindWidthHover();
    streetWidthsVisible = false;
    // Button-Zustand zurücksetzen
    var btn = document.getElementById('btn-street-widths');
    if (btn) btn.classList.remove('active');
  }

  function _clearMaterialplatzLayers() {
    ['materialplatz-fill', 'materialplatz-outline'].forEach(_removeLayer);
    _removeSource('materialplatz-src');
  }

  function _clearMarkers(arr) {
    arr.forEach(function (m) { m.remove(); });
    arr.length = 0;
  }

  function _clearPopups() {
    activePopups.forEach(function (p) { p.remove(); });
    activePopups.length = 0;
  }

  function _unbindMapEvents() {
    if (mapClickHandler) {
      map.off('click', mapClickHandler);
      mapClickHandler = null;
    }
    if (mapDblClickHandler) {
      map.off('dblclick', mapDblClickHandler);
      mapDblClickHandler = null;
    }
  }

  // ── 1. Route berechnen (A -> B) ──

  function startRoute() {
    if (_isStatic()) { showComingSoon('Routing (A→B Berechnung)'); return; }
    cleanup();
    mode = 'route';
    clickPoints = [];
    _showBanner('Route berechnen', 'Klicke Startpunkt (A) auf die Karte.');
    map.getCanvas().style.cursor = 'crosshair';

    mapClickHandler = async function (e) {
      const rawLngLat = [e.lngLat.lng, e.lngLat.lat];
      const pointIndex = clickPoints.length + 1;
      const isStart = pointIndex === 1;

      // Snap auf nächste Strasse
      let snapped = rawLngLat;
      let streetName = '';
      try {
        const snapRes = await fetch(`${_apiBase()}/snap?lat=${rawLngLat[1]}&lng=${rawLngLat[0]}`);
        if (snapRes.ok) {
          const snapData = await snapRes.json();
          snapped = [snapData.lng, snapData.lat];
          streetName = snapData.street_name || '';
        }
      } catch (err) { /* Fallback: Original-Koordinaten */ }

      clickPoints.push(snapped);

      const el = document.createElement('div');
      el.style.cssText =
        'width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
        'font-weight:700;font-size:13px;color:#fff;' +
        'background:' + (isStart ? COLORS.success : COLORS.danger) + ';' +
        'border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
      el.textContent = isStart ? 'A' : 'B';
      const marker = new maplibregl.Marker({ element: el }).setLngLat(snapped).addTo(map);
      clickMarkers.push(marker);

      if (clickPoints.length === 1) {
        const hint = streetName ? ` (${streetName})` : '';
        _showBanner('Route berechnen', `Start gesetzt${hint}. Klicke Zielpunkt (B).`);
      }

      if (clickPoints.length >= 2) {
        _unbindMapEvents();
        map.getCanvas().style.cursor = '';
        _showVehicleDialog();
      }
    };
    map.on('click', mapClickHandler);
  }

  function _showVehicleDialog() {
    _hideBanner();
    const container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    bannerEl = document.createElement('div');
    bannerEl.className = 'drawing-banner';
    const options = VEHICLE_TYPES.map(function (v) {
      return `<option value="${v.id}"${v.id === selectedVehicle ? ' selected' : ''}>${v.label}</option>`;
    }).join('');
    bannerEl.innerHTML = `
      <span>Fahrzeugtyp:</span>
      <select id="routing-vehicle-select" style="margin:0 10px;padding:4px 8px;border-radius:6px;border:1px solid #ccc;font-size:13px;">${options}</select>
      <button id="routing-calc-btn" style="padding:5px 16px;border:none;border-radius:6px;background:${COLORS.success};color:#fff;cursor:pointer;font-weight:600;">Berechnen</button>
      <button class="banner-cancel" onclick="RoutingModule.cleanup()" style="margin-left:8px;">Abbrechen</button>
    `;
    container.appendChild(bannerEl);

    document.getElementById('routing-calc-btn').addEventListener('click', function () {
      selectedVehicle = document.getElementById('routing-vehicle-select').value;
      _fetchRoute();
    });
  }

  async function _fetchRoute() {
    _hideBanner();
    _showBanner('Route berechnen', 'Route wird berechnet...');
    const start = clickPoints[0];
    const end = clickPoints[1];
    const url = `${_apiBase()}/route?from_lng=${start[0]}&from_lat=${start[1]}&to_lng=${end[0]}&to_lat=${end[1]}&vehicle=${selectedVehicle}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Fehler: ' + res.status);
      const data = await res.json();

      _hideBanner();
      const coords = data.geometry ? data.geometry.coordinates : (data.coordinates || []);
      if (coords.length === 0) {
        _showBanner('Route', 'Keine Route gefunden.');
        return;
      }

      _ensureSource('route-main-src', {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
      _ensureLineLayer('route-main', 'route-main-src', COLORS.success, 5);

      const bounds = coords.reduce(function (b, c) {
        return b.extend(c);
      }, new maplibregl.LngLatBounds(coords[0], coords[0]));
      map.fitBounds(bounds, { padding: 60 });

      const props = data.properties || data;
      const distKm = props.distance_km || 0;
      const durMin = props.duration_min || 0;
      const hops = props.hops || 0;
      const vLabel = VEHICLE_TYPES.find(function (v) { return v.id === selectedVehicle; }).label;

      _showInfoBox(`
        <div style="font-weight:700;margin-bottom:8px;font-size:14px;">Route berechnet</div>
        <div style="margin-bottom:4px;"><span style="opacity:0.7;">Distanz:</span> <strong>${distKm < 1 ? Math.round(distKm * 1000) + ' m' : distKm.toFixed(2) + ' km'}</strong></div>
        <div style="margin-bottom:4px;"><span style="opacity:0.7;">Fahrzeit:</span> <strong>${Math.max(1, Math.round(durMin))} Min.</strong></div>
        <div style="margin-bottom:4px;"><span style="opacity:0.7;">Fahrzeug:</span> <strong>${vLabel}</strong></div>
        <button onclick="RoutingModule.cleanup()" style="margin-top:10px;padding:5px 14px;border:none;border-radius:6px;background:${COLORS.orange};color:#fff;cursor:pointer;font-size:12px;">Schliessen</button>
      `);
    } catch (err) {
      console.error('[RoutingModule] Route fetch error:', err);
      _hideBanner();
      _showBanner('Route', 'Fehler beim Berechnen: ' + err.message);
    }
  }

  // ── 2. Sperrung erfassen ──

  // Lokaler Speicher für Sperrungen (funktioniert ohne Backend)
  function _loadLocalClosures() {
    try {
      return JSON.parse(localStorage.getItem('bausite_closures') || '[]');
    } catch (e) { return []; }
  }

  function _saveLocalClosures(closures) {
    localStorage.setItem('bausite_closures', JSON.stringify(closures));
  }

  async function _snapToStreet(lngLat) {
    try {
      var res = await fetch(_apiBase() + '/snap?lat=' + lngLat[1] + '&lng=' + lngLat[0]);
      if (res.ok) {
        var data = await res.json();
        return { coords: [data.lng, data.lat], name: data.street_name || '' };
      }
    } catch (e) { /* Fallback: Original */ }
    return { coords: lngLat, name: '' };
  }

  function startClosure() {
    if (_isStatic()) { showComingSoon('Sperrungen erfassen'); return; }
    cleanup();
    mode = 'closure';
    closureVertices = [];
    _showBanner('Sperrung zeichnen', 'Klicke Punkte auf die Strasse. Doppelklick zum Abschliessen.');
    map.getCanvas().style.cursor = 'crosshair';

    mapClickHandler = async function (e) {
      var raw = [e.lngLat.lng, e.lngLat.lat];
      var snapped = await _snapToStreet(raw);
      var pt = snapped.coords;
      closureVertices.push(pt);

      var el = document.createElement('div');
      el.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + COLORS.danger + ';border:2px solid #fff;';
      var marker = new maplibregl.Marker({ element: el }).setLngLat(pt).addTo(map);
      closureMarkers.push(marker);

      if (closureVertices.length === 1 && snapped.name) {
        _showBanner('Sperrung zeichnen', snapped.name + ' — weitere Punkte setzen, Doppelklick zum Abschliessen.');
      }

      if (closureVertices.length > 1) {
        _ensureSource('closure-preview-src', _lineFeature(closureVertices));
        if (!map.getLayer('closure-preview')) {
          _ensureLineLayer('closure-preview', 'closure-preview-src', COLORS.danger, 4, [6, 4]);
        }
      }
    };

    mapDblClickHandler = function (e) {
      e.preventDefault();
      if (closureVertices.length < 2) {
        _showBanner('Sperrung zeichnen', 'Mindestens 2 Punkte nötig.');
        return;
      }
      _unbindMapEvents();
      map.getCanvas().style.cursor = '';
      _removeLayer('closure-preview');
      _removeSource('closure-preview-src');
      _showClosureDialog();
    };

    map.on('click', mapClickHandler);
    map.on('dblclick', mapDblClickHandler);
  }

  function _showClosureDialog() {
    _hideBanner();
    var container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    bannerEl = document.createElement('div');
    bannerEl.style.cssText =
      'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;' +
      'border-radius:12px;padding:24px;z-index:1000;min-width:340px;' +
      'box-shadow:0 8px 30px rgba(0,0,0,0.3);font-size:13px;color:' + COLORS.navy + ';';

    var typeOptions = CLOSURE_TYPES.map(function (t) {
      return '<option value="' + t.id + '">' + t.label + '</option>';
    }).join('');

    var today = new Date().toISOString().slice(0, 10);
    bannerEl.innerHTML =
      '<div style="font-weight:700;font-size:16px;margin-bottom:14px;">Sperrung erfassen</div>' +
      '<label style="display:block;margin-bottom:8px;">Name:<br><input id="closure-name" type="text" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;" placeholder="z.B. Bahnhofstrasse 12-18"></label>' +
      '<label style="display:block;margin-bottom:8px;">Sperrungstyp:<br><select id="closure-type" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;">' + typeOptions + '</select></label>' +
      '<label style="display:block;margin-bottom:8px;">Verbleibende Breite (m):<br><input id="closure-width" type="number" step="0.1" value="0" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;"></label>' +
      '<div style="display:flex;gap:10px;margin-bottom:8px;">' +
        '<label style="flex:1;">Von:<br><input id="closure-from" type="date" value="' + today + '" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;"></label>' +
        '<label style="flex:1;">Bis:<br><input id="closure-to" type="date" style="width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;box-sizing:border-box;"></label>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:14px;">' +
        '<button id="closure-save-btn" style="flex:1;padding:8px;border:none;border-radius:6px;background:' + COLORS.success + ';color:#fff;cursor:pointer;font-weight:600;">Speichern</button>' +
        '<button id="closure-cancel-btn" style="flex:1;padding:8px;border:none;border-radius:6px;background:#e5e7eb;color:' + COLORS.navy + ';cursor:pointer;">Abbrechen</button>' +
      '</div>';
    container.appendChild(bannerEl);

    document.getElementById('closure-save-btn').addEventListener('click', _saveClosure);
    document.getElementById('closure-cancel-btn').addEventListener('click', function () { cleanup(); });
  }

  function _saveClosure() {
    var closure = {
      id: Date.now(),
      name: document.getElementById('closure-name').value || 'Unbenannt',
      closure_type: document.getElementById('closure-type').value,
      remaining_width: parseFloat(document.getElementById('closure-width').value) || 0,
      valid_from: document.getElementById('closure-from').value,
      valid_to: document.getElementById('closure-to').value,
      geometry: { type: 'LineString', coordinates: closureVertices },
    };

    // Lokal speichern
    var closures = _loadLocalClosures();
    closures.push(closure);
    _saveLocalClosures(closures);

    _hideBanner();
    _clearMarkers(closureMarkers);
    _showBanner('Sperrung gespeichert', closure.name);

    // Sperrungen anzeigen
    _showClosuresOnMap(_closuresToGeoJSON(closures));
    closuresVisible = true;
    var btn = document.getElementById('btn-closures-toggle');
    if (btn) btn.classList.add('active');

    setTimeout(function () { _hideBanner(); }, 3000);

    // Auch an API senden (fire & forget, kein Blocker)
    _trySaveToAPI(closure);
  }

  function _trySaveToAPI(closure) {
    fetch(_apiBase() + '/closures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: closure.name,
        closure_type: closure.closure_type,
        remaining_width: closure.remaining_width,
        vehicle_restriction: [],
        valid_from: closure.valid_from + 'T00:00:00+01:00',
        valid_to: (closure.valid_to || '2099-12-31') + 'T23:59:59+01:00',
        geometry: closure.geometry,
      }),
    }).then(function (r) {
      if (r.ok) console.log('[RoutingModule] Sperrung auch in DB gespeichert');
    }).catch(function () {
      // OK — funktioniert lokal weiter
    });
  }

  // ── 3. Sperrungen ein/ausblenden (Toggle) ──

  function _closuresToGeoJSON(closures) {
    var features = closures.map(function (c) {
      return {
        type: 'Feature',
        geometry: c.geometry,
        properties: {
          id: c.id,
          name: c.name || 'Unbenannt',
          closure_type: c.closure_type || 'full',
          remaining_width: c.remaining_width || 0,
          valid_from: c.valid_from || '',
          valid_to: c.valid_to || '',
        },
      };
    });
    return { type: 'FeatureCollection', features: features };
  }

  function _showClosuresOnMap(geojson) {
    closuresData = geojson;

    // Vollsperrungen: eigener Layer (dick, durchgezogen)
    var fullFeatures = geojson.features.filter(function (f) { return f.properties.closure_type === 'full'; });
    var partialFeatures = geojson.features.filter(function (f) { return f.properties.closure_type !== 'full'; });

    // Layer entfernen falls vorhanden
    _removeLayer('closures-full');
    _removeLayer('closures-partial');
    _removeLayer('closures-active');
    _removeSource('closures-full-src');
    _removeSource('closures-partial-src');
    _removeSource('closures-active-src');

    // Vollsperrungen: dick, durchgezogen, rot
    if (fullFeatures.length > 0) {
      _ensureSource('closures-full-src', { type: 'FeatureCollection', features: fullFeatures });
      if (!map.getLayer('closures-full')) {
        map.addLayer({
          id: 'closures-full',
          type: 'line',
          source: 'closures-full-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLORS.danger, 'line-width': 7, 'line-opacity': 0.9 },
        });
      }
    }

    // Teilsperrungen / Nachtsperrungen: gestrichelt, rot
    if (partialFeatures.length > 0) {
      _ensureSource('closures-partial-src', { type: 'FeatureCollection', features: partialFeatures });
      if (!map.getLayer('closures-partial')) {
        map.addLayer({
          id: 'closures-partial',
          type: 'line',
          source: 'closures-partial-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': COLORS.danger, 'line-width': 5, 'line-opacity': 0.8, 'line-dasharray': [6, 4] },
        });
      }
    }

    // Klick-Handler für Popups
    var clickLayers = [];
    if (fullFeatures.length > 0) clickLayers.push('closures-full');
    if (partialFeatures.length > 0) clickLayers.push('closures-partial');

    if (!map._routingClosureClick && clickLayers.length > 0) {
      map._routingClosureClick = function (e) {
        var feat = map.queryRenderedFeatures(e.point, { layers: clickLayers });
        if (feat.length === 0) return;
        var props = feat[0].properties;
        var typeLabel = CLOSURE_TYPES.find(function (t) { return t.id === props.closure_type; });
        var fromDate = (props.valid_from || '').slice(0, 10);
        var toDate = (props.valid_to || '').slice(0, 10);

        var popup = new maplibregl.Popup({ maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(
            '<div style="font-size:13px;color:' + COLORS.navy + ';">' +
              '<div style="font-weight:700;margin-bottom:6px;">' + (props.name || 'Sperrung') + '</div>' +
              '<div>Typ: <strong>' + (typeLabel ? typeLabel.label : props.closure_type) + '</strong></div>' +
              (props.remaining_width ? '<div>Restbreite: <strong>' + props.remaining_width + ' m</strong></div>' : '') +
              '<div>Zeitraum: <strong>' + (fromDate || '?') + ' — ' + (toDate || '?') + '</strong></div>' +
              '<div style="display:flex;gap:6px;margin-top:8px;">' +
                '<button onclick="RoutingModule.editClosure(' + props.id + ')" style="flex:1;padding:5px 12px;border:none;border-radius:6px;background:' + COLORS.blue + ';color:#fff;cursor:pointer;font-size:12px;">Bearbeiten</button>' +
                '<button onclick="RoutingModule.deleteClosure(' + props.id + ')" style="flex:1;padding:5px 12px;border:none;border-radius:6px;background:' + COLORS.danger + ';color:#fff;cursor:pointer;font-size:12px;">Löschen</button>' +
              '</div>' +
            '</div>'
          )
          .addTo(map);
        activePopups.push(popup);
      };
      clickLayers.forEach(function (layerId) {
        map.on('click', layerId, map._routingClosureClick);
        map.on('mouseenter', layerId, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, function () { map.getCanvas().style.cursor = ''; });
      });
    }
  }

  function toggleClosures() {
    var btn = document.getElementById('btn-closures-toggle');
    if (closuresVisible) {
      _clearClosureLayers();
      return;
    }

    var closures = _loadLocalClosures();
    if (closures.length === 0) {
      _showBanner('Sperrungen', 'Keine Sperrungen erfasst.');
      setTimeout(function () { _hideBanner(); }, 3000);
      return;
    }

    _showClosuresOnMap(_closuresToGeoJSON(closures));
    closuresVisible = true;
    if (btn) btn.classList.add('active');
  }

  function editClosure(id) {
    _clearPopups();
    _showBanner('Bearbeiten', 'Funktion kommt mit dem Backend — Sperrung kann dann direkt editiert werden.');
    setTimeout(function () { _hideBanner(); }, 3000);
  }

  function deleteClosure(id) {
    var closures = _loadLocalClosures().filter(function (c) { return c.id !== id; });
    _saveLocalClosures(closures);
    _clearPopups();
    if (closures.length > 0) {
      _showClosuresOnMap(_closuresToGeoJSON(closures));
    } else {
      _clearClosureLayers();
    }
  }

  // ── 3b. Umfahrungen automatisch anzeigen ──

  async function showDetours() {
    if (_isStatic()) { showComingSoon('Umfahrungen berechnen'); return; }
    if (!closuresVisible || !closuresData || closuresData.features.length === 0) {
      // Erst Sperrungen laden
      var closures = _loadLocalClosures();
      if (closures.length === 0) {
        _showBanner('Umfahrungen', 'Keine Sperrungen erfasst — zuerst Sperrung zeichnen.');
        setTimeout(function () { _hideBanner(); }, 3000);
        return;
      }
      _showClosuresOnMap(_closuresToGeoJSON(closures));
      closuresVisible = true;
      var btn = document.getElementById('btn-closures-toggle');
      if (btn) btn.classList.add('active');
    }

    _clearRouteLayers();
    _hideBanner();
    _hideInfoBox();
    _hideComparison();
    _showBanner('Umfahrungen', 'Umfahrungen werden berechnet...');

    // Für jede Sperrung: Start/End = Endpunkte der Sperrungslinie
    var allRouteFeatures = [];
    var errors = 0;

    for (var i = 0; i < closuresData.features.length; i++) {
      var feat = closuresData.features[i];
      var coords = feat.geometry.coordinates;
      if (!coords || coords.length < 2) continue;

      var startPt = coords[0];
      var endPt = coords[coords.length - 1];

      try {
        var res = await fetch(_apiBase() + '/detour', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from_lng: startPt[0],
            from_lat: startPt[1],
            to_lng: endPt[0],
            to_lat: endPt[1],
            vehicle: selectedVehicle,
            closure_id: feat.properties.id || null,
          }),
        });
        if (!res.ok) { errors++; continue; }
        var data = await res.json();
        var routes = data.features || [];
        // Nur die beste Umfahrung nehmen (erste mit route_type=detour)
        for (var r = 0; r < routes.length; r++) {
          if (routes[r].properties.route_type === 'detour') {
            allRouteFeatures.push(routes[r]);
            break;
          }
        }
      } catch (err) {
        console.error('[RoutingModule] Detour error for closure', feat.properties.id, err);
        errors++;
      }
    }

    _hideBanner();

    if (allRouteFeatures.length === 0) {
      _showBanner('Umfahrungen', 'Keine Umfahrungen gefunden.' + (errors > 0 ? ' (' + errors + ' Fehler)' : ''));
      setTimeout(function () { _hideBanner(); }, 3000);
      return;
    }

    // Alle Umfahrungen als eine Quelle anzeigen
    _ensureSource('route-main-src', { type: 'FeatureCollection', features: allRouteFeatures });
    _ensureLineLayer('route-main', 'route-main-src', COLORS.blue, 5);

    // Auf alle Routen zoomen
    var allCoords = [];
    allRouteFeatures.forEach(function (f) {
      var c = f.geometry.coordinates || [];
      c.forEach(function (pt) { allCoords.push(pt); });
    });
    if (allCoords.length > 0) {
      var bounds = allCoords.reduce(function (b, c) {
        return b.extend(c);
      }, new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
      map.fitBounds(bounds, { padding: 60 });
    }

    var totalKm = allRouteFeatures.reduce(function (sum, f) {
      return sum + (f.properties.distance_km || 0);
    }, 0);
    _showInfoBox(
      '<div style="font-weight:700;margin-bottom:8px;font-size:14px;">Umfahrungen</div>' +
      '<div><span style="opacity:0.7;">Sperrungen:</span> <strong>' + closuresData.features.length + '</strong></div>' +
      '<div><span style="opacity:0.7;">Umfahrungen:</span> <strong>' + allRouteFeatures.length + '</strong></div>' +
      '<div><span style="opacity:0.7;">Gesamtdistanz:</span> <strong>' + totalKm.toFixed(1) + ' km</strong></div>' +
      '<button onclick="RoutingModule.cleanup()" style="margin-top:10px;padding:5px 14px;border:none;border-radius:6px;background:' + COLORS.orange + ';color:#fff;cursor:pointer;font-size:12px;">Schliessen</button>'
    );
  }

  // ── 4. Umfahrung berechnen ──

  async function calculateDetour(closureId) {
    _hideBanner();
    _hideInfoBox();
    _showBanner('Umfahrung', 'Alternativrouten werden berechnet...');

    try {
      const body = { closure_id: closureId };
      if (clickPoints.length >= 2) {
        body.start = { lng: clickPoints[0][0], lat: clickPoints[0][1] };
        body.end = { lng: clickPoints[1][0], lat: clickPoints[1][1] };
      }

      const res = await fetch(_apiBase() + '/detour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('API Fehler: ' + res.status);
      const data = await res.json();

      _hideBanner();
      const routes = data.routes || data.alternatives || [data];
      if (routes.length === 0) {
        _showBanner('Umfahrung', 'Keine Alternativrouten gefunden.');
        return;
      }

      // Bis zu 3 Routen anzeigen
      const layerConfigs = [
        { layer: 'route-main',  src: 'route-main-src',  color: COLORS.success, width: 6 },
        { layer: 'route-alt-1', src: 'route-alt-1-src', color: COLORS.blue,    width: 4 },
        { layer: 'route-alt-2', src: 'route-alt-2-src', color: COLORS.violet,  width: 3 },
      ];

      const allCoords = [];
      routes.slice(0, 3).forEach(function (route, i) {
        const coords = route.geometry ? route.geometry.coordinates : (route.coordinates || []);
        if (coords.length === 0) return;
        const cfg = layerConfigs[i];
        _ensureSource(cfg.src, _lineFeature(coords));
        _ensureLineLayer(cfg.layer, cfg.src, cfg.color, cfg.width);
        coords.forEach(function (c) { allCoords.push(c); });
      });

      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(function (b, c) {
          return b.extend(c);
        }, new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
        map.fitBounds(bounds, { padding: 60 });
      }

      // Vergleichstabelle
      const tableData = routes.slice(0, 3).map(function (r) {
        return {
          distance_m: r.distance_m || r.distance || 0,
          duration_s: r.duration_s || r.duration || 0,
          road_types: r.road_types || '—',
        };
      });
      _showComparison(tableData);

    } catch (err) {
      console.error('[RoutingModule] Detour error:', err);
      _hideBanner();
      _showBanner('Umfahrung', 'Fehler: ' + err.message);
    }
  }

  // ── 5. Strassenbreiten anzeigen ──

  const WIDTH_CLASSES = [
    { min: 6,   color: COLORS.success, label: 'Breit (> 6 m)' },
    { min: 3.5, color: COLORS.warning, label: 'Normal (3.5–6 m)' },
    { min: 3,   color: COLORS.orange,  label: 'Eng (3–3.5 m)' },
    { min: 0.1, color: COLORS.danger,  label: 'Sehr eng (< 3 m)' },
    { min: -1,  color: '#9CA3AF',      label: 'Unbekannt' },
  ];

  function _widthColor(w) {
    if (!w || w <= 0) return '#9CA3AF';
    for (var i = 0; i < WIDTH_CLASSES.length - 1; i++) {
      if (w >= WIDTH_CLASSES[i].min) return WIDTH_CLASSES[i].color;
    }
    return COLORS.danger;
  }

  function _showWidthLegend() {
    _hideWidthLegend();
    var legendContainer = document.getElementById('street-width-legend');
    if (legendContainer) {
      var rows = WIDTH_CLASSES.map(function (c) {
        return '<div class="wl-row">' +
          '<span class="wl-color" style="background:' + c.color + ';"></span>' +
          '<span>' + c.label + '</span></div>';
      }).join('');
      legendContainer.innerHTML =
        rows;
      legendContainer.style.display = 'block';
      widthLegendEl = legendContainer;
      return;
    }
    // Fallback: Legende auf der Karte
    var container = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    widthLegendEl = document.createElement('div');
    widthLegendEl.className = 'width-legend';
    var rows = WIDTH_CLASSES.map(function (c) {
      return '<div class="wl-row">' +
        '<span class="wl-color" style="background:' + c.color + ';"></span>' +
        '<span>' + c.label + '</span></div>';
    }).join('');
    widthLegendEl.innerHTML =
      rows;
    container.appendChild(widthLegendEl);
  }

  function _hideWidthLegend() {
    if (widthLegendEl) {
      var legendContainer = document.getElementById('street-width-legend');
      if (legendContainer && widthLegendEl === legendContainer) {
        legendContainer.style.display = 'none';
        legendContainer.innerHTML = '';
      } else if (widthLegendEl.parentElement) {
        widthLegendEl.parentElement.removeChild(widthLegendEl);
      }
      widthLegendEl = null;
    }
  }

  function _onWidthMouseMove(e) {
    var features = map.queryRenderedFeatures(e.point, { layers: ['streets-width'] });
    if (features.length > 0) {
      map.getCanvas().style.cursor = 'pointer';
      var props = features[0].properties;
      var w = parseFloat(props._width || props.width || props.breite || 0) || 0;
      var name = props.name || props.street_name || '';
      var text = w > 0 ? 'Breite: ' + w.toFixed(1) + ' m' : 'Breite: unbekannt';
      if (name) text = '<strong>' + name + '</strong><br>' + text;

      if (!widthHoverPopup) {
        widthHoverPopup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
          className: 'width-hover-popup',
        });
      }
      widthHoverPopup
        .setLngLat(e.lngLat)
        .setHTML('<div style="font-size:12px;color:#1B2A4A;padding:2px 4px;">' + text + '</div>')
        .addTo(map);
    } else {
      map.getCanvas().style.cursor = '';
      if (widthHoverPopup) {
        widthHoverPopup.remove();
      }
    }
  }

  function _onWidthMouseLeave() {
    map.getCanvas().style.cursor = '';
    if (widthHoverPopup) {
      widthHoverPopup.remove();
    }
  }

  function _bindWidthHover() {
    map.on('mousemove', 'streets-width', _onWidthMouseMove);
    map.on('mouseleave', 'streets-width', _onWidthMouseLeave);
  }

  function _unbindWidthHover() {
    map.off('mousemove', 'streets-width', _onWidthMouseMove);
    map.off('mouseleave', 'streets-width', _onWidthMouseLeave);
    if (widthHoverPopup) {
      widthHoverPopup.remove();
      widthHoverPopup = null;
    }
  }

  async function showStreetWidths() {
    if (streetWidthsVisible) {
      _clearStreetWidthLayers();
      return;
    }

    const center = map.getCenter();
    const url = `${_apiBase()}/streets/width?lng=${center.lng}&lat=${center.lat}&zoom=${Math.round(map.getZoom())}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('API Fehler: ' + res.status);
      const data = await res.json();

      const features = (data.features || data || []).map(function (item) {
        const feat = item.type === 'Feature' ? item : {
          type: 'Feature',
          geometry: item.geometry,
          properties: item.properties || item,
        };
        const w = parseFloat(feat.properties.width || feat.properties.breite || 0) || 0;
        // API liefert color bereits korrekt (inkl. grau für unbekannt)
        feat.properties._color = feat.properties.color || _widthColor(w);
        feat.properties._width = w;
        return feat;
      });

      _ensureSource('streets-width-src', { type: 'FeatureCollection', features: features });

      if (!map.getLayer('streets-width')) {
        map.addLayer({
          id: 'streets-width',
          type: 'line',
          source: 'streets-width-src',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', '_color'],
            'line-width': 4,
            'line-opacity': 0.8,
          },
        });
      }

      streetWidthsVisible = true;
      _showWidthLegend();
      _bindWidthHover();

      // Button aktiv markieren
      var btn = document.getElementById('btn-street-widths');
      if (btn) btn.classList.add('active');

    } catch (err) {
      console.error('[RoutingModule] Street widths error:', err);
    }
  }

  // ── 6. Materialplatz-Suche ──

  function searchMaterialplatz() {
    if (_isStatic()) { showComingSoon('Materialplatz-Suche'); return; }
    cleanup();
    mode = 'materialplatz';
    _showBanner('Materialplatz suchen', 'Klicke auf die Karte um das Suchzentrum zu setzen.');
    map.getCanvas().style.cursor = 'crosshair';

    mapClickHandler = function (e) {
      _unbindMapEvents();
      map.getCanvas().style.cursor = '';
      const lngLat = [e.lngLat.lng, e.lngLat.lat];

      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:' + COLORS.orange + ';border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
      const marker = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
      clickMarkers.push(marker);

      _hideBanner();
      _showBanner('Materialplatz', 'Suche laeuft...');
      _fetchMaterialplatz(lngLat);
    };
    map.on('click', mapClickHandler);
  }

  async function _fetchMaterialplatz(center) {
    try {
      const res = await fetch(_apiBase() + '/materialplatz/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lng: center[0], lat: center[1] }),
      });
      if (!res.ok) throw new Error('API Fehler: ' + res.status);
      const data = await res.json();

      _hideBanner();
      const features = (data.features || data.candidates || data || []).map(function (item) {
        if (item.type === 'Feature') return item;
        return {
          type: 'Feature',
          geometry: item.geometry,
          properties: item.properties || item,
        };
      });

      if (features.length === 0) {
        _showBanner('Materialplatz', 'Keine Kandidaten gefunden.');
        return;
      }

      const geojson = { type: 'FeatureCollection', features: features };
      _ensureSource('materialplatz-src', geojson);

      if (!map.getLayer('materialplatz-fill')) {
        map.addLayer({
          id: 'materialplatz-fill',
          type: 'fill',
          source: 'materialplatz-src',
          paint: {
            'fill-color': COLORS.warning,
            'fill-opacity': 0.3,
          },
        });
      }
      if (!map.getLayer('materialplatz-outline')) {
        map.addLayer({
          id: 'materialplatz-outline',
          type: 'line',
          source: 'materialplatz-src',
          paint: {
            'line-color': COLORS.orange,
            'line-width': 2,
          },
        });
      }

      // Klick auf Kandidat -> Popup
      if (!map._routingMaterialClick) {
        map._routingMaterialClick = function (ev) {
          const feat = map.queryRenderedFeatures(ev.point, { layers: ['materialplatz-fill'] });
          if (feat.length === 0) return;
          const props = feat[0].properties;
          const popup = new maplibregl.Popup({ maxWidth: '260px' })
            .setLngLat(ev.lngLat)
            .setHTML(`
              <div style="font-size:13px;color:${COLORS.navy};">
                <div style="font-weight:700;margin-bottom:6px;">Materialplatz</div>
                <div>Flaeche: <strong>${_formatNumber(props.area || props.flaeche || 0)} m2</strong></div>
                <div>Typ: <strong>${props.type || props.typ || '—'}</strong></div>
                <div>Route-Distanz: <strong>${_formatNumber(props.route_distance || props.distanz || 0)} m</strong></div>
              </div>
            `)
            .addTo(map);
          activePopups.push(popup);
        };
        map.on('click', 'materialplatz-fill', map._routingMaterialClick);
        map.on('mouseenter', 'materialplatz-fill', function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'materialplatz-fill', function () { map.getCanvas().style.cursor = ''; });
      }

      // Auf Kandidaten zoomen
      const allCoords = [];
      features.forEach(function (f) {
        const coords = f.geometry.coordinates;
        if (f.geometry.type === 'Polygon') {
          coords[0].forEach(function (c) { allCoords.push(c); });
        } else if (f.geometry.type === 'MultiPolygon') {
          coords.forEach(function (ring) { ring[0].forEach(function (c) { allCoords.push(c); }); });
        }
      });
      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(function (b, c) {
          return b.extend(c);
        }, new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
        map.fitBounds(bounds, { padding: 60 });
      }

    } catch (err) {
      console.error('[RoutingModule] Materialplatz error:', err);
      _hideBanner();
      _showBanner('Materialplatz', 'Fehler: ' + err.message);
    }
  }

  // ── Cleanup ──

  function cleanup() {
    _unbindMapEvents();
    _hideBanner();
    _hideInfoBox();
    _hideComparison();
    _clearMarkers(clickMarkers);
    _clearMarkers(closureMarkers);
    _clearPopups();
    _clearRouteLayers();
    _clearMaterialplatzLayers();
    _removeLayer('closure-preview');
    _removeSource('closure-preview-src');
    map.getCanvas().style.cursor = '';
    mode = 'none';
    clickPoints = [];
    closureVertices = [];
  }

  // ── Oeffentliche API ──

  return {
    startRoute:          startRoute,
    startClosure:        startClosure,
    toggleClosures:      toggleClosures,
    showDetours:         showDetours,
    editClosure:         editClosure,
    deleteClosure:       deleteClosure,
    calculateDetour:     calculateDetour,
    showStreetWidths:    showStreetWidths,
    searchMaterialplatz: searchMaterialplatz,
    cleanup:             cleanup,
  };

})();
