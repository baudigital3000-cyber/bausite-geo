// ============================================
// BAUSITE Geo — Rapport-Modul
// Tagesrapport, Fotodokumentation, Dashboard, Export
// Schweizer Tiefbau-Rapportwesen
// ============================================

(function () {
  'use strict';

  // ── Constants ──
  const LS_RAPPORTE = 'bausite_rapporte';
  const LS_PHOTOS = 'bausite_photos';
  const WETTER_OPTIONS = ['Sonnig', 'Bewölkt', 'Regen', 'Schnee', 'Frost'];
  const FUNKTIONEN = ['Polier', 'Maschinist', 'Hilfsarbeiter'];
  const FOTO_KATEGORIEN = ['Graben', 'Leitung', 'Schaden', 'Sonstiges'];

  // ── Utility ──
  function uid() {
    return 'R-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatNum(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function loadRapporte() {
    try { return JSON.parse(localStorage.getItem(LS_RAPPORTE)) || []; }
    catch { return []; }
  }

  function saveRapporte(arr) {
    localStorage.setItem(LS_RAPPORTE, JSON.stringify(arr));
  }

  function loadPhotos() {
    try { return JSON.parse(localStorage.getItem(LS_PHOTOS)) || []; }
    catch { return []; }
  }

  function savePhotos(arr) {
    localStorage.setItem(LS_PHOTOS, JSON.stringify(arr));
  }

  function getBaustellen() {
    return typeof BAUSTELLEN !== 'undefined' ? BAUSTELLEN : [];
  }

  function baustelleName(id) {
    const bs = getBaustellen().find(b => b.id === id);
    return bs ? bs.name : id;
  }

  // Track map markers for cleanup
  let _photoMarkers = [];

  // ── Modal helpers ──
  function createOverlay() {
    const ov = document.createElement('div');
    ov.className = 'rapport-overlay';
    ov.addEventListener('click', function (e) {
      if (e.target === ov) ov.remove();
    });
    return ov;
  }

  function createModal(title, bodyHTML, footerHTML) {
    const ov = createOverlay();
    ov.innerHTML = `
      <div class="rapport-modal">
        <div class="rapport-modal-header">
          <h2>${title}</h2>
          <button class="rapport-close" onclick="this.closest('.rapport-overlay').remove()">&times;</button>
        </div>
        <div class="rapport-modal-body">${bodyHTML}</div>
        ${footerHTML ? `<div class="rapport-modal-footer">${footerHTML}</div>` : ''}
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }

  // ════════════════════════════════════════════
  // 1. TAGESRAPPORT-FORMULAR
  // ════════════════════════════════════════════

  function showRapportForm(baustelleId) {
    const bs = getBaustellen();
    const bsOptions = bs.map(b =>
      `<option value="${b.id}" ${b.id === baustelleId ? 'selected' : ''}>${esc(b.name)} (${b.id})</option>`
    ).join('');

    const wetterOpts = WETTER_OPTIONS.map(w => `<option value="${w}">${w}</option>`).join('');
    const funktionenOpts = FUNKTIONEN.map(f => `<option value="${f}">${f}</option>`).join('');

    const body = `
      <div class="rapport-section-title">// Allgemein</div>
      <div class="rapport-form-row">
        <div class="rapport-form-group">
          <label>Datum</label>
          <input type="date" class="rapport-input" id="rap-datum" value="${today()}">
        </div>
        <div class="rapport-form-group">
          <label>Baustelle</label>
          <select class="rapport-select" id="rap-baustelle">${bsOptions}</select>
        </div>
      </div>
      <div class="rapport-form-row">
        <div class="rapport-form-group">
          <label>Wetter</label>
          <select class="rapport-select" id="rap-wetter">${wetterOpts}</select>
        </div>
        <div class="rapport-form-group">
          <label>Temperatur (&deg;C)</label>
          <input type="number" class="rapport-input" id="rap-temperatur" placeholder="z.B. 12" step="0.5">
        </div>
      </div>
      <div class="rapport-form-row">
        <div class="rapport-form-group">
          <label>Arbeitsbeginn</label>
          <input type="time" class="rapport-input" id="rap-beginn" value="07:00">
        </div>
        <div class="rapport-form-group">
          <label>Arbeitsende</label>
          <input type="time" class="rapport-input" id="rap-ende" value="17:00">
        </div>
      </div>

      <div class="rapport-section-title">// Personal</div>
      <div class="rapport-table-wrap">
        <table class="rapport-table" id="rap-personal-table">
          <thead>
            <tr><th>Name</th><th>Funktion</th><th>Stunden</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="text" placeholder="Name"></td>
              <td><select>${funktionenOpts}</select></td>
              <td><input type="number" step="0.5" placeholder="8.5" style="width:70px"></td>
              <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="rapport-add-row" onclick="window._rapportAddRow('personal')">+ Zeile</button>

      <div class="rapport-section-title">// Maschinen</div>
      <div class="rapport-table-wrap">
        <table class="rapport-table" id="rap-maschinen-table">
          <thead>
            <tr><th>Maschine</th><th>Stunden</th><th>Bemerkung</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="text" placeholder="Bagger CAT 320"></td>
              <td><input type="number" step="0.5" placeholder="8" style="width:70px"></td>
              <td><input type="text" placeholder="Bemerkung"></td>
              <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="rapport-add-row" onclick="window._rapportAddRow('maschinen')">+ Zeile</button>

      <div class="rapport-section-title">// Leistungen</div>
      <div class="rapport-table-wrap">
        <table class="rapport-table" id="rap-leistung-table">
          <thead>
            <tr><th>NPK-Nr</th><th>Beschreibung</th><th>Einheit</th><th>Menge</th><th></th></tr>
          </thead>
          <tbody>
            <tr>
              <td><input type="text" placeholder="211.111" style="width:80px"></td>
              <td><input type="text" placeholder="Aushub Graben"></td>
              <td><input type="text" placeholder="m3" style="width:50px"></td>
              <td><input type="number" step="0.1" placeholder="12.5" style="width:70px"></td>
              <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button class="rapport-add-row" onclick="window._rapportAddRow('leistung')">+ Zeile</button>

      <div class="rapport-section-title">// Besondere Vorkommnisse</div>
      <div class="rapport-form-group">
        <textarea class="rapport-textarea" id="rap-vorkommnisse" placeholder="z.B. Wassereinbruch bei Schacht A3, Arbeit unterbrochen 10:30–11:15..."></textarea>
      </div>

      <div class="rapport-section-title">// Unterschrift</div>
      <div class="rapport-signature-wrap">
        <canvas class="rapport-signature-canvas" id="rap-signature" width="300" height="100"></canvas>
        <button class="rapport-signature-clear" onclick="window._rapportClearSignature()">Löschen</button>
      </div>
    `;

    const footer = `
      <button class="rapport-btn rapport-btn-ghost" onclick="this.closest('.rapport-overlay').remove()">Abbrechen</button>
      <button class="rapport-btn rapport-btn-primary" onclick="window._rapportSave()">Rapport speichern</button>
    `;

    const ov = createModal('Tagesrapport erfassen', body, footer);

    // Initialize signature canvas
    setTimeout(() => initSignatureCanvas(), 50);
  }

  // ── Add table rows ──
  window._rapportAddRow = function (type) {
    const funktionenOpts = FUNKTIONEN.map(f => `<option value="${f}">${f}</option>`).join('');
    let tr;
    if (type === 'personal') {
      tr = `<tr>
        <td><input type="text" placeholder="Name"></td>
        <td><select>${funktionenOpts}</select></td>
        <td><input type="number" step="0.5" placeholder="8.5" style="width:70px"></td>
        <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
      </tr>`;
      document.querySelector('#rap-personal-table tbody').insertAdjacentHTML('beforeend', tr);
    } else if (type === 'maschinen') {
      tr = `<tr>
        <td><input type="text" placeholder="Maschine"></td>
        <td><input type="number" step="0.5" placeholder="8" style="width:70px"></td>
        <td><input type="text" placeholder="Bemerkung"></td>
        <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
      </tr>`;
      document.querySelector('#rap-maschinen-table tbody').insertAdjacentHTML('beforeend', tr);
    } else if (type === 'leistung') {
      tr = `<tr>
        <td><input type="text" placeholder="NPK-Nr" style="width:80px"></td>
        <td><input type="text" placeholder="Beschreibung"></td>
        <td><input type="text" placeholder="m3" style="width:50px"></td>
        <td><input type="number" step="0.1" placeholder="0" style="width:70px"></td>
        <td><button class="row-remove" onclick="this.closest('tr').remove()">&times;</button></td>
      </tr>`;
      document.querySelector('#rap-leistung-table tbody').insertAdjacentHTML('beforeend', tr);
    }
  };

  // ── Signature Canvas ──
  let _sigCtx = null;
  let _sigDrawing = false;

  function initSignatureCanvas() {
    const canvas = document.getElementById('rap-signature');
    if (!canvas) return;
    _sigCtx = canvas.getContext('2d');
    _sigCtx.strokeStyle = '#000';
    _sigCtx.lineWidth = 2;
    _sigCtx.lineCap = 'round';
    _sigCtx.lineJoin = 'round';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if (e.touches) {
        return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
      }
      return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    }

    canvas.addEventListener('mousedown', function (e) {
      _sigDrawing = true;
      const p = getPos(e);
      _sigCtx.beginPath();
      _sigCtx.moveTo(p.x, p.y);
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!_sigDrawing) return;
      const p = getPos(e);
      _sigCtx.lineTo(p.x, p.y);
      _sigCtx.stroke();
    });
    canvas.addEventListener('mouseup', function () { _sigDrawing = false; });
    canvas.addEventListener('mouseleave', function () { _sigDrawing = false; });

    // Touch events
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      _sigDrawing = true;
      const p = getPos(e);
      _sigCtx.beginPath();
      _sigCtx.moveTo(p.x, p.y);
    }, { passive: false });
    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (!_sigDrawing) return;
      const p = getPos(e);
      _sigCtx.lineTo(p.x, p.y);
      _sigCtx.stroke();
    }, { passive: false });
    canvas.addEventListener('touchend', function () { _sigDrawing = false; });
  }

  window._rapportClearSignature = function () {
    const canvas = document.getElementById('rap-signature');
    if (canvas && _sigCtx) {
      _sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // ── Save rapport ──
  window._rapportSave = function () {
    const datum = document.getElementById('rap-datum').value;
    const baustelleId = document.getElementById('rap-baustelle').value;
    const wetter = document.getElementById('rap-wetter').value;
    const temperatur = document.getElementById('rap-temperatur').value;
    const beginn = document.getElementById('rap-beginn').value;
    const ende = document.getElementById('rap-ende').value;
    const vorkommnisse = document.getElementById('rap-vorkommnisse').value;

    // Collect personal
    const personal = [];
    document.querySelectorAll('#rap-personal-table tbody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input, select');
      if (inputs[0].value.trim()) {
        personal.push({
          name: inputs[0].value.trim(),
          funktion: inputs[1].value,
          stunden: parseFloat(inputs[2].value) || 0
        });
      }
    });

    // Collect maschinen
    const maschinen = [];
    document.querySelectorAll('#rap-maschinen-table tbody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs[0].value.trim()) {
        maschinen.push({
          maschine: inputs[0].value.trim(),
          stunden: parseFloat(inputs[1].value) || 0,
          bemerkung: inputs[2].value.trim()
        });
      }
    });

    // Collect leistung
    const leistung = [];
    document.querySelectorAll('#rap-leistung-table tbody tr').forEach(tr => {
      const inputs = tr.querySelectorAll('input');
      if (inputs[1].value.trim()) {
        leistung.push({
          npk: inputs[0].value.trim(),
          beschreibung: inputs[1].value.trim(),
          einheit: inputs[2].value.trim(),
          menge: parseFloat(inputs[3].value) || 0
        });
      }
    });

    // Signature
    const canvas = document.getElementById('rap-signature');
    let signatur = '';
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imgData.data.some((v, i) => i % 4 === 3 && v > 0);
      if (hasContent) {
        signatur = canvas.toDataURL('image/png');
      }
    }

    const rapport = {
      id: uid(),
      datum,
      baustelleId,
      wetter,
      temperatur: temperatur ? parseFloat(temperatur) : null,
      beginn,
      ende,
      personal,
      maschinen,
      leistung,
      vorkommnisse,
      signatur,
      erstellt: new Date().toISOString()
    };

    const rapporte = loadRapporte();
    rapporte.push(rapport);
    saveRapporte(rapporte);

    // Close modal
    document.querySelector('.rapport-overlay').remove();

    // Show confirmation
    showRapportList();
  };

  // ════════════════════════════════════════════
  // 2. RAPPORT-LISTE
  // ════════════════════════════════════════════

  function showRapportList() {
    const rapporte = loadRapporte();

    let listHTML;
    if (rapporte.length === 0) {
      listHTML = `
        <div class="rapport-empty">
          <div class="rapport-empty-icon">&#128203;</div>
          <div class="rapport-empty-text">Keine Rapporte vorhanden</div>
          <div class="rapport-empty-hint">Erstelle deinen ersten Tagesrapport.</div>
        </div>`;
    } else {
      listHTML = rapporte
        .sort((a, b) => b.datum.localeCompare(a.datum))
        .map(r => {
          const totalStd = r.personal.reduce((s, p) => s + p.stunden, 0);
          return `
            <div class="rapport-list-item" onclick="window._rapportView('${r.id}')">
              <div class="rapport-list-meta">
                <span class="rapport-list-date">${r.datum} &mdash; ${r.wetter}</span>
                <span class="rapport-list-baustelle">${esc(baustelleName(r.baustelleId))} &middot; ${r.personal.length} Pers. &middot; ${totalStd}h</span>
              </div>
              <div class="rapport-list-actions">
                <button title="PDF drucken" onclick="event.stopPropagation(); window.RapportModule.exportRapportPDF('${r.id}')">&#128424;</button>
                <button title="Löschen" onclick="event.stopPropagation(); window._rapportDelete('${r.id}')">&#128465;</button>
              </div>
            </div>`;
        }).join('');
    }

    const body = `
      <div style="margin-bottom: 16px;">
        <button class="rapport-btn rapport-btn-primary" onclick="document.querySelector('.rapport-overlay').remove(); window.RapportModule.showRapportForm();">+ Neuer Rapport</button>
      </div>
      ${listHTML}
    `;

    createModal('Tagesrapporte', body, '');
  }

  window._rapportView = function (id) {
    const rapporte = loadRapporte();
    const r = rapporte.find(x => x.id === id);
    if (!r) return;

    // Close current modal
    const existing = document.querySelector('.rapport-overlay');
    if (existing) existing.remove();

    const personalRows = r.personal.map(p =>
      `<tr><td>${esc(p.name)}</td><td>${esc(p.funktion)}</td><td>${p.stunden}</td></tr>`
    ).join('');

    const maschinenRows = r.maschinen.map(m =>
      `<tr><td>${esc(m.maschine)}</td><td>${m.stunden}</td><td>${esc(m.bemerkung)}</td></tr>`
    ).join('');

    const leistungRows = r.leistung.map(l =>
      `<tr><td>${esc(l.npk)}</td><td>${esc(l.beschreibung)}</td><td>${esc(l.einheit)}</td><td>${l.menge}</td></tr>`
    ).join('');

    const body = `
      <div class="rapport-section-title">// Allgemein</div>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:13px; margin-bottom:16px;">
        <div><strong>Datum:</strong> ${r.datum}</div>
        <div><strong>Baustelle:</strong> ${esc(baustelleName(r.baustelleId))}</div>
        <div><strong>Wetter:</strong> ${r.wetter} ${r.temperatur !== null ? r.temperatur + '°C' : ''}</div>
        <div><strong>Arbeitszeit:</strong> ${r.beginn} &ndash; ${r.ende}</div>
      </div>

      ${r.personal.length ? `
      <div class="rapport-section-title">// Personal (${r.personal.length})</div>
      <table class="rapport-table">
        <thead><tr><th>Name</th><th>Funktion</th><th>Stunden</th></tr></thead>
        <tbody>${personalRows}</tbody>
      </table>` : ''}

      ${r.maschinen.length ? `
      <div class="rapport-section-title">// Maschinen (${r.maschinen.length})</div>
      <table class="rapport-table">
        <thead><tr><th>Maschine</th><th>Stunden</th><th>Bemerkung</th></tr></thead>
        <tbody>${maschinenRows}</tbody>
      </table>` : ''}

      ${r.leistung.length ? `
      <div class="rapport-section-title">// Leistungen (${r.leistung.length})</div>
      <table class="rapport-table">
        <thead><tr><th>NPK-Nr</th><th>Beschreibung</th><th>Einheit</th><th>Menge</th></tr></thead>
        <tbody>${leistungRows}</tbody>
      </table>` : ''}

      ${r.vorkommnisse ? `
      <div class="rapport-section-title">// Vorkommnisse</div>
      <p style="font-size:13px; line-height:1.6; white-space:pre-wrap;">${esc(r.vorkommnisse)}</p>` : ''}

      ${r.signatur ? `
      <div class="rapport-section-title">// Unterschrift</div>
      <img src="${r.signatur}" style="border:1px solid #E2E8F0; border-radius:8px;" alt="Unterschrift">` : ''}
    `;

    const footer = `
      <button class="rapport-btn rapport-btn-ghost" onclick="this.closest('.rapport-overlay').remove(); window.RapportModule.showRapportList();">Zurück</button>
      <button class="rapport-btn rapport-btn-secondary" onclick="window.RapportModule.exportRapportPDF('${r.id}')">PDF drucken</button>
    `;

    createModal('Rapport ' + r.datum, body, footer);
  };

  window._rapportDelete = function (id) {
    if (!confirm('Rapport wirklich löschen?')) return;
    let rapporte = loadRapporte();
    rapporte = rapporte.filter(r => r.id !== id);
    saveRapporte(rapporte);
    // Refresh list
    const existing = document.querySelector('.rapport-overlay');
    if (existing) existing.remove();
    showRapportList();
  };

  // ════════════════════════════════════════════
  // 3. FOTO-DOKUMENTATION
  // ════════════════════════════════════════════

  let _mapPickCallback = null;
  let _mapPickBanner = null;

  function showPhotoUpload() {
    const bs = getBaustellen();
    const bsOptions = bs.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    const katOptions = FOTO_KATEGORIEN.map(k => `<option value="${k}">${k}</option>`).join('');

    const photos = loadPhotos();
    const thumbsHTML = photos.length ? photos.map(p => `
      <div class="rapport-photo-thumb" onclick="window._photoLightbox('${p.id}')">
        <img src="${p.data}" alt="${esc(p.beschreibung || '')}">
        <div class="rapport-photo-thumb-label">${p.datum} &mdash; ${esc(p.kategorie)}</div>
      </div>
    `).join('') : '';

    const body = `
      <div class="rapport-section-title">// Foto hochladen</div>
      <div class="rapport-photo-dropzone" id="photo-dropzone" onclick="document.getElementById('photo-file-input').click()">
        <div class="rapport-photo-dropzone-icon">&#128247;</div>
        <div class="rapport-photo-dropzone-text">Foto auswählen oder hierher ziehen</div>
        <div class="rapport-photo-dropzone-hint">Kamera-Fotos mit GPS werden automatisch verortet</div>
      </div>
      <input type="file" id="photo-file-input" accept="image/*" capture="environment" style="display:none" onchange="window._photoFileSelected(this)">

      <div id="photo-preview-area" style="display:none; margin-top:16px;">
        <img id="photo-preview-img" style="max-width:100%; max-height:200px; border-radius:8px; margin-bottom:12px;">
        <div class="rapport-form-row">
          <div class="rapport-form-group">
            <label>Datum</label>
            <input type="date" class="rapport-input" id="photo-datum" value="${today()}">
          </div>
          <div class="rapport-form-group">
            <label>Kategorie</label>
            <select class="rapport-select" id="photo-kategorie">${katOptions}</select>
          </div>
        </div>
        <div class="rapport-form-group">
          <label>Baustelle</label>
          <select class="rapport-select" id="photo-baustelle">${bsOptions}</select>
        </div>
        <div class="rapport-form-group">
          <label>Beschreibung</label>
          <input type="text" class="rapport-input" id="photo-beschreibung" placeholder="z.B. Grabenöffnung bei Schacht A3">
        </div>
        <div class="rapport-form-group">
          <label>Position (Koordinaten)</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" class="rapport-input" id="photo-coords" placeholder="Automatisch oder auf Karte klicken" readonly style="flex:1;">
            <button class="rapport-btn rapport-btn-secondary" style="white-space:nowrap;" onclick="window._photoPickOnMap()">Karte</button>
          </div>
        </div>
        <div style="margin-top:12px;">
          <button class="rapport-btn rapport-btn-primary" onclick="window._photoSave()">Foto speichern</button>
        </div>
      </div>

      ${photos.length ? `
      <div class="rapport-section-title" style="margin-top:24px;">// Gespeicherte Fotos (${photos.length})</div>
      <div class="rapport-photo-grid">${thumbsHTML}</div>` : ''}
    `;

    const ov = createModal('Fotodokumentation', body, '');

    // Setup dropzone drag events
    setTimeout(() => {
      const dz = document.getElementById('photo-dropzone');
      if (!dz) return;
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
      dz.addEventListener('drop', e => {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
          handlePhotoFile(e.dataTransfer.files[0]);
        }
      });
    }, 50);
  }

  let _currentPhotoData = null;

  window._photoFileSelected = function (input) {
    if (input.files && input.files[0]) {
      handlePhotoFile(input.files[0]);
    }
  };

  function handlePhotoFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      _currentPhotoData = e.target.result;
      document.getElementById('photo-preview-img').src = _currentPhotoData;
      document.getElementById('photo-preview-area').style.display = 'block';

      // Try to read EXIF GPS
      readExifGPS(file);
    };
    reader.readAsDataURL(file);
  }

  function readExifGPS(file) {
    // Simple EXIF GPS reader for JPEG
    const reader = new FileReader();
    reader.onload = function (e) {
      const view = new DataView(e.target.result);
      try {
        const coords = parseExifGPS(view);
        if (coords) {
          document.getElementById('photo-coords').value = coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
        }
      } catch (ex) {
        // No GPS data or not a JPEG — silently ignore
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function parseExifGPS(view) {
    // Minimal EXIF parser — looks for GPS IFD in JPEG
    if (view.getUint16(0) !== 0xFFD8) return null; // Not JPEG

    let offset = 2;
    while (offset < view.byteLength - 1) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) { // APP1 (EXIF)
        const length = view.getUint16(offset + 2);
        return extractGPSFromExif(view, offset + 4, length);
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  }

  function extractGPSFromExif(view, start, length) {
    // Check EXIF header
    const exifStr = String.fromCharCode(view.getUint8(start), view.getUint8(start + 1),
      view.getUint8(start + 2), view.getUint8(start + 3));
    if (exifStr !== 'Exif') return null;

    const tiffStart = start + 6;
    const bigEndian = view.getUint16(tiffStart) === 0x4D4D;

    function read16(off) { return bigEndian ? view.getUint16(off) : view.getUint16(off, true); }
    function read32(off) { return bigEndian ? view.getUint32(off) : view.getUint32(off, true); }

    // Read IFD0 to find GPS IFD pointer
    const ifd0Offset = tiffStart + read32(tiffStart + 4);
    const ifd0Count = read16(ifd0Offset);
    let gpsOffset = 0;

    for (let i = 0; i < ifd0Count; i++) {
      const entryOffset = ifd0Offset + 2 + i * 12;
      if (entryOffset + 12 > view.byteLength) break;
      const tag = read16(entryOffset);
      if (tag === 0x8825) { // GPS IFD pointer
        gpsOffset = tiffStart + read32(entryOffset + 8);
        break;
      }
    }

    if (!gpsOffset || gpsOffset >= view.byteLength) return null;

    const gpsCount = read16(gpsOffset);
    let latRef = '', lngRef = '', latVals = null, lngVals = null;

    for (let i = 0; i < gpsCount; i++) {
      const entryOff = gpsOffset + 2 + i * 12;
      if (entryOff + 12 > view.byteLength) break;
      const tag = read16(entryOff);

      if (tag === 1) { // GPSLatitudeRef
        latRef = String.fromCharCode(view.getUint8(entryOff + 8));
      } else if (tag === 2) { // GPSLatitude
        latVals = readRationals(view, tiffStart + read32(entryOff + 8), 3, bigEndian);
      } else if (tag === 3) { // GPSLongitudeRef
        lngRef = String.fromCharCode(view.getUint8(entryOff + 8));
      } else if (tag === 4) { // GPSLongitude
        lngVals = readRationals(view, tiffStart + read32(entryOff + 8), 3, bigEndian);
      }
    }

    if (latVals && lngVals) {
      let lat = latVals[0] + latVals[1] / 60 + latVals[2] / 3600;
      let lng = lngVals[0] + lngVals[1] / 60 + lngVals[2] / 3600;
      if (latRef === 'S') lat = -lat;
      if (lngRef === 'W') lng = -lng;
      return { lat, lng };
    }
    return null;
  }

  function readRationals(view, offset, count, bigEndian) {
    const vals = [];
    for (let i = 0; i < count; i++) {
      const o = offset + i * 8;
      if (o + 8 > view.byteLength) break;
      const num = bigEndian ? view.getUint32(o) : view.getUint32(o, true);
      const den = bigEndian ? view.getUint32(o + 4) : view.getUint32(o + 4, true);
      vals.push(den ? num / den : 0);
    }
    return vals;
  }

  // ── Map pick for photo position ──
  window._photoPickOnMap = function () {
    // Close modal temporarily
    const overlay = document.querySelector('.rapport-overlay');
    if (overlay) overlay.style.display = 'none';

    // Show banner
    _mapPickBanner = document.createElement('div');
    _mapPickBanner.className = 'rapport-map-pick-banner';
    _mapPickBanner.textContent = 'Klicke auf die Karte, um die Position zu setzen. ESC zum Abbrechen.';
    document.body.appendChild(_mapPickBanner);

    if (typeof map !== 'undefined') {
      map.getCanvas().style.cursor = 'crosshair';
    }

    _mapPickCallback = function (e) {
      const { lng, lat } = e.lngLat;
      document.getElementById('photo-coords').value = lat.toFixed(6) + ', ' + lng.toFixed(6);

      // Cleanup
      if (typeof map !== 'undefined') {
        map.off('click', _mapPickCallback);
        map.getCanvas().style.cursor = '';
      }
      if (_mapPickBanner) { _mapPickBanner.remove(); _mapPickBanner = null; }
      if (overlay) overlay.style.display = '';
      _mapPickCallback = null;
    };

    if (typeof map !== 'undefined') {
      map.once('click', _mapPickCallback);
    }

    // ESC to cancel
    function onEsc(e) {
      if (e.key === 'Escape') {
        if (typeof map !== 'undefined') {
          map.off('click', _mapPickCallback);
          map.getCanvas().style.cursor = '';
        }
        if (_mapPickBanner) { _mapPickBanner.remove(); _mapPickBanner = null; }
        if (overlay) overlay.style.display = '';
        _mapPickCallback = null;
        document.removeEventListener('keydown', onEsc);
      }
    }
    document.addEventListener('keydown', onEsc);
  };

  // ── Save photo ──
  window._photoSave = function () {
    if (!_currentPhotoData) return;

    const coordsStr = document.getElementById('photo-coords').value;
    let lat = null, lng = null;
    if (coordsStr) {
      const parts = coordsStr.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        lat = parts[0];
        lng = parts[1];
      }
    }

    const photo = {
      id: 'P-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
      datum: document.getElementById('photo-datum').value,
      baustelleId: document.getElementById('photo-baustelle').value,
      kategorie: document.getElementById('photo-kategorie').value,
      beschreibung: document.getElementById('photo-beschreibung').value.trim(),
      lat,
      lng,
      data: _currentPhotoData,
      erstellt: new Date().toISOString()
    };

    const photos = loadPhotos();
    photos.push(photo);
    savePhotos(photos);

    _currentPhotoData = null;

    // Close and reopen
    const existing = document.querySelector('.rapport-overlay');
    if (existing) existing.remove();

    // Add marker to map
    addPhotoMarker(photo);

    showPhotoUpload();
  };

  // ── Photo markers on map ──
  function addPhotoMarker(photo) {
    if (!photo.lat || !photo.lng || typeof map === 'undefined' || typeof maplibregl === 'undefined') return;

    const el = document.createElement('div');
    el.className = 'rapport-photo-marker';
    el.innerHTML = '&#128247;';
    el.addEventListener('click', () => window._photoLightbox(photo.id));

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([photo.lng, photo.lat])
      .addTo(map);

    _photoMarkers.push(marker);
  }

  function refreshPhotoMarkers() {
    // Remove existing markers
    _photoMarkers.forEach(m => m.remove());
    _photoMarkers = [];

    // Add all photos
    loadPhotos().forEach(p => addPhotoMarker(p));
  }

  // ── Lightbox ──
  window._photoLightbox = function (id) {
    const photos = loadPhotos();
    const p = photos.find(x => x.id === id);
    if (!p) return;

    const lb = document.createElement('div');
    lb.className = 'rapport-lightbox';
    lb.addEventListener('click', function (e) {
      if (e.target === lb) lb.remove();
    });

    lb.innerHTML = `
      <div class="rapport-lightbox-content">
        <button class="rapport-lightbox-close" onclick="this.closest('.rapport-lightbox').remove()">&times;</button>
        <img src="${p.data}" alt="${esc(p.beschreibung || '')}">
        <div class="rapport-lightbox-info">
          <h4>${esc(p.beschreibung || 'Ohne Beschreibung')}</h4>
          <p>Datum: ${p.datum} &middot; Kategorie: ${esc(p.kategorie)}</p>
          <p>Baustelle: ${esc(baustelleName(p.baustelleId))}</p>
          ${p.lat && p.lng ? `<p>Position: ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</p>` : '<p>Keine Position</p>'}
        </div>
      </div>`;

    document.body.appendChild(lb);
  };

  // ════════════════════════════════════════════
  // 4. DASHBOARD
  // ════════════════════════════════════════════

  function showDashboard() {
    const rapporte = loadRapporte();
    const photos = loadPhotos();
    const bs = getBaustellen();

    // Aggregate stats per baustelle
    const stats = {};
    bs.forEach(b => {
      stats[b.id] = {
        name: b.name,
        arbeitsstunden: 0,
        maschinenstunden: 0,
        leitungVerlegt: 0,
        rapportCount: 0
      };
    });

    rapporte.forEach(r => {
      if (!stats[r.baustelleId]) {
        stats[r.baustelleId] = {
          name: baustelleName(r.baustelleId),
          arbeitsstunden: 0,
          maschinenstunden: 0,
          leitungVerlegt: 0,
          rapportCount: 0
        };
      }
      const s = stats[r.baustelleId];
      s.rapportCount++;
      r.personal.forEach(p => s.arbeitsstunden += p.stunden);
      r.maschinen.forEach(m => s.maschinenstunden += m.stunden);
      // Leistung: sum menge where einheit contains 'm' (meters of pipe)
      r.leistung.forEach(l => {
        if (['m', 'lm', 'lfm'].includes(l.einheit.toLowerCase())) {
          s.leitungVerlegt += l.menge;
        }
      });
    });

    const totalArb = Object.values(stats).reduce((s, v) => s + v.arbeitsstunden, 0);
    const totalMasch = Object.values(stats).reduce((s, v) => s + v.maschinenstunden, 0);
    const totalLeitung = Object.values(stats).reduce((s, v) => s + v.leitungVerlegt, 0);

    // Last 7 days chart data
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const dayLabel = d.toLocaleDateString('de-CH', { weekday: 'short' });
      let dayHours = 0;
      rapporte.filter(r => r.datum === dateStr).forEach(r => {
        r.personal.forEach(p => dayHours += p.stunden);
      });
      last7.push({ label: dayLabel, date: dateStr, hours: dayHours });
    }

    const maxHours = Math.max(...last7.map(d => d.hours), 1);

    const barsHTML = last7.map(d => {
      const h = d.hours > 0 ? Math.max((d.hours / maxHours) * 100, 5) : 0;
      return `
        <div class="rapport-bar">
          ${d.hours > 0 ? `<div class="rapport-bar-value">${d.hours}h</div>` : ''}
          <div class="rapport-bar-fill navy" style="height:${h}%"></div>
          <div class="rapport-bar-label">${d.label}</div>
        </div>`;
    }).join('');

    // Per-baustelle bar chart
    const activeBS = bs.filter(b => b.status === 'aktiv');
    const maxBSHours = Math.max(...activeBS.map(b => (stats[b.id] || {}).arbeitsstunden || 0), 1);

    const bsBarsHTML = activeBS.map(b => {
      const s = stats[b.id] || { arbeitsstunden: 0 };
      const h = s.arbeitsstunden > 0 ? Math.max((s.arbeitsstunden / maxBSHours) * 100, 5) : 0;
      return `
        <div class="rapport-bar">
          ${s.arbeitsstunden > 0 ? `<div class="rapport-bar-value">${s.arbeitsstunden}h</div>` : ''}
          <div class="rapport-bar-fill orange" style="height:${h}%"></div>
          <div class="rapport-bar-label">${b.name.split(' ')[0]}</div>
        </div>`;
    }).join('');

    // Planned lengths from BAUSTELLEN data
    const plannedLengthTotal = bs.filter(b => b.status === 'aktiv').reduce((s, b) => {
      return s + (b.graben || []).reduce((gs, g) => gs + g.laenge, 0);
    }, 0);

    const body = `
      <div class="rapport-dashboard">
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Total Arbeitsstunden</div>
          <div class="rapport-dash-card-value">${formatNum(totalArb)}<span class="rapport-dash-card-unit">h</span></div>
          <div class="rapport-dash-card-sub">Aus ${rapporte.length} Rapporten</div>
        </div>
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Maschinenstunden</div>
          <div class="rapport-dash-card-value">${formatNum(totalMasch)}<span class="rapport-dash-card-unit">h</span></div>
        </div>
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Leitung verlegt</div>
          <div class="rapport-dash-card-value orange">${formatNum(totalLeitung)}<span class="rapport-dash-card-unit">m</span></div>
          <div class="rapport-dash-card-sub">${plannedLengthTotal > 0 ? 'von ' + formatNum(plannedLengthTotal) + ' m geplant' : ''}</div>
        </div>
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Fotos</div>
          <div class="rapport-dash-card-value">${photos.length}</div>
          <div class="rapport-dash-card-sub">${photos.filter(p => p.lat).length} georeferenziert</div>
        </div>
      </div>

      <div class="rapport-chart-wrap">
        <div class="rapport-chart-title">Arbeitsstunden letzte 7 Tage</div>
        <div class="rapport-bar-chart">${barsHTML}</div>
      </div>

      ${activeBS.length ? `
      <div class="rapport-chart-wrap">
        <div class="rapport-chart-title">Arbeitsstunden pro Baustelle (aktiv)</div>
        <div class="rapport-bar-chart">${bsBarsHTML}</div>
      </div>` : ''}

      <div class="rapport-section-title">// Baustellen-Übersicht</div>
      <div class="rapport-table-wrap">
        <table class="rapport-table">
          <thead><tr><th>Baustelle</th><th>Rapporte</th><th>Arb.h</th><th>Masch.h</th><th>Leitung (m)</th></tr></thead>
          <tbody>
            ${bs.map(b => {
              const s = stats[b.id] || { rapportCount: 0, arbeitsstunden: 0, maschinenstunden: 0, leitungVerlegt: 0 };
              return `<tr>
                <td><strong>${esc(b.name)}</strong></td>
                <td>${s.rapportCount}</td>
                <td>${s.arbeitsstunden}</td>
                <td>${s.maschinenstunden}</td>
                <td>${s.leitungVerlegt}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    createModal('Dashboard &mdash; Übersicht', body, '');
  }

  // ════════════════════════════════════════════
  // 5. EXPORT-FUNKTIONEN
  // ════════════════════════════════════════════

  // ── PDF via print ──
  function exportRapportPDF(rapportId) {
    const rapporte = loadRapporte();
    const r = rapporte.find(x => x.id === rapportId);
    if (!r) { alert('Rapport nicht gefunden.'); return; }

    const totalPersonalH = r.personal.reduce((s, p) => s + p.stunden, 0);
    const totalMaschinenH = r.maschinen.reduce((s, m) => s + m.stunden, 0);

    const printArea = document.createElement('div');
    printArea.className = 'rapport-print-area';
    printArea.innerHTML = `
      <div class="rapport-print-header">
        <div>
          <div class="rapport-print-logo">&#9670; BAUSITE <span>Geo</span></div>
          <div style="font-size:9pt; color:#64748B; margin-top:4pt;">Tagesrapport</div>
        </div>
        <div class="rapport-print-company">
          BAUSITE digital Baumeister<br>
          Grenchen SO<br>
          bausite.ch
        </div>
      </div>

      <div class="rapport-print-title">Tagesrapport ${r.datum}</div>

      <div class="rapport-print-section">
        <h3>Allgemeine Angaben</h3>
        <div class="rapport-print-row"><span>Baustelle:</span><span>${esc(baustelleName(r.baustelleId))} (${r.baustelleId})</span></div>
        <div class="rapport-print-row"><span>Datum:</span><span>${r.datum}</span></div>
        <div class="rapport-print-row"><span>Wetter:</span><span>${r.wetter}${r.temperatur !== null ? ', ' + r.temperatur + '°C' : ''}</span></div>
        <div class="rapport-print-row"><span>Arbeitszeit:</span><span>${r.beginn} &ndash; ${r.ende}</span></div>
      </div>

      ${r.personal.length ? `
      <div class="rapport-print-section">
        <h3>Personal (${r.personal.length} Personen, Total ${totalPersonalH} h)</h3>
        <table class="rapport-print-table">
          <thead><tr><th>Name</th><th>Funktion</th><th>Stunden</th></tr></thead>
          <tbody>${r.personal.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.funktion)}</td><td>${p.stunden}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      ${r.maschinen.length ? `
      <div class="rapport-print-section">
        <h3>Maschinen (Total ${totalMaschinenH} h)</h3>
        <table class="rapport-print-table">
          <thead><tr><th>Maschine</th><th>Stunden</th><th>Bemerkung</th></tr></thead>
          <tbody>${r.maschinen.map(m => `<tr><td>${esc(m.maschine)}</td><td>${m.stunden}</td><td>${esc(m.bemerkung)}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      ${r.leistung.length ? `
      <div class="rapport-print-section">
        <h3>Leistungen</h3>
        <table class="rapport-print-table">
          <thead><tr><th>NPK-Nr</th><th>Beschreibung</th><th>Einheit</th><th>Menge</th></tr></thead>
          <tbody>${r.leistung.map(l => `<tr><td>${esc(l.npk)}</td><td>${esc(l.beschreibung)}</td><td>${esc(l.einheit)}</td><td>${l.menge}</td></tr>`).join('')}</tbody>
        </table>
      </div>` : ''}

      ${r.vorkommnisse ? `
      <div class="rapport-print-section">
        <h3>Besondere Vorkommnisse</h3>
        <p style="white-space:pre-wrap; font-size:10pt;">${esc(r.vorkommnisse)}</p>
      </div>` : ''}

      ${r.signatur ? `
      <div class="rapport-print-signature">
        <p style="font-size:9pt; color:#666; margin-bottom:6pt;">Unterschrift:</p>
        <img src="${r.signatur}" alt="Unterschrift">
      </div>` : ''}

      <div class="rapport-print-footer">
        BAUSITE Geo &mdash; Tagesrapport ${r.datum} &mdash; ${esc(baustelleName(r.baustelleId))} &mdash; Erstellt am ${new Date().toLocaleDateString('de-CH')}
      </div>
    `;

    document.body.appendChild(printArea);
    window.print();

    // Remove after print
    setTimeout(() => printArea.remove(), 1000);
  }

  // ── CSV Export ──
  function exportCSV() {
    const rapporte = loadRapporte();
    if (!rapporte.length) { alert('Keine Rapporte vorhanden.'); return; }

    const rows = [['Datum', 'Baustelle', 'NPK-Nr', 'Beschreibung', 'Einheit', 'Menge'].join(';')];

    rapporte.forEach(r => {
      r.leistung.forEach(l => {
        rows.push([
          r.datum,
          baustelleName(r.baustelleId),
          l.npk,
          '"' + l.beschreibung.replace(/"/g, '""') + '"',
          l.einheit,
          l.menge
        ].join(';'));
      });
    });

    const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bausite-leistungen-' + today() + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── GeoJSON Export ──
  function exportGeoJSON() {
    const photos = loadPhotos().filter(p => p.lat && p.lng);
    const bs = getBaustellen();

    const features = [];

    // Baustellen as polygons
    bs.forEach(b => {
      features.push({
        type: 'Feature',
        properties: { type: 'baustelle', id: b.id, name: b.name, status: b.status, typ: b.typ },
        geometry: { type: 'Polygon', coordinates: [b.polygon] }
      });
    });

    // Photos as points
    photos.forEach(p => {
      features.push({
        type: 'Feature',
        properties: {
          type: 'foto',
          id: p.id,
          datum: p.datum,
          kategorie: p.kategorie,
          beschreibung: p.beschreibung,
          baustelleId: p.baustelleId
        },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] }
      });
    });

    const geojson = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bausite-geodaten-' + today() + '.geojson';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Weekly summary ──
  function exportWeeklySummary() {
    const rapporte = loadRapporte();
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString().slice(0, 10);

    const weekRapporte = rapporte.filter(r => r.datum >= weekStr);

    if (!weekRapporte.length) {
      alert('Keine Rapporte in den letzten 7 Tagen.');
      return;
    }

    // Aggregate
    const perDay = {};
    weekRapporte.forEach(r => {
      if (!perDay[r.datum]) {
        perDay[r.datum] = { arbH: 0, maschH: 0, personal: 0, baustellen: new Set() };
      }
      const d = perDay[r.datum];
      r.personal.forEach(p => { d.arbH += p.stunden; d.personal++; });
      r.maschinen.forEach(m => d.maschH += m.stunden);
      d.baustellen.add(r.baustelleId);
    });

    const totalArb = Object.values(perDay).reduce((s, d) => s + d.arbH, 0);
    const totalMasch = Object.values(perDay).reduce((s, d) => s + d.maschH, 0);

    const sortedDays = Object.keys(perDay).sort();

    const tableRows = sortedDays.map(d => {
      const v = perDay[d];
      const dayName = new Date(d + 'T00:00').toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });
      return `<tr>
        <td>${dayName}</td>
        <td>${v.personal}</td>
        <td>${v.arbH}</td>
        <td>${v.maschH}</td>
        <td>${[...v.baustellen].map(id => esc(baustelleName(id))).join(', ')}</td>
      </tr>`;
    }).join('');

    const body = `
      <div class="rapport-section-title">// Woche ${weekStr} bis ${today()}</div>
      <div class="rapport-dashboard">
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Arbeitsstunden</div>
          <div class="rapport-dash-card-value">${formatNum(totalArb)}<span class="rapport-dash-card-unit">h</span></div>
        </div>
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Maschinenstunden</div>
          <div class="rapport-dash-card-value">${formatNum(totalMasch)}<span class="rapport-dash-card-unit">h</span></div>
        </div>
        <div class="rapport-dash-card">
          <div class="rapport-dash-card-label">Rapporte</div>
          <div class="rapport-dash-card-value">${weekRapporte.length}</div>
        </div>
      </div>
      <div class="rapport-table-wrap">
        <table class="rapport-table">
          <thead><tr><th>Tag</th><th>Personal</th><th>Arb. h</th><th>Masch. h</th><th>Baustellen</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    `;

    const footer = `
      <button class="rapport-btn rapport-btn-ghost" onclick="this.closest('.rapport-overlay').remove()">Schliessen</button>
      <button class="rapport-btn rapport-btn-primary" onclick="window._printWeeklySummary()">Drucken</button>
    `;

    createModal('Wochenübersicht', body, footer);
  }

  window._printWeeklySummary = function () {
    const modalBody = document.querySelector('.rapport-modal-body');
    if (!modalBody) return;

    const printArea = document.createElement('div');
    printArea.className = 'rapport-print-area';
    printArea.innerHTML = `
      <div class="rapport-print-header">
        <div>
          <div class="rapport-print-logo">&#9670; BAUSITE <span>Geo</span></div>
          <div style="font-size:9pt; color:#64748B; margin-top:4pt;">Wochenübersicht</div>
        </div>
        <div class="rapport-print-company">
          BAUSITE digital Baumeister<br>
          Grenchen SO<br>
          bausite.ch
        </div>
      </div>
      ${modalBody.innerHTML}
    `;
    document.body.appendChild(printArea);
    window.print();
    setTimeout(() => printArea.remove(), 1000);
  };

  // ════════════════════════════════════════════
  // 6. EXPORT MENU (combined)
  // ════════════════════════════════════════════

  function showExportMenu() {
    const body = `
      <div class="rapport-section-title">// Export-Optionen</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button class="rapport-btn rapport-btn-secondary" style="justify-content:flex-start;" onclick="window.RapportModule.exportCSV(); this.closest('.rapport-overlay').remove();">
          &#128202; CSV-Export (Leistungsdaten)
        </button>
        <button class="rapport-btn rapport-btn-secondary" style="justify-content:flex-start;" onclick="window._exportGeoJSON(); this.closest('.rapport-overlay').remove();">
          &#127758; GeoJSON-Export (Geo-Objekte)
        </button>
        <button class="rapport-btn rapport-btn-secondary" style="justify-content:flex-start;" onclick="this.closest('.rapport-overlay').remove(); window._exportWeeklySummary();">
          &#128197; Wochenübersicht
        </button>
      </div>
    `;
    createModal('Daten exportieren', body, '');
  }

  window._exportGeoJSON = function () { exportGeoJSON(); };
  window._exportWeeklySummary = function () { exportWeeklySummary(); };

  // ════════════════════════════════════════════
  // INIT: Load photo markers on map load
  // ════════════════════════════════════════════

  function init() {
    if (typeof map !== 'undefined') {
      if (map.loaded && map.loaded()) {
        refreshPhotoMarkers();
      } else {
        map.on('load', refreshPhotoMarkers);
      }
    }
  }

  // Run init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════

  window.RapportModule = {
    showRapportForm: showRapportForm,
    showRapportList: showRapportList,
    showPhotoUpload: showPhotoUpload,
    showDashboard: showDashboard,
    showExportMenu: showExportMenu,
    exportRapportPDF: exportRapportPDF,
    exportCSV: exportCSV,
    exportGeoJSON: exportGeoJSON,
    exportWeeklySummary: exportWeeklySummary,
    getRapporte: loadRapporte,
    getPhotos: loadPhotos,
    refreshPhotoMarkers: refreshPhotoMarkers,
  };

})();
