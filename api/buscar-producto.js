// api/buscar-producto.js

export default async function handler(req, res) {
  try {
    const consulta = String(req.query.consulta || "").trim();

    if (!consulta) {
      return res.status(400).json({
        encontrado: false,
        mensaje: "Falta la consulta."
      });
    }

    // =========================================================
    // 1. BUSCAR EN NISSEI
    // =========================================================

    const urlBusquedaNissei =
      `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`;

    const urlReader =
      `https://r.jina.ai/${urlBusquedaNissei}`;

    const respuestaBusqueda = await fetch(urlReader, {
      headers: {
        "Accept": "application/json",
        "X-With-Links-Summary": "all",
        "X-Retain-Images": "none",
        "X-Timeout": "20"
      }
    });

    if (!respuestaBusqueda.ok) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Nissei no respondió correctamente.",
        status: respuestaBusqueda.status
      });
    }

    const textoRespuesta = await respuestaBusqueda.text();

    let datosReader;

    try {
      datosReader = JSON.parse(textoRespuesta);
    } catch (error) {
      datosReader = {
        data: {
          content: textoRespuesta
        }
      };
    }

    const contenido =
      datosReader?.data?.content ||
      datosReader?.content ||
      textoRespuesta ||
      "";

    // =========================================================
    // 2. OBTENER ENLACES DE LA PÁGINA DE NISSEI
    // =========================================================

    const urls = extraerUrlsNissei(datosReader, contenido);

    // =========================================================
    // 3. ENCONTRAR EL PRODUCTO QUE CORRESPONDE
    // =========================================================

    const urlProducto = encontrarMejorProducto(urls, consulta);

    if (!urlProducto) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Nissei respondió, pero no encontramos el producto.",
        diagnostico: {
          cantidadUrls: urls.length,
          urls: urls.slice(0, 20)
        }
      });
    }

    // =========================================================
    // 4. LEER LA FICHA REAL DEL PRODUCTO
    // =========================================================

    const urlProductoReader =
      `https://r.jina.ai/${urlProducto}`;

    const respuestaProducto = await fetch(urlProductoReader, {
      headers: {
        "Accept": "application/json",
        "X-Retain-Images": "none",
        "X-Timeout": "20"
      }
    });

    if (!respuestaProducto.ok) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Encontramos el producto, pero no pudimos leer su ficha.",
        status: respuestaProducto.status,
        url: urlProducto
      });
    }

    const textoProducto = await respuestaProducto.text();

    let datosProductoReader;

    try {
      datosProductoReader = JSON.parse(textoProducto);
    } catch (error) {
      datosProductoReader = {
        data: {
          content: textoProducto
        }
      };
    }

    const contenidoProducto =
      datosProductoReader?.data?.content ||
      datosProductoReader?.content ||
      textoProducto ||
      "";

    // =========================================================
    // 5. EXTRAER INFORMACIÓN
    // =========================================================

    const producto = extraerDatosProducto(
      contenidoProducto,
      consulta,
      urlProducto
    );

    if (!producto.modelo && !producto.nombre) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Encontramos la página, pero no pudimos identificar los datos del producto.",
        url: urlProducto
      });
    }

    // =========================================================
    // 6. RESPUESTA FINAL
    // =========================================================

    return res.status(200).json({
      encontrado: true,
      nombre: producto.nombre,
      marca: producto.marca,
      modelo: producto.modelo,
      tipoProducto: producto.tipoProducto,
      color: producto.color,
      ean: producto.ean,
      fuente: "Nissei",
      url: urlProducto
    });

  } catch (error) {
    console.error("ERROR buscar-producto:", error);

    return res.status(500).json({
      encontrado: false,
      mensaje: "Error interno en buscar-producto.",
      error: error.message
    });
  }
}


// ============================================================
// EXTRAER URLS DE NISSEI
// ============================================================

