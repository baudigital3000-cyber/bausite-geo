// ============================================
// BAUSITE Geo — Demo App
// MapLibre GL JS + swisstopo WMTS
// Static Mode — kein Backend nötig
// ============================================

// ── Static Mode: alle Features laufen clientseitig ──
const STATIC_MODE = true;

// ── Toast für Backend-Features ──
function showComingSoon(feature) {
  const existing = document.getElementById('coming-soon-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'coming-soon-toast';
  toast.style.cssText = `
    position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 9999;
    background: linear-gradient(135deg, #1B2A4A, #2a3f6a); color: #fff; padding: 16px 28px;
    border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3); border: 1px solid rgba(232,131,58,0.3);
    display: flex; align-items: center; gap: 12px; max-width: 420px;
  `;
  toast.innerHTML = `
    <span style="font-size:24px;">🚀</span>
    <div>
      <div style="font-weight:700;margin-bottom:2px;">${feature}</div>
      <div style="opacity:0.8;font-size:12px;">Backend in Entwicklung — kommt bald!</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; setTimeout(() => toast.remove(), 500); }, 3000);
}

// ── Rollenauswahl ──
let currentRole = localStorage.getItem('bausite_role') || null;

const ROLE_LABELS = {
  baufuehrer:    'Bauunternehmer',
  behoerde:      'Behörde / Blaulicht',
  eigentuemer:   'Eigentümer',
  netzbetreiber: 'Netzbetreiber',
  alle:          'Demo — Alle Features',
};

function selectRole(role) {
  currentRole = role;
  localStorage.setItem('bausite_role', role);

  // Login-Screen ausblenden
  document.getElementById('role-screen').style.display = 'none';

  // Badge aktualisieren
  const badge = document.getElementById('role-badge');
  if (badge) badge.textContent = ROLE_LABELS[role] || role;

  // Panels nach Rolle filtern
  applyRoleFilter(role);
}

function applyRoleFilter(role) {
  document.querySelectorAll('.panel[data-role]').forEach(panel => {
    const roles = panel.dataset.role.split(' ');
    panel.style.display = (roles.includes(role) || roles.includes('alle')) ? '' : 'none';
  });

  // Header-Stats nach Rolle anpassen
  const machineStats = document.getElementById('machine-count')?.closest('.header-stat');
  const trackingStatus = document.getElementById('tracking-status')?.closest('.header-stat');
  if (machineStats) machineStats.style.display = (role === 'baufuehrer' || role === 'alle') ? '' : 'none';
  if (trackingStatus) trackingStatus.style.display = (role === 'baufuehrer' || role === 'alle') ? '' : 'none';
}

// Beim Laden prüfen ob Rolle gespeichert ist
if (currentRole) {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('role-screen').style.display = 'none';
    const badge = document.getElementById('role-badge');
    if (badge) badge.textContent = ROLE_LABELS[currentRole] || currentRole;
    applyRoleFilter(currentRole);
  });
}

// Rolle wechseln (vom Header aus)
function changeRole() {
  localStorage.removeItem('bausite_role');
  currentRole = null;
  document.getElementById('role-screen').style.display = 'flex';
}

// ── swisstopo WMTS Base URL ──
const SWISSTOPO_WMTS = 'https://wmts.geo.admin.ch/1.0.0';

// WMTS tile URL template for swisstopo
function swisstopoTileUrl(layerId, format = 'jpeg') {
  return `${SWISSTOPO_WMTS}/${layerId}/default/current/3857/{z}/{x}/{y}.${format}`;
}

// ── Initialize Map ──
const map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    name: 'BAUSITE Geo',
    sources: {
      'swisstopo-luftbild': {
        type: 'raster',
        tiles: [swisstopoTileUrl('ch.swisstopo.swissimage', 'jpeg')],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.swisstopo.ch">swisstopo</a>',
        maxzoom: 20,
      },
      'swisstopo-landeskarte': {
        type: 'raster',
        tiles: [swisstopoTileUrl('ch.swisstopo.pixelkarte-farbe', 'jpeg')],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.swisstopo.ch">swisstopo</a>',
        maxzoom: 20,
      },
      'swisstopo-grau': {
        type: 'raster',
        tiles: [swisstopoTileUrl('ch.swisstopo.pixelkarte-grau', 'jpeg')],
        tileSize: 256,
        attribution: '&copy; <a href="https://www.swisstopo.ch">swisstopo</a>',
        maxzoom: 20,
      },
      'av-solothurn': {
        type: 'raster',
        tiles: [
          'https://geo.so.ch/api/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.so.agi.av.amtliche_vermessung&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true'
        ],
        tileSize: 256,
        attribution: '&copy; <a href="https://geo.so.ch">Kt. Solothurn</a>',
        maxzoom: 22,
      },
    },
    layers: [
      {
        id: 'luftbild',
        type: 'raster',
        source: 'swisstopo-luftbild',
        layout: { visibility: 'visible' },
      },
      {
        id: 'landeskarte',
        type: 'raster',
        source: 'swisstopo-landeskarte',
        layout: { visibility: 'none' },
      },
      {
        id: 'graukarte',
        type: 'raster',
        source: 'swisstopo-grau',
        layout: { visibility: 'none' },
      },
      {
        id: 'av-background',
        type: 'background',
        layout: { visibility: 'none' },
        paint: { 'background-color': '#ffffff' },
      },
      {
        id: 'av-layer',
        type: 'raster',
        source: 'av-solothurn',
        layout: { visibility: 'none' },
      },
    ],
  },
  center: [7.3950, 47.1935],
  zoom: 15,
  maxZoom: 22,
  minZoom: 8,
});

// ── Navigation Controls ──
map.addControl(new maplibregl.NavigationControl(), 'top-left');
map.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left');

// ── API URL ──
const API_BASE = STATIC_MODE ? null : (window.location.origin + '/api');

// ── Baustellen laden ──
// Im Static Mode werden die Demo-Daten aus data.js verwendet
async function loadBaustellen() {
  if (STATIC_MODE) {
    console.log('[STATIC] Verwende lokale Demo-Daten');
    return null;
  }
  try {
    const res = await fetch(API_BASE + '/baustellen');
    const geojson = await res.json();
    BAUSTELLEN = geojson.features.map(f => {
      const p = f.properties;
      return {
        id: p.projekt_id,
        name: p.name,
        beschreibung: p.beschreibung || '',
        auftraggeber: p.bauherr || '',
        status: p.status === 'geplant' ? 'planung' : p.status,
        phase: p.phase || '',
        typ: p.typ || '',
        start: p.start_datum || '',
        ende: p.end_datum || '',
        budget: p.budget || 0,
        kubatur: p.kubatur || {},
        kosten: p.kosten || {},
        center: [
          (f.geometry.coordinates[0][0][0] + f.geometry.coordinates[0][2][0]) / 2,
          (f.geometry.coordinates[0][0][1] + f.geometry.coordinates[0][2][1]) / 2,
        ],
        polygon: f.geometry.coordinates[0],
        _geojsonFeature: f,
      };
    });
    return geojson;
  } catch (err) {
    console.error('API nicht erreichbar, verwende lokale Daten:', err);
    return null;
  }
}

// ── Map Load ──
map.on('load', async () => {
  const geojson = await loadBaustellen();
  addDataLayers(geojson);
  renderProjectList();
  renderKubaturSummary();
  updateHeaderStats();
  animateStats();
});

// ── Add all data layers ──
function addDataLayers(apiGeoJSON) {
  // Baustellen polygons — direkt von API oder Fallback
  let baustellenGeoJSON;
  if (apiGeoJSON) {
    // Remap properties fuer die Karten-Layer
    baustellenGeoJSON = {
      type: 'FeatureCollection',
      features: apiGeoJSON.features.map(f => ({
        type: 'Feature',
        properties: {
          id: f.properties.projekt_id,
          name: f.properties.name,
          status: f.properties.status === 'geplant' ? 'planung' : f.properties.status,
          typ: f.properties.typ,
        },
        geometry: f.geometry,
      }))
    };
  } else {
    baustellenGeoJSON = {
      type: 'FeatureCollection',
      features: BAUSTELLEN.map(bs => ({
        type: 'Feature',
        properties: { id: bs.id, name: bs.name, status: bs.status, typ: bs.typ },
        geometry: { type: 'Polygon', coordinates: [bs.polygon] }
      }))
    };
  }

  map.addSource('baustellen', { type: 'geojson', data: baustellenGeoJSON });

  map.addLayer({
    id: 'baustellen-fill',
    type: 'fill',
    source: 'baustellen',
    paint: {
      'fill-color': [
        'match', ['get', 'status'],
        'aktiv', 'rgba(34, 197, 94, 0.2)',
        'planung', 'rgba(59, 130, 246, 0.2)',
        'abgeschlossen', 'rgba(148, 163, 184, 0.15)',
        'rgba(100, 100, 100, 0.1)'
      ],
      'fill-outline-color': [
        'match', ['get', 'status'],
        'aktiv', '#22C55E',
        'planung', '#3B82F6',
        'abgeschlossen', '#94A3B8',
        '#666'
      ],
    }
  });

  map.addLayer({
    id: 'baustellen-border',
    type: 'line',
    source: 'baustellen',
    paint: {
      'line-color': [
        'match', ['get', 'status'],
        'aktiv', '#22C55E',
        'planung', '#3B82F6',
        'abgeschlossen', '#94A3B8',
        '#666'
      ],
      'line-width': 2.5,
      'line-dasharray': [4, 2],
    }
  });

  // Gräben
  map.addSource('graben', { type: 'geojson', data: GRABEN_GEOJSON });

  map.addLayer({
    id: 'graben-line',
    type: 'line',
    source: 'graben',
    paint: {
      'line-color': [
        'match', ['get', 'typ'],
        'Wasserleitung', '#2E86AB',
        'Gasleitung', '#F59E0B',
        'Kanalisation', '#8B5CF6',
        'Stromkabel', '#EF4444',
        '#888'
      ],
      'line-width': 4,
      'line-opacity': 0.9,
    }
  });

  map.addLayer({
    id: 'graben-label',
    type: 'symbol',
    source: 'graben',
    layout: {
      'symbol-placement': 'line',
      'text-field': ['concat', ['get', 'material'], ' — ', ['to-string', ['get', 'tiefe']], 'm'],
      'text-size': 10,
      'text-font': ['Open Sans Regular'],
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': '#1B2A4A',
      'text-halo-color': 'rgba(255,255,255,0.9)',
      'text-halo-width': 2,
    }
  });

  // Sperrungen
  map.addSource('sperrungen', { type: 'geojson', data: SPERRUNGEN_GEOJSON });

  map.addLayer({
    id: 'sperrungen-line',
    type: 'line',
    source: 'sperrungen',
    paint: {
      'line-color': [
        'match', ['get', 'typ'],
        'Vollsperrung', '#EF4444',
        'Teilsperrung', '#F59E0B',
        '#888'
      ],
      'line-width': 6,
      'line-opacity': 0.6,
      'line-dasharray': [2, 2],
    }
  });

  // ── Live-Maschinen Layer (GeoJSON, aktualisiert via WebSocket) ──
  const machinesGeoJSON = {
    type: 'FeatureCollection',
    features: MASCHINEN.map(m => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: m.coords },
      properties: {
        machine_id: m.id, name: m.name, machine_type: m.machine_type,
        manufacturer: m.manufacturer, model: m.model, tracker_id: m.tracker_id,
        project_id: m.project_id, status: m.status, speed: m.speed,
        heading: m.heading, ignition: m.ignition, fuel_level: m.fuel_level,
        today_km: m.today_km, today_hours: m.today_hours,
      }
    }))
  };

  map.addSource('machines-live', { type: 'geojson', data: machinesGeoJSON });

  // Status-Halo (äusserer Ring)
  map.addLayer({
    id: 'machines-halo',
    type: 'circle',
    source: 'machines-live',
    paint: {
      'circle-radius': 16,
      'circle-color': [
        'match', ['get', 'status'],
        'active', 'rgba(34, 197, 94, 0.25)',
        'idle',   'rgba(234, 179, 8, 0.25)',
        'off',    'rgba(239, 68, 68, 0.15)',
        'rgba(156, 163, 175, 0.15)'
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': [
        'match', ['get', 'status'],
        'active', '#22C55E',
        'idle',   '#EAB308',
        'off',    '#EF4444',
        '#9CA3AF'
      ],
    }
  });

  // Maschinen-Punkt (innerer Kreis)
  map.addLayer({
    id: 'machines-point',
    type: 'circle',
    source: 'machines-live',
    paint: {
      'circle-radius': 8,
      'circle-color': '#1B2A4A',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#E8833A',
    }
  });

  // Maschinen-Label
  map.addLayer({
    id: 'machines-label',
    type: 'symbol',
    source: 'machines-live',
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 10,
      'text-font': ['Open Sans Regular'],
      'text-offset': [0, 2.2],
      'text-anchor': 'top',
    },
    paint: {
      'text-color': '#1B2A4A',
      'text-halo-color': 'rgba(255,255,255,0.9)',
      'text-halo-width': 2,
    }
  });

  // Geofences Layer
  const geofencesData = GEOFENCES_FALLBACK;
  map.addSource('geofences', { type: 'geojson', data: geofencesData });

  map.addLayer({
    id: 'geofences-fill',
    type: 'fill',
    source: 'geofences',
    paint: {
      'fill-color': [
        'match', ['get', 'geofence_type'],
        'baustelle', 'rgba(232, 131, 58, 0.08)',
        'depot',     'rgba(59, 130, 246, 0.08)',
        'rgba(100, 100, 100, 0.05)'
      ],
    }
  });

  map.addLayer({
    id: 'geofences-outline',
    type: 'line',
    source: 'geofences',
    paint: {
      'line-color': [
        'match', ['get', 'geofence_type'],
        'baustelle', '#E8833A',
        'depot',     '#3B82F6',
        '#888'
      ],
      'line-width': 1.5,
      'line-dasharray': [6, 3],
      'line-opacity': 0.5,
    }
  });

  // ── Strassennetz-Layer (manuell zuschaltbar, default aus) ──
  map.addSource('strassennetz', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Strassen-Linien farbkodiert nach Typ
  map.addLayer({
    id: 'strassennetz-line',
    type: 'line',
    source: 'strassennetz',
    layout: { visibility: 'none' },
    paint: {
      'line-color': [
        'match', ['get', 'highway'],
        'motorway',      '#E8444D',
        'motorway_link', '#E8444D',
        'trunk',         '#F07040',
        'primary',       '#E8833A',
        'secondary',     '#EAB308',
        'tertiary',      '#60A5FA',
        'residential',   '#94A3B8',
        'living_street', '#94A3B8',
        'service',       '#CBD5E1',
        'unclassified',  '#A1A1AA',
        'track',         '#8B7355',
        '#94A3B8'
      ],
      'line-width': [
        'match', ['get', 'highway'],
        'motorway', 4,
        'motorway_link', 2.5,
        'trunk', 3.5,
        'primary', 3,
        'secondary', 2.5,
        'tertiary', 2,
        'residential', 1.5,
        'service', 1,
        'track', 1,
        1.5
      ],
      'line-opacity': 0.75,
    }
  });

  // Hover-Highlight (dickere Linie)
  map.addLayer({
    id: 'strassennetz-hover',
    type: 'line',
    source: 'strassennetz',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#E8833A',
      'line-width': 5,
      'line-opacity': 0.9,
    },
    filter: ['==', 'gid', -1], // leer bis Hover
  });

  // Strassennamen-Label
  map.addLayer({
    id: 'strassennetz-label',
    type: 'symbol',
    source: 'strassennetz',
    layout: {
      visibility: 'none',
      'symbol-placement': 'line',
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-font': ['Open Sans Regular'],
      'text-offset': [0, -0.8],
      'text-anchor': 'center',
      'text-max-angle': 30,
      'symbol-spacing': 250,
    },
    paint: {
      'text-color': '#1B2A4A',
      'text-halo-color': 'rgba(255,255,255,0.92)',
      'text-halo-width': 2,
    },
    filter: ['has', 'name'],
  });

  // Hover-Interaktion: Name + Details als Popup
  let streetPopup = null;

  map.on('mousemove', 'strassennetz-line', (e) => {
    if (!e.features.length) return;
    const f = e.features[0];
    const p = f.properties;
    map.getCanvas().style.cursor = 'pointer';

    // Hover-Highlight
    map.setFilter('strassennetz-hover', ['==', 'gid', p.gid]);

    // Popup mit Strasseninfo
    if (!streetPopup) {
      streetPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'street-popup',
        maxWidth: '260px',
      });
    }

    const typLabel = {
      motorway: 'Autobahn', trunk: 'Autostrasse', primary: 'Hauptstrasse',
      secondary: 'Verbindungsstrasse', tertiary: 'Sammelstrasse',
      residential: 'Quartierstrasse', living_street: 'Begegnungszone',
      service: 'Zufahrt/Service', unclassified: 'Gemeindestrasse', track: 'Feld-/Waldweg',
      motorway_link: 'Autobahnauffahrt',
    };

    streetPopup
      .setLngLat(e.lngLat)
      .setHTML(`
        <div style="font-weight:700;font-size:13px;color:#1B2A4A;margin-bottom:4px;">${p.name || 'Ohne Name'}</div>
        <div style="font-size:11px;color:#64748B;">
          ${typLabel[p.highway] || p.highway}
          ${p.maxspeed ? ' · ' + p.maxspeed + ' km/h' : ''}
          ${p.width ? ' · Breite ' + p.width + 'm' : ''}
          ${p.surface ? ' · ' + p.surface : ''}
          ${p.oneway ? ' · Einbahn' : ''}
          ${p.length_m ? '<br>' + (p.length_m / 1000).toFixed(2) + ' km' : ''}
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseleave', 'strassennetz-line', () => {
    map.getCanvas().style.cursor = '';
    map.setFilter('strassennetz-hover', ['==', 'gid', -1]);
    if (streetPopup) {
      streetPopup.remove();
      streetPopup = null;
    }
  });

  // Track-Layer (für ausgewählte Maschine)
  map.addSource('machine-track', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'machine-track-line',
    type: 'line',
    source: 'machine-track',
    paint: {
      'line-color': '#E8833A',
      'line-width': 3,
      'line-opacity': 0.7,
      'line-dasharray': [2, 1],
    }
  });

  // Klick auf Maschine — Popup
  map.on('click', 'machines-point', (e) => {
    const props = e.features[0].properties;
    const coords = e.features[0].geometry.coordinates;
    const sc = STATUS_COLORS[props.status] || STATUS_COLORS.offline;
    const icon = MACHINE_ICONS[props.machine_type] || MACHINE_ICONS.andere;

    new maplibregl.Popup({ offset: 15, maxWidth: '280px' })
      .setLngLat(coords)
      .setHTML(`
        <div class="popup-title">${icon.emoji} ${props.name}</div>
        <div class="popup-row"><span>Typ:</span> <strong>${icon.label} — ${props.manufacturer} ${props.model}</strong></div>
        <div class="popup-row"><span>Status:</span> <strong style="color:${sc.labelColor}">${sc.label}</strong></div>
        <div class="popup-row"><span>Geschwindigkeit:</span> <strong>${props.speed} km/h</strong></div>
        <div class="popup-row"><span>Diesel:</span> <strong>${props.fuel_level}%</strong></div>
        <div class="popup-row"><span>Heute:</span> <strong>${props.today_km} km, ${props.today_hours}h Betrieb</strong></div>
        ${props.project_id ? `<div class="popup-row"><span>Baustelle:</span> <strong>${props.project_id}</strong></div>` : ''}
        <div class="popup-badge" style="background:${sc.bg}22; color:${sc.labelColor}; margin-top:6px;">
          ${sc.label.toUpperCase()}
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button class="popup-action-btn" onclick="showMachineTrack('${props.machine_id}')">Route anzeigen</button>
          <button class="popup-action-btn" onclick="flyToMachine('${props.machine_id}')">Zentrieren</button>
        </div>
      `)
      .addTo(map);
  });

  map.on('mouseenter', 'machines-point', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'machines-point', () => map.getCanvas().style.cursor = '');

  // Tracking NICHT automatisch starten — User muss Toggle aktivieren
  // initTrackingWebSocket();

  // Geofences von API laden
  loadGeofences();

  // Maschinen-Panel rendern (statische Daten als Fallback)
  renderMachinePanel();

  // Logistik markers
  LOGISTIK.forEach(l => {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 30px; height: 30px;
      background: white;
      border: 2px solid ${l.typ === 'kieswerk' ? '#E8833A' : l.typ === 'deponie' ? '#8B5CF6' : l.typ === 'betonwerk' ? '#2E86AB' : '#1B2A4A'};
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;
    el.innerHTML = l.typ === 'kieswerk' ? '⛰️' :
                   l.typ === 'deponie' ? '♻️' :
                   l.typ === 'betonwerk' ? '🏭' : '🏠';

    const preisRows = Object.entries(l.preise).map(([k, v]) =>
      `<div class="popup-row"><span>${k.replace(/_/g, ' ')}:</span> <strong>CHF ${v}/m³</strong></div>`
    ).join('');

    const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
      .setHTML(`
        <div class="popup-title">${l.name}</div>
        <div class="popup-row"><span>Typ:</span> <strong>${l.typ}</strong></div>
        <div class="popup-row"><span>Distanz:</span> <strong>${l.distanz_km} km</strong></div>
        ${preisRows}
      `);

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(l.coords)
      .setPopup(popup)
      .addTo(map);

    // Initially hidden
    el.style.display = 'none';
    marker._logistikEl = el;
    window['logistik_marker_' + l.id] = marker;
  });

  // Click handlers
  map.on('click', 'baustellen-fill', (e) => {
    const props = e.features[0].properties;
    const bs = BAUSTELLEN.find(b => b.id === props.id);
    if (bs) showBaustelleDetail(bs);
  });

  map.on('click', 'graben-line', (e) => {
    const props = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title">${props.typ}</div>
        <div class="popup-row"><span>Material:</span> <strong>${props.material}</strong></div>
        <div class="popup-row"><span>Tiefe:</span> <strong>${props.tiefe}m</strong></div>
        <div class="popup-row"><span>Projekt:</span> <strong>${props.projekt}</strong></div>
      `)
      .addTo(map);
  });

  map.on('click', 'sperrungen-line', (e) => {
    const props = e.features[0].properties;
    new maplibregl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(`
        <div class="popup-title">${props.name}</div>
        <div class="popup-row"><span>Typ:</span> <strong style="color: ${props.typ === 'Vollsperrung' ? '#EF4444' : '#F59E0B'}">${props.typ}</strong></div>
        <div class="popup-row"><span>Von:</span> <strong>${props.von}</strong></div>
        <div class="popup-row"><span>Bis:</span> <strong>${props.bis}</strong></div>
      `)
      .addTo(map);
  });

  // Cursor changes
  ['baustellen-fill', 'graben-line', 'sperrungen-line'].forEach(layer => {
    map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
  });
}

// ── Basemap Switching ──
function switchBasemap(type) {
  const layers = { luftbild: 'luftbild', karte: 'landeskarte', grau: 'graukarte' };
  Object.entries(layers).forEach(([key, layerId]) => {
    map.setLayoutProperty(layerId, 'visibility', key === type ? 'visible' : 'none');
  });
}

// ── Layer Toggle ──
function toggleLayer(layerName) {
  const mapping = {
    luftbild: ['luftbild'],
    landeskarte: ['landeskarte'],
    baustellen: ['baustellen-fill', 'baustellen-border'],
    graben: ['graben-line', 'graben-label'],
    sperrungen: ['sperrungen-line'],
  };

  if (layerName === 'maschinen') {
    const checked = document.getElementById('layer-maschinen').checked;
    const vis = checked ? 'visible' : 'none';
    ['machines-halo', 'machines-point', 'machines-label'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    return;
  }

  if (layerName === 'strassennetz') {
    const checked = document.getElementById('layer-strassennetz')?.checked;
    const vis = checked ? 'visible' : 'none';
    ['strassennetz-line', 'strassennetz-hover', 'strassennetz-label'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    if (checked) loadStrassennetz();
    return;
  }

  if (layerName === 'geofences') {
    const checked = document.getElementById('layer-geofences')?.checked;
    const vis = checked ? 'visible' : 'none';
    ['geofences-fill', 'geofences-outline'].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    return;
  }

  if (layerName === 'logistik') {
    const checked = document.getElementById('layer-logistik').checked;
    LOGISTIK.forEach(l => {
      const marker = window['logistik_marker_' + l.id];
      if (marker && marker._logistikEl) {
        marker._logistikEl.style.display = checked ? '' : 'none';
      }
    });
    return;
  }

  if (layerName === 'av') {
    const checked = document.getElementById('layer-av').checked;
    const vis = checked ? 'visible' : 'none';
    if (map.getLayer('av-layer')) map.setLayoutProperty('av-layer', 'visibility', vis);
    if (map.getLayer('av-background')) map.setLayoutProperty('av-background', 'visibility', vis);
    // Basemap ausblenden wenn AV aktiv, sonst wiederherstellen
    if (checked) {
      ['luftbild', 'landeskarte', 'graukarte'].forEach(id => {
        map.setLayoutProperty(id, 'visibility', 'none');
      });
    } else {
      map.setLayoutProperty('luftbild', 'visibility', 'visible');
    }
    return;
  }

  const layers = mapping[layerName];
  if (!layers) return;

  const checkbox = document.getElementById(`layer-${layerName}`);
  layers.forEach(id => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', checkbox.checked ? 'visible' : 'none');
    }
  });
}

// ── Panel Toggle ──
function togglePanel(panelId) {
  const content = document.getElementById(`${panelId}-content`);
  const toggle = document.getElementById(`${panelId}-toggle`);
  content.classList.toggle('collapsed');
  toggle.textContent = content.classList.contains('collapsed') ? '▸' : '▾';
}

// ── Project List ──
function renderProjectList() {
  const list = document.getElementById('project-list');
  list.innerHTML = BAUSTELLEN.map(bs => `
    <div class="project-card" onclick="selectProject('${bs.id}')" id="card-${bs.id}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div class="project-name">${bs.name}</div>
        <span class="project-status status-${bs.status}">${bs.status}</span>
      </div>
      <div class="project-meta">
        <span>${bs.auftraggeber}</span>
        <span>${bs.typ}</span>
        <span>CHF ${formatNumber(bs.budget)}</span>
      </div>
    </div>
  `).join('');
}

// ── Select Project ──
function selectProject(id) {
  const bs = BAUSTELLEN.find(b => b.id === id);
  if (!bs) return;

  // Highlight card
  document.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`card-${id}`).classList.add('active');

  // Fly to baustelle
  map.flyTo({ center: bs.center, zoom: 17, duration: 1200 });

  // Show detail
  showBaustelleDetail(bs);
}

// ── Show Detail Panel ──
function showBaustelleDetail(bs) {
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const content = document.getElementById('detail-content');

  title.textContent = bs.name;

  const kosten = bs.kosten || {};
  const totalKosten = Object.values(kosten).reduce((a, b) => a + b, 0);
  const maxKosten = Math.max(...Object.values(kosten), 1);

  const kostenLabels = {
    aushub: 'Aushub',
    material: 'Material',
    personal: 'Personal',
    maschinen: 'Maschinen',
    entsorgung: 'Entsorgung',
  };

  const kostenColors = ['orange', 'blue', 'green', 'orange', 'blue'];

  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">// Projektinfo</div>
      <div class="detail-row"><span class="detail-key">ID</span><span class="detail-val">${bs.id}</span></div>
      <div class="detail-row"><span class="detail-key">Auftraggeber</span><span class="detail-val">${bs.auftraggeber}</span></div>
      <div class="detail-row"><span class="detail-key">Typ</span><span class="detail-val">${bs.typ}</span></div>
      <div class="detail-row"><span class="detail-key">Phase</span><span class="detail-val">${bs.phase}</span></div>
      <div class="detail-row"><span class="detail-key">Zeitraum</span><span class="detail-val">${bs.start} — ${bs.ende}</span></div>
      <div class="detail-row"><span class="detail-key">Budget</span><span class="detail-val" style="color: var(--orange); font-size: 14px;">CHF ${formatNumber(bs.budget)}</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">// Beschreibung</div>
      <p style="font-size: 12px; color: var(--slate); line-height: 1.6;">${bs.beschreibung}</p>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">// Kubatur (m³)</div>
      <div class="detail-row"><span class="detail-key">Aushub</span><span class="detail-val">${formatNumber((bs.kubatur||{}).aushub||0)} m³</span></div>
      <div class="detail-row"><span class="detail-key">Kies</span><span class="detail-val">${formatNumber((bs.kubatur||{}).kies||0)} m³</span></div>
      <div class="detail-row"><span class="detail-key">Beton</span><span class="detail-val">${formatNumber((bs.kubatur||{}).beton||0)} m³</span></div>
      <div class="detail-row"><span class="detail-key">Asphalt</span><span class="detail-val">${formatNumber((bs.kubatur||{}).asphalt||0)} m²</span></div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">// Kostenaufstellung</div>
      <div class="cost-bar-container">
        ${Object.entries(kosten).map(([key, val], i) => `
          <div class="cost-bar-row">
            <div class="cost-bar-label">${kostenLabels[key]}</div>
            <div class="cost-bar-track">
              <div class="cost-bar-fill ${kostenColors[i % kostenColors.length]}" style="width: ${(val / maxKosten * 100).toFixed(0)}%"></div>
            </div>
            <div class="cost-bar-amount">CHF ${formatNumber(val)}</div>
          </div>
        `).join('')}
      </div>
      <div class="detail-row" style="margin-top: 12px; padding-top: 12px; border-top: 2px solid var(--border);">
        <span class="detail-key" style="font-weight: 700;">Total</span>
        <span class="detail-val" style="color: var(--orange); font-size: 15px;">CHF ${formatNumber(totalKosten)}</span>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">// Grabenabschnitte</div>
      ${(bs.graben || []).map(g => `
        <div style="background: var(--light); border-radius: 8px; padding: 10px; margin-bottom: 6px; font-size: 11px;">
          <div style="font-weight: 700; color: var(--navy); margin-bottom: 4px;">${g.von} → ${g.bis}</div>
          <div style="color: var(--slate);">${g.laenge}m · ${g.tiefe}m tief · ${g.breite}m breit · ${g.material}</div>
          <div style="color: var(--orange); font-weight: 600; margin-top: 4px;">
            Aushub: ${(g.laenge * g.tiefe * g.breite).toFixed(0)} m³ ≈ CHF ${formatNumber(Math.round(g.laenge * g.tiefe * g.breite * EINHEITSPREISE.aushub_m3))}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="detail-tags">
      <span class="detail-tag">${bs.typ}</span>
      <span class="detail-tag">${bs.status}</span>
      <span class="detail-tag">${bs.auftraggeber}</span>
    </div>

    <div style="border-top: 2px solid var(--border); margin-top: 12px; padding-top: 12px; display: flex; gap: 8px;">
      <button class="tool-btn" style="flex:1;" onclick="editBaustelleProps('${bs.id}')">Bearbeiten</button>
      <button class="tool-btn" style="flex:1;" onclick="editBaustellePerimeter('${bs.id}')">Perimeter</button>
    </div>
  `;

  panel.classList.add('open');
}

// ── Close Detail ──
function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.querySelectorAll('.project-card').forEach(c => c.classList.remove('active'));
}

// ── Kubatur Summary ──
function renderKubaturSummary() {
  const container = document.getElementById('kubatur-summary');
  const aktiv = BAUSTELLEN.filter(b => b.status === 'aktiv');

  const totals = { aushub: 0, kies: 0, beton: 0, asphalt: 0 };
  const kostenTotal = { aushub: 0, material: 0, personal: 0, maschinen: 0, entsorgung: 0 };

  aktiv.forEach(bs => {
    Object.keys(totals).forEach(k => totals[k] += bs.kubatur[k]);
    Object.keys(kostenTotal).forEach(k => kostenTotal[k] += bs.kosten[k]);
  });

  const gesamtKosten = Object.values(kostenTotal).reduce((a, b) => a + b, 0);

  container.innerHTML = `
    <div style="font-size: 11px; color: var(--slate); margin-bottom: 10px;">Nur aktive Baustellen (${aktiv.length})</div>
    <div class="kubatur-row"><span class="kubatur-label">Aushub</span><span class="kubatur-value">${formatNumber(totals.aushub)} m³</span></div>
    <div class="kubatur-row"><span class="kubatur-label">Kies</span><span class="kubatur-value">${formatNumber(totals.kies)} m³</span></div>
    <div class="kubatur-row"><span class="kubatur-label">Beton</span><span class="kubatur-value">${formatNumber(totals.beton)} m³</span></div>
    <div class="kubatur-row"><span class="kubatur-label">Asphalt</span><span class="kubatur-value">${formatNumber(totals.asphalt)} m²</span></div>
    <div class="kubatur-row" style="margin-top: 8px; padding-top: 8px; border-top: 2px solid var(--border);">
      <span class="kubatur-label" style="font-weight: 700;">Gesamtkosten</span>
      <span class="kubatur-value highlight">CHF ${formatNumber(gesamtKosten)}</span>
    </div>
  `;
}

// ── Header Stats ──
function updateHeaderStats() {
  const aktiv = BAUSTELLEN.filter(b => b.status !== 'abgeschlossen');
  const totalVolume = aktiv.reduce((sum, b) => sum + b.kubatur.aushub, 0);
  const totalBudget = aktiv.reduce((sum, b) => sum + b.budget, 0);

  document.getElementById('project-count').textContent = aktiv.length;
  document.getElementById('total-volume').dataset.target = totalVolume;
  document.getElementById('total-cost').dataset.target = totalBudget;
}

// ── Animate Numbers ──
function animateStats() {
  animateNumber('total-volume', 0);
  animateNumber('total-cost', 0);
}

function animateNumber(id, start) {
  const el = document.getElementById(id);
  const target = parseInt(el.dataset.target) || 0;
  const duration = 1500;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = formatNumber(current);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── WGS84 -> CH1903+/LV95 Konversion ──
function wgs84ToCH(lon, lat) {
  const phi = lat * 3600;
  const lam = lon * 3600;
  const phiAux = (phi - 169028.66) / 10000;
  const lamAux = (lam - 26782.5) / 10000;
  const E = 2600072.37 + 211455.93 * lamAux - 10938.51 * lamAux * phiAux
    - 0.36 * lamAux * phiAux * phiAux - 44.54 * lamAux * lamAux * lamAux;
  const N = 1200147.07 + 308807.95 * phiAux + 3745.25 * lamAux * lamAux
    + 76.63 * phiAux * phiAux - 194.56 * lamAux * lamAux * phiAux
    + 119.79 * phiAux * phiAux * phiAux;
  return { E: Math.round(E), N: Math.round(N) };
}

// ── Massstab aus Kartenbreite berechnen ──
function getMapScale() {
  const bounds = map.getBounds();
  const center = map.getCenter();
  // Distanz in Metern ueber die Kartenbreite (Haversine vereinfacht)
  const lat = center.lat * Math.PI / 180;
  const dLng = bounds.getEast() - bounds.getWest();
  const metersOnGround = dLng * (Math.PI / 180) * 6378137 * Math.cos(lat);
  // Bildschirmbreite in Metern (96 DPI)
  const canvas = map.getCanvas();
  const screenWidthM = canvas.clientWidth / 96 * 0.0254;
  return Math.round(metersOnGround / screenWidthM);
}

// ── Coordinate Display ──
map.on('mousemove', (e) => {
  const { lng, lat } = e.lngLat;
  const ch = wgs84ToCH(lng, lat);
  document.getElementById('coordinates').textContent =
    `WGS84: ${lat.toFixed(5)}°N  ${lng.toFixed(5)}°E`;
  document.getElementById('coordinates-ch').textContent =
    `LV95: ${formatNumber(ch.E)} / ${formatNumber(ch.N)}`;
});

// Massstab bei Zoom-Aenderung aktualisieren
function updateScale() {
  const scale = getMapScale();
  document.getElementById('scale').textContent = `1:${formatNumber(scale)}`;
}
map.on('zoom', updateScale);
map.on('resize', updateScale);
map.on('load', updateScale);

// ── Tools ──
function activateTool(tool) {
  if (typeof MeasureModule !== 'undefined') {
    if (tool === 'measure') return MeasureModule.startDistance();
    if (tool === 'area') return MeasureModule.startArea();
    if (tool === 'profile') return MeasureModule.startProfile();
  }
}

function zoomToGrenchen() {
  map.flyTo({ center: [7.3950, 47.1935], zoom: 15, duration: 1500 });
}

function exportView() {
  // Simple screenshot via canvas
  const canvas = map.getCanvas();
  const link = document.createElement('a');
  link.download = `bausite-geo-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL();
  link.click();
}

// ── Neue Baustelle erfassen ──
function startNeueBaustelle() {
  closeDetail();
  // Formular im Detail-Panel anzeigen
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const content = document.getElementById('detail-content');

  title.textContent = 'Neue Baustelle';
  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">// Projekt-ID</div>
      <input type="text" id="new-bs-id" placeholder="z.B. BS-2026-005" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;">
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Name</div>
      <input type="text" id="new-bs-name" placeholder="z.B. Wasserleitung Musterstrasse" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;">
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Bauherr</div>
      <input type="text" id="new-bs-bauherr" value="Bau Grenchen" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;">
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Typ</div>
      <select id="new-bs-typ" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;">
        <option>Wasserleitung</option>
        <option>Gasleitung</option>
        <option>Kanalisation</option>
        <option>Stromkabel</option>
        <option>Strassenbau</option>
        <option>Hochbau</option>
        <option>Andere</option>
      </select>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Beschreibung</div>
      <textarea id="new-bs-beschreibung" rows="3" placeholder="Kurzbeschreibung..." style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;box-sizing:border-box;"></textarea>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Status</div>
      <select id="new-bs-status" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;">
        <option value="geplant">Geplant</option>
        <option value="aktiv">Aktiv</option>
        <option value="abgeschlossen">Abgeschlossen</option>
      </select>
    </div>
    <div style="margin-top: 16px;">
      <button class="tool-btn" style="width:100%;background:#E8833A;color:white;font-weight:700;padding:10px;" onclick="startPerimeterZeichnen()">Perimeter zeichnen</button>
      <button class="tool-btn" style="width:100%;margin-top:6px;" onclick="closeDetail()">Abbrechen</button>
    </div>
  `;
  panel.classList.add('open');
}

// ── Perimeter zeichnen fuer neue Baustelle ──
// Global auf window damit Drawing-Modul darauf zugreifen kann
window._pendingPerimeterCallback = null;

function startPerimeterZeichnen() {
  // Validierung
  const id = document.getElementById('new-bs-id').value.trim();
  const name = document.getElementById('new-bs-name').value.trim();
  if (!id || !name) {
    alert('Bitte ID und Name ausfuellen.');
    return;
  }

  // Formulardaten zwischenspeichern
  const formData = {
    projekt_id: id,
    name: name,
    bauherr: document.getElementById('new-bs-bauherr').value.trim(),
    typ: document.getElementById('new-bs-typ').value,
    beschreibung: document.getElementById('new-bs-beschreibung').value.trim(),
    status: document.getElementById('new-bs-status').value,
  };

  closeDetail();

  // Drawing-Modul nutzen um Polygon zu zeichnen
  // Wir registrieren einen Callback der nach dem Zeichnen aufgerufen wird
  window._pendingPerimeterCallback = async function(geometry) {
    const data = {
      ...formData,
      geometry: geometry,
      kubatur: {},
      kosten: {},
    };
    const ok = await createBaustelle(data);
    if (ok) {
      alert('Baustelle "' + formData.name + '" gespeichert!');
    }
    window._pendingPerimeterCallback = null;
  };

  DrawingModule.startPolygon();

  // Banner ueberschreiben
  setTimeout(() => {
    const banner = document.querySelector('.drawing-banner');
    if (banner) {
      const titleEl = banner.querySelector('.banner-title');
      if (titleEl) titleEl.textContent = 'Baustellen-Perimeter zeichnen';
    }
  }, 100);
}

// ── Bestehende Baustelle: Eigenschaften bearbeiten ──
function editBaustelleProps(projektId) {
  const bs = BAUSTELLEN.find(b => b.id === projektId);
  if (!bs) return;

  const content = document.getElementById('detail-content');
  const title = document.getElementById('detail-title');
  title.textContent = 'Bearbeiten: ' + bs.name;

  content.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">// Name</div>
      <input type="text" id="edit-name" value="${bs.name}" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;">
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Bauherr</div>
      <input type="text" id="edit-bauherr" value="${bs.auftraggeber}" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;box-sizing:border-box;">
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Typ</div>
      <select id="edit-typ" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;">
        ${['Wasserleitung','Gasleitung','Kanalisation','Stromkabel','Strassenbau','Hochbau','Andere'].map(t =>
          '<option' + (t === bs.typ ? ' selected' : '') + '>' + t + '</option>'
        ).join('')}
      </select>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Beschreibung</div>
      <textarea id="edit-beschreibung" rows="3" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;resize:vertical;box-sizing:border-box;">${bs.beschreibung}</textarea>
    </div>
    <div class="detail-section">
      <div class="detail-section-title">// Status</div>
      <select id="edit-status" style="width:100%;padding:6px 10px;border:1px solid #CBD5E1;border-radius:6px;font-family:inherit;font-size:12px;">
        ${[['geplant','Geplant'],['aktiv','Aktiv'],['abgeschlossen','Abgeschlossen']].map(([v,l]) =>
          '<option value="' + v + '"' + (v === bs.status || (v === 'geplant' && bs.status === 'planung') ? ' selected' : '') + '>' + l + '</option>'
        ).join('')}
      </select>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px;">
      <button class="tool-btn" style="flex:1;background:#E8833A;color:white;font-weight:700;" onclick="saveEditProps('${projektId}')">Speichern</button>
      <button class="tool-btn" style="flex:1;" onclick="selectProject('${projektId}')">Abbrechen</button>
    </div>
  `;
}

async function saveEditProps(projektId) {
  if (STATIC_MODE) { showComingSoon('Baustellen bearbeiten'); return; }
  const data = {
    name: document.getElementById('edit-name').value.trim(),
    bauherr: document.getElementById('edit-bauherr').value.trim(),
    typ: document.getElementById('edit-typ').value,
    beschreibung: document.getElementById('edit-beschreibung').value.trim(),
    status: document.getElementById('edit-status').value,
  };

  try {
    const res = await fetch(API_BASE + '/baustellen/' + projektId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    await reloadBaustellen();
    const bs = BAUSTELLEN.find(b => b.id === projektId);
    if (bs) showBaustelleDetail(bs);
  } catch (err) {
    alert('Fehler: ' + err.message);
  }
}

// ── Bestehende Baustelle: Perimeter editieren ──
let _editMarkers = [];
let _editSourceId = 'edit-perimeter-source';
let _editLayerFill = 'edit-perimeter-fill';
let _editLayerLine = 'edit-perimeter-line';

function editBaustellePerimeter(projektId) {
  const bs = BAUSTELLEN.find(b => b.id === projektId);
  if (!bs || !bs.polygon) return;

  closeDetail();

  // Kopie der Vertices (ohne schliessenden Punkt)
  let vertices = bs.polygon.map(c => [...c]);
  if (vertices.length > 1 &&
      vertices[0][0] === vertices[vertices.length - 1][0] &&
      vertices[0][1] === vertices[vertices.length - 1][1]) {
    vertices.pop();
  }

  // Edit-Polygon als eigene Source/Layer anzeigen
  _updateEditPolygon(vertices);

  // Draggable Marker fuer jeden Knoten
  _editMarkers.forEach(m => m.remove());
  _editMarkers = [];

  vertices.forEach((coord, i) => {
    const el = document.createElement('div');
    el.style.cssText = 'width:14px;height:14px;background:#E8833A;border:2px solid white;border-radius:50%;cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,0.3);';

    const marker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(coord)
      .addTo(map);

    marker.on('drag', () => {
      const pos = marker.getLngLat();
      vertices[i] = [pos.lng, pos.lat];
      _updateEditPolygon(vertices);
    });

    _editMarkers.push(marker);
  });

  // Toolbar anzeigen
  _showEditToolbar(projektId, vertices);
}

function _updateEditPolygon(vertices) {
  const ring = [...vertices, vertices[0]];
  const geojson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [ring] },
    }],
  };

  if (map.getSource(_editSourceId)) {
    map.getSource(_editSourceId).setData(geojson);
  } else {
    map.addSource(_editSourceId, { type: 'geojson', data: geojson });
    map.addLayer({
      id: _editLayerFill,
      type: 'fill',
      source: _editSourceId,
      paint: { 'fill-color': 'rgba(232, 131, 58, 0.25)' },
    });
    map.addLayer({
      id: _editLayerLine,
      type: 'line',
      source: _editSourceId,
      paint: { 'line-color': '#E8833A', 'line-width': 2.5, 'line-dasharray': [4, 2] },
    });
  }
}

