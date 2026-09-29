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
    // 1. FUENTES
    // =========================================================

    const fuentes = [

      // -------------------------------------------------------
      // COMPRAS PARAGUAI
      // -------------------------------------------------------

      {
        nombre: "Compras Paraguai",

        buscar: async () => {

          const urlComprasParaguai =
            `https://www.comprasparaguai.com.br/busca/?q=${encodeURIComponent(consulta)}`;

          const urlJina =
            `https://r.jina.ai/${urlComprasParaguai}`;

          console.log(
            "URL JINA COMPRAS PARAGUAI:"
          );

          console.log(
            urlJina
          );

          const respuesta =
            await fetch(
              urlJina,
              {
                method: "GET",

                headers: {
                  "Accept": "text/plain",
                  "User-Agent": "Mozilla/5.0"
                }
              }
            );

          console.log(
            "STATUS JINA:",
            respuesta.status
          );

          if (!respuesta.ok) {

            const textoError =
              await respuesta.text();

            console.log(
              "ERROR JINA:",
              textoError.substring(
                0,
                1000
              )
            );

            return null;
          }

          const contenido =
            await respuesta.text();

          console.log(
            "CONTENIDO JINA:",
            contenido.length,
            "caracteres"
          );

          console.log(
            contenido.substring(
              0,
              3000
            )
          );

          // ---------------------------------------------------
          // IMPORTANTE:
          // SI LA BÚSQUEDA MISMA DEVUELVE CAPTCHA,
          // DESCARTAMOS ESTA FUENTE.
          // ---------------------------------------------------

          if (
            esPaginaSeguridad(
              contenido
            )
          ) {

            console.log(
              "COMPRAS PARAGUAI: CAPTCHA / SEGURIDAD"
            );

            return null;
          }

          const urls =
            extraerUrls(
              contenido
            );

          console.log(
            "URLS ENCONTRADAS:",
            urls.length
          );

          const productoUrl =
            seleccionarProducto(
              urls,
              consulta
            );

          console.log(
            "PRODUCTO URL:",
            productoUrl
          );

          if (
            !productoUrl
          ) {

            return null;
          }

          return {
            url:
              productoUrl
          };
        }
      },


      // -------------------------------------------------------
      // NISSEI
      // -------------------------------------------------------

      {
        nombre: "Nissei",

        buscar: async () => {

          const urls = [

            `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`,

            `https://nissei.com/py/busca?q=${encodeURIComponent(consulta)}`,

            `https://nissei.com/py/search?q=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      },


      // -------------------------------------------------------
      // INTERSHOP
      // -------------------------------------------------------

      {
        nombre: "Intershop",

        buscar: async () => {

          const urls = [

            `https://intershop.com.py/search?search=${encodeURIComponent(consulta)}`,

            `https://intershop.com.py/busca?search=${encodeURIComponent(consulta)}`,

            `https://intershop.com.py/?s=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      },


      // -------------------------------------------------------
      // MEGA ELECTRÓNICOS
      // -------------------------------------------------------

      {
        nombre: "Mega Electrónicos",

        buscar: async () => {

          const urls = [

            `https://megaelectronicos.com.py/producto/buscar?search=${encodeURIComponent(consulta)}`,

            `https://megaelectronicos.com.py/producto/buscar?available=yes&search=${encodeURIComponent(consulta)}`,

            `https://megaelectronicos.com.py/?s=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      },


      // -------------------------------------------------------
      // CELLSHOP
      // -------------------------------------------------------

      {
        nombre: "Cellshop",

        buscar: async () => {

          const urls = [

            `https://cellshop.com.py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`,

            `https://cellshop.com.py/?s=${encodeURIComponent(consulta)}`,

            `https://cellshop.com.py/buscar?q=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      },


      // -------------------------------------------------------
      // ATACADO CONNECT
      // -------------------------------------------------------

      {
        nombre: "Atacado Connect",

        buscar: async () => {

          const urls = [

            `https://atacadoconnect.com/search?q=${encodeURIComponent(consulta)}`,

            `https://atacadoconnect.com/busca?q=${encodeURIComponent(consulta)}`,

            `https://atacadoconnect.com/?s=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      },


      // -------------------------------------------------------
      // NEWZONE
      // -------------------------------------------------------

      {
        nombre: "Newzone",

        buscar: async () => {

          const urls = [

            `https://www.newzone.com.py/search?q=${encodeURIComponent(consulta)}`,

            `https://www.newzone.com.py/buscar?q=${encodeURIComponent(consulta)}`,

            `https://www.newzone.com.py/?s=${encodeURIComponent(consulta)}`

          ];

          return await buscarFuenteGenerica(
            urls,
            consulta
          );
        }
      }

    ];


    // =========================================================
    // 2. PROBAR FUENTES UNA POR UNA
    // =========================================================

    for (
      const fuente
      of fuentes
    ) {

      console.log(
        "===================================="
      );

      console.log(
        "PROBANDO FUENTE:",
        fuente.nombre
      );

      try {

        const resultado =
          await fuente.buscar();

        if (
          !resultado ||
          !resultado.url
        ) {

          console.log(
            "NO HAY PRODUCTO EN:",
            fuente.nombre
          );

          continue;
        }


        // =====================================================
        // 3. TENEMOS URL.
        //    AHORA HAY QUE LEER EL PRODUCTO.
        // =====================================================

        console.log(
          "URL ENCONTRADA EN:",
          fuente.nombre
        );

        console.log(
          resultado.url
        );

        const producto =
          await leerProducto(
            resultado.url
          );


        // =====================================================
        // 4. SI EL PRODUCTO ES CAPTCHA:
        //    NO DEVOLVER ERROR.
        //    CONTINUAR CON LA SIGUIENTE FUENTE.
        // =====================================================

        if (
          !producto ||
          !producto.texto
        ) {

          console.log(
            "PRODUCTO NO DISPONIBLE:",
            fuente.nombre
          );

          console.log(
            "PASANDO A SIGUIENTE FUENTE..."
          );

          continue;
        }


        // =====================================================
        // 5. PRODUCTO REAL ENCONTRADO
        // =====================================================

        console.log(
          "PRODUCTO REAL ENCONTRADO EN:",
          fuente.nombre
        );

        console.log(
          "CARACTERES:",
          producto.texto.length
        );


        // =====================================================
        // 6. EXTRAER DATOS
        // =====================================================

        const datos =
          extraerDatosProducto(
            producto.texto,
            consulta
          );

        console.log(
          "DATOS:",
          datos
        );


        // =====================================================
        // 7. DEVOLVER RESULTADO
        // =====================================================

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

          // -------------------------------------------------
          // ESTA ES LA DESCRIPCIÓN ORIGINAL REAL
          // -------------------------------------------------

          descripcionOriginal:
            producto.texto,

          // -------------------------------------------------
          // FUENTE QUE REALMENTE FUNCIONÓ
          // -------------------------------------------------

          fuente:
            fuente.nombre,

          url:
            resultado.url

        });

      } catch (error) {

        console.error(
          "ERROR EN FUENTE:",
          fuente.nombre,
          error.message
        );

        // ===================================================
        // MUY IMPORTANTE:
        // UNA FUENTE FALLA → CONTINUAR CON LA SIGUIENTE
        // ===================================================

        continue;
      }
    }


    // =========================================================
    // 8. NINGUNA FUENTE FUNCIONÓ
    // =========================================================

    return res.status(200).json({

      encontrado: false,

      consulta,

      mensaje:
        "No encontramos el producto en las fuentes consultadas.",

      fuentesConsultadas:
        fuentes.map(
          fuente =>
            fuente.nombre
        )

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
// BUSCAR FUENTE GENÉRICA
// ============================================================

async function buscarFuenteGenerica(
  urlsBusqueda,
  consulta
) {

  for (
    const urlBusqueda
    of urlsBusqueda
  ) {

    try {

      console.log(
        "PROBANDO URL:",
        urlBusqueda
      );

      const urlJina =
        `https://r.jina.ai/${urlBusqueda}`;

      const respuesta =
        await fetch(
          urlJina,
          {
            method: "GET",

            headers: {
              "Accept": "text/plain",
              "User-Agent": "Mozilla/5.0"
            }
          }
        );

      console.log(
        "STATUS:",
        respuesta.status
      );

      if (
        !respuesta.ok
      ) {

        continue;
      }

      const contenido =
        await respuesta.text();

      console.log(
        "CARACTERES:",
        contenido.length
      );

      // ------------------------------------------------------
      // CAPTCHA = DESCARTAR ESTA URL
      // ------------------------------------------------------

      if (
        esPaginaSeguridad(
          contenido
        )
      ) {

        console.log(
          "CAPTCHA / SEGURIDAD DETECTADO"
        );

        continue;
      }

      const urls =
        extraerUrlsGenericas(
          contenido
        );

      console.log(
        "URLS ENCONTRADAS:",
        urls.length
      );

      const productoUrl =
        seleccionarProducto(
          urls,
          consulta
        );

      if (
        productoUrl
      ) {

        return {
          url:
            productoUrl
        };
      }

    } catch (error) {

      console.log(
        "ERROR BUSCANDO:",
        error.message
      );

      continue;
    }
  }

  return null;
}


// ============================================================
// LEER PÁGINA DEL PRODUCTO
// ============================================================

async function leerProducto(
  productoUrl
) {

  console.log(
    "===================================="
  );

  console.log(
    "LEYENDO PRODUCTO:"
  );

  console.log(
    productoUrl
  );


  // ==========================================================
  // PRIMER INTENTO: JINA
  // ==========================================================

  try {

    const productoJinaUrl =
      `https://r.jina.ai/${productoUrl}`;

    console.log(
      "JINA PRODUCTO:"
    );

    console.log(
      productoJinaUrl
    );

    const productoResponse =
      await fetch(
        productoJinaUrl,
        {
          method: "GET",

          headers: {
            "Accept": "text/plain",
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

    console.log(
      "STATUS PRODUCTO JINA:",
      productoResponse.status
    );

    if (
      productoResponse.ok
    ) {

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
          3000
        )
      );


      // ------------------------------------------------------
      // SI ES CAPTCHA:
      // NO USARLO
      // ------------------------------------------------------

      if (
        !esPaginaSeguridad(
          productoTexto
        ) &&
        productoTexto.length > 100
      ) {

        return {
          texto:
            productoTexto
        };
      }

      console.log(
        "JINA DEVOLVIÓ CAPTCHA."
      );
    }

  } catch (error) {

    console.log(
      "ERROR JINA PRODUCTO:",
      error.message
    );
  }


  // ==========================================================
  // SEGUNDO INTENTO: DIRECTO
  // ==========================================================

  try {

    console.log(
      "INTENTANDO LECTURA DIRECTA..."
    );

    const respuesta =
      await fetch(
        productoUrl,
        {
          method: "GET",

          headers: {

            "Accept":
              "text/html,application/xhtml+xml,text/plain",

            "User-Agent":
              "Mozilla/5.0"
          }
        }
      );

    console.log(
      "STATUS DIRECTO:",
      respuesta.status
    );

    if (
      respuesta.ok
    ) {

      const texto =
        await respuesta.text();

      console.log(
        "TEXTO DIRECTO:",
        texto.length,
        "caracteres"
      );


      // ------------------------------------------------------
      // SI ES CAPTCHA:
      // NO USARLO
      // ------------------------------------------------------

      if (
        !esPaginaSeguridad(
          texto
        ) &&
        texto.length > 100
      ) {

        return {
          texto:
            texto
        };
      }

      console.log(
        "LECTURA DIRECTA DEVOLVIÓ CAPTCHA."
      );
    }

  } catch (error) {

    console.log(
      "ERROR LECTURA DIRECTA:",
      error.message
    );
  }


  // ==========================================================
  // NO SIRVIÓ ESTA FUENTE
  // ==========================================================

  console.log(
    "NO SE PUDO LEER PRODUCTO REAL."
  );

  return null;
}


// ============================================================
// DETECTAR CAPTCHA / CLOUDFLARE / SEGURIDAD
// ============================================================

function esPaginaSeguridad(
  texto
) {

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

    "captcha",

    "security verification",

    "access denied",

    "enable javascript and cookies"

  ];

  return indicadores.some(
    palabra =>
      t.includes(
        palabra
      )
  );
}


// ============================================================
// EXTRAER URLS
// ============================================================

function extraerUrls(
  texto
) {

  const resultado = [];

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
      url.includes(
        "comprasparaguai.com.br/"
      )
    ) {

      resultado.push(
        url
      );
    }
  }

  return [
    ...new Set(
      resultado
    )
  ];
}


