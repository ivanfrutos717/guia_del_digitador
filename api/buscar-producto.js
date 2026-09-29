// api/buscar-producto.js

export default async function handler(req, res) {

  try {

    const consulta =
      String(req.query.consulta || "").trim();

    if (!consulta) {

      return res.status(400).json({
        encontrado: false,
        mensaje: "Falta la consulta"
      });

    }

    console.log("====================================");
    console.log("BUSCANDO:", consulta);
    console.log("====================================");


    // ========================================================
    // 1. BUSCAR EL PRODUCTO EN INTERNET CON JINA SEARCH
    // ========================================================

    const consultaBusqueda =
      `site:nissei.com/py/ ${consulta}`;

    const urlBusqueda =
      `https://s.jina.ai/?q=${encodeURIComponent(
        consultaBusqueda
      )}`;

    console.log(
      "URL DE BÚSQUEDA:",
      urlBusqueda
    );


    const respuestaBusqueda =
      await fetch(
        urlBusqueda,
        {
          method: "GET",

          headers: {
            "Accept": "text/plain",
            "User-Agent": "Mozilla/5.0"
          }
        }
      );


    console.log(
      "STATUS BUSQUEDA:",
      respuestaBusqueda.status
    );


    if (!respuestaBusqueda.ok) {

      const error =
        await respuestaBusqueda.text();

      console.log(
        "ERROR BUSQUEDA:",
        error.substring(0, 2000)
      );

      return res.status(200).json({

        encontrado: false,

        consulta,

        mensaje:
          "Jina Search no pudo realizar la búsqueda.",

        status:
          respuestaBusqueda.status

      });

    }


    const resultados =
      await respuestaBusqueda.text();


    console.log(
      "RESULTADOS JINA:",
      resultados.length,
      "caracteres"
    );


    console.log(
      resultados.substring(0, 5000)
    );


    // ========================================================
    // 2. EXTRAER URLS DE LOS RESULTADOS
    // ========================================================

    const urls =
      extraerUrlsBusqueda(
        resultados
      );


    console.log(
      "URLS ENCONTRADAS:",
      urls.length
    );


    console.log(
      urls
    );


    // ========================================================
    // 3. ELEGIR LA URL MÁS PROBABLE
    // ========================================================

    const productoUrl =
      encontrarMejorUrl(
        urls,
        consulta
      );


    console.log(
      "PRODUCTO ELEGIDO:",
      productoUrl
    );


    // ========================================================
    // 4. SI NO ENCONTRAMOS PRODUCTO
    // ========================================================

    if (!productoUrl) {

      return res.status(200).json({

        encontrado: false,

        consulta,

        mensaje:
          "Jina encontró resultados, pero no encontramos una ficha de producto de Nissei.",

        diagnostico: {

          resultadosCaracteres:
            resultados.length,

          urlsEncontradas:
            urls.length,

          urls:
            urls.slice(0, 20)

        }

      });

    }


    // ========================================================
    // 5. LEER LA FICHA REAL DEL PRODUCTO
    // ========================================================

    const productoJinaUrl =
      `https://r.jina.ai/${productoUrl}`;


    console.log(
      "LEYENDO PRODUCTO:",
      productoJinaUrl
    );


    const productoResponse =
      await fetch(
        productoJinaUrl,
        {

          method: "GET",

          headers: {

            "Accept":
              "text/plain",

            "User-Agent":
              "Mozilla/5.0"

          }

        }
      );


    console.log(
      "STATUS PRODUCTO:",
      productoResponse.status
    );


    if (!productoResponse.ok) {

      const errorProducto =
        await productoResponse.text();

      console.log(
        "ERROR PRODUCTO:",
        errorProducto.substring(
          0,
          2000
        )
      );


      return res.status(200).json({

        encontrado: false,

        consulta,

        mensaje:
          "Encontramos la ficha pero no pudimos leerla.",

        url:
          productoUrl,

        status:
          productoResponse.status

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
      productoTexto.substring(
        0,
        7000
      )
    );


    // ========================================================
    // 6. EXTRAER DATOS
    // ========================================================

    const datos =
      extraerDatosProducto(
        productoTexto,
        consulta
      );


    console.log(
      "DATOS EXTRAIDOS:",
      datos
    );


    // ========================================================
    // 7. RESPUESTA FINAL
    // ========================================================

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

      fuente:
        "Nissei",

      url:
        productoUrl

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
// EXTRAER URLS DE JINA SEARCH
// ============================================================

function extraerUrlsBusqueda(
  texto
) {

  const resultado = [];


  // ----------------------------------------------------------
  // URLS COMPLETAS
  // ----------------------------------------------------------

  const regex =
    /https?:\/\/[^\s<>"')]+/gi;


  let match;


  while (
    (match =
      regex.exec(texto)) !== null
  ) {

    let url =
      match[0];


    url =
      url.replace(
        /[.,;]+$/,
        ""
      );


    if (
      !url.includes(
        "nissei.com/py/"
      )
    ) {

      continue;

    }


    if (
      url.includes(
        "catalogsearch"
      )
    ) {

      continue;

    }


    if (
      url ===
        "https://nissei.com/py/" ||
      url ===
        "https://nissei.com/py"
    ) {

      continue;

    }


    resultado.push(
      url
    );

  }


  // ----------------------------------------------------------
  // LINKS MARKDOWN
  // ----------------------------------------------------------

  const markdownRegex =
    /\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/gi;


  while (
    (match =
      markdownRegex.exec(texto)) !== null
  ) {

    let url =
      match[1];


    url =
      url.replace(
        /[.,;]+$/,
        ""
      );


    if (
      !url.includes(
        "nissei.com/py/"
      )
    ) {

      continue;

    }


    if (
      url.includes(
        "catalogsearch"
      )
    ) {

      continue;

    }


    resultado.push(
      url
    );

  }


  return [
    ...new Set(
      resultado
    )
  ];

}


// ============================================================
// ENCONTRAR MELHOR URL
// ============================================================

function encontrarMejorUrl(
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


  // ----------------------------------------------------------
  // 1. COINCIDENCIA DIRECTA
  // ----------------------------------------------------------

  for (
    const url of urls
  ) {

    const urlNormalizada =
      normalizar(
        url
      );


    if (
      urlNormalizada.includes(
        consultaNormalizada
      )
    ) {

      return limpiarUrl(
        url
      );

    }

  }


  // ----------------------------------------------------------
  // 2. COINCIDENCIA POR PARTES
  // ----------------------------------------------------------

  const partes =
    consulta
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .split(
        /[-_\s]+/
      )
      .filter(
        Boolean
      );


  let mejorUrl =
    null;

  let mejorPuntaje =
    0;


  for (
    const url of urls
  ) {

    const urlNormalizada =
      normalizar(
        url
      );


    let puntaje =
      0;


    for (
      const parte of partes
    ) {

      if (
        urlNormalizada.includes(
          normalizar(
            parte
          )
        )
      ) {

        puntaje++;

      }

    }


    if (
      puntaje >
      mejorPuntaje
    ) {

      mejorPuntaje =
        puntaje;

      mejorUrl =
        url;

    }

  }


  if (
    mejorUrl &&
    mejorPuntaje > 0
  ) {

    return limpiarUrl(
      mejorUrl
    );

  }


  return null;

}


// ============================================================
// LIMPIAR URL
// ============================================================

function limpiarUrl(
  url
) {

  return String(
    url
  )

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
// EXTRAER DATOS DEL PRODUCTO
// ============================================================

function extraerDatosProducto(
  texto,
  consulta
) {

  const limpio =
    String(
      texto || ""
    );


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


  // ----------------------------------------------------------
  // NOMBRE
  // ----------------------------------------------------------

  const tituloMatch =
    limpio.match(
      /(?:#\s*)?(.{10,250}(?:CFI|PlayStation|PS5).{0,250})/i
    );


  if (
    tituloMatch
  ) {

    nombre =
      limpiarTexto(
        tituloMatch[1]
      );

  }


  // ----------------------------------------------------------
  // BUSCAR TÍTULO EN LÍNEAS
  // ----------------------------------------------------------

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
      const linea of lineas
    ) {

      if (
        /playstation|sony|cfi-/i.test(
          linea
        ) &&
        linea.length < 400
      ) {

        nombre =
          linea;

        break;

      }

    }

  }


  // ----------------------------------------------------------
  // MARCAS
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


  for (
    const m of marcas
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


  // ----------------------------------------------------------
  // MODELO
  // ----------------------------------------------------------

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


  // ----------------------------------------------------------
  // EAN
  // ----------------------------------------------------------

  const eanMatch =
    limpio.match(
      /(?:EAN(?:-12|-13|-14)?|GTIN)[^\d]{0,30}(\d{12,14})/i
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


  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

  const colores = [

    {
      nombre: "Blanco",
      palabras: [
        "white",
        "blanco"
      ]
    },

    {
      nombre: "Negro",
      palabras: [
        "black",
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
        "gris"
      ]
    },

    {
      nombre: "Plata",
      palabras: [
        "silver",
        "plata"
      ]
    },

    {
      nombre: "Dorado",
      palabras: [
        "gold",
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
    const colorItem of colores
  ) {

    for (
      const palabra of colorItem.palabras
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


  // ----------------------------------------------------------
  // TIPO
  // ----------------------------------------------------------

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
    String(
      texto || ""
    )
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
    t.includes("television")
  ) {

    return "Televisor";

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


  if (
    t.includes("impresora")
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

  return String(
    texto || ""
  )

    .toLowerCase()

    .normalize(
      "NFD"
    )

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

  return String(
    texto || ""
  )

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

  return String(
    texto
  )

    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

}