function _showEditToolbar(projektId, vertices) {
  // Toolbar oben auf der Karte
  let toolbar = document.getElementById('edit-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'edit-toolbar';
    toolbar.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:20;background:rgba(17,28,51,0.92);backdrop-filter:blur(10px);border-radius:10px;padding:8px 16px;display:flex;align-items:center;gap:12px;font-family:"Plus Jakarta Sans",sans-serif;font-size:12px;color:rgba(255,255,255,0.85);box-shadow:0 4px 20px rgba(0,0,0,0.25);';
    document.querySelector('.map-container').appendChild(toolbar);
  }
  toolbar.innerHTML = `
    <span style="font-weight:600;">Perimeter bearbeiten</span>
    <span style="color:rgba(255,255,255,0.5);font-size:11px;">Knoten verschieben</span>
    <button onclick="_saveEditPerimeter('${projektId}')" style="background:#E8833A;color:white;border:none;border-radius:6px;padding:5px 12px;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;">Speichern</button>
    <button onclick="_cancelEditPerimeter('${projektId}')" style="background:rgba(239,68,68,0.8);color:white;border:none;border-radius:6px;padding:5px 12px;font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;">Abbrechen</button>
  `;
}

async function _saveEditPerimeter(projektId) {
  // Aktuelle Positionen der Marker auslesen
  const coords = _editMarkers.map(m => [m.getLngLat().lng, m.getLngLat().lat]);
  const ring = [...coords, coords[0]];
  const geometry = { type: 'Polygon', coordinates: [ring] };

  const ok = await savePerimeter(projektId, geometry);
  _cleanupEditMode();

  if (ok) {
    await reloadBaustellen();
    const bs = BAUSTELLEN.find(b => b.id === projektId);
    if (bs) {
      showBaustelleDetail(bs);
    }
  }
}

