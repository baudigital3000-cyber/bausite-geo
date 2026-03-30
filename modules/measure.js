// ============================================
// BAUSITE Geo — Mess- und Analysewerkzeuge
// Modul für MapLibre GL JS
//
// Features:
//   1. Distanzmessung (Haversine)
//   2. Flächenmessung (Shoelace auf projizierten Koordinaten)
//   3. Höhenprofil (swisstopo API, Canvas-Chart)
//   4. Punkt-Höhenabfrage (swisstopo API)
//   5. Neigungs-/Gefälle-Analyse
//
// Globale Variable: map (MapLibre Map-Instanz)
// Design: Navy (#1B2A4A), Orange (#E8833A), Blue (#2E86AB)
// ============================================

(function () {
  'use strict';

  // ── Farb-Konstanten ──
  const COLORS = {
    navy: '#1B2A4A',
    orange: '#E8833A',
    orangeDark: '#D06B24',
    blue: '#2E86AB',
    white: '#FFFFFF',
    lineMeasure: '#E8833A',
    areaFill: 'rgba(232, 131, 58, 0.15)',
    areaBorder: '#E8833A',
    profileLine: '#E8833A',
    slopeLine: '#2E86AB',
  };

  // ── swisstopo API Endpunkte ──
  const SWISSTOPO_HEIGHT_API = 'https://api3.geo.admin.ch/rest/services/height';
  const SWISSTOPO_PROFILE_API = 'https://api3.geo.admin.ch/rest/services/profile.json';

  // ── Interner Zustand ──
  let activeTool = null;           // Aktives Werkzeug ('distance', 'area', 'profile', 'height', 'slope')
  let points = [];                 // Gesammelte Klick-Punkte [{ lng, lat }]
  let markers = [];                // MapLibre Marker-Instanzen
  let labelMarkers = [];           // Segment-Label Marker
  let popups = [];                 // Geöffnete Popups
  let lastMeasurement = null;      // Letztes Messergebnis
  let profilePanel = null;         // Profil-Panel DOM-Element
  let profileChart = null;         // Canvas-Context für Profil
  let profileData = null;          // Profildaten von swisstopo
  let profileHoverMarker = null;   // Marker für Hover im Profil
  let toolbarEl = null;            // Toolbar-Element
  let mapClickHandler = null;      // Referenz auf den aktiven Click-Handler
  let mapDblClickHandler = null;   // Referenz auf Doppelklick-Handler
  let mapMoveHandler = null;       // Referenz auf Mousemove-Handler (für Live-Preview)
  let previewLineAdded = false;    // Ob Preview-Line schon als Source existiert
  let resultOverlays = [];         // Ergebnis-Overlays auf der Karte

  // ── Quell-/Layer-IDs für MapLibre ──
  const SOURCE_LINE = 'measure-line-source';
  const LAYER_LINE = 'measure-line-layer';
  const SOURCE_POLYGON = 'measure-polygon-source';
  const LAYER_POLYGON_FILL = 'measure-polygon-fill';
  const LAYER_POLYGON_LINE = 'measure-polygon-line';
  const SOURCE_PREVIEW = 'measure-preview-source';
  const LAYER_PREVIEW = 'measure-preview-layer';
  const SOURCE_PROFILE_LINE = 'measure-profile-line-source';
  const LAYER_PROFILE_LINE = 'measure-profile-line-layer';

  // ============================================================
  // HILFSFUNKTIONEN
  // ============================================================

  /**
   * Haversine-Distanz zwischen zwei WGS84-Punkten in Metern.
   * @param {number} lon1 - Längengrad Punkt 1
   * @param {number} lat1 - Breitengrad Punkt 1
   * @param {number} lon2 - Längengrad Punkt 2
   * @param {number} lat2 - Breitengrad Punkt 2
   * @returns {number} Distanz in Metern
   */
  function haversine(lon1, lat1, lon2, lat2) {
    const R = 6371008.8; // Erdradius in Metern
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /** Grad → Radiant */
  function toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Distanz-Formatierung: Meter oder Kilometer.
   * @param {number} meters - Distanz in Metern
   * @returns {string} Formatierte Distanz
   */
  function formatDistance(meters) {
    if (meters >= 1000) {
      return (meters / 1000).toFixed(2) + ' km';
    }
    return meters.toFixed(1) + ' m';
  }

  /**
   * Fläche formatieren: m² oder ha.
   * @param {number} sqm - Fläche in Quadratmetern
   * @returns {string} Formatierte Fläche
   */
  function formatArea(sqm) {
    if (sqm >= 10000) {
      return (sqm / 10000).toFixed(2) + ' ha';
    }
    return sqm.toFixed(1) + ' m²';
  }

  /**
   * Zahlen mit Schweizer Apostroph formatieren.
   * @param {number} n
   * @returns {string}
   */
  function formatNumber(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  /**
   * WGS84 (lon, lat) → ungefähre CH1903+ Koordinaten (E, N).
   * Approximation nach swisstopo-Formel (Näherung).
   * Genauigkeit ca. 1m — für Anzeige ausreichend.
   * @param {number} lon - WGS84 Längengrad
   * @param {number} lat - WGS84 Breitengrad
   * @returns {{ E: number, N: number }} CH1903+ Koordinaten
   */
  function wgs84ToCH1903Plus(lon, lat) {
    // Hilfsgrössen (Breite/Länge in Sexagesimalsekunden)
    const phi = lat * 3600;
    const lambda = lon * 3600;

    // Hilfswerte relativ zu Bern
    const phiAux = (phi - 169028.66) / 10000;
    const lambdaAux = (lambda - 26782.5) / 10000;

    // Ost-Koordinate (E)
    const E = 2600072.37 +
      211455.93 * lambdaAux -
      10938.51 * lambdaAux * phiAux -
      0.36 * lambdaAux * phiAux * phiAux -
      44.54 * lambdaAux * lambdaAux * lambdaAux;

    // Nord-Koordinate (N)
    const N = 1200147.07 +
      308807.95 * phiAux +
      3745.25 * lambdaAux * lambdaAux +
      76.63 * phiAux * phiAux -
      194.56 * lambdaAux * lambdaAux * phiAux +
      119.79 * phiAux * phiAux * phiAux;

    return { E: Math.round(E), N: Math.round(N) };
  }

  /**
   * Fläche eines Polygons auf projizierten Koordinaten berechnen (Shoelace / Gauss).
   * Wir projizieren WGS84 → Pseudo-Meter via Mittelpunkt-Referenz.
   * @param {Array<{lng: number, lat: number}>} pts - Polygon-Eckpunkte
   * @returns {number} Fläche in m²
   */
  function computePolygonArea(pts) {
    if (pts.length < 3) return 0;

    // Referenzpunkt (Schwerpunkt) für lokale Projektion
    const refLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    const refLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;

    // Meter pro Grad am Referenzpunkt
    const mPerDegLat = 111320; // ungefähr konstant
    const mPerDegLng = 111320 * Math.cos(toRad(refLat));

    // In lokale Meter-Koordinaten umrechnen
    const projected = pts.map(p => ({
      x: (p.lng - refLng) * mPerDegLng,
      y: (p.lat - refLat) * mPerDegLat,
    }));

    // Shoelace-Formel
    let area = 0;
    const n = projected.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += projected[i].x * projected[j].y;
      area -= projected[j].x * projected[i].y;
    }
    return Math.abs(area) / 2;
  }

  /**
   * Umfang eines Polygons in Metern berechnen.
   * @param {Array<{lng: number, lat: number}>} pts
   * @returns {number} Umfang in Metern
   */
  function computePerimeter(pts) {
    if (pts.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      total += haversine(pts[i].lng, pts[i].lat, pts[j].lng, pts[j].lat);
    }
    return total;
  }

  /**
   * Gesamte Liniendistanz über mehrere Punkte.
   * @param {Array<{lng: number, lat: number}>} pts
   * @returns {number} Gesamtdistanz in Metern
   */
  function totalDistance(pts) {
    let dist = 0;
    for (let i = 1; i < pts.length; i++) {
      dist += haversine(pts[i - 1].lng, pts[i - 1].lat, pts[i].lng, pts[i].lat);
    }
    return dist;
  }

  /**
   * Mittelpunkt eines Liniensegments.
   */
  function midpoint(p1, p2) {
    return {
      lng: (p1.lng + p2.lng) / 2,
      lat: (p1.lat + p2.lat) / 2,
    };
  }

  /**
   * Interpoliere Punkte entlang einer Linie für Profil-Abfrage.
   * Gibt Koordinaten-Array zurück mit gleichmässigem Abstand.
   * @param {Array<{lng: number, lat: number}>} pts - Stützpunkte der Linie
   * @param {number} numPoints - Gewünschte Anzahl Punkte
   * @returns {Array<[number, number]>} [[lon, lat], ...]
   */
  function interpolateLine(pts, numPoints) {
    if (pts.length < 2) return pts.map(p => [p.lng, p.lat]);

    // Segment-Längen berechnen
    const segDists = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = haversine(pts[i - 1].lng, pts[i - 1].lat, pts[i].lng, pts[i].lat);
      segDists.push(d);
      total += d;
    }

    const result = [];
    const step = total / (numPoints - 1);

    // Entlang der Linie in gleichmässigen Schritten samplen
    let currentDist = 0;
    let segIndex = 0;
    let segStart = 0;

    for (let i = 0; i < numPoints; i++) {
      const targetDist = i * step;

      // Finde das richtige Segment
      while (segIndex < segDists.length - 1 && segStart + segDists[segIndex] < targetDist) {
        segStart += segDists[segIndex];
        segIndex++;
      }

      // Interpolation innerhalb des Segments
      const segLen = segDists[segIndex] || 1;
      const t = Math.max(0, Math.min(1, (targetDist - segStart) / segLen));
      const p1 = pts[segIndex];
      const p2 = pts[segIndex + 1] || pts[segIndex];

      result.push([
        p1.lng + t * (p2.lng - p1.lng),
        p1.lat + t * (p2.lat - p1.lat),
      ]);
    }

    return result;
  }

  // ============================================================
  // DOM-HILFSFUNKTIONEN
  // ============================================================

  /**
   * Toolbar erstellen / aktualisieren (Anzeige oben auf der Karte).
   * @param {string} text - Haupttext
   * @param {string} hint - Hinweistext
   * @param {Array<{label: string, cls: string, onClick: Function}>} buttons - Aktions-Buttons
   */
  function showToolbar(text, hint, buttons) {
    if (!toolbarEl) {
      toolbarEl = document.createElement('div');
      toolbarEl.className = 'measure-toolbar';
      document.querySelector('.map-container').appendChild(toolbarEl);
    }

    toolbarEl.innerHTML = '';
    toolbarEl.classList.remove('hidden');

    const textSpan = document.createElement('span');
    textSpan.className = 'toolbar-text';
    textSpan.textContent = text;
    toolbarEl.appendChild(textSpan);

    if (hint) {
      const hintSpan = document.createElement('span');
      hintSpan.className = 'toolbar-hint';
      hintSpan.textContent = hint;
      toolbarEl.appendChild(hintSpan);
    }

    if (buttons) {
      buttons.forEach(b => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-btn' + (b.cls ? ' ' + b.cls : '');
        btn.textContent = b.label;
        btn.addEventListener('click', b.onClick);
        toolbarEl.appendChild(btn);
      });
    }
  }

  /** Toolbar ausblenden */
  function hideToolbar() {
    if (toolbarEl) {
      toolbarEl.classList.add('hidden');
    }
  }

  /**
   * MapLibre-Marker für einen Messpunkt erstellen.
   * @param {object} lngLat - { lng, lat }
   * @param {boolean} isFirst - Ob erster Punkt (andere Farbe)
   * @returns {maplibregl.Marker}
   */
  function createPointMarker(lngLat, isFirst) {
    const el = document.createElement('div');
    el.className = 'measure-point' + (isFirst ? ' first' : '');
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lngLat.lng, lngLat.lat])
      .addTo(map);
    markers.push(marker);
    return marker;
  }

  /**
   * Segment-Label zwischen zwei Punkten auf die Karte setzen.
   * @param {object} p1 - { lng, lat }
   * @param {object} p2 - { lng, lat }
   * @param {number} dist - Distanz in Metern
   */
  function addSegmentLabel(p1, p2, dist) {
    const mid = midpoint(p1, p2);
    const el = document.createElement('div');
    el.className = 'measure-segment-label';
    el.textContent = formatDistance(dist);
    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([mid.lng, mid.lat])
      .addTo(map);
    labelMarkers.push(marker);
  }

  /**
   * Ergebnis-Overlay auf die Karte setzen.
   * @param {string} title - Titel
   * @param {Array<{label: string, value: string, highlight: boolean}>} rows - Zeilen
   * @param {object} position - { lng, lat } für Platzierung
   */
  function addResultOverlay(title, rows, position) {
    const container = document.createElement('div');
    container.className = 'measure-result-overlay';

    // Schliessen-Button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'result-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      container.remove();
      const idx = resultOverlays.indexOf(container);
      if (idx > -1) resultOverlays.splice(idx, 1);
    });
    container.appendChild(closeBtn);

    // Titel
    const titleEl = document.createElement('div');
    titleEl.className = 'result-title';
    titleEl.textContent = title;
    container.appendChild(titleEl);

    // Zeilen
    rows.forEach(r => {
      const row = document.createElement('div');
      row.className = 'result-row';
      row.innerHTML = `<span class="label">${r.label}</span><span class="value${r.highlight ? ' highlight' : ''}">${r.value}</span>`;
      container.appendChild(row);
    });

    // Als Popup auf die Karte setzen (nicht als absolutes Overlay, sondern via MapLibre Popup)
    const popup = new maplibregl.Popup({
      closeOnClick: false,
      closeButton: false,
      anchor: 'bottom',
      offset: 15,
      className: 'measure-result-popup',
    })
      .setLngLat([position.lng, position.lat])
      .setDOMContent(container)
      .addTo(map);

    popups.push(popup);
    resultOverlays.push(container);
  }

  // ============================================================
  // MAPLIBRE LAYER-MANAGEMENT
  // ============================================================

  /** Mess-Linie auf der Karte aktualisieren */
  function updateLineLayer(pts, sourceId, layerId, color, dashArray) {
    const coords = pts.map(p => [p.lng, p.lat]);
    const geojson = {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
    };

    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': color || COLORS.lineMeasure,
          'line-width': 3,
          'line-dasharray': dashArray || [1],
        },
      });
    }
  }

  /** Polygon auf der Karte aktualisieren (Fläche + Rand) */
  function updatePolygonLayer(pts) {
    // Ring schliessen
    const coords = pts.map(p => [p.lng, p.lat]);
    if (coords.length > 0) {
      coords.push(coords[0]);
    }

    const geojson = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
    };

    if (map.getSource(SOURCE_POLYGON)) {
      map.getSource(SOURCE_POLYGON).setData(geojson);
    } else {
      map.addSource(SOURCE_POLYGON, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_POLYGON_FILL,
        type: 'fill',
        source: SOURCE_POLYGON,
        paint: {
          'fill-color': COLORS.areaFill,
        },
      });
      map.addLayer({
        id: LAYER_POLYGON_LINE,
        type: 'line',
        source: SOURCE_POLYGON,
        paint: {
          'line-color': COLORS.areaBorder,
          'line-width': 2.5,
          'line-dasharray': [4, 2],
        },
      });
    }
  }

  /** Preview-Linie (gestrichelt, vom letzten Punkt zum Cursor) */
  function updatePreviewLine(fromPt, toCoord) {
    const geojson = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [fromPt.lng, fromPt.lat],
          [toCoord.lng, toCoord.lat],
        ],
      },
    };

    if (map.getSource(SOURCE_PREVIEW)) {
      map.getSource(SOURCE_PREVIEW).setData(geojson);
    } else {
      map.addSource(SOURCE_PREVIEW, { type: 'geojson', data: geojson });
      map.addLayer({
        id: LAYER_PREVIEW,
        type: 'line',
        source: SOURCE_PREVIEW,
        paint: {
          'line-color': COLORS.lineMeasure,
          'line-width': 2,
          'line-dasharray': [4, 4],
          'line-opacity': 0.6,
        },
      });
      previewLineAdded = true;
    }
  }

  /** Alle Mess-Layer von der Karte entfernen */
  function removeAllLayers() {
    const layerIds = [
      LAYER_LINE, LAYER_POLYGON_FILL, LAYER_POLYGON_LINE,
      LAYER_PREVIEW, LAYER_PROFILE_LINE,
    ];
    const sourceIds = [
      SOURCE_LINE, SOURCE_POLYGON, SOURCE_PREVIEW, SOURCE_PROFILE_LINE,
    ];

    layerIds.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    sourceIds.forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });
    previewLineAdded = false;
  }

  /** Alle Marker entfernen */
  function removeAllMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
    labelMarkers.forEach(m => m.remove());
    labelMarkers = [];
    if (profileHoverMarker) {
      profileHoverMarker.remove();
      profileHoverMarker = null;
    }
  }

  /** Alle Popups entfernen */
  function removeAllPopups() {
    popups.forEach(p => p.remove());
    popups = [];
    resultOverlays = [];
  }

  // ============================================================
  // WERKZEUG-AKTIVIERUNG / DEAKTIVIERUNG
  // ============================================================

  /** Aktives Werkzeug stoppen und alle Handler entfernen */
  function deactivateTool() {
    if (mapClickHandler) {
      map.off('click', mapClickHandler);
      mapClickHandler = null;
    }
    if (mapDblClickHandler) {
      map.off('dblclick', mapDblClickHandler);
      mapDblClickHandler = null;
    }
    if (mapMoveHandler) {
      map.off('mousemove', mapMoveHandler);
      mapMoveHandler = null;
    }

    // Crosshair-Cursor entfernen
    document.querySelector('.map-container')?.classList.remove('measure-cursor-active');

    // MapLibre Doppelklick-Zoom reaktivieren
    map.doubleClickZoom.enable();

    activeTool = null;
    points = [];
    hideToolbar();
  }

  /** Cursor auf Crosshair setzen */
  function enableCrosshair() {
    document.querySelector('.map-container')?.classList.add('measure-cursor-active');
  }

  // ============================================================
  // 1. DISTANZMESSUNG
  // ============================================================

  function startDistance() {
    // Altes Werkzeug stoppen (aber Ergebnisse behalten)
    deactivateTool();
    activeTool = 'distance';
    points = [];

    enableCrosshair();
    map.doubleClickZoom.disable();

    showToolbar(
      'Distanzmessung',
      'Klick = Punkt setzen, Doppelklick = beenden',
      [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
    );

    // Klick-Handler: Punkte sammeln
    mapClickHandler = function (e) {
      const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      points.push(pt);

      // Marker setzen
      createPointMarker(pt, points.length === 1);

      // Linie aktualisieren
      if (points.length >= 2) {
        updateLineLayer(points, SOURCE_LINE, LAYER_LINE, COLORS.lineMeasure);

        // Segment-Label
        const prev = points[points.length - 2];
        const segDist = haversine(prev.lng, prev.lat, pt.lng, pt.lat);
        addSegmentLabel(prev, pt, segDist);
      }

      // Toolbar mit laufender Distanz aktualisieren
      const total = totalDistance(points);
      showToolbar(
        'Distanz: ' + formatDistance(total),
        points.length === 1 ? 'Nächsten Punkt klicken...' : 'Doppelklick = beenden',
        [{ label: 'Beenden', cls: '', onClick: finishDistance },
         { label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
      );
    };

    // Mousemove: Preview-Linie
    mapMoveHandler = function (e) {
      if (points.length > 0) {
        updatePreviewLine(points[points.length - 1], e.lngLat);

        // Live-Distanz in Toolbar
        const lastPt = points[points.length - 1];
        const cursorDist = haversine(lastPt.lng, lastPt.lat, e.lngLat.lng, e.lngLat.lat);
        const total = totalDistance(points) + cursorDist;
        showToolbar(
          'Distanz: ' + formatDistance(total),
          'Doppelklick = beenden',
          [{ label: 'Beenden', cls: '', onClick: finishDistance },
           { label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
        );
      }
    };

    // Doppelklick: Messung beenden
    mapDblClickHandler = function (e) {
      e.preventDefault();
      finishDistance();
    };

    map.on('click', mapClickHandler);
    map.on('mousemove', mapMoveHandler);
    map.on('dblclick', mapDblClickHandler);
  }

  /** Distanzmessung abschliessen */
  function finishDistance() {
    if (points.length < 2) {
      deactivateTool();
      cleanupCurrentMeasurement();
      return;
    }

    // Preview-Linie entfernen
    if (map.getLayer(LAYER_PREVIEW)) map.removeLayer(LAYER_PREVIEW);
    if (map.getSource(SOURCE_PREVIEW)) map.removeSource(SOURCE_PREVIEW);
    previewLineAdded = false;

    // Ergebnis berechnen
    const total = totalDistance(points);
    const segments = [];
    for (let i = 1; i < points.length; i++) {
      segments.push(haversine(points[i - 1].lng, points[i - 1].lat, points[i].lng, points[i].lat));
    }

    lastMeasurement = {
      type: 'distance',
      points: [...points],
      totalMeters: total,
      segments: segments,
    };

    // Ergebnis-Overlay am Mittelpunkt der Linie
    const midIdx = Math.floor(points.length / 2);
    addResultOverlay('Distanzmessung', [
      { label: 'Gesamtdistanz', value: formatDistance(total), highlight: true },
      { label: 'Segmente', value: segments.length.toString() },
      { label: 'Punkte', value: points.length.toString() },
    ], points[midIdx]);

    deactivateTool();

    showToolbar(
      'Distanz: ' + formatDistance(total),
      'Messung abgeschlossen',
      [{ label: 'Neue Messung', cls: '', onClick: startDistance },
       { label: 'Löschen', cls: 'danger', onClick: clearMeasurements }]
    );
  }

  // ============================================================
  // 2. FLÄCHENMESSUNG
  // ============================================================

  function startArea() {
    deactivateTool();
    activeTool = 'area';
    points = [];

    enableCrosshair();
    map.doubleClickZoom.disable();

    showToolbar(
      'Flächenmessung',
      'Polygon-Eckpunkte klicken, Doppelklick = beenden',
      [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
    );

    mapClickHandler = function (e) {
      const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      points.push(pt);

      createPointMarker(pt, points.length === 1);

      // Polygon aktualisieren (ab 3 Punkten)
      if (points.length >= 3) {
        updatePolygonLayer(points);

        const area = computePolygonArea(points);
        const perim = computePerimeter(points);
        showToolbar(
          'Fläche: ' + formatArea(area) + ' | Umfang: ' + formatDistance(perim),
          'Doppelklick = beenden',
          [{ label: 'Beenden', cls: '', onClick: finishArea },
           { label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
        );
      } else if (points.length === 2) {
        // Linie zwischen ersten 2 Punkten
        updateLineLayer(points, SOURCE_LINE, LAYER_LINE, COLORS.areaBorder, [4, 2]);
        showToolbar(
          'Flächenmessung',
          'Mindestens 3 Punkte nötig...',
          [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
        );
      }
    };

    // Mousemove: Vorschau-Polygon mit Cursor als temporärem Punkt
    mapMoveHandler = function (e) {
      if (points.length >= 2) {
        const tempPts = [...points, { lng: e.lngLat.lng, lat: e.lngLat.lat }];
        updatePolygonLayer(tempPts);

        if (tempPts.length >= 3) {
          const area = computePolygonArea(tempPts);
          const perim = computePerimeter(tempPts);
          showToolbar(
            'Fläche: ' + formatArea(area) + ' | Umfang: ' + formatDistance(perim),
            'Doppelklick = beenden',
            [{ label: 'Beenden', cls: '', onClick: finishArea },
             { label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
          );
        }
      }
    };

    mapDblClickHandler = function (e) {
      e.preventDefault();
      finishArea();
    };

    map.on('click', mapClickHandler);
    map.on('mousemove', mapMoveHandler);
    map.on('dblclick', mapDblClickHandler);
  }

  /** Flächenmessung abschliessen */
  function finishArea() {
    if (points.length < 3) {
      deactivateTool();
      cleanupCurrentMeasurement();
      return;
    }

    // Finales Polygon zeichnen
    updatePolygonLayer(points);

    // Temporäre Linienlayer aufräumen
    if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE);
    if (map.getSource(SOURCE_LINE)) map.removeSource(SOURCE_LINE);

    const area = computePolygonArea(points);
    const perim = computePerimeter(points);

    lastMeasurement = {
      type: 'area',
      points: [...points],
      areaSqm: area,
      perimeterM: perim,
    };

    // Schwerpunkt für Overlay
    const centroid = {
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    };

    addResultOverlay('Flächenmessung', [
      { label: 'Fläche', value: formatArea(area), highlight: true },
      { label: 'Umfang', value: formatDistance(perim) },
      { label: 'Eckpunkte', value: points.length.toString() },
    ], centroid);

    deactivateTool();

    showToolbar(
      'Fläche: ' + formatArea(area),
      'Messung abgeschlossen',
      [{ label: 'Neue Messung', cls: '', onClick: startArea },
       { label: 'Löschen', cls: 'danger', onClick: clearMeasurements }]
    );
  }

  // ============================================================
  // 3. HÖHENPROFIL (swisstopo API)
  // ============================================================

  function startProfile() {
    deactivateTool();
    activeTool = 'profile';
    points = [];

    enableCrosshair();
    map.doubleClickZoom.disable();

    showToolbar(
      'Höhenprofil',
      'Linie zeichnen (Klick = Stützpunkt, Doppelklick = Profil laden)',
      [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
    );

    mapClickHandler = function (e) {
      const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      points.push(pt);

      createPointMarker(pt, points.length === 1);

      if (points.length >= 2) {
        updateLineLayer(points, SOURCE_PROFILE_LINE, LAYER_PROFILE_LINE, COLORS.profileLine);
      }

      showToolbar(
        'Höhenprofil — ' + points.length + ' Punkte, ' + formatDistance(totalDistance(points)),
        'Doppelklick = Profil laden',
        [{ label: 'Profil laden', cls: '', onClick: finishProfile },
         { label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
      );
    };

    mapMoveHandler = function (e) {
      if (points.length > 0) {
        updatePreviewLine(points[points.length - 1], e.lngLat);
      }
    };

    mapDblClickHandler = function (e) {
      e.preventDefault();
      finishProfile();
    };

    map.on('click', mapClickHandler);
    map.on('mousemove', mapMoveHandler);
    map.on('dblclick', mapDblClickHandler);
  }

  /** Profil-Linie abschliessen und Daten bei swisstopo abrufen */
  async function finishProfile() {
    if (points.length < 2) {
      deactivateTool();
      cleanupCurrentMeasurement();
      return;
    }

    // Punkte sichern bevor deactivateTool aufgerufen wird
    const savedPoints = points.map(p => ({ lng: p.lng, lat: p.lat }));

    // Preview-Linie weg
    if (map.getLayer(LAYER_PREVIEW)) map.removeLayer(LAYER_PREVIEW);
    if (map.getSource(SOURCE_PREVIEW)) map.removeSource(SOURCE_PREVIEW);

    deactivateTool();

    showToolbar('Höhenprofil', 'Lade Profildaten von swisstopo...', []);

    try {
      // Koordinaten WGS84 -> LV95 konvertieren fuer swisstopo API
      const coords = savedPoints.map(p => {
        const ch = wgs84ToCH1903Plus(p.lng, p.lat);
        return [ch.E, ch.N];
      });
      const geom = JSON.stringify({
        type: 'LineString',
        coordinates: coords,
      });

      const url = `${SWISSTOPO_PROFILE_API}?geom=${encodeURIComponent(geom)}&sr=2056&nb_points=100`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('swisstopo API Fehler: ' + response.status);
      }

      profileData = await response.json();

      if (!profileData || profileData.length === 0) {
        throw new Error('Keine Profildaten erhalten');
      }

      lastMeasurement = {
        type: 'profile',
        points: [...savedPoints],
        profileData: profileData,
        totalDistance: totalDistance(savedPoints),
      };

      hideToolbar();
      showProfilePanel(profileData);

    } catch (err) {
      console.error('Höhenprofil-Fehler:', err);
      showToolbar(
        'Fehler: ' + err.message,
        '',
        [{ label: 'Erneut versuchen', cls: '', onClick: () => startProfile() },
         { label: 'Schliessen', cls: 'danger', onClick: () => { hideToolbar(); } }]
      );
    }
  }

  /**
   * Profil-Panel am unteren Kartenrand anzeigen.
   * @param {Array} data - swisstopo Profil-Daten
   */
  function showProfilePanel(data) {
    // Panel erstellen falls nötig
    if (!profilePanel) {
      profilePanel = document.createElement('div');
      profilePanel.className = 'profile-panel';

      profilePanel.innerHTML = `
        <div class="profile-panel-header">
          <div class="panel-title">
            <span class="icon">&#9650;</span>
            <span>Höhenprofil</span>
          </div>
          <div class="panel-controls">
            <button class="minimize-btn" title="Minimieren">&#8211;</button>
            <button class="close-btn" title="Schliessen">&times;</button>
          </div>
        </div>
        <div class="profile-panel-body">
          <div class="profile-chart-container">
            <canvas id="profile-canvas"></canvas>
            <div class="profile-tooltip hidden" id="profile-tooltip"></div>
          </div>
          <div class="profile-stats" id="profile-stats"></div>
        </div>
      `;

      document.querySelector('.map-container').appendChild(profilePanel);

      // Event-Listener
      profilePanel.querySelector('.minimize-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        profilePanel.classList.toggle('minimized');
      });

      profilePanel.querySelector('.close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        closeProfilePanel();
      });

      profilePanel.querySelector('.profile-panel-header').addEventListener('click', () => {
        if (profilePanel.classList.contains('minimized')) {
          profilePanel.classList.remove('minimized');
        }
      });
    }

    // Statistiken berechnen
    const heights = data.map(d => d.alts.COMB);
    const distances = data.map(d => d.dist);
    const minHeight = Math.min(...heights);
    const maxHeight = Math.max(...heights);
    const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    const totalDist = distances[distances.length - 1];
    const heightDiff = heights[heights.length - 1] - heights[0];
    const maxSlope = computeMaxSlope(data);

    // Statistiken rendern
    const statsEl = profilePanel.querySelector('#profile-stats');
    statsEl.innerHTML = `
      <div class="profile-stat-item">
        <div class="stat-label">Distanz</div>
        <div class="stat-value">${formatDistance(totalDist)}</div>
      </div>
      <div class="profile-stat-item">
        <div class="stat-label">Min. Höhe</div>
        <div class="stat-value">${minHeight.toFixed(1)} m</div>
      </div>
      <div class="profile-stat-item">
        <div class="stat-label">Max. Höhe</div>
        <div class="stat-value orange">${maxHeight.toFixed(1)} m</div>
      </div>
      <div class="profile-stat-item">
        <div class="stat-label">Durchschnitt</div>
        <div class="stat-value">${avgHeight.toFixed(1)} m</div>
      </div>
      <div class="profile-stat-item">
        <div class="stat-label">Höhendiff.</div>
        <div class="stat-value">${heightDiff >= 0 ? '+' : ''}${heightDiff.toFixed(1)} m</div>
      </div>
      <div class="profile-stat-item">
        <div class="stat-label">Max. Steigung</div>
        <div class="stat-value orange">${maxSlope.toFixed(1)} %</div>
      </div>
    `;

    // Panel öffnen (Animation)
    profilePanel.classList.remove('minimized');
    requestAnimationFrame(() => {
      profilePanel.classList.add('open');
    });

    // Chart zeichnen (nach Transition-Ende damit Container-Groesse stimmt)
    setTimeout(() => {
      drawProfileChart(data);
    }, 500);
  }

  /**
   * Maximale Steigung zwischen benachbarten Profil-Punkten berechnen.
   * @param {Array} data
   * @returns {number} Steigung in %
   */
  function computeMaxSlope(data) {
    let maxSlope = 0;
    for (let i = 1; i < data.length; i++) {
      const dDist = data[i].dist - data[i - 1].dist;
      const dHeight = Math.abs(data[i].alts.COMB - data[i - 1].alts.COMB);
      if (dDist > 0) {
        const slope = (dHeight / dDist) * 100;
        if (slope > maxSlope) maxSlope = slope;
      }
    }
    return maxSlope;
  }

  /**
   * Profil-Chart auf Canvas zeichnen.
   * @param {Array} data - swisstopo Profildaten
   */
  function drawProfileChart(data) {
    const canvas = document.getElementById('profile-canvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    // Canvas-Grösse an Container anpassen (responsive)
    // Fallback-Groesse falls Container noch nicht sichtbar
    const cW = container.clientWidth || 800;
    const cH = container.clientHeight || 196;
    canvas.width = cW * dpr;
    canvas.height = cH * dpr;
    canvas.style.width = cW + 'px';
    canvas.style.height = cH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    profileChart = ctx;

    const W = cW;
    const H = cH;

    // Ränder für Achsen
    const margin = { top: 10, right: 16, bottom: 30, left: 50 };
    const chartW = W - margin.left - margin.right;
    const chartH = H - margin.top - margin.bottom;

    // Daten extrahieren
    const distances = data.map(d => d.dist);
    const heights = data.map(d => d.alts.COMB);
    const minDist = 0;
    const maxDist = distances[distances.length - 1];
    const minH = Math.min(...heights) - 5; // etwas Puffer
    const maxH = Math.max(...heights) + 5;

    // Skalierungsfunktionen
    const scaleX = (dist) => margin.left + (dist / maxDist) * chartW;
    const scaleY = (h) => margin.top + chartH - ((h - minH) / (maxH - minH)) * chartH;

    // Hintergrund
    ctx.fillStyle = '#FAFBFC';
    ctx.fillRect(0, 0, W, H);

    // Gitterlinien (horizontal)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 0.5;
    const hSteps = 5;
    for (let i = 0; i <= hSteps; i++) {
      const h = minH + (i / hSteps) * (maxH - minH);
      const y = scaleY(h);
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(W - margin.right, y);
      ctx.stroke();
    }

    // Fläche unter der Linie (Farbverlauf)
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartH);
    gradient.addColorStop(0, 'rgba(232, 131, 58, 0.25)');
    gradient.addColorStop(1, 'rgba(232, 131, 58, 0.02)');

    ctx.beginPath();
    ctx.moveTo(scaleX(distances[0]), scaleY(heights[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(scaleX(distances[i]), scaleY(heights[i]));
    }
    ctx.lineTo(scaleX(distances[distances.length - 1]), margin.top + chartH);
    ctx.lineTo(scaleX(distances[0]), margin.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Profil-Linie
    ctx.beginPath();
    ctx.moveTo(scaleX(distances[0]), scaleY(heights[0]));
    for (let i = 1; i < data.length; i++) {
      ctx.lineTo(scaleX(distances[i]), scaleY(heights[i]));
    }
    ctx.strokeStyle = COLORS.orange;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Y-Achse (Höhe)
    ctx.fillStyle = COLORS.navy;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    for (let i = 0; i <= hSteps; i++) {
      const h = minH + (i / hSteps) * (maxH - minH);
      const y = scaleY(h);
      ctx.fillText(Math.round(h) + 'm', margin.left - 6, y + 3);
    }

    // X-Achse (Distanz)
    ctx.textAlign = 'center';
    const dSteps = 5;
    for (let i = 0; i <= dSteps; i++) {
      const d = (i / dSteps) * maxDist;
      const x = scaleX(d);
      ctx.fillText(formatDistance(d), x, H - 6);

      // Tick
      ctx.beginPath();
      ctx.moveTo(x, margin.top + chartH);
      ctx.lineTo(x, margin.top + chartH + 4);
      ctx.strokeStyle = COLORS.navy;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Achsen-Linien
    ctx.strokeStyle = COLORS.navy;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + chartH);
    ctx.lineTo(W - margin.right, margin.top + chartH);
    ctx.stroke();

    // Hover-Interaktion
    setupProfileHover(canvas, data, margin, chartW, chartH, maxDist, minH, maxH, scaleX, scaleY);
  }

  /**
   * Hover-Interaktion für den Profil-Chart.
   * Zeigt Tooltip und bewegt Marker auf der Karte.
   */
  function setupProfileHover(canvas, data, margin, chartW, chartH, maxDist, minH, maxH, scaleX, scaleY) {
    const tooltip = document.getElementById('profile-tooltip');
    const container = canvas.parentElement;

    // Events direkt auf dem Container (nicht Canvas klonen — das loescht den Inhalt)
    container.addEventListener('mousemove', function handleProfileMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Prüfe ob im Chart-Bereich
      if (x < margin.left || x > margin.left + chartW || y < margin.top || y > margin.top + chartH) {
        tooltip.classList.add('hidden');
        if (profileHoverMarker) profileHoverMarker.remove();
        profileHoverMarker = null;
        return;
      }

      // Distanz am Cursor
      const dist = ((x - margin.left) / chartW) * maxDist;

      // Nächsten Datenpunkt finden
      let closest = 0;
      let minDiff = Infinity;
      for (let i = 0; i < data.length; i++) {
        const diff = Math.abs(data[i].dist - dist);
        if (diff < minDiff) {
          minDiff = diff;
          closest = i;
        }
      }

      const dp = data[closest];
      const height = dp.alts.COMB;

      // Steigung zum vorherigen Punkt
      let slope = 0;
      if (closest > 0) {
        const dd = dp.dist - data[closest - 1].dist;
        const dh = height - data[closest - 1].alts.COMB;
        if (dd > 0) slope = (dh / dd) * 100;
      }

      // Tooltip positionieren
      tooltip.classList.remove('hidden');
      tooltip.innerHTML = `${height.toFixed(1)} m ü.M.<br>${formatDistance(dp.dist)} | ${slope.toFixed(1)}%`;
      tooltip.style.left = (x + 12) + 'px';
      tooltip.style.top = (y - 30) + 'px';

      // Punkt auf der Karte markieren
      if (dp.easting && dp.northing) {
        // swisstopo gibt easting/northing in LV95 zurück — wir haben aber WGS84 Koordinaten
        // Nutze die interpolierten Koordinaten basierend auf dist-Anteil
        showProfileHoverOnMap(dp, data);
      }
    });

    container.addEventListener('mouseleave', function () {
      tooltip.classList.add('hidden');
      if (profileHoverMarker) {
        profileHoverMarker.remove();
        profileHoverMarker = null;
      }
    });
  }

  /**
   * Hover-Punkt auf der Karte während Profil-Anzeige.
   */
  function showProfileHoverOnMap(dp, data) {
    // Position aus den Profildaten interpolieren
    // Die swisstopo API gibt easting/northing in LV95 zurück,
    // aber wir nutzen die originale Linie und interpolieren via dist
    const totalDist = data[data.length - 1].dist;
    const frac = dp.dist / totalDist;

    // Interpoliere auf der Original-Linie
    const linePoints = lastMeasurement?.points;
    if (!linePoints || linePoints.length < 2) return;

    const interpCoords = interpolateLine(linePoints, data.length);
    const idx = data.indexOf(dp);
    if (idx < 0 || idx >= interpCoords.length) return;

    const [lng, lat] = interpCoords[idx];

    if (profileHoverMarker) {
      profileHoverMarker.setLngLat([lng, lat]);
    } else {
      const el = document.createElement('div');
      el.style.cssText = 'width:10px;height:10px;background:#E8833A;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
      profileHoverMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .addTo(map);
    }
  }

  /** Profil-Panel schliessen */
  function closeProfilePanel() {
    if (profilePanel) {
      profilePanel.classList.remove('open');
      // Hover-Marker entfernen
      if (profileHoverMarker) {
        profileHoverMarker.remove();
        profileHoverMarker = null;
      }
    }
  }

  // ============================================================
  // 4. PUNKT-HÖHENABFRAGE (swisstopo API)
  // ============================================================

  function startHeight() {
    deactivateTool();
    activeTool = 'height';

    enableCrosshair();

    showToolbar(
      'Höhenabfrage',
      'Klick auf einen Punkt auf der Karte',
      [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); } }]
    );

    mapClickHandler = async function (e) {
      const { lng, lat } = e.lngLat;

      showToolbar('Höhenabfrage', 'Lade Höhe von swisstopo...', []);

      try {
        // WGS84 -> LV95 konvertieren (swisstopo API braucht EPSG:2056)
        const ch = wgs84ToCH1903Plus(lng, lat);
        const url = `${SWISSTOPO_HEIGHT_API}?easting=${ch.E}&northing=${ch.N}&sr=2056`;
        const response = await fetch(url);

        if (!response.ok) throw new Error('API Fehler: ' + response.status);

        const data = await response.json();
        const height = parseFloat(data.height);

        lastMeasurement = {
          type: 'height',
          lng: lng,
          lat: lat,
          height: height,
          ch1903: ch,
        };

        // Popup auf der Karte
        const popupContent = document.createElement('div');
        popupContent.className = 'height-popup';
        popupContent.innerHTML = `
          <div class="popup-title">
            Höhe: <span class="height-value">${typeof height === 'number' ? height.toFixed(1) : height} m ü.M.</span>
          </div>
          <div class="coord-section">
            <div class="coord-row">
              <span class="coord-label">WGS84 Lat</span>
              <span class="coord-value">${lat.toFixed(6)}</span>
            </div>
            <div class="coord-row">
              <span class="coord-label">WGS84 Lon</span>
              <span class="coord-value">${lng.toFixed(6)}</span>
            </div>
            <div class="coord-row">
              <span class="coord-label">CH1903+ E</span>
              <span class="coord-value">${formatNumber(ch.E)}</span>
            </div>
            <div class="coord-row">
              <span class="coord-label">CH1903+ N</span>
              <span class="coord-value">${formatNumber(ch.N)}</span>
            </div>
          </div>
        `;

        // Marker setzen
        createPointMarker({ lng, lat }, true);

        const popup = new maplibregl.Popup({ closeButton: true, offset: 15, maxWidth: '260px' })
          .setLngLat([lng, lat])
          .setDOMContent(popupContent)
          .addTo(map);
        popups.push(popup);

        hideToolbar();
        showToolbar(
          'Höhe: ' + (typeof height === 'number' ? height.toFixed(1) : height) + ' m ü.M.',
          '',
          [{ label: 'Neuer Punkt', cls: '', onClick: startHeight },
           { label: 'Löschen', cls: 'danger', onClick: clearMeasurements }]
        );

      } catch (err) {
        console.error('Höhenabfrage-Fehler:', err);
        showToolbar(
          'Fehler: ' + err.message,
          '',
          [{ label: 'Erneut', cls: '', onClick: startHeight },
           { label: 'Schliessen', cls: 'danger', onClick: hideToolbar }]
        );
      }

      // Werkzeug bleibt aktiv für weiteren Klick, Handler nicht entfernen
    };

    map.on('click', mapClickHandler);
  }

  // ============================================================
  // 5. NEIGUNGS-/GEFÄLLE-ANALYSE
  // ============================================================

  function startSlope() {
    deactivateTool();
    activeTool = 'slope';
    points = [];

    enableCrosshair();

    showToolbar(
      'Neigungs-Analyse',
      'Klick auf Startpunkt (2 Punkte nötig)',
      [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
    );

    mapClickHandler = async function (e) {
      const pt = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      points.push(pt);

      createPointMarker(pt, points.length === 1);

      if (points.length === 1) {
        showToolbar(
          'Neigungs-Analyse',
          'Jetzt Endpunkt klicken...',
          [{ label: 'Abbrechen', cls: 'danger', onClick: () => { deactivateTool(); cleanupCurrentMeasurement(); } }]
        );
      }

      if (points.length === 2) {
        // Linie zeichnen
        updateLineLayer(points, SOURCE_LINE, LAYER_LINE, COLORS.slopeLine);

        showToolbar('Neigungs-Analyse', 'Lade Höhen von swisstopo...', []);

        // Handler entfernen, bevor async
        map.off('click', mapClickHandler);
        mapClickHandler = null;

        try {
          // Höhe für beide Punkte abfragen
          const [h1, h2] = await Promise.all([
            fetchHeight(points[0].lng, points[0].lat),
            fetchHeight(points[1].lng, points[1].lat),
          ]);

          const dist = haversine(points[0].lng, points[0].lat, points[1].lng, points[1].lat);
          const heightDiff = h2 - h1;
          const slope = dist > 0 ? (heightDiff / dist) * 100 : 0;
          const angle = Math.atan2(Math.abs(heightDiff), dist) * (180 / Math.PI);

          lastMeasurement = {
            type: 'slope',
            points: [...points],
            height1: h1,
            height2: h2,
            distance: dist,
            heightDiff: heightDiff,
            slopePercent: slope,
            angleDeg: angle,
          };

          // Ergebnis als Popup am Mittelpunkt
          const mid = midpoint(points[0], points[1]);
          const popupContent = document.createElement('div');
          popupContent.className = 'slope-result';
          popupContent.innerHTML = `
            <div class="slope-main">
              <span class="slope-value">${slope.toFixed(1)}</span><span class="slope-unit">%</span>
            </div>
            <div class="slope-detail">
              <div class="row">
                <span class="label">Horizontaldistanz</span>
                <span class="val">${formatDistance(dist)}</span>
              </div>
              <div class="row">
                <span class="label">Höhe Punkt A</span>
                <span class="val">${h1.toFixed(1)} m ü.M.</span>
              </div>
              <div class="row">
                <span class="label">Höhe Punkt B</span>
                <span class="val">${h2.toFixed(1)} m ü.M.</span>
              </div>
              <div class="row">
                <span class="label">Höhendifferenz</span>
                <span class="val">${heightDiff >= 0 ? '+' : ''}${heightDiff.toFixed(1)} m</span>
              </div>
              <div class="row">
                <span class="label">Neigungswinkel</span>
                <span class="val">${angle.toFixed(1)}°</span>
              </div>
              <div class="row">
                <span class="label">Gefälle</span>
                <span class="val">${slope >= 0 ? 'ansteigend' : 'abfallend'}</span>
              </div>
            </div>
          `;

          // Segment-Label mit Neigung
          addSegmentLabel(points[0], points[1], dist);

          const popup = new maplibregl.Popup({ closeButton: true, offset: 15, maxWidth: '280px' })
            .setLngLat([mid.lng, mid.lat])
            .setDOMContent(popupContent)
            .addTo(map);
          popups.push(popup);

          deactivateTool();
          showToolbar(
            'Neigung: ' + slope.toFixed(1) + '% | Diff: ' + heightDiff.toFixed(1) + 'm',
            '',
            [{ label: 'Neue Analyse', cls: '', onClick: startSlope },
             { label: 'Löschen', cls: 'danger', onClick: clearMeasurements }]
          );

        } catch (err) {
          console.error('Neigungs-Analyse Fehler:', err);
          deactivateTool();
          showToolbar(
            'Fehler: ' + err.message,
            '',
            [{ label: 'Erneut', cls: '', onClick: startSlope },
             { label: 'Schliessen', cls: 'danger', onClick: hideToolbar }]
          );
        }
      }
    };

    // Mousemove: Preview-Linie
    mapMoveHandler = function (e) {
      if (points.length === 1) {
        updatePreviewLine(points[0], e.lngLat);
      }
    };

    map.on('click', mapClickHandler);
    map.on('mousemove', mapMoveHandler);
  }

  /**
   * Höhe eines einzelnen Punkts bei swisstopo abfragen.
   * @param {number} lng
   * @param {number} lat
   * @returns {Promise<number>} Höhe in m ü.M.
   */
  async function fetchHeight(lng, lat) {
    const ch = wgs84ToCH1903Plus(lng, lat);
    const url = `${SWISSTOPO_HEIGHT_API}?easting=${ch.E}&northing=${ch.N}&sr=2056`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Höhen-API Fehler: ' + response.status);
    const data = await response.json();
    return parseFloat(data.height);
  }

  // ============================================================
  // AUFRÄUMEN
  // ============================================================

  /** Aktuelle, noch nicht abgeschlossene Messung aufräumen */
  function cleanupCurrentMeasurement() {
    removeAllLayers();
    removeAllMarkers();
    removeAllPopups();
    closeProfilePanel();
    hideToolbar();
    points = [];
  }

  /** Alle Messungen löschen (inkl. abgeschlossene Ergebnisse) */
  function clearMeasurements() {
    deactivateTool();
    removeAllLayers();
    removeAllMarkers();
    removeAllPopups();
    closeProfilePanel();
    hideToolbar();
    points = [];
    lastMeasurement = null;
    profileData = null;
  }

  /**
   * Letzte Messung abrufen.
   * @returns {object|null} Letztes Messergebnis
   */
  function getLastMeasurement() {
    return lastMeasurement;
  }

  // ============================================================
  // ÖFFENTLICHE API
  // ============================================================

  window.MeasureModule = {
    startDistance: startDistance,
    startArea: startArea,
    startProfile: startProfile,
    startHeight: startHeight,
    startSlope: startSlope,
    clearMeasurements: clearMeasurements,
    getLastMeasurement: getLastMeasurement,
  };

  // ── Integration mit bestehender activateTool-Funktion ──
  // Überschreibe die Platzhalter-Funktion in app.js
  const originalActivateTool = window.activateTool;
  window.activateTool = function (tool) {
    switch (tool) {
      case 'measure':
        MeasureModule.startDistance();
        break;
      case 'area':
        MeasureModule.startArea();
        break;
      case 'profile':
        MeasureModule.startProfile();
        break;
      default:
        // Fallback auf Original
        if (originalActivateTool) originalActivateTool(tool);
    }
  };

  console.log('[BAUSITE Geo] Mess- und Analysewerkzeuge geladen');

})();
