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

    // Dejar solamente números
    const eanLimpio = String(ean).replace(/\D/g, '');

    // Validar longitud
    if (![8, 12, 13].includes(eanLimpio.length)) {
        return res.status(400).json({
            error: 'El código EAN/UPC no tiene una longitud válida.',
            ean: eanLimpio
        });
    }

    // ==========================================
    // CONSULTAR UPCitemdb
    // ==========================================
    const url =
        `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(eanLimpio)}`;

    try {
        const apiResponse = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        const responseText = await apiResponse.text();

        console.log(
            'Respuesta UPCitemdb:',
            apiResponse.status,
            responseText
        );

        // ==========================================
        // PRODUCTO NO ENCONTRADO
        // ==========================================
        if (apiResponse.status === 404) {
            return res.status(200).json({
                encontrado: false,
                ean: eanLimpio,
                marca: '',
                modelo: '',
                tipoProducto: '',
                color: '',
                mensaje: 'Producto no encontrado en UPCitemdb.'
            });
        }

        // ==========================================
        // ERROR DE UPCitemdb
        // ==========================================
        if (!apiResponse.ok) {
            return res.status(502).json({
                error: 'Error al consultar la base de datos de productos.',
                codigo: apiResponse.status,
                detalle: responseText
            });
        }

        // ==========================================
        // CONVERTIR RESPUESTA
        // ==========================================
        let data;

        try {
            data = JSON.parse(responseText);
        } catch (error) {
            return res.status(502).json({
                error: 'UPCitemdb devolvió una respuesta inválida.',
                detalle: responseText
            });
        }

        // ==========================================
        // VERIFICAR SI HAY PRODUCTOS
        // ==========================================
        if (
            !data.items ||
            !Array.isArray(data.items) ||
            data.items.length === 0
        ) {
            return res.status(200).json({
                encontrado: false,
                ean: eanLimpio,
                marca: '',
                modelo: '',
                tipoProducto: '',
                color: '',
                mensaje: 'Producto no encontrado en UPCitemdb.'
            });
        }

        // Tomamos el primer resultado
        const producto = data.items[0];

        // ==========================================
        // OBTENER DATOS
        // ==========================================

        const marca = String(
            producto.brand || ''
        ).trim();

        const modelo = String(
            producto.model ||
            producto.title ||
            ''
        ).trim();

        const tipoProducto = String(
            producto.category || ''
        ).trim();

        const color = String(
            producto.color || ''
        ).trim();

        // ==========================================
        // RESPUESTA
        // ==========================================
        return res.status(200).json({
            encontrado: true,

            ean: String(
                producto.ean ||
                producto.upc ||
                eanLimpio
            ),

            marca: marca,

            modelo: modelo,

            tipoProducto: tipoProducto,

            color: color,

            // Información adicional útil
            titulo: String(
                producto.title || ''
            ).trim(),

            descripcion: String(
                producto.description || ''
            ).trim(),

            imagenes: Array.isArray(producto.images)
                ? producto.images
                : []
        });

    } catch (error) {
        console.error(
            'Error consultando UPCitemdb:',
            error
        );

        return res.status(500).json({
            error: 'Error interno al consultar la base de productos.',
            detalle: error.message
        });
    }
}
