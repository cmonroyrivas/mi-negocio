// ¿Cuánto cobro? Asistente de una pregunta por pantalla.
import { GANANCIAS, TEXTOS } from '../config.js';
import { agregar, guardar, borrar, listar, nuevoId } from '../db.js';
import { pesos, numero, leerMonto, redondearA10 } from '../format.js';
import { h, anexar, icono, ir, volver, aviso, confirmar, encabezado } from '../ui.js';

// ---- El cálculo (sin pantalla, para poder probarlo solo) ----
// costo de cada una = gastos / unidades; precio = costo + ganancia, redondeado hacia arriba a $10.
// Si la persona pone su propio precio (precioManual), se usa tal cual y se calcula cuánto gana
// (o cuánto pierde: la ganancia puede ser negativa).
export function calcularPrecio({ materiales, unidades, porcentaje, precioManual }) {
  const total = materiales.reduce((suma, m) => suma + (m.monto || 0), 0);
  if (!(total > 0)) return { error: 'Anota al menos una cosa con lo que gastas.' };
  if (!(unidades > 0)) return { error: 'Pon cuántas te salen. Tiene que ser 1 o más.' };
  const costoExacto = total / unidades;
  const manual = precioManual > 0;
  const precioExacto = manual ? precioManual : costoExacto * (1 + porcentaje / 100);
  const precio = manual ? Math.round(precioManual) : redondearA10(precioExacto);
  const costoUnitario = Math.round(costoExacto);
  return {
    total,
    costoUnitario,
    precioExacto,
    precio,
    manual,
    ganancia: precio - costoUnitario,
    gananciaTotal: precio * unidades - total,
    // Lo mínimo a cobrar para no perder (redondeado hacia arriba a $10)
    precioMinimo: redondearA10(costoExacto),
  };
}

// ---- Estado del asistente (vive mientras la app está abierta) ----
function nuevoCalculo() {
  return {
    nombre: '',
    materiales: [{ nombre: '', monto: 0 }],
    unidades: 1,
    porcentaje: null, // Poco / Normal / Harto
    precioManual: null, // o el precio que puso la persona
    guardado: false,
    profInicio: 0,
  };
}
let calculo = nuevoCalculo();

const totalMateriales = () => calculo.materiales.reduce((s, m) => s + (m.monto || 0), 0);

function primerPasoIncompleto() {
  if (!calculo.nombre) return 1;
  if (totalMateriales() <= 0) return 2;
  if (!(calculo.unidades > 0)) return 3;
  if (calculo.porcentaje == null && !(calculo.precioManual > 0)) return 4;
  return 5;
}

const rutaPaso = (paso) => (paso === 1 ? '/precio' : '/precio/' + paso);
const siguiente = (paso) => ir(rutaPaso(paso + 1));

// Vuelve al paso anterior con el botón atrás del celular cuando se puede.
function atras(paso) {
  if (paso === 1) volver('/');
  else if ((history.state?.prof ?? 0) > calculo.profInicio) history.back();
  else ir(rutaPaso(paso - 1), { reemplazar: true });
}

export async function render(vista, { paso }) {
  // Si se recargó la página a mitad de camino, volvemos al primer paso que falte.
  const falta = primerPasoIncompleto();
  if (paso > falta) {
    ir(rutaPaso(falta), { reemplazar: true });
    return;
  }
  if (paso === 1) calculo.profInicio = history.state?.prof ?? 0;

  vista.append(encabezado('¿Cuánto cobro?', { alVolver: () => atras(paso), textoVolver: paso === 1 ? 'Volver' : 'Atrás' }));
  if (paso < 5) {
    vista.append(
      h(
        'div',
        { class: 'progreso' },
        h('div', { class: 'progreso-puntos', 'aria-hidden': 'true' }, [1, 2, 3, 4].map((n) => h('span', { class: 'progreso-punto' + (n <= paso ? ' hecho' : '') }))),
        `Paso ${paso} de 4`,
      ),
    );
  }
  const pasos = { 1: paso1, 2: paso2, 3: paso3, 4: paso4, 5: paso5 };
  pasos[paso](vista);
}

function mensajeError() {
  return h('p', { class: 'error', role: 'alert' });
}

