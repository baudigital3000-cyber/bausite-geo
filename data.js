// ============================================
// BAUSITE Geo — Demo-Daten
// Region: Grenchen / Solothurn
// Koordinaten: WGS84 (für MapLibre)
// ============================================

// ── Baustellen (Projekte) — Fallback wenn API nicht erreichbar ──
var BAUSTELLEN = [
  {
    id: 'BS-2026-001',
    name: 'Wasserleitung Bettlachstrasse',
    auftraggeber: 'Bau Grenchen',
    status: 'aktiv',
    phase: 'Ausführung',
    start: '2026-02-10',
    ende: '2026-04-15',
    budget: 285000,
    typ: 'Wasserleitung',
    beschreibung: 'Erneuerung Hauptwasserleitung DN150, Länge 340m, inkl. 12 Hausanschlüsse',
    center: [7.3965, 47.1925],
    polygon: [
      [7.3945, 47.1920], [7.3985, 47.1920],
      [7.3985, 47.1930], [7.3945, 47.1930], [7.3945, 47.1920]
    ],
    kubatur: {
      aushub: 1360,
      kies: 680,
      beton: 45,
      asphalt: 170,
    },
    kosten: {
      aushub: 54400,
      material: 89000,
      personal: 76000,
      maschinen: 48000,
      entsorgung: 17600,
    },
    graben: [
      { von: 'Schacht A1', bis: 'Schacht A5', laenge: 180, tiefe: 1.6, breite: 0.8, material: 'PE DN150' },
      { von: 'Schacht A5', bis: 'Schacht A9', laenge: 160, tiefe: 1.4, breite: 0.8, material: 'PE DN150' },
    ]
  },
  {
    id: 'BS-2026-002',
    name: 'Gasleitung Solothurnstrasse',
    auftraggeber: 'Bau Grenchen',
    status: 'aktiv',
    phase: 'Ausführung',
    start: '2026-03-01',
    ende: '2026-05-30',
    budget: 420000,
    typ: 'Gasleitung',
    beschreibung: 'Neuverlegung Gasleitung DN100, 520m, Stahlleitungsersatz durch PE',
    center: [7.3890, 47.1940],
    polygon: [
      [7.3870, 47.1935], [7.3910, 47.1935],
      [7.3910, 47.1945], [7.3870, 47.1945], [7.3870, 47.1935]
    ],
    kubatur: {
      aushub: 2080,
      kies: 1040,
      beton: 62,
      asphalt: 260,
    },
    kosten: {
      aushub: 83200,
      material: 134000,
      personal: 98000,
      maschinen: 72000,
      entsorgung: 32800,
    },
    graben: [
      { von: 'Knoten G1', bis: 'Knoten G4', laenge: 260, tiefe: 1.2, breite: 0.6, material: 'PE DN100' },
      { von: 'Knoten G4', bis: 'Knoten G8', laenge: 260, tiefe: 1.3, breite: 0.6, material: 'PE DN100' },
    ]
  },
  {
    id: 'BS-2026-003',
    name: 'Kanalisation Lindenstrasse',
    auftraggeber: 'Stadt Grenchen',
    status: 'planung',
    phase: 'Projektierung',
    start: '2026-05-01',
    ende: '2026-08-30',
    budget: 580000,
    typ: 'Kanalisation',
    beschreibung: 'Sanierung Mischwasserkanalisation DN400, 280m, 8 Schächte, Inliner-Verfahren',
    center: [7.3935, 47.1955],
    polygon: [
      [7.3920, 47.1950], [7.3950, 47.1950],
      [7.3950, 47.1960], [7.3920, 47.1960], [7.3920, 47.1950]
    ],
    kubatur: {
      aushub: 840,
      kies: 320,
      beton: 120,
      asphalt: 140,
    },
    kosten: {
      aushub: 42000,
      material: 198000,
      personal: 156000,
      maschinen: 124000,
      entsorgung: 60000,
    },
    graben: [
      { von: 'Schacht K1', bis: 'Schacht K4', laenge: 140, tiefe: 2.8, breite: 1.2, material: 'Beton DN400' },
      { von: 'Schacht K4', bis: 'Schacht K8', laenge: 140, tiefe: 3.2, breite: 1.2, material: 'Beton DN400' },
    ]
  },
  {
    id: 'BS-2026-004',
    name: 'EW-Kabel Kirchstrasse',
    auftraggeber: 'Bau Grenchen',
    status: 'abgeschlossen',
    phase: 'Abrechnung',
    start: '2025-11-15',
    ende: '2026-02-28',
    budget: 165000,
    typ: 'Stromkabel',
    beschreibung: 'MS-Kabelersatz 16kV, 380m, Schutzrohre, 4 Kabelschächte',
    center: [7.4010, 47.1935],
    polygon: [
      [7.3995, 47.1930], [7.4025, 47.1930],
      [7.4025, 47.1940], [7.3995, 47.1940], [7.3995, 47.1930]
    ],
    kubatur: {
      aushub: 570,
      kies: 285,
      beton: 32,
      asphalt: 95,
    },
    kosten: {
      aushub: 22800,
      material: 68000,
      personal: 42000,
      maschinen: 24000,
      entsorgung: 8200,
    },
    graben: [
      { von: 'Schacht E1', bis: 'Schacht E6', laenge: 380, tiefe: 0.8, breite: 0.5, material: 'Schutzrohr PE110' },
    ]
  },
];

