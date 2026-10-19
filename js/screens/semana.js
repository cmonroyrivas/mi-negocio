// Mi semana: cómo le fue los últimos 7 días, con gráfico, y el resumen para mandar por WhatsApp.
import { listarEntreFechas, leerConfig } from '../db.js';
import { pesos, pesosCortos, hoyISO, sumarDias, rangoFechas, diaCorto, diaLargo, fechaDesdeISO, nombreMes, inicioDeMes } from '../format.js';
import { h, anexar, icono, volver, encabezado } from '../ui.js';
import { abrirWhatsApp, compartirTexto } from '../whatsapp.js';

const suma = (lista) => lista.reduce((total, r) => total + r.monto, 0);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const conMayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

// ---- Cálculos y mensaje (sin pantalla, para poder probarlos solos) ----

export function resumir(ventas, gastos) {
  const vendi = suma(ventas);
  const gaste = suma(gastos);
  return { vendi, gaste, quedo: vendi - gaste, cantidadVentas: ventas.length };
}

// Lo vendido cada día, en el orden de `dias`.
export function ventasPorDia(ventas, dias) {
  const porFecha = Object.fromEntries(dias.map((d) => [d, 0]));
  for (const v of ventas) if (v.fecha in porFecha) porFecha[v.fecha] += v.monto;
  return dias.map((fecha) => ({ fecha, monto: porFecha[fecha] }));
}

export function comparar(semana, anterior) {
  if (anterior.cantidadVentas === 0) return { tipo: 'info', texto: 'La semana anterior no anotaste ventas.' };
  const diferencia = semana.vendi - anterior.vendi;
  if (diferencia > 0) return { tipo: 'subio', texto: `Vendiste ${pesos(diferencia)} más que la semana anterior.` };
  if (diferencia < 0) return { tipo: 'bajo', texto: `Vendiste ${pesos(-diferencia)} menos que la semana anterior.` };
  return { tipo: 'igual', texto: 'Vendiste lo mismo que la semana anterior.' };
}

// Mensaje para WhatsApp: últimos 7 días y mes en curso. Sin datos de clientes.
export function mensajeResumen({ perfil, semana, mes, hoy }) {
  const quien = [perfil?.nombrePersona, perfil?.nombreNegocio].filter(Boolean).join(' – ') || 'Mi negocio';
  const bloque = (r) => [`• Vendí: ${pesos(r.vendi)} (${plural(r.cantidadVentas, 'venta', 'ventas')})`, `• Gasté: ${pesos(r.gaste)}`, `• Me quedó: ${pesos(r.quedo)}`];
  const dia = fechaDesdeISO(hoy).getDate();
  const delMes = dia === 1 ? `(1 de ${nombreMes(hoy)})` : `(del 1 al ${dia} de ${nombreMes(hoy)})`;
  return [
    `*Resumen de ${quien}*`,
    '',
    `*Últimos 7 días* (${rangoFechas(sumarDias(hoy, -6), hoy)}):`,
    ...bloque(semana),
    '',
    `*${conMayuscula(nombreMes(hoy))}* ${delMes}:`,
    ...bloque(mes),
    '',
    'Enviado desde la app Mi Negocio',
  ].join('\n');
}

// ---- Gráfico de barras (SVG hecho a mano) ----

const SVG = 'http://www.w3.org/2000/svg';
function s(etiqueta, atributos = {}, texto) {
  const el = document.createElementNS(SVG, etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) el.setAttribute(clave, valor);
  if (texto != null) el.textContent = texto;
  return el;
}

function grafico(porDia, hoy) {
  const ancho = 336;
  const base = 150; // línea donde parten las barras
  const altoMaximo = 112;
  const columna = ancho / 7;
  const anchoBarra = 30;
  const maximo = Math.max(...porDia.map((d) => d.monto), 1);

  const descripcion = porDia.map((d) => `${diaLargo(d.fecha)}: ${pesos(d.monto)}`).join('; ');
  const svg = s('svg', { viewBox: `0 0 ${ancho} 200`, class: 'grafico', role: 'img', 'aria-labelledby': 'grafico-titulo grafico-desc' });
  svg.append(s('title', { id: 'grafico-titulo' }, 'Lo que vendiste cada día'), s('desc', { id: 'grafico-desc' }, descripcion));
  svg.append(s('line', { x1: 0, x2: ancho, y1: base, y2: base, class: 'grafico-base' }));

  porDia.forEach((d, i) => {
    const centro = columna * i + columna / 2;
    const esHoy = d.fecha === hoy;
    const alto = d.monto > 0 ? Math.max(4, (d.monto / maximo) * altoMaximo) : 0;
    if (alto) {
      svg.append(s('rect', { x: centro - anchoBarra / 2, y: base - alto, width: anchoBarra, height: alto, rx: 4, class: 'grafico-barra' + (esHoy ? ' hoy' : '') }));
      svg.append(s('text', { x: centro, y: base - alto - 6, class: 'grafico-valor' }, pesosCortos(d.monto).replace('$', '')));
    } else {
      svg.append(s('rect', { x: centro - anchoBarra / 2, y: base - 3, width: anchoBarra, height: 3, rx: 1.5, class: 'grafico-cero' }));
    }
    svg.append(s('text', { x: centro, y: base + 22, class: 'grafico-dia' + (esHoy ? ' hoy' : '') }, esHoy ? 'hoy' : diaCorto(d.fecha)));
    svg.append(s('text', { x: centro, y: base + 42, class: 'grafico-fecha' }, String(fechaDesdeISO(d.fecha).getDate())));
  });
  return svg;
}