function mostrarError(error, texto, campo) {
  error.replaceChildren(icono('alerta'), texto);
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
    campo.addEventListener('input', () => campo.removeAttribute('aria-invalid'), { once: true });
  }
}

function botonSiguiente(texto = 'Siguiente') {
  return h('div', { class: 'pila-botones' }, h('button', { type: 'submit', class: 'boton boton-principal boton-bloque boton-guardar' }, texto, icono('derecha')));
}

// 1. ¿Qué vas a vender?
function paso1(vista) {
  const entrada = h('input', {
    class: 'entrada',
    id: 'precio-nombre',
    type: 'text',
    maxlength: '60',
    autocapitalize: 'sentences',
    autocomplete: 'off',
    enterkeyhint: 'next',
    placeholder: 'Ej: pan amasado, corte de pelo',
    value: calculo.nombre,
  });
  const error = mensajeError();
  vista.append(
    h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const nombre = entrada.value.trim();
          if (!nombre) return mostrarError(error, 'Escribe qué vas a vender. Por ejemplo: pan amasado.', entrada);
          if (nombre !== calculo.nombre) calculo.guardado = false;
          calculo.nombre = nombre;
          siguiente(1);
        },
      },
      h('h2', { class: 'pregunta' }, h('label', { for: 'precio-nombre' }, '¿Qué vas a vender?')),
      h('p', { class: 'pregunta-ayuda' }, 'Puede ser un producto o un servicio.'),
      h('div', { class: 'paso-cuerpo' }, entrada, error),
      botonSiguiente(),
    ),
  );
}

// 2. ¿Qué cosas gastas para hacerlo?
function paso2(vista) {
  const lista = h('div');
  const total = h('span', { class: 'numero' });
  const error = mensajeError();

  const pintarTotal = () => (total.textContent = pesos(totalMateriales()));

  function pintarLista(enfocar) {
    const varios = calculo.materiales.length > 1;
    lista.replaceChildren(
      ...calculo.materiales.map((m, i) => {
        const entradaNombre = h('input', {
          class: 'entrada',
          id: `material-nombre-${i}`,
          type: 'text',
          maxlength: '40',
          autocapitalize: 'sentences',
          autocomplete: 'off',
          enterkeyhint: 'next',
          placeholder: 'Ej: harina',
          value: m.nombre,
          oninput: (e) => (m.nombre = e.target.value),
        });
        const entradaMonto = h('input', {
          class: 'entrada numero',
          id: `material-monto-${i}`,
          type: 'text',
          inputmode: 'numeric',
          autocomplete: 'off',
          enterkeyhint: 'done',
          placeholder: '0',
          value: m.monto ? numero(m.monto) : '',
          oninput: (e) => {
            m.monto = Math.min(leerMonto(e.target.value), 999999999);
            e.target.value = m.monto ? numero(m.monto) : '';
            pintarTotal();
            error.replaceChildren();
          },
        });
        return h(
          'div',
          { class: 'material', role: 'group', 'aria-label': `Cosa ${i + 1}` },
          h(
            'div',
            { class: 'material-cabecera' },
            `Cosa ${i + 1}`,
            varios &&
              h(
                'button',
                {
                  type: 'button',
                  class: 'material-quitar',
                  'aria-label': `Quitar cosa ${i + 1}${m.nombre ? ' (' + m.nombre + ')' : ''}`,
                  onclick: () => {
                    calculo.materiales.splice(i, 1);
                    calculo.guardado = false;
                    pintarLista();
                    pintarTotal();
                  },
                },
                icono('cerrar'),
                'Quitar',
              ),
          ),
          h('div', { class: 'material-fila' }, h('label', { for: entradaNombre.id }, '¿Qué?'), entradaNombre),
          h(
            'div',
            { class: 'material-fila' },
            h('label', { for: entradaMonto.id }, '¿Cuánto?'),
            h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '$'), entradaMonto),
          ),
        );
      }),
    );
    if (enfocar) lista.querySelector('#' + enfocar)?.focus();
  }

  const agregarFila = (nombre = '') => {
    calculo.materiales.push({ nombre, monto: 0 });
    calculo.guardado = false;
    const i = calculo.materiales.length - 1;
    pintarLista(nombre ? `material-monto-${i}` : `material-nombre-${i}`);
  };

  pintarLista();
  pintarTotal();

  vista.append(
    h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const sinMonto = calculo.materiales.findIndex((m) => m.nombre.trim() && !m.monto);
          if (sinMonto >= 0) {
            const m = calculo.materiales[sinMonto];
            return mostrarError(error, `Falta cuánto gastas en “${m.nombre.trim()}”.`, lista.querySelector(`#material-monto-${sinMonto}`));
          }
          const conMonto = calculo.materiales.filter((m) => m.monto > 0);
          if (!conMonto.length) {
            return mostrarError(error, 'Anota al menos una cosa con lo que gastas.', lista.querySelector('#material-monto-0'));
          }
          calculo.materiales = conMonto.map((m) => ({ nombre: m.nombre.trim(), monto: m.monto }));
          calculo.guardado = false;
          siguiente(2);
        },
      },
      h('h2', { class: 'pregunta' }, '¿Qué cosas gastas para hacerlo?'),
      h('p', { class: 'pregunta-ayuda' }, 'Anota lo que gastas en una tanda. Por ejemplo: harina $8.500, gas $3.000.'),
      h('div', { class: 'paso-cuerpo' }, lista),
      h(
        'div',
        { class: 'pila-botones' },
        h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: () => agregarFila() }, icono('mas'), 'Agregar otra cosa'),
      ),
      h(
        'div',
        { class: 'nota' },
        icono('reloj'),
        h(
          'div',
          { class: 'nota-cuerpo' },
          h('p', {}, TEXTOS.tiempoVale),
          h(
            'button',
            {
              type: 'button',
              class: 'boton boton-secundario',
              onclick: () => {
                const i = calculo.materiales.findIndex((m) => m.nombre.trim().toLowerCase() === 'mi tiempo');
                if (i >= 0) lista.querySelector(`#material-monto-${i}`)?.focus();
                else agregarFila('Mi tiempo');
              },
            },
            icono('mas'),
            'Sumar mi tiempo',
          ),
        ),
      ),
      h('p', { class: 'total-materiales' }, 'Gastas en total', total),
      error,
      botonSiguiente(),
    ),
  );
}

