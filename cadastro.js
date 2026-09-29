// ==========================================================================
// ASISTENTE DE CADASTRO
// BUSCADOR UNIVERSAL
// ==========================================================================


// ==========================================================================
// 1. FIREBASE
// ==========================================================================

const firebaseConfig = {

  apiKey: "AIzaSyBnZuOpXhLk-_yCVCfsD6q2rRwgQ5hiE3I",

  authDomain:
    "guia-del-digitador.firebaseapp.com",

  databaseURL:
    "https://guia-del-digitador-default-rtdb.firebaseio.com",

  projectId:
    "guia-del-digitador",

  storageBucket:
    "guia-del-digitador.firebasestorage.app",

  messagingSenderId:
    "238391888412",

  appId:
    "1:238391888412:web:604f08ebefdde4b2eb2dd9"

};


firebase.initializeApp(firebaseConfig);


const database =
  firebase.database();


const productosRef =
  database.ref("productos");


// ==========================================================================
// 2. ELEMENTOS
// ==========================================================================

const inputBusqueda =
  document.getElementById("inputBusqueda");

const formBusqueda =
  document.getElementById("formBusqueda");

const formProducto =
  document.getElementById("formProducto");

const inputMarca =
  document.getElementById("marca");

const inputModelo =
  document.getElementById("modelo");

const inputTipoProducto =
  document.getElementById("tipoProducto");

const inputColor =
  document.getElementById("color");

const inputResultado =
  document.getElementById("resultadoDescripcion");

const btnCopiar =
  document.getElementById("btnCopiar");

const btnBuscar =
  document.getElementById("btnBuscar");

const badgeNube =
  document.getElementById("badgeNube");

const tipoBusqueda =
  document.getElementById("tipoBusqueda");

const fuenteResultado =
  document.getElementById("fuenteResultado");


// ==========================================================================
// 3. ESTADO FIREBASE
// ==========================================================================

database
  .ref(".info/connected")
  .on("value", (snap) => {

    if (!badgeNube) return;


    if (snap.val() === true) {

      badgeNube.className =
        "badge-nube conectada";

      badgeNube.innerHTML =
        '<span class="punto-estado"></span> NUBE CONECTADA';

      badgeNube.style.backgroundColor =
        "#059669";

    } else {

      badgeNube.className =
        "badge-nube desconectada";

      badgeNube.innerHTML =
        '<span class="punto-estado"></span> DESCONECTADO';

      badgeNube.style.backgroundColor =
        "#dc2626";

    }

  });


// ==========================================================================
// 4. DETECTAR TIPO DE CONSULTA
// ==========================================================================

function detectarTipoConsulta(valor) {

  const consulta =
    String(valor || "").trim();


  if (!consulta) {

    return "VACIO";

  }


  const soloNumeros =
    consulta.replace(/\D/g, "");


  // EAN / UPC

  if (
    /^\d+$/.test(consulta) &&
    [8, 12, 13, 14].includes(consulta.length)
  ) {

    return "EAN / UPC";

  }


  // MODELO / PART NUMBER

  if (
    /[A-Za-z]/.test(consulta) &&
    /[-_]/.test(consulta)
  ) {

    return "MODELO / REFERENCIA";

  }


  // Texto general

  if (
    /[A-Za-z]/.test(consulta)
  ) {

    return "MODELO / PRODUCTO";

  }


  return "REFERENCIA";

}


// ==========================================================================
// 5. MOSTRAR TIPO DE CONSULTA
// ==========================================================================

if (inputBusqueda) {

  inputBusqueda.addEventListener(
    "input",
    () => {

      const tipo =
        detectarTipoConsulta(
          inputBusqueda.value
        );


      if (tipo === "VACIO") {

        tipoBusqueda.textContent =
          "Escribe un EAN, UPC, modelo o referencia.";

      } else {

        tipoBusqueda.textContent =
          `Tipo detectado: ${tipo}`;

      }

    }
  );

}


// ==========================================================================
// 6. DESCRIPCIÓN FINAL
// ==========================================================================

function actualizarDescripcionFormateada() {

  const marca =
    (inputMarca.value || "")
      .trim()
      .toUpperCase();

  const modelo =
    (inputModelo.value || "")
      .trim()
      .toUpperCase();

  const tipo =
    (inputTipoProducto.value || "")
      .trim()
      .toUpperCase();

  const color =
    (inputColor.value || "")
      .trim()
      .toUpperCase();


  const partes = [

    marca,
    modelo,
    tipo,
    color

  ].filter(
    (p) => p !== ""
  );


  if (partes.length > 0) {

    inputResultado.value =
      partes.join(" ");

    if (btnCopiar) {

      btnCopiar.disabled =
        false;

    }

  } else {

    inputResultado.value =
      "[MARCA] [MODELO] [PRODUCTO] [COLOR]";

    if (btnCopiar) {

      btnCopiar.disabled =
        true;

    }

  }

}


