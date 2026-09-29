export default async function handler(req, res) {
    // 1. Configurar encabezados CORS para permitir llamadas desde tu frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder inmediatamente a las peticiones preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Obtener el EAN tanto si viene por GET (?ean=...) como por POST ({ ean: ... })
    const ean = req.method === 'GET' ? req.query.ean : req.body?.ean;

    if (!ean) {
        return res.status(400).json({ error: 'El código EAN es obligatorio.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'La API Key de Gemini no está configurada en Vercel.' });
    }

    try {
        const prompt = `Analiza el siguiente código de barras EAN/UPC: ${ean}.
Busca en tu base de conocimientos el producto comercial correspondiente.
Devuelve ÚNICAMENTE un objeto JSON estrictamente válido con la siguiente estructura (sin formato Markdown, sin comillas cuadradas de código, sin texto adicional):
{
  "encontrado": true,
  "ean": "${ean}",
  "marca": "Marca del producto",
  "modelo": "Nombre o modelo del producto",
  "tipoProducto": "Categoría o tipo",
  "color": "Color o variante"
}
Si no encuentras el producto exacto con ese EAN, responde ÚNICAMENTE:
{
  "encontrado": false,
  "ean": "${ean}",
  "marca": "NO_ENCONTRADO",
  "mensaje": "Producto no identificado"
}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error("Error desde Gemini API:", errorText);
            return res.status(502).json({ error: 'Error al consultar la API de IA.' });
        }

        const data = await apiResponse.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Limpieza de formato Markdown de bloques ```json ... ```
        const jsonString = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const productoInfo = JSON.parse(jsonString);

        return res.status(200).json(productoInfo);

    } catch (error) {
        console.error("Error en la función buscar-ean:", error);
        return res.status(500).json({ error: 'Error interno al procesar el código EAN.' });
    }
}