/* Matriz de objetos que contiene los credenciales de acceso predeterminados */
const usuariosPermitidos = [
    { usuario: "Ivan", clave: "220606" }, /* Usuario 1 */
    { usuario: "maria", clave: "5678" },  /* Usuario 2 */
    { usuario: "admin", clave: "0000" }   /* Usuario 3 */
];

/* Referencias a los elementos del DOM en login.html */
const formLogin = document.getElementById('formLogin'); /* Obtiene la etiqueta del formulario */
const inputUsuario = document.getElementById('usuario'); /* Obtiene el campo de texto del usuario */
const inputClave = document.getElementById('clave'); /* Obtiene el campo de texto de la contraseña */
const mensajeError = document.getElementById('mensajeError'); /* Obtiene el párrafo para avisos */

/* Evento que escucha el momento en que el usuario intenta enviar el formulario */
formLogin.addEventListener('submit', function(event) {
    
    /* Detiene el envío por defecto para evitar que la página se recargue */
    event.preventDefault();

    /* Convierte el texto del usuario a minúsculas y elimina espacios innecesarios */
    const usuarioEscrito = inputUsuario.value.toLowerCase().trim();
    
    /* Almacena la contraseña escrita por el usuario tal cual fue ingresada */
    const claveEscrita = inputClave.value;

    /* Variable de control para registrar la validez del acceso */
    let accesoConcedido = false;

    /* Ciclo que itera a través del listado de usuarios autorizados */
    for (let i = 0; i < usuariosPermitidos.length; i++) {
        let cuenta = usuariosPermitidos[i]; /* Asigna la cuenta evaluada en el ciclo actual */

        /* Evalúa coincidencia sin distinguir mayúsculas/minúsculas en el usuario */
        if (cuenta.usuario.toLowerCase() === usuarioEscrito && cuenta.clave === claveEscrita) {
            accesoConcedido = true; /* Marca la validación como exitosa */
            break; /* Interrumpe la ejecución del ciclo al encontrar coincidencia */
        }
    }

    /* Estructura condicional que evalúa la variable de acceso */
    if (accesoConcedido) {
        /* CAMBIO AQUÍ: Redirige hacia el nuevo menú de opciones */
        window.location.href = "menu.html";
    } else {
        /* Despliega mensaje de advertencia en caso de datos inválidos */
        mensajeError.textContent = "Usuario o contraseña incorrectos";
        
        /* Modifica el color del texto de la advertencia a rojo */
        mensajeError.style.color = "#dc2626";
        
        /* Blanquea el campo de contraseña para un nuevo intento */
        inputClave.value = "";
    }
});