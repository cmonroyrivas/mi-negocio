// Ajustes: datos del negocio, respaldo, cómo instalar y borrar todo.
import { APP_VERSION, TEXTOS, DIAS_RECORDATORIO_RESPALDO } from '../config.js';
import { leerConfig, guardarConfig, vaciarTodo, asegurarMeta, contar } from '../db.js';
import { fechaCompleta, normalizarWhatsapp, whatsappParaMostrar } from '../format.js';
import { h, rellenar, icono, ir, volver, aviso, confirmar, encabezado, estaInstalada, puedeInstalar, instalar } from '../ui.js';
import { compartirRespaldo, descargarRespaldo, diasSinRespaldo, elegirYRecuperar } from '../backup.js';

const RUBROS = [
  'Amasandería',
  'Aseo a domicilio',
  'Peluquería',
  'Costura',
  'Pintura automotriz',
  'Venta de verduras',
  'Artículos del hogar',
  'Comida',
];

export async function render(vista) {
  const perfil = (await leerConfig('perfil')) || { clave: 'perfil', esSubsistencia: false };
  const seccionInstalar = h('section', { class: 'seccion', 'aria-labelledby': 'titulo-instalar' });
  const pintarInstalar = () => rellenar(seccionInstalar, contenidoInstalar());
  pintarInstalar();
  window.addEventListener('instalable', pintarInstalar);

  vista.append(
    encabezado('Ajustes', { alVolver: () => volver('/') }),
    await seccionPerfil(perfil),
    await seccionRespaldo(),
    seccionInstalar,
    seccionBorrar(),
    h('p', { class: 'version' }, `Mi Negocio · versión ${APP_VERSION}`),
  );

  return () => window.removeEventListener('instalable', pintarInstalar);
}

function campoTexto({ id, etiqueta, opcional, ...atributos }) {
  return h(
    'div',
    { class: 'campo' },
    h('label', { class: 'campo-etiqueta', for: id }, etiqueta, opcional ? h('span', { class: 'campo-opcional' }, ' (si quieres)') : ''),
    h('input', { class: 'entrada', id, type: 'text', ...atributos }),
  );
}

// ---- Mi negocio ----
async function seccionPerfil(perfil) {
  const error = h('p', { class: 'error', role: 'alert' });
  const entradaWhatsapp = h('input', {
    class: 'entrada',
    id: 'ajustes-whatsapp',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'tel-national',
    maxlength: '16',
    placeholder: '9 1234 5678',
    value: whatsappParaMostrar(perfil.whatsapp),
  });

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const formulario = e.currentTarget;
    const whatsapp = normalizarWhatsapp(entradaWhatsapp.value);
    if (whatsapp === null) {
      error.replaceChildren(icono('alerta'), 'Revisa el WhatsApp: son 9 números y empieza con 9. Si prefieres, déjalo en blanco.');
      entradaWhatsapp.setAttribute('aria-invalid', 'true');
      entradaWhatsapp.focus();
      return;
    }
    entradaWhatsapp.removeAttribute('aria-invalid');
    error.replaceChildren();
    const datos = new FormData(formulario);
    await guardarConfig({
      ...perfil,
      clave: 'perfil',
      nombreNegocio: String(datos.get('nombreNegocio')).trim(),
      nombrePersona: String(datos.get('nombrePersona')).trim(),
      rubro: String(datos.get('rubro')).trim(),
      whatsapp,
    });
    entradaWhatsapp.value = whatsappParaMostrar(whatsapp);
    aviso('Guardado ✔');
  };

  return h(
    'section',
    { class: 'seccion', 'aria-labelledby': 'titulo-perfil' },
    h('h2', { id: 'titulo-perfil' }, 'Mi negocio'),
    h(
      'form',
      { class: 'tarjeta-seccion', novalidate: true, onsubmit: guardarPerfil },
      campoTexto({
        id: 'ajustes-negocio',
        name: 'nombreNegocio',
        etiqueta: 'Nombre del negocio',
        value: perfil.nombreNegocio || '',
        maxlength: '60',
        autocomplete: 'organization',
        autocapitalize: 'sentences',
      }),
      campoTexto({
        id: 'ajustes-persona',
        name: 'nombrePersona',
        etiqueta: 'Tu nombre',
        opcional: true,
        value: perfil.nombrePersona || '',
        maxlength: '60',
        autocomplete: 'given-name',
        autocapitalize: 'words',
      }),
      h(
        'div',
        { class: 'campo' },
        h('label', { class: 'campo-etiqueta', for: 'ajustes-whatsapp' }, 'Tu WhatsApp', h('span', { class: 'campo-opcional' }, ' (si quieres)')),
        h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '+56'), entradaWhatsapp),
      ),
      campoTexto({
        id: 'ajustes-rubro',
        name: 'rubro',
        etiqueta: '¿A qué te dedicas?',
        opcional: true,
        value: perfil.rubro || '',
        maxlength: '60',
        list: 'lista-rubros',
        autocomplete: 'off',
        autocapitalize: 'sentences',
        placeholder: 'Ej: amasandería',
      }),
      h('datalist', { id: 'lista-rubros' }, RUBROS.map((r) => h('option', { value: r }))),
      error,
      h('div', { class: 'pila-botones' }, h('button', { type: 'submit', class: 'boton boton-principal boton-bloque' }, icono('check'), 'Guardar cambios')),
    ),
  );
}

