// Respaldo: guardar todos los datos en un archivo y recuperarlos después.
import { APP_VERSION, DIAS_RECORDATORIO_RESPALDO } from './config.js';
import { STORES, listar, contar, leerConfig, guardarConfig, guardarVarios } from './db.js';
import { hoyISO, diasEntre, fechaLocalDe, fechaCompleta } from './format.js';
import { aviso, confirmar, avisarCambio } from './ui.js';

const FORMATO = 1; // súbelo si cambia la forma del archivo

export async function crearRespaldo() {
  const datos = {};
  for (const store of STORES) datos[store] = await listar(store);
  return { app: 'mi-negocio', formato: FORMATO, versionApp: APP_VERSION, creadoEn: new Date().toISOString(), datos };
}

function nombreArchivo(extension) {
  return `respaldo-mi-negocio-${hoyISO()}.${extension}`;
}

function descargar(texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo('json');
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function marcarRespaldo() {
  const meta = (await leerConfig('meta')) || { clave: 'meta', creadoEn: new Date().toISOString() };
  meta.ultimoRespaldo = new Date().toISOString();
  await guardarConfig(meta);
}

// Abre el menú "Compartir" del celular (WhatsApp, Drive, correo...).
// Si no se puede, descarga el archivo. Devuelve 'compartido', 'descargado' o 'cancelado'.
export async function compartirRespaldo() {
  const texto = JSON.stringify(await crearRespaldo());
  // Chrome en Android no deja compartir .json; por eso probamos también como .txt.
  const archivo = [
    new File([texto], nombreArchivo('json'), { type: 'application/json' }),
    new File([texto], nombreArchivo('txt'), { type: 'text/plain' }),
  ].find((f) => navigator.canShare?.({ files: [f] }));

  if (archivo) {
    try {
      await navigator.share({ files: [archivo], title: 'Respaldo de Mi Negocio' });
      await marcarRespaldo();
      return 'compartido';
    } catch (error) {
      if (error.name === 'AbortError') return 'cancelado';
      // Otro error (por ejemplo, el navegador no lo permitió): descargamos.
    }
  }
  await descargarRespaldo(texto);
  await marcarRespaldo();
  return 'descargado';
}

export async function descargarRespaldo(texto) {
  descargar(texto ?? JSON.stringify(await crearRespaldo()));
  if (texto == null) await marcarRespaldo();
}

// ---- Recuperar ----

export class ErrorRespaldo extends Error {}

const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const esMonto = (v) => Number.isInteger(v) && v >= 0;
const esId = (v) => typeof v === 'string' && v.length > 0 && v.length <= 64;

// Solo dejamos pasar registros con la forma correcta.
const VALIDOS = {
  ventas: (r) => esId(r?.id) && esFecha(r.fecha) && esMonto(r.monto),
  gastos: (r) => esId(r?.id) && esFecha(r.fecha) && esMonto(r.monto),
  productos: (r) => esId(r?.id) && typeof r.nombre === 'string',
  config: (r) => typeof r?.clave === 'string' && ['perfil', 'meta'].includes(r.clave),
};

// Lee y revisa el archivo. No guarda nada todavía.
export async function leerArchivoRespaldo(archivo) {
  let respaldo;
  try {
    respaldo = JSON.parse(await archivo.text());
  } catch {
    throw new ErrorRespaldo('Ese archivo no es un respaldo de Mi Negocio.');
  }
  if (respaldo?.app !== 'mi-negocio' || typeof respaldo.datos !== 'object' || respaldo.datos === null) {
    throw new ErrorRespaldo('Ese archivo no es un respaldo de Mi Negocio.');
  }
  if (respaldo.formato > FORMATO) {
    throw new ErrorRespaldo('Ese respaldo es de una versión más nueva de la app. Actualiza la app y vuelve a intentar.');
  }
  const datos = {};
  for (const store of STORES) {
    const lista = Array.isArray(respaldo.datos[store]) ? respaldo.datos[store] : [];
    datos[store] = lista.filter(VALIDOS[store]);
  }
  return { datos, creadoEn: respaldo.creadoEn };
}

// Suma los datos del respaldo a los del celular. Lo que ya está anotado no se borra;
// si un registro existe en los dos, queda el del respaldo.
export async function aplicarRespaldo({ datos }) {
  const meta = datos.config.find((c) => c.clave === 'meta');
  if (meta) meta.versionApp = APP_VERSION;
  await guardarVarios(datos);
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Revisa el archivo, pide confirmación y recupera. Devuelve true si se recuperó.
export async function recuperarArchivo(archivo) {
  if (!archivo) return false;
  let respaldo;
  try {
    respaldo = await leerArchivoRespaldo(archivo);
  } catch (error) {
    await confirmar({
      titulo: 'No pudimos leer ese archivo',
      texto: error instanceof ErrorRespaldo ? error.message : 'Ese archivo no es un respaldo de Mi Negocio.',
      si: 'Entendido',
      no: null,
    });
    return false;
  }
  const { ventas, gastos, productos } = respaldo.datos;
  const fecha = respaldo.creadoEn ? ` Es del ${fechaCompleta(respaldo.creadoEn)}.` : '';
  const ok = await confirmar({
    titulo: '¿Recuperar este respaldo?',
    texto:
      `Trae ${plural(ventas.length, 'venta', 'ventas')}, ${plural(gastos.length, 'gasto', 'gastos')} ` +
      `y ${plural(productos.length, 'producto', 'productos')}.${fecha} Lo que ya tienes anotado en este celular no se borra.`,
    si: 'Sí, recuperar',
    no: 'No, volver',
  });
  if (!ok) return false;
  try {
    await aplicarRespaldo(respaldo);
  } catch (e) {
    console.error(e);
    aviso('No se pudo recuperar. Intenta de nuevo.');
    return false;
  }
  avisarCambio();
  aviso('Respaldo recuperado ✔');
  return true;
}

// Abre el selector de archivos del celular y recupera el respaldo elegido.
export function elegirYRecuperar() {
  return new Promise((resolve) => {
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = '.json,.txt,application/json,text/plain';
    entrada.addEventListener('change', async () => resolve(await recuperarArchivo(entrada.files?.[0])));
    entrada.addEventListener('cancel', () => resolve(false));
    entrada.click();
  });
}

// ---- Recordatorio ----

// Devuelve los días desde el último respaldo (o desde que se empezó a usar la app).
export async function diasSinRespaldo() {
  const meta = await leerConfig('meta');
  const desde = meta?.ultimoRespaldo || meta?.creadoEn;
  return desde ? diasEntre(fechaLocalDe(desde), hoyISO()) : 0;
}

export async function debeRecordarRespaldo() {
  const [ventas, gastos] = await Promise.all([contar('ventas'), contar('gastos')]);
  if (ventas + gastos === 0) return false;
  return (await diasSinRespaldo()) > DIAS_RECORDATORIO_RESPALDO;
}
