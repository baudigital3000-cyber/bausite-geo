// ============================================
// BAUSITE Geo — Drawing Module
// Zeichnen, Bearbeiten, Persistenz von
// Polygonen, Linien und Punkten
// Vanilla JS — MapLibre GL JS
// ============================================

(function () {
  'use strict';

  // ── Konstanten ──

  const STORAGE_KEY = 'bausite-geo-drawings';
  const SOURCE_ID = 'drawing-source';

  // Farbkodierung für Linien-Typen (Gräben)
  const LINE_COLORS = {
    Wasserleitung: '#2E86AB',
    Gasleitung:    '#F59E0B',
    Kanalisation:  '#8B5CF6',
    Stromkabel:    '#EF4444',
  };

  // Icons und Farben für Punkt-Typen
  const POINT_TYPES = {
    maschine: { icon: '\u{1F528}', color: '#1B2A4A', label: 'Maschine' },
    schacht:  { icon: '\u{1F533}', color: '#2E86AB', label: 'Schacht' },
    hydrant:  { icon: '\u{1F6B0}', color: '#EF4444', label: 'Hydrant' },
    foto:     { icon: '\u{1F4F7}', color: '#8B5CF6', label: 'Foto' },
  };

  // ── State ──

  let drawingMode = null;        // null | 'polygon' | 'line' | 'point'
  let drawingPointType = null;   // z.B. 'maschine', 'schacht', etc.
  let currentVertices = [];      // [[lng, lat], ...]
  let vertexMarkers = [];        // Marker-Elemente für Zeichenvorgang
  let previewSourceAdded = false;
  let features = [];             // Alle gespeicherten Features
  let pointMarkers = [];         // Maplibre-Marker für Punkte
  let bannerEl = null;           // Aktuelles Banner-Element
  let editPopup = null;          // Aktuelles Edit-Popup

  // ── Initialisierung ──

  /**
   * Wartet bis die Map geladen ist, dann initialisiert
   * Quellen, Layer und stellt gespeicherte Features wieder her.
   */
  function init() {
    if (!window.map) {
      console.error('[DrawingModule] Globale Variable "map" nicht gefunden.');
      return;
    }

    if (map.loaded()) {
      _setup();
    } else {
      map.on('load', _setup);
    }
  }

  function _setup() {
    _loadFromStorage();
    _addSources();
    _addLayers();
    _renderAllPointMarkers();
    _updateSourceData();
    _registerClickHandlers();
  }

  // ── Map-Quellen und Layer ──

  function _addSources() {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: _buildGeoJSON(),
      });
    }
    // Preview-Source für aktive Zeichnung
    if (!map.getSource('drawing-preview')) {
      map.addSource('drawing-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
  }

  function _addLayers() {
    // Polygon-Fill (eigene Zeichnungen)
    map.addLayer({
      id: 'drawing-polygon-fill',
      type: 'fill',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': 'rgba(232, 131, 58, 0.12)',
        'fill-outline-color': '#E8833A',
      },
    });

    // Polygon-Border
    map.addLayer({
      id: 'drawing-polygon-border',
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'line-color': '#E8833A',
        'line-width': 2.5,
        'line-dasharray': [6, 3],
      },
    });

    // Linien (Gräben)
    map.addLayer({
      id: 'drawing-line',
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#E8833A'],
        'line-width': 4,
        'line-opacity': 0.9,
      },
    });

    // Linien-Label
    map.addLayer({
      id: 'drawing-line-label',
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['get', 'typ'], ' — ', ['to-string', ['get', 'laenge_m']], 'm'],
        'text-size': 10,
        'text-font': ['Open Sans Regular'],
        'text-offset': [0, -1],
      },
      paint: {
        'text-color': '#1B2A4A',
        'text-halo-color': 'rgba(255,255,255,0.9)',
        'text-halo-width': 2,
      },
    });

    // Preview-Linie (während dem Zeichnen)
    map.addLayer({
      id: 'drawing-preview-line',
      type: 'line',
      source: 'drawing-preview',
      paint: {
        'line-color': '#E8833A',
        'line-width': 2.5,
        'line-dasharray': [4, 4],
        'line-opacity': 0.7,
      },
    });

    // Preview-Fill (Polygon)
    map.addLayer({
      id: 'drawing-preview-fill',
      type: 'fill',
      source: 'drawing-preview',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: {
        'fill-color': 'rgba(232, 131, 58, 0.08)',
      },
    });
  }

  // ── Zeichenmodus starten ──

  function startPolygon() {
    _cancelIfActive();
    drawingMode = 'polygon';
    currentVertices = [];
    _showBanner('Polygon zeichnen', 'Klicke auf die Karte um Punkte zu setzen. Doppelklick zum Abschliessen.');
    _enableDrawingMode();
  }

  function startLine() {
    _cancelIfActive();
    drawingMode = 'line';
    currentVertices = [];
    _showBanner('Linie zeichnen', 'Klicke auf die Karte um Punkte zu setzen. Doppelklick zum Abschliessen.');
    _enableDrawingMode();
  }

  function startPoint(type) {
    _cancelIfActive();
    drawingMode = 'point';
    drawingPointType = type || null;
    if (type) {
      const label = POINT_TYPES[type] ? POINT_TYPES[type].label : type;
      _showBanner(label + ' setzen', 'Klicke auf die Karte um den Punkt zu platzieren.');
    } else {
      _showBanner('Punkt setzen', 'Klicke auf die Karte. Du kannst dann den Typ wählen.');
    }
    _enableDrawingMode();
  }

  function cancelDrawing() {
    _cancelIfActive();
  }

  // ── Interne Zeichenlogik ──

  function _enableDrawingMode() {
    document.body.classList.add('drawing-mode');
    map.on('click', _onMapClick);
    map.on('dblclick', _onMapDblClick);
    map.on('mousemove', _onMouseMove);
    // Doppelklick-Zoom deaktivieren
    map.doubleClickZoom.disable();
  }

  function _disableDrawingMode() {
    document.body.classList.remove('drawing-mode');
    map.off('click', _onMapClick);
    map.off('dblclick', _onMapDblClick);
    map.off('mousemove', _onMouseMove);
    map.doubleClickZoom.enable();
    _clearVertexMarkers();
    _clearPreview();
    _hideBanner();
    drawingMode = null;
    drawingPointType = null;
    currentVertices = [];
  }

  function _cancelIfActive() {
    if (drawingMode) {
      _disableDrawingMode();
    }
  }

  function _onMapClick(e) {
    if (!drawingMode) return;

    const lngLat = [e.lngLat.lng, e.lngLat.lat];

    if (drawingMode === 'point') {
      _handlePointClick(e);
      return;
    }

    // Polygon oder Linie: Vertex hinzufügen
    currentVertices.push(lngLat);
    _addVertexMarker(lngLat);
    _updatePreview();
  }

  function _onMapDblClick(e) {
    if (!drawingMode) return;
    if (drawingMode === 'point') return;

    e.preventDefault();

    // Letzten Doppelklick-Punkt nicht doppelt hinzufügen
    // (der erste Klick des Doppelklicks hat bereits einen Punkt gesetzt)

    if (drawingMode === 'polygon' && currentVertices.length < 3) {
      alert('Ein Polygon braucht mindestens 3 Punkte.');
      return;
    }

    if (drawingMode === 'line' && currentVertices.length < 2) {
      alert('Eine Linie braucht mindestens 2 Punkte.');
      return;
    }

    const mode = drawingMode;
    const vertices = [...currentVertices];

    _disableDrawingMode();

    if (mode === 'polygon' && window._pendingPerimeterCallback) {
      // Baustellen-Perimeter: Callback aufrufen statt Zeichnungs-Formular
      const ring = [...vertices, vertices[0]];
      const geometry = { type: 'Polygon', coordinates: [ring] };
      const cb = window._pendingPerimeterCallback;
      window._pendingPerimeterCallback = null;
      cb(geometry);
      return;
    } else if (mode === 'polygon') {
      _showPolygonForm(vertices);
    } else if (mode === 'line') {
      _showLineForm(vertices);
    }
  }

  function _onMouseMove(e) {
    if (!drawingMode || drawingMode === 'point') return;
    if (currentVertices.length === 0) return;

    // Live-Preview mit Mausposition
    const mouseCoord = [e.lngLat.lng, e.lngLat.lat];
    const coords = [...currentVertices, mouseCoord];

    let geojson;
    if (drawingMode === 'polygon' && coords.length >= 3) {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[...coords, coords[0]]],
          },
        }],
      };
    } else {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        }],
      };
    }

    const src = map.getSource('drawing-preview');
    if (src) src.setData(geojson);
  }

  function _updatePreview() {
    if (currentVertices.length < 2) return;

    let geojson;
    if (drawingMode === 'polygon' && currentVertices.length >= 3) {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[...currentVertices, currentVertices[0]]],
          },
        }],
      };
    } else {
      geojson = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: currentVertices,
          },
        }],
      };
    }

    const src = map.getSource('drawing-preview');
    if (src) src.setData(geojson);
  }

  function _clearPreview() {
    const src = map.getSource('drawing-preview');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  }

  // ── Vertex-Marker ──

  function _addVertexMarker(lngLat) {
    const el = document.createElement('div');
    el.className = 'drawing-vertex';
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(lngLat)
      .addTo(map);
    vertexMarkers.push(marker);
  }

  function _clearVertexMarkers() {
    vertexMarkers.forEach(m => m.remove());
    vertexMarkers = [];
  }

  // ── Punkt-Logik ──

  function _handlePointClick(e) {
    const lngLat = [e.lngLat.lng, e.lngLat.lat];

    if (drawingPointType) {
      // Typ bereits bekannt => direkt Formular zeigen
      _disableDrawingMode();
      _showPointForm(lngLat, drawingPointType);
    } else {
      // Typ-Auswahl Popup anzeigen
      _disableDrawingMode();
      _showPointTypeSelector(e.lngLat, lngLat);
    }
  }

  function _showPointTypeSelector(lngLat, coordArray) {
    if (editPopup) editPopup.remove();

    const html = `
      <div class="drawing-type-selector">
        <div class="type-header">Was für ein Objekt?</div>
        ${Object.entries(POINT_TYPES).map(([key, cfg]) => `
          <div class="type-option" data-type="${key}">
            <div class="type-icon" style="background: ${cfg.color}22; color: ${cfg.color};">${cfg.icon}</div>
            <span>${cfg.label}</span>
          </div>
        `).join('')}
      </div>
    `;

    editPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '240px', className: 'drawing-edit-popup' })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(map);

    // Event-Handler auf die Optionen
    setTimeout(() => {
      document.querySelectorAll('.type-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const type = opt.dataset.type;
          editPopup.remove();
          editPopup = null;
          _showPointForm(coordArray, type);
        });
      });
    }, 50);
  }

  // ── Banner (Zeichenmodus-Indikator) ──

  function _showBanner(title, hint) {
    _hideBanner();
    const mapContainer = document.querySelector('.map-container') || document.getElementById('map').parentElement;
    bannerEl = document.createElement('div');
    bannerEl.className = 'drawing-banner';
    bannerEl.innerHTML = `
      <span>${title}</span>
      <span class="banner-hint">${hint}</span>
      <button class="banner-cancel" onclick="window.DrawingModule.cancelDrawing()">Abbrechen</button>
    `;
    mapContainer.appendChild(bannerEl);
  }

  function _hideBanner() {
    if (bannerEl && bannerEl.parentElement) {
      bannerEl.parentElement.removeChild(bannerEl);
    }
    bannerEl = null;
  }

  // ── Formulare ──

  /**
   * Polygon-Formular: Name, Auftraggeber, Typ, Budget
   */
  function _showPolygonForm(vertices) {
    const overlay = _createOverlay();

    overlay.innerHTML = `
      <div class="drawing-form">
        <div class="drawing-form-header">
          <h3>Neue Baustelle</h3>
          <div class="form-subtitle">// Polygon — ${vertices.length} Punkte</div>
        </div>
        <div class="drawing-form-body">
          <div class="drawing-form-group">
            <label>Name</label>
            <input type="text" id="df-name" placeholder="z.B. Wasserleitung Musterstrasse" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Auftraggeber</label>
            <input type="text" id="df-auftraggeber" placeholder="z.B. SWG Grenchen">
          </div>
          <div class="drawing-form-group">
            <label>Typ</label>
            <select id="df-typ">
              <option value="Wasserleitung">Wasserleitung</option>
              <option value="Gasleitung">Gasleitung</option>
              <option value="Kanalisation">Kanalisation</option>
              <option value="Stromkabel">Stromkabel</option>
              <option value="Strassenbau">Strassenbau</option>
              <option value="Hochbau">Hochbau</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div class="drawing-form-group">
            <label>Budget (CHF)</label>
            <input type="number" id="df-budget" placeholder="z.B. 250000" min="0" step="1000">
          </div>
        </div>
        <div class="drawing-form-footer">
          <button class="drawing-btn drawing-btn-secondary" id="df-cancel">Abbrechen</button>
          <button class="drawing-btn drawing-btn-primary" id="df-save">Speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#df-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#df-save').onclick = () => {
      const name = overlay.querySelector('#df-name').value.trim();
      if (!name) {
        overlay.querySelector('#df-name').style.borderColor = '#EF4444';
        return;
      }

      // Polygon schliessen (erster Punkt am Ende wiederholen)
      const closedCoords = [...vertices, vertices[0]];

      const feature = {
        type: 'Feature',
        properties: {
          id: _generateId('P'),
          drawingType: 'polygon',
          name: name,
          auftraggeber: overlay.querySelector('#df-auftraggeber').value.trim(),
          typ: overlay.querySelector('#df-typ').value,
          budget: parseFloat(overlay.querySelector('#df-budget').value) || 0,
          createdAt: new Date().toISOString(),
        },
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords],
        },
      };

      features.push(feature);
      _saveToStorage();
      _updateSourceData();
      overlay.remove();
    };
  }

  /**
   * Linien-Formular: Typ, Material, Tiefe, Breite + auto Länge/Kubatur
   */
  function _showLineForm(vertices) {
    const laenge = _calculateLength(vertices);
    const overlay = _createOverlay();

    overlay.innerHTML = `
      <div class="drawing-form">
        <div class="drawing-form-header">
          <h3>Neuer Graben / Leitung</h3>
          <div class="form-subtitle">// Linie — ${vertices.length} Punkte</div>
        </div>
        <div class="drawing-form-body">
          <div class="drawing-form-info">
            <div class="info-label">Berechnete Länge</div>
            <div class="info-value" id="df-laenge-display">${laenge.toFixed(1)} m</div>
          </div>
          <div class="drawing-form-group">
            <label>Typ</label>
            <select id="df-typ">
              <option value="Wasserleitung">Wasserleitung</option>
              <option value="Gasleitung">Gasleitung</option>
              <option value="Kanalisation">Kanalisation</option>
              <option value="Stromkabel">Stromkabel</option>
            </select>
          </div>
          <div class="drawing-form-group">
            <label>Material</label>
            <input type="text" id="df-material" placeholder="z.B. PE DN150, Beton DN400">
          </div>
          <div class="drawing-form-group">
            <div class="form-row">
              <div class="form-col">
                <label>Tiefe (m)</label>
                <input type="number" id="df-tiefe" placeholder="1.5" min="0" step="0.1" value="1.5">
              </div>
              <div class="form-col">
                <label>Breite (m)</label>
                <input type="number" id="df-breite" placeholder="0.8" min="0" step="0.1" value="0.8">
              </div>
            </div>
          </div>
          <div class="drawing-form-info">
            <div class="info-label">Kubatur (Länge x Tiefe x Breite)</div>
            <div class="info-value" id="df-kubatur-display">${(laenge * 1.5 * 0.8).toFixed(1)} m³</div>
          </div>
        </div>
        <div class="drawing-form-footer">
          <button class="drawing-btn drawing-btn-secondary" id="df-cancel">Abbrechen</button>
          <button class="drawing-btn drawing-btn-primary" id="df-save">Speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Kubatur live aktualisieren
    const tiefeInput = overlay.querySelector('#df-tiefe');
    const breiteInput = overlay.querySelector('#df-breite');
    const kubaturDisplay = overlay.querySelector('#df-kubatur-display');

    function updateKubatur() {
      const t = parseFloat(tiefeInput.value) || 0;
      const b = parseFloat(breiteInput.value) || 0;
      kubaturDisplay.textContent = (laenge * t * b).toFixed(1) + ' m\u00B3';
    }

    tiefeInput.addEventListener('input', updateKubatur);
    breiteInput.addEventListener('input', updateKubatur);

    overlay.querySelector('#df-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#df-save').onclick = () => {
      const typ = overlay.querySelector('#df-typ').value;
      const tiefe = parseFloat(tiefeInput.value) || 0;
      const breite = parseFloat(breiteInput.value) || 0;

      const feature = {
        type: 'Feature',
        properties: {
          id: _generateId('L'),
          drawingType: 'line',
          typ: typ,
          material: overlay.querySelector('#df-material').value.trim(),
          tiefe: tiefe,
          breite: breite,
          laenge_m: Math.round(laenge * 10) / 10,
          kubatur_m3: Math.round(laenge * tiefe * breite * 10) / 10,
          color: LINE_COLORS[typ] || '#E8833A',
          createdAt: new Date().toISOString(),
        },
        geometry: {
          type: 'LineString',
          coordinates: vertices,
        },
      };

      features.push(feature);
      _saveToStorage();
      _updateSourceData();
      overlay.remove();
    };
  }

  /**
   * Punkt-Formular: Typ-abhängige Felder
   */
  function _showPointForm(coords, type) {
    const cfg = POINT_TYPES[type] || { icon: '\u{1F4CD}', color: '#E8833A', label: type };
    const overlay = _createOverlay();

    let fieldsHTML = '';

    switch (type) {
      case 'maschine':
        fieldsHTML = `
          <div class="drawing-form-group">
            <label>Maschinenname</label>
            <input type="text" id="df-name" placeholder="z.B. Bagger CAT 320" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Maschinentyp</label>
            <select id="df-subtyp">
              <option value="Kettenbagger">Kettenbagger</option>
              <option value="Mobilbagger">Mobilbagger</option>
              <option value="Walze">Walze</option>
              <option value="Dumper">Dumper</option>
              <option value="Radlader">Radlader</option>
              <option value="Kompressor">Kompressor</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>
          <div class="drawing-form-group">
            <label>Bemerkung</label>
            <textarea id="df-bemerkung" placeholder="Optional"></textarea>
          </div>
        `;
        break;

      case 'schacht':
        fieldsHTML = `
          <div class="drawing-form-group">
            <label>Schacht-ID</label>
            <input type="text" id="df-name" placeholder="z.B. S-001" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Tiefe (m)</label>
            <input type="number" id="df-tiefe" placeholder="z.B. 2.5" min="0" step="0.1">
          </div>
          <div class="drawing-form-group">
            <label>Durchmesser (mm)</label>
            <input type="number" id="df-durchmesser" placeholder="z.B. 1000" min="0" step="100">
          </div>
          <div class="drawing-form-group">
            <label>Bemerkung</label>
            <textarea id="df-bemerkung" placeholder="Optional"></textarea>
          </div>
        `;
        break;

      case 'hydrant':
        fieldsHTML = `
          <div class="drawing-form-group">
            <label>Hydrant-Nr.</label>
            <input type="text" id="df-name" placeholder="z.B. H-042" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Typ</label>
            <select id="df-subtyp">
              <option value="Überflur">Überflur</option>
              <option value="Unterflur">Unterflur</option>
            </select>
          </div>
          <div class="drawing-form-group">
            <label>Bemerkung</label>
            <textarea id="df-bemerkung" placeholder="Optional"></textarea>
          </div>
        `;
        break;

      case 'foto':
        fieldsHTML = `
          <div class="drawing-form-group">
            <label>Titel</label>
            <input type="text" id="df-name" placeholder="z.B. Zustand vor Grabung" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Beschreibung</label>
            <textarea id="df-bemerkung" placeholder="Was zeigt das Foto?"></textarea>
          </div>
        `;
        break;

      default:
        fieldsHTML = `
          <div class="drawing-form-group">
            <label>Bezeichnung</label>
            <input type="text" id="df-name" placeholder="Name / ID" autofocus>
          </div>
          <div class="drawing-form-group">
            <label>Bemerkung</label>
            <textarea id="df-bemerkung" placeholder="Optional"></textarea>
          </div>
        `;
    }

    overlay.innerHTML = `
      <div class="drawing-form">
        <div class="drawing-form-header">
          <h3>${cfg.icon} ${cfg.label}</h3>
          <div class="form-subtitle">// Punkt — ${coords[1].toFixed(5)}°N ${coords[0].toFixed(5)}°E</div>
        </div>
        <div class="drawing-form-body">
          ${fieldsHTML}
        </div>
        <div class="drawing-form-footer">
          <button class="drawing-btn drawing-btn-secondary" id="df-cancel">Abbrechen</button>
          <button class="drawing-btn drawing-btn-primary" id="df-save">Speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#df-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#df-save').onclick = () => {
      const nameEl = overlay.querySelector('#df-name');
      const name = nameEl ? nameEl.value.trim() : cfg.label;

      if (nameEl && !name) {
        nameEl.style.borderColor = '#EF4444';
        return;
      }

      const props = {
        id: _generateId('PT'),
        drawingType: 'point',
        pointType: type,
        name: name,
        createdAt: new Date().toISOString(),
      };

      // Typ-spezifische Felder auslesen
      const subtypEl = overlay.querySelector('#df-subtyp');
      if (subtypEl) props.subtyp = subtypEl.value;

      const tiefeEl = overlay.querySelector('#df-tiefe');
      if (tiefeEl) props.tiefe = parseFloat(tiefeEl.value) || 0;

      const durchmesserEl = overlay.querySelector('#df-durchmesser');
      if (durchmesserEl) props.durchmesser = parseFloat(durchmesserEl.value) || 0;

      const bemerkungEl = overlay.querySelector('#df-bemerkung');
      if (bemerkungEl) props.bemerkung = bemerkungEl.value.trim();

      const feature = {
        type: 'Feature',
        properties: props,
        geometry: {
          type: 'Point',
          coordinates: coords,
        },
      };

      features.push(feature);
      _saveToStorage();
      _updateSourceData();
      _addPointMarker(feature);
      overlay.remove();
    };
  }

  function _createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'drawing-form-overlay';
    // Klick auf Hintergrund schliesst nicht (bewusst, um Datenverlust zu vermeiden)
    return overlay;
  }

  // ── Punkt-Marker rendern ──

  function _renderAllPointMarkers() {
    // Bestehende Marker entfernen
    pointMarkers.forEach(m => m.remove());
    pointMarkers = [];

    features.forEach(f => {
      if (f.geometry.type === 'Point') {
        _addPointMarker(f);
      }
    });
  }

  function _addPointMarker(feature) {
    const props = feature.properties;
    const type = props.pointType || 'foto';
    const cfg = POINT_TYPES[type] || { icon: '\u{1F4CD}', color: '#E8833A' };

    const el = document.createElement('div');
    el.className = 'drawing-point-marker draggable';
    el.style.background = cfg.color;
    el.innerHTML = cfg.icon;
    el.dataset.featureId = props.id;

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(feature.geometry.coordinates)
      .addTo(map);

    // Drag-Event: Position aktualisieren
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      const f = features.find(ft => ft.properties.id === props.id);
      if (f) {
        f.geometry.coordinates = [lngLat.lng, lngLat.lat];
        _saveToStorage();
        _updateSourceData();
      }
    });

    // Klick-Event: Edit-Popup zeigen
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _showEditPopup(feature, marker.getLngLat());
    });

    pointMarkers.push(marker);
  }

  // ── Objekte bearbeiten / löschen ──

  function _registerClickHandlers() {
    // Klick auf eigene Polygone
    map.on('click', 'drawing-polygon-fill', (e) => {
      if (drawingMode) return;
      const props = e.features[0].properties;
      const feature = features.find(f => f.properties.id === props.id);
      if (feature) _showEditPopup(feature, e.lngLat);
    });

    // Klick auf eigene Linien
    map.on('click', 'drawing-line', (e) => {
      if (drawingMode) return;
      const props = e.features[0].properties;
      const feature = features.find(f => f.properties.id === props.id);
      if (feature) _showEditPopup(feature, e.lngLat);
    });

    // Cursor für eigene Layer
    ['drawing-polygon-fill', 'drawing-line'].forEach(layer => {
      map.on('mouseenter', layer, () => {
        if (!drawingMode) map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        if (!drawingMode) map.getCanvas().style.cursor = '';
      });
    });
  }

  function _showEditPopup(feature, lngLat) {
    if (editPopup) editPopup.remove();

    const props = feature.properties;
    let typeLabel = '';
    let rowsHTML = '';

    if (props.drawingType === 'polygon') {
      typeLabel = 'Baustelle (Polygon)';
      rowsHTML = `
        <div class="edit-popup-row"><span>Typ:</span> <strong>${props.typ || '—'}</strong></div>
        <div class="edit-popup-row"><span>Auftraggeber:</span> <strong>${props.auftraggeber || '—'}</strong></div>
        <div class="edit-popup-row"><span>Budget:</span> <strong>CHF ${_formatNumber(props.budget || 0)}</strong></div>
      `;
    } else if (props.drawingType === 'line') {
      typeLabel = 'Graben / Leitung';
      rowsHTML = `
        <div class="edit-popup-row"><span>Typ:</span> <strong>${props.typ || '—'}</strong></div>
        <div class="edit-popup-row"><span>Material:</span> <strong>${props.material || '—'}</strong></div>
        <div class="edit-popup-row"><span>Länge:</span> <strong>${props.laenge_m || 0} m</strong></div>
        <div class="edit-popup-row"><span>Tiefe:</span> <strong>${props.tiefe || 0} m</strong></div>
        <div class="edit-popup-row"><span>Breite:</span> <strong>${props.breite || 0} m</strong></div>
        <div class="edit-popup-row"><span>Kubatur:</span> <strong>${props.kubatur_m3 || 0} m\u00B3</strong></div>
      `;
    } else if (props.drawingType === 'point') {
      const ptCfg = POINT_TYPES[props.pointType] || { label: 'Punkt' };
      typeLabel = ptCfg.label;
      if (props.subtyp) rowsHTML += `<div class="edit-popup-row"><span>Typ:</span> <strong>${props.subtyp}</strong></div>`;
      if (props.tiefe) rowsHTML += `<div class="edit-popup-row"><span>Tiefe:</span> <strong>${props.tiefe} m</strong></div>`;
      if (props.durchmesser) rowsHTML += `<div class="edit-popup-row"><span>\u00D8:</span> <strong>${props.durchmesser} mm</strong></div>`;
      if (props.bemerkung) rowsHTML += `<div class="edit-popup-row"><span>Bemerkung:</span> <strong>${props.bemerkung}</strong></div>`;
    }

    const html = `
      <div class="edit-popup-header">
        <h4>${props.name || '—'}</h4>
        <div class="edit-popup-type">${typeLabel}</div>
      </div>
      <div class="edit-popup-body">
        ${rowsHTML}
      </div>
      <div class="edit-popup-actions">
        <button class="drawing-btn drawing-btn-small drawing-btn-primary" data-action="edit" data-id="${props.id}">Bearbeiten</button>
        <button class="drawing-btn drawing-btn-small drawing-btn-danger" data-action="delete" data-id="${props.id}">Löschen</button>
      </div>
    `;

    editPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'drawing-edit-popup' })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(map);

    // Edit/Delete Handler
    setTimeout(() => {
      const editBtn = document.querySelector('[data-action="edit"][data-id="' + props.id + '"]');
      const deleteBtn = document.querySelector('[data-action="delete"][data-id="' + props.id + '"]');

      if (editBtn) {
        editBtn.addEventListener('click', () => {
          editPopup.remove();
          _showEditForm(feature);
        });
      }

      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm('Objekt "' + (props.name || props.id) + '" wirklich löschen?')) {
            _deleteFeature(props.id);
            editPopup.remove();
          }
        });
      }
    }, 50);
  }

  /**
   * Edit-Formular: Attribute des Features bearbeiten
   */
  function _showEditForm(feature) {
    const props = feature.properties;
    const overlay = _createOverlay();

    let fieldsHTML = '';

    // Gemeinsames Feld: Name
    fieldsHTML += `
      <div class="drawing-form-group">
        <label>Name / Bezeichnung</label>
        <input type="text" id="dfe-name" value="${_escHtml(props.name || '')}">
      </div>
    `;

    if (props.drawingType === 'polygon') {
      fieldsHTML += `
        <div class="drawing-form-group">
          <label>Auftraggeber</label>
          <input type="text" id="dfe-auftraggeber" value="${_escHtml(props.auftraggeber || '')}">
        </div>
        <div class="drawing-form-group">
          <label>Typ</label>
          <select id="dfe-typ">
            ${['Wasserleitung','Gasleitung','Kanalisation','Stromkabel','Strassenbau','Hochbau','Sonstiges'].map(t =>
              `<option value="${t}" ${props.typ === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="drawing-form-group">
          <label>Budget (CHF)</label>
          <input type="number" id="dfe-budget" value="${props.budget || 0}" min="0" step="1000">
        </div>
      `;
    } else if (props.drawingType === 'line') {
      fieldsHTML += `
        <div class="drawing-form-group">
          <label>Typ</label>
          <select id="dfe-typ">
            ${['Wasserleitung','Gasleitung','Kanalisation','Stromkabel'].map(t =>
              `<option value="${t}" ${props.typ === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="drawing-form-group">
          <label>Material</label>
          <input type="text" id="dfe-material" value="${_escHtml(props.material || '')}">
        </div>
        <div class="drawing-form-group">
          <div class="form-row">
            <div class="form-col">
              <label>Tiefe (m)</label>
              <input type="number" id="dfe-tiefe" value="${props.tiefe || 0}" min="0" step="0.1">
            </div>
            <div class="form-col">
              <label>Breite (m)</label>
              <input type="number" id="dfe-breite" value="${props.breite || 0}" min="0" step="0.1">
            </div>
          </div>
        </div>
        <div class="drawing-form-info">
          <div class="info-label">Länge / Kubatur</div>
          <div class="info-value">${props.laenge_m || 0} m — ${props.kubatur_m3 || 0} m\u00B3</div>
        </div>
      `;
    } else if (props.drawingType === 'point') {
      if (props.pointType === 'maschine') {
        fieldsHTML += `
          <div class="drawing-form-group">
            <label>Maschinentyp</label>
            <select id="dfe-subtyp">
              ${['Kettenbagger','Mobilbagger','Walze','Dumper','Radlader','Kompressor','Sonstiges'].map(t =>
                `<option value="${t}" ${props.subtyp === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
        `;
      } else if (props.pointType === 'schacht') {
        fieldsHTML += `
          <div class="drawing-form-group">
            <label>Tiefe (m)</label>
            <input type="number" id="dfe-tiefe" value="${props.tiefe || 0}" min="0" step="0.1">
          </div>
          <div class="drawing-form-group">
            <label>Durchmesser (mm)</label>
            <input type="number" id="dfe-durchmesser" value="${props.durchmesser || 0}" min="0" step="100">
          </div>
        `;
      } else if (props.pointType === 'hydrant') {
        fieldsHTML += `
          <div class="drawing-form-group">
            <label>Typ</label>
            <select id="dfe-subtyp">
              <option value="Überflur" ${'Überflur' === props.subtyp ? 'selected' : ''}>Überflur</option>
              <option value="Unterflur" ${'Unterflur' === props.subtyp ? 'selected' : ''}>Unterflur</option>
            </select>
          </div>
        `;
      }
      fieldsHTML += `
        <div class="drawing-form-group">
          <label>Bemerkung</label>
          <textarea id="dfe-bemerkung">${_escHtml(props.bemerkung || '')}</textarea>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="drawing-form">
        <div class="drawing-form-header">
          <h3>Objekt bearbeiten</h3>
          <div class="form-subtitle">// ${props.id}</div>
        </div>
        <div class="drawing-form-body">
          ${fieldsHTML}
        </div>
        <div class="drawing-form-footer">
          <button class="drawing-btn drawing-btn-secondary" id="dfe-cancel">Abbrechen</button>
          <button class="drawing-btn drawing-btn-primary" id="dfe-save">Speichern</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#dfe-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#dfe-save').onclick = () => {
      const f = features.find(ft => ft.properties.id === props.id);
      if (!f) { overlay.remove(); return; }

      // Gemeinsame Felder
      const nameEl = overlay.querySelector('#dfe-name');
      if (nameEl) f.properties.name = nameEl.value.trim();

      // Typ-spezifisch
      if (props.drawingType === 'polygon') {
        const aufEl = overlay.querySelector('#dfe-auftraggeber');
        if (aufEl) f.properties.auftraggeber = aufEl.value.trim();
        const typEl = overlay.querySelector('#dfe-typ');
        if (typEl) f.properties.typ = typEl.value;
        const budEl = overlay.querySelector('#dfe-budget');
        if (budEl) f.properties.budget = parseFloat(budEl.value) || 0;
      } else if (props.drawingType === 'line') {
        const typEl = overlay.querySelector('#dfe-typ');
        if (typEl) {
          f.properties.typ = typEl.value;
          f.properties.color = LINE_COLORS[typEl.value] || '#E8833A';
        }
        const matEl = overlay.querySelector('#dfe-material');
        if (matEl) f.properties.material = matEl.value.trim();
        const tEl = overlay.querySelector('#dfe-tiefe');
        const bEl = overlay.querySelector('#dfe-breite');
        if (tEl) f.properties.tiefe = parseFloat(tEl.value) || 0;
        if (bEl) f.properties.breite = parseFloat(bEl.value) || 0;
        // Kubatur neu berechnen
        f.properties.kubatur_m3 = Math.round((f.properties.laenge_m || 0) * f.properties.tiefe * f.properties.breite * 10) / 10;
      } else if (props.drawingType === 'point') {
        const subEl = overlay.querySelector('#dfe-subtyp');
        if (subEl) f.properties.subtyp = subEl.value;
        const tEl = overlay.querySelector('#dfe-tiefe');
        if (tEl) f.properties.tiefe = parseFloat(tEl.value) || 0;
        const dEl = overlay.querySelector('#dfe-durchmesser');
        if (dEl) f.properties.durchmesser = parseFloat(dEl.value) || 0;
        const bemEl = overlay.querySelector('#dfe-bemerkung');
        if (bemEl) f.properties.bemerkung = bemEl.value.trim();
      }

      _saveToStorage();
      _updateSourceData();
      _renderAllPointMarkers();
      overlay.remove();
    };
  }

  function _deleteFeature(id) {
    features = features.filter(f => f.properties.id !== id);
    _saveToStorage();
    _updateSourceData();
    _renderAllPointMarkers();
  }

  // ── GeoJSON-Daten verwalten ──

  function _buildGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: features,
    };
  }

  function _updateSourceData() {
    const src = map.getSource(SOURCE_ID);
    if (src) {
      src.setData(_buildGeoJSON());
    }
  }

  // ── localStorage Persistenz ──

  function _saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
    } catch (e) {
      console.warn('[DrawingModule] localStorage Speichern fehlgeschlagen:', e);
    }
  }

  function _loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        features = JSON.parse(data);
        if (!Array.isArray(features)) features = [];
      }
    } catch (e) {
      console.warn('[DrawingModule] localStorage Laden fehlgeschlagen:', e);
      features = [];
    }
  }

  // ── Export / Import ──

  function exportGeoJSON() {
    const geojson = _buildGeoJSON();
    const json = JSON.stringify(geojson, null, 2);
    const blob = new Blob([json], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bausite-geo-drawings-' + new Date().toISOString().slice(0, 10) + '.geojson';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importGeoJSON(file) {
    if (!file) {
      // Dateiauswahl-Dialog öffnen
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.geojson,.json';
      input.className = 'drawing-import-input';
      input.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          importGeoJSON(e.target.files[0]);
        }
      });
      input.click();
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const geojson = JSON.parse(e.target.result);

        if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
          alert('Ungültige GeoJSON-Datei. Es wird eine FeatureCollection erwartet.');
          return;
        }

        // Jedes importierte Feature mit neuer ID versehen falls keine vorhanden
        let importCount = 0;
        geojson.features.forEach(f => {
          if (!f.properties) f.properties = {};
          if (!f.properties.id) f.properties.id = _generateId('IMP');
          if (!f.properties.drawingType) {
            // Typ aus Geometrie ableiten
            if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
              f.properties.drawingType = 'polygon';
            } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') {
              f.properties.drawingType = 'line';
            } else if (f.geometry.type === 'Point') {
              f.properties.drawingType = 'point';
              if (!f.properties.pointType) f.properties.pointType = 'foto';
            }
          }
          f.properties.importedAt = new Date().toISOString();
          features.push(f);
          importCount++;
        });

        _saveToStorage();
        _updateSourceData();
        _renderAllPointMarkers();
        alert(importCount + ' Objekt(e) importiert.');
      } catch (err) {
        alert('Fehler beim Lesen der Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function getFeatures() {
    return _buildGeoJSON();
  }

  function clearAll() {
    if (!confirm('Alle eigenen Zeichnungen löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    features = [];
    _saveToStorage();
    _updateSourceData();
    _renderAllPointMarkers();
  }

  // ── Berechnungen ──

  /**
   * Berechnet die Gesamtlänge einer Linie in Metern
   * mittels Haversine-Formel.
   */
  function _calculateLength(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      total += _haversineDistance(coords[i - 1], coords[i]);
    }
    return total;
  }

  /**
   * Haversine-Distanz zwischen zwei [lng, lat]-Punkten.
   * Gibt Distanz in Metern zurück.
   */
  function _haversineDistance(a, b) {
    const R = 6371000; // Erdradius in Metern
    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // ── Hilfsfunktionen ──

  function _generateId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function _formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  function _escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Öffentliche API ──

  window.DrawingModule = {
    startPolygon:    startPolygon,
    startLine:       startLine,
    startPoint:      startPoint,
    cancelDrawing:   cancelDrawing,
    exportGeoJSON:   exportGeoJSON,
    importGeoJSON:   importGeoJSON,
    getFeatures:     getFeatures,
    clearAll:        clearAll,
  };

  // Automatisch initialisieren
  init();

})();
