// app.js — Config & helpers (versión para Vercel, sin llaves en el cliente)

// BINs por tienda
const STORE_BINS = {
  lista_sexta_calle:      { base:'68c5b46ed0ea881f407ce556', alterna:'69174e9943b1c97be9ad5f6b' },
  lista_centro_comercial: { base:'68c5b4add0ea881f407ce586', alterna:'69174eb7d0ea881f40e85786' },
  lista_avenida_morazan:  { base:'68c5b4e043b1c97be941f83f', alterna:'69174e1ad0ea881f40e8565f' }
};

function getBinId(storeKey, versionKey = 'base') {
  const rec = STORE_BINS[storeKey];
  if (!rec) return null;
  return rec[versionKey] || rec.base;
}

// ====== Catálogo (Google Sheets a través de /api/catalogo) ======
let CATALOGO_CACHE = null;

function preloadCatalog() {
  if (CATALOGO_CACHE) return Promise.resolve(CATALOGO_CACHE);

  return fetch('/api/catalogo')
    .then(r => {
      if (!r.ok) throw new Error('Error catálogo: ' + r.statusText);
      return r.json();
    })
    .then(data => {
      CATALOGO_CACHE = Array.isArray(data.values) ? data.values : [];
      return CATALOGO_CACHE;
    })
    .catch(e => {
      console.error('Sheets catálogo error:', e);
      CATALOGO_CACHE = [];
      return CATALOGO_CACHE;
    });
}

function loadProductsFromGoogleSheets() {
  return preloadCatalog();
}

// ====== JSONBin helpers (a través de /api/jsonbin-*) ======
function saveToBin(binId, payload) {
  if (!binId) {
    return Promise.reject(new Error('BIN no configurado para esta tienda.'));
  }

  return fetch('/api/jsonbin-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId, payload })
  }).then(r => {
    if (!r.ok) throw new Error('Error al guardar en servidor (' + r.status + ')');
    return r.json();
  });
}

function loadFromBin(binId) {
  if (!binId) return Promise.resolve(null);

  const url = '/api/jsonbin-load?binId=' + encodeURIComponent(binId);

  return fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('Error al cargar desde servidor (' + r.status + ')');
      return r.json();
    })
    .then(d => d.record || d || null)
    .catch(e => {
      console.error('JSONBin load error:', e);
      return null;
    });
}

// ====== Formato de fecha/hora en ES-SV ======
function formatSV(iso) {
  if (!iso) return 'Aún no guardado.';
  try {
    const dt = new Date(iso);
    return dt.toLocaleString('es-SV', {
      timeZone: 'America/El_Salvador',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return 'Aún no guardado.';
  }
}
