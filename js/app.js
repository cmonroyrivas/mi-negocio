// Arranque de la app y router por hash (#/caja, #/precio, ...).
import { abrir, asegurarMeta } from './db.js';
import { h, ir, cerrarDialogos, iniciarInstalacion } from './ui.js';
import * as inicio from './screens/inicio.js';
import * as caja from './screens/caja.js';
import * as precio from './screens/precio.js';
import * as catalogo from './screens/catalogo.js';
import * as semana from './screens/semana.js';
import * as subsistencia from './screens/subsistencia.js';
import * as ajustes from './screens/ajustes.js';

// Cada ruta: patrón y función que dibuja la pantalla. Las pantallas que muestran
// totales se vuelven a dibujar cuando cambian los datos (por ejemplo, al deshacer).
// La pantalla recibe (vista, partes de la ruta, datos después del "?").
const RUTAS = [
  { patron: /^\/$/, pantalla: inicio.render, refrescar: true },
  { patron: /^\/caja$/, pantalla: caja.render, refrescar: true },
  { patron: /^\/caja\/vendi$/, pantalla: (v) => caja.renderFormulario(v, { tipo: 'venta' }) },
  { patron: /^\/caja\/gaste$/, pantalla: (v) => caja.renderFormulario(v, { tipo: 'gasto' }) },
  { patron: /^\/caja\/editar\/(venta|gasto)\/([\w-]+)$/, pantalla: (v, [tipo, id]) => caja.renderFormulario(v, { tipo, id }) },
  { patron: /^\/precio(?:\/(\d))?$/, pantalla: (v, [paso]) => precio.render(v, { paso: Number(paso) || 1 }) },
  { patron: /^\/catalogo$/, pantalla: catalogo.render, refrescar: true },
  { patron: /^\/catalogo\/nuevo$/, pantalla: (v) => catalogo.renderProducto(v, {}) },
  { patron: /^\/catalogo\/editar\/([\w-]+)$/, pantalla: (v, [id]) => catalogo.renderProducto(v, { id }) },
  { patron: /^\/catalogo\/pedido$/, pantalla: catalogo.renderPedido },
  { patron: /^\/catalogo\/qr$/, pantalla: catalogo.renderQR },
  { patron: /^\/semana$/, pantalla: semana.render, refrescar: true },
  { patron: /^\/subsistencia$/, pantalla: subsistencia.render, refrescar: true },
  { patron: /^\/ajustes$/, pantalla: ajustes.render },
  { patron: /^\/facilitadora$/, pantalla: (v, _, datos) => ajustes.renderFacilitadora(v, datos) },
];

const raiz = document.getElementById('app');
let numeroRender = 0;
let limpiarPantalla = null;
let rutaActual = null;

// "#/facilitadora?nombre=Carla&wsp=569..." -> { camino: '/facilitadora', datos: URLSearchParams }
function rutaDelHash() {
  const [camino, consulta = ''] = location.hash.slice(1).split('?');
  return { camino: decodeURIComponent(camino) || '/', datos: new URLSearchParams(consulta) };
}

async function dibujar({ refresco = false } = {}) {
  const { camino, datos } = rutaDelHash();
  const hallada = RUTAS.map((r) => ({ r, m: camino.match(r.patron) })).find((x) => x.m);
  if (!hallada) {
    ir('/', { reemplazar: true });
    return;
  }
  const esteRender = ++numeroRender;
  if (!refresco) cerrarDialogos();

  // La pantalla se arma aparte y se muestra recién cuando está lista (sin parpadeos).
  const vista = h('div', { class: 'vista' });
  let limpiar = null;
  try {
    limpiar = await hallada.r.pantalla(vista, hallada.m.slice(1), datos);
  } catch (error) {
    console.error(error);
    vista.replaceChildren(pantallaError());
  }
  if (esteRender !== numeroRender) {
    if (typeof limpiar === 'function') limpiar();
    return; // mientras tanto la persona ya se fue a otra pantalla
  }
  if (typeof limpiarPantalla === 'function') limpiarPantalla();
  limpiarPantalla = limpiar;
  rutaActual = hallada.r;

  const scroll = window.scrollY;
  raiz.replaceChildren(vista);
  if (refresco) {
    window.scrollTo(0, scroll);
  } else {
    window.scrollTo(0, 0);
    vista.querySelector('h1')?.focus({ preventScroll: true });
  }
}

function pantallaError(texto = 'Algo falló al abrir esta pantalla.') {
  return h(
    'div',
    { class: 'pantalla-error' },
    h('h1', { tabindex: '-1' }, 'Ups'),
    h('p', {}, texto),
    h('button', { type: 'button', class: 'boton boton-principal boton-bloque', onclick: () => location.reload() }, 'Intentar de nuevo'),
  );
}

// ---- Service worker y aviso de versión nueva ----
function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return; // por ejemplo, al probar por http en la red local
  let pidioActualizar = false;
  const boton = document.getElementById('actualizacion');

  const ofrecer = (trabajador) => {
    boton.hidden = false;
    boton.onclick = () => {
      pidioActualizar = true;
      boton.disabled = true;
      boton.textContent = 'Actualizando…';
      trabajador.postMessage({ tipo: 'actualizar' });
    };
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (pidioActualizar) location.reload();
  });

  navigator.serviceWorker
    .register('./sw.js')
    .then((registro) => {
      if (registro.waiting && navigator.serviceWorker.controller) ofrecer(registro.waiting);
      registro.addEventListener('updatefound', () => {
        const nuevo = registro.installing;
        nuevo?.addEventListener('statechange', () => {
          if (nuevo.state === 'installed' && navigator.serviceWorker.controller) ofrecer(nuevo);
        });
      });
      // Al volver a la app, revisamos si hay versión nueva.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registro.update().catch(() => {});
      });
    })
    .catch((e) => console.warn('No se pudo activar el modo sin internet', e));
}

// Pedimos al navegador que no borre los datos si el celular se queda sin espacio.
async function pedirAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // no es grave: los datos igual se guardan
  }
}

async function arrancar() {
  iniciarInstalacion();
  try {
    await abrir();
    await asegurarMeta();
  } catch (error) {
    console.error(error);
    raiz.replaceChildren(
      pantallaError('Este navegador no deja guardar datos. Abre la app en Chrome (no en modo incógnito) y vuelve a intentar.'),
    );
    return;
  }

  // Marcamos la entrada inicial para que "Volver" sepa que no hay pantalla anterior.
  history.replaceState({ prof: history.state?.prof ?? 0 }, '', location.hash || '#/');

  window.addEventListener('popstate', () => dibujar());
  window.addEventListener('ruta', () => dibujar());
  window.addEventListener('datos-cambiaron', () => {
    if (rutaActual?.refrescar) dibujar({ refresco: true });
  });
  // Si la app quedó abierta de un día para otro, que "Hoy" sea hoy.
  let diaAlSalir = new Date().toDateString();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') diaAlSalir = new Date().toDateString();
    else if (diaAlSalir !== new Date().toDateString() && rutaActual?.refrescar) dibujar({ refresco: true });
  });

  // Los enlaces internos (#/...) pasan por el router para que "Volver" funcione bien.
  document.addEventListener('click', (e) => {
    const enlace = e.target.closest('a[href^="#/"]');
    if (!enlace || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    ir(enlace.getAttribute('href').slice(1));
  });

  await dibujar();
  registrarServiceWorker();
  pedirAlmacenamientoPersistente();
}

arrancar();