// ============================================================
// EXTRAER URLS GENERICAS
// ============================================================

function extraerUrlsGenericas(
  texto
) {

  const resultado = [];

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
      limpiarUrl(
        url
      );

    resultado.push(
      url
    );
  }


  // ----------------------------------------------------------
  // TAMBIÉN BUSCAR HREF
  // ----------------------------------------------------------

  const regexHref =
    /href\s*=\s*["']([^"']+)["']/gi;

  while (
    (match =
      regexHref.exec(texto)) !== null
  ) {

    let url =
      match[1];

    if (
      url.startsWith("http")
    ) {

      resultado.push(
        limpiarUrl(
          url
        )
      );
    }
  }


  return [
    ...new Set(
      resultado
    )
  ];
}


// ============================================================
// SELECCIONAR PRODUCTO
// ============================================================

function seleccionarProducto(
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
    consulta
      .toLowerCase()
      .split(/[-_\s]+/)
      .filter(
        parte =>
          parte.length >= 2
      );

  let productoUrl =
    null;

  let mejorPuntaje =
    -1;


  for (
    const url
    of urls
  ) {

    const urlNormalizada =
      normalizar(
        url
      );

    let puntaje =
      0;


    // --------------------------------------------------------
    // COINCIDENCIA EXACTA
    // --------------------------------------------------------

    if (
      urlNormalizada.includes(
        consultaNormalizada
      )
    ) {

      puntaje += 100;
    }


    // --------------------------------------------------------
    // COINCIDENCIA POR PARTES
    // --------------------------------------------------------

    for (
      const parte
      of partes
    ) {

      const parteNormalizada =
        normalizar(
          parte
        );

      if (
        parteNormalizada &&
        urlNormalizada.includes(
          parteNormalizada
        )
      ) {

        puntaje += 20;
      }
    }


    // --------------------------------------------------------
    // PRIORIZAR URL DE PRODUCTO
    // --------------------------------------------------------

    if (
      pareceUrlProducto(
        url
      )
    ) {

      puntaje += 10;
    }


    if (
      puntaje >
      mejorPuntaje
    ) {

      mejorPuntaje =
        puntaje;

      productoUrl =
        limpiarUrl(
          url
        );
    }
  }


  console.log(
    "MEJOR PRODUCTO:"
  );

  console.log(
    productoUrl
  );

  console.log(
    "PUNTAJE:",
    mejorPuntaje
  );


  return productoUrl;
}


