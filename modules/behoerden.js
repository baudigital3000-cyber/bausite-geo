// ============================================
// BAUSITE Geo — Behörden / Blaulicht Portal
// Dashboard, Bewilligungen, Erreichbarkeit,
// Kritische Infrastruktur, Kalender, Übersicht
// Vanilla JS — MapLibre GL JS
// ============================================

const BehoerdenModule = (function () {
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

  const STATUS_STYLES = {
    eingereicht: { bg: COLORS.blue,    label: 'Eingereicht' },
    in_pruefung: { bg: COLORS.warning, label: 'In Prüfung' },
    bewilligt:   { bg: COLORS.success, label: 'Bewilligt' },
    abgelehnt:   { bg: COLORS.danger,  label: 'Abgelehnt' },
  };

  const INFRA_ICONS = {
    spital:     { symbol: '✚', color: COLORS.danger,  label: 'Spital' },
    feuerwehr:  { symbol: '🔥', color: COLORS.orange, label: 'Feuerwehr' },
    schule:     { symbol: '📖', color: COLORS.blue,   label: 'Schule' },
    polizei:    { symbol: '🛡', color: COLORS.navy,   label: 'Polizei' },
    altersheim: { symbol: '🏠', color: COLORS.violet, label: 'Altersheim' },
  };

  const LAYER_IDS = [
    'behoerden-baustellen-fill', 'behoerden-baustellen-outline',
    'behoerden-sperrungen', 'kritische-infra',
    'erreichbarkeit-route', 'erreichbarkeit-block',
  ];

  const SOURCE_IDS = [
    'behoerden-baustellen-src', 'behoerden-sperrungen-src',
    'kritische-infra-src', 'erreichbarkeit-route-src',
    'erreichbarkeit-block-src',
  ];

  // ── State ──

  let dashboardEl = null;
  let bewilligungsEl = null;
  let kalenderEl = null;
  let erreichbarkeitEl = null;
  let legendeEl = null;
  let infraMarkers = [];
  let erreichbarkeitMarker = null;
  let mapClickHandler = null;
  let activePopups = [];

  // ── Hilfsfunktionen ──

  function _apiBase() {
    return (typeof API_BASE !== 'undefined' && API_BASE !== null) ? API_BASE : window.location.origin + '/api';
  }

  function _isStatic() {
    return typeof STATIC_MODE !== 'undefined' && STATIC_MODE;
  }

  function _formatNumber(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  function _formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function _emptyGeoJSON() {
    return { type: 'FeatureCollection', features: [] };
  }

  function _removeElement(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function _removeLayer(id) {
    if (map.getLayer(id)) map.removeLayer(id);
  }

  function _removeSource(id) {
    if (map.getSource(id)) map.removeSource(id);
  }

  function _clearPopups() {
    activePopups.forEach(p => p.remove());
    activePopups = [];
  }

  function _clearInfraMarkers() {
    infraMarkers.forEach(m => m.remove());
    infraMarkers = [];
  }

  async function _fetchJSON(url, options) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[BehoerdenModule] Fetch-Fehler:', url, err);
      return null;
    }
  }

  function _showToast(message, type) {
    const existing = document.getElementById('behoerden-toast');
    if (existing) existing.remove();

    const bg = type === 'error' ? COLORS.danger
      : type === 'success' ? COLORS.success
      : type === 'warning' ? COLORS.warning
      : COLORS.blue;

    const toast = document.createElement('div');
    toast.id = 'behoerden-toast';
    toast.style.cssText = `
      position: fixed; top: 80px; right: 20px; z-index: 9999;
      background: ${bg}; color: #fff; padding: 12px 20px;
      border-radius: 8px; font-size: 13px; font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px;
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
  }

  // ============================================================
  // 1. DASHBOARD
  // ============================================================

  async function showDashboard() {
    if (_isStatic()) { showComingSoon('Behörden-Dashboard'); return; }
    cleanup();

    const data = await _fetchJSON(_apiBase() + '/behoerden/dashboard');
    if (!data) {
      _showToast('Dashboard-Daten konnten nicht geladen werden.', 'error');
      return;
    }

    dashboardEl = document.createElement('div');
    dashboardEl.id = 'behoerden-dashboard';
    dashboardEl.style.cssText = `
      position: absolute; top: 70px; right: 15px; z-index: 800;
      background: rgba(27, 42, 74, 0.93); color: #fff;
      border-radius: 12px; padding: 20px; width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
    `;

    const kpis = [
      { label: 'Aktive Baustellen', value: data.aktive_baustellen || 0, trend: data.trend_baustellen || null, icon: '🏗' },
      { label: 'Offene Bewilligungen', value: data.offene_bewilligungen || 0, trend: null, icon: '📋' },
      { label: 'Aktive Sperrungen', value: data.aktive_sperrungen || 0, trend: null, icon: '🚧' },
      { label: 'Nächste Konflikte', value: data.naechste_konflikte || 0, trend: null, icon: '⚠' },
    ];

    dashboardEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;font-weight:700;">Behörden-Dashboard</h3>
        <button onclick="BehoerdenModule.cleanup()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:2px 6px;">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${kpis.map(k => `
          <div style="background:rgba(255,255,255,0.08);border-radius:8px;padding:12px;text-align:center;">
            <div style="font-size:22px;margin-bottom:4px;">${k.icon}</div>
            <div style="font-size:24px;font-weight:700;color:${COLORS.orange};">${k.value}</div>
            <div style="font-size:11px;opacity:0.7;margin-top:2px;">${k.label}</div>
            ${k.trend !== null ? `<div style="font-size:10px;color:${k.trend > 0 ? COLORS.warning : COLORS.success};margin-top:2px;">${k.trend > 0 ? '▲' : '▼'} ${Math.abs(k.trend)}</div>` : ''}
          </div>
        `).join('')}
      </div>
      <div style="margin-top:14px;display:flex;gap:6px;flex-wrap:wrap;">
        <button onclick="BehoerdenModule.showBewilligungen()" style="${_btnStyle(COLORS.blue)}">Bewilligungen</button>
        <button onclick="BehoerdenModule.checkErreichbarkeit()" style="${_btnStyle(COLORS.danger)}">Erreichbarkeit</button>
        <button onclick="BehoerdenModule.showKalender()" style="${_btnStyle(COLORS.violet)}">Kalender</button>
        <button onclick="BehoerdenModule.showUebersicht()" style="${_btnStyle(COLORS.orange)}">Übersicht</button>
      </div>
    `;

    document.body.appendChild(dashboardEl);
  }

  function _btnStyle(bg) {
    return `background:${bg};color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:11px;font-weight:600;cursor:pointer;`;
  }

  // ============================================================
  // 2. BEWILLIGUNGS-WORKFLOW
  // ============================================================

  async function showBewilligungen() {
    if (_isStatic()) { showComingSoon('Bewilligungen verwalten'); return; }
    _removePanels();

    const data = await _fetchJSON(_apiBase() + '/behoerden/bewilligungen');
    if (!data) {
      _showToast('Bewilligungen konnten nicht geladen werden.', 'error');
      return;
    }

    const gesuche = data.gesuche || data || [];

    bewilligungsEl = document.createElement('div');
    bewilligungsEl.id = 'behoerden-bewilligungen';
    bewilligungsEl.style.cssText = `
      position: absolute; top: 70px; left: 15px; z-index: 800;
      background: rgba(27, 42, 74, 0.95); color: #fff;
      border-radius: 12px; padding: 16px; width: 360px;
      max-height: calc(100vh - 120px); overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
    `;

    bewilligungsEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;">Bewilligungen</h3>
        <button onclick="BehoerdenModule.cleanup()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div id="bewilligungen-liste">
        ${gesuche.length === 0 ? '<p style="opacity:0.6;font-size:12px;">Keine Gesuche vorhanden.</p>' : ''}
        ${gesuche.map(g => _renderGesuch(g)).join('')}
      </div>
    `;

    document.body.appendChild(bewilligungsEl);
  }

  function _renderGesuch(g) {
    const st = STATUS_STYLES[g.status] || STATUS_STYLES.eingereicht;
    return `
      <div class="bewilligung-item" data-id="${g.id}" style="
        background:rgba(255,255,255,0.06); border-radius:8px; padding:12px;
        margin-bottom:8px; cursor:pointer; border-left:3px solid ${st.bg};
      " onclick="BehoerdenModule._onGesuchClick(${g.id})">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:13px;font-weight:600;">${g.projekt || g.name || 'Gesuch #' + g.id}</span>
          <span style="
            background:${st.bg}; color:#fff; font-size:10px; font-weight:600;
            padding:2px 8px; border-radius:10px;
          ">${st.label}</span>
        </div>
        <div style="font-size:11px;opacity:0.6;margin-top:4px;">
          ${g.gesuchsteller || ''} — ${_formatDate(g.eingereicht_am)}
        </div>
        <div style="font-size:11px;opacity:0.5;margin-top:2px;">
          ${g.strasse || ''} ${g.ort || ''}
        </div>
        ${g.status === 'eingereicht' || g.status === 'in_pruefung' ? `
          <div style="margin-top:8px;display:flex;gap:4px;">
            <button onclick="event.stopPropagation(); BehoerdenModule._updateBewilligung(${g.id}, 'bewilligt')" style="${_btnStyle(COLORS.success)}font-size:10px;">Bewilligen</button>
            <button onclick="event.stopPropagation(); BehoerdenModule._updateBewilligung(${g.id}, 'abgelehnt')" style="${_btnStyle(COLORS.danger)}font-size:10px;">Ablehnen</button>
            <button onclick="event.stopPropagation(); BehoerdenModule._showAuflagen(${g.id})" style="${_btnStyle(COLORS.warning)}font-size:10px;">Auflagen</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  async function _onGesuchClick(id) {
    const data = await _fetchJSON(_apiBase() + '/behoerden/bewilligungen/' + id);
    if (!data) return;

    _clearPopups();

    if (data.lng && data.lat) {
      map.flyTo({ center: [data.lng, data.lat], zoom: 16, duration: 1200 });

      const popup = new maplibregl.Popup({ offset: 12, maxWidth: '280px' })
        .setLngLat([data.lng, data.lat])
        .setHTML(`
          <div style="font-family:'Inter',sans-serif;">
            <strong>${data.projekt || 'Gesuch #' + id}</strong><br>
            <span style="font-size:12px;color:#666;">${data.gesuchsteller || ''}</span><br>
            <span style="font-size:11px;">${_formatDate(data.von)} — ${_formatDate(data.bis)}</span>
          </div>
        `)
        .addTo(map);
      activePopups.push(popup);
    }
  }

  async function _updateBewilligung(id, status) {
    const result = await _fetchJSON(_apiBase() + '/behoerden/bewilligungen/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: status }),
    });

    if (result) {
      const st = STATUS_STYLES[status] || {};
      _showToast(`Bewilligung #${id} → ${st.label || status}`, 'success');
      showBewilligungen(); // Liste neu laden
    } else {
      _showToast('Status-Update fehlgeschlagen.', 'error');
    }
  }

  function _showAuflagen(id) {
    const auflagen = prompt('Auflagen eingeben (Text):');
    if (!auflagen) return;

    _fetchJSON(_apiBase() + '/behoerden/bewilligungen/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_pruefung', auflagen: auflagen }),
    }).then(result => {
      if (result) {
        _showToast(`Auflagen für #${id} gespeichert.`, 'success');
        showBewilligungen();
      }
    });
  }

  // ============================================================
  // 3. ERREICHBARKEITS-CHECK
  // ============================================================

  function checkErreichbarkeit() {
    if (_isStatic()) { showComingSoon('Erreichbarkeits-Check'); return; }
    _removePanels();

    erreichbarkeitEl = document.createElement('div');
    erreichbarkeitEl.id = 'behoerden-erreichbarkeit';
    erreichbarkeitEl.style.cssText = `
      position: absolute; top: 70px; right: 15px; z-index: 800;
      background: rgba(27, 42, 74, 0.93); color: #fff;
      border-radius: 12px; padding: 16px; width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
    `;

    erreichbarkeitEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;">Erreichbarkeits-Check</h3>
        <button onclick="BehoerdenModule.cleanup()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <p style="font-size:12px;opacity:0.7;margin:0 0 10px;">
        Klicken Sie auf die Karte oder wählen Sie einen kritischen Standort:
      </p>
      <div id="erreichbarkeit-standorte" style="margin-bottom:10px;"></div>
      <div id="erreichbarkeit-result" style="display:none;"></div>
    `;

    document.body.appendChild(erreichbarkeitEl);

    // Kritische Standorte als Schnellauswahl laden
    _loadKritischeStandorte();

    // Karten-Klick aktivieren
    map.getCanvas().style.cursor = 'crosshair';
    mapClickHandler = function (e) {
      _runErreichbarkeitCheck(e.lngLat.lng, e.lngLat.lat);
    };
    map.on('click', mapClickHandler);
  }

  async function _loadKritischeStandorte() {
    const container = document.getElementById('erreichbarkeit-standorte');
    if (!container) return;

    const data = await _fetchJSON(_apiBase() + '/behoerden/kritische-infrastruktur');
    if (!data) return;

    const standorte = data.features || data || [];
    if (standorte.length === 0) {
      container.innerHTML = '<span style="font-size:11px;opacity:0.5;">Keine Standorte geladen.</span>';
      return;
    }

    container.innerHTML = standorte.slice(0, 6).map(s => {
      const props = s.properties || s;
      const coords = s.geometry ? s.geometry.coordinates : [s.lng, s.lat];
      const icon = INFRA_ICONS[props.typ] || INFRA_ICONS.spital;
      return `
        <button onclick="BehoerdenModule._runErreichbarkeitCheck(${coords[0]}, ${coords[1]})"
          style="${_btnStyle('rgba(255,255,255,0.1)')}font-size:11px;margin:2px;">
          ${icon.symbol} ${props.name || props.typ}
        </button>
      `;
    }).join('');
  }

  async function _runErreichbarkeitCheck(lng, lat) {
    const resultDiv = document.getElementById('erreichbarkeit-result');
    if (resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = '<div style="text-align:center;padding:10px;"><span style="font-size:12px;opacity:0.7;">Prüfe Erreichbarkeit...</span></div>';
    }

    // Marker setzen
    if (erreichbarkeitMarker) erreichbarkeitMarker.remove();
    const markerEl = document.createElement('div');
    markerEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);';
    erreichbarkeitMarker = new maplibregl.Marker({ element: markerEl })
      .setLngLat([lng, lat])
      .addTo(map);

    const data = await _fetchJSON(_apiBase() + '/behoerden/erreichbarkeit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lng, lat }),
    });

    if (!data) {
      if (resultDiv) resultDiv.innerHTML = '<div style="color:#EF4444;font-size:12px;padding:8px;">Fehler bei der Prüfung.</div>';
      return;
    }

    // Route auf Karte zeichnen
    _removeLayer('erreichbarkeit-route');
    _removeLayer('erreichbarkeit-block');
    _removeSource('erreichbarkeit-route-src');
    _removeSource('erreichbarkeit-block-src');

    if (data.route && data.route.coordinates) {
      map.addSource('erreichbarkeit-route-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: data.route.coordinates },
        },
      });
      map.addLayer({
        id: 'erreichbarkeit-route',
        type: 'line',
        source: 'erreichbarkeit-route-src',
        paint: {
          'line-color': data.erreichbar ? COLORS.success : COLORS.danger,
          'line-width': 4,
          'line-dasharray': data.erreichbar ? [1] : [4, 3],
        },
      });
    }

    // Blockierung anzeigen falls vorhanden
    if (data.blockiert_durch && data.blockiert_durch.geometry) {
      map.addSource('erreichbarkeit-block-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: data.blockiert_durch.geometry,
        },
      });
      map.addLayer({
        id: 'erreichbarkeit-block',
        type: 'line',
        source: 'erreichbarkeit-block-src',
        paint: { 'line-color': COLORS.danger, 'line-width': 6, 'line-opacity': 0.7 },
      });
    }

    // Ergebnis anzeigen
    if (resultDiv) {
      if (data.erreichbar) {
        resultDiv.innerHTML = `
          <div style="background:rgba(34,197,94,0.15);border:1px solid ${COLORS.success};border-radius:8px;padding:12px;">
            <div style="font-size:14px;font-weight:700;color:${COLORS.success};">ERREICHBAR</div>
            <div style="font-size:12px;margin-top:4px;">
              Distanz: <strong>${_formatNumber(data.distanz_m || 0)} m</strong><br>
              Fahrzeit: <strong>${data.fahrzeit || '—'}</strong>
            </div>
          </div>
        `;
      } else {
        resultDiv.innerHTML = `
          <div style="background:rgba(239,68,68,0.15);border:1px solid ${COLORS.danger};border-radius:8px;padding:12px;">
            <div style="font-size:14px;font-weight:700;color:${COLORS.danger};">NICHT ERREICHBAR</div>
            <div style="font-size:12px;margin-top:4px;">
              ${data.blockiert_durch ? `Sperrung: <strong>${data.blockiert_durch.name || 'unbekannt'}</strong>` : 'Keine Route gefunden.'}
            </div>
            ${data.alternativ_distanz_m ? `
              <div style="font-size:11px;margin-top:6px;opacity:0.7;">
                Alternativroute: ${_formatNumber(data.alternativ_distanz_m)} m (+${_formatNumber((data.alternativ_distanz_m || 0) - (data.distanz_m || 0))} m)
              </div>
            ` : ''}
          </div>
        `;
      }
    }
  }

  // ============================================================
  // 4. KRITISCHE INFRASTRUKTUR
  // ============================================================

  async function showKritischeInfrastruktur() {
    if (_isStatic()) { showComingSoon('Kritische Infrastruktur'); return; }
    _clearInfraMarkers();

    const data = await _fetchJSON(_apiBase() + '/behoerden/kritische-infrastruktur');
    if (!data) {
      _showToast('Kritische Infrastruktur konnte nicht geladen werden.', 'error');
      return;
    }

    const features = data.features || data || [];

    features.forEach(f => {
      const props = f.properties || f;
      const coords = f.geometry ? f.geometry.coordinates : [f.lng, f.lat];
      const icon = INFRA_ICONS[props.typ] || { symbol: '●', color: COLORS.danger, label: props.typ || 'Unbekannt' };

      const el = document.createElement('div');
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%;
        background: ${icon.color}; color: #fff; font-size: 16px;
        display: flex; align-items: center; justify-content: center;
        border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      el.textContent = icon.symbol;
      el.title = `${icon.label}: ${props.name || ''}`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML(`
          <div style="font-family:'Inter',sans-serif;padding:4px;">
            <strong>${icon.symbol} ${props.name || icon.label}</strong><br>
            <span style="font-size:12px;color:#666;">${props.adresse || ''}</span><br>
            <span style="font-size:11px;color:#999;">${icon.label}</span>
          </div>
        `))
        .addTo(map);

      infraMarkers.push(marker);
    });

    // Auch als GeoJSON-Layer hinzufügen für Übersicht
    _removeLayer('kritische-infra');
    _removeSource('kritische-infra-src');

    if (features.length > 0 && features[0].geometry) {
      map.addSource('kritische-infra-src', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: features },
      });
      map.addLayer({
        id: 'kritische-infra',
        type: 'circle',
        source: 'kritische-infra-src',
        paint: {
          'circle-radius': 8,
          'circle-color': COLORS.danger,
          'circle-opacity': 0.3,
          'circle-stroke-width': 2,
          'circle-stroke-color': COLORS.danger,
        },
      });
    }

    _showToast(`${features.length} kritische Standorte geladen.`, 'success');
  }

  // ============================================================
  // 5. KALENDER / KONFLIKTE
  // ============================================================

  async function showKalender() {
    if (_isStatic()) { showComingSoon('Baustellen-Kalender'); return; }
    _removePanels();

    const [kalenderData, konflikteData] = await Promise.all([
      _fetchJSON(_apiBase() + '/behoerden/kalender'),
      _fetchJSON(_apiBase() + '/behoerden/kalender/konflikte'),
    ]);

    if (!kalenderData) {
      _showToast('Kalender konnte nicht geladen werden.', 'error');
      return;
    }

    const eintraege = kalenderData.eintraege || kalenderData || [];
    const konflikte = konflikteData ? (konflikteData.konflikte || konflikteData || []) : [];

    kalenderEl = document.createElement('div');
    kalenderEl.id = 'behoerden-kalender';
    kalenderEl.style.cssText = `
      position: absolute; bottom: 10px; left: 10px; right: 10px; z-index: 800;
      background: rgba(27, 42, 74, 0.95); color: #fff;
      border-radius: 12px; padding: 16px;
      max-height: 280px; overflow-y: auto;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.35);
      font-family: 'Inter', sans-serif; backdrop-filter: blur(8px);
    `;

    // Zeitrahmen berechnen
    const allDates = eintraege.flatMap(e => [new Date(e.von), new Date(e.bis)]).filter(d => !isNaN(d));
    const minDate = allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date();
    const maxDate = allDates.length > 0 ? new Date(Math.max(...allDates)) : new Date();
    const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)));

    // Konflikt-IDs sammeln
    const konfliktIds = new Set();
    konflikte.forEach(k => {
      (k.betroffene_ids || []).forEach(id => konfliktIds.add(id));
    });

    kalenderEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="margin:0;font-size:15px;font-weight:700;">Kalender — Baustellen & Sperrungen</h3>
        <div>
          <span style="font-size:11px;opacity:0.5;margin-right:12px;">${_formatDate(minDate)} — ${_formatDate(maxDate)}</span>
          <button onclick="BehoerdenModule.cleanup()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;">✕</button>
        </div>
      </div>
      ${konflikte.length > 0 ? `
        <div style="background:rgba(239,68,68,0.15);border:1px solid ${COLORS.danger};border-radius:6px;padding:8px;margin-bottom:10px;font-size:11px;">
          ⚠ <strong>${konflikte.length} Konflikte</strong> erkannt (zeitliche Überlappungen)
        </div>
      ` : ''}
      <div style="position:relative;">
        ${eintraege.map(e => {
          const start = new Date(e.von);
          const end = new Date(e.bis);
          const leftPct = Math.max(0, ((start - minDate) / (1000 * 60 * 60 * 24)) / totalDays * 100);
          const widthPct = Math.max(2, ((end - start) / (1000 * 60 * 60 * 24)) / totalDays * 100);
          const isKonflikt = konfliktIds.has(e.id);
          const barColor = isKonflikt ? COLORS.danger
            : e.typ === 'sperrung' ? COLORS.warning
            : COLORS.blue;

          return `
            <div style="display:flex;align-items:center;margin-bottom:4px;height:26px;">
              <div style="width:140px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0;" title="${e.name || ''}">
                ${e.name || 'Eintrag #' + e.id}
              </div>
              <div style="flex:1;position:relative;height:20px;background:rgba(255,255,255,0.05);border-radius:4px;">
                <div
                  onclick="BehoerdenModule._onKalenderClick(${e.lng || 0}, ${e.lat || 0})"
                  style="
                    position:absolute; left:${leftPct}%; width:${widthPct}%;
                    height:100%; background:${barColor}; border-radius:4px;
                    cursor:pointer; opacity:0.85; min-width:4px;
                    ${isKonflikt ? 'border:2px solid #fff;animation:pulse 1.5s infinite;' : ''}
                  " title="${e.name}: ${_formatDate(e.von)} — ${_formatDate(e.bis)}${isKonflikt ? ' (KONFLIKT)' : ''}">
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div style="display:flex;gap:12px;margin-top:10px;font-size:10px;opacity:0.6;">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.blue};vertical-align:middle;"></span> Baustelle</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.warning};vertical-align:middle;"></span> Sperrung</span>
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${COLORS.danger};vertical-align:middle;"></span> Konflikt</span>
      </div>
    `;

    document.body.appendChild(kalenderEl);
  }

  function _onKalenderClick(lng, lat) {
    if (lng && lat) {
      map.flyTo({ center: [lng, lat], zoom: 16, duration: 1000 });
    }
  }

  // ============================================================
  // 6. ÜBERSICHTSKARTE
  // ============================================================

  async function showUebersicht() {
    if (_isStatic()) { showComingSoon('Behörden-Übersichtskarte'); return; }
    _removePanels();
    _clearInfraMarkers();

    const data = await _fetchJSON(_apiBase() + '/behoerden/uebersicht-karte');
    if (!data) {
      _showToast('Übersichtskarte konnte nicht geladen werden.', 'error');
      return;
    }

    // Baustellen-Layer
    _removeLayer('behoerden-baustellen-fill');
    _removeLayer('behoerden-baustellen-outline');
    _removeSource('behoerden-baustellen-src');

    const baustellen = data.baustellen || { type: 'FeatureCollection', features: [] };
    map.addSource('behoerden-baustellen-src', { type: 'geojson', data: baustellen });
    map.addLayer({
      id: 'behoerden-baustellen-fill',
      type: 'fill',
      source: 'behoerden-baustellen-src',
      paint: { 'fill-color': COLORS.orange, 'fill-opacity': 0.25 },
    });
    map.addLayer({
      id: 'behoerden-baustellen-outline',
      type: 'line',
      source: 'behoerden-baustellen-src',
      paint: { 'line-color': COLORS.orange, 'line-width': 2 },
    });

    // Sperrungen-Layer
    _removeLayer('behoerden-sperrungen');
    _removeSource('behoerden-sperrungen-src');

    const sperrungen = data.sperrungen || { type: 'FeatureCollection', features: [] };
    map.addSource('behoerden-sperrungen-src', { type: 'geojson', data: sperrungen });
    map.addLayer({
      id: 'behoerden-sperrungen',
      type: 'line',
      source: 'behoerden-sperrungen-src',
      paint: {
        'line-color': COLORS.danger,
        'line-width': 4,
        'line-dasharray': [6, 3],
      },
    });

    // Kritische Infrastruktur laden
    showKritischeInfrastruktur();

    // Legende anzeigen
    _showLegende();

    // Auf Extent zoomen wenn BBox vorhanden
    if (data.bbox) {
      map.fitBounds(data.bbox, { padding: 60, duration: 1200 });
    }

    // Klick-Handler fuer Baustellen-Info
    map.on('click', 'behoerden-baustellen-fill', function (e) {
      if (!e.features || e.features.length === 0) return;
      const props = e.features[0].properties;
      new maplibregl.Popup({ offset: 10 })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="font-family:'Inter',sans-serif;">
            <strong>${props.name || 'Baustelle'}</strong><br>
            <span style="font-size:12px;">${_formatDate(props.von)} — ${_formatDate(props.bis)}</span><br>
            <span style="font-size:11px;color:#666;">${props.unternehmer || ''}</span>
          </div>
        `)
        .addTo(map);
    });

    map.on('mouseenter', 'behoerden-baustellen-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'behoerden-baustellen-fill', () => { map.getCanvas().style.cursor = ''; });
  }

  function _showLegende() {
    _removeElement(legendeEl);

    legendeEl = document.createElement('div');
    legendeEl.id = 'behoerden-legende';
    legendeEl.style.cssText = `
      position: absolute; bottom: 30px; right: 15px; z-index: 800;
      background: rgba(27, 42, 74, 0.9); color: #fff;
      border-radius: 8px; padding: 12px 16px;
      font-family: 'Inter', sans-serif; font-size: 11px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3); backdrop-filter: blur(6px);
    `;

    legendeEl.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;font-size:12px;">Legende</div>
      <div style="margin-bottom:4px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${COLORS.orange};opacity:0.6;vertical-align:middle;margin-right:6px;"></span>
        Baustellen
      </div>
      <div style="margin-bottom:4px;">
        <span style="display:inline-block;width:14px;height:3px;background:${COLORS.danger};vertical-align:middle;margin-right:6px;border-top:2px dashed ${COLORS.danger};"></span>
        Sperrungen
      </div>
      <div style="margin-bottom:4px;">
        <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${COLORS.danger};vertical-align:middle;margin-right:6px;font-size:9px;text-align:center;line-height:14px;color:#fff;">✚</span>
        Kritische Infrastruktur
      </div>
    `;

    document.body.appendChild(legendeEl);
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  function _removePanels() {
    _removeElement(dashboardEl);    dashboardEl = null;
    _removeElement(bewilligungsEl); bewilligungsEl = null;
    _removeElement(kalenderEl);     kalenderEl = null;
    _removeElement(erreichbarkeitEl); erreichbarkeitEl = null;
    _removeElement(legendeEl);      legendeEl = null;
  }

  function cleanup() {
    _removePanels();
    _clearPopups();
    _clearInfraMarkers();

    // Karten-Klick entfernen
    if (mapClickHandler) {
      map.off('click', mapClickHandler);
      mapClickHandler = null;
    }
    map.getCanvas().style.cursor = '';

    // Erreichbarkeits-Marker entfernen
    if (erreichbarkeitMarker) {
      erreichbarkeitMarker.remove();
      erreichbarkeitMarker = null;
    }

    // Layer und Sources entfernen
    LAYER_IDS.forEach(id => _removeLayer(id));
    SOURCE_IDS.forEach(id => _removeSource(id));

    // Toast entfernen
    const toast = document.getElementById('behoerden-toast');
    if (toast) toast.remove();
  }

  // ── Öffentliche API ──

  return {
    showDashboard:              showDashboard,
    showBewilligungen:          showBewilligungen,
    checkErreichbarkeit:        checkErreichbarkeit,
    showKritischeInfrastruktur: showKritischeInfrastruktur,
    showKalender:               showKalender,
    showUebersicht:             showUebersicht,
    cleanup:                    cleanup,

    // Interne Methoden (onclick-Zugriff aus DOM)
    _onGesuchClick:             _onGesuchClick,
    _updateBewilligung:         _updateBewilligung,
    _showAuflagen:              _showAuflagen,
    _runErreichbarkeitCheck:    _runErreichbarkeitCheck,
    _onKalenderClick:           _onKalenderClick,
  };

})();
