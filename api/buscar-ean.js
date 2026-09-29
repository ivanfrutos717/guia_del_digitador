// ==========================================================================
// BUSCADOR UNIVERSAL DE PRODUCTOS
// Ruta: /api/buscar-producto
//
// Busca por:
// - EAN / UPC
// - Modelo
// - Referencia
// - Nombre de producto
//
// Orden de búsqueda:
// 1. Compras Paraguai
// 2. Nissei
// 3. Mega Eletrônicos
// 4. Atacado Connect
// 5. GenZ
// ==========================================================================


export default async function handler(req, res) {

  // ==========================================================================
  // 1. CORS
  // ==========================================================================

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
      encontrado: false,
      error: "Método no permitido. Usa GET."
    });

  }


  // ==========================================================================
  // 2. OBTENER CONSULTA
  // ==========================================================================

  const consulta =
    String(req.query?.consulta || "")
      .trim();


  if (!consulta) {

    return res.status(400).json({
      encontrado: false,
      error: "La consulta es obligatoria."
    });

  }


  console.log(
    "======================================"
  );

  console.log(
    "BUSCADOR UNIVERSAL:",
    consulta
  );

  console.log(
    "======================================"
  );


  // ==========================================================================
  // 3. FUENTES
  // ==========================================================================

  const fuentes = [

    {
      nombre: "COMPRAS PARAGUAI",
      dominio: "comprasparaguai.com.br"
    },

    {
      nombre: "NISSEI",
      dominio: "nissei.com"
    },

    {
      nombre: "MEGA ELETRÔNICOS",
      dominio: "megaelectronicos.com"
    },

    {
      nombre: "ATACADO CONNECT",
      dominio: "atacadoconnect.com"
    },

    {
      nombre: "GENZ",
      dominio: "genz.com.py"
    }

  ];


  // ==========================================================================
  // 4. BUSCAR FUENTE POR FUENTE
  // ==========================================================================

  for (const fuente of fuentes) {

    try {

      console.log(
        `Buscando en ${fuente.nombre}...`
      );


      const resultado =
        await buscarEnFuente(
          consulta,
          fuente
        );


      if (
        resultado &&
        resultado.encontrado === true
      ) {

        console.log(
          `PRODUCTO ENCONTRADO EN ${fuente.nombre}`
        );

        return res.status(200).json(
          resultado
        );

      }


      console.log(
        `No encontrado en ${fuente.nombre}`
      );


    } catch (error) {

      console.error(
        `Error en ${fuente.nombre}:`,
        error?.message || error
      );

      // Si una página falla,
      // seguimos con la siguiente fuente.

      continue;

    }

  }


  // ==========================================================================
  // 5. NINGUNA FUENTE ENCONTRÓ EL PRODUCTO
  // ==========================================================================

  return res.status(200).json({

    encontrado: false,

    consulta,

    mensaje:
      "No se encontró el producto en las fuentes consultadas."

  });

}


// ==========================================================================
// BUSCAR EN UNA FUENTE
// ==========================================================================

async function buscarEnFuente(
  consulta,
  fuente
) {

  const consultaCodificada =
    encodeURIComponent(
      `"${consulta}" site:${fuente.dominio}`
    );


  const url =
    `https://html.duckduckgo.com/html/?q=${consultaCodificada}`;


  console.log(
    `Buscando: ${url}`
  );


  const response =
    await fetch(
      url,
      {

        method: "GET",

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "es-ES,es;q=0.9,en;q=0.8"

        }

      }
    );


  if (!response.ok) {

    throw new Error(
      `DuckDuckGo respondió ${response.status}`
    );

  }


  const html =
    await response.text();


  const resultados =
    extraerResultados(html);


  console.log(
    `${fuente.nombre}: ${resultados.length} resultados`
  );


  if (
    resultados.length === 0
  ) {

    return {
      encontrado: false
    };

  }


  // ==========================================================================
  // ANALIZAR HASTA 5 RESULTADOS
  // ==========================================================================

  for (
    const resultado
    of resultados.slice(0, 5)
  ) {

    try {

      console.log(
        "Analizando:",
        resultado.url
      );


      const pagina =
        await descargarPagina(
          resultado.url
        );


      if (!pagina) {
        continue;
      }


      const producto =
        analizarProducto(
          pagina,
          resultado.titulo,
          consulta,
          fuente.nombre,
          resultado.url
        );


      if (
        producto &&
        producto.encontrado === true
      ) {

        return producto;

      }

    } catch (error) {

      console.log(
        "Error analizando resultado:",
        error?.message || error
      );

      continue;

    }

  }


  return {
    encontrado: false
  };

}