// 3. ¿Cuántas unidades te salen con eso?
function paso3(vista) {
  const entrada = h('input', {
    class: 'entrada numero',
    id: 'precio-unidades',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    value: calculo.unidades ? String(calculo.unidades) : '',
  });
  const error = mensajeError();
  const menos = h('button', { type: 'button', class: 'contador-boton', 'aria-label': 'Una menos', onclick: () => cambiar(-1) }, icono('menos'));
  const mas = h('button', { type: 'button', class: 'contador-boton', 'aria-label': 'Una más', onclick: () => cambiar(1) }, icono('mas'));

  const leer = () => Math.min(leerMonto(entrada.value), 100000);
  const pintar = () => (menos.disabled = leer() <= 1);
  function cambiar(delta) {
    entrada.value = String(Math.max(1, leer() + delta));
    entrada.removeAttribute('aria-invalid');
    error.replaceChildren();
    pintar();
  }
  entrada.addEventListener('input', () => {
    const n = leer();
    entrada.value = n ? String(n) : '';
    pintar();
  });
  pintar();

  vista.append(
    h(
      'form',
      {
        novalidate: true,
        onsubmit: (e) => {
          e.preventDefault();
          const n = leer();
          if (!(n > 0)) return mostrarError(error, 'Pon cuántas te salen. Tiene que ser 1 o más.', entrada);
          if (n !== calculo.unidades) calculo.guardado = false;
          calculo.unidades = n;
          siguiente(3);
        },
      },
      h('h2', { class: 'pregunta' }, h('label', { for: 'precio-unidades' }, '¿Cuántas unidades te salen con eso?')),
      h(
        'p',
        { class: 'pregunta-ayuda' },
        `Con ${pesos(totalMateriales())} de gastos, ¿cuántas haces? Si es un servicio (como un corte de pelo), pon 1.`,
      ),
      h('div', { class: 'paso-cuerpo' }, h('div', { class: 'contador' }, menos, entrada, mas), error),
      botonSiguiente(),
    ),
  );
}

