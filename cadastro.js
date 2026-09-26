// ==========================================================================
// CONFIGURACIÓN E INICIALIZACIÓN DE FIREBASE
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

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const productosRef = database.ref('productos');

// ==========================================================================
// REFERENCIAS DEL DOM
// ==========================================================================
const inputEan = document.getElementById('inputEan');
const formBusqueda = document.getElementById('formBusqueda');
const formProducto = document.getElementById('formProducto');

const inputMarca = document.getElementById('marca');
const inputModelo = document.getElementById('modelo');
const inputTipoProducto = document.getElementById('tipoProducto');
const inputColor = document.getElementById('color');

const inputResultado = document.getElementById('resultadoDescripcion');
const btnCopiar = document.getElementById('btnCopiar');
const badgeNube = document.getElementById('badgeNube');

// Estado de conexión a Firebase
database.ref('.info/connected').on('value', (snap) => {
  if (badgeNube) {
    if (snap.val() === true) {
      badgeNube.className = "badge-nube conectada";
      badgeNube.innerHTML = '<span class="punto-estado"></span> NUBE CONECTADA';
      badgeNube.style.backgroundColor = "#059669";
    } else {
      badgeNube.className = "badge-nube desconectada";
      badgeNube.innerHTML = '<span class="punto-estado"></span> DESCONECTADO';
      badgeNube.style.backgroundColor = "#dc2626";
    }
  }
});

// ==========================================================================
// 1. GENERACIÓN AUTOMÁTICA DE LA DESCRIPCIÓN FORMATO FINAL
// ==========================================================================
function actualizarDescripcionFormateada() {
  const marca = (inputMarca.value || '').trim().toUpperCase();
  const modelo = (inputModelo.value || '').trim().toUpperCase();
  const tipo = (inputTipoProducto.value || '').trim().toUpperCase();
  const color = (inputColor.value || '').trim().toUpperCase();

  const partes = [marca, modelo, tipo, color].filter(p => p !== '');
  
  if (partes.length > 0) {
    inputResultado.value = partes.join(' ');
    if (btnCopiar) btnCopiar.disabled = false;
  } else {
    inputResultado.value = '[MARCA] [MODELO] [PRODUCTO] [COLOR]';
    if (btnCopiar) btnCopiar.disabled = true;
  }
}

[inputMarca, inputModelo, inputTipoProducto, inputColor].forEach(input => {
  if (input) input.addEventListener('input', actualizarDescripcionFormateada);
});

// ==========================================================================
// 2. BUSCADOR INTEGRADO (FIREBASE -> BACKEND PROXY -> PREDICCIÓN LOCAL)
// ==========================================================================
if (formBusqueda) {
  formBusqueda.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigoEan = inputEan.value.trim();
    if (!codigoEan) return;

    // Limpiar campos antes de consultar
    inputMarca.value = '';
    inputModelo.value = '';
    inputTipoProducto.value = '';
    inputColor.value = '';
    actualizarDescripcionFormateada();

    // Paso A: Buscar primero en Firebase
    productosRef.child(codigoEan).once('value', async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        inputMarca.value = data.marca || '';
        inputModelo.value = data.modelo || '';
        inputTipoProducto.value = data.tipoProducto || '';
        inputColor.value = data.color || '';
        actualizarDescripcionFormateada();
        alert('✅ Producto cargado desde tu base de datos Firebase.');
      } else {
        // Paso B: Consultar a tu API Serverless en Vercel
        const exitoProxy = await consultarGeminiEan(codigoEan);

        // Paso C: Si no se encuentra en el proxy, intentar por prefijo/familia
        if (!exitoProxy) {
          aplicarPrediccionPorFamilia(codigoEan);
        }
      }
    });
  });
}

// BÚSQUEDA MEDIANTE SERVIDOR PROXY SEGURO
async function consultarGeminiEan(codigoEan) {
  try {
    const response = await fetch(`/api/buscar-ean?ean=${codigoEan}`);
    if (!response.ok) return false;

    const resultadoJson = await response.json();

    if (resultadoJson.marca && resultadoJson.marca !== "NO_ENCONTRADO" && !resultadoJson.error) {
      inputMarca.value = (resultadoJson.marca || '').toUpperCase();
      inputModelo.value = (resultadoJson.modelo || '').toUpperCase();
      inputTipoProducto.value = (resultadoJson.tipoProducto || '').toUpperCase();
      inputColor.value = (resultadoJson.color || '').toUpperCase();

      actualizarDescripcionFormateada();
      alert(`🤖 ¡Producto identificado exitosamente!\n\n${inputResultado.value}`);
      return true;
    }
  } catch (err) {
    console.error("Error al consultar el servidor proxy:", err);
  }

  return false;
}

// Predicción por Prefijo EAN (Familia)
function aplicarPrediccionPorFamilia(codigoNuevo) {
  productosRef.once('value', (snapshot) => {
    const productos = snapshot.val();
    
    if (productos) {
      const lista = Object.values(productos);
      const prefijoNuevo = codigoNuevo.substring(0, 7);
      const coincidencia = lista.find(p => p.ean && p.ean.startsWith(prefijoNuevo));

      if (coincidencia) {
        inputMarca.value = coincidencia.marca || '';
        inputModelo.value = coincidencia.modelo || '';
        inputTipoProducto.value = coincidencia.tipoProducto || '';
        inputColor.value = '';
        actualizarDescripcionFormateada();
        alert(`💡 Autocompletado por familia (${coincidencia.marca} ${coincidencia.modelo}). Por favor ingresa el color.`);
        if (inputColor) inputColor.focus();
        return;
      }
    }

    alert('ℹ️ Código no registrado. Completa los campos manualmente para guardarlo en la base de datos.');
    if (inputMarca) inputMarca.focus();
  });
}

// ==========================================================================
// 3. GUARDAR EN FIREBASE Y COPIAR
// ==========================================================================
if (formProducto) {
  formProducto.addEventListener('submit', (e) => {
    e.preventDefault();
    const codigoEan = inputEan.value.trim();

    if (!codigoEan) {
      alert('⚠️ Ingresa un código de barras en el Paso 1.');
      return;
    }

    const nuevoProducto = {
      ean: codigoEan,
      marca: inputMarca.value.trim().toUpperCase(),
      modelo: inputModelo.value.trim().toUpperCase(),
      tipoProducto: inputTipoProducto.value.trim().toUpperCase(),
      color: inputColor.value.trim().toUpperCase(),
      descripcionFinal: inputResultado.value,
      fechaRegistro: new Date().toISOString()
    };

    productosRef.child(codigoEan).set(nuevoProducto)
      .then(() => {
        alert('🚀 ¡Producto guardado correctamente en Firebase!');
      })
      .catch((err) => {
        console.error("Error al guardar:", err);
        alert('❌ Ocurrió un error al guardar.');
      });
  });
}

if (btnCopiar) {
  btnCopiar.addEventListener('click', () => {
    const texto = inputResultado.value;
    if (texto && texto !== '[MARCA] [MODELO] [PRODUCTO] [COLOR]') {
      navigator.clipboard.writeText(texto).then(() => {
        const textoOriginal = btnCopiar.innerHTML;
        btnCopiar.innerHTML = '✅ ¡COPIADO!';
        setTimeout(() => { btnCopiar.innerHTML = textoOriginal; }, 2000);
      });
    }
  });
}