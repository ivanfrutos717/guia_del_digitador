// ============================================================
// API UNIVERSAL DE BÚSQUEDA DE PRODUCTOS
// Primera fuente: NISSEI
// ============================================================

export default async function handler(req, res) {

  // ----------------------------------------------------------
  // CORS
  // ----------------------------------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      encontrado: false,
      mensaje: "Método no permitido"
    });
  }

  // ----------------------------------------------------------
  // CONSULTA
  // ----------------------------------------------------------
  const consulta = String(req.query.consulta || "").trim();

  if (!consulta) {
    return res.status(400).json({
      encontrado: false,
      mensaje: "No se recibió ninguna consulta"
    });
  }

  console.log("==========================================");
  console.log("BUSCADOR UNIVERSAL");
  console.log("Consulta:", consulta);
  console.log("==========================================");

  // ----------------------------------------------------------
  // NISSEI
  // ----------------------------------------------------------
  try {

    const resultado = await buscarNissei(consulta);

    if (resultado && resultado.encontrado) {

      console.log("==========================================");
      console.log("PRODUCTO ENCONTRADO EN NISSEI");
      console.log(resultado);
      console.log("==========================================");

      return res.status(200).json({
        encontrado: true,
        ...resultado,
        fuente: "Nissei"
      });
    }

  } catch (error) {

    console.error("ERROR NISSEI:", error);

  }

  // ----------------------------------------------------------
  // NO ENCONTRADO
  // ----------------------------------------------------------
  return res.status(200).json({
    encontrado: false,
    consulta,
    mensaje: "No se encontró el producto en Nissei.",
    diagnostico: "La API respondió correctamente, pero no pudo identificar un producto."
  });
}


// ============================================================
// BUSCAR EN NISSEI
// ============================================================

async function buscarNissei(consulta) {

  const urlBusqueda =
    `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`;

  console.log("URL búsqueda Nissei:");
  console.log(urlBusqueda);

  const response = await fetch(urlBusqueda, {

    method: "GET",

    headers: {

      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

      "Accept-Language":
        "es-PY,es;q=0.9,en-US;q=0.8,en;q=0.7",

      "Cache-Control":
        "no-cache",

      "Pragma":
        "no-cache",

      "Referer":
        "https://nissei.com/py/",

      "Upgrade-Insecure-Requests":
        "1"
    }
  });

  console.log("Status Nissei:", response.status);

  if (!response.ok) {

    console.log(
      "Nissei devolvió:",
      response.status,
      response.statusText
    );

    return null;
  }

  const html = await response.text();

  console.log("HTML recibido:", html.length, "caracteres");

  if (!html || html.length < 500) {

    console.log("HTML demasiado pequeño.");

    return null;
  }

  const htmlNormalizado = normalizar(html);
  const consultaNormalizada = normalizar(consulta);

  console.log(
    "Contiene consulta:",
    htmlNormalizado.includes(consultaNormalizada)
  );

  console.log(
    "Contiene PlayStation:",
    htmlNormalizado.includes("playstation")
  );

  // ----------------------------------------------------------
  // EXTRAER TODOS LOS ENLACES
  // ----------------------------------------------------------

  const enlaces = extraerEnlaces(html);

  console.log(
    "Cantidad de enlaces encontrados:",
    enlaces.length
  );

  // ----------------------------------------------------------
  // BUSCAR ENLACES QUE COINCIDAN CON LA CONSULTA
  // ----------------------------------------------------------

  const candidatos = [];

  for (const enlace of enlaces) {

    const textoNormalizado =
      normalizar(enlace.texto);

    const urlNormalizada =
      normalizar(enlace.url);

    let puntuacion = 0;

    // Coincidencia exacta del modelo
    if (
      textoNormalizado.includes(consultaNormalizada)
    ) {
      puntuacion += 100;
    }

    if (
      urlNormalizada.includes(consultaNormalizada)
    ) {
      puntuacion += 80;
    }

    // Coincidencia por partes
    const partes = dividirConsulta(consulta);

    for (const parte of partes) {

      if (
        parte.length >= 3 &&
        textoNormalizado.includes(normalizar(parte))
      ) {
        puntuacion += 10;
      }

      if (
        parte.length >= 3 &&
        urlNormalizada.includes(normalizar(parte))
      ) {
        puntuacion += 5;
      }
    }

    if (puntuacion > 0) {

      candidatos.push({
        ...enlace,
        puntuacion
      });
    }
  }

  // ----------------------------------------------------------
  // ORDENAR CANDIDATOS
  // ----------------------------------------------------------

  candidatos.sort(
    (a, b) => b.puntuacion - a.puntuacion
  );

  console.log(
    "Candidatos encontrados:",
    candidatos.length
  );

  // Mostrar candidatos en consola
  for (
    const candidato of candidatos.slice(0, 10)
  ) {

    console.log(
      "CANDIDATO:",
      candidato.puntuacion,
      candidato.texto.substring(0, 150),
      candidato.url
    );
  }

  // ----------------------------------------------------------
  // ANALIZAR LOS MEJORES CANDIDATOS
  // ----------------------------------------------------------

  for (
    const candidato of candidatos.slice(0, 8)
  ) {

    try {

      const producto =
        await analizarPaginaProducto(
          candidato.url,
          consulta
        );

      if (producto) {

        return {
          encontrado: true,
          ...producto
        };
      }

    } catch (error) {

      console.log(
        "Error analizando:",
        candidato.url,
        error.message
      );
    }
  }

  // ----------------------------------------------------------
  // SEGUNDO MÉTODO:
  // BUSCAR CUALQUIER LINK DE PRODUCTO
  // ----------------------------------------------------------

  const posiblesProductos =
    enlaces.filter(esPosibleProducto);

  console.log(
    "Posibles páginas de producto:",
    posiblesProductos.length
  );

  for (
    const enlace of posiblesProductos.slice(0, 10)
  ) {

    try {

      const producto =
        await analizarPaginaProducto(
          enlace.url,
          consulta
        );

      if (producto) {

        return {
          encontrado: true,
          ...producto
        };
      }

    } catch (error) {

      console.log(
        "Error producto:",
        error.message
      );
    }
  }

  return null;
}


