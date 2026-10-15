// Mi caja: anotar lo que vendí y lo que gasté, y ver cómo va el día.
import { MAX_SUGERENCIAS, MAX_CIFRAS_MONTO, TEXTOS } from '../config.js';
import { agregar, guardar, obtener, borrar, listar, listarPorFecha, recientes, nuevoId } from '../db.js';
import { pesos, hoyISO, sumarDias, nombreDia, diaLargo, hora, fechaLocalDe } from '../format.js';
import { h, rellenar, icono, volver, aviso, confirmar, avisarCambio, encabezado, teclado } from '../ui.js';

const TIPOS = {
  venta: { store: 'ventas', verbo: 'Vendí', signo: '+', icono: 'mas', ruta: '/caja/vendi', porDefecto: 'Venta' },
  gasto: { store: 'gastos', verbo: 'Gasté', signo: '−', icono: 'menos', ruta: '/caja/gaste', porDefecto: 'Gasto' },
};

// Día que se está mirando. null = hoy, así si la app queda abierta de un día para otro sigue siendo "hoy".
let diaVisto = null;

function diaActual() {
  const hoy = hoyISO();
  return diaVisto && diaVisto < hoy ? diaVisto : hoy;
}

const suma = (lista) => lista.reduce((total, r) => total + r.monto, 0);

// ---- Pantalla principal de la caja ----

export async function render(vista) {
  const cuerpo = h('div');
  vista.append(encabezado('Mi caja', { alVolver: () => volver('/') }), cuerpo);
  await pintarCaja(cuerpo);
}

async function pintarCaja(cuerpo, enfocar) {
  const hoy = hoyISO();
  const dia = diaActual();
  const esHoy = dia === hoy;
  const [ventas, gastos] = await Promise.all([listarPorFecha('ventas', dia), listarPorFecha('gastos', dia)]);
  const entro = suma(ventas);
  const salio = suma(gastos);
  const quedo = entro - salio;
  const movimientos = [...ventas.map((r) => ({ ...r, tipo: 'venta' })), ...gastos.map((r) => ({ ...r, tipo: 'gasto' }))].sort(
    (a, b) => (b.creadoEn || '').localeCompare(a.creadoEn || ''),
  );

  const irADia = (nuevo, foco) => {
    diaVisto = nuevo >= hoyISO() ? null : nuevo;
    pintarCaja(cuerpo, foco);
  };

  rellenar(
    cuerpo,
    h(
      'div',
      { class: 'selector-dia' },
      h(
        'button',
        { type: 'button', class: 'selector-dia-boton', 'data-foco': 'anterior', 'aria-label': 'Ver el día anterior', onclick: () => irADia(sumarDias(dia, -1), 'anterior') },
        icono('izquierda'),
      ),
      h(
        'p',
        { class: 'selector-dia-texto', 'aria-live': 'polite' },
        h('span', { class: 'selector-dia-nombre' }, nombreDia(dia)),
        h('span', { class: 'selector-dia-fecha' }, esHoy || dia === sumarDias(hoy, -1) ? diaLargo(dia) : ''),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'selector-dia-boton',
          'data-foco': 'siguiente',
          'aria-label': 'Ver el día siguiente',
          disabled: esHoy,
          onclick: () => irADia(sumarDias(dia, 1), 'siguiente'),
        },
        icono('derecha'),
      ),
    ),
    !esHoy &&
      h(
        'div',
        { class: 'nota otro-dia' },
        h('p', {}, 'Estás mirando otro día. Lo que anotes queda en ese día.'),
        h('button', { type: 'button', class: 'boton boton-secundario', onclick: () => irADia(hoy, 'anterior') }, 'Volver a hoy'),
      ),
    h(
      'div',
      { class: 'botones-caja' },
      h('a', { href: '#' + TIPOS.venta.ruta, class: 'boton-grande boton-vendi' }, icono('mas'), 'Vendí'),
      h('a', { href: '#' + TIPOS.gasto.ruta, class: 'boton-grande boton-gaste' }, icono('menos'), 'Gasté'),
    ),
    h(
      'section',
      { class: 'resumen', 'aria-label': esHoy ? 'Resumen de hoy' : 'Resumen del día' },
      h('div', { class: 'resumen-item resumen-entro' }, h('span', { class: 'resumen-etiqueta' }, 'Entró'), h('span', { class: 'resumen-monto numero' }, pesos(entro))),
      h('div', { class: 'resumen-item resumen-salio' }, h('span', { class: 'resumen-etiqueta' }, 'Salió'), h('span', { class: 'resumen-monto numero' }, pesos(salio))),
      h(
        'div',
        { class: 'resumen-item resumen-quedo' + (quedo < 0 ? ' negativo' : '') },
        h('span', { class: 'resumen-etiqueta' }, 'Me quedó'),
        h('span', { class: 'resumen-monto numero' }, pesos(quedo)),
        quedo < 0 && h('span', { class: 'resumen-nota' }, 'Gastaste más de lo que vendiste.'),
      ),
    ),
    h('h2', { class: 'seccion-titulo' }, esHoy ? 'Lo que anotaste hoy' : dia === sumarDias(hoy, -1) ? 'Lo que anotaste ayer' : 'Lo que anotaste ese día'),
    movimientos.length
      ? [h('ul', { class: 'movimientos' }, movimientos.map(lineaMovimiento)), h('p', { class: 'pista' }, 'Toca una línea para cambiarla o borrarla.')]
      : h('p', { class: 'vacio' }, esHoy ? 'Todavía no anotas nada hoy. Toca Vendí o Gasté.' : 'Ese día no anotaste nada.'),
    h('p', { class: 'pie-legal' }, icono('info'), TEXTOS.legalCaja),
  );

  if (enfocar) {
    const objetivo = cuerpo.querySelector(`[data-foco="${enfocar}"]`);
    (objetivo && !objetivo.disabled ? objetivo : cuerpo.querySelector('[data-foco="anterior"]')).focus();
  }
}

