export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const ean = req.method === 'GET'
        ? req.query.ean
        : req.body?.ean;

    if (!ean) {
        return res.status(400).json({
            error: 'El código EAN es obligatorio.'
        });
    }

    const codigo = String(ean).replace(/\D/g, '');

    if (![8, 12, 13].includes(codigo.length)) {
        return res.status(400).json({
            error: 'El EAN/UPC debe tener 8, 12 o 13 dígitos.'
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'La API Key de Gemini no está configurada en Vercel.'
        });
    }

    try {
        const prompt = `
Analiza este código de barras EAN/UPC:

${codigo}

Intenta identificar qué producto corresponde al código.

IMPORTANTE:
Esta es una PRUEBA TÉCNICA.
NO utilices Google Search.
Utiliza únicamente el conocimiento disponible del modelo.

Devuelve ÚNICAMENTE JSON válido con esta estructura:

{
  "encontrado": true,
  "ean": "${codigo}",
  "marca": "Marca del producto",
  "modelo": "Nombre o modelo del producto",
  "tipoProducto": "Categoría o tipo de producto",
  "color": "Color o variante"
}

Si no puedes identificarlo con suficiente confianza:

{
  "encontrado": false,
  "ean": "${codigo}",
  "marca": "NO_ENCONTRADO",
  "modelo": "",
  "tipoProducto": "",
  "color": "",
  "mensaje": "Producto no identificado"
}
`;

        const url =
            'https://generativelanguage.googleapis.com/v1beta/interactions';

        const apiResponse = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                model: 'gemini-3.8-flash',
                input: prompt,

                // IMPORTANTE:
                // NO ponemos google_search aquí.
                // Esta prueba sirve para determinar si el 429
                // está relacionado con Google Search.
                
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'producto_ean',
                        schema: {
                            type: 'object',
                            properties: {
                                encontrado: {
                                    type: 'boolean'
                                },
                                ean: {
                                    type: 'string'
                                },
                                marca: {
                                    type: 'string'
                                },
                                modelo: {
                                    type: 'string'
                                },
                                tipoProducto: {
                                    type: 'string'
                                },
                                color: {
                                    type: 'string'
                                },
                                mensaje: {
                                    type: 'string'
                                }
                            },
                            required: [
                                'encontrado',
                                'ean',
                                'marca',
                                'modelo',
                                'tipoProducto',
                                'color'
                            ]
                        }
                    }
                }
            })
        });

        const responseText = await apiResponse.text();

        console.log(
            'Respuesta completa de Gemini:',
            responseText
        );

        if (!apiResponse.ok) {
            console.error(
                'Error desde Gemini API:',
                responseText
            );

            return res.status(502).json({
                error: 'Error al consultar la API de IA.',
                detalle: responseText
            });
        }

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error(
                'Gemini no devolvió JSON válido:',
                responseText
            );

            return res.status(502).json({
                error: 'Gemini devolvió una respuesta no válida.',
                respuesta: responseText
            });
        }

        // La Interactions API puede devolver el resultado
        // directamente en output_text.
        let rawText = data.output_text || '';

        // Fallback por si output_text no está disponible.
        if (!rawText && Array.isArray(data.steps)) {
            for (const step of data.steps) {
                if (
                    step.type === 'model_output' &&
                    Array.isArray(step.content)
                ) {
                    for (const content of step.content) {
                        if (
                            content.type === 'text' &&
                            content.text
                        ) {
                            rawText += content.text;
                        }
                    }
                }
            }
        }

        if (!rawText) {
            console.error(
                'No se encontró texto en la respuesta:',
                JSON.stringify(data)
            );

            return res.status(502).json({
                error: 'Gemini no devolvió información del producto.',
                respuesta: data
            });
        }

        let producto;

        try {
            producto = JSON.parse(rawText);
        } catch (parseError) {
            const limpio = rawText
                .replace(/```json/gi, '')
                .replace(/```/g, '')
                .trim();

            try {
                producto = JSON.parse(limpio);
            } catch (secondError) {
                console.error(
                    'No se pudo interpretar el JSON:',
                    rawText
                );

                return res.status(502).json({
                    error: 'Gemini devolvió un JSON no válido.',
                    respuesta: rawText
                });
            }
        }

        return res.status(200).json({
            encontrado: Boolean(producto.encontrado),
            ean: codigo,
            marca: producto.marca || '',
            modelo: producto.modelo || '',
            tipoProducto: producto.tipoProducto || '',
            color: producto.color || '',
            ...(producto.mensaje
                ? { mensaje: producto.mensaje }
                : {})
        });

    } catch (error) {
        console.error(
            'Error en la función buscar-ean:',
            error
        );

        return res.status(500).json({
            error: 'Error interno al procesar el código EAN.',
            detalle: error.message
        });
    }
}