// ============================================================
// EXTRAER ENLACES
// ============================================================

function extraerEnlaces(html) {

  const resultados = [];

  const regex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {

    let url = match[1];

    const texto =
      limpiarHTML(match[2]);

    if (!url) {
      continue;
    }

    // --------------------------------------------------------
    // Decodificar HTML básico
    // --------------------------------------------------------

    url = decodeHTMLEntities(url);

    // --------------------------------------------------------
    // URL absoluta
    // --------------------------------------------------------

    if (url.startsWith("/")) {

      url =
        "https://nissei.com" + url;
    }

    if (
      url.startsWith("//")
    ) {

      url =
        "https:" + url;
    }

    if (
      !url.startsWith("http")
    ) {

      continue;
    }

    // --------------------------------------------------------
    // Solo Nissei
    // --------------------------------------------------------

    if (
      !url.includes("nissei.com/py/")
    ) {

      continue;
    }

    // --------------------------------------------------------
    // Ignorar páginas que NO son productos
    // --------------------------------------------------------

    const urlNormalizada =
      normalizar(url);

    if (
      urlNormalizada.includes("checkout") ||
      urlNormalizada.includes("customer") ||
      urlNormalizada.includes("cart") ||
      urlNormalizada.includes("wishlist") ||
      urlNormalizada.includes("catalogsearch") ||
      urlNormalizada.includes("contact") ||
      urlNormalizada.includes("privacy") ||
      urlNormalizada.includes("terminos") ||
      urlNormalizada.includes("como-comprar") ||
      urlNormalizada.includes("donde-estamos")
    ) {

      continue;
    }

    // --------------------------------------------------------
    // Evitar duplicados
    // --------------------------------------------------------

    if (
      !resultados.some(
        item => item.url === url
      )
    ) {

      resultados.push({
        url,
        texto
      });
    }
  }

  return resultados;
}


// ============================================================
// ANALIZAR PÁGINA DEL PRODUCTO
// ============================================================

