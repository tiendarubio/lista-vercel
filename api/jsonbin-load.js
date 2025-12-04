// api/jsonbin-load.js
// Carga el contenido más reciente de un BIN de JSONBin

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.JSONBIN_API_KEY;
  if (!API_KEY) {
    res.statusCode = 500;
    return res.json({ error: 'Falta JSONBIN_API_KEY en variables de entorno' });
  }

  const { binId } = req.query || {};
  if (!binId) {
    res.statusCode = 400;
    return res.json({ error: 'binId es requerido' });
  }

  try {
    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}/latest`;
    const response = await fetch(url, {
      headers: {
        'X-Access-Key': API_KEY
      }
    });

    if (!response.ok) {
      const text = await response.text();
      res.statusCode = response.status;
      return res.json({ error: 'Error al leer desde JSONBin', details: text });
    }

    const data = await response.json();
    res.statusCode = 200;
    return res.json(data);
  } catch (err) {
    res.statusCode = 500;
    return res.json({ error: 'Error de servidor al leer desde JSONBin', details: String(err) });
  }
};
