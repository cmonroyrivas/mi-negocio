// Helpers de interfaz: crear elementos, íconos, avisos, diálogos, teclado y navegación.
import { DESHACER_MS } from './config.js';

// ---- Crear elementos ----
// h('button', { class: 'boton', onclick: fn }, 'Texto', otroElemento)
// El texto siempre entra como texto (nunca como HTML), así lo que escriba la persona no rompe nada.
export function h(etiqueta, atributos = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos || {})) {
    if (valor == null || valor === false) continue;
    if (clave === 'class') el.className = valor;
    else if (clave.startsWith('on') && typeof valor === 'function') el.addEventListener(clave.slice(2), valor);
    else if (clave === 'value') el.value = valor;
    else if (valor === true) el.setAttribute(clave, '');
    else el.setAttribute(clave, valor);
  }
  return anexar(el, ...hijos);
}

// Como el.append, pero ignora null/false y aplana listas (para armar pantallas con condiciones).
export function anexar(el, ...hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false || hijo === '') continue;
    el.append(hijo instanceof Node ? hijo : String(hijo));
  }
  return el;
}

// Reemplaza todo el contenido de el.
export function rellenar(el, ...hijos) {
  el.replaceChildren();
  return anexar(el, ...hijos);
}

// ---- Íconos SVG propios (siempre van con texto al lado) ----
const TRAZOS = {
  atras: '<path d="M19 12H5M11 5l-7 7 7 7"/>',
  izquierda: '<path d="M15 5l-7 7 7 7"/>',
  derecha: '<path d="M9 5l7 7-7 7"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  retroceso: '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
  basura: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  caja: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
  precio:
    '<path d="M12.6 3H4a1 1 0 0 0-1 1v8.6a1 1 0 0 0 .3.7l8.4 8.4a1 1 0 0 0 1.4 0l8.6-8.6a1 1 0 0 0 0-1.4l-8.4-8.4a1 1 0 0 0-.7-.3z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  compartir:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  subir: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  instalar: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  alerta: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17v.5"/>',
  puntos:
    '<circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/>',
  compartirIphone: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 10H5v11h14V10h-2"/>',
  agregarCuadro: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};

