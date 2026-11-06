
/* ============================================
   GUÍA DEL DIGITADOR
   ADMINISTRADOR GLOBAL DE APARIENCIA
   ============================================ */

(function () {
  'use strict';

  const TEMA_KEY = 'guia-tema-visual';
  const ACENTO_KEY = 'guia-acento-visual';

  // =========================================
  // COLORES DISPONIBLES
  // =========================================

  const acentos = {
    rojo: '#dc2626',
    azul: '#2563eb',
    violeta: '#7c3aed',
    verde: '#16a34a',
    turquesa: '#0f766e',
    naranja: '#b45309',
    rosa: '#be185d',
    cian: '#0e7490'
  };

  let tema = leer(TEMA_KEY, 'oscuro');
  let acento = leer(ACENTO_KEY, 'rojo');

  if (
    !['oscuro', 'claro'].includes(tema)
  ) {
    tema = 'oscuro';
  }

  if (
    !Object.prototype.hasOwnProperty.call(
      acentos,
      acento
    )
  ) {
    acento = 'rojo';
  }

  // =========================================
  // ALMACENAMIENTO
  // =========================================

  function leer(clave, alternativa) {
    try {
      return localStorage.getItem(clave) || alternativa;
    } catch {
      return alternativa;
    }
  }

  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, valor);
    } catch {
      // El navegador puede bloquear
      // el almacenamiento privado.
    }
  }

  // =========================================
  // CONVERTIR HEX A RGBA
  // =========================================

  function hexRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // =========================================
  // APLICAR APARIENCIA
  // =========================================

  function aplicarTema() {
    const root = document.documentElement;

    const claro = tema === 'claro';

    const bg = claro
      ? '#f1f5fb'
      : '#0a101b';

    const card = claro
      ? '#ffffff'
      : '#141d2b';

    const texto = claro
      ? '#172236'
      : '#f3f6fc';

    const borde = claro
      ? '#d5deeb'
      : '#314056';

    const accent = acentos[acento];

    // Tema activo.

    root.dataset.guiaTema = tema;

    root.style.colorScheme =
      claro ? 'light' : 'dark';

    root.style.setProperty(
      '--g-acento',
      accent
    );

    root.style.setProperty(
      '--g-acento-suave',
      hexRGBA(accent, claro ? .10 : .15)
    );

    // Variables antiguas y nuevas.
    // Se conservan para no romper módulos.

    const alias = {
      '--color-fondo': bg,
      '--color-tarjeta': card,
      '--color-principal': accent,
      '--color-boton': accent,
      '--color-acento': accent,

      '--bg-color': bg,
      '--accent-color': accent,

      '--fondo': bg,
      '--panel': card,

      '--panel2': claro
        ? '#f4f7fc'
        : '#1c2839',

      '--texto': texto,

      '--suave': claro
        ? '#586780'
        : '#a7b4c7',

      '--borde': borde,
      '--rojo': accent
    };

    Object.entries(alias).forEach(
      ([variable, valor]) => {
        root.style.setProperty(
          variable,
          valor
        );
      }
    );

    if (document.body) {
      document.body.style.backgroundColor =
        'var(--g-fondo)';

      document.body.classList.toggle(
        'guia-login',
        !!document.getElementById('formLogin')
      );
    }

    // Compatibilidad con los selectores
    // de colores anteriores del sistema.

    guardar('colorFondo', bg);
    guardar('colorTarjeta', card);
    guardar('colorPrincipal', accent);
    guardar('colorBoton', accent);
    guardar('colorAcento', accent);

    const viejoFondo =
      document.getElementById('pickerFondo');

    const viejoAcento =
      document.getElementById('pickerPrincipal');

    if (viejoFondo) {
      viejoFondo.value = bg;
    }

    if (viejoAcento) {
      viejoAcento.value = accent;
    }

    // Mostrar opciones seleccionadas.

    document.querySelectorAll(
      '[data-elegir-tema]'
    ).forEach(btn => {
      btn.setAttribute(
        'aria-pressed',
        String(
          btn.dataset.elegirTema === tema
        )
      );
    });

    document.querySelectorAll(
      '[data-elegir-acento]'
    ).forEach(btn => {
      btn.setAttribute(
        'aria-pressed',
        String(
          btn.dataset.elegirAcento === acento
        )
      );
    });
  }

  // =========================================
  // CREAR PANEL DE APARIENCIA
  // =========================================

  function iniciar() {
    if (
      document.getElementById(
        'guia-apariencia'
      )
    ) {
      return;
    }

    const shell =
      document.createElement('div');

    shell.id = 'guia-apariencia';

    shell.innerHTML = `
      <section
        id="guia-tema-panel"
        class="guia-tema-panel"
        aria-label="Configuración de apariencia"
        hidden>

        <div class="guia-tema-cabecera">
          <strong>
            Personalizar apariencia
          </strong>
        </div>

        <p class="guia-tema-sub">
          Elegí cómo querés ver
          la Guía del Digitador.
        </p>

        <span class="guia-tema-label">
          Modo de pantalla
        </span>

        <div
          class="guia-tema-opciones"
          role="group"
          aria-label="Modo de pantalla">

          <button
            class="guia-tema-control"
            type="button"
            data-elegir-tema="oscuro">
            🌙 Oscuro
          </button>

          <button
            class="guia-tema-control"
            type="button"
            data-elegir-tema="claro">
            ☀️ Claro
          </button>

        </div>

        <span class="guia-tema-label">
          Color principal
        </span>

        <div
          class="guia-tema-colores"
          role="group"
          aria-label="Color de acento">
        </div>

        <button
          type="button"
          class="guia-tema-restaurar guia-tema-control"
          id="guia-tema-restaurar">
          Restaurar configuración
        </button>

      </section>

      <button
        type="button"
        class="guia-tema-lanzador guia-tema-control"
        aria-expanded="false"
        aria-controls="guia-tema-panel">
        🎨 Apariencia
      </button>
    `;

    document.body.append(shell);

    document.body.classList.add(
      'guia-tema-habilitado'
    );

    const panel = shell.querySelector(
      '#guia-tema-panel'
    );

    const lanzador = shell.querySelector(
      '.guia-tema-lanzador'
    );

    const colores = shell.querySelector(
      '.guia-tema-colores'
    );

    // =====================================
    // CREAR BOTONES DE COLORES
    // =====================================

    for (
      const [nombre, hex] of
      Object.entries(acentos)
    ) {
      const btn =
        document.createElement('button');

      btn.type = 'button';

      btn.className =
        'guia-tema-color guia-tema-control';

      btn.dataset.elegirAcento = nombre;

      btn.style.setProperty(
        '--swatch',
        hex
      );

      btn.setAttribute(
        'aria-label',
        'Acento ' + nombre
      );

      btn.title =
        nombre.charAt(0).toUpperCase() +
        nombre.slice(1);

      colores.append(btn);
    }

    // =====================================
    // ABRIR Y CERRAR CONFIGURACIÓN
    // =====================================

    function abierto(valor) {
      panel.hidden = !valor;

      lanzador.setAttribute(
        'aria-expanded',
        String(valor)
      );
    }

    lanzador.addEventListener(
      'click',
      () => abierto(panel.hidden)
    );

    // =====================================
    // SELECCIONAR OSCURO O CLARO
    // =====================================

    shell.querySelectorAll(
      '[data-elegir-tema]'
    ).forEach(btn => {
      btn.addEventListener('click', () => {
        tema = btn.dataset.elegirTema;

        guardar(TEMA_KEY, tema);

        aplicarTema();
      });
    });

    // =====================================
    // SELECCIONAR COLOR
    // =====================================

    colores.addEventListener(
      'click',
      e => {
        const btn = e.target.closest(
          '[data-elegir-acento]'
        );

        if (!btn) return;

        acento = btn.dataset.elegirAcento;

        guardar(ACENTO_KEY, acento);

        aplicarTema();
      }
    );

    // =====================================
    // RESTAURAR VALORES
    // =====================================

    shell.querySelector(
      '#guia-tema-restaurar'
    ).addEventListener('click', () => {
      tema = 'oscuro';
      acento = 'rojo';

      guardar(TEMA_KEY, tema);
      guardar(ACENTO_KEY, acento);

      aplicarTema();
    });

    // =====================================
    // CERRAR AL HACER CLIC FUERA
    // =====================================

    document.addEventListener(
      'pointerdown',
      e => {
        if (!shell.contains(e.target)) {
          abierto(false);
        }
      }
    );

    // =====================================
    // CERRAR CON ESCAPE
    // =====================================

    document.addEventListener(
      'keydown',
      e => {
        if (e.key === 'Escape') {
          abierto(false);
        }
      }
    );

    // =====================================
    // APLICAR CONFIGURACIÓN GUARDADA
    // =====================================

    aplicarTema();
  }

  // =========================================
  // INICIAR
  // =========================================

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      iniciar
    );
  } else {
    iniciar();
  }

})();
