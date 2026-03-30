// ============================================
// BAUSITE Geo — Kubatur & Kosten Modul
// Graben-Rechner, Flaechen-Rechner,
// Massenliste (NPK), Einheitspreise
// Region: Schweiz / CHF / 2026
// ============================================

(function () {
  'use strict';

  // ────────────────────────────────────────────
  // 1. STANDARD-EINHEITSPREISE (Schweizer Markt 2026)
  //    Werden aus localStorage geladen falls vorhanden,
  //    sonst kommen diese Defaults zum Einsatz.
  //    NPK-Nummern gemaess Schweizer Bau-Katalog.
  // ────────────────────────────────────────────

  const DEFAULT_PREISE = {
    // --- 112 Aushub / Hinterfuellung ---
    aushub_masch:       { npk: '112.100', beschreibung: 'Aushub maschinell',            einheit: 'm\u00B3', preis: 42  },
    aushub_hand:        { npk: '112.200', beschreibung: 'Aushub von Hand',              einheit: 'm\u00B3', preis: 180 },
    hinterfuellung:     { npk: '112.500', beschreibung: 'Hinterf\u00FCllung verdichtet',einheit: 'm\u00B3', preis: 38  },
    deponie_sauber:     { npk: '112.810', beschreibung: 'Deponie sauber (Typ A)',       einheit: 'm\u00B3', preis: 18  },
    deponie_belastet:   { npk: '112.820', beschreibung: 'Deponie belastet (Typ B)',     einheit: 'm\u00B3', preis: 85  },
    transport_aushub:   { npk: '112.900', beschreibung: 'Transport Aushub (LKW)',       einheit: 'm\u00B3', preis: 12  },

    // --- Verfuellmaterialien ---
    kies_verfuellung:   { npk: '112.510', beschreibung: 'Kies-Verf\u00FCllung 0/45',   einheit: 'm\u00B3', preis: 55  },
    beton_verfuellung:  { npk: '112.520', beschreibung: 'Beton C25/30',                 einheit: 'm\u00B3', preis: 220 },
    magerbeton:         { npk: '112.530', beschreibung: 'Magerbeton C12/15',             einheit: 'm\u00B3', preis: 195 },
    aushub_verfuellung: { npk: '112.540', beschreibung: 'Aushub-R\u00FCckf\u00FCllung', einheit: 'm\u00B3', preis: 15  },
    bettung_sand:       { npk: '112.550', beschreibung: 'Bettung Sand/Kies 0/16',       einheit: 'm\u00B3', preis: 48  },

    // --- 151 Kanalisationen ---
    rohr_beton_dn400:   { npk: '151.200', beschreibung: 'Betonrohr DN400',              einheit: 'm',       preis: 180 },
    schacht_beton:      { npk: '151.500', beschreibung: 'Kontrollschacht Beton',        einheit: 'Stk',     preis: 4500},

    // --- 152 Wasser ---
    rohr_pe_dn100:      { npk: '152.100', beschreibung: 'PE-Rohr DN100',                einheit: 'm',       preis: 45  },
    rohr_pe_dn150:      { npk: '152.110', beschreibung: 'PE-Rohr DN150',                einheit: 'm',       preis: 68  },
    hausanschluss:      { npk: '152.500', beschreibung: 'Hausanschluss Wasser',         einheit: 'Stk',     preis: 2800},
    schieber:           { npk: '152.600', beschreibung: 'Schieber DN100',               einheit: 'Stk',     preis: 1200},

    // --- 153 Gas ---
    rohr_pe_gas_dn100:  { npk: '153.100', beschreibung: 'PE-Rohr Gas DN100',            einheit: 'm',       preis: 52  },

    // --- 221 Unterlagsboden / Fundation ---
    fundation:          { npk: '221.100', beschreibung: 'Fundationsschicht 0/45',       einheit: 'm\u00B3', preis: 58  },
    planie:             { npk: '221.200', beschreibung: 'Planie maschinell',             einheit: 'm\u00B2', preis: 8   },

    // --- 223 Belag ---
    asphalt_ac11:       { npk: '223.100', beschreibung: 'Asphalt AC11 (6cm)',           einheit: 'm\u00B2', preis: 85  },
    pflaster:           { npk: '223.200', beschreibung: 'Pflaster Beton',                einheit: 'm\u00B2', preis: 120 },
    kies_belag:         { npk: '223.300', beschreibung: 'Kiesbelag Deckschicht',         einheit: 'm\u00B2', preis: 28  },
    gruenflaeche:       { npk: '223.400', beschreibung: 'Humus + Ansaat (Gr\u00FCnfl.)',einheit: 'm\u00B2', preis: 18  },
  };

  // ────────────────────────────────────────────
  // 2. ZUSTAND (State)
  // ────────────────────────────────────────────

  /** Aktive Einheitspreise (editierbar) */
  let preise = {};

  /** Massenliste: Array von { id, npk, beschreibung, einheit, menge, ep } */
  let massenliste = [];

  /** Zeichnungsmodus */
  let drawMode = null; // 'graben' | 'flaeche' | null

  /** Gezeichnete Punkte (LngLat-Arrays) */
  let drawPoints = [];

  /** Temporaere MapLibre Source/Layer IDs */
  const DRAW_SOURCE = 'kubatur-draw-src';
  const DRAW_LINE   = 'kubatur-draw-line';
  const DRAW_FILL   = 'kubatur-draw-fill';
  const DRAW_POINTS = 'kubatur-draw-pts';

  /** DOM-Referenz auf das Panel */
  let panelEl = null;

  /** Cursor-Tooltip */
  let tooltipEl = null;

  /** Naechste ID fuer Massenliste */
  let nextMlId = 1;

  // ────────────────────────────────────────────
  // 3. INITIALISIERUNG
  // ────────────────────────────────────────────

  /** Preise aus localStorage laden oder Defaults verwenden */
  function initPreise() {
    const stored = localStorage.getItem('bausite_einheitspreise');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Defaults als Basis, gespeicherte Preise ueberlagern
        preise = {};
        Object.keys(DEFAULT_PREISE).forEach(key => {
          preise[key] = { ...DEFAULT_PREISE[key] };
          if (parsed[key] !== undefined) {
            preise[key].preis = parsed[key];
          }
        });
      } catch (e) {
        console.warn('[Kubatur] localStorage-Preise ungueltig, verwende Defaults');
        resetPreise();
      }
    } else {
      resetPreise();
    }
  }

  /** Defaults wiederherstellen */
  function resetPreise() {
    preise = {};
    Object.keys(DEFAULT_PREISE).forEach(key => {
      preise[key] = { ...DEFAULT_PREISE[key] };
    });
  }

  /** Preise in localStorage speichern */
  function savePreise() {
    const obj = {};
    Object.keys(preise).forEach(key => {
      obj[key] = preise[key].preis;
    });
    localStorage.setItem('bausite_einheitspreise', JSON.stringify(obj));
  }

  // Beim Laden initialisieren
  initPreise();

  // ────────────────────────────────────────────
  // 4. HILFSFUNKTIONEN
  // ────────────────────────────────────────────

  /**
   * Schweizer Zahlenformatierung:
   * Tausender-Apostroph, 2 Dezimalstellen fuer CHF
   * z.B. 20'345.50
   */
  function chf(betrag) {
    const parts = betrag.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u2019');
    return 'CHF ' + parts.join('.');
  }

  /** Zahl mit Apostroph-Tausender (ohne Dezimal) */
  function fmtNum(n, decimals) {
    if (decimals === undefined) decimals = 0;
    const fixed = n.toFixed(decimals);
    const parts = fixed.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u2019');
    return parts.join('.');
  }

  /**
   * Haversine-Distanz zwischen zwei [lng, lat]-Punkten in Metern.
   * Verwendet WGS84-Erdradius.
   */
  function haversine(a, b) {
    const R = 6371000; // Erdradius in Metern
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Gesamtlaenge einer Polylinie (Array von [lng,lat]) in Metern */
  function polylineLength(pts) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += haversine(pts[i - 1], pts[i]);
    }
    return total;
  }

  /**
   * Flaeche eines einfachen Polygons (Array von [lng,lat]) in m²
   * Verwendet Shoelace-Formel auf projizierte Koordinaten (Mercator-Naeherung).
   */
  function polygonArea(pts) {
    if (pts.length < 3) return 0;
    const toRad = (d) => d * Math.PI / 180;
    // Referenzpunkt = Schwerpunkt
    const refLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(toRad(refLat));

    // In lokale Meter umrechnen
    const projected = pts.map(p => [
      (p[0] - pts[0][0]) * mPerDegLng,
      (p[1] - pts[0][1]) * mPerDegLat,
    ]);

    // Shoelace
    let area = 0;
    for (let i = 0; i < projected.length; i++) {
      const j = (i + 1) % projected.length;
      area += projected[i][0] * projected[j][1];
      area -= projected[j][0] * projected[i][1];
    }
    return Math.abs(area / 2);
  }

  /** Erzeugt eine eindeutige ID */
  function uid() {
    return 'kb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  // ────────────────────────────────────────────
  // 5. PANEL-VERWALTUNG (DOM)
  // ────────────────────────────────────────────

  /** Erstellt das Panel-DOM falls noch nicht vorhanden */
  function ensurePanel() {
    if (panelEl) return panelEl;

    panelEl = document.createElement('div');
    panelEl.className = 'kubatur-panel';
    panelEl.id = 'kubatur-panel';
    document.body.appendChild(panelEl);

    return panelEl;
  }

  /** Panel oeffnen mit Inhalt */
  function openPanel(title, icon, bodyHtml, extraClass) {
    ensurePanel();
    panelEl.className = 'kubatur-panel' + (extraClass ? ' ' + extraClass : '');

    panelEl.innerHTML =
      '<div class="kubatur-panel-header">' +
        '<h3><span class="panel-icon">' + icon + '</span> ' + title + '</h3>' +
        '<button class="kubatur-panel-close" onclick="window.KubaturModule._closePanel()">\u2715</button>' +
      '</div>' +
      '<div class="kubatur-panel-body">' + bodyHtml + '</div>';

    // Oeffne mit kurzem Delay fuer CSS-Transition
    requestAnimationFrame(function () {
      panelEl.classList.add('open');
    });
  }

  /** Panel schliessen und Zeichenmodus beenden */
  function closePanel() {
    if (panelEl) {
      panelEl.classList.remove('open');
    }
    stopDrawing();
  }

  // ────────────────────────────────────────────
  // 6. KARTEN-ZEICHNUNG (MapLibre Draw)
  // ────────────────────────────────────────────

  /** Zeichnen starten (Modus: 'graben' oder 'flaeche') */
  function startDrawing(mode) {
    stopDrawing(); // Vorherige Zeichnung aufraumen
    drawMode = mode;
    drawPoints = [];

    // Source und Layer anlegen
    if (!map.getSource(DRAW_SOURCE)) {
      map.addSource(DRAW_SOURCE, {
        type: 'geojson',
        data: emptyGeoJSON()
      });
    }

    // Linie (fuer Graben und Polygon-Rand)
    if (!map.getLayer(DRAW_LINE)) {
      map.addLayer({
        id: DRAW_LINE,
        type: 'line',
        source: DRAW_SOURCE,
        paint: {
          'line-color': '#E8833A',
          'line-width': 3,
          'line-dasharray': [3, 2],
        },
        filter: ['in', '$type', 'LineString', 'Polygon']
      });
    }

    // Polygon-Fuellung (nur fuer Flaechen-Modus)
    if (!map.getLayer(DRAW_FILL)) {
      map.addLayer({
        id: DRAW_FILL,
        type: 'fill',
        source: DRAW_SOURCE,
        paint: {
          'fill-color': 'rgba(232, 131, 58, 0.15)',
          'fill-outline-color': '#E8833A',
        },
        filter: ['==', '$type', 'Polygon']
      });
    }

    // Punkte
    if (!map.getLayer(DRAW_POINTS)) {
      map.addLayer({
        id: DRAW_POINTS,
        type: 'circle',
        source: DRAW_SOURCE,
        paint: {
          'circle-radius': 5,
          'circle-color': '#E8833A',
          'circle-stroke-color': 'white',
          'circle-stroke-width': 2,
        },
        filter: ['==', '$type', 'Point']
      });
    }

    // Cursor aendern
    map.getCanvas().classList.add('kb-draw-cursor');

    // Tooltip erstellen
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'kb-cursor-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);

    // Event-Listener
    map.on('click', onDrawClick);
    map.on('dblclick', onDrawDblClick);
    map.on('mousemove', onDrawMouseMove);

    // Doppelklick-Zoom deaktivieren waehrend Zeichnen
    map.doubleClickZoom.disable();
  }

  /** Zeichnen beenden und aufraeumen */
  function stopDrawing() {
    drawMode = null;

    map.off('click', onDrawClick);
    map.off('dblclick', onDrawDblClick);
    map.off('mousemove', onDrawMouseMove);

    map.getCanvas().classList.remove('kb-draw-cursor');
    map.doubleClickZoom.enable();

    // Tooltip entfernen
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }

    // Layer/Source entfernen
    [DRAW_LINE, DRAW_FILL, DRAW_POINTS].forEach(function (id) {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(DRAW_SOURCE)) map.removeSource(DRAW_SOURCE);
  }

  /** Klick auf Karte: Punkt hinzufuegen */
  function onDrawClick(e) {
    drawPoints.push([e.lngLat.lng, e.lngLat.lat]);
    updateDrawGeometry();
    updateLiveCalculation();
  }

  /** Doppelklick: Zeichnung abschliessen */
  function onDrawDblClick(e) {
    e.preventDefault();
    // Letzten (doppelten) Punkt nicht nochmal hinzufuegen
    if (drawPoints.length >= 2) {
      updateDrawGeometry();
      updateLiveCalculation();
    }
  }

  /** Mousemove: Tooltip mit Distanz aktualisieren */
  function onDrawMouseMove(e) {
    if (!tooltipEl) return;

    tooltipEl.style.left = (e.originalEvent.clientX + 16) + 'px';
    tooltipEl.style.top  = (e.originalEvent.clientY - 10) + 'px';

    if (drawPoints.length === 0) {
      tooltipEl.style.display = 'block';
      tooltipEl.textContent = 'Klicken = Punkt setzen';
      return;
    }

    const lastPt = drawPoints[drawPoints.length - 1];
    const curPt  = [e.lngLat.lng, e.lngLat.lat];
    const segDist = haversine(lastPt, curPt);
    const totalDist = polylineLength(drawPoints) + segDist;

    tooltipEl.style.display = 'block';
    if (drawMode === 'graben') {
      tooltipEl.textContent = fmtNum(totalDist, 1) + ' m | Doppelklick = Abschluss';
    } else {
      tooltipEl.textContent = fmtNum(totalDist, 1) + ' m Umfang | Doppelklick = Abschluss';
    }
  }

  /** Zeichnungs-GeoJSON aktualisieren */
  function updateDrawGeometry() {
    var features = [];

    // Punkte
    drawPoints.forEach(function (pt) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {}
      });
    });

    if (drawPoints.length >= 2) {
      if (drawMode === 'graben') {
        // Linie
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: drawPoints },
          properties: {}
        });
      } else if (drawMode === 'flaeche') {
        // Polygon (geschlossen)
        var ring = drawPoints.concat([drawPoints[0]]);
        features.push({
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [ring] },
          properties: {}
        });
        // Zusaetzlich als Linie fuer den Rand
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: ring },
          properties: {}
        });
      }
    }

    var src = map.getSource(DRAW_SOURCE);
    if (src) {
      src.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  }

  /** Leeres GeoJSON */
  function emptyGeoJSON() {
    return { type: 'FeatureCollection', features: [] };
  }

  // ────────────────────────────────────────────
  // 7. GRABEN-KUBATUR-RECHNER
  // ────────────────────────────────────────────

  /**
   * Graben-Querschnitt berechnen:
   * - Breite unten = b
   * - Tiefe = h
   * - Boeschungswinkel = alpha (0 = senkrecht)
   * - Breite oben = b + 2 * h * tan(alpha)
   * - Querschnitt = h * (b_oben + b_unten) / 2  (Trapezformel)
   */
  function grabenQuerschnitt(breite, tiefe, boeschungGrad) {
    var alpha = boeschungGrad * Math.PI / 180;
    var boeschungBreite = tiefe * Math.tan(alpha);
    var breiteOben = breite + 2 * boeschungBreite;
    var flaeche = tiefe * (breiteOben + breite) / 2;
    return {
      breiteUnten: breite,
      breiteOben: breiteOben,
      boeschungBreite: boeschungBreite,
      flaeche: flaeche,
      tiefe: tiefe,
    };
  }

  /** Graben-Rechner starten */
  function startGrabenRechner() {
    // Zeichenmodus starten
    startDrawing('graben');

    var html = '';

    // Zeichnen-Hinweis
    html += '<div class="kb-draw-hint">' +
      '<span class="hint-icon">\u270F\uFE0F</span>' +
      '<div class="hint-text">' +
        '<strong>Grabenverlauf auf Karte zeichnen</strong><br>' +
        'Klicke Punkte auf die Karte. Doppelklick = Abschluss.' +
      '</div></div>';

    // Ergebnis: Grabenlange (live)
    html += '<div class="kb-section-title">// Grabenmasse</div>';
    html += '<div id="kb-graben-laenge" class="kb-result-row">' +
      '<span class="kb-result-label">Grabenl\u00E4nge</span>' +
      '<span class="kb-result-value">0.0 m</span></div>';

    // Formular: Breite
    html += '<div class="kb-form-group">' +
      '<div class="kb-label-row"><label>Grabenbreite</label>' +
      '<span class="kb-value-badge" id="kb-breite-val">0.80 m</span></div>' +
      '<div class="kb-slider-row">' +
        '<input type="range" id="kb-breite-slider" min="0.3" max="2.0" step="0.05" value="0.8" oninput="window.KubaturModule._onGrabenChange()">' +
        '<input type="number" id="kb-breite-input" min="0.3" max="2.0" step="0.05" value="0.8" oninput="window.KubaturModule._onGrabenInputChange(\'breite\')">' +
      '</div></div>';

    // Formular: Tiefe
    html += '<div class="kb-form-group">' +
      '<div class="kb-label-row"><label>Grabentiefe</label>' +
      '<span class="kb-value-badge" id="kb-tiefe-val">1.20 m</span></div>' +
      '<div class="kb-slider-row">' +
        '<input type="range" id="kb-tiefe-slider" min="0.5" max="4.0" step="0.1" value="1.2" oninput="window.KubaturModule._onGrabenChange()">' +
        '<input type="number" id="kb-tiefe-input" min="0.5" max="4.0" step="0.1" value="1.2" oninput="window.KubaturModule._onGrabenInputChange(\'tiefe\')">' +
      '</div></div>';

    // Formular: Boeschungswinkel
    html += '<div class="kb-form-group">' +
      '<div class="kb-label-row"><label>B\u00F6schungswinkel</label>' +
      '<span class="kb-value-badge" id="kb-boeschung-val">0\u00B0 (senkrecht)</span></div>' +
      '<div class="kb-slider-row">' +
        '<input type="range" id="kb-boeschung-slider" min="0" max="60" step="5" value="0" oninput="window.KubaturModule._onGrabenChange()">' +
        '<input type="number" id="kb-boeschung-input" min="0" max="60" step="5" value="0" oninput="window.KubaturModule._onGrabenInputChange(\'boeschung\')">' +
      '</div></div>';

    // Material Verfuellung
    html += '<div class="kb-form-group">' +
      '<label>Material Verf\u00FCllung</label>' +
      '<select class="kb-select" id="kb-verfuellung" onchange="window.KubaturModule._onGrabenChange()">' +
        '<option value="kies_verfuellung">Kies 0/45</option>' +
        '<option value="beton_verfuellung">Beton C25/30</option>' +
        '<option value="magerbeton">Magerbeton C12/15</option>' +
        '<option value="aushub_verfuellung">Aushub (R\u00FCckf\u00FCllung)</option>' +
      '</select></div>';

    // Belag oben
    html += '<div class="kb-form-group">' +
      '<label>Belag oben</label>' +
      '<select class="kb-select" id="kb-belag" onchange="window.KubaturModule._onGrabenChange()">' +
        '<option value="asphalt_ac11">Asphalt AC11</option>' +
        '<option value="pflaster">Pflaster Beton</option>' +
        '<option value="kies_belag">Kiesbelag</option>' +
        '<option value="gruenflaeche">Gr\u00FCnfl\u00E4che</option>' +
      '</select></div>';

    // Berechnung
    html += '<div class="kb-section-title">// Kubatur</div>';
    html += '<div id="kb-graben-kubatur"></div>';

    // Kosten
    html += '<div class="kb-section-title">// Kostensch\u00E4tzung</div>';
    html += '<div id="kb-graben-kosten"></div>';

    // Querschnitt SVG
    html += '<div class="kb-section-title">// Querschnitt</div>';
    html += '<div class="kb-querschnitt" id="kb-querschnitt-svg"></div>';

    // Buttons
    html += '<div class="kb-btn-row">' +
      '<button class="kb-btn kb-btn-primary" onclick="window.KubaturModule._grabenToMassenliste()">' +
        '\u2795 Zur Massenliste' +
      '</button>' +
      '<button class="kb-btn kb-btn-outline" onclick="window.KubaturModule._resetGraben()">' +
        '\u21BB Neu zeichnen' +
      '</button>' +
    '</div>';

    openPanel('Graben-Kubatur', '\u26CF\uFE0F', html);

    // Initiale Berechnung
    updateGrabenCalculation();
  }

  /** Slider -> Input synchronisieren und neu berechnen */
  function onGrabenChange() {
    var breite = parseFloat(document.getElementById('kb-breite-slider').value);
    var tiefe  = parseFloat(document.getElementById('kb-tiefe-slider').value);
    var boesch = parseFloat(document.getElementById('kb-boeschung-slider').value);

    document.getElementById('kb-breite-input').value = breite;
    document.getElementById('kb-tiefe-input').value  = tiefe;
    document.getElementById('kb-boeschung-input').value = boesch;

    document.getElementById('kb-breite-val').textContent = breite.toFixed(2) + ' m';
    document.getElementById('kb-tiefe-val').textContent  = tiefe.toFixed(2) + ' m';
    document.getElementById('kb-boeschung-val').textContent = boesch + '\u00B0' + (boesch === 0 ? ' (senkrecht)' : '');

    updateGrabenCalculation();
  }

  /** Input -> Slider synchronisieren */
  function onGrabenInputChange(field) {
    var sliderId, inputId;
    if (field === 'breite')   { sliderId = 'kb-breite-slider';   inputId = 'kb-breite-input'; }
    if (field === 'tiefe')    { sliderId = 'kb-tiefe-slider';    inputId = 'kb-tiefe-input'; }
    if (field === 'boeschung'){ sliderId = 'kb-boeschung-slider'; inputId = 'kb-boeschung-input'; }

    var val = parseFloat(document.getElementById(inputId).value);
    if (!isNaN(val)) {
      document.getElementById(sliderId).value = val;
    }
    onGrabenChange();
  }

  /** Live-Berechnung waehrend Zeichnen */
  function updateLiveCalculation() {
    if (drawMode === 'graben') {
      updateGrabenCalculation();
    } else if (drawMode === 'flaeche') {
      updateFlaechenCalculation();
    }
  }

  /** Graben-Berechnung aktualisieren */
  function updateGrabenCalculation() {
    // Eingabewerte lesen
    var breiteEl   = document.getElementById('kb-breite-slider');
    var tiefeEl    = document.getElementById('kb-tiefe-slider');
    var boeschEl   = document.getElementById('kb-boeschung-slider');
    var verfuellEl = document.getElementById('kb-verfuellung');
    var belagEl    = document.getElementById('kb-belag');

    if (!breiteEl) return; // Panel noch nicht offen

    var breite   = parseFloat(breiteEl.value)  || 0.8;
    var tiefe    = parseFloat(tiefeEl.value)    || 1.2;
    var boesch   = parseFloat(boeschEl.value)   || 0;
    var verfKey  = verfuellEl ? verfuellEl.value : 'kies_verfuellung';
    var belagKey = belagEl ? belagEl.value : 'asphalt_ac11';

    // Grabenlange aus Zeichnung
    var laenge = drawPoints.length >= 2 ? polylineLength(drawPoints) : 0;

    // Querschnitt berechnen
    var qs = grabenQuerschnitt(breite, tiefe, boesch);

    // Aushubvolumen = Querschnittsflaeche * Laenge
    var aushubM3 = qs.flaeche * laenge;

    // Bettungsschicht: ca. 10cm unter der Leitung (vereinfacht)
    var bettungHoehe = 0.10;
    var bettungM3 = breite * bettungHoehe * laenge;

    // Verfuellung = Aushub - Bettung (vereinfacht: Leitung vernachlaessigbar)
    var verfuellungM3 = Math.max(0, aushubM3 - bettungM3);

    // Belagsflaeche = Breite oben * Laenge
    var belagM2 = qs.breiteOben * laenge;

    // -- Laenge anzeigen --
    var laengeEl = document.getElementById('kb-graben-laenge');
    if (laengeEl) {
      laengeEl.innerHTML =
        '<span class="kb-result-label">Grabenl\u00E4nge</span>' +
        '<span class="kb-result-value">' + fmtNum(laenge, 1) + ' m</span>';
    }

    // -- Kubatur anzeigen --
    var kubEl = document.getElementById('kb-graben-kubatur');
    if (kubEl) {
      kubEl.innerHTML =
        '<div class="kb-result-row"><span class="kb-result-label">Querschnitt</span>' +
        '<span class="kb-result-value">' + fmtNum(qs.flaeche, 2) + ' m\u00B2</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Aushub</span>' +
        '<span class="kb-result-value">' + fmtNum(aushubM3, 1) + ' m\u00B3</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Bettung (Sand)</span>' +
        '<span class="kb-result-value">' + fmtNum(bettungM3, 1) + ' m\u00B3</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Verf\u00FCllung</span>' +
        '<span class="kb-result-value">' + fmtNum(verfuellungM3, 1) + ' m\u00B3</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Belagsfl\u00E4che</span>' +
        '<span class="kb-result-value">' + fmtNum(belagM2, 1) + ' m\u00B2</span></div>';
    }

    // -- Kosten berechnen und anzeigen --
    var kAushub    = aushubM3 * preise.aushub_masch.preis;
    var kTransport = aushubM3 * preise.transport_aushub.preis;
    var kDeponie   = aushubM3 * preise.deponie_sauber.preis;
    var kBettung   = bettungM3 * preise.bettung_sand.preis;
    var kVerfuell  = verfuellungM3 * preise[verfKey].preis;
    var kBelag     = belagM2 * preise[belagKey].preis;
    var kTotal     = kAushub + kTransport + kDeponie + kBettung + kVerfuell + kBelag;

    var kostenEl = document.getElementById('kb-graben-kosten');
    if (kostenEl) {
      kostenEl.innerHTML =
        costLine('Aushub maschinell',                fmtNum(aushubM3, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.aushub_masch.preis) + ' CHF',    kAushub) +
        costLine('Transport Aushub',                 fmtNum(aushubM3, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.transport_aushub.preis) + ' CHF', kTransport) +
        costLine('Deponie (Typ A)',                  fmtNum(aushubM3, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.deponie_sauber.preis) + ' CHF',   kDeponie) +
        costLine('Bettung Sand/Kies',                fmtNum(bettungM3, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.bettung_sand.preis) + ' CHF',    kBettung) +
        costLine('Verf\u00FCllung (' + preise[verfKey].beschreibung + ')',
                                                     fmtNum(verfuellungM3, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise[verfKey].preis) + ' CHF',    kVerfuell) +
        costLine('Belag (' + preise[belagKey].beschreibung + ')',
                                                     fmtNum(belagM2, 1) + ' m\u00B2 \u00D7 ' + fmtNum(preise[belagKey].preis) + ' CHF',         kBelag) +
        '<div class="kb-result-total">' +
          '<span class="kb-result-label">TOTAL</span>' +
          '<span class="kb-result-value">' + chf(kTotal) + '</span>' +
        '</div>';
    }

    // -- Querschnitt-SVG zeichnen --
    renderQuerschnittSVG(qs, verfKey, belagKey);
  }

  /** HTML fuer eine Kostenzeile */
  function costLine(desc, calc, amount) {
    return '<div class="kb-cost-line">' +
      '<span class="kb-cost-desc">' + desc + '</span>' +
      '<span class="kb-cost-calc">' + calc + '</span>' +
      '<span class="kb-cost-amount">' + chf(amount) + '</span>' +
    '</div>';
  }

  /** Graben-Querschnitt als SVG rendern */
  function renderQuerschnittSVG(qs, verfKey, belagKey) {
    var container = document.getElementById('kb-querschnitt-svg');
    if (!container) return;

    // SVG-Dimensionen
    var svgW = 340, svgH = 220;
    var pad = 30; // Rand fuer Bemaßung

    // Skalierung: Graben passt in (svgW - 2*pad) x (svgH - 2*pad)
    var drawW = svgW - 2 * pad;
    var drawH = svgH - 2 * pad;

    // Maximal sichtbare Breite = breiteOben + etwas Rand
    var visBreite = Math.max(qs.breiteOben * 1.3, qs.breiteUnten + 0.5);
    var visTiefe  = qs.tiefe * 1.15;
    var scale = Math.min(drawW / visBreite, drawH / visTiefe);

    // Zentrum
    var cx = svgW / 2;
    var groundY = pad + 10; // Oberkante Gelaende

    // Umrechnung Meter -> SVG-Pixel
    function mx(m) { return cx + m * scale; }
    function my(m) { return groundY + m * scale; }

    // Trapez-Koordinaten (Mitte = 0)
    var halfTop = qs.breiteOben / 2;
    var halfBot = qs.breiteUnten / 2;
    var depth   = qs.tiefe;

    // Belagschicht (obere 6cm)
    var belagH = 0.06;
    // Bettungsschicht (untere 10cm)
    var bettungH = 0.10;

    // Farben
    var farben = {
      erdreich: '#8B7355',
      aushub:   '#D4C4A8',
      bettung:  '#E8D5B0',
      verfuellung: verfKey === 'beton_verfuellung' ? '#B0B0B0' :
                   verfKey === 'magerbeton'        ? '#C8C8C0' :
                   verfKey === 'aushub_verfuellung' ? '#C4A882' : '#D4B896',
      belag:    belagKey === 'asphalt_ac11' ? '#404040' :
                belagKey === 'pflaster'     ? '#C0A080' :
                belagKey === 'kies_belag'   ? '#D4C4A0' : '#6B8F4E',
      leitung:  '#2E86AB',
      boden:    '#6B8040',
    };

    var svg = '<svg width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '" xmlns="http://www.w3.org/2000/svg">';

    // Hintergrund
    svg += '<rect width="' + svgW + '" height="' + svgH + '" fill="#F8F6F0" rx="6"/>';

    // Gelaendeoberflaeche (links und rechts des Grabens)
    svg += '<rect x="0" y="' + groundY + '" width="' + mx(-halfTop) + '" height="20" fill="' + farben.erdreich + '" opacity="0.3"/>';
    svg += '<rect x="' + mx(halfTop) + '" y="' + groundY + '" width="' + (svgW - mx(halfTop)) + '" height="20" fill="' + farben.erdreich + '" opacity="0.3"/>';

    // Gras oben
    svg += '<line x1="0" y1="' + groundY + '" x2="' + mx(-halfTop) + '" y2="' + groundY + '" stroke="' + farben.boden + '" stroke-width="3"/>';
    svg += '<line x1="' + mx(halfTop) + '" y1="' + groundY + '" x2="' + svgW + '" y2="' + groundY + '" stroke="' + farben.boden + '" stroke-width="3"/>';

    // Graben-Trapez: Verfuellung (Hauptkoerper)
    var trapez = mx(-halfTop) + ',' + groundY + ' ' +
                 mx(halfTop) + ',' + groundY + ' ' +
                 mx(halfBot) + ',' + my(depth) + ' ' +
                 mx(-halfBot) + ',' + my(depth);
    svg += '<polygon points="' + trapez + '" fill="' + farben.verfuellung + '" stroke="' + farben.erdreich + '" stroke-width="1.5"/>';

    // Bettungsschicht (unten)
    var bettTop = depth - bettungH;
    // Interpolation: Breite an bettTop
    var ratio = bettTop / depth;
    var halfAtBettTop = halfTop - ratio * (halfTop - halfBot);
    var bettTrapez = mx(-halfAtBettTop) + ',' + my(bettTop) + ' ' +
                     mx(halfAtBettTop) + ',' + my(bettTop) + ' ' +
                     mx(halfBot) + ',' + my(depth) + ' ' +
                     mx(-halfBot) + ',' + my(depth);
    svg += '<polygon points="' + bettTrapez + '" fill="' + farben.bettung + '" stroke="none"/>';

    // Leitung (Kreis, Mitte ca. bei bettTop - etwas)
    var leitungR = Math.min(0.08, qs.breiteUnten * 0.15); // Leitungsradius proportional
    var leitungY = bettTop - leitungR - 0.02;
    svg += '<circle cx="' + mx(0) + '" cy="' + my(leitungY + leitungR) + '" r="' + (leitungR * scale) + '" fill="' + farben.leitung + '" stroke="white" stroke-width="1.5"/>';
    svg += '<text x="' + mx(0) + '" y="' + (my(leitungY + leitungR) + 3) + '" fill="white" font-size="8" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600">DN</text>';

    // Belagschicht (oben)
    var belagBot = belagH;
    var halfAtBelagBot = halfTop - (belagBot / depth) * (halfTop - halfBot);
    var belagTrapez = mx(-halfTop) + ',' + groundY + ' ' +
                      mx(halfTop) + ',' + groundY + ' ' +
                      mx(halfAtBelagBot) + ',' + my(belagBot) + ' ' +
                      mx(-halfAtBelagBot) + ',' + my(belagBot);
    svg += '<polygon points="' + belagTrapez + '" fill="' + farben.belag + '" stroke="none"/>';

    // Bemaßungslinien

    // Breite oben
    var arrowY = groundY - 8;
    svg += dimLine(mx(-halfTop), arrowY, mx(halfTop), arrowY, fmtNum(qs.breiteOben, 2) + ' m');

    // Breite unten (nur wenn verschieden)
    if (qs.boeschungBreite > 0.01) {
      var botDimY = my(depth) + 14;
      svg += dimLine(mx(-halfBot), botDimY, mx(halfBot), botDimY, fmtNum(qs.breiteUnten, 2) + ' m');
    }

    // Tiefe (rechts)
    var depthX = mx(halfTop) + 10;
    svg += '<line x1="' + depthX + '" y1="' + groundY + '" x2="' + depthX + '" y2="' + my(depth) + '" stroke="#1B2A4A" stroke-width="1" marker-start="url(#arrowUp)" marker-end="url(#arrowDown)"/>';
    svg += '<text x="' + (depthX + 6) + '" y="' + ((groundY + my(depth)) / 2 + 3) + '" fill="#1B2A4A" font-size="9" font-family="JetBrains Mono, monospace" font-weight="600">' + fmtNum(qs.tiefe, 2) + ' m</text>';

    // Pfeil-Marker Definition
    svg += '<defs>' +
      '<marker id="arrowUp" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto"><path d="M0,6 L3,0 L6,6" fill="#1B2A4A"/></marker>' +
      '<marker id="arrowDown" markerWidth="6" markerHeight="6" refX="3" refY="0" orient="auto"><path d="M0,0 L3,6 L6,0" fill="#1B2A4A"/></marker>' +
      '<marker id="arrowLeft" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="#1B2A4A"/></marker>' +
      '<marker id="arrowRight" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="#1B2A4A"/></marker>' +
    '</defs>';

    // Legende unten
    var legY = svgH - 12;
    var legItems = [
      { color: farben.belag, label: preise[belagKey].beschreibung },
      { color: farben.verfuellung, label: preise[verfKey].beschreibung },
      { color: farben.bettung, label: 'Bettung' },
      { color: farben.leitung, label: 'Leitung' },
    ];
    var legX = 10;
    legItems.forEach(function (item) {
      svg += '<rect x="' + legX + '" y="' + (legY - 7) + '" width="10" height="10" rx="2" fill="' + item.color + '"/>';
      svg += '<text x="' + (legX + 14) + '" y="' + legY + '" fill="#64748B" font-size="8" font-family="Plus Jakarta Sans, sans-serif">' + item.label + '</text>';
      legX += 14 + item.label.length * 5 + 8;
    });

    svg += '</svg>';
    container.innerHTML = svg;
  }

  /** Bemaßungslinie (horizontal) als SVG */
  function dimLine(x1, y, x2, y2, label) {
    return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#1B2A4A" stroke-width="1" marker-start="url(#arrowLeft)" marker-end="url(#arrowRight)"/>' +
           '<text x="' + ((x1 + x2) / 2) + '" y="' + (y - 3) + '" fill="#1B2A4A" font-size="9" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="600">' + label + '</text>';
  }

  /** Graben-Positionen zur Massenliste hinzufuegen */
  function grabenToMassenliste() {
    var breite = parseFloat(document.getElementById('kb-breite-slider').value) || 0.8;
    var tiefe  = parseFloat(document.getElementById('kb-tiefe-slider').value)  || 1.2;
    var boesch = parseFloat(document.getElementById('kb-boeschung-slider').value) || 0;
    var verfKey  = document.getElementById('kb-verfuellung').value;
    var belagKey = document.getElementById('kb-belag').value;

    var laenge = drawPoints.length >= 2 ? polylineLength(drawPoints) : 0;
    var qs = grabenQuerschnitt(breite, tiefe, boesch);
    var aushubM3 = qs.flaeche * laenge;
    var bettungM3 = breite * 0.10 * laenge;
    var verfuellungM3 = Math.max(0, aushubM3 - bettungM3);
    var belagM2 = qs.breiteOben * laenge;

    // Positionen erzeugen
    var positionen = [
      { npk: preise.aushub_masch.npk,     beschreibung: preise.aushub_masch.beschreibung,     einheit: 'm\u00B3', menge: round2(aushubM3),      ep: preise.aushub_masch.preis },
      { npk: preise.transport_aushub.npk,  beschreibung: preise.transport_aushub.beschreibung, einheit: 'm\u00B3', menge: round2(aushubM3),      ep: preise.transport_aushub.preis },
      { npk: preise.deponie_sauber.npk,    beschreibung: preise.deponie_sauber.beschreibung,   einheit: 'm\u00B3', menge: round2(aushubM3),      ep: preise.deponie_sauber.preis },
      { npk: preise.bettung_sand.npk,      beschreibung: preise.bettung_sand.beschreibung,     einheit: 'm\u00B3', menge: round2(bettungM3),     ep: preise.bettung_sand.preis },
      { npk: preise[verfKey].npk,          beschreibung: preise[verfKey].beschreibung,          einheit: 'm\u00B3', menge: round2(verfuellungM3), ep: preise[verfKey].preis },
      { npk: preise[belagKey].npk,         beschreibung: preise[belagKey].beschreibung,         einheit: 'm\u00B2', menge: round2(belagM2),       ep: preise[belagKey].preis },
    ];

    positionen.forEach(function (pos) {
      if (pos.menge > 0) {
        massenliste.push({
          id: uid(),
          npk: pos.npk,
          beschreibung: pos.beschreibung,
          einheit: pos.einheit,
          menge: pos.menge,
          ep: pos.ep,
        });
      }
    });

    // Kurze Bestaetigung
    alert('Positionen wurden zur Massenliste hinzugef\u00FCgt (' + positionen.filter(function (p) { return p.menge > 0; }).length + ' Pos.)');
  }

  /** Graben-Zeichnung zuruecksetzen */
  function resetGraben() {
    drawPoints = [];
    updateDrawGeometry();
    updateGrabenCalculation();
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // ────────────────────────────────────────────
  // 8. FLAECHEN-KUBATUR-RECHNER
  // ────────────────────────────────────────────

  /** Flaechen-Rechner starten */
  function startFlaechenRechner() {
    startDrawing('flaeche');

    var html = '';

    // Hinweis
    html += '<div class="kb-draw-hint">' +
      '<span class="hint-icon">\u2B1B</span>' +
      '<div class="hint-text">' +
        '<strong>Aushubfl\u00E4che auf Karte zeichnen</strong><br>' +
        'Klicke Polygon-Eckpunkte. Doppelklick = Abschluss.' +
      '</div></div>';

    // Ergebnis: Flaeche (live)
    html += '<div class="kb-section-title">// Fl\u00E4chenmasse</div>';
    html += '<div id="kb-flaeche-info"></div>';

    // Tiefe eingeben
    html += '<div class="kb-form-group">' +
      '<div class="kb-label-row"><label>Aushubtiefe</label>' +
      '<span class="kb-value-badge" id="kb-fl-tiefe-val">1.00 m</span></div>' +
      '<div class="kb-slider-row">' +
        '<input type="range" id="kb-fl-tiefe-slider" min="0.1" max="6.0" step="0.1" value="1.0" oninput="window.KubaturModule._onFlaecheChange()">' +
        '<input type="number" id="kb-fl-tiefe-input" min="0.1" max="6.0" step="0.1" value="1.0" oninput="window.KubaturModule._onFlaecheInputChange()">' +
      '</div></div>';

    // Deponietyp
    html += '<div class="kb-form-group">' +
      '<label>Deponie</label>' +
      '<select class="kb-select" id="kb-fl-deponie" onchange="window.KubaturModule._onFlaecheChange()">' +
        '<option value="deponie_sauber">Typ A (sauber)</option>' +
        '<option value="deponie_belastet">Typ B (belastet)</option>' +
      '</select></div>';

    // Kubatur
    html += '<div class="kb-section-title">// Kubatur</div>';
    html += '<div id="kb-flaeche-kubatur"></div>';

    // Kosten
    html += '<div class="kb-section-title">// Kostensch\u00E4tzung</div>';
    html += '<div id="kb-flaeche-kosten"></div>';

    // Buttons
    html += '<div class="kb-btn-row">' +
      '<button class="kb-btn kb-btn-primary" onclick="window.KubaturModule._flaecheToMassenliste()">' +
        '\u2795 Zur Massenliste' +
      '</button>' +
      '<button class="kb-btn kb-btn-outline" onclick="window.KubaturModule._resetFlaeche()">' +
        '\u21BB Neu zeichnen' +
      '</button>' +
    '</div>';

    openPanel('Fl\u00E4chen-Kubatur', '\u2B1B', html);
    updateFlaechenCalculation();
  }

  /** Flaechen-Slider sync */
  function onFlaecheChange() {
    var tiefe = parseFloat(document.getElementById('kb-fl-tiefe-slider').value);
    document.getElementById('kb-fl-tiefe-input').value = tiefe;
    document.getElementById('kb-fl-tiefe-val').textContent = tiefe.toFixed(2) + ' m';
    updateFlaechenCalculation();
  }

  function onFlaecheInputChange() {
    var val = parseFloat(document.getElementById('kb-fl-tiefe-input').value);
    if (!isNaN(val)) {
      document.getElementById('kb-fl-tiefe-slider').value = val;
    }
    onFlaecheChange();
  }

  /** Flaechen-Berechnung aktualisieren */
  function updateFlaechenCalculation() {
    var tiefeEl   = document.getElementById('kb-fl-tiefe-slider');
    var deponieEl = document.getElementById('kb-fl-deponie');
    if (!tiefeEl) return;

    var tiefe = parseFloat(tiefeEl.value) || 1.0;
    var deponieKey = deponieEl ? deponieEl.value : 'deponie_sauber';

    // Flaeche aus Polygon
    var flaeche = drawPoints.length >= 3 ? polygonArea(drawPoints) : 0;
    var umfang  = drawPoints.length >= 2 ? polylineLength(drawPoints.concat([drawPoints[0]])) : 0;

    // Volumen
    var volumen = flaeche * tiefe;

    // Info
    var infoEl = document.getElementById('kb-flaeche-info');
    if (infoEl) {
      infoEl.innerHTML =
        '<div class="kb-result-row"><span class="kb-result-label">Fl\u00E4che</span>' +
        '<span class="kb-result-value">' + fmtNum(flaeche, 1) + ' m\u00B2</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Umfang</span>' +
        '<span class="kb-result-value">' + fmtNum(umfang, 1) + ' m</span></div>';
    }

    // Kubatur
    var kubEl = document.getElementById('kb-flaeche-kubatur');
    if (kubEl) {
      kubEl.innerHTML =
        '<div class="kb-result-row"><span class="kb-result-label">Aushubtiefe</span>' +
        '<span class="kb-result-value">' + fmtNum(tiefe, 2) + ' m</span></div>' +
        '<div class="kb-result-row"><span class="kb-result-label">Aushubvolumen</span>' +
        '<span class="kb-result-value highlight">' + fmtNum(volumen, 1) + ' m\u00B3</span></div>';
    }

    // Kosten
    var kAushub  = volumen * preise.aushub_masch.preis;
    var kTransp  = volumen * preise.transport_aushub.preis;
    var kDeponie = volumen * preise[deponieKey].preis;
    var kTotal   = kAushub + kTransp + kDeponie;

    var kostenEl = document.getElementById('kb-flaeche-kosten');
    if (kostenEl) {
      kostenEl.innerHTML =
        costLine('Aushub maschinell', fmtNum(volumen, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.aushub_masch.preis) + ' CHF', kAushub) +
        costLine('Transport',         fmtNum(volumen, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise.transport_aushub.preis) + ' CHF', kTransp) +
        costLine('Deponie',           fmtNum(volumen, 1) + ' m\u00B3 \u00D7 ' + fmtNum(preise[deponieKey].preis) + ' CHF', kDeponie) +
        '<div class="kb-result-total">' +
          '<span class="kb-result-label">TOTAL</span>' +
          '<span class="kb-result-value">' + chf(kTotal) + '</span>' +
        '</div>';
    }
  }

  /** Flaeche zur Massenliste */
  function flaecheToMassenliste() {
    var tiefe      = parseFloat(document.getElementById('kb-fl-tiefe-slider').value) || 1.0;
    var deponieKey = document.getElementById('kb-fl-deponie').value;
    var flaeche    = drawPoints.length >= 3 ? polygonArea(drawPoints) : 0;
    var volumen    = flaeche * tiefe;

    if (volumen <= 0) {
      alert('Bitte zuerst eine Fl\u00E4che auf der Karte zeichnen.');
      return;
    }

    var positionen = [
      { npk: preise.aushub_masch.npk,    beschreibung: preise.aushub_masch.beschreibung,    einheit: 'm\u00B3', menge: round2(volumen), ep: preise.aushub_masch.preis },
      { npk: preise.transport_aushub.npk, beschreibung: preise.transport_aushub.beschreibung, einheit: 'm\u00B3', menge: round2(volumen), ep: preise.transport_aushub.preis },
      { npk: preise[deponieKey].npk,      beschreibung: preise[deponieKey].beschreibung,      einheit: 'm\u00B3', menge: round2(volumen), ep: preise[deponieKey].preis },
    ];

    positionen.forEach(function (pos) {
      massenliste.push({
        id: uid(),
        npk: pos.npk,
        beschreibung: pos.beschreibung,
        einheit: pos.einheit,
        menge: pos.menge,
        ep: pos.ep,
      });
    });

    alert('Positionen wurden zur Massenliste hinzugef\u00FCgt (' + positionen.length + ' Pos.)');
  }

  /** Flaeche zuruecksetzen */
  function resetFlaeche() {
    drawPoints = [];
    updateDrawGeometry();
    updateFlaechenCalculation();
  }

  // ────────────────────────────────────────────
  // 9. MASSENLISTE / AUSMASS
  // ────────────────────────────────────────────

  /** Massenliste anzeigen */
  function showMassenliste() {
    stopDrawing();

    var html = '';

    // Tabs
    html += '<div class="kb-tabs">' +
      '<div class="kb-tab active" onclick="window.KubaturModule._switchMlTab(\'liste\', this)">Massenliste</div>' +
      '<div class="kb-tab" onclick="window.KubaturModule._switchMlTab(\'add\', this)">+ Position</div>' +
    '</div>';

    // Tabelle
    html += '<div id="kb-ml-content">';
    html += renderMassenlisteTable();
    html += '</div>';

    // Buttons
    html += '<div class="kb-btn-row">' +
      '<button class="kb-btn kb-btn-primary" onclick="window.KubaturModule.exportCSV()">' +
        '\u21E9 CSV Export' +
      '</button>' +
      '<button class="kb-btn kb-btn-outline" onclick="window.KubaturModule._clearMassenliste()">' +
        '\u2717 Alle l\u00F6schen' +
      '</button>' +
    '</div>';

    html += '<div class="kb-info-box">' +
      '<span class="info-icon">\u2139\uFE0F</span>' +
      '<span>NPK-Nummern basieren auf dem Schweizer Baukatalog (NPK). ' +
        'Positionen k\u00F6nnen \u00FCber den Graben- oder Fl\u00E4chen-Rechner automatisch hinzugef\u00FCgt werden.</span>' +
    '</div>';

    openPanel('Massenliste / Ausmass', '\u{1F4CB}', html, 'fullwidth');
  }

  /** Massenliste als HTML-Tabelle rendern */
  function renderMassenlisteTable() {
    if (massenliste.length === 0) {
      return '<div class="kb-empty">' +
        '<span class="empty-icon">\u{1F4CB}</span>' +
        'Noch keine Positionen vorhanden.<br>Verwende den Graben- oder Fl\u00E4chen-Rechner.' +
      '</div>';
    }

    var total = 0;
    var html = '<div class="kb-table-wrap"><table class="kb-table">';
    html += '<thead><tr>' +
      '<th>Pos</th><th>NPK</th><th>Beschreibung</th><th>Einheit</th><th>Menge</th><th>EP (CHF)</th><th>Total (CHF)</th><th></th>' +
    '</tr></thead><tbody>';

    massenliste.forEach(function (pos, i) {
      var posTotal = pos.menge * pos.ep;
      total += posTotal;
      html += '<tr data-id="' + pos.id + '">' +
        '<td><span class="kb-pos-nr">' + (i + 1) + '</span></td>' +
        '<td><span class="kb-npk-badge">' + pos.npk + '</span></td>' +
        '<td><span class="kb-pos-desc">' + pos.beschreibung + '</span></td>' +
        '<td>' + pos.einheit + '</td>' +
        '<td class="editable" ondblclick="window.KubaturModule._editMlCell(this, \'' + pos.id + '\', \'menge\')">' + fmtNum(pos.menge, 2) + '</td>' +
        '<td class="editable" ondblclick="window.KubaturModule._editMlCell(this, \'' + pos.id + '\', \'ep\')">' + fmtNum(pos.ep, 2) + '</td>' +
        '<td>' + fmtNum(posTotal, 2) + '</td>' +
        '<td><button class="kb-row-delete" onclick="window.KubaturModule._removeMlRow(\'' + pos.id + '\')">\u2715</button></td>' +
      '</tr>';
    });

    html += '</tbody>';
    html += '<tfoot><tr>' +
      '<td colspan="6">TOTAL</td>' +
      '<td>' + chf(total) + '</td>' +
      '<td></td>' +
    '</tr></tfoot>';
    html += '</table></div>';

    return html;
  }

  /** Tab-Wechsel in Massenliste */
  function switchMlTab(tab, tabEl) {
    // Tabs aktualisieren
    var tabs = tabEl.parentElement.querySelectorAll('.kb-tab');
    tabs.forEach(function (t) { t.classList.remove('active'); });
    tabEl.classList.add('active');

    var contentEl = document.getElementById('kb-ml-content');
    if (!contentEl) return;

    if (tab === 'liste') {
      contentEl.innerHTML = renderMassenlisteTable();
    } else if (tab === 'add') {
      contentEl.innerHTML = renderAddPositionForm();
    }
  }

  /** Formular zum manuellen Hinzufuegen einer Position */
  function renderAddPositionForm() {
    var html = '<div class="kb-section-title">// Neue Position</div>';

    // NPK-Auswahl aus vorhandenen Preisen
    html += '<div class="kb-form-group">' +
      '<label>NPK-Position</label>' +
      '<select class="kb-select" id="kb-add-npk" onchange="window.KubaturModule._onAddNpkChange()">';
    Object.keys(preise).forEach(function (key) {
      html += '<option value="' + key + '">' + preise[key].npk + ' — ' + preise[key].beschreibung + '</option>';
    });
    html += '</select></div>';

    html += '<div class="kb-form-group">' +
      '<label>Menge</label>' +
      '<input class="kb-input" type="number" id="kb-add-menge" value="1" step="0.01" min="0">' +
    '</div>';

    html += '<div class="kb-form-group">' +
      '<label>Einheitspreis (CHF)</label>' +
      '<input class="kb-input" type="number" id="kb-add-ep" value="' + preise[Object.keys(preise)[0]].preis + '" step="0.01" min="0">' +
    '</div>';

    html += '<button class="kb-btn kb-btn-primary kb-btn-block" onclick="window.KubaturModule._addMlPosition()">' +
      '\u2795 Hinzuf\u00FCgen</button>';

    return html;
  }

  /** NPK-Dropdown geaendert: EP aktualisieren */
  function onAddNpkChange() {
    var key = document.getElementById('kb-add-npk').value;
    document.getElementById('kb-add-ep').value = preise[key].preis;
  }

  /** Position manuell hinzufuegen */
  function addMlPosition() {
    var key   = document.getElementById('kb-add-npk').value;
    var menge = parseFloat(document.getElementById('kb-add-menge').value) || 0;
    var ep    = parseFloat(document.getElementById('kb-add-ep').value) || 0;

    if (menge <= 0) {
      alert('Bitte eine g\u00FCltige Menge eingeben.');
      return;
    }

    massenliste.push({
      id: uid(),
      npk: preise[key].npk,
      beschreibung: preise[key].beschreibung,
      einheit: preise[key].einheit,
      menge: menge,
      ep: ep,
    });

    // Zurueck zur Liste
    showMassenliste();
  }

  /** Zelle in der Massenliste editieren (Doppelklick) */
  function editMlCell(td, posId, field) {
    var pos = massenliste.find(function (p) { return p.id === posId; });
    if (!pos) return;

    var currentVal = pos[field];
    var input = document.createElement('input');
    input.type = 'number';
    input.value = currentVal;
    input.step = '0.01';
    input.min = '0';
    td.textContent = '';
    td.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      var newVal = parseFloat(input.value);
      if (!isNaN(newVal) && newVal >= 0) {
        pos[field] = newVal;
      }
      // Tabelle neu rendern
      var contentEl = document.getElementById('kb-ml-content');
      if (contentEl) {
        contentEl.innerHTML = renderMassenlisteTable();
      }
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        var contentEl = document.getElementById('kb-ml-content');
        if (contentEl) contentEl.innerHTML = renderMassenlisteTable();
      }
    });
  }

  /** Zeile aus Massenliste entfernen */
  function removeMlRow(posId) {
    massenliste = massenliste.filter(function (p) { return p.id !== posId; });
    var contentEl = document.getElementById('kb-ml-content');
    if (contentEl) {
      contentEl.innerHTML = renderMassenlisteTable();
    }
  }

  /** Alle Positionen loeschen */
  function clearMassenliste() {
    if (!confirm('Alle Positionen l\u00F6schen?')) return;
    massenliste = [];
    var contentEl = document.getElementById('kb-ml-content');
    if (contentEl) {
      contentEl.innerHTML = renderMassenlisteTable();
    }
  }

  // ────────────────────────────────────────────
  // 10. CSV-EXPORT
  // ────────────────────────────────────────────

  /** Massenliste als CSV exportieren */
  function exportCSV() {
    if (massenliste.length === 0) {
      alert('Die Massenliste ist leer.');
      return;
    }

    // BOM fuer Excel-Kompatibilitaet (UTF-8)
    var bom = '\uFEFF';
    var sep = ';'; // Semikolon fuer Schweizer Excel (Komma ist Dezimalzeichen)
    var nl  = '\r\n';

    // Header
    var csv = bom;
    csv += ['Pos', 'NPK', 'Beschreibung', 'Einheit', 'Menge', 'EP (CHF)', 'Total (CHF)'].join(sep) + nl;

    // Zeilen
    var total = 0;
    massenliste.forEach(function (pos, i) {
      var posTotal = pos.menge * pos.ep;
      total += posTotal;
      csv += [
        (i + 1),
        pos.npk,
        '"' + pos.beschreibung + '"',
        pos.einheit,
        pos.menge.toFixed(2).replace('.', ','),  // Schweizer Dezimal
        pos.ep.toFixed(2).replace('.', ','),
        posTotal.toFixed(2).replace('.', ','),
      ].join(sep) + nl;
    });

    // Summe
    csv += ['', '', '', '', '', 'TOTAL', total.toFixed(2).replace('.', ',')].join(sep) + nl;

    // Download
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'massenliste-bausite-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ────────────────────────────────────────────
  // 11. EINHEITSPREISE VERWALTEN
  // ────────────────────────────────────────────

  /** Einheitspreise-Editor anzeigen */
  function showEinheitspreise() {
    stopDrawing();

    var html = '';

    html += '<div class="kb-section-title">// Einheitspreise (Schweizer Markt 2026)</div>';

    html += '<div class="kb-table-wrap"><table class="kb-ep-table">';
    html += '<thead><tr><th>NPK</th><th>Beschreibung</th><th>Einheit</th><th>Preis (CHF)</th></tr></thead>';
    html += '<tbody>';

    // Gruppierung nach NPK-Hauptgruppe
    var gruppen = {
      '112': 'Aushub / Hinterf\u00FCllung',
      '151': 'Kanalisationen',
      '152': 'Wasser',
      '153': 'Gas',
      '221': 'Unterlagsboden / Fundation',
      '223': 'Belag',
    };

    var lastGroup = '';
    Object.keys(preise).forEach(function (key) {
      var p = preise[key];
      var group = p.npk.split('.')[0];

      // Gruppenzeile einfuegen
      if (group !== lastGroup && gruppen[group]) {
        html += '<tr style="background: var(--light);"><td colspan="4" style="font-weight:700; color:var(--navy); font-size:11px; padding:10px 8px;">' +
          group + ' \u2014 ' + gruppen[group] + '</td></tr>';
        lastGroup = group;
      }

      html += '<tr>' +
        '<td>' + p.npk + '</td>' +
        '<td>' + p.beschreibung + '</td>' +
        '<td>' + p.einheit + '</td>' +
        '<td><input type="number" value="' + p.preis + '" min="0" step="1" data-key="' + key + '" onchange="window.KubaturModule._onEpChange(this)"></td>' +
      '</tr>';
    });

    html += '</tbody></table></div>';

    // Buttons
    html += '<div class="kb-btn-row">' +
      '<button class="kb-btn kb-btn-primary" onclick="window.KubaturModule._saveEp()">' +
        '\u2713 Speichern' +
      '</button>' +
      '<button class="kb-btn kb-btn-outline" onclick="window.KubaturModule._resetEp()">' +
        '\u21BB Standard-Preise' +
      '</button>' +
    '</div>';

    html += '<div class="kb-info-box">' +
      '<span class="info-icon">\u2139\uFE0F</span>' +
      '<span>Preise werden im Browser gespeichert (localStorage) und ' +
        'bei der n\u00E4chsten Session automatisch geladen. ' +
        'Die Standard-Preise basieren auf Schweizer Marktpreisen 2026 (Mittelland).</span>' +
    '</div>';

    openPanel('Einheitspreise', '\u{1F4B0}', html, 'fullwidth');
  }

  /** Preis in Input geaendert */
  function onEpChange(input) {
    var key = input.dataset.key;
    var val = parseFloat(input.value);
    if (!isNaN(val) && val >= 0 && preise[key]) {
      preise[key].preis = val;
    }
  }

  /** Preise speichern */
  function saveEp() {
    savePreise();
    alert('Einheitspreise gespeichert.');
  }

  /** Auf Standard zuruecksetzen */
  function resetEp() {
    if (!confirm('Alle Preise auf Standard zur\u00FCcksetzen?')) return;
    resetPreise();
    savePreise();
    // Panel neu laden
    showEinheitspreise();
  }

  // ────────────────────────────────────────────
  // 12. OEFFENTLICHE API
  // ────────────────────────────────────────────

  /**
   * Globale API fuer die BAUSITE Geo Demo-App.
   * Alle Funktionen sind ueber window.KubaturModule aufrufbar.
   */
  window.KubaturModule = {
    // Hauptfunktionen
    startGrabenRechner:  startGrabenRechner,
    startFlaechenRechner: startFlaechenRechner,
    showMassenliste:     showMassenliste,
    showEinheitspreise:  showEinheitspreise,
    exportCSV:           exportCSV,

    // Interne Callbacks (fuer onclick/oninput im generierten HTML)
    _closePanel:         closePanel,
    _onGrabenChange:     onGrabenChange,
    _onGrabenInputChange: onGrabenInputChange,
    _onFlaecheChange:    onFlaecheChange,
    _onFlaecheInputChange: onFlaecheInputChange,
    _grabenToMassenliste: grabenToMassenliste,
    _resetGraben:        resetGraben,
    _flaecheToMassenliste: flaecheToMassenliste,
    _resetFlaeche:       resetFlaeche,
    _switchMlTab:        switchMlTab,
    _onAddNpkChange:     onAddNpkChange,
    _addMlPosition:      addMlPosition,
    _editMlCell:         editMlCell,
    _removeMlRow:        removeMlRow,
    _clearMassenliste:   clearMassenliste,
    _onEpChange:         onEpChange,
    _saveEp:             saveEp,
    _resetEp:            resetEp,
  };

  console.log('[BAUSITE Geo] Kubatur-Modul geladen. API: window.KubaturModule');

})();
