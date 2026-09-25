/* Script encargado de gestionar y persistir el tema de colores del usuario */

/* Evento que se ejecuta al cargar la estructura del documento HTML */
document.addEventListener('DOMContentLoaded', function() {
    
    /* Carga los colores desde localStorage o aplica los valores predeterminados (rojo/negro) */
    const colorFondoGuardado = localStorage.getItem('colorFondo') || '#0b0b0d';
    const colorTarjetaGuardado = localStorage.getItem('colorTarjeta') || '#141417';
    const colorPrincipalGuardado = localStorage.getItem('colorPrincipal') || '#dc2626';
    const colorBotonGuardado = localStorage.getItem('colorBoton') || '#991b1b';

    /* Aplica los colores almacenados a las variables CSS en la raíz del documento */
    document.documentElement.style.setProperty('--color-fondo', colorFondoGuardado);
    document.documentElement.style.setProperty('--color-tarjeta', colorTarjetaGuardado);
    document.documentElement.style.setProperty('--color-principal', colorPrincipalGuardado);
    document.documentElement.style.setProperty('--color-boton', colorBotonGuardado);

    /* Vincula los inputs de color si existen en la página actual */
    const inputColorFondo = document.getElementById('pickerFondo');
    const inputColorPrincipal = document.getElementById('pickerPrincipal');

    /* Si los selectores de color están presentes en el HTML actual, sincroniza sus valores */
    if (inputColorFondo && inputColorPrincipal) {
        inputColorFondo.value = colorFondoGuardado;
        inputColorPrincipal.value = colorPrincipalGuardado;

        /* Listener para cambios en el color de fondo */
        inputColorFondo.addEventListener('input', function(e) {
            const nuevoFondo = e.target.value;
            document.documentElement.style.setProperty('--color-fondo', nuevoFondo);
            localStorage.setItem('colorFondo', nuevoFondo); /* Guarda en el almacenamiento local */
        });

        /* Listener para cambios en el color principal de acento */
        inputColorPrincipal.addEventListener('input', function(e) {
            const nuevoPrincipal = e.target.value;
            document.documentElement.style.setProperty('--color-principal', nuevoPrincipal);
            document.documentElement.style.setProperty('--color-boton', nuevoPrincipal);
            localStorage.setItem('colorPrincipal', nuevoPrincipal); /* Guarda el color acentuado */
            localStorage.setItem('colorBoton', nuevoPrincipal); /* Actualiza el color del botón */
        });
    }
});