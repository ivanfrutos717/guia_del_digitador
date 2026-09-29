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
    console.log("BUSCANDO EN NISSEI:", consulta);
    console.log("====================================");

    const urlBusqueda =
      `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`;

    console.log("URL:", urlBusqueda);

    const respuesta = await fetch(urlBusqueda, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": "https://nissei.com/py/"
      }
    });

    console.log("STATUS NISSEI:", respuesta.status);

    if (!respuesta.ok) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Nissei no respondió correctamente",
        status: respuesta.status
      });
    }

    const html = await respuesta.text();

    console.log("HTML RECIBIDO:", html.length, "caracteres");

    // ---------------------------------------------------------
    // BUSCAR LINKS DE PRODUCTOS
    // ---------------------------------------------------------

    const links = [];

    const regexLinks = /href=["']([^"']+)["']/gi;

    let match;

    while ((match = regexLinks.exec(html)) !== null) {
      let url = match[1];

      if (!url) continue;

      // Convertir URLs relativas en absolutas
      if (url.startsWith("/")) {
        url = "https://nissei.com" + url;
      }

      // Solo productos de Nissei
      if (
        url.includes("nissei.com/py/") &&
        !url.includes("/catalogsearch/") &&
        !url.includes("/customer/") &&
        !url.includes("/checkout/") &&
        !url.includes("/category/")
      ) {
        links.push(url);
      }
    }

    console.log("LINKS ENCONTRADOS:", links.length);

    // Eliminar duplicados
    const linksUnicos = [...new Set(links)];

    console.log("LINKS ÚNICOS:", linksUnicos.length);

    // ---------------------------------------------------------
    // BUSCAR UN LINK QUE CONTENGA LA CONSULTA
    // ---------------------------------------------------------

    const consultaNormalizada = normalizar(consulta);

    let productoUrl = null;

    for (const link of linksUnicos) {
      const linkNormalizado = normalizar(link);

      if (linkNormalizado.includes(consultaNormalizada)) {
        productoUrl = link;
        break;
      }
    }

    // ---------------------------------------------------------
    // SI NO ENCUENTRA EXACTAMENTE, BUSCAR POR PARTES
    // ---------------------------------------------------------

    if (!productoUrl) {
      const partes = consultaNormalizada
        .split(/[-_\s]+/)
        .filter(Boolean);

      console.log("PARTES:", partes);

      for (const link of linksUnicos) {
        const linkNormalizado = normalizar(link);

        const coincide = partes.every(parte =>
          linkNormalizado.includes(parte)
        );

        if (coincide) {
          productoUrl = link;
          break;
        }
      }
    }

    console.log("PRODUCTO ENCONTRADO:", productoUrl);

    // ---------------------------------------------------------
    // SI NO ENCONTRÓ LINK
    // ---------------------------------------------------------

    if (!productoUrl) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "No se encontró el producto en Nissei.",
        diagnostico: {
          status: respuesta.status,
          htmlCaracteres: html.length,
          linksEncontrados: linksUnicos.length
        }
      });
    }

    // ---------------------------------------------------------
    // ABRIR PÁGINA DEL PRODUCTO
    // ---------------------------------------------------------

    console.log("ABRIENDO PRODUCTO:", productoUrl);

    const productoResponse = await fetch(productoUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Referer": urlBusqueda
      }
    });

    console.log("STATUS PRODUCTO:", productoResponse.status);

    if (!productoResponse.ok) {
      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje: "Se encontró el producto pero no se pudo abrir la página",
        url: productoUrl
      });
    }

    const productoHtml = await productoResponse.text();

    console.log(
      "HTML PRODUCTO:",
      productoHtml.length,
      "caracteres"
    );

    // ---------------------------------------------------------
    // EXTRAER INFORMACIÓN
    // ---------------------------------------------------------

    const datos = extraerProducto(productoHtml, consulta);

    console.log("DATOS EXTRAÍDOS:", datos);

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
    console.error("ERROR API:", error);

    return res.status(500).json({
      encontrado: false,
      mensaje: "Error interno",
      error: error.message
    });
  }
}


// ============================================================
// FUNCIONES
// ============================================================

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}


// ============================================================
// EXTRAER PRODUCTO
// ============================================================

