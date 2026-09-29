// ==========================================================================
// ASISTENTE DE CADASTRO
// Firebase -> API Vercel -> Gemini + Google Search -> Firebase
// ==========================================================================

// ==========================================================================
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
// ==========================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBnZuOpXhLk-_yCVCfsD6q2rRwgQ5hiE3I",
  authDomain: "guia-del-digitador.firebaseapp.com",
  databaseURL: "https://guia-del-digitador-default-rtdb.firebaseio.com",
  projectId: "guia-del-digitador",
  storageBucket: "guia-del-digitador.firebasestorage.app",
  messagingSenderId: "238391888412",
  appId: "1:238391888412:web:604f08ebefdde4b2eb2dd9"
};

if (!window.firebase) {
  console.error("Firebase SDK no fue cargado.");
  alert("❌ No se pudo cargar Firebase. Revisa la conexión y los scripts del HTML.");
  throw new Error("Firebase SDK no disponible");
}

firebase.initializeApp(firebaseConfig);

const database = firebase.database();
const productosRef = database.ref("productos");

// ==========================================================================
// 2. REFERENCIAS DEL DOM
// ==========================================================================
const inputEan = document.getElementById("inputEan");
const formBusqueda = document.getElementById("formBusqueda");
const formProducto = document.getElementById("formProducto");

const inputMarca = document.getElementById("marca");
const inputModelo = document.getElementById("modelo");
const inputTipoProducto = document.getElementById("tipoProducto");
const inputColor = document.getElementById("color");

const inputResultado = document.getElementById("resultadoDescripcion");
const btnCopiar = document.getElementById("btnCopiar");
const btnBuscar = document.getElementById("btnBuscar");
const badgeNube = document.getElementById("badgeNube");

// ==========================================================================
// 3. ESTADO DE CONEXIÓN CON FIREBASE
// ==========================================================================
database.ref(".info/connected").on("value", (snap) => {
  if (!badgeNube) return;

  if (snap.val() === true) {
    badgeNube.className = "badge-nube conectada";
    badgeNube.innerHTML =
      '<span class="punto-estado"></span> NUBE CONECTADA';
    badgeNube.style.backgroundColor = "#059669";
  } else {
    badgeNube.className = "badge-nube desconectada";
    badgeNube.innerHTML =
      '<span class="punto-estado"></span> DESCONECTADO';
    badgeNube.style.backgroundColor = "#dc2626";
  }
});

// ==========================================================================
// 4. DESCRIPCIÓN FINAL
// ==========================================================================
function actualizarDescripcionFormateada() {
  if (!inputResultado) return;

  const marca = (inputMarca?.value || "").trim().toUpperCase();
  const modelo = (inputModelo?.value || "").trim().toUpperCase();
  const tipo = (inputTipoProducto?.value || "").trim().toUpperCase();
  const color = (inputColor?.value || "").trim().toUpperCase();

  const partes = [marca, modelo, tipo, color].filter(Boolean);

  if (partes.length > 0) {
    inputResultado.value = partes.join(" ");

    if (btnCopiar) {
      btnCopiar.disabled = false;
    }
  } else {
    inputResultado.value = "[MARCA] [MODELO] [PRODUCTO] [COLOR]";

    if (btnCopiar) {
      btnCopiar.disabled = true;
    }
  }
}

[inputMarca, inputModelo, inputTipoProducto, inputColor].forEach((input) => {
  if (input) {
    input.addEventListener("input", actualizarDescripcionFormateada);
  }
});

// ==========================================================================
// 5. VALIDACIÓN DEL CÓDIGO EAN / UPC
// ==========================================================================
function normalizarCodigo(codigo) {
  return String(codigo || "").replace(/\D/g, "");
}

function codigoValido(codigo) {
  const limpio = normalizarCodigo(codigo);

  // EAN-8, UPC-A y EAN-13.
  return [8, 12, 13].includes(limpio.length);
}

