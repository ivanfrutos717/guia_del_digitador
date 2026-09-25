/* Selección de elementos del DOM requeridos para la funcionalidad de cálculo */
const inputFecha = document.getElementById('fechaEmision'); /* Referencia al campo de fecha */
const inputDias = document.getElementById('diasPlazo'); /* Referencia al campo de plazo */
const btnCalcular = document.getElementById('btnCalcular'); /* Referencia al botón de cálculo */
const textoResultado = document.getElementById('fechaResultado'); /* Referencia al texto final */

/* Listener para capturar el evento de clic en el botón */
btnCalcular.addEventListener('click', function() {
    
    /* Obtiene el valor textual de la fecha ("YYYY-MM-DD") */
    const fechaTexto = inputFecha.value;
    
    /* Transforma el texto de días ingresado en un número entero */
    const dias = parseInt(inputDias.value);

    /* Comprobación de seguridad para verificar que los datos requeridos no estén vacíos */
    if (!fechaTexto || isNaN(dias)) {
        alert("Por favor, selecciona una fecha y coloca los días de plazo.");
        return; /* Detiene la ejecución si falta algún dato */
    }

    /* Separa la cadena de texto de la fecha en tres partes utilizando el separador "-" */
    const partes = fechaTexto.split('-');
    
    /* Convierte la primera parte en el año numérico */
    const anio = parseInt(partes[0]);
    
    /* Convierte la segunda parte en el mes (se resta 1 porque los meses en JS van de 0 a 11) */
    const mes = parseInt(partes[1]) - 1;
    
    /* Convierte la tercera parte en el día numérico */
    const dia = parseInt(partes[2]);

    /* Inicializa un nuevo objeto Date usando componentes locales de fecha */
    const fecha = new Date(anio, mes, dia);
    
    /* Aplica la adición de días al objeto de fecha */
    fecha.setDate(fecha.getDate() + dias);

    /* Convierte el día resultante a texto asegurando un formato de dos dígitos (ej. "05") */
    const diaResultado = String(fecha.getDate()).padStart(2, '0');
    
    /* Arreglo con las abreviaturas de los 12 meses en mayúsculas */
    const mesesAbreviados = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    
    /* Obtiene la abreviatura del mes correspondiente usando el índice del objeto Date (0 a 11) */
    const mesResultado = mesesAbreviados[fecha.getMonth()];
    
    /* Extrae el año completo en cuatro dígitos */
    const anioResultado = fecha.getFullYear();

    /* Muestra el resultado en formato DD/MMM/YYYY (ejemplo: 22/JUN/2026) */
    textoResultado.textContent = `${diaResultado}/${mesResultado}/${anioResultado}`;
});