export default async function handler(req, res) {
    // 1. Configurar encabezados CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder a peticiones preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 2. Obtener el EAN desde GET o POST
    const ean = req.method === 'GET'
        ? req.query.ean
        : req.body?.ean;

    if (!ean) {
        return res.status(400).json({
            error: 'El código EAN es obligatorio.'
        });
    }

    // Limpiar el código para dejar solamente números
    const eanLimpio = String(ean).replace(/\D/g, '');

    if (![8, 12, 13].includes(eanLimpio.length)) {
        return res.status(400).json({
            error: 'El código EAN/UPC debe tener 8, 12 o 13 dígitos.'
        });
    }

    // 3. Obtener API Key desde Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'La API Key de Gemini no está configurada en Vercel.'
        });
    }

    try {
        // 4. Prompt para identificar exactamente el producto
        const prompt = `
Analiza el siguiente código de barras EAN/UPC:

${eanLimpio}

Tu tarea es identificar el producto comercial EXACTO asociado a ese código.

IMPORTANTE:
- Utiliza Google Search para verificar el código EAN/UPC.
- Busca específicamente el número ${eanLimpio}.
- No inventes información.
- Si encuentras evidencia confiable de que el EAN corresponde a un producto concreto, devuelve encontrado=true.
- Si no puedes confirmar que el EAN corresponde exactamente a un producto, devuelve encontrado=false.
- No confundas productos similares, variantes, colores o modelos diferentes.
- El campo "marca" debe contener la marca comercial.
- El campo "modelo" debe contener el nombre, modelo o referencia comercial del producto.
- El campo "tipoProducto" debe describir qué tipo de producto es.
- El campo "color" debe indicar el color o variante cuando pueda determinarse.

El EAN consultado es:
${eanLimpio}
`;

        // 5. Endpoint actual de Gemini Interactions API
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

                // Permite a Gemini buscar información actual en Google
                tools: [
                    {
                        type: 'google_search'
                    }
                ],

                // Obliga a devolver un JSON con esta estructura
                response_format: {
                    type: 'text',
                    mime_type: 'application/json',
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
                            'marca'
                        ]
                    }
                }
            })
        });

        // 6. Comprobar respuesta de Gemini
        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();

            console.error(
                'Error desde Gemini API:',
                errorText
            );

            return res.status(502).json({
                error: 'Error al consultar la API de IA.',
                detalle: errorText
            });
        }

        // 7. Convertir respuesta
        const data = await apiResponse.json();

        console.log(
            'Respuesta de Gemini recibida correctamente.'
        );

        // 8. La Interactions API devuelve output_text
        let rawText = data.output_text || '';

        // Compatibilidad adicional por si la respuesta viene dentro de steps
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
                'Gemini no devolvió texto:',
                JSON.stringify(data)
            );

            return res.status(502).json({
                error: 'La IA no devolvió información del producto.'
            });
        }

        // 9. Limpiar posibles bloques Markdown
        const jsonString = rawText
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        // 10. Convertir el JSON devuelto por Gemini
        let productoInfo;

        try {
            productoInfo = JSON.parse(jsonString);
        } catch (parseError) {
            console.error(
                'No se pudo interpretar el JSON de Gemini:',
                rawText
            );

            return res.status(502).json({
                error: 'La IA devolvió una respuesta que no pudo interpretarse.'
            });
        }

        // 11. Asegurar que el EAN devuelto sea el consultado
        productoInfo.ean = eanLimpio;

        // 12. Normalizar valores
        productoInfo.encontrado =
            productoInfo.encontrado === true;

        productoInfo.marca =
            productoInfo.marca || 'NO_ENCONTRADO';

        productoInfo.modelo =
            productoInfo.modelo || '';

        productoInfo.tipoProducto =
            productoInfo.tipoProducto || '';

        productoInfo.color =
            productoInfo.color || '';

        // 13. Si no encontró el producto
        if (!productoInfo.encontrado) {
            productoInfo.mensaje =
                productoInfo.mensaje ||
                'Producto no identificado';
        }

        // 14. Devolver resultado al frontend
        return res.status(200).json(productoInfo);

    } catch (error) {
        console.error(
            'Error en la función buscar-ean:',
            error
        );

        return res.status(500).json({
            error: 'Error interno al procesar el código EAN.'
        });
    }
}