// ==========================================================================
// 6. BÚSQUEDA PRINCIPAL
// ==========================================================================
if (formBusqueda) {
  formBusqueda.addEventListener("submit", async (e) => {
    e.preventDefault();

    const codigoEan = normalizarCodigo(inputEan?.value);

    if (!codigoEan) {
      alert("⚠️ Ingresa un código EAN / UPC.");
      inputEan?.focus();
      return;
    }

    if (!codigoValido(codigoEan)) {
      alert(
        "⚠️ El código debe tener 8, 12 o 13 dígitos.\n\n" +
        "Ejemplos: EAN-8, UPC-A (12) o EAN-13."
      );

      inputEan?.focus();
      return;
    }

    if (inputEan) {
      inputEan.value = codigoEan;
    }

    limpiarAtributos();

    if (btnBuscar) {
      btnBuscar.disabled = true;

      btnBuscar.dataset.textoOriginal = btnBuscar.innerHTML;

      btnBuscar.innerHTML =
        '<span class="icono-btn">⏳</span> BUSCANDO...';
    }

    try {

      // ================================================================
      // PASO A: BUSCAR PRIMERO EN FIREBASE
      // ================================================================
      const snapshot = await productosRef
        .child(codigoEan)
        .once("value");

      if (snapshot.exists()) {

        const data = snapshot.val();

        completarAtributos(data);

        alert(
          "✅ Producto cargado desde tu base de datos Firebase.\n\n" +
          inputResultado.value
        );

        return;
      }

      // ================================================================
      // PASO B: CONSULTAR GEMINI MEDIANTE VERCEL
      // ================================================================
      const exitoProxy = await consultarGeminiEan(codigoEan);

      // ================================================================
      // PASO C: FALLBACK POR FAMILIA
      // ================================================================
      if (!exitoProxy) {
        await aplicarPrediccionPorFamilia(codigoEan);
      }

    } catch (error) {

      console.error("Error durante la búsqueda:", error);

      alert(
        "❌ Ocurrió un error durante la búsqueda.\n\n" +
        "Abre F12 → Console para ver el detalle."
      );

    } finally {

      if (btnBuscar) {
        btnBuscar.disabled = false;

        btnBuscar.innerHTML =
          btnBuscar.dataset.textoOriginal ||
          '<span class="icono-btn">🔍</span> BUSCAR';
      }
    }
  });
}

// ==========================================================================
// 7. LIMPIAR / COMPLETAR ATRIBUTOS
// ==========================================================================
function limpiarAtributos() {

  if (inputMarca) {
    inputMarca.value = "";
  }

  if (inputModelo) {
    inputModelo.value = "";
  }

  if (inputTipoProducto) {
    inputTipoProducto.value = "";
  }

  if (inputColor) {
    inputColor.value = "";
  }

  actualizarDescripcionFormateada();
}

function completarAtributos(data) {

  if (inputMarca) {
    inputMarca.value = (data?.marca || "").toUpperCase();
  }

  if (inputModelo) {
    inputModelo.value = (data?.modelo || "").toUpperCase();
  }

  if (inputTipoProducto) {
    inputTipoProducto.value =
      (data?.tipoProducto || "").toUpperCase();
  }

  if (inputColor) {
    inputColor.value =
      (data?.color || "").toUpperCase();
  }

  actualizarDescripcionFormateada();
}

