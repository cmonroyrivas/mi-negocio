// Formato de pesos, fechas y redondeo. Todo en español de Chile.

const fmtPesos = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
const fmtNumero = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
const fmtDiaLargo = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtFecha = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

// 12000 -> "$12.000". El signo va antes del peso ("-$2.000"), como se escribe acá.
export function pesos(n) {
  const v = Math.round(Number(n) || 0);
  return (v < 0 ? '-' : '') + fmtPesos.format(Math.abs(v));
}

// 12000 -> "12.000"
export function numero(n) {
  return fmtNumero.format(Math.round(Number(n) || 0));
}

// "$ 12.000" o "12000" -> 12000. Si no hay número, 0.
export function leerMonto(texto) {
  const soloDigitos = String(texto ?? '').replace(/\D/g, '');
  return soloDigitos ? parseInt(soloDigitos, 10) : 0;
}

// Redondea hacia arriba al múltiplo de $10. Antes quita el ruido de decimales
// de JavaScript (1000 * 1.3 = 1300.0000000000002 no debe quedar en 1310).
export function redondearA10(n) {
  const limpio = Math.round(n * 100) / 100;
  return Math.ceil(limpio / 10) * 10;
}

// ---- Fechas: se guardan como 'YYYY-MM-DD' en hora local ----

export function isoDesdeFecha(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export function hoyISO() {
  return isoDesdeFecha(new Date());
}

export function fechaDesdeISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function sumarDias(iso, dias) {
  const f = fechaDesdeISO(iso);
  f.setDate(f.getDate() + dias);
  return isoDesdeFecha(f);
}

// Días desde isoA hasta isoB (Math.round por los cambios de horario).
export function diasEntre(isoA, isoB) {
  return Math.round((fechaDesdeISO(isoB) - fechaDesdeISO(isoA)) / 86400000);
}

function conMayuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "Hoy", "Ayer" o "Martes, 13 de octubre"
export function nombreDia(iso) {
  const hoy = hoyISO();
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  return conMayuscula(fmtDiaLargo.format(fechaDesdeISO(iso)));
}

// "jueves, 15 de octubre"
export function diaLargo(iso) {
  return fmtDiaLargo.format(fechaDesdeISO(iso));
}

// "15 de octubre de 2026"
export function fechaCompleta(isoOFecha) {
  const f = typeof isoOFecha === 'string' && isoOFecha.length === 10 ? fechaDesdeISO(isoOFecha) : new Date(isoOFecha);
  return fmtFecha.format(f);
}

// De un ISO con hora ("2026-10-15T13:32:00.000Z") -> "10:32" en hora local.
export function hora(isoConHora) {
  return fmtHora.format(new Date(isoConHora));
}

// Fecha local (YYYY-MM-DD) de un ISO con hora.
export function fechaLocalDe(isoConHora) {
  return isoDesdeFecha(new Date(isoConHora));
}

// ---- WhatsApp ----

// Acepta "9 1234 5678", "+56 9 1234 5678" o "912345678" y devuelve "56912345678".
// Vacío devuelve ''. Si no se entiende, devuelve null.
export function normalizarWhatsapp(texto) {
  let d = String(texto || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d.startsWith('569')) d = d.slice(2);
  if (d.length === 8) d = '9' + d;
  return d.length === 9 && d.startsWith('9') ? '56' + d : null;
}

// "56912345678" -> "9 1234 5678" (para mostrar en el campo)
export function whatsappParaMostrar(guardado) {
  if (!guardado) return '';
  const d = guardado.slice(2);
  return `${d.slice(0, 1)} ${d.slice(1, 5)} ${d.slice(5)}`;
}
