// api/buscar-producto.js

export default async function handler(req, res) {
  try {
    const consulta = String(req.query.consulta || "").trim();

    if (!consulta) {
      return res.status(400).json({
        encontrado: false,
        mensaje: "Falta la consulta"
      });
    }

    console.log("====================================");
    console.log("BUSCANDO:", consulta);
    console.log("====================================");

    // ---------------------------------------------------------
    // 1. BUSCAR EN NISSEI A TRAVÉS DE JINA
    // ---------------------------------------------------------

    const urlNissei =
      `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`;

    const urlJina =
      `https://r.jina.ai/${urlNissei}`;

    console.log("URL JINA:");
    console.log(urlJina);

    const respuesta = await fetch(urlJina, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0"
      }
    });

    console.log("STATUS JINA:", respuesta.status);

    if (!respuesta.ok) {
      const textoError = await respuesta.text();

      console.log("ERROR JINA:", textoError.substring(0, 1000));

      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Jina no pudo consultar Nissei",
        status: respuesta.status
      });
    }

    const contenido = await respuesta.text();

    console.log(
      "CONTENIDO JINA:",
      contenido.length,
      "caracteres"
    );

    console.log(
      contenido.substring(0, 3000)
    );

    // ---------------------------------------------------------
    // 2. BUSCAR URL DEL PRODUCTO
    // ---------------------------------------------------------

    const urls = extraerUrls(contenido);

    console.log("URLS ENCONTRADAS:", urls.length);

    const consultaNormalizada = normalizar(consulta);

    let productoUrl = null;

    // Primero: coincidencia exacta
    for (const url of urls) {

      const urlNormalizada = normalizar(url);

      if (urlNormalizada.includes(consultaNormalizada)) {
        productoUrl = limpiarUrl(url);
        break;
      }
    }

    // Segundo: buscar por partes
    if (!productoUrl) {

      const partes = consultaNormalizada
        .split(/[-_\s]+/)
        .filter(Boolean);

      for (const url of urls) {

        const urlNormalizada = normalizar(url);

        const coincide = partes.every(parte =>
          urlNormalizada.includes(parte)
        );

        if (coincide) {
          productoUrl = limpiarUrl(url);
          break;
        }
      }
    }

    console.log("PRODUCTO URL:", productoUrl);

    // ---------------------------------------------------------
    // 3. SI NO ENCONTRÓ URL
    // ---------------------------------------------------------

    if (!productoUrl) {

      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Nissei respondió, pero no encontramos el enlace del producto.",
        diagnostico: {
          contenidoCaracteres: contenido.length,
          urlsEncontradas: urls.length
        }
      });
    }

    // ---------------------------------------------------------
    // 4. LEER PÁGINA DEL PRODUCTO CON JINA
    // ---------------------------------------------------------

    const productoJinaUrl =
      `https://r.jina.ai/${productoUrl}`;

    console.log(
      "LEYENDO PRODUCTO:",
      productoJinaUrl
    );

    const productoResponse = await fetch(productoJinaUrl, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0"
      }
    });

    console.log(
      "STATUS PRODUCTO JINA:",
      productoResponse.status
    );

    if (!productoResponse.ok) {

      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Encontramos el producto pero no pudimos leer sus datos.",
        url: productoUrl
      });
    }

    const productoTexto =
      await productoResponse.text();

    console.log(
      "PRODUCTO TEXTO:",
      productoTexto.length,
      "caracteres"
    );

    console.log(
      productoTexto.substring(0, 5000)
    );

    // ---------------------------------------------------------
    // 5. EXTRAER DATOS
    // ---------------------------------------------------------

    const datos =
      extraerDatosProducto(
        productoTexto,
        consulta
      );

    console.log("DATOS:", datos);

    // ---------------------------------------------------------
    // 6. RESPUESTA
    // ---------------------------------------------------------

    return res.status(200).json({

      encontrado: true,

      nombre: datos.nombre,

      marca: datos.marca,

      modelo: datos.modelo,

      tipoProducto: datos.tipoProducto,

      color: datos.color,

      ean: datos.ean,

      fuente: "Nissei",

      url: productoUrl

    });

  } catch (error) {

    console.error(
      "ERROR GENERAL:",
      error
    );

    return res.status(500).json({
      encontrado: false,
      mensaje: "Error interno",
      error: error.message
    });
  }
}


// ============================================================
// EXTRAER URLS
// ============================================================

function extraerUrls(texto) {

  const resultado = [];

  const regex =
    /https?:\/\/[^\s<>"')]+/gi;

  let match;

  while ((match = regex.exec(texto)) !== null) {

    let url = match[0];

    url = url.replace(
      /[.,;]+$/,
      ""
    );

    if (
      url.includes("nissei.com/py/")
    ) {
      resultado.push(url);
    }
  }

  return [
    ...new Set(resultado)
  ];
}


// ============================================================
// LIMPIAR URL
// ============================================================

function limpiarUrl(url) {

  return String(url)
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/[.,;]+$/, "");
}


// ============================================================
// EXTRAER DATOS DEL PRODUCTO
// ============================================================

