export default async function handler(req, res) {
    // ==========================================
    // CORS
    // ==========================================
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ==========================================
    // OBTENER EAN
    // ==========================================
    const ean = req.method === 'GET'
        ? req.query?.ean
        : req.body?.ean;

    if (!ean) {
        return res.status(400).json({
            error: 'El código EAN es obligatorio.'
        });
    }

    const eanLimpio = String(ean).replace(/\D/g, '');

    // Validar EAN / UPC
    if (![8, 12, 13].includes(eanLimpio.length)) {
        return res.status(400).json({
            error: 'El código EAN/UPC no tiene una longitud válida.',
            ean: eanLimpio
        });
    }

    // ==========================================
    // API KEY
    // ==========================================
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({
            error: 'La API Key de Gemini no está configurada en Vercel.'
        });
    }

    // ==========================================
    // PROMPT
    // ==========================================
    const prompt = `
Necesito identificar un producto comercial utilizando su código de barras.

Código EAN/UPC:
${eanLimpio}

IMPORTANTE:
1. Utiliza Google Search para buscar específicamente este código:
   ${eanLimpio}

2. Busca coincidencias exactas del código EAN/UPC.
3. No confundas productos que tengan códigos parecidos.
4. Si encuentras páginas que indiquen explícitamente que ${eanLimpio}
   corresponde a un producto, utiliza esa información.
5. Si diferentes páginas muestran información diferente, compara los
   resultados y utiliza la información que corresponda al código exacto.
6. No inventes marca, modelo, tipo de producto ni color.
7. Si no existe evidencia suficiente para identificar exactamente el
   producto, devuelve encontrado=false.
8. El campo "ean" debe ser exactamente "${eanLimpio}".

Debes devolver exclusivamente un objeto JSON con estos campos:

{
  "encontrado": true,
  "ean": "${eanLimpio}",
  "marca": "Marca del producto",
  "modelo": "Modelo o nombre comercial",
  "tipoProducto": "Tipo o categoría del producto",
  "color": "Color o variante"
}

Si no puedes identificar el producto exacto:

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

    // ==========================================
    // GEMINI INTERACTIONS API
    // ==========================================
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

                // Modelo
                model: 'gemini-3.5-flash-lite',

                // Instrucción
                input: prompt,

                // ==========================================
                // GOOGLE SEARCH
                // ==========================================
                tools: [
                    {
                        type: 'google_search'
                    }
                ],

                // ==========================================
                // RESPUESTA JSON ESTRUCTURADA
                // ==========================================
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
                            'marca',
                            'modelo',
                            'tipoProducto',
                            'color'
                        ]
                    }
                }
            })
        });

        // ==========================================
        // LEER RESPUESTA
        // ==========================================
        const responseText = await apiResponse.text();

        console.log(
            'Respuesta HTTP Gemini:',
            apiResponse.status
        );

        console.log(
            'Respuesta Gemini:',
            responseText
        );

        // ==========================================
        // ERROR DE GEMINI
        // ==========================================
        if (!apiResponse.ok) {
            return res.status(502).json({
                error: 'Error al consultar la API de IA.',
                codigo: apiResponse.status,
                detalle: responseText
            });
        }

        // ==========================================
        // CONVERTIR RESPUESTA A JSON
        // ==========================================
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            return res.status(502).json({
                error: 'Gemini devolvió una respuesta que no es JSON válido.',
                detalle: responseText
            });
        }

        // ==========================================
        // OBTENER TEXTO DE GEMINI
        // ==========================================
        let rawText = '';

        // Forma principal de Interactions API
        if (typeof data.output_text === 'string') {
            rawText = data.output_text;
        }

        // ==========================================
        // RESPALDO: STEPS
        // ==========================================
        if (!rawText && Array.isArray(data.steps)) {

            for (const step of data.steps) {

                if (!step) {
                    continue;
                }

                // Caso 1:
                // step.content = [{ text: "..." }]
                if (Array.isArray(step.content)) {

                    for (const content of step.content) {

                        if (
                            content &&
                            typeof content.text === 'string'
                        ) {
                            rawText += content.text;
                        }
                    }
                }

                // Caso 2:
                // step.content.text
                if (
                    step.content &&
                    typeof step.content.text === 'string'
                ) {
                    rawText += step.content.text;
                }

                // Caso 3:
                // step.output_text
                if (
                    typeof step.output_text === 'string'
                ) {
                    rawText += step.output_text;
                }
            }
        }

        // ==========================================
        // RESPALDO: OUTPUT
        // ==========================================
        if (!rawText && Array.isArray(data.output)) {

            for (const item of data.output) {

                if (
                    item &&
                    typeof item.text === 'string'
                ) {
                    rawText += item.text;
                }

                if (Array.isArray(item?.content)) {

                    for (const content of item.content) {

                        if (
                            content &&
                            typeof content.text === 'string'
                        ) {
                            rawText += content.text;
                        }
                    }
                }
            }
        }

        rawText = String(rawText || '').trim();

        console.log(
            'Texto extraído de Gemini:',
            rawText
        );

        // ==========================================
        // NO HUBO RESPUESTA DE TEXTO
        // ==========================================
        if (!rawText) {

            return res.status(502).json({
                error: 'La IA no devolvió información del producto.',
                respuestaGemini: data
            });
        }

        // ==========================================
        // LIMPIAR MARKDOWN
        // ==========================================
        let jsonString = rawText
            .replace(/```json/gi, '')
            .replace(/```/g, '')
            .trim();

        // ==========================================
        // EXTRAER OBJETO JSON
        // ==========================================
        const primerInicio = jsonString.indexOf('{');
        const ultimoFinal = jsonString.lastIndexOf('}');

        if (
            primerInicio !== -1 &&
            ultimoFinal !== -1 &&
            ultimoFinal > primerInicio
        ) {
            jsonString = jsonString.substring(
                primerInicio,
                ultimoFinal + 1
            );
        }

        // ==========================================
        // PARSEAR JSON
        // ==========================================
        let productoInfo;

        try {

            productoInfo = JSON.parse(jsonString);

        } catch (error) {

            console.error(
                'Error convirtiendo respuesta a JSON:',
                error
            );

            return res.status(502).json({
                error: 'La IA devolvió información en un formato inesperado.',
                respuesta: rawText
            });
        }

        // ==========================================
        // NORMALIZAR RESULTADO
        // ==========================================
        const resultado = {

            encontrado: Boolean(
                productoInfo.encontrado
            ),

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

        // ==========================================
        // MENSAJE OPCIONAL
        // ==========================================
        if (productoInfo.mensaje) {

            resultado.mensaje = String(
                productoInfo.mensaje
            );
        }

        // ==========================================
        // RESPUESTA FINAL
        // ==========================================
        return res.status(200).json(resultado);

    } catch (error) {

        console.error(
            'Error en buscar-ean:',
            error
        );

        return res.status(500).json({
            error: 'Error interno al procesar el código EAN.',
            detalle: error.message
        });
    }
}