// ==========================================================================
// EXTRAER RESULTADOS DE DUCKDUCKGO
// ==========================================================================

function extraerResultados(html) {

  const resultados = [];


  const regex =
    /<a[^>]+class=["']result__a["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;


  let match;


  while (
    (match = regex.exec(html)) !== null
  ) {

    let url =
      match[1];


    const titulo =
      limpiarHTML(
        match[2]
      );


    // ------------------------------------------------------------------------
    // Resolver URL de DuckDuckGo
    // ------------------------------------------------------------------------

    if (
      url.includes("uddg=")
    ) {

      try {

        const parsed =
          new URL(
            url,
            "https://html.duckduckgo.com"
          );


        const destino =
          parsed.searchParams.get(
            "uddg"
          );


        if (destino) {
          url = destino;
        }

      } catch (error) {
        // Ignorar URL inválida
      }

    }


    if (
      url.startsWith("http://") ||
      url.startsWith("https://")
    ) {

      resultados.push({

        titulo,

        url

      });

    }

  }


  return resultados;

}


// ==========================================================================
// DESCARGAR PÁGINA DEL PRODUCTO
// ==========================================================================

async function descargarPagina(url) {

  const response =
    await fetch(
      url,
      {

        method: "GET",

        redirect: "follow",

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "es-ES,es;q=0.9,en;q=0.8"

        }

      }
    );


  if (!response.ok) {

    return null;

  }


  return await response.text();

}


// ==========================================================================
// ANALIZAR PRODUCTO
// ==========================================================================

function analizarProducto(
  html,
  titulo,
  consulta,
  fuente,
  url
) {

  const texto =
    limpiarHTML(html);


  const consultaNormalizada =
    normalizar(
      consulta
    );


  const textoNormalizado =
    normalizar(
      texto
    );


  const tituloNormalizado =
    normalizar(
      titulo
    );


  // ==========================================================================
  // VERIFICAR QUE LA CONSULTA APAREZCA
  // ==========================================================================

  const coincide =
    textoNormalizado.includes(
      consultaNormalizada
    ) ||
    tituloNormalizado.includes(
      consultaNormalizada
    );


  if (!coincide) {

    return {
      encontrado: false
    };

  }


  // ==========================================================================
  // EXTRAER INFORMACIÓN
  // ==========================================================================

  const marca =
    extraerCampo(
      html,
      [
        "Marca",
        "Brand",
        "Fabricante",
        "Manufacturer"
      ]
    ) ||
    detectarMarca(
      texto
    );


  const modelo =
    extraerCampo(
      html,
      [
        "Modelo",
        "Model",
        "Part Number",
        "Part Number",
        "Número de modelo",
        "Referencia",
        "Reference"
      ]
    ) ||
    detectarModelo(
      texto,
      consulta
    );


  const color =
    extraerCampo(
      html,
      [
        "Color",
        "Colour",
        "Cor"
      ]
    ) ||
    detectarColor(
      texto
    );


  const ean =
    extraerCampo(
      html,
      [
        "EAN",
        "GTIN",
        "UPC",
        "Código EAN",
        "Código UPC"
      ]
    ) ||
    detectarEAN(
      texto
    );


  const tipoProducto =
    detectarTipoProducto(
      texto,
      titulo
    );


  // ==========================================================================
  // VERIFICAR SI TENEMOS INFORMACIÓN ÚTIL
  // ==========================================================================

  if (
    !marca &&
    !modelo &&
    !tipoProducto &&
    !color
  ) {

    return {
      encontrado: false
    };

  }


  // ==========================================================================
  // CREAR DESCRIPCIÓN
  // ==========================================================================

  const descripcionFinal =
    construirDescripcion({

      marca,

      modelo,

      tipoProducto,

      color

    });


  // ==========================================================================
  // RESULTADO
  // ==========================================================================

  return {

    encontrado: true,

    consulta,

    ean: ean || "",

    marca: marca || "",

    modelo:
      modelo || consulta,

    tipoProducto:
      tipoProducto || "",

    color:
      color || "",

    descripcionFinal,

    fuente,

    coincidencia:
      "COINCIDENCIA ENCONTRADA",

    url

  };

}