[
  inputMarca,
  inputModelo,
  inputTipoProducto,
  inputColor

].forEach((input) => {

  if (input) {

    input.addEventListener(
      "input",
      actualizarDescripcionFormateada
    );

  }

});


// ==========================================================================
// 7. BUSCAR EN FIREBASE
// ==========================================================================

async function buscarEnFirebase(consulta) {

  try {

    const snapshot =
      await productosRef.once("value");


    const productos =
      snapshot.val();


    if (!productos) {

      return null;

    }


    const consultaNormalizada =
      normalizarTexto(consulta);


    const lista =
      Object.values(productos);


    // ------------------------------------------------------
    // COINCIDENCIA EXACTA POR EAN / UPC
    // ------------------------------------------------------

    const exactaCodigo =
      lista.find((producto) => {

        return normalizarTexto(
          producto.ean || ""
        ) === consultaNormalizada;

      });


    if (exactaCodigo) {

      return {

        ...exactaCodigo,

        fuente: "FIREBASE",

        coincidencia: "EXACTA"

      };

    }


    // ------------------------------------------------------
    // COINCIDENCIA EXACTA POR MODELO
    // ------------------------------------------------------

    const exactaModelo =
      lista.find((producto) => {

        return normalizarTexto(
          producto.modelo || ""
        ) === consultaNormalizada;

      });


    if (exactaModelo) {

      return {

        ...exactaModelo,

        fuente: "FIREBASE",

        coincidencia: "MODELO EXACTO"

      };

    }


    // ------------------------------------------------------
    // COINCIDENCIA POR REFERENCIA
    // ------------------------------------------------------

    const exactaReferencia =
      lista.find((producto) => {

        return normalizarTexto(
          producto.referencia || ""
        ) === consultaNormalizada;

      });


    if (exactaReferencia) {

      return {

        ...exactaReferencia,

        fuente: "FIREBASE",

        coincidencia: "REFERENCIA EXACTA"

      };

    }


    return null;


  } catch (error) {

    console.error(
      "Error buscando en Firebase:",
      error
    );

    return null;

  }

}


// ==========================================================================
// 8. NORMALIZAR TEXTO
// ==========================================================================

function normalizarTexto(texto) {

  return String(texto || "")

    .normalize("NFD")

    .replace(
      /[\u0300-\u036f]/g,
      ""
    )

    .toUpperCase()

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}


// ==========================================================================
// 9. LIMPIAR FORMULARIO
// ==========================================================================

function limpiarFormulario() {

  inputMarca.value = "";

  inputModelo.value = "";

  inputTipoProducto.value = "";

  inputColor.value = "";

  if (fuenteResultado) {

    fuenteResultado.style.display =
      "none";

    fuenteResultado.innerHTML =
      "";

  }

  actualizarDescripcionFormateada();

}


// ==========================================================================
// 10. MOSTRAR RESULTADO
// ==========================================================================

function aplicarResultado(resultado) {

  if (!resultado) {

    return false;

  }


  inputMarca.value =
    resultado.marca || "";

  inputModelo.value =
    resultado.modelo || "";

  inputTipoProducto.value =
    resultado.tipoProducto || "";

  inputColor.value =
    resultado.color || "";


  actualizarDescripcionFormateada();


  if (fuenteResultado) {

    fuenteResultado.style.display =
      "block";


    const fuente =
      resultado.fuente ||
      "FUENTE EXTERNA";


    const coincidencia =
      resultado.coincidencia ||
      "ENCONTRADO";


    fuenteResultado.innerHTML =

      `✅ <strong>PRODUCTO ENCONTRADO</strong><br><br>` +

      `Fuente: <strong>${escapeHtml(fuente)}</strong><br>` +

      `Coincidencia: <strong>${escapeHtml(coincidencia)}</strong>`;


    if (resultado.url) {

      fuenteResultado.innerHTML +=

        `<br><br>` +

        `<a href="${escapeAttribute(resultado.url)}" ` +

        `target="_blank" ` +

        `rel="noopener noreferrer">` +

        `Ver producto en la fuente ↗` +

        `</a>`;

    }

  }


  return true;

}


// ==========================================================================
// 11. BUSCADOR UNIVERSAL
// ==========================================================================