function _cancelEditPerimeter(projektId) {
  _cleanupEditMode();
  const bs = BAUSTELLEN.find(b => b.id === projektId);
  if (bs) showBaustelleDetail(bs);
}

function _cleanupEditMode() {
  _editMarkers.forEach(m => m.remove());
  _editMarkers = [];
  if (map.getLayer(_editLayerFill)) map.removeLayer(_editLayerFill);
  if (map.getLayer(_editLayerLine)) map.removeLayer(_editLayerLine);
  if (map.getSource(_editSourceId)) map.removeSource(_editSourceId);
  const toolbar = document.getElementById('edit-toolbar');
  if (toolbar) toolbar.remove();
}

// ── API: Perimeter speichern ──
async function savePerimeter(projektId, geojsonGeometry) {
  if (STATIC_MODE) { showComingSoon('Perimeter speichern'); return false; }
  try {
    const res = await fetch(`${API_BASE}/baustellen/${projektId}/perimeter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geometry: geojsonGeometry }),
    });
    if (!res.ok) throw new Error(await res.text());
    console.log(`Perimeter ${projektId} gespeichert`);
    return true;
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    return false;
  }
}

// ── API: Neue Baustelle anlegen ──
async function createBaustelle(data) {
  if (STATIC_MODE) { showComingSoon('Neue Baustelle anlegen'); return false; }
  try {
    const res = await fetch(`${API_BASE}/baustellen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    // Karte neu laden
    await reloadBaustellen();
    return true;
  } catch (err) {
    console.error('Fehler beim Anlegen:', err);
    return false;
  }
}

// ── API: Baustelle loeschen ──
async function deleteBaustelle(projektId) {
  if (STATIC_MODE) { showComingSoon('Baustelle löschen'); return; }
  try {
    const res = await fetch(`${API_BASE}/baustellen/${projektId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    await reloadBaustellen();
    return true;
  } catch (err) {
    console.error('Fehler beim Loeschen:', err);
    return false;
  }
}

// ── Karte + Listen neu laden ──
async function reloadBaustellen() {
  const geojson = await loadBaustellen();
  if (geojson) {
    const remapped = {
      type: 'FeatureCollection',
      features: geojson.features.map(f => ({
        type: 'Feature',
        properties: {
          id: f.properties.projekt_id,
          name: f.properties.name,
          status: f.properties.status === 'geplant' ? 'planung' : f.properties.status,
          typ: f.properties.typ,
        },
        geometry: f.geometry,
      }))
    };
    map.getSource('baustellen').setData(remapped);
  }
  renderProjectList();
  renderKubaturSummary();
  updateHeaderStats();
}

// ── Strassennetz laden ──
let strassennetzLoaded = false;

async function loadStrassennetz() {
  if (strassennetzLoaded || STATIC_MODE) return;

  const bounds = map.getBounds();
  const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

  try {
    const res = await fetch(`${API_BASE}/streets?bbox=${bbox}`);
    const data = await res.json();
    const source = map.getSource('strassennetz');
    if (source && data.features) {
      source.setData(data);
      strassennetzLoaded = true;
      console.log(`[STRASSEN] ${data.features.length} Segmente geladen`);
    }
  } catch (e) {
    console.warn('[STRASSEN] Nicht geladen:', e);
  }
}

// Bei Kartenverschiebung neu laden wenn Strassennetz aktiv
map.on('moveend', () => {
  const checkbox = document.getElementById('layer-strassennetz');
  if (checkbox && checkbox.checked) {
    strassennetzLoaded = false; // erzwingt Neuladen
    loadStrassennetz();
  }
});

// ── Utility ──
function formatNumber(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}


// ════════════════════════════════════════════════════════════════
//  GPS-TRACKING — WebSocket, Live-Updates, Machine Panel
// ════════════════════════════════════════════════════════════════

let trackingWS = null;
let selectedMachineId = null;
let trackingConnected = false;
let trackingEnabled = false;
let pollingInterval = null;

// ── Live-Tracking ein/aus ──
function toggleTracking() {
  const checkbox = document.getElementById('tracking-toggle');
  trackingEnabled = checkbox ? checkbox.checked : false;

  if (STATIC_MODE) {
    if (trackingEnabled) {
      // Demo-Modus: Maschinen aus data.js anzeigen
      const demoGeoJSON = {
        type: 'FeatureCollection',
        features: MASCHINEN.map(m => ({
          type: 'Feature',
          properties: {
            machine_id: m.id, name: m.name, machine_type: m.machine_type,
            status: m.status, speed: m.speed, project_id: m.project_id,
            today_hours: m.today_hours, fuel_level: m.fuel_level,
          },
          geometry: { type: 'Point', coordinates: m.coords }
        }))
      };
      updateMachinePositions(demoGeoJSON);
      updateTrackingStatus(true);
    } else {
      updateTrackingStatus(false);
    }
    return;
  }

  if (trackingEnabled) {
    initTrackingWebSocket();
  } else {
    stopTracking();
  }
}

function stopTracking() {
  trackingEnabled = false;
  if (trackingWS) {
    trackingWS.onclose = null; // Kein Auto-Reconnect
    trackingWS.close();
    trackingWS = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  trackingConnected = false;
  updateTrackingStatus(false);
  console.log('[TRACKING] Gestoppt');
}

// ── WebSocket verbinden ──
function initTrackingWebSocket() {
  if (!trackingEnabled) return;
  if (trackingWS && trackingWS.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/positions`;

  try {
    trackingWS = new WebSocket(wsUrl);

    trackingWS.onopen = () => {
      trackingConnected = true;
      updateTrackingStatus(true);
      trackingWS.send(JSON.stringify({ subscribe: 'all' }));
      console.log('[TRACKING] WebSocket verbunden');
    };

    trackingWS.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'position_update' && msg.data) {
        updateMachinePositions(msg.data);
      } else if (msg.type === 'event') {
        handleTrackingEvent(msg);
      }
    };

    trackingWS.onclose = () => {
      trackingConnected = false;
      updateTrackingStatus(false);
      if (trackingEnabled) {
        console.log('[TRACKING] WebSocket getrennt, Reconnect in 5s...');
        setTimeout(initTrackingWebSocket, 5000);
      }
    };

    trackingWS.onerror = () => {
      trackingConnected = false;
      updateTrackingStatus(false);
      if (trackingEnabled) startPollingFallback();
    };
  } catch (e) {
    if (trackingEnabled) startPollingFallback();
  }
}

// ── Polling-Fallback ──
function startPollingFallback() {
  if (STATIC_MODE || pollingInterval || !trackingEnabled) return;
  pollingInterval = setInterval(async () => {
    if (!trackingEnabled) { clearInterval(pollingInterval); pollingInterval = null; return; }
    try {
      const res = await fetch(API_BASE + '/machines/live');
      const data = await res.json();
      updateMachinePositions(data);
      updateTrackingStatus(true);
    } catch (e) {
      updateTrackingStatus(false);
    }
  }, 5000);
}

// ── Maschinen-Positionen auf der Karte aktualisieren ──
function updateMachinePositions(geojson) {
  const source = map.getSource('machines-live');
  if (source && geojson && geojson.features) {
    source.setData(geojson);
    renderMachinePanel(geojson.features);
    updateMachineStats(geojson.features);
  }
}

// ── Tracking-Status-Anzeige ──
function updateTrackingStatus(connected) {
  const el = document.getElementById('tracking-status');
  if (el) {
    el.innerHTML = connected
      ? '<span class="tracking-dot live"></span> Live'
      : '<span class="tracking-dot"></span> Offline';
  }
}

// ── Maschinen-Panel in Sidebar rendern ──
function renderMachinePanel(features) {
  const list = document.getElementById('machine-list');
  if (!list) return;

  // Falls keine Features übergeben, Fallback-Daten verwenden
  const machines = features || MASCHINEN.map(m => ({
    properties: {
      machine_id: m.id, name: m.name, machine_type: m.machine_type,
      status: m.status, speed: m.speed, project_id: m.project_id,
      today_hours: m.today_hours, fuel_level: m.fuel_level,
    },
    geometry: { coordinates: m.coords }
  }));

  // Statistiken
  const total = machines.length;
  const active = machines.filter(f => f.properties.status === 'active').length;
  const idle = machines.filter(f => f.properties.status === 'idle').length;
  const off = machines.filter(f => f.properties.status === 'off' || f.properties.status === 'offline').length;

  // Stats-Zeile
  const statsEl = document.getElementById('machine-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <span class="ms-stat"><span class="ms-dot active"></span>${active}</span>
      <span class="ms-stat"><span class="ms-dot idle"></span>${idle}</span>
      <span class="ms-stat"><span class="ms-dot off"></span>${off}</span>
      <span class="ms-stat-total">${total} Total</span>
    `;
  }

  list.innerHTML = machines.map(f => {
    const p = f.properties;
    const sc = STATUS_COLORS[p.status] || STATUS_COLORS.offline;
    const icon = MACHINE_ICONS[p.machine_type] || MACHINE_ICONS.andere;
    const isSelected = p.machine_id === selectedMachineId;

    return `
      <div class="machine-card ${isSelected ? 'selected' : ''}" onclick="selectMachine('${p.machine_id}')">
        <div class="mc-header">
          <span class="mc-icon">${icon.emoji}</span>
          <div class="mc-info">
            <div class="mc-name">${p.name}</div>
            <div class="mc-meta">${p.project_id || 'Kein Projekt'} · ${p.today_hours || 0}h</div>
          </div>
          <span class="mc-status-dot" style="background:${sc.bg};" title="${sc.label}"></span>
        </div>
        <div class="mc-bar">
          <div class="mc-bar-item">
            <span class="mc-bar-label">Speed</span>
            <span class="mc-bar-value">${p.speed || 0} km/h</span>
          </div>
          <div class="mc-bar-item">
            <span class="mc-bar-label">Diesel</span>
            <span class="mc-bar-value">${p.fuel_level || 0}%</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Maschinen-Stats im Header updaten ──
function updateMachineStats(features) {
  const el = document.getElementById('machine-count');
  if (el) {
    const active = features.filter(f => f.properties.status === 'active' || f.properties.status === 'idle').length;
    el.textContent = active;
  }
}

// ── Maschine auswählen ──
function selectMachine(machineId) {
  selectedMachineId = machineId;

  // Karte auf Maschine zentrieren
  const source = map.getSource('machines-live');
  if (source) {
    const data = source._data || source.serialize().data;
    if (data && data.features) {
      const feature = data.features.find(f => f.properties.machine_id === machineId);
      if (feature) {
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 17),
          duration: 800,
        });
      }
    }
  }

  // Track laden
  showMachineTrack(machineId);

  // Panel aktualisieren (Highlight)
  document.querySelectorAll('.machine-card').forEach(c => c.classList.remove('selected'));
  // Re-render passiert beim nächsten WebSocket-Update
}

