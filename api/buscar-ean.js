export default async function handler(req, res) {
    // ==============================
    // CONFIGURACIÓN CORS
    // ==============================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ==============================
    // OBTENER EAN
    // ==============================
    const ean = req.method === 'GET'
        ? req.query?.ean
        : req.body?.ean;

    if (!ean) {
        return res.status(400).json({
            error: 'El código EAN es obligatorio.'
        });
    }

    // Limpiar el código dejando solamente números
    const eanLimpio = String(ean).replace(/\D/g, '');

    // Validar longitud habitual de EAN/UPC
    if (![8, 12, 13].includes(eanLimpio.length)) {
        return res.status(400).json({
            error: 'El código EAN/UPC no tiene una longitud válida.',
            ean: eanLimpio
        });
    }

    // ==============================
    // API KEY
    // ==============================
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'La API Key de Gemini no está configurada en Vercel.'
        });
    }

    // ==============================
    // PROMPT
    // ==============================
    const prompt = `
Analiza el código de barras EAN/UPC:

${eanLimpio}

Identifica el producto comercial correspondiente si tienes información suficiente.

Devuelve exclusivamente los datos solicitados en formato JSON.

IMPORTANTE:
- No inventes datos.
- Si no puedes identificar con seguridad el producto exacto, encontrado debe ser false.
- Si lo identificas, completa marca, modelo, tipoProducto y color.
- El campo ean debe contener exactamente ${eanLimpio}.
- Si un dato no está disponible, utiliza una cadena vacía.

La respuesta debe representar este objeto:

{
  "encontrado": true,
  "ean": "${eanLimpio}",
  "marca": "Marca",
  "modelo": "Modelo o nombre del producto",
  "tipoProducto": "Tipo de producto",
  "color": "Color"
}

Si no puedes identificarlo:

{
  "encontrado": false,
  "ean": "${eanLimpio}",
  "marca": "",
  "modelo": "",
  "tipoProducto": "",
  "color": "",
  "mensaje": "Producto no identificado"
}
`;

    // ==============================
    // GEMINI INTERACTIONS API
    // ==============================
    const url =
        'https://generativelanguage.googleapis.com/v1beta/interactions';

    try {
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
                // Este es el formato actual para pedir
                // una respuesta JSON estructurada.
                response_format: [
                    {
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
                                'marca',
                                'modelo',
                                'tipoProducto',
                                'color'
                            ]
                        }
                    }
                ]
            })
        });

        // ==============================
        // LEER RESPUESTA DE GEMINI
        // ==============================
        const responseText = await apiResponse.text();

        console.log('Respuesta HTTP Gemini:', apiResponse.status);
        console.log('Respuesta Gemini:', responseText);

        // ==============================
        // ERROR DE GEMINI
        // ==============================
        if (!apiResponse.ok) {
            return res.status(502).json({
                error: 'Error al consultar la API de IA.',
                codigo: apiResponse.status,
                detalle: responseText
            });
        }

        // ==============================
        // CONVERTIR RESPUESTA
        // ==============================
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            return res.status(502).json({
                error: 'Gemini devolvió una respuesta que no es JSON válido.',
                detalle: responseText
            });
        }

        // ==============================
        // EXTRAER TEXTO DE LA RESPUESTA
        // ==============================
        let rawText = '';

        // Algunas respuestas pueden traer output_text
        if (typeof data.output_text === 'string') {
            rawText = data.output_text;
        }

        // Otras pueden traer steps
        if (!rawText && Array.isArray(data.steps)) {
            for (const step of data.steps) {
                if (!step || !step.content) {
                    continue;
                }

                if (Array.isArray(step.content)) {
                    for (const content of step.content) {
                        if (typeof content?.text === 'string') {
                            rawText += content.text;
                        }
                    }
                }

                if (typeof step.content?.text === 'string') {
                    rawText += step.content.text;
                }
            }
        }

        // Algunas respuestas pueden tener output como array
        if (!rawText && Array.isArray(data.output)) {
            for (const item of data.output) {
                if (typeof item?.text === 'string') {
                    rawText += item.text;
                }

                if (Array.isArray(item?.content)) {
                    for (const content of item.content) {
                        if (typeof content?.text === 'string') {
                            rawText += content.text;
                        }
                    }
                }
            }
        }

        rawText = String(rawText || '').trim();

        console.log('Texto extraído de Gemini:', rawText);

        // ==============================
        // SI NO ENCONTRAMOS TEXTO
        // ==============================
        if (!rawText) {
            return res.status(502).json({
                error: 'La IA no devolvió información del producto.',
                respuestaGemini: data
            });
        }

        // ==============================
        // LIMPIAR MARKDOWN
        // ==============================
        let jsonString = rawText
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        // Buscar objeto JSON si Gemini agregó texto adicional
        const primerInicio = jsonString.indexOf('{');
        const ultimoFinal = jsonString.lastIndexOf('}');

        if (primerInicio !== -1 && ultimoFinal !== -1) {
            jsonString = jsonString.substring(
                primerInicio,
                ultimoFinal + 1
            );
        }

        // ==============================
        // PARSEAR JSON
        // ==============================
        let productoInfo;

        try {
            productoInfo = JSON.parse(jsonString);
        } catch (error) {
            console.error(
                'Error al convertir respuesta de Gemini a JSON:',
                error
            );

            return res.status(502).json({
                error: 'La IA devolvió información en un formato inesperado.',
                respuesta: rawText
            });
        }

        // ==============================
        // NORMALIZAR RESULTADO
        // ==============================
        const resultado = {
            encontrado: Boolean(productoInfo.encontrado),

            ean: String(
                productoInfo.ean || eanLimpio
            ),

            marca: String(
                productoInfo.marca || ''
            ),

            modelo: String(
                productoInfo.modelo || ''
            ),

            tipoProducto: String(
                productoInfo.tipoProducto || ''
            ),

            color: String(
                productoInfo.color || ''
            )
        };

        // Agregar mensaje si existe
        if (productoInfo.mensaje) {
            resultado.mensaje = String(
                productoInfo.mensaje
            );
        }

        // ==============================
        // RESPUESTA FINAL
        // ==============================
        return res.status(200).json(resultado);

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