if (formBusqueda) {

  formBusqueda.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const consulta =
        inputBusqueda.value.trim();


      if (!consulta) {

        return;

      }


      limpiarFormulario();


      btnBuscar.disabled =
        true;

      btnBuscar.innerHTML =
        "⏳ BUSCANDO...";


      tipoBusqueda.textContent =
        "Consultando tu base de datos...";


      try {

        // ====================================================
        // PASO 1 - FIREBASE
        // ====================================================

        const resultadoFirebase =
          await buscarEnFirebase(
            consulta
          );


        if (resultadoFirebase) {

          aplicarResultado(
            resultadoFirebase
          );


          alert(
            "✅ Producto encontrado en tu base de datos Firebase."
          );


          return;

        }


        // ====================================================
        // PASO 2 - FUENTES EXTERNAS
        // ====================================================

        tipoBusqueda.textContent =
          "Buscando en las tiendas y catálogos...";


        const url =
          `/api/buscar-producto?consulta=${encodeURIComponent(consulta)}`;


        const response =
          await fetch(url);


        const data =
          await response.json();


        console.log(
          "Respuesta buscador:",
          data
        );


        if (
          response.ok &&
          data.encontrado
        ) {

          aplicarResultado(data);


          alert(
            `✅ Producto encontrado en ${data.fuente}.`
          );


          return;

        }


        // ====================================================
        // NO ENCONTRADO
        // ====================================================

        tipoBusqueda.textContent =
          "No se encontró una coincidencia exacta.";


        alert(
          "ℹ️ No encontramos el producto automáticamente.\n\n" +
          "Puedes completar los campos manualmente y guardarlo."
        );


        inputMarca.focus();


      } catch (error) {

        console.error(
          "Error en buscador:",
          error
        );


        alert(
          "❌ No fue posible realizar la búsqueda externa."
        );


      } finally {

        btnBuscar.disabled =
          false;

        btnBuscar.innerHTML =
          '<span class="icono-btn">🔍</span> BUSCAR';

      }

    }
  );

}


// ==========================================================================
// 12. GUARDAR PRODUCTO
// ==========================================================================

if (formProducto) {

  formProducto.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const consultaOriginal =
        inputBusqueda.value.trim();


      if (!consultaOriginal) {

        alert(
          "⚠️ Primero debes buscar o ingresar un producto."
        );

        inputBusqueda.focus();

        return;

      }


      const nuevoProducto = {

        ean:
          /^\d{8,14}$/.test(
            consultaOriginal
          )
            ? consultaOriginal
            : "",

        referencia:
          /^\d{8,14}$/.test(
            consultaOriginal
          )
            ? ""
            : consultaOriginal.toUpperCase(),

        marca:
          inputMarca.value
            .trim()
            .toUpperCase(),

        modelo:
          inputModelo.value
            .trim()
            .toUpperCase(),

        tipoProducto:
          inputTipoProducto.value
            .trim()
            .toUpperCase(),

        color:
          inputColor.value
            .trim()
            .toUpperCase(),

        descripcionFinal:
          inputResultado.value,

        fuente:
          obtenerFuenteActual(),

        consultaOriginal:
          consultaOriginal,

        fechaRegistro:
          new Date().toISOString()

      };


      if (
        !nuevoProducto.marca ||
        !nuevoProducto.modelo ||
        !nuevoProducto.tipoProducto ||
        !nuevoProducto.color
      ) {

        alert(
          "⚠️ Completa todos los atributos antes de guardar."
        );

        return;

      }


      const esCodigo =
        /^\d{8,14}$/.test(
          consultaOriginal
        );


      try {

        if (esCodigo) {

          // Para EAN/UPC mantenemos
          // la estructura actual.

          await productosRef
            .child(consultaOriginal)
            .set(nuevoProducto);

        } else {

          // Para modelos/referencias
          // utilizamos una clave automática.

          await productosRef
            .push(nuevoProducto);

        }


        alert(
          "🚀 ¡Producto guardado correctamente en Firebase!"
        );


      } catch (error) {

        console.error(
          "Error al guardar:",
          error
        );


        alert(
          "❌ Ocurrió un error al guardar."
        );

      }

    }
  );

}


// ==========================================================================
// 13. OBTENER FUENTE
// ==========================================================================

function obtenerFuenteActual() {

  if (
    fuenteResultado &&
    fuenteResultado.innerText
  ) {

    const texto =
      fuenteResultado.innerText;


    const match =
      texto.match(
        /Fuente:\s*(.+)/
      );


    if (match) {

      return match[1]
        .split("\n")[0]
        .trim();

    }

  }


  return "MANUAL";

}


// ==========================================================================
// 14. COPIAR
// ==========================================================================

if (btnCopiar) {

  btnCopiar.addEventListener(
    "click",
    () => {

      const texto =
        inputResultado.value;


      if (
        !texto ||
        texto ===
          "[MARCA] [MODELO] [PRODUCTO] [COLOR]"
      ) {

        return;

      }


      navigator.clipboard
        .writeText(texto)
        .then(() => {

          const original =
            btnCopiar.innerHTML;


          btnCopiar.innerHTML =
            "✅ ¡COPIADO!";


          setTimeout(
            () => {

              btnCopiar.innerHTML =
                original;

            },
            2000
          );

        });

    }
  );

}


// ==========================================================================
// 15. SEGURIDAD HTML
// ==========================================================================

function escapeHtml(texto) {

  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


function escapeAttribute(texto) {

  return String(texto || "")
    .replace(/"/g, "&quot;");

}


// ==========================================================================
// FIN
// ==========================================================================