// 4. ¿Cuánto quieres ganar? (o "Pongo yo el precio")
function paso4(vista) {
  const base = { materiales: calculo.materiales, unidades: calculo.unidades };
  const { costoUnitario } = calcularPrecio({ ...base, porcentaje: 0 });
  const elegir = (porcentaje) => {
    if (porcentaje !== calculo.porcentaje) calculo.guardado = false;
    calculo.porcentaje = porcentaje;
    calculo.precioManual = null;
    siguiente(4);
  };
  const elegirPrecio = (precio) => {
    if (precio !== calculo.precioManual) calculo.guardado = false;
    calculo.precioManual = precio;
    calculo.porcentaje = null;
    siguiente(4);
  };
  const conPrecioPropio = calculo.precioManual > 0;

  // -- Pongo yo el precio: mientras escribe, le decimos si gana o pierde --
  const entradaPrecio = h('input', {
    class: 'entrada numero',
    id: 'precio-propio',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: '0',
    value: conPrecioPropio ? numero(calculo.precioManual) : '',
  });
  const vistaPrevia = h('p', { class: 'vista-previa', 'aria-live': 'polite' });
  const error = mensajeError();

  function pintarVistaPrevia() {
    const precio = leerMonto(entradaPrecio.value);
    vistaPrevia.className = 'vista-previa';
    if (!precio) {
      vistaPrevia.textContent = `Cada una te cuesta ${pesos(costoUnitario)}.`;
      return;
    }
    const { ganancia } = calcularPrecio({ ...base, precioManual: precio });
    if (ganancia > 0) {
      vistaPrevia.classList.add('gana');
      vistaPrevia.textContent = `Ganas ${pesos(ganancia)} por cada una.`;
    } else if (ganancia === 0) {
      vistaPrevia.classList.add('pierde');
      vistaPrevia.textContent = 'No ganas nada: solo recuperas lo que gastas.';
    } else {
      vistaPrevia.classList.add('pierde');
      vistaPrevia.textContent = `Pierdes ${pesos(-ganancia)} por cada una.`;
    }
  }
  entradaPrecio.addEventListener('input', () => {
    const precio = Math.min(leerMonto(entradaPrecio.value), 999999999);
    entradaPrecio.value = precio ? numero(precio) : '';
    entradaPrecio.removeAttribute('aria-invalid');
    error.replaceChildren();
    pintarVistaPrevia();
  });
  pintarVistaPrevia();

  const formPrecio = h(
    'form',
    {
      class: 'precio-propio',
      novalidate: true,
      hidden: !conPrecioPropio,
      onsubmit: (e) => {
        e.preventDefault();
        const precio = leerMonto(entradaPrecio.value);
        if (!precio) return mostrarError(error, 'Escribe cuánto quieres cobrar por cada una.', entradaPrecio);
        elegirPrecio(precio);
      },
    },
    h(
      'div',
      { class: 'campo' },
      h('label', { class: 'campo-etiqueta', for: 'precio-propio' }, '¿Cuánto quieres cobrar por cada una?'),
      h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '$'), entradaPrecio),
    ),
    vistaPrevia,
    error,
    h('button', { type: 'submit', class: 'boton boton-principal boton-bloque' }, 'Ver resultado', icono('derecha')),
  );

  vista.append(
    h('h2', { class: 'pregunta' }, '¿Cuánto quieres ganar?'),
    h('p', { class: 'pregunta-ayuda' }, `Cada una te cuesta ${pesos(costoUnitario)}. Elige una opción o pon tu propio precio:`),
    h(
      'div',
      { class: 'paso-cuerpo opciones-ganancia' },
      GANANCIAS.map((g) => {
        const r = calcularPrecio({ ...base, porcentaje: g.porcentaje });
        return h(
          'button',
          { type: 'button', class: 'opcion-ganancia', 'aria-pressed': String(calculo.porcentaje === g.porcentaje), onclick: () => elegir(g.porcentaje) },
          h('span', { class: 'opcion-nombre' }, g.etiqueta, h('span', { class: 'opcion-pct' }, ` +${g.porcentaje}%`)),
          h('span', { class: 'opcion-precio' }, 'Cobras', h('strong', { class: 'numero' }, pesos(r.precio))),
          h('span', { class: 'opcion-detalle' }, `Ganas ${pesos(r.ganancia)} por cada una`),
        );
      }),
      h(
        'button',
        {
          type: 'button',
          class: 'opcion-ganancia' + (conPrecioPropio ? ' elegida' : ''),
          'aria-expanded': String(conPrecioPropio),
          onclick: (e) => {
            formPrecio.hidden = !formPrecio.hidden;
            e.currentTarget.setAttribute('aria-expanded', String(!formPrecio.hidden));
            if (!formPrecio.hidden) entradaPrecio.focus();
          },
        },
        h('span', { class: 'opcion-nombre' }, 'Pongo yo el precio'),
        h('span', { class: 'opcion-precio' }, icono('lapiz')),
        h('span', { class: 'opcion-detalle' }, 'Escribes cuánto cobrar y te digo cuánto ganas'),
      ),
      formPrecio,
    ),
  );
}

