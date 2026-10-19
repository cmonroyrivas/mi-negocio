// Ajustes: datos del negocio, facilitadora, respaldo, cómo instalar y borrar todo.
import { APP_VERSION, TEXTOS, DIAS_RECORDATORIO_RESPALDO, URL_APP } from '../config.js';
import { leerConfig, guardarConfig, borrar, vaciarTodo, asegurarMeta, contar } from '../db.js';
import { fechaCompleta, normalizarWhatsapp, whatsappParaMostrar } from '../format.js';
import { h, anexar, rellenar, icono, ir, volver, aviso, confirmar, encabezado, estaInstalada, puedeInstalar, instalar } from '../ui.js';
import { compartirRespaldo, descargarRespaldo, diasSinRespaldo, elegirYRecuperar } from '../backup.js';
import { compartirTexto } from '../whatsapp.js';
import { qrSVG } from '../qr.js';

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
    await seccionFacilitadora(),
    await seccionRespaldo(),
    seccionInstalar,
    seccionCompartirApp(),
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
      esSubsistencia: datos.get('esSubsistencia') === 'si',
    });
    entradaWhatsapp.value = whatsappParaMostrar(whatsapp);
    aviso(datos.get('esSubsistencia') === 'si' && !perfil.esSubsistencia ? 'Guardado ✔ Mira tu tope en el inicio.' : 'Guardado ✔');
    perfil.esSubsistencia = datos.get('esSubsistencia') === 'si';
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
      h(
        'label',
        { class: 'casilla', for: 'ajustes-subsistencia' },
        h('input', { type: 'checkbox', id: 'ajustes-subsistencia', name: 'esSubsistencia', value: 'si', checked: !!perfil.esSubsistencia }),
        h(
          'span',
          {},
          h('span', { class: 'campo-etiqueta' }, 'Estoy en Registro de Subsistencia'),
          h('span', { class: 'campo-ayuda' }, 'Te mostramos cuánto llevas vendido frente al tope de 5 UTM.'),
        ),
      ),
      error,
      h('div', { class: 'pila-botones' }, h('button', { type: 'submit', class: 'boton boton-principal boton-bloque' }, icono('check'), 'Guardar cambios')),
    ),
  );
}

// ---- Mi facilitadora (para mandarle el resumen desde Mi semana) ----
async function seccionFacilitadora() {
  const actual = await leerConfig('facilitadora');
  const error = h('p', { class: 'error', role: 'alert' });
  const entradaNombre = h('input', {
    class: 'entrada',
    id: 'facilitadora-nombre',
    type: 'text',
    maxlength: '40',
    autocomplete: 'off',
    autocapitalize: 'words',
    placeholder: 'Ej: Carla',
    value: actual?.nombre ?? '',
  });
  const entradaWhatsapp = h('input', {
    class: 'entrada',
    id: 'facilitadora-wsp',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'off',
    maxlength: '16',
    placeholder: '9 1234 5678',
    value: whatsappParaMostrar(actual?.whatsapp),
  });

  const guardarFacilitadora = async (e) => {
    e.preventDefault();
    const nombre = entradaNombre.value.trim();
    const whatsapp = normalizarWhatsapp(entradaWhatsapp.value);
    if (!nombre) return mostrarErrorCampo(error, 'Escribe el nombre de tu facilitadora.', entradaNombre);
    if (!whatsapp) return mostrarErrorCampo(error, 'Revisa el WhatsApp: son 9 números y empieza con 9.', entradaWhatsapp);
    error.replaceChildren();
    await guardarConfig({ clave: 'facilitadora', nombre, whatsapp });
    aviso('Guardado ✔');
    ir('/ajustes', { reemplazar: true });
  };

  const quitarFacilitadora = async () => {
    const ok = await confirmar({
      titulo: `¿Quitar a ${actual.nombre} como tu facilitadora?`,
      texto: 'Ya no aparecerá el botón para mandarle tu resumen.',
      si: 'Sí, quitar',
      no: 'No, dejarla',
      peligro: true,
    });
    if (!ok) return;
    await borrar('config', 'facilitadora');
    aviso('Listo, la quité.', {
      deshacer: async () => {
        await guardarConfig(actual);
        ir('/ajustes', { reemplazar: true });
      },
    });
    ir('/ajustes', { reemplazar: true });
  };

  return h(
    'section',
    { class: 'seccion', 'aria-labelledby': 'titulo-facilitadora' },
    h('h2', { id: 'titulo-facilitadora' }, 'Mi facilitadora'),
    h(
      'form',
      { class: 'tarjeta-seccion', novalidate: true, onsubmit: guardarFacilitadora },
      h(
        'p',
        { class: 'campo-ayuda' },
        actual
          ? `Desde Mi semana puedes mandarle tu resumen a ${actual.nombre} por WhatsApp.`
          : 'Si tu facilitadora te mandó un enlace, ábrelo y quedará anotada aquí. Así puedes mandarle tu resumen desde Mi semana.',
      ),
      h('div', { class: 'campo' }, h('label', { class: 'campo-etiqueta', for: 'facilitadora-nombre' }, 'Nombre'), entradaNombre),
      h(
        'div',
        { class: 'campo' },
        h('label', { class: 'campo-etiqueta', for: 'facilitadora-wsp' }, 'WhatsApp'),
        h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '+56'), entradaWhatsapp),
      ),
      error,
      h(
        'div',
        { class: 'pila-botones' },
        h('button', { type: 'submit', class: 'boton boton-principal boton-bloque' }, icono('check'), 'Guardar'),
        actual && h('button', { type: 'button', class: 'boton-texto', onclick: quitarFacilitadora }, icono('cerrar'), 'Quitar facilitadora'),
      ),
    ),
  );
}