async function analizarPaginaProducto(
  url,
  consulta
) {

  console.log(
    "Abriendo producto:",
    url
  );

  const response = await fetch(url, {

    method: "GET",

    headers: {

      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",

      "Accept-Language":
        "es-PY,es;q=0.9,en-US;q=0.8,en;q=0.7",

      "Referer":
        "https://nissei.com/py/"
    }
  });

  if (!response.ok) {

    console.log(
      "Producto respondió:",
      response.status
    );

    return null;
  }

  const html =
    await response.text();

  if (
    !html ||
    html.length < 500
  ) {

    return null;
  }

  const texto =
    limpiarHTML(html);

  const textoNormalizado =
    normalizar(texto);

  const consultaNormalizada =
    normalizar(consulta);

  // ----------------------------------------------------------
  // Verificar coincidencia
  // ----------------------------------------------------------

  const coincideConsulta =
    textoNormalizado.includes(
      consultaNormalizada
    );

  console.log(
    "Coincide consulta:",
    coincideConsulta
  );

  // Si no coincide exactamente,
  // buscamos coincidencia en partes.
  if (!coincideConsulta) {

    const partes =
      dividirConsulta(consulta);

    let coincidencias = 0;

    for (const parte of partes) {

      if (
        parte.length >= 3 &&
        textoNormalizado.includes(
          normalizar(parte)
        )
      ) {

        coincidencias++;
      }
    }

    if (
      coincidencias === 0
    ) {

      return null;
    }
  }

  // ----------------------------------------------------------
  // JSON-LD
  // ----------------------------------------------------------

  const datosJSONLD =
    extraerJSONLD(html);

  // ----------------------------------------------------------
  // TÍTULO
  // ----------------------------------------------------------

  const titulo =
    extraerTitulo(
      html,
      datosJSONLD
    );

  // ----------------------------------------------------------
  // MARCA
  // ----------------------------------------------------------

  const marca =
    extraerMarca(
      html,
      datosJSONLD,
      titulo
    );

  // ----------------------------------------------------------
  // MODELO
  // ----------------------------------------------------------

  const modelo =
    extraerModelo(
      html,
      datosJSONLD,
      consulta
    );

  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

  const color =
    extraerColor(
      html,
      datosJSONLD,
      titulo
    );

  // ----------------------------------------------------------
  // EAN / UPC
  // ----------------------------------------------------------

  const ean =
    extraerEAN(
      html,
      datosJSONLD
    );

  // ----------------------------------------------------------
  // TIPO
  // ----------------------------------------------------------

  const tipoProducto =
    detectarTipoProducto(
      titulo + " " + texto
    );

  console.log("DATOS EXTRAÍDOS:");
  console.log("Título:", titulo);
  console.log("Marca:", marca);
  console.log("Modelo:", modelo);
  console.log("Color:", color);
  console.log("EAN:", ean);
  console.log("Tipo:", tipoProducto);

  // ----------------------------------------------------------
  // Debe haber información suficiente
  // ----------------------------------------------------------

  if (
    !titulo &&
    !marca &&
    !modelo
  ) {

    return null;
  }

  return {

    nombre:
      titulo || "",

    marca:
      marca || "",

    modelo:
      modelo || consulta,

    tipoProducto:
      tipoProducto || "Producto",

    color:
      color || "",

    ean:
      ean || "",

    url
  };
}


// ============================================================
// JSON-LD
// ============================================================

function extraerJSONLD(html) {

  const resultados = [];

  const regex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let match;

  while (
    (match = regex.exec(html)) !== null
  ) {

    try {

      const contenido =
        match[1]
          .trim()
          .replace(/&quot;/g, '"');

      const json =
        JSON.parse(contenido);

      if (Array.isArray(json)) {

        resultados.push(...json);

      } else {

        resultados.push(json);
      }

    } catch (error) {

      // Algunos sitios tienen JSON-LD
      // parcialmente inválido.
      continue;
    }
  }

  return resultados;
}


// ============================================================
// TÍTULO
// ============================================================

