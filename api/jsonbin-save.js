// api/jsonbin-save.js
// Guarda el payload en un BIN específico de JSONBin

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.JSONBIN_API_KEY;
  if (!API_KEY) {
    res.statusCode = 500;
    return res.json({ error: 'Falta JSONBIN_API_KEY en variables de entorno' });
  }

  try {
    const { binId, payload } = req.body || {};
    if (!binId) {
      res.statusCode = 400;
      return res.json({ error: 'binId es requerido' });
    }

    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': API_KEY
      },
      body: JSON.stringify(payload || {})
    });

    if (!response.ok) {
      const text = await response.text();
      res.statusCode = response.status;
      return res.json({ error: 'Error al guardar en JSONBin', details: text });
    }

    const data = await response.json();
    res.statusCode = 200;
    return res.json(data);
  } catch (err) {
    res.statusCode = 500;
    return res.json({ error: 'Error de servidor al guardar en JSONBin', details: String(err) });
  }
};