// ==========================================================================
// EXTRAER CAMPO DEL HTML
// ==========================================================================

function extraerCampo(
  html,
  nombres
) {

  for (
    const nombre
    of nombres
  ) {

    const escaped =
      escaparRegex(
        nombre
      );


    // ------------------------------------------------------------------------
    // Buscar:
    // <strong>Marca</strong>: Sony
    // ------------------------------------------------------------------------

    let regex =
      new RegExp(
        `<[^>]*>${escaped}<\\/[^>]*>\\s*[:\\-]?\\s*([^<]{1,100})`,
        "i"
      );


    let match =
      html.match(
        regex
      );


    if (match) {

      const valor =
        limpiarTexto(
          match[1]
        );


      if (valor) {
        return valor;
      }

    }


    // ------------------------------------------------------------------------
    // Buscar:
    // "Marca":"Sony"
    // ------------------------------------------------------------------------

    regex =
      new RegExp(
        `["']?${escaped}["']?\\s*[:=]\\s*["']([^"']{1,100})["']`,
        "i"
      );


    match =
      html.match(
        regex
      );


    if (match) {

      const valor =
        limpiarTexto(
          match[1]
        );


      if (valor) {
        return valor;
      }

    }

  }


  return "";

}


// ==========================================================================
// DETECTAR MARCA
// ==========================================================================

function detectarMarca(texto) {

  const marcas = [

    "Apple",
    "Samsung",
    "Sony",
    "Nintendo",
    "Microsoft",
    "Xiaomi",
    "Motorola",
    "Huawei",
    "Lenovo",
    "Asus",
    "Acer",
    "HP",
    "Dell",
    "LG",
    "Philips",
    "JBL",
    "Logitech",
    "Razer",
    "Corsair",
    "Kingston",
    "Seagate",
    "Western Digital",
    "WD",
    "Intel",
    "AMD",
    "NVIDIA",
    "Canon",
    "Epson",
    "Brother",
    "TP-Link",
    "DJI",
    "GoPro",
    "Garmin",
    "OnePlus",
    "Realme",
    "Oppo",
    "Vivo"

  ];


  for (
    const marca
    of marcas
  ) {

    const regex =
      new RegExp(
        `\\b${escaparRegex(marca)}\\b`,
        "i"
      );


    if (
      regex.test(texto)
    ) {

      return marca;

    }

  }


  return "";

}


// ==========================================================================
// DETECTAR MODELO
// ==========================================================================

function detectarModelo(
  texto,
  consulta
) {

  // Si la consulta parece un modelo,
  // la usamos como referencia.

  if (
    /[A-Za-z]/.test(consulta) &&
    /[0-9]/.test(consulta)
  ) {

    return consulta
      .toUpperCase();

  }


  const patrones = [

    /\bCFI-\d{4,5}[A-Z]?\b/i,

    /\b[A-Z]{1,5}-[A-Z0-9]{2,15}\b/i,

    /\b[A-Z]{2,8}\d{2,8}[A-Z0-9-]*\b/i,

    /\b[A-Z0-9]{2,}-[A-Z0-9-]{2,}\b/i

  ];


  for (
    const patron
    of patrones
  ) {

    const match =
      texto.match(
        patron
      );


    if (match) {

      return match[0]
        .toUpperCase();

    }

  }


  return "";

}


// ==========================================================================
// DETECTAR COLOR
// ==========================================================================

