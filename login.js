/* Matriz de objetos que contiene los credenciales de acceso predeterminados */
const usuariosPermitidos = [
    { usuario: "Ivan", clave: "220606" }, 
    { usuario: "Ulises", clave: "QWERTY12345" },  
    { usuario: "Mario", clave: "papoi" }, 
    { usuario: "Junior", clave: "gtafifa2008nfs" }, 
    { usuario: "monica", clave: "chefeechefenepai" }
];

/* Referencias a los elementos del DOM en login.html */
const formLogin = document.getElementById('formLogin');
const inputUsuario = document.getElementById('usuario');
const inputClave = document.getElementById('clave');
const mensajeError = document.getElementById('mensajeError');

/* Evento que escucha el momento en que el usuario intenta enviar el formulario */
formLogin.addEventListener('submit', function(event) {
    
    /* Detiene el envío por defecto */
    event.preventDefault();

    /* Convierte el texto del usuario a minúsculas y elimina espacios innecesarios */
    const usuarioEscrito = inputUsuario.value.toLowerCase().trim();
    
    /* Almacena la contraseña escrita por el usuario tal cual fue ingresada */
    const claveEscrita = inputClave.value;

    /* Variable de control y almacenamiento del usuario validado */
    let accesoConcedido = false;
    let nombreUsuarioValidado = "";

    /* Ciclo que itera a través del listado de usuarios autorizados */
    for (let i = 0; i < usuariosPermitidos.length; i++) {
        let cuenta = usuariosPermitidos[i];

        /* Evalúa coincidencia sin distinguir mayúsculas/minúsculas */
        if (cuenta.usuario.toLowerCase() === usuarioEscrito && cuenta.clave === claveEscrita) {
            accesoConcedido = true;
            // Guardamos el nombre exactamente como está definido en el array (ej. "Ivan")
            nombreUsuarioValidado = cuenta.usuario;
            break;
        }
    }

    /* Estructura condicional que evalúa la variable de acceso */
    if (accesoConcedido) {
        /* Guarda el nombre oficial del objeto en localStorage */
        localStorage.setItem('usuarioActivo', nombreUsuarioValidado);
        
        /* Redirige hacia el menú de opciones */
        window.location.href = "menu.html";
    } else {
        /* Despliega mensaje de advertencia en caso de datos inválidos */
        mensajeError.textContent = "Usuario o contraseña incorrectos";
        mensajeError.style.color = "#dc2626";
        inputClave.value = "";
    }
});