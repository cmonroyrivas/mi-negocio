// Inicio: saldo de hoy y accesos grandes. La primera vez, la bienvenida.
import { leerConfig, guardarConfig, listarPorFecha } from '../db.js';
import { pesos, hoyISO, normalizarWhatsapp } from '../format.js';
import { h, anexar, rellenar, icono, ir, aviso, puedeInstalar, instalar } from '../ui.js';
import { debeRecordarRespaldo, compartirRespaldo, elegirYRecuperar } from '../backup.js';

const suma = (lista) => lista.reduce((total, r) => total + r.monto, 0);

export async function render(vista) {
  const perfil = await leerConfig('perfil');
  if (!perfil) return renderBienvenida(vista);

  const hoy = hoyISO();
  const [ventas, gastos, recordarRespaldo] = await Promise.all([
    listarPorFecha('ventas', hoy),
    listarPorFecha('gastos', hoy),
    debeRecordarRespaldo(),
  ]);
  const entro = suma(ventas);
  const salio = suma(gastos);
  const quedo = entro - salio;
  const nada = ventas.length + gastos.length === 0;

  const zonaInstalar = h('div');
  const pintarInstalar = () => {
    rellenar(
      zonaInstalar,
      puedeInstalar()
        ? h(
            'div',
            { class: 'nota nota-suave' },
            icono('instalar'),
            h(
              'div',
              { class: 'nota-cuerpo' },
              h('p', {}, 'Instala la app en tu celular para abrirla más rápido, incluso sin internet.'),
              h('button', { type: 'button', class: 'boton boton-secundario', onclick: instalar }, 'Instalar'),
            ),
          )
        : '',
    );
  };
  pintarInstalar();
  window.addEventListener('instalable', pintarInstalar);

  anexar(
    vista,
    h(
      'header',
      { class: 'inicio-cabecera' },
      h('h1', { class: 'inicio-negocio', tabindex: '-1' }, perfil.nombreNegocio || 'Mi negocio'),
      h('a', { href: '#/ajustes', class: 'enlace-ajustes' }, icono('ajustes'), 'Ajustes'),
    ),
    h(
      'section',
      { class: 'saldo', 'aria-label': 'Cómo vas hoy' },
      h('p', { class: 'saldo-etiqueta' }, 'Hoy te quedó'),
      h('p', { class: 'saldo-monto numero' + (quedo < 0 ? ' negativo' : '') }, pesos(quedo)),
      h(
        'p',
        { class: 'saldo-detalle' },
        nada ? 'Todavía no anotas nada hoy.' : `Vendiste ${pesos(entro)} · Gastaste ${pesos(salio)}`,
      ),
    ),
    recordarRespaldo &&
      h(
        'div',
        { class: 'nota', role: 'note' },
        icono('reloj'),
        h(
          'div',
          { class: 'nota-cuerpo' },
          h('p', {}, 'Hace más de 2 semanas que no guardas tu respaldo. Así no pierdes tus cuentas si algo le pasa al celular.'),
          h(
            'button',
            {
              type: 'button',
              class: 'boton boton-secundario',
              onclick: async (e) => {
                const boton = e.currentTarget;
                boton.disabled = true;
                const resultado = await compartirRespaldo();
                if (resultado === 'cancelado') {
                  boton.disabled = false;
                  return;
                }
                aviso(resultado === 'descargado' ? 'Respaldo guardado en Descargas ✔' : 'Respaldo guardado ✔');
                ir('/', { reemplazar: true });
              },
            },
            icono('compartir'),
            'Guardar mi respaldo',
          ),
        ),
      ),
    zonaInstalar,
    h(
      'nav',
      { class: 'tarjetas', 'aria-label': 'Secciones' },
      tarjeta('#/caja', 'tarjeta-caja', 'caja', 'Mi caja', 'Anota lo que vendes y lo que gastas'),
      tarjeta('#/precio', 'tarjeta-precio', 'precio', '¿Cuánto cobro?', 'Calcula el precio de lo que vendes'),
    ),
  );

  return () => window.removeEventListener('instalable', pintarInstalar);
}

function tarjeta(href, clase, nombreIcono, titulo, texto) {
  return h(
    'a',
    { href, class: 'tarjeta ' + clase },
    h('span', { class: 'tarjeta-icono' }, icono(nombreIcono)),
    h('span', {}, h('span', { class: 'tarjeta-titulo' }, titulo), h('span', { class: 'tarjeta-texto' }, texto)),
  );
}

// ---- Primera vez ----