function detectarColor(texto) {

  const colores = [

    "Negro",
    "Negra",
    "Black",

    "Blanco",
    "Blanca",
    "White",

    "Plata",
    "Silver",

    "Gris",
    "Gray",
    "Grey",

    "Azul",
    "Blue",

    "Rojo",
    "Red",

    "Verde",
    "Green",

    "Amarillo",
    "Yellow",

    "Rosa",
    "Pink",

    "Morado",
    "Purple",

    "Naranja",
    "Orange",

    "Dorado",
    "Gold",

    "Titanio",
    "Titanium",

    "Natural Titanium",

    "Cosmic Orange",

    "Deep Blue"

  ];


  const equivalencias = {

    Black: "Negro",

    White: "Blanco",

    Silver: "Plata",

    Gray: "Gris",

    Grey: "Gris",

    Blue: "Azul",

    Red: "Rojo",

    Green: "Verde",

    Yellow: "Amarillo",

    Pink: "Rosa",

    Purple: "Morado",

    Orange: "Naranja",

    Gold: "Dorado",

    Titanium: "Titanio"

  };


  for (
    const color
    of colores
  ) {

    const regex =
      new RegExp(
        `\\b${escaparRegex(color)}\\b`,
        "i"
      );


    if (
      regex.test(texto)
    ) {

      return (
        equivalencias[color] ||
        color
      );

    }

  }


  return "";

}


// ==========================================================================
// DETECTAR EAN
// ==========================================================================

function detectarEAN(texto) {

  const numeros =
    texto.match(
      /\b\d{12,14}\b/g
    );


  if (!numeros) {
    return "";
  }


  for (
    const numero
    of numeros
  ) {

    if (
      numero.length === 12 ||
      numero.length === 13 ||
      numero.length === 14
    ) {

      return numero;

    }

  }


  return "";

}


// ==========================================================================
// DETECTAR TIPO DE PRODUCTO
// ==========================================================================

function detectarTipoProducto(
  texto,
  titulo
) {

  const contenido =
    `${titulo} ${texto}`
      .toLowerCase();


  // ------------------------------------------------------------------------
  // CONSOLAS
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "playstation 5"
    ) ||
    contenido.includes(
      "ps5"
    )
  ) {

    return "CONSOLÃO PLAYSTATION 5";

  }


  if (
    contenido.includes(
      "playstation 4"
    ) ||
    contenido.includes(
      "ps4"
    )
  ) {

    return "CONSOLA PLAYSTATION 4";

  }


  if (
    contenido.includes(
      "xbox series x"
    )
  ) {

    return "CONSOLA XBOX SERIES X";

  }


  if (
    contenido.includes(
      "xbox series s"
    )
  ) {

    return "CONSOLA XBOX SERIES S";

  }


  if (
    contenido.includes(
      "nintendo switch"
    )
  ) {

    return "CONSOLA NINTENDO SWITCH";

  }


  // ------------------------------------------------------------------------
  // IPHONE
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "iphone"
    )
  ) {

    return "CELULAR IPHONE";

  }


  // ------------------------------------------------------------------------
  // SAMSUNG
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "galaxy s"
    ) ||
    contenido.includes(
      "galaxy a"
    ) ||
    contenido.includes(
      "galaxy z"
    )
  ) {

    return "CELULAR SAMSUNG GALAXY";

  }


  // ------------------------------------------------------------------------
  // CELULARES
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "smartphone"
    ) ||
    contenido.includes(
      "celular"
    ) ||
    contenido.includes(
      "telefone"
    )
  ) {

    return "CELULAR";

  }


  // ------------------------------------------------------------------------
  // NOTEBOOK
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "notebook"
    ) ||
    contenido.includes(
      "laptop"
    ) ||
    contenido.includes(
      "computadora portátil"
    )
  ) {

    return "NOTEBOOK";

  }


  // ------------------------------------------------------------------------
  // MONITOR
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "monitor"
    )
  ) {

    return "MONITOR";

  }


  // ------------------------------------------------------------------------
  // TELEVISOR
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "smart tv"
    ) ||
    contenido.includes(
      "televisor"
    ) ||
    contenido.includes(
      "televisão"
    ) ||
    contenido.includes(
      "tv led"
    )
  ) {

    return "SMART TV";

  }


  // ------------------------------------------------------------------------
  // AURICULARES
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "headphone"
    ) ||
    contenido.includes(
      "headset"
    ) ||
    contenido.includes(
      "auricular"
    ) ||
    contenido.includes(
      "fone de ouvido"
    )
  ) {

    return "AURICULARES";

  }


  // ------------------------------------------------------------------------
  // MOUSE
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "mouse"
    )
  ) {

    return "MOUSE";

  }


  // ------------------------------------------------------------------------
  // TECLADO
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "keyboard"
    ) ||
    contenido.includes(
      "teclado"
    ) ||
    contenido.includes(
      "teclado mecânico"
    )
  ) {

    return "TECLADO";

  }


  // ------------------------------------------------------------------------
  // IMPRESORA
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "printer"
    ) ||
    contenido.includes(
      "impresora"
    ) ||
    contenido.includes(
      "impressora"
    )
  ) {

    return "IMPRESORA";

  }


  // ------------------------------------------------------------------------
  // CÁMARA
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "camera"
    ) ||
    contenido.includes(
      "cámara"
    ) ||
    contenido.includes(
      "câmera"
    )
  ) {

    return "CÁMARA";

  }


  // ------------------------------------------------------------------------
  // TARJETA GRÁFICA
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "geforce rtx"
    ) ||
    contenido.includes(
      "radeon rx"
    ) ||
    contenido.includes(
      "graphics card"
    ) ||
    contenido.includes(
      "placa de vídeo"
    ) ||
    contenido.includes(
      "tarjeta gráfica"
    )
  ) {

    return "TARJETA GRÁFICA";

  }


  // ------------------------------------------------------------------------
  // RAM
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "memoria ram"
    ) ||
    contenido.includes(
      "memory ram"
    ) ||
    contenido.includes(
      "memória ram"
    )
  ) {

    return "MEMORIA RAM";

  }


  // ------------------------------------------------------------------------
  // SSD
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "ssd"
    ) ||
    contenido.includes(
      "solid state drive"
    )
  ) {

    return "SSD";

  }


  // ------------------------------------------------------------------------
  // ROUTER
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "router"
    ) ||
    contenido.includes(
      "roteador"
    )
  ) {

    return "ROUTER";

  }


  // ------------------------------------------------------------------------
  // PARLANTE
  // ------------------------------------------------------------------------

  if (
    contenido.includes(
      "speaker"
    ) ||
    contenido.includes(
      "parlante"
    ) ||
    contenido.includes(
      "alto-falante"
    )
  ) {

    return "PARLANTE";

  }


  return "";

}


