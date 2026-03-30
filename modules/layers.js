// ============================================
// BAUSITE Geo — Layer-Modul
// Schweizer Geodaten-Layer via swisstopo WMTS
// Für Bauunternehmer / Bauführer
// ============================================
//
// Bindet echte swisstopo WMTS-Layer in die MapLibre GL JS Karte ein.
// Alle Layer sind gratis verfügbar (seit 2021 Open Data).
//
// Benötigt: globale Variable `map` (MapLibre Map-Instanz)
// Design: Navy (#1B2A4A), Orange (#E8833A)
// ============================================

(function () {
  'use strict';

  // ── Konstanten ──

  const WMTS_BASE = 'https://wmts.geo.admin.ch/1.0.0';
  const SWISSTOPO_DOC_BASE = 'https://map.geo.admin.ch/?topic=ech&lang=de&layers=';

  /**
   * Tile-URL für swisstopo WMTS erstellen.
   * @param {string} layerId - swisstopo Layer-ID (z.B. "ch.swisstopo.swissimage")
   * @param {string} format  - Bildformat ("png" oder "jpeg")
   * @returns {string} URL-Template für MapLibre
   */
  function wmtsTileUrl(layerId, format = 'png') {
    return `${WMTS_BASE}/${layerId}/default/current/3857/{z}/{x}/{y}.${format}`;
  }

  // ── Layer-Katalog ──
  // Jeder Eintrag definiert einen swisstopo WMTS-Layer mit Metadaten.

  const LAYER_CATALOG = {
    // ── Grundlagen ──
    'ch.swisstopo.swissimage': {
      name: 'Luftbild (SWISSIMAGE)',
      category: 'grundlagen',
      description: 'Hochauflösendes Orthofoto der gesamten Schweiz (25cm)',
      format: 'jpeg',
      maxzoom: 20,
      defaultOpacity: 1.0,
      icon: '🛰️',
    },
    'ch.swisstopo.pixelkarte-farbe': {
      name: 'Landeskarte farbig',
      category: 'grundlagen',
      description: 'Farbige Landeskarten 1:25\'000 bis 1:1 Mio.',
      format: 'jpeg',
      maxzoom: 20,
      defaultOpacity: 1.0,
      icon: '🗺️',
    },
    'ch.swisstopo.pixelkarte-grau': {
      name: 'Landeskarte grau',
      category: 'grundlagen',
      description: 'Graue Landeskarten — ideal als Hintergrund für Overlays',
      format: 'jpeg',
      maxzoom: 20,
      defaultOpacity: 1.0,
      icon: '⬜',
    },

    // ── Baugrund ──
    'ch.swisstopo.geologie-geologische_karte': {
      name: 'Geologische Karte',
      category: 'baugrund',
      description: 'Geologische Karte der Schweiz — wichtig für Baugrundbeurteilung',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.7,
      icon: '🪨',
    },
    'ch.bafu.grundwasservorkommen': {
      name: 'Grundwasservorkommen',
      category: 'baugrund',
      description: 'Grundwasserkarte — relevant für Aushub und Fundamente',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.6,
      icon: '💧',
    },
    'ch.bav.kataster-belasteter-standorte-oev': {
      name: 'Belastete Standorte (Altlasten)',
      category: 'baugrund',
      description: 'Kataster belasteter Standorte — Altlastenverdacht prüfen!',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.7,
      icon: '⚠️',
    },
    'ch.swisstopo.hangneigung-ueber_30': {
      name: 'Hangneigung >30°',
      category: 'baugrund',
      description: 'Gebiete mit Hangneigung über 30° — Rutschgefahr!',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.6,
      icon: '⛰️',
    },

    // ── Umwelt ──
    'ch.bafu.laerm-strassenverkehr_tag': {
      name: 'Strassenlärm (Tag)',
      category: 'umwelt',
      description: 'Lärmbelastung durch Strassenverkehr — Tagesperiode (Lr)',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.6,
      icon: '🔊',
    },
    'ch.bafu.gefahrenkarte-hochwasser': {
      name: 'Hochwasser-Gefahrenkarte',
      category: 'umwelt',
      description: 'Hochwassergefahrenkarte — Überflutungsrisiko für Baugebiete',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.6,
      icon: '🌊',
    },
    'ch.bfe.solarenergie-eignung-daecher': {
      name: 'Solarpotenzial Dächer',
      category: 'umwelt',
      description: 'Eignung von Dachflächen für Solarenergie — für Versorgungswerke',
      format: 'png',
      maxzoom: 20,
      defaultOpacity: 0.7,
      icon: '☀️',
    },

    // ── Infrastruktur ──
    'ch.swisstopo.vec200-transportation-road': {
      name: 'Strassennetz',
      category: 'infrastruktur',
      description: 'Strassennetz aus Vector200 — Autobahnen bis Feldwege',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.7,
      icon: '🛣️',
    },
    'ch.swisstopo.vec200-transportation-railway': {
      name: 'Bahnnetz',
      category: 'infrastruktur',
      description: 'Bahnnetz aus Vector200 — SBB und Privatbahnen',
      format: 'png',
      maxzoom: 18,
      defaultOpacity: 0.7,
      icon: '🚂',
    },
    'ch.swisstopo.amtliches-strassenverzeichnis': {
      name: 'Amtl. Strassenverzeichnis',
      category: 'infrastruktur',
      description: 'Offizielles Strassenverzeichnis der Schweiz',
      format: 'png',
      maxzoom: 20,
      defaultOpacity: 0.7,
      icon: '📍',
    },
    'ch.bfs.gebaeude_wohnungs_register': {
      name: 'Gebäuderegister (GWR)',
      category: 'infrastruktur',
      description: 'Eidg. Gebäude- und Wohnungsregister — Bestand & Nutzung',
      format: 'png',
      maxzoom: 20,
      defaultOpacity: 0.7,
      icon: '🏢',
    },

    // ── Zonierung ──
    'ch.are.nutzungsplanung-grundnutzung': {
      name: 'Nutzungszonen',
      category: 'zonierung',
      description: 'Grundnutzung — Bau-, Landwirtschafts-, Schutzzonen usw.',
      format: 'png',
      maxzoom: 20,
      defaultOpacity: 0.55,
      icon: '🏗️',
    },
    'ch.are.nutzungsplanung-ueberlagernd': {
      name: 'Überlagernde Nutzung',
      category: 'zonierung',
      description: 'Überlagernde Festlegungen — Ortsbildschutz, Gewässerraum, etc.',
      format: 'png',
      maxzoom: 20,
      defaultOpacity: 0.55,
      icon: '📐',
    },
  };

  // ── Kategorien mit Metadaten ──

  const CATEGORIES = {
    grundlagen: { name: 'Grundlagen', icon: '🗺️', order: 1 },
    baugrund:   { name: 'Baugrund & Geologie', icon: '🪨', order: 2 },
    umwelt:     { name: 'Umwelt & Gefahren', icon: '🌊', order: 3 },
    infrastruktur: { name: 'Infrastruktur', icon: '🛣️', order: 4 },
    zonierung:  { name: 'Zonierung & Planung', icon: '🏗️', order: 5 },
  };

  // ── Layer-Kombinations-Presets ──

  const PRESETS = {
    'baugrund-check': {
      name: 'Baugrund-Check',
      icon: '🪨',
      description: 'Geologie + Grundwasser + Altlasten + Hangneigung',
      layers: [
        'ch.swisstopo.geologie-geologische_karte',
        'ch.bafu.grundwasservorkommen',
        'ch.bav.kataster-belasteter-standorte-oev',
        'ch.swisstopo.hangneigung-ueber_30',
      ],
    },
    'verkehrsplanung': {
      name: 'Verkehrsplanung',
      icon: '🛣️',
      description: 'Strassennetz + Strassenlärm + Nutzungszonen',
      layers: [
        'ch.swisstopo.vec200-transportation-road',
        'ch.bafu.laerm-strassenverkehr_tag',
        'ch.are.nutzungsplanung-grundnutzung',
      ],
    },
    'standard': {
      name: 'Standard',
      icon: '📋',
      description: 'Alle Overlay-Layer deaktivieren',
      layers: [],
    },
  };

  // ── Modul-State ──

  /** @type {maplibregl.Map|null} */
  let _map = null;

  /** Aktive Layer mit ihren aktuellen Einstellungen: { [layerId]: { opacity, visible } } */
  const _activeLayers = {};

  /** Globale Overlay-Opazität (0-1) */
  let _globalOpacity = 1.0;

  /** Das erste Vektor-Layer-ID in der Karte (für beforeId bei addLayer) */
  let _firstVectorLayerId = null;

  /** Referenz auf das Panel-DOM-Element */
  let _panelEl = null;

  // ── Hilfsfunktionen ──

  /**
   * Findet das erste Vektor-Layer in der Karte.
   * Overlay-Raster-Layer werden VOR diesem Layer eingefügt,
   * damit Baustellen/Gräben etc. immer oben bleiben.
   */
  function findFirstVectorLayer() {
    if (!_map) return null;
    const style = _map.getStyle();
    if (!style || !style.layers) return null;

    for (const layer of style.layers) {
      if (layer.type !== 'raster') {
        return layer.id;
      }
    }
    return null;
  }

  /**
   * Berechnet die effektive Opazität (Layer-individuell * global).
   */
  function effectiveOpacity(layerId) {
    const state = _activeLayers[layerId];
    if (!state) return 0;
    return state.opacity * _globalOpacity;
  }

  /**
   * MapLibre Source-ID für einen swisstopo Layer.
   */
  function sourceId(layerId) {
    return `swisstopo-overlay-${layerId}`;
  }

  /**
   * MapLibre Layer-ID für einen swisstopo Layer.
   */
  function mapLayerId(layerId) {
    return `overlay-${layerId}`;
  }

  // ── Kern-Funktionen ──

  /**
   * Layer zur Karte hinzufügen (lazy: Source+Layer werden erst bei Aktivierung erstellt).
   * @param {string} layerId - swisstopo Layer-ID
   * @param {Object} [options]
   * @param {number} [options.opacity] - Anfangs-Opazität (0-1)
   * @param {boolean} [options.visible] - Sofort sichtbar?
   */
  function addLayer(layerId, options = {}) {
    const catalog = LAYER_CATALOG[layerId];
    if (!catalog) {
      console.warn(`[LayersModule] Unbekannter Layer: ${layerId}`);
      return;
    }

    const opacity = options.opacity !== undefined ? options.opacity : catalog.defaultOpacity;
    const visible = options.visible !== undefined ? options.visible : true;

    // Source hinzufügen falls nicht vorhanden
    const sid = sourceId(layerId);
    if (!_map.getSource(sid)) {
      _map.addSource(sid, {
        type: 'raster',
        tiles: [wmtsTileUrl(layerId, catalog.format)],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.swisstopo.ch" target="_blank">swisstopo</a>',
        maxzoom: catalog.maxzoom || 18,
      });
    }

    // Layer hinzufügen falls nicht vorhanden
    const lid = mapLayerId(layerId);
    if (!_map.getLayer(lid)) {
      // Vor dem ersten Vektor-Layer einfügen
      if (!_firstVectorLayerId) {
        _firstVectorLayerId = findFirstVectorLayer();
      }

      const layerDef = {
        id: lid,
        type: 'raster',
        source: sid,
        paint: {
          'raster-opacity': visible ? effectiveOpacity(layerId) || opacity * _globalOpacity : 0,
        },
        layout: {
          visibility: 'visible', // Immer "visible", Sichtbarkeit via raster-opacity gesteuert
        },
      };

      if (_firstVectorLayerId && _map.getLayer(_firstVectorLayerId)) {
        _map.addLayer(layerDef, _firstVectorLayerId);
      } else {
        _map.addLayer(layerDef);
      }
    }

    // State tracken
    _activeLayers[layerId] = { opacity, visible };

    // Opazität anwenden
    const lid2 = mapLayerId(layerId);
    if (_map.getLayer(lid2)) {
      _map.setPaintProperty(lid2, 'raster-opacity', visible ? opacity * _globalOpacity : 0);
    }

    // UI aktualisieren
    updateLayerUI(layerId);
  }

  /**
   * Layer von der Karte entfernen.
   * @param {string} layerId - swisstopo Layer-ID
   */
  function removeLayer(layerId) {
    const lid = mapLayerId(layerId);
    const sid = sourceId(layerId);

    if (_map.getLayer(lid)) {
      _map.removeLayer(lid);
    }
    if (_map.getSource(sid)) {
      _map.removeSource(sid);
    }

    delete _activeLayers[layerId];
    updateLayerUI(layerId);
  }

  /**
   * Opazität eines Layers setzen.
   * @param {string} layerId - swisstopo Layer-ID
   * @param {number} opacity - 0 bis 1
   */
  function setOpacity(layerId, opacity) {
    const state = _activeLayers[layerId];
    if (!state) return;

    state.opacity = Math.max(0, Math.min(1, opacity));

    const lid = mapLayerId(layerId);
    if (_map.getLayer(lid) && state.visible) {
      _map.setPaintProperty(lid, 'raster-opacity', state.opacity * _globalOpacity);
    }

    // Slider-Wert aktualisieren
    const slider = document.getElementById(`layers-opacity-${layerId}`);
    if (slider && parseFloat(slider.value) !== Math.round(state.opacity * 100)) {
      slider.value = Math.round(state.opacity * 100);
    }
    const label = document.getElementById(`layers-opacity-val-${layerId}`);
    if (label) {
      label.textContent = `${Math.round(state.opacity * 100)}%`;
    }
  }

  /**
   * Layer ein-/ausschalten (toggle visibility).
   * @param {string} layerId
   * @param {boolean} [visible] - Erzwingen an/aus. Ohne Parameter: toggle.
   */
  function toggleLayerVisibility(layerId, visible) {
    const state = _activeLayers[layerId];

    if (state) {
      // Layer ist geladen — toggle
      state.visible = visible !== undefined ? visible : !state.visible;
      const lid = mapLayerId(layerId);
      if (_map.getLayer(lid)) {
        _map.setPaintProperty(lid, 'raster-opacity', state.visible ? state.opacity * _globalOpacity : 0);
      }
    } else {
      // Layer noch nicht geladen — hinzufügen
      if (visible === false) return;
      const catalog = LAYER_CATALOG[layerId];
      addLayer(layerId, { opacity: catalog.defaultOpacity, visible: true });
    }

    updateLayerUI(layerId);
  }

  /**
   * Globale Overlay-Opazität setzen.
   * @param {number} opacity - 0 bis 1
   */
  function setGlobalOpacity(opacity) {
    _globalOpacity = Math.max(0, Math.min(1, opacity));

    // Alle aktiven Layer aktualisieren
    for (const [layerId, state] of Object.entries(_activeLayers)) {
      const lid = mapLayerId(layerId);
      if (_map.getLayer(lid) && state.visible) {
        _map.setPaintProperty(lid, 'raster-opacity', state.opacity * _globalOpacity);
      }
    }

    // UI-Label aktualisieren
    const label = document.getElementById('layers-global-opacity-val');
    if (label) {
      label.textContent = `${Math.round(_globalOpacity * 100)}%`;
    }
  }

  /**
   * Preset anwenden — aktiviert bestimmte Layer-Kombination.
   * @param {string} presetName - Preset-Key (z.B. "baugrund-check")
   */
  function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) {
      console.warn(`[LayersModule] Unbekanntes Preset: ${presetName}`);
      return;
    }

    // Alle Overlay-Layer deaktivieren (nicht entfernen, nur unsichtbar)
    for (const [layerId, state] of Object.entries(_activeLayers)) {
      state.visible = false;
      const lid = mapLayerId(layerId);
      if (_map.getLayer(lid)) {
        _map.setPaintProperty(lid, 'raster-opacity', 0);
      }
      updateLayerUI(layerId);
    }

    // Preset-Layer aktivieren
    preset.layers.forEach(layerId => {
      toggleLayerVisibility(layerId, true);
    });

    // Globale Opazität zurücksetzen
    setGlobalOpacity(1.0);
    const globalSlider = document.getElementById('layers-global-opacity');
    if (globalSlider) globalSlider.value = 100;

    // Aktives Preset in UI markieren
    document.querySelectorAll('.layers-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetName);
    });
  }

  /**
   * Gibt die aktuell aktiven (sichtbaren) Layer zurück.
   * @returns {string[]} Array von Layer-IDs
   */
  function getActiveLayers() {
    return Object.entries(_activeLayers)
      .filter(([, state]) => state.visible)
      .map(([id]) => id);
  }

  // ── UI aufbauen ──

  /**
   * Erstellt das gesamte Layer-Manager Panel.
   */
  function buildPanel() {
    // Container-Element erstellen
    _panelEl = document.createElement('div');
    _panelEl.id = 'layers-module-panel';
    _panelEl.className = 'layers-panel';

    // Panel-Header mit Toggle
    const header = document.createElement('div');
    header.className = 'layers-panel-header';
    header.innerHTML = `
      <div class="layers-panel-title">
        <span class="layers-panel-icon">🌍</span>
        <span>Geodaten-Layer</span>
        <span class="layers-panel-badge">${Object.keys(LAYER_CATALOG).length}</span>
      </div>
      <button class="layers-panel-toggle" id="layers-panel-toggle-btn" title="Panel ein-/ausklappen">◂</button>
    `;
    _panelEl.appendChild(header);

    // Panel-Body (scrollbar)
    const body = document.createElement('div');
    body.className = 'layers-panel-body';
    body.id = 'layers-panel-body';

    // ── Presets ──
    const presetsSection = document.createElement('div');
    presetsSection.className = 'layers-section';
    presetsSection.innerHTML = `
      <div class="layers-section-header">
        <span class="layers-section-title">// Schnellauswahl</span>
      </div>
      <div class="layers-presets">
        ${Object.entries(PRESETS).map(([key, p]) => `
          <button class="layers-preset-btn" data-preset="${key}" title="${p.description}">
            <span class="preset-icon">${p.icon}</span>
            <span class="preset-name">${p.name}</span>
          </button>
        `).join('')}
      </div>
    `;
    body.appendChild(presetsSection);

    // ── Globale Opazität ──
    const globalSection = document.createElement('div');
    globalSection.className = 'layers-section';
    globalSection.innerHTML = `
      <div class="layers-section-header">
        <span class="layers-section-title">// Overlay-Transparenz</span>
        <span class="layers-opacity-val" id="layers-global-opacity-val">100%</span>
      </div>
      <div class="layers-global-slider">
        <input type="range" id="layers-global-opacity" min="0" max="100" value="100" class="layers-slider">
      </div>
    `;
    body.appendChild(globalSection);

    // ── Kategorien mit Layern ──
    const sortedCategories = Object.entries(CATEGORIES)
      .sort(([, a], [, b]) => a.order - b.order);

    for (const [catKey, catMeta] of sortedCategories) {
      const catLayers = Object.entries(LAYER_CATALOG)
        .filter(([, meta]) => meta.category === catKey);

      if (catLayers.length === 0) continue;

      const section = document.createElement('div');
      section.className = 'layers-section';

      // Kategorie-Header (klappbar)
      section.innerHTML = `
        <div class="layers-category-header" data-category="${catKey}">
          <span class="layers-category-icon">${catMeta.icon}</span>
          <span class="layers-category-name">${catMeta.name}</span>
          <span class="layers-category-count">${catLayers.length}</span>
          <span class="layers-category-chevron">▾</span>
        </div>
        <div class="layers-category-content" id="layers-cat-${catKey}">
          ${catLayers.map(([layerId, meta]) => buildLayerItem(layerId, meta)).join('')}
        </div>
      `;
      body.appendChild(section);
    }

    _panelEl.appendChild(body);

    // Panel in die Karte einfügen (als Overlay rechts oben)
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
      mapContainer.appendChild(_panelEl);
    }

    // Events binden
    bindPanelEvents();
  }

  /**
   * Einzelnen Layer-Eintrag als HTML-String erstellen.
   */
  function buildLayerItem(layerId, meta) {
    const escapedId = layerId.replace(/\./g, '-');
    return `
      <div class="layers-item" data-layer-id="${layerId}" id="layers-item-${escapedId}">
        <div class="layers-item-header">
          <label class="layers-item-toggle">
            <input type="checkbox" id="layers-cb-${escapedId}" data-layer-id="${layerId}">
            <span class="layers-toggle-track"><span class="layers-toggle-thumb"></span></span>
          </label>
          <div class="layers-item-info">
            <span class="layers-item-icon">${meta.icon}</span>
            <span class="layers-item-name">${meta.name}</span>
          </div>
          <a class="layers-item-doc" href="${SWISSTOPO_DOC_BASE}${layerId}" target="_blank" rel="noopener"
             title="Dokumentation auf map.geo.admin.ch">ⓘ</a>
        </div>
        <div class="layers-item-desc">${meta.description}</div>
        <div class="layers-item-opacity" id="layers-opacity-row-${escapedId}" style="display: none;">
          <input type="range" id="layers-opacity-${layerId}" min="0" max="100"
                 value="${Math.round(meta.defaultOpacity * 100)}"
                 class="layers-slider layers-slider-sm" data-layer-id="${layerId}">
          <span class="layers-opacity-val" id="layers-opacity-val-${layerId}">${Math.round(meta.defaultOpacity * 100)}%</span>
        </div>
      </div>
    `;
  }

  /**
   * UI-State eines einzelnen Layers aktualisieren.
   */
  function updateLayerUI(layerId) {
    const escapedId = layerId.replace(/\./g, '-');
    const state = _activeLayers[layerId];
    const cb = document.getElementById(`layers-cb-${escapedId}`);
    const opacityRow = document.getElementById(`layers-opacity-row-${escapedId}`);
    const item = document.getElementById(`layers-item-${escapedId}`);

    if (cb) {
      cb.checked = state ? state.visible : false;
    }
    if (opacityRow) {
      opacityRow.style.display = (state && state.visible) ? 'flex' : 'none';
    }
    if (item) {
      item.classList.toggle('active', state ? state.visible : false);
    }
  }

  /**
   * Events für das Panel binden.
   */
  function bindPanelEvents() {
    // Panel toggle (ein-/ausklappen)
    const toggleBtn = document.getElementById('layers-panel-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        _panelEl.classList.toggle('collapsed');
        toggleBtn.textContent = _panelEl.classList.contains('collapsed') ? '▸' : '◂';
      });
    }

    // Kategorie ein-/ausklappen
    document.querySelectorAll('.layers-category-header').forEach(header => {
      header.addEventListener('click', () => {
        const catKey = header.dataset.category;
        const content = document.getElementById(`layers-cat-${catKey}`);
        const chevron = header.querySelector('.layers-category-chevron');
        if (content) {
          content.classList.toggle('collapsed');
          if (chevron) {
            chevron.textContent = content.classList.contains('collapsed') ? '▸' : '▾';
          }
        }
      });
    });

    // Layer toggles (Checkboxen)
    document.querySelectorAll('.layers-item-toggle input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        const layerId = cb.dataset.layerId;
        toggleLayerVisibility(layerId, cb.checked);
      });
    });

    // Opacity-Slider pro Layer
    document.querySelectorAll('.layers-slider[data-layer-id]').forEach(slider => {
      const layerId = slider.dataset.layerId;

      // Nicht den globalen Slider (hat keine data-layer-id)
      if (!layerId || slider.id === 'layers-global-opacity') return;

      slider.addEventListener('input', () => {
        setOpacity(layerId, parseInt(slider.value) / 100);
      });
    });

    // Globaler Opacity-Slider
    const globalSlider = document.getElementById('layers-global-opacity');
    if (globalSlider) {
      globalSlider.addEventListener('input', () => {
        setGlobalOpacity(parseInt(globalSlider.value) / 100);
      });
    }

    // Preset-Buttons
    document.querySelectorAll('.layers-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
      });
    });
  }

  // ── Initialisierung ──

  /**
   * Modul initialisieren.
   * @param {maplibregl.Map} mapInstance - Die MapLibre Map-Instanz
   */
  function init(mapInstance) {
    _map = mapInstance || window.map;

    if (!_map) {
      console.error('[LayersModule] Keine Map-Instanz gefunden!');
      return;
    }

    // Warten bis die Karte geladen ist
    const doInit = () => {
      // Erstes Vektor-Layer finden (für korrekte Reihenfolge)
      _firstVectorLayerId = findFirstVectorLayer();

      // CSS laden (falls nicht bereits im HTML eingebunden)
      loadCSS();

      // Panel aufbauen
      buildPanel();

      console.log('[LayersModule] Initialisiert mit', Object.keys(LAYER_CATALOG).length, 'verfügbaren Layern');
    };

    if (_map.isStyleLoaded()) {
      doInit();
    } else {
      _map.on('load', doInit);
    }
  }

  /**
   * CSS-Datei dynamisch laden (Fallback, falls nicht im HTML eingebunden).
   */
  function loadCSS() {
    if (document.getElementById('layers-module-css')) return;
    const link = document.createElement('link');
    link.id = 'layers-module-css';
    link.rel = 'stylesheet';
    link.href = 'modules/layers.css';
    document.head.appendChild(link);
  }

  // ── Public API ──

  window.LayersModule = {
    init,
    addLayer,
    removeLayer,
    setOpacity,
    setGlobalOpacity,
    toggleLayerVisibility,
    applyPreset,
    getActiveLayers,
    /** Zugriff auf den Katalog (read-only) */
    get catalog() { return { ...LAYER_CATALOG }; },
    /** Zugriff auf Presets (read-only) */
    get presets() { return { ...PRESETS }; },
  };

})();
