// api/catalogo.js
// Devuelve el catálogo desde Google Sheets usando variables de entorno

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.json({ error: 'Method not allowed' });
  }

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  const API_KEY = process.env.GOOGLE_SHEETS_API_KEY;
  const RANGE = 'bd!A2:D5000';

  if (!SHEET_ID || !API_KEY) {
    res.statusCode = 500;
    return res.json({ error: 'Faltan variables de entorno de Google Sheets' });
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      res.statusCode = response.status;
      return res.json({ error: 'Error al consultar Google Sheets', details: text });
    }
    const data = await response.json();
    res.statusCode = 200;
    return res.json({ values: data.values || [] });
  } catch (err) {
    res.statusCode = 500;
    return res.json({ error: 'Error de servidor al leer Google Sheets', details: String(err) });
  }
};