// ---- Mi respaldo ----
async function seccionRespaldo() {
  const meta = await leerConfig('meta');
  const [ventas, gastos] = await Promise.all([contar('ventas'), contar('gastos')]);
  const hayDatos = ventas + gastos > 0;
  const dias = await diasSinRespaldo();
  const atrasado = hayDatos && dias > DIAS_RECORDATORIO_RESPALDO;
  const sePuedeCompartir = typeof navigator.canShare === 'function';

  let estado;
  if (meta?.ultimoRespaldo) {
    const hace = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
    estado = `Tu último respaldo: ${fechaCompleta(meta.ultimoRespaldo)} (${hace}).`;
  } else {
    estado = 'Todavía no guardas ningún respaldo.';
  }

  const guardarRespaldo = async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    const resultado = await compartirRespaldo();
    boton.disabled = false;
    if (resultado === 'cancelado') return;
    aviso(resultado === 'descargado' ? 'Respaldo guardado en Descargas ✔' : 'Respaldo guardado ✔');
    ir('/ajustes', { reemplazar: true });
  };

  return h(
    'section',
    { class: 'seccion', 'aria-labelledby': 'titulo-respaldo' },
    h('h2', { id: 'titulo-respaldo' }, 'Mi respaldo'),
    h(
      'div',
      { class: 'tarjeta-seccion' },
      h('p', { class: 'texto-privacidad' }, TEXTOS.privacidad),
      h(
        'p',
        { class: 'estado-respaldo' + (atrasado ? ' atrasado' : '') },
        estado,
        atrasado ? ' Te recomendamos guardar uno ahora.' : '',
      ),
      h(
        'div',
        { class: 'pila-botones' },
        h('button', { type: 'button', class: 'boton boton-principal boton-bloque', onclick: guardarRespaldo }, icono('compartir'), 'Guardar mi respaldo'),
        sePuedeCompartir &&
          h('p', { class: 'campo-ayuda' }, 'Se abre el menú para compartir. Puedes mandártelo a tu propio WhatsApp o guardarlo en Drive.'),
        sePuedeCompartir &&
          h(
            'button',
            {
              type: 'button',
              class: 'boton boton-secundario boton-bloque',
              onclick: async () => {
                await descargarRespaldo();
                aviso('Respaldo guardado en Descargas ✔');
                ir('/ajustes', { reemplazar: true });
              },
            },
            icono('descargar'),
            'Descargar en este celular',
          ),
        h(
          'button',
          {
            type: 'button',
            class: 'boton boton-secundario boton-bloque',
            onclick: async () => {
              if (await elegirYRecuperar()) ir('/ajustes', { reemplazar: true });
            },
          },
          icono('subir'),
          'Recuperar mi respaldo',
        ),
      ),
    ),
  );
}

// ---- Instalar la app ----
function contenidoInstalar() {
  const enLinea = (nombre) => icono(nombre, 'icono-en-linea');
  return [
    h('h2', { id: 'titulo-instalar' }, 'Instalar la app'),
    estaInstalada()
      ? h('p', { class: 'nota nota-suave' }, icono('check'), 'Ya tienes la app instalada en este celular.')
      : [
          puedeInstalar() &&
            h(
              'div',
              { class: 'pila-botones', style: 'margin: 0 0 16px' },
              h('button', { type: 'button', class: 'boton boton-mostaza boton-bloque', onclick: instalar }, icono('instalar'), 'Instalar en mi celular'),
            ),
          h(
            'details',
            { class: 'instrucciones' },
            h('summary', {}, 'En Android (Chrome)'),
            h(
              'ol',
              { class: 'pasos-instalar' },
              h('li', {}, 'Abre esta página en Chrome.'),
              h('li', {}, 'Toca el botón ', enLinea('puntos'), ' arriba a la derecha.'),
              h('li', {}, 'Toca “Instalar app” o “Agregar a la pantalla principal”.'),
              h('li', {}, 'Confirma. Te aparece el ícono de Mi Negocio junto a tus otras apps.'),
            ),
          ),
          h(
            'details',
            { class: 'instrucciones' },
            h('summary', {}, 'En iPhone (Safari)'),
            h(
              'ol',
              { class: 'pasos-instalar' },
              h('li', {}, 'Abre esta página en Safari.'),
              h('li', {}, 'Toca el botón Compartir ', enLinea('compartirIphone'), ' abajo, al centro.'),
              h('li', {}, 'Baja y toca “Agregar a inicio” ', enLinea('agregarCuadro'), '.'),
              h('li', {}, 'Toca “Agregar”, arriba a la derecha.'),
            ),
          ),
        ],
  ];
}

// ---- Borrar todo ----
function seccionBorrar() {
  const borrarTodo = async () => {
    const primero = await confirmar({
      titulo: '¿Borrar todo?',
      texto: 'Se borran todas tus ventas, gastos, productos y los datos de tu negocio de este celular. Si quieres, guarda tu respaldo antes.',
      si: 'Sí, seguir',
      no: 'No, volver',
      peligro: true,
    });
    if (!primero) return;
    const segundo = await confirmar({
      titulo: '¿De verdad quieres borrar todo?',
      texto: 'Esto no se puede deshacer. Si no tienes respaldo, se pierde para siempre.',
      si: 'Sí, borrar todo',
      no: 'No, mejor no',
      peligro: true,
    });
    if (!segundo) return;
    await vaciarTodo();
    await asegurarMeta();
    aviso('Se borró todo.');
    ir('/', { reemplazar: true });
  };

  return h(
    'section',
    { class: 'seccion', 'aria-labelledby': 'titulo-borrar' },
    h('h2', { id: 'titulo-borrar' }, 'Borrar todo'),
    h(
      'div',
      { class: 'tarjeta-seccion zona-peligro' },
      h('p', {}, 'Borra todo lo que anotaste en este celular y deja la app como nueva.'),
      h(
        'div',
        { class: 'pila-botones' },
        h('button', { type: 'button', class: 'boton boton-peligro-suave boton-bloque', onclick: borrarTodo }, icono('basura'), 'Borrar todo'),
      ),
    ),
  );
}