// ============================================================
// SABER SI URL PARECE PRODUCTO
// ============================================================

function pareceUrlProducto(
  url
) {

  const u =
    String(url || "")
      .toLowerCase();


  // No seleccionar páginas de búsqueda
  if (
    u.includes("/busca") ||
    u.includes("/search") ||
    u.includes("catalogsearch") ||
    u.includes("?s=") ||
    u.includes("?q=")
  ) {

    return false;
  }


  // URL larga normalmente corresponde
  // a una página de producto
  if (
    u.length >= 50
  ) {

    return true;
  }


  return false;
}


// ============================================================
// LIMPIAR URL
// ============================================================

function limpiarUrl(
  url
) {

  return String(url)

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
    String(texto || "");

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
      /(?:#\s*)?(.{10,250}(?:CFI|PlayStation|PS5|iPhone|Galaxy|Xiaomi|Samsung).{0,250})/i
    );

  if (
    tituloMatch
  ) {

    nombre =
      limpiarTexto(
        tituloMatch[1]
      );
  }


  // Buscar primera línea que parezca título
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
        /playstation|sony|cfi-|iphone|samsung|xiaomi|motorola|lenovo|asus|acer|dell|logitech|canon|nintendo|microsoft/i
          .test(
            linea
          )
        &&
        linea.length < 300
      ) {

        nombre =
          linea;

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


  // ----------------------------------------------------------
  // COLOR
  // ----------------------------------------------------------

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

      if (
        new RegExp(
          `\\b${escaparRegex(palabra)}\\b`,
          "i"
        ).test(
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