export function icono(nombre, clase = '') {
  const span = document.createElement('span');
  span.className = 'icono ' + clase;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || ''}</svg>`;
  return span;
}

// ---- Navegación (router por hash) ----
// Guardamos en history.state la "profundidad" para saber si "Volver" puede usar
// el botón atrás del celular o si debemos ir a una pantalla fija.
export function ir(ruta, { reemplazar = false } = {}) {
  const prof = history.state?.prof ?? 0;
  if (reemplazar) history.replaceState({ prof }, '', '#' + ruta);
  else history.pushState({ prof: prof + 1 }, '', '#' + ruta);
  window.dispatchEvent(new Event('ruta'));
}

export function volver(rutaPorDefecto = '/') {
  if ((history.state?.prof ?? 0) > 0) history.back();
  else ir(rutaPorDefecto, { reemplazar: true });
}

// Avisa a la pantalla actual que cambiaron los datos (por ejemplo, al deshacer).
export function avisarCambio() {
  window.dispatchEvent(new Event('datos-cambiaron'));
}

// Barra de arriba con "Volver" y el título de la pantalla.
export function encabezado(titulo, { alVolver, textoVolver = 'Volver', clase = '' } = {}) {
  return h(
    'header',
    { class: 'barra ' + clase },
    alVolver && h('button', { type: 'button', class: 'barra-volver', onclick: alVolver }, icono('atras'), textoVolver),
    h('h1', { class: 'barra-titulo', tabindex: '-1' }, titulo),
  );
}

// ---- Avisos cortos abajo ("toast"), con Deshacer opcional ----
let temporizador = null;

export function aviso(mensaje, { deshacer, duracion } = {}) {
  const zona = document.getElementById('avisos');
  if (!zona) return;
  clearTimeout(temporizador);
  zona.replaceChildren();
  const ms = duracion ?? (deshacer ? DESHACER_MS : 3000);
  const cerrar = () => {
    clearTimeout(temporizador);
    el.remove();
  };
  const el = h(
    'div',
    { class: 'aviso' + (deshacer ? ' aviso-con-accion' : ''), style: `--duracion:${ms}ms` },
    h('span', { class: 'aviso-texto' }, mensaje),
    deshacer &&
      h(
        'button',
        {
          type: 'button',
          class: 'aviso-accion',
          onclick: async () => {
            cerrar();
            await deshacer();
          },
        },
        'Deshacer',
      ),
  );
  zona.append(el);
  temporizador = setTimeout(cerrar, ms);
  // Si la persona está por tocar "Deshacer" con el teclado, no lo hacemos desaparecer.
  el.addEventListener('focusin', () => clearTimeout(temporizador));
  el.addEventListener('focusout', () => (temporizador = setTimeout(cerrar, 2000)));
}

// ---- Diálogo de confirmación. Devuelve true si la persona dijo que sí. ----
// Con no: null queda un solo botón (para avisar algo importante).
export function confirmar({ titulo, texto, si = 'Sí', no = 'No, volver', peligro = false }) {
  if (typeof HTMLDialogElement !== 'function') {
    const mensaje = titulo + (texto ? '\n\n' + texto : '');
    if (no === null) {
      window.alert(mensaje);
      return Promise.resolve(true);
    }
    return Promise.resolve(window.confirm(mensaje));
  }
  return new Promise((resolve) => {
    const botonNo = no !== null && h('button', { class: 'boton boton-secundario boton-bloque', value: 'no' }, no);
    const dialogo = h(
      'dialog',
      { class: 'dialogo', 'aria-labelledby': 'dialogo-titulo' },
      h(
        'form',
        { method: 'dialog' },
        h('h2', { id: 'dialogo-titulo', class: 'dialogo-titulo' }, titulo),
        texto && h('p', { class: 'dialogo-texto' }, texto),
        h(
          'div',
          { class: 'dialogo-botones' },
          h('button', { class: 'boton boton-bloque ' + (peligro ? 'boton-peligro' : 'boton-principal'), value: 'si' }, si),
          botonNo,
        ),
      ),
    );
    dialogo.addEventListener('close', () => {
      resolve(dialogo.returnValue === 'si');
      dialogo.remove();
    });
    document.body.append(dialogo);
    dialogo.showModal();
    // En lo peligroso, el foco parte en "No" para no borrar por accidente.
    if (peligro && botonNo) botonNo.focus();
  });
}

export function cerrarDialogos() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

// ---- Teclado numérico grande para montos ----
// alTecla recibe '0'..'9', '000' o 'borrar'.
export function teclado(alTecla) {
  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'borrar'];
  return h(
    'div',
    { class: 'teclado', role: 'group', 'aria-label': 'Teclado para el monto' },
    teclas.map((t) =>
      h(
        'button',
        {
          type: 'button',
          class: 'tecla' + (t === 'borrar' ? ' tecla-borrar' : ''),
          'aria-label': t === 'borrar' ? 'Borrar el último número' : t === '000' ? 'Tres ceros' : null,
          onclick: () => alTecla(t),
        },
        t === 'borrar' ? icono('retroceso') : t,
      ),
    ),
  );
}

// ---- Instalar la app ----
let eventoInstalar = null;

export function iniciarInstalacion() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalar = e;
    window.dispatchEvent(new Event('instalable'));
  });
  window.addEventListener('appinstalled', () => {
    eventoInstalar = null;
    window.dispatchEvent(new Event('instalable'));
  });
}

export function estaInstalada() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function puedeInstalar() {
  return !!eventoInstalar && !estaInstalada();
}

export async function instalar() {
  if (!eventoInstalar) return false;
  const evento = eventoInstalar;
  eventoInstalar = null;
  evento.prompt();
  const { outcome } = await evento.userChoice;
  window.dispatchEvent(new Event('instalable'));
  return outcome === 'accepted';
}