// ---- Pantalla ----

export async function render(vista) {
  const hoy = hoyISO();
  const desde = sumarDias(hoy, -6);
  const desdeAnterior = sumarDias(hoy, -13);
  const hastaAnterior = sumarDias(hoy, -7);
  const inicioMes = inicioDeMes(hoy);
  const desdeConsulta = desdeAnterior < inicioMes ? desdeAnterior : inicioMes;

  const [ventas, gastos, perfil, facilitadora] = await Promise.all([
    listarEntreFechas('ventas', desdeConsulta, hoy),
    listarEntreFechas('gastos', desdeConsulta, hoy),
    leerConfig('perfil'),
    leerConfig('facilitadora'),
  ]);
  const entre = (lista, a, b) => lista.filter((r) => r.fecha >= a && r.fecha <= b);
  const ventasSemana = entre(ventas, desde, hoy);
  const semana = resumir(ventasSemana, entre(gastos, desde, hoy));
  const anterior = resumir(entre(ventas, desdeAnterior, hastaAnterior), entre(gastos, desdeAnterior, hastaAnterior));
  const mes = resumir(entre(ventas, inicioMes, hoy), entre(gastos, inicioMes, hoy));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(desde, i));
  const comparacion = comparar(semana, anterior);
  const hayAlgo = ventasSemana.length + entre(gastos, desde, hoy).length > 0;
  const mensaje = () => mensajeResumen({ perfil, semana, mes, hoy });

  const conBotonOcupado = (accion) => async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    await accion();
    boton.disabled = false;
  };

  anexar(
    vista,
    encabezado('Mi semana', { alVolver: () => volver('/') }),
    h('p', { class: 'rango-semana' }, h('strong', {}, 'Últimos 7 días'), ` · ${rangoFechas(desde, hoy)}`),
    hayAlgo
      ? h('section', { class: 'tarjeta-grafico', 'aria-label': 'Ventas por día' }, h('h2', { class: 'grafico-titulo' }, 'Lo que vendiste cada día'), grafico(ventasPorDia(ventasSemana, dias), hoy))
      : h('p', { class: 'vacio' }, 'Estos 7 días no anotaste nada. Anota tus ventas y gastos en Mi caja.'),
    h(
      'section',
      { class: 'resumen', 'aria-label': 'Resumen de la semana' },
      h(
        'div',
        { class: 'resumen-item resumen-entro' },
        h('span', { class: 'resumen-etiqueta' }, 'Vendí'),
        h('span', { class: 'resumen-monto numero' }, pesos(semana.vendi)),
        h('span', { class: 'resumen-extra' }, plural(semana.cantidadVentas, 'venta', 'ventas')),
      ),
      h('div', { class: 'resumen-item resumen-salio' }, h('span', { class: 'resumen-etiqueta' }, 'Gasté'), h('span', { class: 'resumen-monto numero' }, pesos(semana.gaste))),
      h(
        'div',
        { class: 'resumen-item resumen-quedo' + (semana.quedo < 0 ? ' negativo' : '') },
        h('span', { class: 'resumen-etiqueta' }, 'Me quedó'),
        h('span', { class: 'resumen-monto numero' }, pesos(semana.quedo)),
      ),
    ),
    h('p', { class: 'comparacion comparacion-' + comparacion.tipo }, icono(comparacion.tipo), comparacion.texto),
    h(
      'p',
      { class: 'mes-semana' },
      `En ${nombreMes(hoy)}: vendiste ${pesos(mes.vendi)} (${plural(mes.cantidadVentas, 'venta', 'ventas')}) y te quedó ${pesos(mes.quedo)}.`,
    ),
    h('h2', { class: 'seccion-titulo' }, 'Mandar mi resumen'),
    h(
      'div',
      { class: 'pila-botones pila-arriba' },
      facilitadora &&
        h(
          'button',
          {
            type: 'button',
            class: 'boton boton-principal boton-bloque boton-guardar',
            onclick: () => abrirWhatsApp(mensaje(), facilitadora.whatsapp),
          },
          icono('mensaje'),
          `Enviar mi resumen a ${facilitadora.nombre}`,
        ),
      h(
        'button',
        { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: conBotonOcupado(() => compartirTexto(mensaje())) },
        icono('compartir'),
        facilitadora ? 'Compartir con otra persona' : 'Compartir mi resumen',
      ),
    ),
    !facilitadora &&
      h(
        'p',
        { class: 'pista' },
        '¿Tu facilitadora te pidió el resumen? Pídele su enlace, o anota su WhatsApp en ',
        h('a', { href: '#/ajustes' }, 'Ajustes'),
        '.',
      ),
    h('p', { class: 'pie-legal' }, icono('info'), 'El resumen dice cuánto vendiste y gastaste en la semana y en el mes. No lleva datos de tus clientes. Tú decides si lo mandas.'),
  );
}
