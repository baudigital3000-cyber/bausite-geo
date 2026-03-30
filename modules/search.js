// ============================================
// BAUSITE Geo — Search & Geocoding Module
// Adresssuche, Parzellen-Info, Reverse Geocoding,
// Koordinaten-Eingabe, Favoriten/Lesezeichen
//
// Nutzt echte swisstopo APIs (gratis):
// - SearchServer (Adresssuche)
// - MapServer/identify (Parzellen)
// - Height API (Höhe ü.M.)
// ============================================

(function () {
  'use strict';

  // ── Konfiguration ──

  const CONFIG = {
    // swisstopo API-Endpunkte
    SEARCH_URL: 'https://api3.geo.admin.ch/rest/services/api/SearchServer',
    IDENTIFY_URL: 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify',
    HEIGHT_URL: 'https://api3.geo.admin.ch/rest/services/profile.json',

    // Debounce-Wartezeit (ms)
    DEBOUNCE_MS: 300,

    // Max angezeigte Vorschläge
    MAX_RESULTS: 8,

    // localStorage-Schlüssel
    STORAGE_KEY: 'bausite_geo_bookmarks',

    // Standard-Favoriten (Grenchen)
    DEFAULT_BOOKMARKS: [
      { name: 'Grenchen Zentrum', center: [7.3950, 47.1935], zoom: 16 },
      { name: 'SWG Grenchen', center: [7.3900, 47.1915], zoom: 17 },
      { name: 'Bahnhof Grenchen Süd', center: [7.3979, 47.1892], zoom: 17 },
    ],
  };

  // ── State ──

  let _map = null;
  let _searchMarker = null;
  let _activeResultIndex = -1;
  let _results = [];
  let _debounceTimer = null;
  let _contextMenuLngLat = null;

  // DOM-Referenzen (nach init() verfügbar)
  let $container, $input, $dropdown, $spinner, $clearBtn;
  let $coordPanel, $coordField, $coordToggle;
  let $contextMenu;

  // ── Hilfsfunktionen ──

  /**
   * Ungefähre Umrechnung WGS84 → CH1903+ (LV95).
   * Basiert auf der offiziellen Näherungsformel von swisstopo.
   */
  function wgs84ToCH1903Plus(lat, lng) {
    // Hilfswerte
    const latAux = (lat * 3600 - 169028.66) / 10000;
    const lngAux = (lng * 3600 - 26782.5) / 10000;

    // E (Ost)
    const E = 2600072.37
      + 211455.93 * lngAux
      - 10938.51 * lngAux * latAux
      - 0.36 * lngAux * latAux * latAux
      - 44.54 * lngAux * lngAux * lngAux;

    // N (Nord)
    const N = 1200147.07
      + 308807.95 * latAux
      + 3745.25 * lngAux * lngAux
      + 76.63 * latAux * latAux
      - 194.56 * lngAux * lngAux * latAux
      + 119.79 * latAux * latAux * latAux;

    return { E: Math.round(E * 100) / 100, N: Math.round(N * 100) / 100 };
  }

  /**
   * Ungefähre Umrechnung CH1903+ (LV95) → WGS84.
   */
  function ch1903PlusToWGS84(E, N) {
    const y = (E - 2600000) / 1000000;
    const x = (N - 1200000) / 1000000;

    const lngAux = 2.6779094
      + 4.728982 * y
      + 0.791484 * y * x
      + 0.1306 * y * x * x
      - 0.0436 * y * y * y;

    const latAux = 16.9023892
      + 3.238272 * x
      - 0.270978 * y * y
      - 0.002528 * x * x
      - 0.0447 * y * y * x
      - 0.0140 * x * x * x;

    return {
      lat: latAux * 100 / 36,
      lng: lngAux * 100 / 36,
    };
  }

  /**
   * Erkennt ob Koordinaten CH1903+ oder WGS84 sind.
   * CH1903+ E: 2'480'000–2'840'000, N: 1'070'000–1'300'000
   * WGS84: Lat 45–48, Lng 5–11 (Schweiz)
   */
  function detectCoordSystem(a, b) {
    // CH1903+ (grosse Zahlen)
    if (a > 2000000 && a < 3000000 && b > 1000000 && b < 1400000) {
      return { system: 'CH1903+', E: a, N: b };
    }
    if (b > 2000000 && b < 3000000 && a > 1000000 && a < 1400000) {
      return { system: 'CH1903+', E: b, N: a };
    }
    // WGS84
    if (a >= 45 && a <= 48 && b >= 5 && b <= 11) {
      return { system: 'WGS84', lat: a, lng: b };
    }
    if (b >= 45 && b <= 48 && a >= 5 && a <= 11) {
      return { system: 'WGS84', lat: b, lng: a };
    }
    return null;
  }

  /**
   * HTML-Tags aus swisstopo-Ergebnis entfernen.
   */
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Typ-Icon und Label für Suchergebnis bestimmen.
   */
  function resultTypeInfo(attrs) {
    const origin = (attrs.origin || '').toLowerCase();
    if (origin === 'address') return { icon: '\u{1F3E0}', label: 'Adresse' };
    if (origin === 'zipcode') return { icon: '\u{1F4CD}', label: 'PLZ' };
    if (origin === 'parcel') return { icon: '\u{1F4D0}', label: 'Parzelle' };
    if (origin === 'sn25') return { icon: '\u{1F4CD}', label: 'Ort' };
    if (origin === 'district') return { icon: '\u{1F4CD}', label: 'Bezirk' };
    if (origin === 'cantone' || origin === 'canton') return { icon: '\u{1F3F3}', label: 'Kanton' };
    return { icon: '\u{1F4CD}', label: 'Ort' };
  }

  /**
   * Einfaches Debounce.
   */
  function debounce(fn, ms) {
    return function (...args) {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ── UI aufbauen ──

  function createSearchUI() {
    // Container
    $container = document.createElement('div');
    $container.className = 'search-container';

    // Suchbox
    const box = document.createElement('div');
    box.className = 'search-box';

    // Lupe
    const icon = document.createElement('span');
    icon.className = 'search-icon';
    icon.textContent = '\u{1F50D}';
    box.appendChild(icon);

    // Input
    $input = document.createElement('input');
    $input.type = 'text';
    $input.className = 'search-input';
    $input.placeholder = 'Adresse, Ort oder Parzelle suchen...';
    $input.autocomplete = 'off';
    box.appendChild($input);

    // Spinner
    $spinner = document.createElement('div');
    $spinner.className = 'search-spinner';
    box.appendChild($spinner);

    // Clear-Button
    $clearBtn = document.createElement('button');
    $clearBtn.className = 'search-clear';
    $clearBtn.textContent = '\u2715';
    $clearBtn.title = 'Suche leeren';
    box.appendChild($clearBtn);

    // Koordinaten-Toggle
    $coordToggle = document.createElement('button');
    $coordToggle.className = 'coord-input-toggle';
    $coordToggle.textContent = '\u{1F4CD}';
    $coordToggle.title = 'Koordinaten eingeben';
    box.appendChild($coordToggle);

    $container.appendChild(box);

    // Dropdown
    $dropdown = document.createElement('div');
    $dropdown.className = 'search-dropdown';
    $container.appendChild($dropdown);

    // Koordinaten-Eingabe-Panel
    $coordPanel = document.createElement('div');
    $coordPanel.className = 'coord-input-panel';
    $coordPanel.innerHTML = `
      <div class="coord-input-label">Koordinaten eingeben</div>
      <div class="coord-input-row">
        <input type="text" class="coord-input-field" id="search-coord-field"
               placeholder="47.193, 7.395 oder 2600000, 1200000">
        <button class="coord-go-btn" id="search-coord-go">Gehe zu</button>
      </div>
      <div class="coord-hint">WGS84 (Lat, Lng) oder CH1903+ (E, N) — wird automatisch erkannt</div>
    `;
    $container.appendChild($coordPanel);

    // Dem Map-Container hinzufügen
    const mapContainer = _map.getContainer();
    mapContainer.appendChild($container);

    // Koordinaten-Feld Referenz
    $coordField = $coordPanel.querySelector('#search-coord-field');

    // Kontextmenü (Rechtsklick)
    $contextMenu = document.createElement('div');
    $contextMenu.className = 'search-context-menu';
    mapContainer.appendChild($contextMenu);
  }

  // ── Favoriten-Panel in der Sidebar ──

  function createBookmarksPanel() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-header" onclick="togglePanel('bookmarks')">
        <span>\u2B50 Favoriten</span>
        <span class="panel-toggle" id="bookmarks-toggle">\u25BE</span>
      </div>
      <div class="panel-content" id="bookmarks-content">
        <div class="bookmarks-list" id="bookmarks-list"></div>
        <div class="bookmark-add-row">
          <input type="text" class="bookmark-add-input" id="bookmark-name-input"
                 placeholder="Name des Favoriten...">
          <button class="bookmark-add-btn" id="bookmark-add-btn">\u002B Speichern</button>
        </div>
      </div>
    `;
    sidebar.appendChild(panel);

    // Event: Favorit speichern
    document.getElementById('bookmark-add-btn').addEventListener('click', () => {
      const nameInput = document.getElementById('bookmark-name-input');
      const name = nameInput.value.trim();
      if (name) {
        addBookmark(name);
        nameInput.value = '';
      }
    });

    document.getElementById('bookmark-name-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('bookmark-add-btn').click();
      }
    });

    renderBookmarks();
  }

  function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;

    const bookmarks = getBookmarks();
    list.innerHTML = '';

    bookmarks.forEach((bm, i) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <span class="bookmark-icon">\u2B50</span>
        <span class="bookmark-name">${bm.name}</span>
        <button class="bookmark-delete" data-index="${i}" title="Entfernen">\u2715</button>
      `;

      // Klick → hinnavigieren
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('bookmark-delete')) return;
        goToCoordinate(bm.center[1], bm.center[0], bm.zoom);
      });

      // Löschen
      item.querySelector('.bookmark-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.dataset.index);
        removeBookmark(idx);
      });

      list.appendChild(item);
    });
  }

  // ── Events binden ──

  function bindEvents() {
    // Suchfeld: Debounced Input
    const debouncedSearch = debounce(async (query) => {
      if (query.length < 2) {
        closeDropdown();
        return;
      }
      await performSearch(query);
    }, CONFIG.DEBOUNCE_MS);

    $input.addEventListener('input', () => {
      const val = $input.value.trim();
      $clearBtn.classList.toggle('visible', val.length > 0);
      debouncedSearch(val);
    });

    // Keyboard-Navigation
    $input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateResults(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateResults(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_activeResultIndex >= 0 && _results[_activeResultIndex]) {
          selectResult(_results[_activeResultIndex]);
        } else if (_results.length > 0) {
          selectResult(_results[0]);
        }
      } else if (e.key === 'Escape') {
        closeDropdown();
        $input.blur();
      }
    });

    // Clear-Button
    $clearBtn.addEventListener('click', () => {
      $input.value = '';
      $clearBtn.classList.remove('visible');
      closeDropdown();
      removeSearchMarker();
    });

    // Klick ausserhalb → Dropdown schliessen
    document.addEventListener('click', (e) => {
      if (!$container.contains(e.target)) {
        closeDropdown();
      }
      if (!$contextMenu.contains(e.target)) {
        closeContextMenu();
      }
    });

    // Koordinaten-Toggle
    $coordToggle.addEventListener('click', () => {
      const isOpen = $coordPanel.classList.toggle('open');
      $coordToggle.classList.toggle('active', isOpen);
      if (isOpen) $coordField.focus();
    });

    // Koordinaten: Gehe zu
    document.getElementById('search-coord-go').addEventListener('click', handleCoordInput);
    $coordField.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleCoordInput();
    });

    // Rechtsklick auf Karte → Kontextmenü
    _map.on('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.point, e.lngLat);
    });

    // Karte bewegen → Kontextmenü schliessen
    _map.on('movestart', closeContextMenu);
  }

  // ── Suche ──

  /**
   * Adresssuche via swisstopo SearchServer API.
   */
  async function performSearch(query) {
    $spinner.classList.add('active');
    _activeResultIndex = -1;

    try {
      const url = `${CONFIG.SEARCH_URL}?searchText=${encodeURIComponent(query)}&type=locations&sr=4326&limit=${CONFIG.MAX_RESULTS}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const data = await resp.json();
      _results = (data.results || []).slice(0, CONFIG.MAX_RESULTS);
      renderResults();
    } catch (err) {
      console.error('[SearchModule] Suchfehler:', err);
      _results = [];
      $dropdown.innerHTML = '<div class="search-result"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Suche fehlgeschlagen</span></div>';
      $dropdown.classList.add('open');
    } finally {
      $spinner.classList.remove('active');
    }
  }

  /**
   * Suchergebnisse im Dropdown darstellen.
   */
  function renderResults() {
    $dropdown.innerHTML = '';

    if (_results.length === 0) {
      $dropdown.innerHTML = '<div class="search-result"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Keine Ergebnisse</span></div>';
      $dropdown.classList.add('open');
      return;
    }

    _results.forEach((result, i) => {
      const attrs = result.attrs || {};
      const typeInfo = resultTypeInfo(attrs);
      const label = stripHtml(attrs.label || '');
      const detail = attrs.detail || '';

      const el = document.createElement('div');
      el.className = 'search-result';
      el.dataset.index = i;

      el.innerHTML = `
        <span class="search-result-icon">${typeInfo.icon}</span>
        <div class="search-result-text">
          <div class="search-result-title">${label}</div>
          ${detail ? `<div class="search-result-subtitle">${stripHtml(detail)}</div>` : ''}
        </div>
        <span class="search-result-type">${typeInfo.label}</span>
      `;

      el.addEventListener('click', () => selectResult(result));
      el.addEventListener('mouseenter', () => {
        _activeResultIndex = i;
        highlightResult(i);
      });

      $dropdown.appendChild(el);
    });

    $dropdown.classList.add('open');
  }

  /**
   * Ein Ergebnis auswählen: Karte dorthin fliegen + Marker setzen.
   */
  function selectResult(result) {
    const attrs = result.attrs || {};
    closeDropdown();

    // Label ins Suchfeld setzen
    const label = stripHtml(attrs.label || '');
    $input.value = label;
    $clearBtn.classList.add('visible');

    // Koordinaten: lon/lat aus attrs oder aus geom_st_box2d parsen
    let lng = attrs.lon;
    let lat = attrs.lat;

    if (lng != null && lat != null) {
      lng = parseFloat(lng);
      lat = parseFloat(lat);
    } else if (attrs.geom_st_box2d) {
      // Fallback: BBox-Mittelpunkt
      const m = attrs.geom_st_box2d.match(/BOX\(([^ ]+) ([^,]+),([^ ]+) ([^)]+)\)/);
      if (m) {
        lng = (parseFloat(m[1]) + parseFloat(m[3])) / 2;
        lat = (parseFloat(m[2]) + parseFloat(m[4])) / 2;
      }
    }

    if (lng == null || lat == null || isNaN(lng) || isNaN(lat)) {
      console.warn('[SearchModule] Keine Koordinaten im Ergebnis:', attrs);
      return;
    }

    // Zoom-Level wählen je nach Typ
    let zoom = 17;
    const origin = (attrs.origin || '').toLowerCase();
    if (origin === 'zipcode' || origin === 'district') zoom = 14;
    if (origin === 'sn25') zoom = 14;
    if (origin === 'cantone' || origin === 'canton') zoom = 11;

    goToCoordinate(lat, lng, zoom);
  }

  /**
   * Keyboard-Navigation durch Ergebnisse.
   */
  function navigateResults(direction) {
    if (_results.length === 0) return;
    _activeResultIndex += direction;
    if (_activeResultIndex < 0) _activeResultIndex = _results.length - 1;
    if (_activeResultIndex >= _results.length) _activeResultIndex = 0;
    highlightResult(_activeResultIndex);
  }

  function highlightResult(index) {
    const items = $dropdown.querySelectorAll('.search-result');
    items.forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
  }

  function closeDropdown() {
    $dropdown.classList.remove('open');
    _activeResultIndex = -1;
  }

  // ── Marker ──

  function setSearchMarker(lng, lat) {
    removeSearchMarker();

    // Marker-Element erstellen
    const el = document.createElement('div');
    el.style.cssText = `
      width: 28px; height: 28px;
      background: #E8833A;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      cursor: pointer;
    `;

    _searchMarker = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(_map);
  }

  function removeSearchMarker() {
    if (_searchMarker) {
      _searchMarker.remove();
      _searchMarker = null;
    }
  }

  // ── Koordinaten-Eingabe ──

  function handleCoordInput() {
    const raw = $coordField.value.trim();
    if (!raw) return;

    // Komma, Semikolon oder Leerzeichen als Trenner
    const parts = raw.split(/[,;\s]+/).map(Number).filter(n => !isNaN(n));
    if (parts.length < 2) {
      alert('Bitte zwei Koordinaten eingeben (z.B. 47.193, 7.395)');
      return;
    }

    const detected = detectCoordSystem(parts[0], parts[1]);
    if (!detected) {
      alert('Koordinaten nicht erkannt. Bitte WGS84 (47.xx, 7.xx) oder CH1903+ (2xxxxxx, 1xxxxxx) eingeben.');
      return;
    }

    let lat, lng;
    if (detected.system === 'WGS84') {
      lat = detected.lat;
      lng = detected.lng;
    } else {
      const wgs = ch1903PlusToWGS84(detected.E, detected.N);
      lat = wgs.lat;
      lng = wgs.lng;
    }

    goToCoordinate(lat, lng, 17);
    $coordPanel.classList.remove('open');
    $coordToggle.classList.remove('active');
  }

  // ── Karte navigieren ──

  /**
   * Fliegt zu einer Koordinate und setzt Marker.
   */
  function goToCoordinate(lat, lng, zoom = 17) {
    _map.flyTo({
      center: [lng, lat],
      zoom: zoom,
      duration: 1500,
      essential: true,
    });
    setSearchMarker(lng, lat);
  }

  // ── Kontextmenü (Rechtsklick) ──

  function showContextMenu(point, lngLat) {
    _contextMenuLngLat = lngLat;
    closeContextMenu();

    const ch = wgs84ToCH1903Plus(lngLat.lat, lngLat.lng);

    $contextMenu.innerHTML = `
      <div class="context-menu-item" data-action="reverse">
        <span class="cm-icon">\u{1F4CD}</span>
        <span>Was ist hier?</span>
      </div>
      <div class="context-menu-item" data-action="parcel">
        <span class="cm-icon">\u{1F4D0}</span>
        <span>Parzelle identifizieren</span>
      </div>
      <div class="context-menu-divider"></div>
      <div class="context-menu-item" data-action="coords">
        <span class="cm-icon">\u{1F4CB}</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;">
          ${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}<br>
          E ${ch.E.toFixed(0)} / N ${ch.N.toFixed(0)}
        </span>
      </div>
    `;

    // Position berechnen
    const mapRect = _map.getContainer().getBoundingClientRect();
    let left = point.x;
    let top = point.y;

    // Nicht über den Rand hinaus
    const menuWidth = 240;
    const menuHeight = 140;
    if (left + menuWidth > mapRect.width) left = mapRect.width - menuWidth - 8;
    if (top + menuHeight > mapRect.height) top = mapRect.height - menuHeight - 8;

    $contextMenu.style.left = left + 'px';
    $contextMenu.style.top = top + 'px';
    $contextMenu.classList.add('open');

    // Events
    $contextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        closeContextMenu();
        if (action === 'reverse') reverseGeocode(lngLat);
        if (action === 'parcel') identifyParcel(lngLat);
        if (action === 'coords') copyToClipboard(`${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`);
      });
    });
  }

  function closeContextMenu() {
    $contextMenu.classList.remove('open');
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('[SearchModule] Kopiert:', text);
    }).catch(() => {
      // Fallback
      prompt('Koordinaten kopieren:', text);
    });
  }

  // ── Reverse Geocoding ──

  /**
   * Reverse Geocoding: Adresse + Höhe für einen Punkt abfragen.
   */
  async function reverseGeocode(lngLat) {
    setSearchMarker(lngLat.lng, lngLat.lat);

    const ch = wgs84ToCH1903Plus(lngLat.lat, lngLat.lng);

    // Parallele API-Aufrufe: nächste Adresse + Höhe
    const [addressResult, heightResult] = await Promise.allSettled([
      fetchNearestAddress(lngLat),
      fetchHeight(lngLat),
    ]);

    const address = addressResult.status === 'fulfilled' ? addressResult.value : null;
    const height = heightResult.status === 'fulfilled' ? heightResult.value : null;

    // Popup zusammenbauen
    let html = '<div class="search-info-popup">';
    html += `<h4>${address ? stripHtml(address.label) : 'Unbekannter Ort'}</h4>`;

    html += '<div class="info-section">';
    html += '<div class="info-section-title">Koordinaten</div>';
    html += `<div class="info-row">
      <span class="info-label">WGS84</span>
      <span class="info-value">${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}</span>
    </div>`;
    html += `<div class="info-row">
      <span class="info-label">CH1903+</span>
      <span class="info-value">E ${ch.E.toFixed(0)} / N ${ch.N.toFixed(0)}</span>
    </div>`;
    if (height != null) {
      html += `<div class="info-row">
        <span class="info-label">Höhe</span>
        <span class="info-value">${height.toFixed(1)} m ü.M.</span>
      </div>`;
    }
    html += '</div>';

    if (address && address.detail) {
      html += '<div class="info-section">';
      html += '<div class="info-section-title">Details</div>';
      html += `<div class="info-row">
        <span class="info-label">Gemeinde</span>
        <span class="info-value">${stripHtml(address.detail)}</span>
      </div>`;
      html += '</div>';
    }

    html += '</div>';

    // Popup auf Karte anzeigen
    new maplibregl.Popup({ maxWidth: '320px', closeButton: true })
      .setLngLat([lngLat.lng, lngLat.lat])
      .setHTML(html)
      .addTo(_map);

    return { address, height, wgs84: lngLat, ch1903: ch };
  }

  /**
   * Nächste Adresse via SearchServer suchen.
   */
  async function fetchNearestAddress(lngLat) {
    const url = `${CONFIG.SEARCH_URL}?searchText=${lngLat.lat.toFixed(5)}+${lngLat.lng.toFixed(5)}&type=locations&sr=4326&limit=1`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].attrs;
    }
    return null;
  }

  /**
   * Höhe via swisstopo Profile API abfragen.
   */
  async function fetchHeight(lngLat) {
    // Die Height API braucht ein Liniensegment, wir nehmen einen kurzen Punkt-Pfad
    const url = `https://api3.geo.admin.ch/rest/services/height?easting=${lngLat.lng}&northing=${lngLat.lat}&sr=4326`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.height != null ? parseFloat(data.height) : null;
  }

  // ── Parzellen-Identifikation ──

  /**
   * Parzelle an einem Punkt identifizieren (swisstopo MapServer/identify).
   */
  async function identifyParcel(lngLat) {
    setSearchMarker(lngLat.lng, lngLat.lat);

    try {
      // Amtliche Vermessung: Liegenschaften
      const url = `${CONFIG.IDENTIFY_URL}`
        + `?geometryType=esriGeometryPoint`
        + `&geometry=${lngLat.lng},${lngLat.lat}`
        + `&sr=4326`
        + `&layers=all:ch.kantone.cadastralwebmap-farbe`
        + `&mapExtent=${lngLat.lng - 0.01},${lngLat.lat - 0.01},${lngLat.lng + 0.01},${lngLat.lat + 0.01}`
        + `&imageDisplay=600,400,96`
        + `&tolerance=10`
        + `&returnGeometry=false`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const ch = wgs84ToCH1903Plus(lngLat.lat, lngLat.lng);

      let html = '<div class="search-info-popup">';
      html += '<h4>Parzellen-Information</h4>';

      if (data.results && data.results.length > 0) {
        data.results.forEach(r => {
          const attrs = r.attributes || r.properties || {};
          html += '<div class="info-section">';

          // Alle verfügbaren Attribute anzeigen
          Object.entries(attrs).forEach(([key, val]) => {
            if (val != null && val !== '') {
              html += `<div class="info-row">
                <span class="info-label">${key}</span>
                <span class="info-value">${val}</span>
              </div>`;
            }
          });

          html += '</div>';
        });
      } else {
        html += '<div class="info-section">';
        html += '<div style="color:#888;font-size:12px;">Keine Parzellendaten an diesem Punkt gefunden.</div>';
        html += '</div>';
      }

      // Koordinaten anfügen
      html += '<div class="info-section">';
      html += '<div class="info-section-title">Standort</div>';
      html += `<div class="info-row">
        <span class="info-label">WGS84</span>
        <span class="info-value">${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}</span>
      </div>`;
      html += `<div class="info-row">
        <span class="info-label">CH1903+</span>
        <span class="info-value">E ${ch.E.toFixed(0)} / N ${ch.N.toFixed(0)}</span>
      </div>`;
      html += '</div></div>';

      new maplibregl.Popup({ maxWidth: '340px', closeButton: true })
        .setLngLat([lngLat.lng, lngLat.lat])
        .setHTML(html)
        .addTo(_map);

      return data.results || [];
    } catch (err) {
      console.error('[SearchModule] Parzellen-Identifikation fehlgeschlagen:', err);

      new maplibregl.Popup({ maxWidth: '300px', closeButton: true })
        .setLngLat([lngLat.lng, lngLat.lat])
        .setHTML('<div class="search-info-popup"><h4>Fehler</h4><p style="font-size:12px;color:#888;">Parzellendaten konnten nicht geladen werden.</p></div>')
        .addTo(_map);

      return [];
    }
  }

  // ── Favoriten / Lesezeichen ──

  function getBookmarks() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('[SearchModule] Bookmarks-Lesefehler:', e);
    }
    // Keine gespeicherten → Standard-Favoriten initialisieren
    saveBookmarks(CONFIG.DEFAULT_BOOKMARKS);
    return [...CONFIG.DEFAULT_BOOKMARKS];
  }

  function saveBookmarks(bookmarks) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('[SearchModule] Bookmarks-Speicherfehler:', e);
    }
  }

  /**
   * Aktuelle Kartenansicht als Favorit speichern.
   */
  function addBookmark(name) {
    const center = _map.getCenter();
    const zoom = Math.round(_map.getZoom() * 10) / 10;

    const bookmarks = getBookmarks();
    bookmarks.push({
      name: name,
      center: [center.lng, center.lat],
      zoom: zoom,
    });

    saveBookmarks(bookmarks);
    renderBookmarks();
    return bookmarks;
  }

  function removeBookmark(index) {
    const bookmarks = getBookmarks();
    bookmarks.splice(index, 1);
    saveBookmarks(bookmarks);
    renderBookmarks();
  }

  // ── Programmatische Suche ──

  /**
   * Programmatische Suche — gibt Promise mit Ergebnissen zurück.
   */
  async function search(query) {
    const url = `${CONFIG.SEARCH_URL}?searchText=${encodeURIComponent(query)}&type=locations&sr=4326&limit=${CONFIG.MAX_RESULTS}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.results || [];
  }

  // ── Öffentliche API ──

  function init(mapInstance) {
    _map = mapInstance || window.map;

    if (!_map) {
      console.error('[SearchModule] Keine Map-Instanz gefunden!');
      return;
    }

    createSearchUI();
    bindEvents();

    // Favoriten erst erstellen wenn Map geladen ist
    if (_map.loaded()) {
      createBookmarksPanel();
    } else {
      _map.on('load', createBookmarksPanel);
    }

    console.log('[SearchModule] Initialisiert.');
  }

  // ── Modul exportieren ──

  window.SearchModule = {
    init,
    search,
    goToCoordinate,
    identifyParcel,
    reverseGeocode,
    addBookmark,
    getBookmarks,
  };

})();