// ==========================================================================
// CONSTRUIR DESCRIPCIÓN
// ==========================================================================

function construirDescripcion(
  datos
) {

  const partes = [];


  if (datos.marca) {
    partes.push(
      datos.marca
    );
  }


  if (datos.modelo) {
    partes.push(
      datos.modelo
    );
  }


  if (datos.tipoProducto) {
    partes.push(
      datos.tipoProducto
    );
  }


  if (datos.color) {

    partes.push(
      `COLOR ${datos.color}`
    );

  }


  return partes.join(
    " "
  );

}


// ==========================================================================
// LIMPIAR HTML
// ==========================================================================

function limpiarHTML(html) {

  return String(html || "")

    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )

    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )

    .replace(
      /<noscript[\s\S]*?<\/noscript>/gi,
      " "
    )

    .replace(
      /<[^>]+>/g,
      " "
    )

    .replace(
      /&nbsp;/gi,
      " "
    )

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
      /\s+/g,
      " "
    )

    .trim();

}


// ==========================================================================
// LIMPIAR TEXTO
// ==========================================================================

function limpiarTexto(texto) {

  return String(texto || "")

    .replace(
      /&nbsp;/gi,
      " "
    )

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
      /\s+/g,
      " "
    )

    .trim();

}


// ==========================================================================
// NORMALIZAR TEXTO
// ==========================================================================

function normalizar(texto) {

  return String(texto || "")

    .normalize("NFD")

    .replace(
      /[\u0300-\u036f]/g,
      ""
    )

    .toLowerCase()

    .trim();

}


// ==========================================================================
// ESCAPAR REGEX
// ==========================================================================

function escaparRegex(texto) {

  return String(texto || "")
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

}