// ── Gräben als GeoJSON Linien ──
const GRABEN_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { projekt: 'BS-2026-001', typ: 'Wasserleitung', material: 'PE DN150', tiefe: 1.5, status: 'aktiv' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3948, 47.1922], [7.3955, 47.1924], [7.3965, 47.1925], [7.3975, 47.1926], [7.3982, 47.1928]]
      }
    },
    {
      type: 'Feature',
      properties: { projekt: 'BS-2026-002', typ: 'Gasleitung', material: 'PE DN100', tiefe: 1.25, status: 'aktiv' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3872, 47.1938], [7.3882, 47.1939], [7.3892, 47.1940], [7.3902, 47.1941], [7.3908, 47.1942]]
      }
    },
    {
      type: 'Feature',
      properties: { projekt: 'BS-2026-003', typ: 'Kanalisation', material: 'Beton DN400', tiefe: 3.0, status: 'planung' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3922, 47.1953], [7.3930, 47.1954], [7.3938, 47.1955], [7.3946, 47.1957]]
      }
    },
    {
      type: 'Feature',
      properties: { projekt: 'BS-2026-004', typ: 'Stromkabel', material: 'Schutzrohr PE110', tiefe: 0.8, status: 'abgeschlossen' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3998, 47.1932], [7.4005, 47.1934], [7.4012, 47.1935], [7.4020, 47.1937]]
      }
    },
  ]
};

// ── Maschinen (Fallback wenn API nicht erreichbar) ──
const MASCHINEN = [
  { id: 'M-001', name: 'Bagger CAT 320', machine_type: 'bagger', manufacturer: 'Caterpillar', model: '320 GC', tracker_id: 'FMC650-001', project_id: 'BS-2026-001', status: 'active', ignition: true, speed: 0, heading: 180, fuel_level: 78, today_km: 1.2, today_hours: 3.5, coords: [7.3968, 47.1926] },
  { id: 'M-002', name: 'Bagger Liebherr 918', machine_type: 'bagger', manufacturer: 'Liebherr', model: 'A 918', tracker_id: 'FMC650-002', project_id: 'BS-2026-002', status: 'active', ignition: true, speed: 2.5, heading: 90, fuel_level: 65, today_km: 2.8, today_hours: 4.1, coords: [7.3895, 47.1941] },
  { id: 'M-003', name: 'Walze BOMAG BW120', machine_type: 'walze', manufacturer: 'BOMAG', model: 'BW 120', tracker_id: 'FMC650-003', project_id: 'BS-2026-001', status: 'idle', ignition: true, speed: 0, heading: 0, fuel_level: 52, today_km: 0.8, today_hours: 2.2, coords: [7.3958, 47.1923] },
  { id: 'M-004', name: 'Dumper Wacker 3001', machine_type: 'dumper', manufacturer: 'Wacker Neuson', model: '3001', tracker_id: 'FMC650-004', project_id: 'BS-2026-002', status: 'active', ignition: true, speed: 8.5, heading: 270, fuel_level: 41, today_km: 5.6, today_hours: 4.8, coords: [7.3888, 47.1939] },
  { id: 'M-005', name: 'Bagger Volvo EC140', machine_type: 'bagger', manufacturer: 'Volvo', model: 'EC140E', tracker_id: 'FMC650-005', project_id: null, status: 'off', ignition: false, speed: 0, heading: 0, fuel_level: 88, today_km: 0, today_hours: 0, coords: [7.3840, 47.1910] },
  { id: 'M-006', name: 'Radlader CAT 906', machine_type: 'radlader', manufacturer: 'Caterpillar', model: '906M', tracker_id: 'FMC650-006', project_id: null, status: 'off', ignition: false, speed: 0, heading: 0, fuel_level: 92, today_km: 0, today_hours: 0, coords: [7.3842, 47.1912] },
];