function lineaMovimiento(mov) {
  const t = TIPOS[mov.tipo];
  const concepto = mov.concepto || t.porDefecto;
  const anotadoEseDia = mov.creadoEn && fechaLocalDe(mov.creadoEn) === mov.fecha;
  return h(
    'li',
    {},
    h(
      'a',
      {
        href: `#/caja/editar/${mov.tipo}/${mov.id}`,
        class: 'mov mov-' + mov.tipo,
        'aria-label': `${t.verbo} ${pesos(mov.monto)}, ${concepto}. Tocar para cambiar o borrar.`,
      },
      h('span', { class: 'mov-signo' }, icono(t.icono)),
      h(
        'span',
        {},
        h('span', { class: 'mov-concepto' }, concepto),
        h('span', { class: 'mov-detalle' }, t.verbo + (anotadoEseDia ? ' · ' + hora(mov.creadoEn) : '')),
      ),
      h('span', { class: 'mov-monto numero' }, t.signo + pesos(mov.monto)),
    ),
  );
}

// ---- Anotar o cambiar un movimiento (Vendí / Gasté) ----

// Lo último que se escribió en "¿Qué fue?", sin repetir.
async function conceptosRecientes(store) {
  const vistos = new Set();
  const lista = [];
  for (const r of await recientes(store, 200)) {
    const texto = (r.concepto || '').trim();
    const clave = texto.toLowerCase();
    if (!texto || vistos.has(clave)) continue;
    vistos.add(clave);
    lista.push(texto);
    if (lista.length >= MAX_SUGERENCIAS) break;
  }
  return lista;
}