function extraerUrlsNissei(reader, contenido) {
  const encontrados = new Set();

  // ----------------------------------------------------------
  // A. Links entregados por X-With-Links-Summary
  // ----------------------------------------------------------

  const links =
    reader?.data?.links ||
    reader?.links ||
    null;

  if (links) {

    // Si Jina devuelve objeto:
    if (typeof links === "object" && !Array.isArray(links)) {

      for (const [url, texto] of Object.entries(links)) {

        if (typeof url === "string") {
          agregarUrl(url, encontrados);
        }

        // Por si la estructura viniera invertida
        if (typeof texto === "string") {
          const urlsTexto = extraerUrlsDeTexto(texto);

          urlsTexto.forEach(url => {
            agregarUrl(url, encontrados);
          });
        }
      }
    }

    // Si Jina devuelve array
    if (Array.isArray(links)) {

      for (const item of links) {

        if (typeof item === "string") {
          agregarUrl(item, encontrados);
        }

        if (item && typeof item === "object") {

          const posibles = [
            item.url,
            item.href,
            item.link,
            item.target
          ];

          posibles.forEach(url => {
            if (typeof url === "string") {
              agregarUrl(url, encontrados);
            }
          });
        }
      }
    }
  }

  // ----------------------------------------------------------
  // B. Buscar URLs dentro del contenido
  // ----------------------------------------------------------

  const urlsContenido = extraerUrlsDeTexto(contenido);

  urlsContenido.forEach(url => {
    agregarUrl(url, encontrados);
  });

  return Array.from(encontrados);
}


// ============================================================
// EXTRAER URLS DESDE TEXTO
// ============================================================

function extraerUrlsDeTexto(texto) {
  if (!texto) return [];

  const resultado = new Set();

  const regex =
    /https?:\/\/(?:www\.)?nissei\.com\/py\/[^\s<>"')\]]+/gi;

  const coincidencias = texto.match(regex) || [];

  for (const url of coincidencias) {
    resultado.add(limpiarUrl(url));
  }

  // También soporta markdown:
  // [Producto](https://nissei.com/py/...)
  const markdownRegex =
    /\]\((https?:\/\/(?:www\.)?nissei\.com\/py\/[^)\s]+)\)/gi;

  let match;

  while ((match = markdownRegex.exec(texto)) !== null) {
    resultado.add(limpiarUrl(match[1]));
  }

  return Array.from(resultado);
}


// ============================================================
// AGREGAR URL VÁLIDA
// ============================================================

function agregarUrl(url, set) {
  if (!url || typeof url !== "string") return;

  if (!url.includes("nissei.com/py/")) return;

  const limpia = limpiarUrl(url);

  // No queremos páginas de búsqueda ni categorías
  if (
    limpia.includes("/catalogsearch/") ||
    limpia.includes("/category/") ||
    limpia.includes("/categoria/")
  ) {
    return;
  }

  set.add(limpia);
}


// ============================================================
// ENCONTRAR MEJOR PRODUCTO
// ============================================================

function encontrarMejorProducto(urls, consulta) {
  if (!urls.length) return null;

  const consultaNormalizada = normalizar(consulta);

  // ----------------------------------------------------------
  // 1. Coincidencia exacta del modelo en URL
  // ----------------------------------------------------------

  for (const url of urls) {

    const urlNormalizada = normalizar(url);

    if (urlNormalizada.includes(consultaNormalizada)) {
      return url;
    }
  }

  // ----------------------------------------------------------
  // 2. Comparación por partes
  // ----------------------------------------------------------

  const partes = consultaNormalizada
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  let mejorUrl = null;
  let mejorPuntaje = 0;

  for (const url of urls) {

    const urlNormalizada = normalizar(url);

    let puntaje = 0;

    for (const parte of partes) {

      if (parte.length >= 3 && urlNormalizada.includes(parte)) {
        puntaje++;
      }
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorUrl = url;
    }
  }

  if (mejorPuntaje > 0) {
    return mejorUrl;
  }

  // ----------------------------------------------------------
  // 3. Si solo existe un producto, usarlo
  // ----------------------------------------------------------

  if (urls.length === 1) {
    return urls[0];
  }

  return null;
}