// ── Maschinentyp-Icons (SVG-kompatibel) ──
const MACHINE_ICONS = {
  bagger:   { emoji: '🔨', label: 'Bagger' },
  lkw:      { emoji: '🚛', label: 'LKW' },
  kran:     { emoji: '🏗️', label: 'Kran' },
  walze:    { emoji: '🔄', label: 'Walze' },
  dumper:   { emoji: '🚜', label: 'Dumper' },
  radlader: { emoji: '⚙️', label: 'Radlader' },
  andere:   { emoji: '🔧', label: 'Andere' },
};

// ── Status-Farben ──
const STATUS_COLORS = {
  active:  { bg: '#22C55E', border: '#16A34A', label: 'Aktiv',    labelColor: '#16A34A' },
  idle:    { bg: '#EAB308', border: '#CA8A04', label: 'Leerlauf', labelColor: '#CA8A04' },
  off:     { bg: '#EF4444', border: '#DC2626', label: 'Aus',      labelColor: '#DC2626' },
  offline: { bg: '#9CA3AF', border: '#6B7280', label: 'Offline',  labelColor: '#6B7280' },
};

// ── Geofences (Fallback) ──
const GEOFENCES_FALLBACK = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Baustelle Bettlachstrasse', geofence_type: 'baustelle', project_id: 'BS-2026-001' },
      geometry: { type: 'Polygon', coordinates: [[[7.3945, 47.1920], [7.3985, 47.1920], [7.3985, 47.1930], [7.3945, 47.1930], [7.3945, 47.1920]]] }
    },
    {
      type: 'Feature',
      properties: { name: 'Baustelle Solothurnstrasse', geofence_type: 'baustelle', project_id: 'BS-2026-002' },
      geometry: { type: 'Polygon', coordinates: [[[7.3870, 47.1935], [7.3910, 47.1935], [7.3910, 47.1945], [7.3870, 47.1945], [7.3870, 47.1935]]] }
    },
    {
      type: 'Feature',
      properties: { name: 'BAUSITE Depot', geofence_type: 'depot', project_id: null },
      geometry: { type: 'Polygon', coordinates: [[[7.3830, 47.1905], [7.3855, 47.1905], [7.3855, 47.1918], [7.3830, 47.1918], [7.3830, 47.1905]]] }
    },
  ]
};

// ── Sperrungen ──
const SPERRUNGEN_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Bettlachstrasse (Teilsperrung)', von: '2026-03-15', bis: '2026-04-10', typ: 'Teilsperrung', projekt: 'BS-2026-001' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3945, 47.1924], [7.3960, 47.1925], [7.3975, 47.1926], [7.3985, 47.1927]]
      }
    },
    {
      type: 'Feature',
      properties: { name: 'Solothurnstrasse (Vollsperrung)', von: '2026-03-20', bis: '2026-04-30', typ: 'Vollsperrung', projekt: 'BS-2026-002' },
      geometry: {
        type: 'LineString',
        coordinates: [[7.3868, 47.1940], [7.3885, 47.1940], [7.3900, 47.1941], [7.3912, 47.1942]]
      }
    },
  ]
};

// ── Logistik-Standorte ──
const LOGISTIK = [
  { id: 'L-001', name: 'Kieswerk Leuzigen', typ: 'kieswerk', coords: [7.3650, 47.1780], preise: { kies: 32, sand: 28 }, distanz_km: 4.2 },
  { id: 'L-002', name: 'Deponie Bellach', typ: 'deponie', coords: [7.4200, 47.2050], preise: { aushub_sauber: 18, aushub_belastet: 85 }, distanz_km: 3.8 },
  { id: 'L-003', name: 'Betonwerk Bettlach', typ: 'betonwerk', coords: [7.4150, 47.1870], preise: { beton_c25: 185, beton_c30: 205 }, distanz_km: 2.1 },
  { id: 'L-004', name: 'BAUSITE Depot', typ: 'depot', coords: [7.3840, 47.1910], preise: {}, distanz_km: 0 },
];

// ── Einheitspreise (CHF) ──
const EINHEITSPREISE = {
  aushub_m3: 40,
  kies_m3: 55,
  beton_m3: 220,
  asphalt_m2: 85,
  rohr_pe_dn100_m: 45,
  rohr_pe_dn150_m: 68,
  rohr_beton_dn400_m: 180,
  schacht_stk: 4500,
  hausanschluss_stk: 2800,
};

// ── Farbkodierung ──
const FARBEN = {
  Wasserleitung: '#2E86AB',
  Gasleitung: '#F59E0B',
  Kanalisation: '#8B5CF6',
  Stromkabel: '#EF4444',
  aktiv: '#22C55E',
  planung: '#3B82F6',
  abgeschlossen: '#94A3B8',
};