function extraerProducto(html, consulta) {

  let nombre = "";
  let marca = "";
  let modelo = consulta;
  let color = "";
  let ean = "";

  // ----------------------------------------------------------
  // JSON-LD
  // ----------------------------------------------------------

  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let jsonMatch;

  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {

    try {

      const json = JSON.parse(jsonMatch[1].trim());

      const objetos = Array.isArray(json)
        ? json
        : [json];

      for (const obj of objetos) {

        if (!obj || typeof obj !== "object") continue;

        if (obj["@type"] === "Product" || obj.name) {

          if (!nombre && obj.name) {
            nombre = limpiarTexto(obj.name);
          }

          if (!marca && obj.brand) {

            if (typeof obj.brand === "string") {
              marca = obj.brand;
            } else if (obj.brand.name) {
              marca = obj.brand.name;
            }
          }

          if (!ean && obj.gtin) {
            ean = String(obj.gtin);
          }

          if (!ean && obj.gtin12) {
            ean = String(obj.gtin12);
          }

          if (!ean && obj.gtin13) {
            ean = String(obj.gtin13);
          }

          if (!ean && obj.gtin14) {
            ean = String(obj.gtin14);
          }
        }
      }

    } catch (error) {
      // Ignorar JSON-LD inválido
    }
  }


  // ----------------------------------------------------------
  // TITLE
  // ----------------------------------------------------------

  if (!nombre) {

    const titleMatch =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

    if (titleMatch) {
      nombre = limpiarTexto(titleMatch[1]);
    }
  }


  // ----------------------------------------------------------
  // META OG TITLE
  // ----------------------------------------------------------

  if (!nombre) {

    const ogTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      );

    if (ogTitle) {
      nombre = limpiarTexto(ogTitle[1]);
    }
  }


  // ----------------------------------------------------------
  // MARCA
  // ----------------------------------------------------------

  if (!marca) {

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
      "Sandisk",
      "Western Digital",
      "Intel",
      "AMD",
      "Philips",
      "LG",
      "Hisense",
      "Epson",
      "Brother"
    ];

    const texto = `${nombre} ${html}`;

    for (const marcaDetectada of marcas) {

      const regex = new RegExp(
        `\\b${escaparRegex(marcaDetectada)}\\b`,
        "i"
      );

      if (regex.test(texto)) {
        marca = marcaDetectada;
        break;
      }
    }
  }


  // ----------------------------------------------------------
  // MODELO
  // ----------------------------------------------------------

  if (!modelo || modelo === consulta) {

    const texto = nombre;

    const modelos = texto.match(
      /\b[A-Z0-9]{2,}(?:[-_][A-Z0-9]+)+\b/i
    );

    if (modelos) {
      modelo = modelos[0];
    }
  }


  // ----------------------------------------------------------
  // EAN
  // ----------------------------------------------------------

  if (!ean) {

    const eanMatch =
      html.match(/\b\d{12,14}\b/);

    if (eanMatch) {
      ean = eanMatch[0];
    }
  }


  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

  const colores = [
    ["Blanco", ["blanco", "white"]],
    ["Negro", ["negro", "black"]],
    ["Azul", ["azul", "blue"]],
    ["Rojo", ["rojo", "red"]],
    ["Verde", ["verde", "green"]],
    ["Gris", ["gris", "gray", "grey"]],
    ["Plata", ["plata", "silver"]],
    ["Dorado", ["dorado", "gold"]],
    ["Rosa", ["rosa", "pink"]],
    ["Morado", ["morado", "purple"]],
    ["Violeta", ["violeta"]],
    ["Amarillo", ["amarillo", "yellow"]],
    ["Naranja", ["naranja", "orange"]]
  ];

  const textoColor = `${nombre} ${html}`.toLowerCase();

  for (const [nombreColor, palabras] of colores) {

    for (const palabra of palabras) {

      if (
        new RegExp(
          `\\b${escaparRegex(palabra)}\\b`,
          "i"
        ).test(textoColor)
      ) {
        color = nombreColor;
        break;
      }
    }

    if (color) break;
  }


  // ----------------------------------------------------------
  // TIPO DE PRODUCTO
  // ----------------------------------------------------------

  const tipoProducto = detectarTipoProducto(nombre);


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
// DETECTAR TIPO
// ============================================================

function detectarTipoProducto(nombre) {

  const texto = String(nombre || "").toLowerCase();

  if (
    texto.includes("playstation") ||
    texto.includes("ps5") ||
    texto.includes("xbox") ||
    texto.includes("nintendo")
  ) {
    return "Consola";
  }

  if (
    texto.includes("iphone") ||
    texto.includes("smartphone") ||
    texto.includes("celular") ||
    texto.includes("galaxy")
  ) {
    return "Celular";
  }

  if (
    texto.includes("notebook") ||
    texto.includes("laptop") ||
    texto.includes("macbook")
  ) {
    return "Notebook";
  }

  if (
    texto.includes("monitor")
  ) {
    return "Monitor";
  }

  if (
    texto.includes("televisor") ||
    texto.includes("smart tv") ||
    texto.includes("tv ")
  ) {
    return "Televisor";
  }

  if (
    texto.includes("mouse")
  ) {
    return "Mouse";
  }

  if (
    texto.includes("teclado")
  ) {
    return "Teclado";
  }

  if (
    texto.includes("headset") ||
    texto.includes("fone") ||
    texto.includes("auricular")
  ) {
    return "Auricular";
  }

  if (
    texto.includes("ssd") ||
    texto.includes("hd externo") ||
    texto.includes("disco rigido")
  ) {
    return "Almacenamiento";
  }

  if (
    texto.includes("memoria ram") ||
    texto.includes("ram ")
  ) {
    return "Memoria RAM";
  }

  if (
    texto.includes("impresora")
  ) {
    return "Impresora";
  }

  return "Producto";
}


// ============================================================
// UTILIDADES
// ============================================================

function limpiarTexto(texto) {

  return String(texto || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}


function escaparRegex(texto) {

  return String(texto)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
