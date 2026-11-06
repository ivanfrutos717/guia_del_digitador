
/*
 * GUÍA DEL DIGITADOR
 * Control de usuario por pestaña
 *
 * Cada pestaña abierta independientemente
 * puede mantener su propio usuario.
 */

(function () {
    "use strict";

    const CLAVE_USUARIO = "usuarioActivo";
    const PAGINA_LOGIN = "index.html";

    function obtenerUsuario() {
        return sessionStorage.getItem(CLAVE_USUARIO) || "";
    }

    function guardarUsuario(nombre) {
        const nombreLimpio = String(nombre || "").trim();

        if (!nombreLimpio) {
            return false;
        }

        sessionStorage.setItem(CLAVE_USUARIO, nombreLimpio);

        // Elimina el dato anterior para evitar
        // confusiones con el sistema antiguo.
        localStorage.removeItem(CLAVE_USUARIO);

        return true;
    }

    function cerrarSesion() {
        sessionStorage.removeItem(CLAVE_USUARIO);
        localStorage.removeItem(CLAVE_USUARIO);
        window.location.replace(PAGINA_LOGIN);
    }

    function verificarSesion() {
        const usuario = obtenerUsuario();

        if (!usuario.trim()) {
            window.location.replace(PAGINA_LOGIN);
            return false;
        }

        return true;
    }

    // Funciones disponibles para otras páginas.
    window.GuiaSesion = {
        obtenerUsuario,
        guardarUsuario,
        cerrarSesion,
        verificarSesion
    };
})();