// 5. Resultado
function paso5(vista) {
  const r = calcularPrecio(calculo);
  const ganancia = GANANCIAS.find((g) => g.porcentaje === calculo.porcentaje);
  const frase = ganancia ? ganancia.frase : `Le sumamos un ${calculo.porcentaje}% para que ganes`;
  const varias = calculo.unidades > 1;
  const sumoTiempo = calculo.materiales.some((m) => /tiempo/i.test(m.nombre));
  const pierde = r.ganancia < 0;

  // Con precio propio, explicamos lo que gana (o pierde) con ese precio.
  let explicacionPrecio;
  if (!r.manual) {
    explicacionPrecio = [
      h('li', {}, `${frase}: ${pesos(r.precioExacto)}.`),
      r.precio !== Math.round(r.precioExacto) && h('li', {}, `Lo redondeamos a ${pesos(r.precio)} para que sea fácil cobrar.`),
    ];
  } else if (pierde) {
    explicacionPrecio = h('li', {}, `Tú decidiste cobrar ${pesos(r.precio)}: pierdes ${pesos(-r.ganancia)} por cada una.`);
  } else if (r.ganancia === 0) {
    explicacionPrecio = h('li', {}, `Tú decidiste cobrar ${pesos(r.precio)}: es lo mismo que te cuesta, así que no ganas nada.`);
  } else {
    explicacionPrecio = h('li', {}, `Tú decidiste cobrar ${pesos(r.precio)}, así que ganas ${pesos(r.ganancia)} por cada una.`);
  }

  const avisoPerdida =
    r.ganancia <= 0 &&
    h(
      'p',
      { class: 'nota nota-peligro', role: 'note' },
      icono('alerta'),
      pierde
        ? `Con este precio pierdes plata. Para no perder, cobra al menos ${pesos(r.precioMinimo)} por cada una.`
        : `Con este precio no ganas nada. Para ganar, cobra más de ${pesos(r.costoUnitario)}.`,
    );

  const notaGuardado = h('p', { class: 'pista', hidden: !calculo.guardado }, 'Lo vas a ver como sugerencia cuando toques Vendí en Mi caja.');
  const botonGuardar = h(
    'button',
    { type: 'button', class: 'boton boton-principal boton-bloque boton-guardar', onclick: () => guardarEnCatalogo() },
  );
  const pintarBoton = () => {
    botonGuardar.disabled = calculo.guardado;
    botonGuardar.classList.toggle('boton-hecho', calculo.guardado);
    botonGuardar.replaceChildren(icono(calculo.guardado ? 'check' : 'mas'), calculo.guardado ? 'Guardado en tu catálogo' : 'Guardar en mi catálogo');
    notaGuardado.hidden = !calculo.guardado;
  };
  pintarBoton();

  async function guardarEnCatalogo() {
    botonGuardar.disabled = true;
    const productos = await listar('productos');
    const existente = productos.find((p) => p.nombre.trim().toLowerCase() === calculo.nombre.toLowerCase());
    const marcarNoGuardado = () => {
      calculo.guardado = false;
      if (botonGuardar.isConnected) pintarBoton();
    };

    if (existente && existente.precio === r.precio) {
      aviso('Ya estaba en tu catálogo con ese precio ✔');
    } else if (existente) {
      const ok = await confirmar({
        titulo: `Ya tienes “${existente.nombre}” en tu catálogo`,
        texto: `Ahora está a ${pesos(existente.precio)}. ¿Lo cambiamos a ${pesos(r.precio)}?`,
        si: `Sí, cambiar a ${pesos(r.precio)}`,
        no: 'No, dejarlo como está',
      });
      if (!ok) {
        botonGuardar.disabled = false;
        return;
      }
      const anterior = { ...existente };
      await guardar('productos', { ...existente, precio: r.precio, costoUnitario: r.costoUnitario, activo: true });
      aviso('Precio cambiado en tu catálogo ✔', {
        deshacer: async () => {
          await guardar('productos', anterior);
          marcarNoGuardado();
          aviso('Listo, quedó como antes.');
        },
      });
    } else {
      const producto = { id: nuevoId(), nombre: calculo.nombre, precio: r.precio, foto: null, costoUnitario: r.costoUnitario, activo: true };
      await agregar('productos', producto);
      aviso('Guardado en tu catálogo ✔', {
        deshacer: async () => {
          await borrar('productos', producto.id);
          marcarNoGuardado();
          aviso('Listo, lo quité del catálogo.');
        },
      });
    }
    calculo.guardado = true;
    pintarBoton();
  }

  const otroPrecio = () => {
    const pasosAtras = (history.state?.prof ?? 0) - calculo.profInicio;
    calculo = nuevoCalculo();
    if (pasosAtras > 0) history.go(-pasosAtras);
    else ir('/precio', { reemplazar: true });
  };
  const alInicio = () => {
    const pasosAtras = (history.state?.prof ?? 0) - calculo.profInicio + 1;
    const habiaInicio = calculo.profInicio > 0;
    calculo = nuevoCalculo();
    if (habiaInicio) history.go(-pasosAtras);
    else ir('/', { reemplazar: true });
  };

  anexar(
    vista,
    h(
      'section',
      { class: 'resultado', 'aria-label': 'Resultado' },
      h('p', { class: 'resultado-producto' }, calculo.nombre),
      h('p', { class: 'resultado-cobra' }, 'Cobra', h('strong', { class: 'resultado-precio numero' }, pesos(r.precio))),
      h('p', { class: 'resultado-unidad' }, 'cada una'),
      h(
        'div',
        { class: 'resultado-partes' },
        h('div', {}, h('span', {}, 'Te cuesta'), h('strong', { class: 'numero' }, pesos(r.costoUnitario)), h('span', {}, 'cada una')),
        h(
          'div',
          { class: pierde ? 'pierde' : '' },
          h('span', {}, pierde ? 'Pierdes' : 'Ganas'),
          h('strong', { class: 'numero' }, pesos(Math.abs(r.ganancia))),
          h('span', {}, 'cada una'),
        ),
      ),
    ),
    avisoPerdida,
    h('h2', { class: 'seccion-titulo' }, 'Así lo calculamos'),
    h(
      'ol',
      { class: 'explicacion' },
      h('li', {}, varias ? `Gastas ${pesos(r.total)} y te salen ${numero(calculo.unidades)}.` : `Gastas ${pesos(r.total)} para hacer una.`),
      varias && h('li', {}, `Entonces cada una te cuesta ${pesos(r.costoUnitario)}.`),
      explicacionPrecio,
    ),
    varias &&
      h(
        'p',
        { class: 'ganancia-total' + (r.gananciaTotal < 0 ? ' pierde' : '') },
        r.gananciaTotal < 0
          ? `Si vendes las ${numero(calculo.unidades)}, pierdes ${pesos(-r.gananciaTotal)}.`
          : `Si vendes las ${numero(calculo.unidades)}, ganas ${pesos(r.gananciaTotal)}.`,
      ),
    !sumoTiempo && h('p', { class: 'nota nota-suave' }, icono('reloj'), TEXTOS.tiempoVale),
    h(
      'div',
      { class: 'pila-botones' },
      botonGuardar,
      notaGuardado,
      h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: otroPrecio }, 'Calcular otro precio'),
      h('button', { type: 'button', class: 'boton-texto', onclick: alInicio }, icono('atras'), 'Volver al inicio'),
    ),
  );
}
