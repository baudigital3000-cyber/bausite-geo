// ============================================
// BAUSITE Geo — Marketplace Module
// Eigentümer: Fläche zeichnen → Auto-KV → Offerten
// Bauunternehmer: Anfragen-Feed → Offerte abgeben
// ============================================

const MarketplaceModule = (function() {
  let mode = 'none'; // 'draw', 'none'
  let drawPoints = [];
  let drawSourceAdded = false;
  let kvData = null;
  let currentAnfrageId = null;

  // ── Polygon zeichnen + Auto-KV ──
  function startAnfrage() {
    cleanup();
    mode = 'draw';
    drawPoints = [];
    map.getCanvas().style.cursor = 'crosshair';

    // Banner
    const banner = document.createElement('div');
    banner.id = 'mp-banner';
    banner.className = 'drawing-banner';
    banner.innerHTML = `
      <span>Zeichnen Sie die Fläche auf dem Luftbild (Doppelklick = abschliessen)</span>
      <button onclick="MarketplaceModule.cleanup()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 12px;border-radius:4px;cursor:pointer;margin-left:12px;">Abbrechen</button>
    `;
    document.body.appendChild(banner);

    // Draw Source + Layer
    if (!drawSourceAdded) {
      map.addSource('mp-draw', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({ id: 'mp-draw-fill', type: 'fill', source: 'mp-draw', paint: { 'fill-color': 'rgba(232,131,58,0.15)' }});
      map.addLayer({ id: 'mp-draw-line', type: 'line', source: 'mp-draw', paint: { 'line-color': '#E8833A', 'line-width': 2 }});
      map.addLayer({ id: 'mp-draw-verts', type: 'circle', source: 'mp-draw', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#E8833A', 'circle-stroke-width': 2, 'circle-stroke-color': 'white' }});
      drawSourceAdded = true;
    }

    map.on('click', onDrawClick);
    map.on('dblclick', onDrawDblClick);
  }

  function onDrawClick(e) {
    if (mode !== 'draw') return;
    drawPoints.push([e.lngLat.lng, e.lngLat.lat]);
    updateDrawPreview();
  }

  function onDrawDblClick(e) {
    if (mode !== 'draw' || drawPoints.length < 3) return;
    e.preventDefault();
    map.off('click', onDrawClick);
    map.off('dblclick', onDrawDblClick);
    mode = 'none';
    map.getCanvas().style.cursor = '';

    // Polygon schliessen
    const ring = [...drawPoints, drawPoints[0]];
    const area = calcArea(ring);
    const perim = calcPerimeter(ring);

    updateDrawPreview(); // finales Polygon
    showKVDialog(ring, area, perim);
  }

  function updateDrawPreview() {
    const src = map.getSource('mp-draw');
    if (!src) return;
    const features = [];
    // Punkte
    drawPoints.forEach(p => {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} });
    });
    // Polygon (wenn >= 3 Punkte)
    if (drawPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...drawPoints, drawPoints[0]]] },
        properties: {}
      });
    } else if (drawPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: drawPoints },
        properties: {}
      });
    }
    src.setData({ type: 'FeatureCollection', features });
  }

  // ── Flächenberechnung (Shoelace, WGS84-Näherung) ──
  function calcArea(ring) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371000;
    const latMid = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const mPerDegLat = 111320;
    const mPerDegLng = 111320 * Math.cos(toRad(latMid));
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = ring[i][0] * mPerDegLng, y1 = ring[i][1] * mPerDegLat;
      const x2 = ring[i+1][0] * mPerDegLng, y2 = ring[i+1][1] * mPerDegLat;
      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  }

  function calcPerimeter(ring) {
    let perim = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      perim += haversine(ring[i][1], ring[i][0], ring[i+1][1], ring[i+1][0]);
    }
    return perim;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── KV Dialog ──
  function showKVDialog(ring, area, perim) {
    removeBanner();
    const dialog = document.createElement('div');
    dialog.id = 'mp-kv-dialog';
    dialog.className = 'mp-dialog';
    dialog.innerHTML = `
      <h3>Kostenvoranschlag berechnen</h3>
      <div class="mp-auto-vals">
        <div><span class="mp-lbl">Fläche:</span> <strong>${area.toFixed(1)} m²</strong></div>
        <div><span class="mp-lbl">Umfang:</span> <strong>${perim.toFixed(1)} m</strong></div>
      </div>
      <label>Arbeitstyp</label>
      <select id="mp-arbeitstyp">
        <option value="vorplatz">Vorplatz / Terrasse</option>
        <option value="zufahrt">Zufahrt</option>
        <option value="mauer">Gartenmauer / Stützmauer</option>
        <option value="entwaesserung">Entwässerung</option>
        <option value="pool">Pool / Teich Aushub</option>
        <option value="hangsicherung">Hangsicherung</option>
        <option value="umgebung">Umgebungsarbeiten</option>
      </select>
      <label>Material</label>
      <select id="mp-material">
        <option value="pflastersteine">Betonpflastersteine</option>
        <option value="naturstein">Naturstein</option>
        <option value="beton">Betonplatten</option>
        <option value="asphalt">Asphalt</option>
        <option value="kies">Kies / Splitt</option>
        <option value="sickerbelag">Sickerbelag</option>
      </select>
      <label>Aushubtiefe (m)</label>
      <input type="number" id="mp-tiefe" value="0.30" step="0.05" min="0.1" max="2.0">
      <div class="mp-btn-row">
        <button class="mp-btn-primary" onclick="MarketplaceModule._calcKV(${area.toFixed(1)}, ${perim.toFixed(1)})">Kostenvoranschlag berechnen</button>
        <button class="mp-btn-cancel" onclick="MarketplaceModule.cleanup()">Abbrechen</button>
      </div>
    `;
    dialog.dataset.ring = JSON.stringify(ring);
    document.body.appendChild(dialog);
  }

  // ── KV berechnen ──
  async function _calcKV(area, perim) {
    const arbeitstyp = document.getElementById('mp-arbeitstyp').value;
    const material = document.getElementById('mp-material').value;
    const tiefe = parseFloat(document.getElementById('mp-tiefe').value) || 0.3;

    try {
      const res = await fetch(API_BASE + '/marketplace/kv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ arbeitstyp, material, flaeche_m2: area, umfang_m: perim, tiefe_m: tiefe })
      });
      const data = await res.json();
      kvData = data;
      showKVResult(data, area, perim, material, arbeitstyp);
    } catch (e) {
      // Fallback: lokale Berechnung
      const kv = localKV(arbeitstyp, material, area, perim, tiefe);
      kvData = kv;
      showKVResult(kv, area, perim, material, arbeitstyp);
    }
  }

  // ── Lokaler Fallback-KV ──
  function localKV(typ, material, area, perim, tiefe) {
    const preise = {
      pflastersteine: 130, naturstein: 275, beton: 110, asphalt: 80, kies: 55, sickerbelag: 130
    };
    const belagPreis = preise[material] || 120;
    const positionen = [
      { pos: 'Aushub ' + (tiefe*100).toFixed(0) + 'cm', menge: (area * tiefe).toFixed(1), einheit: 'm³', ep: 100, total: Math.round(area * tiefe * 100) },
      { pos: 'Entsorgung Altbelag', menge: (area * tiefe).toFixed(1), einheit: 'm³', ep: 60, total: Math.round(area * tiefe * 60) },
      { pos: 'Kieskoffer 25cm', menge: (area * 0.25).toFixed(1), einheit: 'm³', ep: 140, total: Math.round(area * 0.25 * 140) },
      { pos: 'Splittbett / Planie', menge: area.toFixed(1), einheit: 'm²', ep: 10, total: Math.round(area * 10) },
      { pos: material.charAt(0).toUpperCase() + material.slice(1) + ' verlegen', menge: area.toFixed(1), einheit: 'm²', ep: belagPreis, total: Math.round(area * belagPreis) },
      { pos: 'Randabschlüsse', menge: perim.toFixed(1), einheit: 'lfm', ep: 60, total: Math.round(perim * 60) },
      { pos: 'Verdichtung / Feinplanie', menge: area.toFixed(1), einheit: 'm²', ep: 10, total: Math.round(area * 10) },
    ];
    const total = positionen.reduce((s, p) => s + p.total, 0);
    return { positionen, total, arbeitstyp: typ, material };
  }

  // ── KV Ergebnis anzeigen ──
  function showKVResult(data, area, perim, material, arbeitstyp) {
    const dialog = document.getElementById('mp-kv-dialog');
    if (dialog) dialog.remove();

    const materialLabel = { pflastersteine: 'Betonpflastersteine', naturstein: 'Naturstein', beton: 'Betonplatten', asphalt: 'Asphalt', kies: 'Kies/Splitt', sickerbelag: 'Sickerbelag' };
    const positionen = data.positionen || data.positions || [];
    const total = data.total || data.total_chf || positionen.reduce((s,p) => s + (p.total || p.total_chf || 0), 0);

    const panel = document.createElement('div');
    panel.id = 'mp-kv-result';
    panel.className = 'mp-kv-panel';
    panel.innerHTML = `
      <div class="mp-kv-header">
        <h3>Automatischer Kostenvoranschlag</h3>
        <button class="mp-close" onclick="document.getElementById('mp-kv-result').remove()">&times;</button>
      </div>
      <div class="mp-kv-meta">
        <span>Fläche: <strong>${area.toFixed(1)} m²</strong></span>
        <span>Material: <strong>${materialLabel[material] || material}</strong></span>
      </div>
      <table class="mp-kv-table">
        <thead><tr><th>Position</th><th>Menge</th><th>EP</th><th style="text-align:right">Total CHF</th></tr></thead>
        <tbody>
          ${positionen.map((p, i) => `
            <tr>
              <td>${p.pos || p.position || p.beschreibung || ('Pos ' + (i+1))}</td>
              <td>${p.menge || p.quantity || ''} ${p.einheit || p.unit || ''}</td>
              <td>${p.ep || p.unit_price || ''}</td>
              <td style="text-align:right;font-weight:600">${formatNumber(Math.round(p.total || p.total_chf || 0))}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr class="mp-kv-total">
            <td colspan="3"><strong>Richtwert Total</strong></td>
            <td style="text-align:right"><strong>CHF ${formatNumber(Math.round(total))}</strong></td>
          </tr>
          <tr><td colspan="4" style="font-size:10px;color:#94A3B8;padding-top:4px;">± 20%, exkl. MwSt. — Richtwert basierend auf Durchschnittspreisen</td></tr>
        </tfoot>
      </table>
      <div class="mp-kv-actions">
        <button class="mp-btn-primary" onclick="MarketplaceModule._showAnfrageForm()">Offerten anfragen</button>
        <button class="mp-btn-cancel" onclick="MarketplaceModule.cleanup()">Abbrechen</button>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // ── Anfrage-Formular ──
  function _showAnfrageForm() {
    const kvPanel = document.getElementById('mp-kv-result');
    if (kvPanel) kvPanel.remove();

    const form = document.createElement('div');
    form.id = 'mp-anfrage-form';
    form.className = 'mp-dialog';
    form.innerHTML = `
      <h3>Offerten anfragen</h3>
      <p style="font-size:11px;color:#64748B;margin-bottom:12px;">Ihre Anfrage wird an Bauunternehmer in Ihrer Region gesendet.</p>
      <label>Titel</label>
      <input type="text" id="mp-titel" placeholder="z.B. Vorplatz neu belegen" value="${kvData?.arbeitstyp ? kvData.arbeitstyp.charAt(0).toUpperCase() + kvData.arbeitstyp.slice(1) : ''}">
      <label>Ihr Name</label>
      <input type="text" id="mp-name" placeholder="Vor- und Nachname">
      <label>E-Mail</label>
      <input type="email" id="mp-email" placeholder="ihre@email.ch">
      <label>Telefon</label>
      <input type="tel" id="mp-tel" placeholder="079 123 45 67">
      <label>Gewünschter Zeitraum</label>
      <div style="display:flex;gap:8px;">
        <input type="date" id="mp-von" style="flex:1">
        <input type="date" id="mp-bis" style="flex:1">
      </div>
      <label>Bemerkungen</label>
      <textarea id="mp-bemerkungen" rows="2" style="width:100%;padding:6px 10px;border:1px solid #E2E8F0;border-radius:6px;font-family:inherit;font-size:12px;" placeholder="Spezielle Wünsche..."></textarea>
      <div class="mp-btn-row">
        <button class="mp-btn-primary" onclick="MarketplaceModule._submitAnfrage()">Anfrage senden</button>
        <button class="mp-btn-cancel" onclick="MarketplaceModule.cleanup()">Abbrechen</button>
      </div>
    `;
    document.body.appendChild(form);
  }

  // ── Anfrage senden ──
  async function _submitAnfrage() {
    const dialog = document.getElementById('mp-kv-dialog');
    const ring = drawPoints.length >= 3 ? [...drawPoints, drawPoints[0]] : null;
    if (!ring) { alert('Bitte zuerst eine Fläche zeichnen.'); return; }

    const body = {
      titel: document.getElementById('mp-titel')?.value || 'Neue Anfrage',
      arbeitstyp: kvData?.arbeitstyp || 'vorplatz',
      material: kvData?.material || 'pflastersteine',
      geometry: { type: 'Polygon', coordinates: [ring] },
      eigentuemer_name: document.getElementById('mp-name')?.value || '',
      eigentuemer_email: document.getElementById('mp-email')?.value || '',
      eigentuemer_tel: document.getElementById('mp-tel')?.value || '',
      zeitraum_von: document.getElementById('mp-von')?.value || null,
      zeitraum_bis: document.getElementById('mp-bis')?.value || null,
      tiefe_m: 0.3,
    };

    try {
      const res = await fetch(API_BASE + '/marketplace/anfragen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      cleanup();
      showToast('Anfrage gesendet!', `Richt-KV: CHF ${formatNumber(Math.round(data.richt_kv_chf || kvData?.total || 0))}. Bauunternehmer werden benachrichtigt.`, 'success');
    } catch (e) {
      cleanup();
      showToast('Anfrage gespeichert (Demo)', 'Im Demo-Modus wird die Anfrage lokal verarbeitet.', 'info');
    }
  }

  // ── Anfragen-Feed (Bauunternehmer-Sicht) ──
  async function showAnfragenFeed() {
    if (typeof STATIC_MODE !== 'undefined' && STATIC_MODE) { showComingSoon('Marketplace Anfragen-Feed'); return; }
    try {
      const res = await fetch(API_BASE + '/marketplace/anfragen');
      const data = await res.json();
      const anfragen = data.anfragen || data.features || data || [];
      renderAnfragenList(anfragen);
    } catch (e) {
      renderAnfragenList([
        { anfrage_id: 1, titel: 'Vorplatz Pflastersteine', flaeche_m2: 45, material: 'pflastersteine', richt_kv_chf: 12165, status: 'offen' },
        { anfrage_id: 2, titel: 'Gartenmauer Naturstein', flaeche_m2: 12, material: 'naturstein', richt_kv_chf: 8400, status: 'offen' },
      ]);
    }
  }

  function renderAnfragenList(anfragen) {
    const panel = document.querySelector('.detail-panel') || createDetailPanel();
    panel.classList.add('open');
    panel.innerHTML = `
      <div class="detail-header">
        <h3>Auftragsanfragen in Ihrer Region</h3>
        <button class="detail-close" onclick="this.closest('.detail-panel').classList.remove('open')">&times;</button>
      </div>
      <div style="padding:12px;">
        ${anfragen.length === 0 ? '<p style="color:#94A3B8;font-size:12px;">Keine offenen Anfragen.</p>' : ''}
        ${anfragen.map(a => `
          <div class="mp-anfrage-card" onclick="MarketplaceModule.showVergleich(${a.anfrage_id})">
            <div class="mp-ac-header">
              <strong>${a.titel || 'Anfrage'}</strong>
              <span class="mp-ac-badge ${a.status === 'offen' ? 'open' : 'closed'}">${a.status || 'offen'}</span>
            </div>
            <div class="mp-ac-meta">
              ${a.flaeche_m2 ? a.flaeche_m2.toFixed(0) + ' m²' : ''} · ${a.material || ''} · Richt-KV CHF ${formatNumber(Math.round(a.richt_kv_chf || 0))}
            </div>
            <button class="mp-btn-small" onclick="event.stopPropagation(); MarketplaceModule._showOfferteForm(${a.anfrage_id})">Offerte abgeben</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function createDetailPanel() {
    let panel = document.querySelector('.detail-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'detail-panel';
      document.body.appendChild(panel);
    }
    return panel;
  }

  // ── Offerte abgeben ──
  function _showOfferteForm(anfrageId) {
    currentAnfrageId = anfrageId;
    const form = document.createElement('div');
    form.id = 'mp-offerte-form';
    form.className = 'mp-dialog';
    form.innerHTML = `
      <h3>Offerte abgeben</h3>
      <label>Firmenname</label>
      <input type="text" id="off-firma" placeholder="Ihr Unternehmen">
      <label>Ort</label>
      <input type="text" id="off-ort" placeholder="z.B. Grenchen">
      <label>Pauschalpreis (CHF)</label>
      <input type="number" id="off-preis" placeholder="z.B. 11500">
      <label>Verfügbar ab</label>
      <input type="date" id="off-ab">
      <label>Dauer (Tage)</label>
      <input type="number" id="off-dauer" value="5" min="1">
      <label>Bemerkungen</label>
      <textarea id="off-bem" rows="2" style="width:100%;padding:6px 10px;border:1px solid #E2E8F0;border-radius:6px;font-family:inherit;font-size:12px;"></textarea>
      <div class="mp-btn-row">
        <button class="mp-btn-primary" onclick="MarketplaceModule._submitOfferte()">Offerte senden</button>
        <button class="mp-btn-cancel" onclick="document.getElementById('mp-offerte-form').remove()">Abbrechen</button>
      </div>
    `;
    document.body.appendChild(form);
  }

  async function _submitOfferte() {
    const body = {
      firma_name: document.getElementById('off-firma')?.value || 'Demo Firma',
      firma_ort: document.getElementById('off-ort')?.value || 'Grenchen',
      preis_chf: parseFloat(document.getElementById('off-preis')?.value) || 10000,
      verfuegbar_ab: document.getElementById('off-ab')?.value || null,
      dauer_tage: parseInt(document.getElementById('off-dauer')?.value) || 5,
      bemerkungen: document.getElementById('off-bem')?.value || '',
    };

    try {
      await fetch(API_BASE + `/marketplace/anfragen/${currentAnfrageId}/offerte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) { /* Demo-Modus */ }

    document.getElementById('mp-offerte-form')?.remove();
    showToast('Offerte gesendet', `CHF ${formatNumber(body.preis_chf)} für Anfrage #${currentAnfrageId}`, 'success');
  }

  // ── Offert-Vergleich ──
  async function showVergleich(anfrageId) {
    let offerten = [];
    try {
      const res = await fetch(API_BASE + `/marketplace/anfragen/${anfrageId}/vergleich`);
      const data = await res.json();
      offerten = data.offerten || data || [];
    } catch (e) {
      offerten = [
        { firma_name: 'Müller Bau AG', preis_chf: 11500, bewertung: 4.2, distanz_km: 8, score: 82 },
        { firma_name: 'Meier Tiefbau', preis_chf: 13200, bewertung: 4.8, distanz_km: 3, score: 78 },
        { firma_name: 'Schmidt GmbH', preis_chf: 10800, bewertung: 3.5, distanz_km: 22, score: 71 },
      ];
    }

    const overlay = document.createElement('div');
    overlay.id = 'mp-vergleich';
    overlay.className = 'mp-vergleich-panel';
    overlay.innerHTML = `
      <div class="mp-kv-header">
        <h3>Offert-Vergleich — Anfrage #${anfrageId}</h3>
        <button class="mp-close" onclick="document.getElementById('mp-vergleich').remove()">&times;</button>
      </div>
      <table class="mp-kv-table">
        <thead><tr><th>Firma</th><th style="text-align:right">Preis CHF</th><th>Bewertung</th><th>Distanz</th><th>Score</th></tr></thead>
        <tbody>
          ${offerten.map((o, i) => `
            <tr${i === 0 ? ' style="background:rgba(34,197,94,0.08)"' : ''}>
              <td><strong>${o.firma_name}</strong></td>
              <td style="text-align:right;font-family:'JetBrains Mono',monospace">${formatNumber(Math.round(o.preis_chf))}</td>
              <td>${'★'.repeat(Math.round(o.bewertung || 0))}${'☆'.repeat(5 - Math.round(o.bewertung || 0))} ${(o.bewertung||0).toFixed(1)}</td>
              <td>${(o.distanz_km||0).toFixed(0)} km</td>
              <td><strong style="color:${(o.score||0) >= 80 ? '#22C55E' : (o.score||0) >= 60 ? '#EAB308' : '#EF4444'}">${Math.round(o.score||0)}%</strong>${i === 0 ? ' ✓' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="mp-kv-actions">
        <button class="mp-btn-primary" onclick="MarketplaceModule._erteileAuftrag(${anfrageId})">Auftrag erteilen an Bestplatzierten</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function _erteileAuftrag(anfrageId) {
    document.getElementById('mp-vergleich')?.remove();
    showToast('Auftrag erteilt!', `Anfrage #${anfrageId} wurde vergeben. Der Bauunternehmer wird benachrichtigt.`, 'success');
  }

  // ── Anfragen auf der Karte ──
  async function showAnfragenAufKarte() {
    if (typeof STATIC_MODE !== 'undefined' && STATIC_MODE) { showComingSoon('Marketplace Kartenansicht'); return; }
    try {
      const res = await fetch(API_BASE + '/marketplace/anfragen');
      const data = await res.json();
      const geojson = data.type === 'FeatureCollection' ? data : {
        type: 'FeatureCollection',
        features: (data.anfragen || data || []).filter(a => a.geometry).map(a => ({
          type: 'Feature', geometry: a.geometry, properties: a
        }))
      };

      if (!map.getSource('mp-anfragen')) {
        map.addSource('mp-anfragen', { type: 'geojson', data: geojson });
        map.addLayer({ id: 'mp-anfragen-fill', type: 'fill', source: 'mp-anfragen', paint: { 'fill-color': 'rgba(234,179,8,0.15)' }});
        map.addLayer({ id: 'mp-anfragen-line', type: 'line', source: 'mp-anfragen', paint: { 'line-color': '#EAB308', 'line-width': 2 }});
      } else {
        map.getSource('mp-anfragen').setData(geojson);
      }
    } catch (e) {
      console.warn('[MARKETPLACE] Anfragen nicht geladen:', e);
    }
  }

  // ── Toast ──
  function showToast(title, msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `tracking-toast ${type === 'success' ? 'info' : type === 'alert' ? 'alert' : 'info'}`;
    toast.innerHTML = `
      <div class="toast-icon">${type === 'success' ? '✅' : type === 'alert' ? '🚨' : 'ℹ️'}</div>
      <div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    `;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 500); }, 5000);
  }

  // ── Cleanup ──
  function cleanup() {
    mode = 'none';
    drawPoints = [];
    map.getCanvas().style.cursor = '';
    map.off('click', onDrawClick);
    map.off('dblclick', onDrawDblClick);
    removeBanner();
    ['mp-kv-dialog', 'mp-kv-result', 'mp-anfrage-form', 'mp-offerte-form', 'mp-vergleich'].forEach(id => {
      document.getElementById(id)?.remove();
    });
    const src = map.getSource('mp-draw');
    if (src) src.setData({ type: 'FeatureCollection', features: [] });
  }

  function removeBanner() {
    document.getElementById('mp-banner')?.remove();
  }

  return {
    startAnfrage, showAnfragenFeed, showVergleich, showAnfragenAufKarte, cleanup,
    _calcKV, _showAnfrageForm, _submitAnfrage, _showOfferteForm, _submitOfferte, _erteileAuftrag
  };
})();
