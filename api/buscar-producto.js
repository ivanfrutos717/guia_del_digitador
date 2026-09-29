export default async function handler(req, res) {
  // ================================
  // CONFIGURACIÓN BÁSICA
  // ================================
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

  const consulta = String(req.query.consulta || "").trim();

  if (!consulta) {
    return res.status(400).json({
      encontrado: false,
      mensaje: "No se recibió ninguna consulta"
    });
  }

  console.log("=================================");
  console.log("BUSCANDO PRODUCTO:", consulta);
  console.log("=================================");

  // =====================================================
  // 1. BUSCAR DIRECTAMENTE EN NISSEI
  // =====================================================
  try {
    const resultadoNissei = await buscarNissei(consulta);

    if (resultadoNissei) {
      console.log("ENCONTRADO EN NISSEI");

      return res.status(200).json({
        encontrado: true,
        ...resultadoNissei,
        fuente: "Nissei",
        url: resultadoNissei.url || "https://nissei.com/py/"
      });
    }

    console.log("No encontrado en Nissei");

  } catch (error) {
    console.error("Error buscando en Nissei:", error.message);
  }

  // =====================================================
  // SI TODAVÍA NO ENCUENTRA
  // =====================================================
  return res.status(200).json({
    encontrado: false,
    consulta,
    mensaje: "No se encontró el producto en Nissei."
  });
}


// =====================================================
// BUSCADOR NISSEI
// =====================================================

async function buscarNissei(consulta) {

  const urlBusqueda =
    `https://nissei.com/py/catalogsearch/result/?q=${encodeURIComponent(consulta)}`;

  console.log("URL NISSEI:", urlBusqueda);

  const response = await fetch(urlBusqueda, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-PY,es;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    console.log(
      "NISSEI respondió:",
      response.status,
      response.statusText
    );

    return null;
  }

  const html = await response.text();

  console.log("HTML NISSEI recibido:", html.length, "caracteres");

  if (!html || html.length < 500) {
    return null;
  }

  // =====================================================
  // BUSCAR LINKS DE PRODUCTOS
  // =====================================================

  const enlaces = extraerEnlaces(html);

  console.log("Enlaces encontrados:", enlaces.length);

  // Primero intentamos encontrar enlaces que contengan
  // directamente la consulta.
  const consultaNormalizada = normalizar(consulta);

  let candidatos = enlaces.filter(enlace => {
    const texto = normalizar(enlace.texto);
    const href = normalizar(enlace.url);

    return (
      texto.includes(consultaNormalizada) ||
      href.includes(consultaNormalizada)
    );
  });

  // Si no encontramos coincidencia exacta,
  // usamos los primeros enlaces de productos.
  if (candidatos.length === 0) {
    candidatos = enlaces.slice(0, 10);
  }

  console.log("Candidatos Nissei:", candidatos.length);

  // =====================================================
  // ABRIR PÁGINAS DE PRODUCTOS
  // =====================================================

  for (const candidato of candidatos.slice(0, 5)) {

    try {

      const producto = await analizarProductoNissei(
        candidato.url,
        consulta
      );

      if (producto) {
        return producto;
      }

    } catch (error) {
      console.log(
        "Error analizando producto:",
        candidato.url,
        error.message
      );
    }
  }

  return null;
}


// =====================================================
// EXTRAER ENLACES DEL HTML
// =====================================================

function extraerEnlaces(html) {

  const resultados = [];

  const regex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {

    let url = match[1];

    let texto = limpiarHTML(match[2]);

    if (!url) continue;

    // Ignorar enlaces que no son productos
    if (
      url.includes("/customer/") ||
      url.includes("/checkout/") ||
      url.includes("/cart/") ||
      url.includes("/search/") ||
      url.includes("/catalogsearch/")
    ) {
      continue;
    }

    // Convertir URLs relativas en absolutas
    if (url.startsWith("/")) {
      url = "https://nissei.com" + url;
    }

    if (!url.startsWith("http")) {
      continue;
    }

    if (!resultados.some(x => x.url === url)) {
      resultados.push({
        url,
        texto
      });
    }
  }

  return resultados;
}


// =====================================================
// ANALIZAR PÁGINA INDIVIDUAL DE PRODUCTO
// =====================================================