// ============================================================
// EXTRAER DATOS DEL PRODUCTO
// ============================================================

function extraerDatosProducto(contenido, consulta, url) {

  const texto = limpiarTexto(contenido);

  let nombre = "";
  let marca = "";
  let modelo = "";
  let ean = "";
  let color = "";
  let tipoProducto = "";

  // ----------------------------------------------------------
  // NOMBRE
  // ----------------------------------------------------------

  const patronesNombre = [
    /#\s*(?:Consola|Console|Producto|Product)?\s*([^\n]+)/i,

    /title\s*[:|]\s*([^\n]+)/i,

    /(?:nombre del producto|nombre|product name)\s*[:|]\s*([^\n]+)/i
  ];

  for (const regex of patronesNombre) {

    const match = texto.match(regex);

    if (match && match[1]) {
      nombre = limpiarValor(match[1]);
      break;
    }
  }

  // Si no encontró nombre, buscar una línea que contenga el modelo
  if (!nombre) {

    const lineas = texto
      .split("\n")
      .map(l => limpiarValor(l))
      .filter(Boolean);

    const modeloConsulta = normalizar(consulta);

    const posible = lineas.find(linea =>
      normalizar(linea).includes(modeloConsulta)
    );

    if (posible) {
      nombre = posible;
    }
  }

  // ----------------------------------------------------------
  // MARCA
  // ----------------------------------------------------------

  const matchMarca = texto.match(
    /(?:marca|brand)\s*[:|]\s*([^\n]+)/i
  );

  if (matchMarca) {
    marca = limpiarValor(matchMarca[1]);
  }

  // Si no aparece campo Marca, intentar detectar marcas conocidas
  if (!marca) {

    const marcas = [
      "Sony",
      "Samsung",
      "LG",
      "Apple",
      "Lenovo",
      "HP",
      "Dell",
      "Asus",
      "ASUS",
      "Acer",
      "Xiaomi",
      "Motorola",
      "Nintendo",
      "Microsoft",
      "Logitech",
      "JBL",
      "Philips",
      "Epson",
      "Canon",
      "Nikon",
      "Kingston",
      "Seagate",
      "Western Digital",
      "WD",
      "Intel",
      "AMD"
    ];

    for (const marcaPosible of marcas) {

      const regex = new RegExp(
        `\\b${escaparRegex(marcaPosible)}\\b`,
        "i"
      );

      if (regex.test(texto)) {
        marca = marcaPosible;
        break;
      }
    }
  }

  // ----------------------------------------------------------
  // MODELO
  // ----------------------------------------------------------

  const matchPartNumber = texto.match(
    /(?:Part Number|Part number|Modelo|Model|SKU)\s*[:|]\s*([A-Z0-9][A-Z0-9._-]{2,})/i
  );

  if (matchPartNumber) {
    modelo = limpiarValor(matchPartNumber[1]);
  }

  // Si no encontró, usar la consulta cuando parece modelo
  if (!modelo && /[a-z]/i.test(consulta)) {
    modelo = consulta;
  }

  // ----------------------------------------------------------
  // EAN
  // ----------------------------------------------------------

  const matchEan = texto.match(
    /(?:EAN-13|EAN-12|EAN|UPC)\s*[:|]\s*(\d{8,14})/i
  );

  if (matchEan) {
    ean = matchEan[1];
  }

  // También buscar cualquier EAN cercano
  if (!ean) {

    const matchNumero = texto.match(
      /\b(\d{12,14})\b/
    );

    if (matchNumero) {
      ean = matchNumero[1];
    }
  }

  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

  const matchColor = texto.match(
    /(?:Color|Cor|Colour)\s*[:|]\s*([^\n]+)/i
  );

  if (matchColor) {
    color = convertirColor(limpiarValor(matchColor[1]));
  }

  // ----------------------------------------------------------
  // TIPO DE PRODUCTO
  // ----------------------------------------------------------

  tipoProducto = detectarTipoProducto(
    nombre || texto
  );

  // ----------------------------------------------------------
  // SI EL NOMBRE ESTÁ VACÍO
  // ----------------------------------------------------------

  if (!nombre) {
    nombre = `Producto ${modelo || consulta}`;
  }

  return {
    nombre,
    marca,
    modelo,
    ean,
    color,
    tipoProducto,
    url
  };
}


