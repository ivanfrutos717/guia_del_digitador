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
    console.log("BUSCADOR UNIVERSAL");
    console.log("BUSCANDO:", consulta);
    console.log("====================================");

    // =========================================================
    // 1. BUSCAR EN COMPRAS PARAGUAI
    // =========================================================

    const dominios = [
      "https://mobile.comprasparaguai.com.br",
      "https://mobile.comprasparaguai.net.br",
      "https://mobile.comprasparaguai.com.ar",
      "https://www.comprasparaguai.com.br"
    ];

    let productoUrl = null;
    let contenidoBusqueda = "";
    let dominioEncontrado = "";

    for (const dominio of dominios) {

      const urlBusqueda =
        `${dominio}/busca/?q=${encodeURIComponent(consulta)}`;

      console.log("PROBANDO:", urlBusqueda);

      try {

        const respuesta =
          await obtenerPagina(urlBusqueda);

        console.log(
          "STATUS:",
          respuesta.status,
          "CARACTERES:",
          respuesta.texto.length
        );

        if (!respuesta.ok) {
          console.log(
            "FUENTE NO DISPONIBLE:",
            dominio
          );
          continue;
        }

        if (esPaginaSeguridad(respuesta.texto)) {
          console.log(
            "PÁGINA BLOQUEADA POR SEGURIDAD:",
            dominio
          );
          continue;
        }

        contenidoBusqueda =
          respuesta.texto;

        const urls =
          extraerUrlsProducto(
            contenidoBusqueda,
            dominio
          );

        console.log(
          "PRODUCTOS ENCONTRADOS:",
          urls.length
        );

        const mejorUrl =
          seleccionarMejorProducto(
            urls,
            consulta
          );

        if (mejorUrl) {

          productoUrl =
            mejorUrl;

          dominioEncontrado =
            dominio;

          console.log(
            "PRODUCTO ENCONTRADO:",
            productoUrl
          );

          break;
        }

      } catch (error) {

        console.log(
          "ERROR EN DOMINIO:",
          dominio,
          error.message
        );
      }
    }

    // =========================================================
    // 2. SI NO ENCONTRÓ PRODUCTO
    // =========================================================

    if (!productoUrl) {

      console.log(
        "NO SE ENCONTRÓ PRODUCTO."
      );

      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje:
          "No encontramos un producto compatible en Compras Paraguai.",
        diagnostico: {
          dominiosConsultados: dominios,
          ultimoContenido:
            contenidoBusqueda
              ? contenidoBusqueda.substring(0, 3000)
              : ""
        }
      });
    }

    // =========================================================
    // 3. LEER PÁGINA REAL DEL PRODUCTO
    // =========================================================

    console.log(
      "===================================="
    );

    console.log(
      "LEYENDO PRODUCTO:"
    );

    console.log(
      productoUrl
    );

    const productoPagina =
      await obtenerPagina(productoUrl);

    console.log(
      "STATUS PRODUCTO:",
      productoPagina.status
    );

    console.log(
      "CARACTERES PRODUCTO:",
      productoPagina.texto.length
    );

    // =========================================================
    // 4. SI LA PÁGINA DIRECTA ESTÁ BLOQUEADA,
    //    INTENTAR JINA COMO SEGUNDO MÉTODO
    // =========================================================

    let productoTexto =
      productoPagina.texto;

    if (
      !productoPagina.ok ||
      esPaginaSeguridad(productoTexto)
    ) {

      console.log(
        "PÁGINA DIRECTA BLOQUEADA."
      );

      console.log(
        "INTENTANDO JINA COMO FALLBACK..."
      );

      const jinaUrl =
        `https://r.jina.ai/${productoUrl}`;

      try {

        const jinaResponse =
          await fetch(jinaUrl, {
            method: "GET",
            headers: {
              "Accept": "text/plain",
              "User-Agent":
                "Mozilla/5.0"
            }
          });

        const jinaTexto =
          await jinaResponse.text();

        console.log(
          "STATUS JINA PRODUCTO:",
          jinaResponse.status
        );

        console.log(
          "CARACTERES JINA:",
          jinaTexto.length
        );

        if (
          jinaResponse.ok &&
          !esPaginaSeguridad(jinaTexto)
        ) {

          productoTexto =
            jinaTexto;

        }

      } catch (error) {

        console.log(
          "JINA FALLÓ:",
          error.message
        );
      }
    }

    // =========================================================
    // 5. VERIFICAR QUE REALMENTE TENEMOS PRODUCTO
    // =========================================================

    if (
      !productoTexto ||
      productoTexto.length < 100 ||
      esPaginaSeguridad(productoTexto)
    ) {

      return res.status(200).json({
        encontrado: false,
        consulta,
        mensaje:
          "Encontramos el enlace del producto, pero la página está bloqueada por seguridad.",
        url: productoUrl
      });
    }

    // =========================================================
    // 6. LIMPIAR EL TEXTO ORIGINAL
    // =========================================================

    const descripcionOriginal =
      limpiarDescripcionOriginal(
        productoTexto
      );

    console.log(
      "DESCRIPCIÓN ORIGINAL:",
      descripcionOriginal.length,
      "caracteres"
    );

    console.log(
      descripcionOriginal.substring(
        0,
        5000
      )
    );

    // =========================================================
    // 7. EXTRAER DATOS
    // =========================================================

    const datos =
      extraerDatosProducto(
        descripcionOriginal,
        consulta
      );

    console.log(
      "DATOS EXTRAÍDOS:",
      datos
    );

    // =========================================================
    // 8. RESPUESTA FINAL
    // =========================================================

    return res.status(200).json({

      encontrado: true,

      nombre:
        datos.nombre,

      marca:
        datos.marca,

      modelo:
        datos.modelo,

      tipoProducto:
        datos.tipoProducto,

      color:
        datos.color,

      ean:
        datos.ean,

      // =====================================================
      // TEXTO ORIGINAL COMPLETO
      // =====================================================

      descripcionOriginal:
        descripcionOriginal,

      fuente:
        "Compras Paraguai",

      url:
        productoUrl,

      dominio:
        dominioEncontrado

    });

  } catch (error) {

    console.error(
      "ERROR GENERAL:",
      error
    );

    return res.status(500).json({

      encontrado: false,

      mensaje:
        "Error interno",

      error:
        error.message

    });
  }
}