function extraerTitulo(
  html,
  jsonld
) {

  // JSON-LD
  for (const item of jsonld) {

    if (
      item &&
      item["@type"] === "Product" &&
      item.name
    ) {

      return limpiarHTML(
        item.name
      );
    }
  }

  // Open Graph
  let match =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );

  if (match) {

    return limpiarHTML(
      match[1]
    );
  }

  // title
  match =
    html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

  if (match) {

    return limpiarHTML(
      match[1]
    );
  }

  return "";
}


// ============================================================
// MARCA
// ============================================================

function extraerMarca(
  html,
  jsonld,
  titulo
) {

  // JSON-LD
  for (const item of jsonld) {

    if (
      item &&
      item["@type"] === "Product"
    ) {

      if (
        item.brand
      ) {

        if (
          typeof item.brand === "string"
        ) {

          return limpiarHTML(
            item.brand
          );
        }

        if (
          item.brand.name
        ) {

          return limpiarHTML(
            item.brand.name
          );
        }
      }
    }
  }

  // Campos visibles
  const marca =
    extraerCampo(
      html,
      [
        "Marca",
        "Brand",
        "Fabricante"
      ]
    );

  if (marca) {

    return marca;
  }

  // Detectar por título
  return detectarMarca(
    titulo
  );
}


// ============================================================
// MODELO
// ============================================================

function extraerModelo(
  html,
  jsonld,
  consulta
) {

  // JSON-LD
  for (const item of jsonld) {

    if (
      item &&
      item["@type"] === "Product"
    ) {

      if (
        item.model
      ) {

        return limpiarHTML(
          item.model
        );
      }

      if (
        item.mpn
      ) {

        return limpiarHTML(
          item.mpn
        );
      }

      if (
        item.sku &&
        pareceModelo(item.sku)
      ) {

        return limpiarHTML(
          item.sku
        );
      }
    }
  }

  // Campos visibles
  const modelo =
    extraerCampo(
      html,
      [
        "Part Number",
        "Part number",
        "Modelo",
        "Model",
        "MPN",
        "Código",
        "Codigo"
      ]
    );

  if (modelo) {

    return modelo;
  }

  // Si no encontramos modelo,
  // usamos la consulta original.
  return consulta;
}


// ============================================================
// COLOR
// ============================================================

function extraerColor(
  html,
  jsonld,
  titulo
) {

  // JSON-LD
  for (const item of jsonld) {

    if (
      item &&
      item["@type"] === "Product" &&
      item.color
    ) {

      return limpiarHTML(
        item.color
      );
    }
  }

  // Campos visibles
  const color =
    extraerCampo(
      html,
      [
        "Color",
        "Color:",
        "Cor"
      ]
    );

  if (color) {

    return color;
  }

  // Intentar detectar color en título
  return detectarColor(
    titulo
  );
}


// ============================================================
// EAN / UPC
// ============================================================

function extraerEAN(
  html,
  jsonld
) {

  // JSON-LD
  for (const item of jsonld) {

    if (
      item &&
      item["@type"] === "Product"
    ) {

      const posibles = [

        item.gtin14,
        item.gtin13,
        item.gtin12,
        item.gtin8,
        item.gtin,
        item.ean,
        item.upc
      ];

      for (
        const valor of posibles
      ) {

        const limpio =
          limpiarEAN(valor);

        if (limpio) {

          return limpio;
        }
      }
    }
  }

  // HTML
  const valor =
    extraerCampo(
      html,
      [
        "EAN-14",
        "EAN-13",
        "EAN-12",
        "EAN",
        "UPC",
        "GTIN"
      ]
    );

  return limpiarEAN(
    valor
  );
}


// ============================================================
// EXTRAER CAMPO DEL HTML
// ============================================================

