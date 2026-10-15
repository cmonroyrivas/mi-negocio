// Wrapper mínimo de IndexedDB. Todos los datos quedan solo en este celular.
import { APP_VERSION } from './config.js';

const NOMBRE_BD = 'mi-negocio';
const VERSION_BD = 1;
export const STORES = ['ventas', 'gastos', 'productos', 'config'];

let promesaBD = null;

// Crea o actualiza la estructura. Cada bloque agrega lo que falta:
// nunca borrar datos al actualizar.
function migrar(bd, versionAnterior) {
  if (versionAnterior < 1) {
    bd.createObjectStore('ventas', { keyPath: 'id' }).createIndex('fecha', 'fecha');
    bd.createObjectStore('gastos', { keyPath: 'id' }).createIndex('fecha', 'fecha');
    bd.createObjectStore('productos', { keyPath: 'id' });
    bd.createObjectStore('config', { keyPath: 'clave' });
  }
}

export function abrir() {
  if (!promesaBD) {
    promesaBD = new Promise((resolve, reject) => {
      if (!self.indexedDB) {
        reject(new Error('sin-indexeddb'));
        return;
      }
      const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
      pedido.onupgradeneeded = (e) => migrar(pedido.result, e.oldVersion);
      pedido.onsuccess = () => {
        const bd = pedido.result;
        // Si otra pestaña abre una versión nueva, soltamos esta conexión para no bloquearla.
        bd.onversionchange = () => {
          bd.close();
          promesaBD = null;
        };
        resolve(bd);
      };
      pedido.onerror = () => reject(pedido.error);
    });
    promesaBD.catch(() => {
      promesaBD = null;
    });
  }
  return promesaBD;
}

function aPromesa(pedido) {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function finDe(tx) {
  const fin = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaccion-abortada'));
  });
  fin.catch(() => {}); // el error se maneja donde se espera "fin"
  return fin;
}

async function conStore(nombre, modo, accion) {
  const bd = await abrir();
  const tx = bd.transaction(nombre, modo);
  const fin = finDe(tx);
  const pedido = accion(tx.objectStore(nombre));
  const resultado = pedido ? await aPromesa(pedido) : undefined;
  await fin;
  return resultado;
}

export const agregar = (store, obj) => conStore(store, 'readwrite', (s) => s.add(obj)).then(() => obj);
export const guardar = (store, obj) => conStore(store, 'readwrite', (s) => s.put(obj)).then(() => obj);
export const obtener = (store, clave) => conStore(store, 'readonly', (s) => s.get(clave));
export const borrar = (store, clave) => conStore(store, 'readwrite', (s) => s.delete(clave));
export const listar = (store) => conStore(store, 'readonly', (s) => s.getAll());
export const contar = (store) => conStore(store, 'readonly', (s) => s.count());
export const listarPorFecha = (store, fecha) =>
  conStore(store, 'readonly', (s) => s.index('fecha').getAll(fecha));

// Los últimos `limite` registros por fecha (más nuevos primero). Para las sugerencias.
export async function recientes(store, limite) {
  const bd = await abrir();
  const tx = bd.transaction(store, 'readonly');
  const fin = finDe(tx);
  const lista = [];
  await new Promise((resolve, reject) => {
    const pedido = tx.objectStore(store).index('fecha').openCursor(null, 'prev');
    pedido.onerror = () => reject(pedido.error);
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor || lista.length >= limite) {
        resolve();
        return;
      }
      lista.push(cursor.value);
      cursor.continue();
    };
  });
  await fin;
  return lista;
}

// Guarda muchos registros de una vez, todo o nada (para recuperar un respaldo).
export async function guardarVarios(datosPorStore) {
  const bd = await abrir();
  const nombres = Object.keys(datosPorStore).filter((n) => STORES.includes(n));
  const tx = bd.transaction(nombres, 'readwrite');
  const fin = finDe(tx);
  for (const nombre of nombres) {
    const store = tx.objectStore(nombre);
    for (const obj of datosPorStore[nombre]) store.put(obj);
  }
  await fin;
}

export async function vaciarTodo() {
  const bd = await abrir();
  const tx = bd.transaction(STORES, 'readwrite');
  const fin = finDe(tx);
  for (const nombre of STORES) tx.objectStore(nombre).clear();
  await fin;
}

export const leerConfig = (clave) => obtener('config', clave);
export const guardarConfig = (obj) => guardar('config', obj);

// Crea el registro 'meta' la primera vez y anota la versión de la app.
export async function asegurarMeta() {
  const meta = (await leerConfig('meta')) || {
    clave: 'meta',
    creadoEn: new Date().toISOString(),
    ultimoRespaldo: null,
  };
  if (meta.versionApp !== APP_VERSION) {
    meta.versionApp = APP_VERSION;
    await guardarConfig(meta);
  }
  return meta;
}

export function nuevoId() {
  if (self.crypto?.randomUUID) return crypto.randomUUID();
  // randomUUID solo existe con https. Al probar por la red local (http) usamos esto.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