async function analizarProductoNissei(url, consulta) {

  console.log("Analizando:", url);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-PY,es;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();

  if (!html || html.length < 500) {
    return null;
  }

  const texto = limpiarHTML(html);

  const consultaNormalizada = normalizar(consulta);
  const textoNormalizado = normalizar(texto);

  // =====================================================
  // VERIFICAR QUE REALMENTE SEA EL PRODUCTO BUSCADO
  // =====================================================

  if (!textoNormalizado.includes(consultaNormalizada)) {
    return null;
  }

  // =====================================================
  // EXTRAER DATOS
  // =====================================================

  const titulo = extraerTitulo(html);

  const marca = extraerCampo(
    html,
    [
      "Marca",
      "Brand",
      "Fabricante"
    ]
  );

  const modelo = extraerCampo(
    html,
    [
      "Part Number",
      "Modelo",
      "Model",
      "Código"
    ]
  );

  const color = extraerCampo(
    html,
    [
      "Color",
      "Cor"
    ]
  );

  const ean = extraerCampo(
    html,
    [
      "EAN-13",
      "EAN-12",
      "EAN",
      "UPC"
    ]
  );

  const tipoProducto = detectarTipoProducto(
    titulo + " " + texto
  );

  return {
    marca:
      marca ||
      detectarMarca(titulo + " " + texto),

    modelo:
      modelo ||
      consulta,

    tipoProducto:
      tipoProducto || "Producto",

    color:
      color || "",

    ean:
      limpiarEAN(ean),

    nombre:
      titulo || "",

    url
  };
}


// =====================================================
// EXTRAER TÍTULO
// =====================================================

function extraerTitulo(html) {

  let match = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );

  if (match) {
    return limpiarHTML(match[1]);
  }

  match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (match) {
    return limpiarHTML(match[1]);
  }

  return "";
}


// =====================================================
// EXTRAER CAMPOS
// =====================================================

function extraerCampo(html, nombres) {

  for (const nombre of nombres) {

    const patrones = [

      new RegExp(
        `<[^>]*>\\s*${escaparRegex(nombre)}\\s*<\\/[^>]+>\\s*<[^>]*>([\\s\\S]*?)<\\/[^>]+>`,
        "i"
      ),

      new RegExp(
        `${escaparRegex(nombre)}\\s*[:\\-]?\\s*([^<\\n]{1,100})`,
        "i"
      )
    ];

    for (const regex of patrones) {

      const match = html.match(regex);

      if (match && match[1]) {

        const valor = limpiarHTML(match[1]).trim();

        if (
          valor &&
          valor.length < 150 &&
          normalizar(valor) !== normalizar(nombre)
        ) {
          return valor;
        }
      }
    }
  }

  return "";
}


// =====================================================
// DETECTAR MARCA
// =====================================================

function detectarMarca(texto) {

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
    "Brother"
  ];

  const textoNormalizado = normalizar(texto);

  for (const marca of marcas) {

    if (
      textoNormalizado.includes(
        normalizar(marca)
      )
    ) {
      return marca;
    }
  }

  return "";
}


// =====================================================
// DETECTAR TIPO DE PRODUCTO
// =====================================================

function detectarTipoProducto(texto) {

  const t = normalizar(texto);

  if (
    t.includes("playstation") ||
    t.includes("ps5") ||
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
    t.includes("smart tv")
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
    t.includes("placa de video") ||
    t.includes("tarjeta grafica") ||
    t.includes("gpu")
  ) {
    return "Placa de Video";
  }

  if (
    t.includes("memoria ram") ||
    t.includes("memoria ddr")
  ) {
    return "Memoria RAM";
  }

  if (
    t.includes("ssd") ||
    t.includes("disco solido")
  ) {
    return "SSD";
  }

  if (
    t.includes("disco duro") ||
    t.includes("hard disk") ||
    t.includes("hdd")
  ) {
    return "Disco Duro";
  }

  return "";
}


// =====================================================
// LIMPIEZA EAN
// =====================================================

function limpiarEAN(valor) {

  if (!valor) return "";

  const numeros = String(valor)
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


// =====================================================
// UTILIDADES
// =====================================================

function limpiarHTML(texto) {

  return String(texto || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}


function normalizar(texto) {

  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


function escaparRegex(texto) {

  return String(texto)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