function extraerCampo(
  html,
  nombres
) {

  for (
    const nombre of nombres
  ) {

    const nombreRegex =
      escaparRegex(nombre);

    // --------------------------------------------------------
    // Formato:
    // <th>Marca</th><td>Sony</td>
    // --------------------------------------------------------

    let regex =
      new RegExp(
        `<(?:th|td|dt|div|span)[^>]*>\\s*${nombreRegex}\\s*<\\/[^>]+>\\s*<(?:td|dd|div|span)[^>]*>\\s*([^<]{1,150})`,
        "i"
      );

    let match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {

      const valor =
        limpiarHTML(
          match[1]
        );

      if (
        esValorValido(
          valor,
          nombre
        )
      ) {

        return valor;
      }
    }

    // --------------------------------------------------------
    // Formato:
    // Marca: Sony
    // --------------------------------------------------------

    regex =
      new RegExp(
        `${nombreRegex}\\s*[:\\-]\\s*([^<\\n]{1,150})`,
        "i"
      );

    match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {

      const valor =
        limpiarHTML(
          match[1]
        );

      if (
        esValorValido(
          valor,
          nombre
        )
      ) {

        return valor;
      }
    }
  }

  return "";
}


// ============================================================
// DETECTAR TIPO DE PRODUCTO
// ============================================================

function detectarTipoProducto(
  texto
) {

  const t =
    normalizar(texto);

  if (
    t.includes("playstation") ||
    t.includes("ps5") ||
    t.includes("ps4") ||
    t.includes("xbox") ||
    t.includes("nintendo switch")
  ) {

    return "Consola";
  }

  if (
    t.includes("iphone") ||
    t.includes("smartphone") ||
    t.includes("celular") ||
    t.includes("telefono")
  ) {

    return "Celular";
  }

  if (
    t.includes("notebook") ||
    t.includes("laptop")
  ) {

    return "Notebook";
  }

  if (
    t.includes("tablet") ||
    t.includes("ipad")
  ) {

    return "Tablet";
  }

  if (
    t.includes("televisor") ||
    t.includes("television") ||
    t.includes("smarttv") ||
    t.includes("tv")
  ) {

    return "Televisor";
  }

  if (
    t.includes("monitor")
  ) {

    return "Monitor";
  }

  if (
    t.includes("mouse")
  ) {

    return "Mouse";
  }

  if (
    t.includes("teclado")
  ) {

    return "Teclado";
  }

  if (
    t.includes("auricular") ||
    t.includes("headset") ||
    t.includes("headphone")
  ) {

    return "Auricular";
  }

  if (
    t.includes("impresora")
  ) {

    return "Impresora";
  }

  if (
    t.includes("procesador") ||
    t.includes("cpu")
  ) {

    return "Procesador";
  }

  if (
    t.includes("placadevideo") ||
    t.includes("tarjetagrafica") ||
    t.includes("gpu")
  ) {

    return "Placa de Video";
  }

  if (
    t.includes("memoriaram") ||
    t.includes("memoriaddr")
  ) {

    return "Memoria RAM";
  }

  if (
    t.includes("ssd") ||
    t.includes("discosolido")
  ) {

    return "SSD";
  }

  if (
    t.includes("discoduro") ||
    t.includes("harddisk") ||
    t.includes("hdd")
  ) {

    return "Disco Duro";
  }

  if (
    t.includes("router") ||
    t.includes("roteador")
  ) {

    return "Router";
  }

  if (
    t.includes("camara") ||
    t.includes("camera")
  ) {

    return "Cámara";
  }

  if (
    t.includes("impresora")
  ) {

    return "Impresora";
  }

  return "";
}


// ============================================================
// DETECTAR MARCA
// ============================================================

function detectarMarca(
  texto
) {

  const marcas = [

    "Apple",
    "Samsung",
    "Sony",
    "Xiaomi",
    "Motorola",
    "Huawei",
    "Lenovo",
    "Asus",
    "Acer",
    "Dell",
    "HP",
    "LG",
    "Philips",
    "JBL",
    "Logitech",
    "Kingston",
    "Corsair",
    "Nintendo",
    "Microsoft",
    "Intel",
    "AMD",
    "Canon",
    "Nikon",
    "GoPro",
    "Garmin",
    "Western Digital",
    "SanDisk",
    "TP-Link",
    "Epson",
    "Brother",
    "Ugreen",
    "Anker",
    "Baseus",
    "Razer",
    "MSI",
    "Gigabyte",
    "ASRock",
    "Seagate",
    "Toshiba",
    "Hisense",
    "TCL",
    "Philco",
    "Electrolux",
    "Midea",
    "Fujifilm",
    "DJI"
  ];

  const t =
    normalizar(texto);

  for (
    const marca of marcas
  ) {

    if (
      t.includes(
        normalizar(marca)
      )
    ) {

      return marca;
    }
  }

  return "";
}


