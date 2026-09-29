// api/buscar-ean.js

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { ean } = req.body;

    if (!ean) {
        return res.status(400).json({ error: 'El código EAN es obligatorio.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: 'La API Key de Gemini no está configurada.' });
    }

    try {
        const prompt = `Analiza el siguiente código de barras EAN/UPC: ${ean}.
Busca en tu base de conocimientos el producto comercial correspondiente.
Devuelve ÚNICAMENTE un objeto JSON con la siguiente estructura (sin formato Markdown, sin texto adicional):
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
            return res.status(502).json({ error: 'Error al consultar la API de IA.' });
        }

        const data = await apiResponse.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const productoInfo = JSON.parse(jsonString);

        return res.status(200).json(productoInfo);

    } catch (error) {
        return res.status(500).json({ error: 'Error interno al procesar el código EAN.' });
    }
}