export default async function handler(req, res) {
  // Configurar encabezados CORS para permitir peticiones desde tu frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ean } = req.query;

  if (!ean) {
    return res.status(400).json({ error: 'Se requiere un código EAN.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'La clave de API de Gemini no está configurada en Vercel.' });
  }

  const prompt = `Analiza el siguiente código de barras (EAN/UPC): ${ean}. 
Identifica el producto correspondiente y responde ÚNICAMENTE con un objeto JSON estrictamente válido sin bloques de código Markdown ni texto adicional. 
El objeto debe tener las siguientes claves exactas:
- "marca": Nombre de la marca o "NO_ENCONTRADO" si no existe.
- "modelo": Modelo o especificación del producto.
- "tipoProducto": Categoría o tipo de producto (ej: TELEVISOR, CHAMPÚ, ZAPATILLA).
- "color": Color o variante del producto.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error('Error desde la API de Gemini:', errData);
      return res.status(response.status).json({ error: 'Error al comunicarse con la API de Gemini.' });
    }

    const data = await response.json();
    const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Limpiar posibles etiquetas markdown si la IA las incluye
    const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim();
    const resultado = JSON.parse(jsonLimpio);

    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error en la función serverless:', error);
    return res.status(500).json({ error: 'Error interno al procesar el código EAN.' });
  }
}