// ============================================================
// OBTENER PÁGINA
// ============================================================

async function obtenerPagina(url) {

  const respuesta =
    await fetch(url, {
      method: "GET",

      headers: {

        "Accept":
          "text/html,application/xhtml+xml,text/plain",

        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36",

        "Accept-Language":
          "pt-BR,pt;q=0.9,en;q=0.8",

        "Cache-Control":
          "no-cache"
      }
    });

  const texto =
    await respuesta.text();

  return {
    ok:
      respuesta.ok,

    status:
      respuesta.status,

    texto:
      texto
  };
}


// ============================================================
// DETECTAR CLOUDFLARE / CAPTCHA
// ============================================================

function esPaginaSeguridad(texto) {

  const t =
    String(texto || "")
      .toLowerCase();

  const indicadores = [

    "just a moment",

    "performing security verification",

    "please make sure you are authorized",

    "cf-chl",

    "cloudflare",

    "checking your browser",

    "verify you are human",

    "captcha"

  ];

  return indicadores.some(
    palabra =>
      t.includes(palabra)
  );
}


// ============================================================
// EXTRAER URLS DE PRODUCTOS
// ============================================================

function extraerUrlsProducto(
  texto,
  dominioBase
) {

  const resultado =
    [];

  const contenido =
    String(texto || "");

  // ----------------------------------------------------------
  // URLS ABSOLUTAS
  // ----------------------------------------------------------

  const regexAbsolutas =
    /https?:\/\/[^\s"'<>\\]+/gi;

  let match;

  while (
    (match =
      regexAbsolutas.exec(contenido))
    !== null
  ) {

    let url =
      match[0];

    url =
      limpiarUrl(url);

    if (
      esUrlProducto(url)
    ) {

      resultado.push(url);

    }
  }

  // ----------------------------------------------------------
  // HREF="..."
  // ----------------------------------------------------------

  const regexHref =
    /href\s*=\s*["']([^"']+)["']/gi;

  while (
    (match =
      regexHref.exec(contenido))
    !== null
  ) {

    let href =
      match[1];

    href =
      href.trim();

    if (
      href.startsWith("/")
    ) {

      href =
        dominioBase +
        href;

    }

    if (
      href.startsWith("http")
      &&
      esUrlProducto(href)
    ) {

      resultado.push(
        limpiarUrl(href)
      );

    }
  }

  // ----------------------------------------------------------
  // QUITAR DUPLICADOS
  // ----------------------------------------------------------

  return [
    ...new Set(resultado)
  ];
}


// ============================================================
// DETECTAR SI ES PRODUCTO
// ============================================================

function esUrlProducto(url) {

  const u =
    String(url || "")
      .toLowerCase();

  if (
    !u.includes(
      "comprasparaguai"
    )
  ) {

    return false;
  }

  // Ignorar páginas gerais
  const ignorar = [

    "/busca/",

    "/busca",

    "/categoria/",

    "/categorias/",

    "/lojas/",

    "/marca/",

    "/marcas/",

    "/login",

    "/favoritos",

    "/sobre",

    "/contato",

    "/termos",

    "/privacidade"

  ];

  for (
    const parte
    of ignorar
  ) {

    if (
      u.includes(parte)
    ) {

      return false;
    }
  }

  // Produto normalmente possui
  // slug + identificador ou slug extenso

  const path =
    u.split("?")[0];

  const partes =
    path.split("/")
      .filter(Boolean);

  if (
    partes.length < 2
  ) {

    return false;
  }

  const slug =
    partes[
      partes.length - 1
    ];

  if (
    slug.length < 15
  ) {

    return false;
  }

  return true;
}


// ============================================================
// SELECCIONAR MEJOR PRODUCTO
// ============================================================

function seleccionarMejorProducto(
  urls,
  consulta
) {

  if (
    !urls ||
    !urls.length
  ) {

    return null;
  }

  const consultaNormalizada =
    normalizar(
      consulta
    );

  const partes =
    consultaNormalizada
      .split(/[-_\s]+/)
      .filter(
        parte =>
          parte.length >= 2
      );

  let mejor =
    null;

  let mejorPuntaje =
    -1;

  for (
    const url
    of urls
  ) {

    const normalizada =
      normalizar(url);

    let puntaje =
      0;

    // --------------------------------------------------------
    // COINCIDENCIA COMPLETA
    // --------------------------------------------------------

    if (
      normalizada.includes(
        consultaNormalizada
      )
    ) {

      puntaje += 100;
    }

    // --------------------------------------------------------
    // PARTES DE CONSULTA
    // --------------------------------------------------------

    for (
      const parte
      of partes
    ) {

      if (
        normalizada.includes(
          parte
        )
      ) {

        puntaje += 20;
      }

    }

    // --------------------------------------------------------
    // SI EL URL PARECE PRODUCTO
    // --------------------------------------------------------

    if (
      esUrlProducto(url)
    ) {

      puntaje += 5;
    }

    if (
      puntaje >
      mejorPuntaje
    ) {

      mejorPuntaje =
        puntaje;

      mejor =
        url;
    }
  }

  console.log(
    "MEJOR PUNTAJE:",
    mejorPuntaje
  );

  return mejor;
}


// ============================================================
// LIMPIAR URL
// ============================================================

function limpiarUrl(url) {

  return String(url || "")

    .replace(
      /\\u0026/g,
      "&"
    )

    .replace(
      /&amp;/g,
      "&"
    )

    .replace(
      /[.,;]+$/,
      ""
    );
}


// ============================================================
// LIMPIAR DESCRIPCIÓN ORIGINAL
// ============================================================

function limpiarDescripcionOriginal(
  texto
) {

  let resultado =
    String(texto || "");

  // Remover caracteres nulos
  resultado =
    resultado.replace(
      /\0/g,
      ""
    );

  // Normalizar saltos
  resultado =
    resultado.replace(
      /\r\n/g,
      "\n"
    );

  resultado =
    resultado.replace(
      /\r/g,
      "\n"
    );

  // Reducir exceso de líneas vacías
  resultado =
    resultado.replace(
      /\n{4,}/g,
      "\n\n\n"
    );

  return resultado.trim();
}


// ============================================================
// EXTRAER DATOS DEL PRODUCTO
// ============================================================

function extraerDatosProducto(
  texto,
  consulta
) {

  const limpio =
    String(texto || "");

  let nombre =
    "";

  let marca =
    "";

  let modelo =
    consulta;

  let color =
    "";

  let ean =
    "";

  // ==========================================================
  // NOMBRE
  // ==========================================================

  const tituloMatch =
    limpio.match(
      /(?:#\s*)?(.{10,250}(?:CFI|PlayStation|PS5|iPhone|Galaxy|Xiaomi|Samsung|A17|SM-A175F).{0,250})/i
    );

  if (
    tituloMatch
  ) {

    nombre =
      limpiarTexto(
        tituloMatch[1]
      );
  }

  // Buscar líneas de título
  if (
    !nombre
  ) {

    const lineas =
      limpio
        .split("\n")
        .map(
          x =>
            x.trim()
        )
        .filter(
          Boolean
        );

    for (
      const linea
      of lineas
    ) {

      if (
        /playstation|sony|cfi-|iphone|samsung|galaxy|xiaomi|motorola|lenovo|asus|acer|dell|logitech|canon|nintendo|microsoft/i
          .test(linea)
        &&
        linea.length < 300
      ) {

        nombre =
          linea;

        break;
      }
    }
  }

  // ==========================================================
  // MARCA
  // ==========================================================

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

  for (
    const m
    of marcas
  ) {

    const regex =
      new RegExp(
        `\\b${escaparRegex(m)}\\b`,
        "i"
      );

    if (
      regex.test(
        textoCompleto
      )
    ) {

      marca =
        m;

      break;
    }
  }

  // ==========================================================
  // MODELO
  // ==========================================================

  const modeloMatch =
    limpio.match(
      /\b[A-Z]{2,}[0-9]+[A-Z0-9-]*\b/i
    );

  if (
    modeloMatch
  ) {

    modelo =
      modeloMatch[0];
  }

  // ==========================================================
  // EAN / GTIN
  // ==========================================================

  const eanMatch =
    limpio.match(
      /(?:EAN(?:-12|-13|-14)?|GTIN)[^\d]{0,20}(\d{12,14})/i
    );

  if (
    eanMatch
  ) {

    ean =
      eanMatch[1];

  } else {

    const numeros =
      limpio.match(
        /\b\d{12,14}\b/g
      );

    if (
      numeros &&
      numeros.length
    ) {

      ean =
        numeros[0];
    }
  }

  // ==========================================================
  // COLOR
  // ==========================================================

  const colores = [

    {
      nombre: "Blanco",
      palabras: [
        "white",
        "branco",
        "blanco"
      ]
    },

    {
      nombre: "Negro",
      palabras: [
        "black",
        "preto",
        "negro"
      ]
    },

    {
      nombre: "Azul",
      palabras: [
        "blue",
        "azul"
      ]
    },

    {
      nombre: "Rojo",
      palabras: [
        "red",
        "vermelho",
        "rojo"
      ]
    },

    {
      nombre: "Verde",
      palabras: [
        "green",
        "verde"
      ]
    },

    {
      nombre: "Gris",
      palabras: [
        "gray",
        "grey",
        "cinza",
        "gris"
      ]
    },

    {
      nombre: "Plata",
      palabras: [
        "silver",
        "prata",
        "plata"
      ]
    },

    {
      nombre: "Dorado",
      palabras: [
        "gold",
        "dourado",
        "dorado"
      ]
    },

    {
      nombre: "Rosa",
      palabras: [
        "pink",
        "rosa"
      ]
    }

  ];

  for (
    const colorItem
    of colores
  ) {

    for (
      const palabra
      of colorItem.palabras
    ) {

      const regex =
        new RegExp(
          `\\b${escaparRegex(palabra)}\\b`,
          "i"
        );

      if (
        regex.test(
          textoCompleto
        )
      ) {

        color =
          colorItem.nombre;

        break;
      }
    }

    if (
      color
    ) {

      break;
    }
  }

  // ==========================================================
  // TIPO DE PRODUCTO
  // ==========================================================

  const tipoProducto =
    detectarTipoProducto(
      nombre ||
      limpio
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

function detectarTipoProducto(
  texto
) {

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

  if (
    t.includes("monitor")
  ) {

    return "Monitor";
  }

  if (
    t.includes("televisor") ||
    t.includes("smart tv") ||
    t.includes("television") ||
    t.includes("televisão")
  ) {

    return "Televisor";
  }

  if (
    t.includes("mouse")
  ) {

    return "Mouse";
  }

  if (
    t.includes("teclado") ||
    t.includes("keyboard")
  ) {

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
    t.includes("disco rigido") ||
    t.includes("disco rígido")
  ) {

    return "Almacenamiento";
  }

  if (
    t.includes("impresora") ||
    t.includes("impressora")
  ) {

    return "Impresora";
  }

  return "Producto";
}


// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(
  texto
) {

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

function limpiarTexto(
  texto
) {

  return String(texto || "")

    .replace(
      /\s+/g,
      " "
    )

    .trim();
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
