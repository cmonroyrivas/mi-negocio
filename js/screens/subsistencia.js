// Registro de Subsistencia: cuánto lleva vendido frente al tope de referencia (5 UTM al mes).
// Regla que usamos (indicada por la facilitadora): el promedio de ingresos considera el total
// de los últimos 6 meses (o el período menor desde el inicio de la actividad), con la UTM del
// mes anterior a la solicitud. Es solo una guía.
import { UTM_POR_MES, TOPE_SUBSISTENCIA_UTM, MESES_PROMEDIO, UMBRAL_AMARILLO, UMBRAL_ROJO, TEXTOS } from '../config.js';
import { listarEntreFechas, primeraFecha } from '../db.js';
import { pesos, hoyISO, inicioDeMes, rangoFechas, nombreMes } from '../format.js';
import { h, anexar, icono, volver, encabezado } from '../ui.js';

// ---- Cálculos (sin pantalla, para poder probarlos solos) ----

const mesDe = (iso) => iso.slice(0, 7); // '2026-10-19' -> '2026-10'

export function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

// UTM del mes anterior a hoy. Si no está en la tabla, la última anotada (y lo avisamos).
export function utmParaHoy(hoy, tabla = UTM_POR_MES) {
  const buscado = mesAnterior(mesDe(hoy));
  if (tabla[buscado]) return { mes: buscado, valor: tabla[buscado], exacta: true };
  const meses = Object.keys(tabla).sort();
  const anteriores = meses.filter((m) => m <= buscado);
  const mes = anteriores.length ? anteriores[anteriores.length - 1] : meses[0];
  return { mes, valor: tabla[mes], exacta: false };
}

// Los meses completos que entran al promedio: hasta 6 antes del mes actual,
// pero no antes del primer mes con ventas anotadas.
export function mesesParaPromedio(hoy, primera, cantidad = MESES_PROMEDIO) {
  if (!primera) return [];
  const meses = [];
  let mes = mesDe(hoy);
  for (let i = 0; i < cantidad; i++) {
    mes = mesAnterior(mes);
    meses.unshift(mes);
  }
  return meses.filter((m) => m >= mesDe(primera));
}

export function nivelDe(porcentaje) {
  if (porcentaje > UMBRAL_ROJO) return 'rojo';
  if (porcentaje >= UMBRAL_AMARILLO) return 'amarillo';
  return 'verde';
}

export function mensajeDe(porcentaje) {
  if (porcentaje > 100) return 'Pasaste el tope. Conversa con tu facilitadora.';
  if (porcentaje > UMBRAL_ROJO) return 'Estás muy cerca del tope. Conversa con tu facilitadora.';
  if (porcentaje >= UMBRAL_AMARILLO) return 'Ojo: te estás acercando al tope.';
  return 'Vas bien: estás lejos del tope.';
}

export function frenteAlTope(monto, tope) {
  const porcentaje = tope > 0 ? (monto / tope) * 100 : 0;
  return { monto, porcentaje, nivel: nivelDe(porcentaje), mensaje: mensajeDe(porcentaje) };
}

export function calcularSubsistencia({ ventas, hoy, primera, tabla = UTM_POR_MES }) {
  const utm = utmParaHoy(hoy, tabla);
  const tope = TOPE_SUBSISTENCIA_UTM * utm.valor;
  const suma = (lista) => lista.reduce((total, v) => total + v.monto, 0);
  const delMes = suma(ventas.filter((v) => mesDe(v.fecha) === mesDe(hoy)));
  const meses = mesesParaPromedio(hoy, primera);
  const promedio = meses.length ? Math.round(suma(ventas.filter((v) => meses.includes(mesDe(v.fecha)))) / meses.length) : null;
  return {
    utm,
    tope,
    mes: frenteAlTope(delMes, tope),
    promedio: promedio == null ? null : { ...frenteAlTope(promedio, tope), meses },
  };
}

// Para el aviso chico del inicio: solo el mes en curso.
export function mesFrenteAlTope(vendidoMes, hoy) {
  return frenteAlTope(vendidoMes, TOPE_SUBSISTENCIA_UTM * utmParaHoy(hoy).valor);
}

// ---- Partes de la pantalla ----

const nombreDelMes = (mes) => nombreMes(`${mes}-01`);

export function barraTope({ porcentaje, nivel }) {
  return h(
    'div',
    {
      class: 'barra-tope nivel-' + nivel,
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(Math.round(Math.min(porcentaje, 100))),
      'aria-valuetext': `${Math.round(porcentaje)}% del tope`,
    },
    h('span', { class: 'barra-tope-relleno', style: `width:${Math.min(100, Math.max(porcentaje, 2))}%` }),
  );
}