// ==========================================================================
// 8. CONSULTA AL BACKEND DE VERCEL
// ==========================================================================
async function consultarGeminiEan(codigoEan) {

  try {

    const url =
      `/api/buscar-ean?ean=${encodeURIComponent(codigoEan)}`;

    console.log("Consultando API:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const texto = await response.text();

    let resultadoJson;

    try {

      resultadoJson = JSON.parse(texto);

    } catch {

      console.error(
        "La API no devolvió JSON válido:",
        texto
      );

      return false;
    }

    console.log(
      "Respuesta de /api/buscar-ean:",
      resultadoJson
    );

    if (!response.ok) {

      console.error(
        `Error HTTP ${response.status}:`,
        resultadoJson
      );

      alert(
        "❌ Error en el servidor de búsqueda.\n\n" +
        (resultadoJson.error ||
          `HTTP ${response.status}`) +
        "\n\nRevisa F12 → Console."
      );

      return false;
    }

    if (
      resultadoJson.encontrado === true &&
      resultadoJson.marca &&
      resultadoJson.marca !== "NO_ENCONTRADO"
    ) {

      completarAtributos(resultadoJson);

      alert(
        "🤖 Producto identificado mediante búsqueda IA.\n\n" +
        inputResultado.value +
        "\n\n" +
        "⚠️ Verifica los datos antes de guardarlos."
      );

      return true;
    }

    console.warn(
      "No hubo coincidencia exacta:",
      resultadoJson
    );

    return false;

  } catch (error) {

    console.error(
      "Error al consultar /api/buscar-ean:",
      error
    );

    alert(
      "❌ No se pudo contactar con el servidor de IA.\n\n" +
      "Abre F12 → Console para ver el error."
    );

    return false;
  }
}

// ==========================================================================
// 9. FALLBACK POR FAMILIA EAN
// ==========================================================================
async function aplicarPrediccionPorFamilia(codigoNuevo) {

  try {

    const snapshot =
      await productosRef.once("value");

    const productos = snapshot.val();

    if (productos) {

      const lista = Object.values(productos);

      const prefijoNuevo =
        codigoNuevo.substring(0, 7);

      const coincidencia = lista.find(
        (p) =>
          p &&
          p.ean &&
          String(p.ean).startsWith(prefijoNuevo)
      );

      if (coincidencia) {

        if (inputMarca) {
          inputMarca.value =
            coincidencia.marca || "";
        }

        if (inputModelo) {
          inputModelo.value =
            coincidencia.modelo || "";
        }

        if (inputTipoProducto) {
          inputTipoProducto.value =
            coincidencia.tipoProducto || "";
        }

        if (inputColor) {
          inputColor.value = "";
        }

        actualizarDescripcionFormateada();

        alert(
          `💡 Autocompletado por familia.\n\n` +
          `${coincidencia.marca || ""} ` +
          `${coincidencia.modelo || ""}\n\n` +
          "⚠️ El color debe verificarse/ingresarse manualmente."
        );

        if (inputColor) {
          inputColor.focus();
        }

        return;
      }
    }

    alert(
      "ℹ️ No se encontró el código exacto.\n\n" +
      "Completa los campos manualmente y guarda el producto para que quede registrado."
    );

    if (inputMarca) {
      inputMarca.focus();
    }

  } catch (error) {

    console.error(
      "Error en fallback por familia:",
      error
    );

    alert(
      "⚠️ No fue posible consultar el fallback de Firebase.\n\n" +
      "Puedes completar el producto manualmente."
    );
  }
}

// ==========================================================================
// 10. GUARDAR EN FIREBASE
// ==========================================================================
if (formProducto) {

  formProducto.addEventListener("submit", async (e) => {

    e.preventDefault();

    const codigoEan =
      normalizarCodigo(inputEan?.value);

    if (!codigoEan) {

      alert(
        "⚠️ Ingresa un código de barras en el Paso 1."
      );

      inputEan?.focus();

      return;
    }

    const nuevoProducto = {

      ean: codigoEan,

      marca:
        (inputMarca?.value || "")
          .trim()
          .toUpperCase(),

      modelo:
        (inputModelo?.value || "")
          .trim()
          .toUpperCase(),

      tipoProducto:
        (inputTipoProducto?.value || "")
          .trim()
          .toUpperCase(),

      color:
        (inputColor?.value || "")
          .trim()
          .toUpperCase(),

      descripcionFinal:
        inputResultado?.value || "",

      fechaRegistro:
        new Date().toISOString()
    };

    if (
      !nuevoProducto.marca ||
      !nuevoProducto.modelo ||
      !nuevoProducto.tipoProducto
    ) {

      alert(
        "⚠️ Completa MARCA, MODELO y TIPO DE PRODUCTO antes de guardar."
      );

      return;
    }

    try {

      await productosRef
        .child(codigoEan)
        .set(nuevoProducto);

      alert(
        "🚀 ¡Producto guardado correctamente en Firebase!\n\n" +
        nuevoProducto.descripcionFinal
      );

    } catch (err) {

      console.error(
        "Error al guardar en Firebase:",
        err
      );

      alert(
        "❌ Ocurrió un error al guardar en Firebase.\n\n" +
        "Revisa F12 → Console y las reglas de Firebase."
      );
    }
  });
}

// ==========================================================================
// 11. COPIAR DESCRIPCIÓN
// ==========================================================================
if (btnCopiar) {

  btnCopiar.addEventListener("click", async () => {

    const texto =
      inputResultado?.value || "";

    if (
      !texto ||
      texto ===
        "[MARCA] [MODELO] [PRODUCTO] [COLOR]"
    ) {
      return;
    }

    try {

      await navigator.clipboard.writeText(texto);

      const textoOriginal =
        btnCopiar.innerHTML;

      btnCopiar.innerHTML =
        "✅ ¡COPIADO!";

      setTimeout(() => {

        btnCopiar.innerHTML =
          textoOriginal;

      }, 2000);

    } catch (error) {

      console.error(
        "Error al copiar:",
        error
      );

      alert(
        "⚠️ No se pudo copiar automáticamente."
      );
    }
  });
}

// ==========================================================================
// 12. INICIALIZACIÓN
// ==========================================================================
actualizarDescripcionFormateada();

console.log(
  "✅ cadastro.js cargado correctamente."
);