function renderBienvenida(vista) {
  const entradaNombre = h('input', {
    class: 'entrada',
    id: 'bienvenida-nombre',
    type: 'text',
    autocomplete: 'organization',
    autocapitalize: 'sentences',
    maxlength: '60',
    placeholder: 'Ej: Amasandería Doña Rosa',
    enterkeyhint: 'next',
  });
  const entradaWhatsapp = h('input', {
    class: 'entrada',
    id: 'bienvenida-whatsapp',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel-national',
    maxlength: '16',
    placeholder: '9 1234 5678',
    enterkeyhint: 'done',
    'aria-describedby': 'bienvenida-error',
  });
  const error = h('p', { class: 'error', id: 'bienvenida-error', role: 'alert' });

  const empezar = async (e) => {
    e.preventDefault();
    const whatsapp = normalizarWhatsapp(entradaWhatsapp.value);
    if (whatsapp === null) {
      error.textContent = 'Revisa el número: son 9 números y empieza con 9. Si prefieres, déjalo en blanco.';
      entradaWhatsapp.setAttribute('aria-invalid', 'true');
      entradaWhatsapp.focus();
      return;
    }
    await guardarConfig({
      clave: 'perfil',
      nombreNegocio: entradaNombre.value.trim(),
      nombrePersona: '',
      whatsapp,
      rubro: '',
      esSubsistencia: false,
    });
    ir('/', { reemplazar: true });
  };

  entradaNombre.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      entradaWhatsapp.focus();
    }
  });
  entradaWhatsapp.addEventListener('input', () => {
    entradaWhatsapp.removeAttribute('aria-invalid');
    error.textContent = '';
  });

  vista.append(
    h(
      'div',
      { class: 'bienvenida' },
      dibujoTienda(),
      h('h1', { tabindex: '-1' }, '¡Hola!'),
      h(
        'p',
        { class: 'bienvenida-intro' },
        'Mi Negocio te ayuda a anotar lo que vendes y gastas, y a calcular tus precios. Funciona sin internet.',
      ),
      h(
        'form',
        { onsubmit: empezar, novalidate: true },
        h(
          'div',
          { class: 'campo' },
          h('label', { class: 'campo-etiqueta', for: 'bienvenida-nombre' }, '¿Cómo se llama tu negocio?'),
          entradaNombre,
          h('p', { class: 'campo-ayuda' }, 'Si no tiene nombre, puedes poner el tuyo.'),
        ),
        h(
          'div',
          { class: 'campo' },
          h(
            'label',
            { class: 'campo-etiqueta', for: 'bienvenida-whatsapp' },
            '¿Cuál es tu WhatsApp? ',
            h('span', { class: 'campo-opcional' }, '(si quieres)'),
          ),
          h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '+56'), entradaWhatsapp),
          error,
        ),
        h(
          'div',
          { class: 'pila-botones' },
          h('button', { type: 'submit', class: 'boton boton-principal boton-bloque boton-guardar' }, 'Empezar', icono('derecha')),
        ),
        h('p', { class: 'pista' }, 'Tus datos quedan solo en este celular. No te pedimos correo ni contraseña.'),
      ),
      h(
        'div',
        { class: 'recuperar-bienvenida' },
        h('p', {}, '¿Cambiaste de celular?'),
        h(
          'button',
          {
            type: 'button',
            class: 'boton-texto',
            onclick: async () => {
              if (await elegirYRecuperar()) ir('/', { reemplazar: true });
            },
          },
          icono('subir'),
          'Recupera tu respaldo',
        ),
      ),
    ),
  );
}

// Dibujo simple de un local con toldo (el mismo de icons/icono.svg).
function dibujoTienda() {
  const contenedor = h('div', { class: 'bienvenida-dibujo', 'aria-hidden': 'true' });
  contenedor.innerHTML = `<svg viewBox="0 0 112 112">
    <rect x="2" y="2" width="108" height="108" rx="24" fill="#1d6a40"/>
    <rect x="24" y="56" width="64" height="34" fill="#fbf6ec"/>
    <rect x="30" y="62" width="12" height="10" rx="2" fill="#f3c24c"/>
    <rect x="70" y="62" width="12" height="10" rx="2" fill="#f3c24c"/>
    <rect x="49" y="65" width="14" height="25" rx="3" fill="#1d6a40"/>
    <rect x="49" y="80" width="14" height="10" fill="#1d6a40"/>
    <rect x="18" y="26" width="76" height="6" rx="3" fill="#231c14"/>
    <path d="M20 32h14.4v14H20zM48.8 32h14.4v14H48.8zM77.6 32H92v14H77.6z" fill="#fbf6ec"/>
    <path d="M34.4 32h14.4v14H34.4zM63.2 32h14.4v14H63.2z" fill="#f3c24c"/>
    <path d="M20 46a7.2 7.2 0 0 0 14.4 0zM48.8 46a7.2 7.2 0 0 0 14.4 0zM77.6 46A7.2 7.2 0 0 0 92 46z" fill="#fbf6ec"/>
    <path d="M34.4 46a7.2 7.2 0 0 0 14.4 0zM63.2 46a7.2 7.2 0 0 0 14.4 0z" fill="#f3c24c"/>
  </svg>`;
  return contenedor;
}