function estado(r) {
  return h(
    'p',
    { class: 'estado-tope nivel-' + r.nivel },
    icono(r.nivel === 'verde' ? 'check' : 'alerta'),
    h('span', {}, h('strong', {}, `${Math.round(r.porcentaje)}% del tope. `), r.mensaje),
  );
}

export async function render(vista) {
  const hoy = hoyISO();
  const meses = mesesParaPromedio(hoy, '1900-01-01'); // para saber desde cuándo buscar
  const [ventas, primera] = await Promise.all([listarEntreFechas('ventas', `${meses[0]}-01`, hoy), primeraFecha('ventas')]);
  const r = calcularSubsistencia({ ventas, hoy, primera });

  const tarjetaPromedio = r.promedio
    ? h(
        'section',
        { class: 'tarjeta-tope', 'aria-labelledby': 'titulo-promedio' },
        h('h2', { id: 'titulo-promedio' }, `Promedio de los últimos ${MESES_PROMEDIO} meses`),
        h('p', {}, 'Vendiste en promedio'),
        h('p', { class: 'monto-tope numero' }, pesos(r.promedio.monto), h('span', {}, ' al mes')),
        barraTope(r.promedio),
        estado(r.promedio),
        h(
          'p',
          { class: 'detalle-tope' },
          r.promedio.meses.length === 1
            ? `Contamos 1 mes: ${nombreDelMes(r.promedio.meses[0])}.`
            : `Contamos ${r.promedio.meses.length} meses: de ${nombreDelMes(r.promedio.meses[0])} a ${nombreDelMes(r.promedio.meses[r.promedio.meses.length - 1])}.`,
          r.promedio.meses.length < MESES_PROMEDIO ? ' Son los meses que llevas anotando en la app.' : '',
        ),
      )
    : h(
        'section',
        { class: 'tarjeta-tope', 'aria-labelledby': 'titulo-promedio' },
        h('h2', { id: 'titulo-promedio' }, `Promedio de los últimos ${MESES_PROMEDIO} meses`),
        h('p', { class: 'detalle-tope' }, 'Todavía no tienes un mes completo anotado. Cuando termine este mes, aquí verás tu promedio.'),
      );

  anexar(
    vista,
    encabezado('Subsistencia', { alVolver: () => volver('/') }),
    h(
      'section',
      { class: 'tope-referencia' },
      h('p', {}, `Tope de referencia: ${TOPE_SUBSISTENCIA_UTM} UTM al mes`),
      h('p', { class: 'monto-tope numero' }, pesos(r.tope)),
      h(
        'p',
        { class: 'detalle-tope' },
        `Con la UTM de ${nombreDelMes(r.utm.mes)} de ${r.utm.mes.slice(0, 4)} (${pesos(r.utm.valor)}).`,
        r.utm.exacta ? '' : ' Es la última UTM anotada en la app.',
      ),
    ),
    h(
      'section',
      { class: 'tarjeta-tope', 'aria-labelledby': 'titulo-mes' },
      h('h2', { id: 'titulo-mes' }, 'Este mes'),
      h('p', {}, hoy === inicioDeMes(hoy) ? `Hoy, 1 de ${nombreMes(hoy)}, vendiste` : `Del ${rangoFechas(inicioDeMes(hoy), hoy)} vendiste`),
      h('p', { class: 'monto-tope numero' }, pesos(r.mes.monto)),
      barraTope(r.mes),
      estado(r.mes),
    ),
    tarjetaPromedio,
    h(
      'section',
      { class: 'nota nota-suave explicacion-tope', 'aria-labelledby': 'titulo-como' },
      icono('info'),
      h(
        'div',
        { class: 'nota-cuerpo' },
        h('h2', { id: 'titulo-como' }, '¿Cómo se calcula?'),
        h(
          'p',
          {},
          `Se suma lo que vendiste en los últimos ${MESES_PROMEDIO} meses (o desde que empezaste, si llevas menos tiempo) y se saca el promedio por mes. Ese promedio se compara con ${TOPE_SUBSISTENCIA_UTM} UTM, usando el valor de la UTM del mes anterior a tu solicitud.`,
        ),
        h('p', {}, 'Aquí lo calculamos con lo que anotaste en la app. Por eso es importante anotar todas tus ventas.'),
      ),
    ),
    h('p', { class: 'pie-legal' }, icono('info'), TEXTOS.guiaSubsistencia),
  );
}
