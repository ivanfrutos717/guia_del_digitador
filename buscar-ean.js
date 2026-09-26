export default async function handler(req, res) {
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ean } = req.query;

  if (!ean) {
    return res.status(400).json({ error: 'Falta el código EAN.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Falta la API Key en el servidor.' });
  }

  try {
    const prompt = `Responde ÚNICAMENTE en formato JSON válido sin Markdown ni texto extra.
Identifica el producto con código EAN/UPC: "${ean}".
Las tiendas de electrónica de Paraguay y Compras Paraguai venden este producto.
Estructura en MAYÚSCULAS:
- "marca": Marca (ej. JBL, APPLE, SAMSUNG)
- "modelo": Modelo exacto (ej. BOOMBOX 4, IPHONE 15 PRO)
- "tipoProducto": Categoría (ej. SPEAKER, SMARTPHONE, AURICULAR)
- "color": Color principal (ej. WHITE, BLACK, BLUE)

Si no lo identificas con precisión, responde: {"error": "no_encontrado"}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0].content.parts[0].text) {
      let rawText = data.candidates[0].content.parts[0].text.trim();
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultadoJson = JSON.parse(rawText);
      return res.status(200).json(resultadoJson);
    }

    return res.status(404).json({ error: 'Producto no encontrado' });
  } catch (error) {
    return res.status(500).json({ error: 'Error en la consulta', details: error.message });
  }
}