// ============================================================
// DETECTAR TIPO DE PRODUCTO
// ============================================================

function detectarTipoProducto(texto) {

  const t = normalizar(texto);

  if (
    t.includes("playstation") ||
    t.includes("xbox") ||
    t.includes("nintendo switch") ||
    t.includes("consola")
  ) {
    return "Consola";
  }

  if (
    t.includes("notebook") ||
    t.includes("laptop") ||
    t.includes("computadora portatil")
  ) {
    return "Notebook";
  }

  if (
    t.includes("celular") ||
    t.includes("smartphone") ||
    t.includes("telefono")
  ) {
    return "Celular";
  }

  if (
    t.includes("monitor")
  ) {
    return "Monitor";
  }

  if (
    t.includes("televisor") ||
    t.includes("tv ")
  ) {
    return "Televisor";
  }

  if (
    t.includes("tablet")
  ) {
    return "Tablet";
  }

  if (
    t.includes("teclado")
  ) {
    return "Teclado";
  }

  if (
    t.includes("mouse") ||
    t.includes("raton")
  ) {
    return "Mouse";
  }

  if (
    t.includes("auricular") ||
    t.includes("headset") ||
    t.includes("fone")
  ) {
    return "Auricular";
  }

  if (
    t.includes("impresora")
  ) {
    return "Impresora";
  }

  if (
    t.includes("camara")
  ) {
    return "Cámara";
  }

  if (
    t.includes("ssd") ||
    t.includes("disco solido")
  ) {
    return "SSD";
  }

  if (
    t.includes("disco duro") ||
    t.includes("hard disk")
  ) {
    return "Disco Duro";
  }

  if (
    t.includes("memoria ram") ||
    t.includes("ram ")
  ) {
    return "Memoria RAM";
  }

  return "";
}


// ============================================================
// CONVERTIR COLOR
// ============================================================

function convertirColor(valor) {

  const color = normalizar(valor);

  const colores = {
    white: "Blanco",
    blanco: "Blanco",

    black: "Negro",
    negro: "Negro",

    blue: "Azul",
    azul: "Azul",

    red: "Rojo",
    rojo: "Rojo",

    green: "Verde",
    verde: "Verde",

    gray: "Gris",
    grey: "Gris",
    gris: "Gris",

    silver: "Plateado",
    plateado: "Plateado",

    gold: "Dorado",
    dorado: "Dorado",

    pink: "Rosa",
    rosa: "Rosa",

    purple: "Violeta",
    violeta: "Violeta"
  };

  return colores[color] || valor;
}


// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(texto) {

  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}


// ============================================================
// LIMPIAR URL
// ============================================================

function limpiarUrl(url) {

  return String(url || "")
    .replace(/[)\],.;]+$/, "")
    .replace(/&amp;/g, "&")
    .trim();
}


// ============================================================
// LIMPIAR TEXTO
// ============================================================

function limpiarTexto(texto) {

  return String(texto || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


// ============================================================
// LIMPIAR VALOR
// ============================================================

function limpiarValor(valor) {

  return String(valor || "")
    .replace(/^[:|•\-]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// ESCAPAR REGEX
// ============================================================

function escaparRegex(texto) {

  return String(texto || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
