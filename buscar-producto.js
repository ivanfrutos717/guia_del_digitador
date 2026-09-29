// ==========================================================================
// VERCEL SERVERLESS FUNCTION
// Ruta: /api/buscar-ean
// Gemini + Google Search
// ==========================================================================

export default async function handler(req, res) {

  // ------------------------------------------------------------------------
  // CORS
  // ------------------------------------------------------------------------
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {

    return res.status(405).json({
      error: "Método no permitido. Usa GET."
    });
  }

  // ------------------------------------------------------------------------
  // OBTENER EAN
  // ------------------------------------------------------------------------
  const ean =
    String(req.query?.ean || "")
      .replace(/\D/g, "");

  if (!ean) {

    return res.status(400).json({
      error:
        "El código EAN/UPC es obligatorio."
    });
  }

  // ------------------------------------------------------------------------
  // VALIDAR LONGITUD
  // ------------------------------------------------------------------------
  if (![8, 12, 13].includes(ean.length)) {

    return res.status(400).json({
      error:
        "El código debe tener 8, 12 o 13 dígitos.",
      ean
    });
  }

  // ------------------------------------------------------------------------
  // OBTENER API KEY DESDE VERCEL
  // ------------------------------------------------------------------------
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {

    console.error(
      "Falta GEMINI_API_KEY en Vercel."
    );

    return res.status(500).json({
      error:
        "GEMINI_API_KEY no está configurada en Vercel."
    });
  }

  // ------------------------------------------------------------------------
  // PROMPT
  // ------------------------------------------------------------------------
  const prompt = `
Necesito identificar un producto comercial
a partir de un código de barras.

CÓDIGO EAN/UPC:
${ean}

Usa Google Search para investigar este código.

REGLA CRÍTICA:

Solo debes devolver encontrado=true
si encuentras evidencia de que EL MISMO
código ${ean} corresponde al producto identificado.

NO confundas:

- números de modelo con códigos EAN/UPC;
- códigos de otras variantes;
- códigos parecidos;
- productos de la misma familia;
- resultados que mencionen la marca pero no
  el EAN exacto.

Si encuentras el EAN exacto, extrae:

marca:
La marca comercial.

modelo:
El modelo o nombre comercial específico
del producto.

tipoProducto:
Una categoría sencilla y útil para cadastro.

Ejemplos:

SPEAKER
AURICULAR
TELEVISOR
CELULAR
NOTEBOOK
MOUSE
TECLADO
MONITOR
CARGADOR
MEMORIA
IMPRESORA

color:
El color o variante de color del producto.

Si las fuentes no permiten determinar
el color con seguridad, usa una cadena vacía.

Si NO puedes verificar que el EAN exacto
corresponde al producto, devuelve:

encontrado=false
marca="NO_ENCONTRADO"
modelo=""
tipoProducto=""
color=""

NO INVENTES información.
`.trim();

  // ------------------------------------------------------------------------
  // ENDPOINT GEMINI
  // ------------------------------------------------------------------------
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/interactions";

  // ------------------------------------------------------------------------
  // ESTRUCTURA DE RESPUESTA
  // ------------------------------------------------------------------------
  const schema = {

    type: "object",

    properties: {

      encontrado: {
        type: "boolean",
        description:
          "true solamente si el EAN exacto fue verificado."
      },

      ean: {
        type: "string",
        description:
          "El EAN/UPC consultado."
      },

      marca: {
        type: "string"
      },

      modelo: {
        type: "string"
      },

      tipoProducto: {
        type: "string"
      },

      color: {
        type: "string"
      }
    },

    required: [
      "encontrado",
      "ean",
      "marca",
      "modelo",
      "tipoProducto",
      "color"
    ]
  };

  // ------------------------------------------------------------------------
  // CONSULTAR GEMINI
  // ------------------------------------------------------------------------
  try {

    console.log(
      `Consultando Gemini para EAN ${ean}`
    );

    const apiResponse =
      await fetch(endpoint, {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey
        },

        body: JSON.stringify({

          model:
            "gemini-3.8-flash",

          input:
            prompt,

          tools: [

            {
              type:
                "google_search"
            }

          ],

          response_format: {

            type:
              "text",

            mime_type:
              "application/json",

            schema:
              schema
          }
        })
      });

    // ----------------------------------------------------------------------
    // LEER RESPUESTA
    // ----------------------------------------------------------------------
    const responseText =
      await apiResponse.text();

    let data;

    try {

      data =
        JSON.parse(responseText);

    } catch {

      console.error(
        "Gemini no devolvió JSON válido:",
        responseText
      );

      return res.status(502).json({

        error:
          "Gemini devolvió una respuesta no válida.",

        detalle:
          responseText.substring(
            0,
            1000
          )
      });
    }

    // ----------------------------------------------------------------------
    // ERROR DE GEMINI
    // ----------------------------------------------------------------------
    if (!apiResponse.ok) {

      console.error(
        `Gemini HTTP ${apiResponse.status}:`,
        JSON.stringify(data)
      );

      return res.status(502).json({

        error:
          "Gemini rechazó la consulta.",

        statusGemini:
          apiResponse.status,

        detalle:
          data?.error?.message ||
          data
      });
    }

    // ----------------------------------------------------------------------
    // EXTRAER RESPUESTA DEL MODELO
    // ----------------------------------------------------------------------
    const rawText =
      data?.output_text ||

      data?.steps
        ?.filter(
          (step) =>
            step?.type ===
            "model_output"
        )
        ?.flatMap(
          (step) =>
            step?.content || []
        )
        ?.filter(
          (content) =>
            content?.type ===
            "text"
        )
        ?.map(
          (content) =>
            content?.text
        )
        ?.join("") ||

      "";

    if (!rawText) {

      console.error(
        "Gemini no devolvió output_text:",
        data
      );

      return res.status(502).json({

        error:
          "Gemini no devolvió información del producto."
      });
    }

    // ----------------------------------------------------------------------
    // CONVERTIR JSON
    // ----------------------------------------------------------------------
    let productoInfo;

    try {

      productoInfo =
        JSON.parse(rawText);

    } catch (error) {

      console.error(
        "No se pudo interpretar el JSON:",
        rawText
      );

      return res.status(502).json({

        error:
          "Gemini devolvió datos que no pudieron convertirse en JSON.",

        detalle:
          rawText.substring(
            0,
            1000
          )
      });
    }

    // ----------------------------------------------------------------------
    // NORMALIZAR RESPUESTA
    // ----------------------------------------------------------------------
    const resultado = {

      encontrado:
        productoInfo?.encontrado === true,

      ean:
        ean,

      marca:
        String(
          productoInfo?.marca || ""
        ).trim(),

      modelo:
        String(
          productoInfo?.modelo || ""
        ).trim(),

      tipoProducto:
        String(
          productoInfo?.tipoProducto || ""
        ).trim(),

      color:
        String(
          productoInfo?.color || ""
        ).trim()
    };

    // ----------------------------------------------------------------------
    // PRODUCTO NO ENCONTRADO
    // ----------------------------------------------------------------------
    if (!resultado.encontrado) {

      resultado.marca =
        "NO_ENCONTRADO";

      resultado.modelo =
        "";

      resultado.tipoProducto =
        "";

      resultado.color =
        "";

      console.log(
        `EAN ${ean}: no encontrado.`
      );
    }

    // ----------------------------------------------------------------------
    // VALIDAR RESPUESTA POSITIVA
    // ----------------------------------------------------------------------
    else {

      if (
        !resultado.marca ||
        !resultado.modelo ||
        !resultado.tipoProducto
      ) {

        console.warn(
          `EAN ${ean}: Gemini marcó encontrado=true pero faltan atributos.`
        );

        return res.status(200).json({

          encontrado:
            false,

          ean:
            ean,

          marca:
            "NO_ENCONTRADO",

          modelo:
            "",

          tipoProducto:
            "",

          color:
            ""
        });
      }

      console.log(
        `EAN ${ean}: producto encontrado.`,
        resultado
      );
    }

    // ----------------------------------------------------------------------
    // RESPUESTA FINAL
    // ----------------------------------------------------------------------
    return res.status(200).json(
      resultado
    );

  } catch (error) {

    console.error(
      "Error interno en /api/buscar-ean:",
      error
    );

    return res.status(500).json({

      error:
        "Error interno del servidor al consultar Gemini.",

      detalle:
        error?.message ||
        String(error)
    });
  }
}