export async function renderFormulario(vista, { tipo, id }) {
  const t = TIPOS[tipo];
  const registro = id ? await obtener(t.store, id) : null;
  if (id && !registro) {
    vista.append(
      encabezado('Mi caja', { alVolver: () => volver('/caja') }),
      h('p', { class: 'vacio' }, 'No encontramos esa línea. Puede que ya esté borrada.'),
      h('div', { class: 'pila-botones' }, h('a', { href: '#/caja', class: 'boton boton-secundario boton-bloque' }, 'Ir a Mi caja')),
    );
    return;
  }

  const fecha = registro?.fecha ?? diaActual();
  let cifras = registro ? String(registro.monto) : '';
  let productoId = registro?.productoId ?? null;

  const [recientesTexto, productos] = await Promise.all([
    conceptosRecientes(t.store),
    tipo === 'venta' ? listar('productos') : Promise.resolve([]),
  ]);
  // Primero los productos guardados desde "¿Cuánto cobro?" (traen su precio), después lo último escrito.
  const activos = productos.filter((p) => p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const nombresProductos = new Set(activos.map((p) => p.nombre.toLowerCase()));
  const sugerencias = [
    ...activos.map((p) => ({ texto: p.nombre, producto: p })),
    ...recientesTexto.filter((x) => !nombresProductos.has(x.toLowerCase())).map((texto) => ({ texto })),
  ].slice(0, MAX_SUGERENCIAS);

  // -- Monto --
  const salida = h('output', { id: 'monto', 'aria-live': 'polite' });
  const botonLimpiar = h(
    'button',
    { type: 'button', class: 'limpiar-monto', 'aria-label': 'Borrar todo el monto', onclick: () => ((cifras = ''), pintarMonto()) },
    icono('cerrar'),
  );
  // El error se muestra dentro del recuadro del monto para que el teclado no se mueva.
  const error = h('p', { class: 'error-monto', role: 'alert' });
  const pantalla = h('div', { class: 'pantalla-monto' }, h('span', { class: 'solo-lector' }, 'Monto: '), salida, error, botonLimpiar);

  function mostrarError(texto) {
    pantalla.classList.add('con-error'); // primero visible, para que el lector de pantalla lo anuncie
    error.replaceChildren(icono('alerta'), texto);
  }

  function pintarMonto() {
    salida.value = pesos(cifras ? parseInt(cifras, 10) : 0);
    pantalla.classList.toggle('vacia', !cifras);
    pantalla.classList.toggle('largo', cifras.length >= 7);
    botonLimpiar.hidden = !cifras;
    if (cifras) {
      error.replaceChildren();
      pantalla.classList.remove('con-error');
    }
  }

  function alTecla(tecla) {
    if (tecla === 'borrar') {
      cifras = cifras.slice(0, -1);
    } else {
      const nuevas = (cifras + tecla).replace(/^0+/, '');
      if (nuevas.length > MAX_CIFRAS_MONTO) return;
      cifras = nuevas;
    }
    pintarMonto();
  }

  // -- ¿Qué fue? --
  const entradaConcepto = h('input', {
    class: 'entrada',
    id: 'concepto',
    type: 'text',
    maxlength: '60',
    autocomplete: 'off',
    autocapitalize: 'sentences',
    enterkeyhint: 'done',
    placeholder: tipo === 'venta' ? 'Ej: pan amasado' : 'Ej: harina',
    value: registro?.concepto ?? '',
  });

  const chips = sugerencias.map((s) =>
    h(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': 'false',
        onclick: () => {
          entradaConcepto.value = s.texto;
          productoId = s.producto?.id ?? null;
          // Si viene de "Mi catálogo" y aún no hay monto, ponemos su precio.
          if (s.producto && !cifras && s.producto.precio > 0) {
            cifras = String(s.producto.precio);
            pintarMonto();
          }
          pintarChips();
        },
      },
      s.texto,
      s.producto ? h('span', { class: 'chip-precio' }, ' · ' + pesos(s.producto.precio)) : '',
    ),
  );

  function pintarChips() {
    const actual = entradaConcepto.value.trim().toLowerCase();
    chips.forEach((chip, i) => chip.setAttribute('aria-pressed', String(sugerencias[i].texto.toLowerCase() === actual)));
  }

  entradaConcepto.addEventListener('input', () => {
    const actual = entradaConcepto.value.trim().toLowerCase();
    productoId = activos.find((p) => p.nombre.toLowerCase() === actual)?.id ?? null;
    pintarChips();
  });
  entradaConcepto.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      entradaConcepto.blur(); // cierra el teclado del celular y deja ver "Guardar"
    }
  });

  // -- Guardar y borrar --
  let guardando = false;
  const botonGuardar = h(
    'button',
    { type: 'button', class: 'boton boton-principal boton-bloque boton-guardar', onclick: () => guardarMovimiento() },
    icono('check'),
    registro ? 'Guardar cambio' : 'Guardar',
  );

  async function guardarMovimiento() {
    if (guardando) return;
    const monto = cifras ? parseInt(cifras, 10) : 0;
    if (monto <= 0) {
      mostrarError('Pon un monto mayor a $0 con los números de abajo.');
      return;
    }
    guardando = true;
    botonGuardar.disabled = true;
    const concepto = entradaConcepto.value.trim();
    try {
      if (registro) {
        const cambiado = { ...registro, monto, concepto };
        if (tipo === 'venta') cambiado.productoId = productoId;
        await guardar(t.store, cambiado);
        aviso(`Cambio guardado ✔ ${pesos(monto)}`, {
          deshacer: async () => {
            await guardar(t.store, registro);
            avisarCambio();
            aviso('Listo, quedó como antes.');
          },
        });
      } else {
        const nuevo = { id: nuevoId(), fecha, monto, concepto };
        if (tipo === 'venta') nuevo.productoId = productoId;
        nuevo.creadoEn = new Date().toISOString();
        await agregar(t.store, nuevo);
        aviso(`Anotado ✔ ${t.verbo} ${pesos(monto)}`, {
          deshacer: async () => {
            await borrar(t.store, nuevo.id);
            avisarCambio();
            aviso('Listo, lo quité.');
          },
        });
      }
      volver('/caja');
    } catch (e) {
      console.error(e);
      mostrarError('No se pudo guardar. Intenta de nuevo.');
      guardando = false;
      botonGuardar.disabled = false;
    }
  }

  async function borrarMovimiento() {
    const ok = await confirmar({
      titulo: '¿Borrar esta línea?',
      texto: `${t.verbo} ${pesos(registro.monto)}${registro.concepto ? ' · ' + registro.concepto : ''}`,
      si: 'Sí, borrar',
      no: 'No, dejarla',
      peligro: true,
    });
    if (!ok) return;
    await borrar(t.store, registro.id);
    aviso('Borrado', {
      deshacer: async () => {
        await guardar(t.store, registro);
        avisarCambio();
        aviso('Listo, lo recuperé.');
      },
    });
    volver('/caja');
  }

  // Con teclado físico (computador) también se puede escribir el monto.
  const alTeclaFisica = (e) => {
    if (e.target === entradaConcepto || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      alTecla(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      alTecla('borrar');
    } else if (e.key === 'Enter' && !e.target.closest('button, a')) {
      e.preventDefault();
      guardarMovimiento();
    }
  };
  document.addEventListener('keydown', alTeclaFisica);

  const titulo = registro ? (tipo === 'venta' ? 'Cambiar venta' : 'Cambiar gasto') : t.verbo;
  vista.append(
    encabezado(titulo, { alVolver: () => volver('/caja'), clase: 'barra-' + tipo }),
    h(
      'div',
      { class: 'formulario-monto formulario-' + tipo },
      fecha !== hoyISO() && h('p', { class: 'dia-anotacion' }, icono('reloj'), `Se anota en: ${nombreDia(fecha)}`),
      pantalla,
      h(
        'div',
        { class: 'campo' },
        h('label', { class: 'campo-etiqueta', for: 'concepto' }, '¿Qué fue? ', h('span', { class: 'campo-opcional' }, '(si quieres)')),
        entradaConcepto,
      ),
      chips.length > 0 && h('div', { class: 'sugerencias', role: 'group', 'aria-label': 'Sugerencias' }, chips),
      teclado(alTecla),
      h('div', { class: 'acciones-fijas' }, botonGuardar),
      registro &&
        h(
          'button',
          { type: 'button', class: 'boton boton-peligro-suave boton-bloque', onclick: borrarMovimiento },
          icono('basura'),
          'Borrar esta línea',
        ),
    ),
  );
  pintarMonto();
  pintarChips();

  return () => document.removeEventListener('keydown', alTeclaFisica);
}