function mostrarErrorCampo(error, texto, campo) {
  error.replaceChildren(icono('alerta'), texto);
  campo.setAttribute('aria-invalid', 'true');
  campo.focus();
  campo.addEventListener('input', () => campo.removeAttribute('aria-invalid'), { once: true });
}

// Pantalla que abre el enlace de la facilitadora: #/facilitadora?nombre=Carla&wsp=569XXXXXXXX
export async function renderFacilitadora(vista, datos) {
  const nombre = (datos.get('nombre') || '').trim().slice(0, 40);
  const whatsapp = normalizarWhatsapp(datos.get('wsp') || '');
  const alInicio = () => ir('/', { reemplazar: true });
  vista.append(encabezado('Tu facilitadora', { alVolver: alInicio }));

  if (!nombre || !whatsapp) {
    anexar(
      vista,
      h('p', { class: 'vacio' }, 'Este enlace no está completo. Pídele a tu facilitadora que te lo mande de nuevo.'),
      h('div', { class: 'pila-botones' }, h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: alInicio }, 'Ir al inicio')),
    );
    return;
  }

  const actual = await leerConfig('facilitadora');
  const numeroVisible = `+56 ${whatsappParaMostrar(whatsapp)}`;
  if (actual?.nombre === nombre && actual?.whatsapp === whatsapp) {
    anexar(
      vista,
      h('h2', { class: 'pregunta' }, `${nombre} ya es tu facilitadora ✔`),
      h('p', { class: 'pregunta-ayuda' }, 'Desde Mi semana puedes mandarle tu resumen cuando quieras.'),
      h('div', { class: 'pila-botones' }, h('button', { type: 'button', class: 'boton boton-principal boton-bloque', onclick: alInicio }, 'Ir al inicio')),
    );
    return;
  }

  const guardarla = async () => {
    await guardarConfig({ clave: 'facilitadora', nombre, whatsapp });
    aviso(`Listo ✔ ${nombre} quedó como tu facilitadora`);
    alInicio();
  };

  anexar(
    vista,
    h('h2', { class: 'pregunta' }, `¿Guardar a ${nombre} como tu facilitadora?`),
    h(
      'p',
      { class: 'facilitadora-numero' },
      icono('contacto'),
      h('span', {}, h('strong', {}, nombre), h('span', { class: 'sin-cortar' }, `WhatsApp ${numeroVisible}`)),
    ),
    h(
      'p',
      { class: 'pregunta-ayuda' },
      `Así, desde Mi semana podrás mandarle tu resumen por WhatsApp cuando quieras. ${nombre} no ve nada de tu app si tú no se lo mandas.`,
    ),
    actual && h('p', { class: 'nota' }, icono('info'), `Hoy tienes anotada a ${actual.nombre}. Se cambiará por ${nombre}.`),
    h(
      'div',
      { class: 'pila-botones' },
      h('button', { type: 'button', class: 'boton boton-principal boton-bloque boton-guardar', onclick: guardarla }, icono('check'), 'Sí, guardar'),
      h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: alInicio }, 'No, gracias'),
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

// ---- Compartir la app (QR para que otra persona la instale) ----
function seccionCompartirApp() {
  const compartir = async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    await compartirTexto(`Mi Negocio: app gratis para anotar ventas y gastos y calcular precios. Funciona sin internet.\n${URL_APP}`);
    boton.disabled = false;
  };
  return h(
    'section',
    { class: 'seccion', 'aria-labelledby': 'titulo-compartir-app' },
    h('h2', { id: 'titulo-compartir-app' }, 'Compartir la app'),
    h(
      'div',
      { class: 'tarjeta-seccion' },
      h('p', {}, 'Muestra este código a otra persona. Lo escanea con la cámara de su celular y abre Mi Negocio para instalarla.'),
      h('div', { class: 'qr-caja' }, qrSVG(URL_APP, { titulo: 'Código QR para abrir Mi Negocio' })),
      h('p', { class: 'enlace-app' }, URL_APP),
      h('div', { class: 'pila-botones' }, h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: compartir }, icono('compartir'), 'Compartir el enlace')),
    ),
  );
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