// ── Tagesroute einer Maschine anzeigen ──
async function showMachineTrack(machineId) {
  const trackSource = map.getSource('machine-track');
  if (!trackSource || STATIC_MODE) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${API_BASE}/machines/${machineId}/track?date=${today}`);
    const track = await res.json();

    if (track.geometry) {
      trackSource.setData({
        type: 'FeatureCollection',
        features: [track],
      });
    } else {
      trackSource.setData({ type: 'FeatureCollection', features: [] });
    }
  } catch (e) {
    console.warn('[TRACKING] Track nicht verfuegbar:', e);
    trackSource.setData({ type: 'FeatureCollection', features: [] });
  }
}

// ── Auf Maschine fliegen ──
function flyToMachine(machineId) {
  selectMachine(machineId);
}

// ── Geofences von API laden ──
async function loadGeofences() {
  if (STATIC_MODE) return;
  try {
    const res = await fetch(API_BASE + '/geofences');
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const source = map.getSource('geofences');
      if (source) source.setData(data);
    }
  } catch (e) {
    console.log('[TRACKING] Geofences API nicht erreichbar, verwende Fallback');
  }
}

// ── Tracking-Events behandeln (Geofence, Alarm) ──
function handleTrackingEvent(event) {
  console.log('[EVENT]', event);
  showTrackingToast(event);
}

// ── Toast-Benachrichtigung ──
function showTrackingToast(event) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const isAlert = event.event_type === 'unauthorized_movement' || event.event_type === 'geofence_exit';
  const toast = document.createElement('div');
  toast.className = `tracking-toast ${isAlert ? 'alert' : 'info'}`;
  toast.innerHTML = `
    <div class="toast-icon">${isAlert ? '🚨' : 'ℹ️'}</div>
    <div class="toast-content">
      <div class="toast-title">${event.machine_name || 'Maschine'}</div>
      <div class="toast-msg">${event.event_type === 'geofence_enter' ? 'Baustelle betreten' :
        event.event_type === 'geofence_exit' ? 'Baustelle verlassen!' :
        event.event_type === 'unauthorized_movement' ? 'Unautorisierte Bewegung!' :
        event.event_type}</div>
    </div>
  `;
  container.appendChild(toast);

  // Nach 5s ausblenden
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}