function extraerDatosProducto(
  texto,
  consulta
) {

  const limpio = String(texto || "");

  let nombre = "";
  let marca = "";
  let modelo = consulta;
  let color = "";
  let ean = "";

  // ----------------------------------------------------------
  // NOMBRE
  // ----------------------------------------------------------

  const tituloMatch =
    limpio.match(
      /(?:#\s*)?(.{10,200}(?:CFI|PlayStation|PS5).{0,200})/i
    );

  if (tituloMatch) {
    nombre = limpiarTexto(
      tituloMatch[1]
    );
  }

  // Buscar primera línea que parezca título
  if (!nombre) {

    const lineas =
      limpio
        .split("\n")
        .map(x => x.trim())
        .filter(Boolean);

    for (const linea of lineas) {

      if (
        /playstation|sony|cfi-/i.test(linea) &&
        linea.length < 300
      ) {
        nombre = linea;
        break;
      }
    }
  }


  // ----------------------------------------------------------
  // MARCA
  // ----------------------------------------------------------

  const marcas = [
    "Sony",
    "Apple",
    "Samsung",
    "Xiaomi",
    "Motorola",
    "Huawei",
    "Lenovo",
    "Asus",
    "Acer",
    "Dell",
    "HP",
    "JBL",
    "Logitech",
    "Canon",
    "Nikon",
    "Nintendo",
    "Microsoft",
    "Kingston",
    "SanDisk",
    "LG",
    "Philips",
    "Epson",
    "Brother"
  ];

  const textoCompleto =
    `${nombre}\n${limpio}`;

  for (const m of marcas) {

    const regex =
      new RegExp(
        `\\b${escaparRegex(m)}\\b`,
        "i"
      );

    if (regex.test(textoCompleto)) {
      marca = m;
      break;
    }
  }


  // ----------------------------------------------------------
  // MODELO
  // ----------------------------------------------------------

  const modeloMatch =
    limpio.match(
      /\b[A-Z]{2,}[0-9]+[A-Z0-9-]*\b/i
    );

  if (modeloMatch) {
    modelo = modeloMatch[0];
  }


  // ----------------------------------------------------------
  // EAN
  // ----------------------------------------------------------

  const eanMatch =
    limpio.match(
      /(?:EAN(?:-12|-13|-14)?|GTIN)[^\d]{0,20}(\d{12,14})/i
    );

  if (eanMatch) {

    ean = eanMatch[1];

  } else {

    // Fallback
    const numeros =
      limpio.match(
        /\b\d{12,14}\b/g
      );

    if (numeros && numeros.length) {
      ean = numeros[0];
    }
  }


  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

  const colores = [
    {
      nombre: "Blanco",
      palabras: ["white", "blanco"]
    },
    {
      nombre: "Negro",
      palabras: ["black", "negro"]
    },
    {
      nombre: "Azul",
      palabras: ["blue", "azul"]
    },
    {
      nombre: "Rojo",
      palabras: ["red", "rojo"]
    },
    {
      nombre: "Verde",
      palabras: ["green", "verde"]
    },
    {
      nombre: "Gris",
      palabras: ["gray", "grey", "gris"]
    },
    {
      nombre: "Plata",
      palabras: ["silver", "plata"]
    },
    {
      nombre: "Dorado",
      palabras: ["gold", "dorado"]
    },
    {
      nombre: "Rosa",
      palabras: ["pink", "rosa"]
    }
  ];

  for (const colorItem of colores) {

    for (const palabra of colorItem.palabras) {

      if (
        new RegExp(
          `\\b${escaparRegex(palabra)}\\b`,
          "i"
        ).test(textoCompleto)
      ) {
        color = colorItem.nombre;
        break;
      }
    }

    if (color) break;
  }


  // ----------------------------------------------------------
  // TIPO
  // ----------------------------------------------------------

  const tipoProducto =
    detectarTipoProducto(
      nombre || limpio
    );


  return {
    nombre,
    marca,
    modelo,
    tipoProducto,
    color,
    ean
  };
}


// ============================================================
// TIPO DE PRODUCTO
// ============================================================

function detectarTipoProducto(texto) {

  const t =
    String(texto || "")
      .toLowerCase();

  if (
    t.includes("playstation") ||
    t.includes("ps5") ||
    t.includes("xbox") ||
    t.includes("nintendo")
  ) {
    return "Consola";
  }

  if (
    t.includes("iphone") ||
    t.includes("smartphone") ||
    t.includes("celular") ||
    t.includes("galaxy")
  ) {
    return "Celular";
  }

  if (
    t.includes("notebook") ||
    t.includes("laptop") ||
    t.includes("macbook")
  ) {
    return "Notebook";
  }

  if (t.includes("monitor")) {
    return "Monitor";
  }

  if (
    t.includes("televisor") ||
    t.includes("smart tv") ||
    t.includes("television")
  ) {
    return "Televisor";
  }

  if (t.includes("mouse")) {
    return "Mouse";
  }

  if (t.includes("teclado")) {
    return "Teclado";
  }

  if (
    t.includes("headset") ||
    t.includes("auricular") ||
    t.includes("fone")
  ) {
    return "Auricular";
  }

  if (
    t.includes("ssd") ||
    t.includes("disco externo") ||
    t.includes("disco rigido")
  ) {
    return "Almacenamiento";
  }

  if (t.includes("impresora")) {
    return "Impresora";
  }

  return "Producto";
}


// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(texto) {

  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9]+/g,
      ""
    );
}


// ============================================================
// LIMPIAR TEXTO
// ============================================================

function limpiarTexto(texto) {

  return String(texto || "")
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// ESCAPAR REGEX
// ============================================================

function escaparRegex(texto) {

  return String(texto)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}