// ============================================================
// DETECTAR COLOR
// ============================================================

function detectarColor(
  texto
) {

  const colores = [

    ["Blanco", [
      "blanco",
      "white",
      "branco"
    ]],

    ["Negro", [
      "negro",
      "black",
      "preto"
    ]],

    ["Plata", [
      "plata",
      "silver",
      "prata"
    ]],

    ["Gris", [
      "gris",
      "gray",
      "grey"
    ]],

    ["Azul", [
      "azul",
      "blue"
    ]],

    ["Rojo", [
      "rojo",
      "red",
      "vermelho"
    ]],

    ["Verde", [
      "verde",
      "green"
    ]],

    ["Dorado", [
      "dorado",
      "gold",
      "dourado"
    ]],

    ["Rosa", [
      "rosa",
      "pink"
    ]],

    ["Morado", [
      "morado",
      "purple",
      "violeta"
    ]]
  ];

  const t =
    normalizar(texto);

  for (
    const [nombre, palabras]
    of colores
  ) {

    for (
      const palabra
      of palabras
    ) {

      if (
        t.includes(
          normalizar(palabra)
        )
      ) {

        return nombre;
      }
    }
  }

  return "";
}


// ============================================================
// SABER SI ES POSIBLE PRODUCTO
// ============================================================

function esPosibleProducto(
  enlace
) {

  const url =
    normalizar(enlace.url);

  const texto =
    normalizar(enlace.texto);

  // Los productos de Nissei
  // normalmente tienen URL amigable.
  if (
    url.includes("produto") ||
    url.includes("product")
  ) {

    return true;
  }

  // Si tiene un texto largo,
  // probablemente sea una tarjeta de producto.
  if (
    texto.length > 20
  ) {

    return true;
  }

  return false;
}


// ============================================================
// DIVIDIR CONSULTA
// ============================================================

function dividirConsulta(
  consulta
) {

  return String(consulta)
    .split(/[\s\-_\/]+/)
    .map(x => x.trim())
    .filter(
      x => x.length >= 2
    );
}


// ============================================================
// LIMPIAR EAN
// ============================================================

function limpiarEAN(
  valor
) {

  if (!valor) {
    return "";
  }

  const numeros =
    String(valor)
      .replace(/\D/g, "");

  if (
    numeros.length === 8 ||
    numeros.length === 12 ||
    numeros.length === 13 ||
    numeros.length === 14
  ) {

    return numeros;
  }

  return "";
}


// ============================================================
// SABER SI PARECE MODELO
// ============================================================

function pareceModelo(
  valor
) {

  const texto =
    String(valor || "")
      .trim();

  if (!texto) {
    return false;
  }

  return (
    /[A-Za-z]/.test(texto) &&
    /[-_0-9]/.test(texto)
  );
}


// ============================================================
// VALIDAR CAMPO
// ============================================================

function esValorValido(
  valor,
  nombre
) {

  if (!valor) {
    return false;
  }

  if (
    valor.length > 150
  ) {
    return false;
  }

  if (
    normalizar(valor) ===
    normalizar(nombre)
  ) {

    return false;
  }

  return true;
}


// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(
  texto
) {

  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


// ============================================================
// LIMPIAR HTML
// ============================================================

function limpiarHTML(
  texto
) {

  return decodeHTMLEntities(
    String(texto || "")
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
  );
}


// ============================================================
// DECODIFICAR ENTIDADES HTML
// ============================================================

function decodeHTMLEntities(
  texto
) {

  return String(texto || "")
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&apos;/gi,
      "'"
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&#x2F;/gi,
      "/"
    )
    .replace(
      /&#47;/gi,
      "/"
    );
}


// ============================================================
// ESCAPAR REGEX
// ============================================================

function escaparRegex(
  texto
) {

  return String(texto)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
}
