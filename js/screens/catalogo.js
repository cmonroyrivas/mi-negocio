// Mi catálogo: productos con su precio (y foto si quiere), compartir el catálogo
// por WhatsApp y armar pedidos para enviarlos al cliente.
import { agregar, guardar, obtener, borrar, listar, leerConfig, nuevoId } from '../db.js';
import { pesos, numero, leerMonto, hoyISO, normalizarWhatsapp, whatsappParaMostrar } from '../format.js';
import { h, anexar, icono, ir, volver, aviso, confirmar, avisarCambio, encabezado } from '../ui.js';
import { abrirWhatsApp, compartirTexto } from '../whatsapp.js';
import { dibujarQREnCanvas } from '../qr.js';

const MAX_FOTO = 60 * 1024; // largo máximo de la foto guardada (dataURL), unos 60 KB

// ---- Mensajes (sin pantalla, para poder probarlos solos) ----

export function ordenarProductos(productos) {
  return productos.filter((p) => p.activo !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function mensajeCatalogo(perfil, productos) {
  const lineas = [`*${perfil?.nombreNegocio || 'Mi negocio'}*`, 'Estos son mis productos:', ''];
  for (const p of productos) lineas.push(`• ${p.nombre}: ${pesos(p.precio)}`);
  if (perfil?.whatsapp) lineas.push('', `Haz tu pedido por WhatsApp al +56 ${whatsappParaMostrar(perfil.whatsapp)}`);
  return lineas.join('\n');
}

// lineas: [{ producto, cantidad }]
export function totalPedido(lineas) {
  return lineas.reduce((suma, l) => suma + l.producto.precio * l.cantidad, 0);
}

export function mensajePedido(perfil, lineas) {
  const texto = [`*Pedido – ${perfil?.nombreNegocio || 'Mi negocio'}*`, ''];
  for (const { producto, cantidad } of lineas) {
    const detalle = cantidad > 1 ? ` (${pesos(producto.precio)} c/u)` : '';
    texto.push(`• ${cantidad} × ${producto.nombre}${detalle} = ${pesos(producto.precio * cantidad)}`);
  }
  texto.push('', `*Total: ${pesos(totalPedido(lineas))}*`, '', '¡Gracias por tu pedido!');
  return texto.join('\n');
}

// Texto para "¿Qué fue?" al anotar el pedido como venta (máximo 60 letras).
export function conceptoPedido(lineas) {
  const texto = 'Pedido: ' + lineas.map((l) => `${l.cantidad} ${l.producto.nombre}`).join(', ');
  return texto.length > 60 ? texto.slice(0, 59) + '…' : texto;
}

// ---- Foto: se achica en el mismo celular para que pese poco ----

async function cargarImagen(archivo) {
  if (self.createImageBitmap) {
    try {
      return await createImageBitmap(archivo);
    } catch {
      // algunos formatos no los acepta; probamos de la otra forma
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('no-es-imagen'));
    };
    imagen.src = url;
  });
}

export async function comprimirFoto(archivo) {
  const imagen = await cargarImagen(archivo);
  const ancho = imagen.naturalWidth || imagen.width;
  const alto = imagen.naturalHeight || imagen.height;
  try {
    for (const lado of [480, 360, 240]) {
      const escala = Math.min(1, lado / Math.max(ancho, alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(ancho * escala));
      lienzo.height = Math.max(1, Math.round(alto * escala));
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#ffffff'; // fondo blanco por si la imagen es transparente
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      for (const calidad of [0.8, 0.65, 0.5]) {
        const url = lienzo.toDataURL('image/jpeg', calidad);
        if (url.length <= MAX_FOTO) return url;
      }
    }
    throw new Error('foto-muy-grande');
  } finally {
    imagen.close?.();
  }
}

function miniatura(producto, clase = '') {
  return producto.foto
    ? h('img', { class: 'producto-foto ' + clase, src: producto.foto, alt: '' })
    : h('span', { class: 'producto-foto sin-foto ' + clase, 'aria-hidden': 'true' }, icono('catalogo'));
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

// ---- Lista del catálogo ----

export async function render(vista) {
  const [todos, perfil] = await Promise.all([listar('productos'), leerConfig('perfil')]);
  const productos = ordenarProductos(todos);
  vista.append(encabezado('Mi catálogo', { alVolver: () => volver('/') }));

  if (!productos.length) {
    anexar(
      vista,
      h(
        'div',
        { class: 'vacio vacio-grande' },
        icono('catalogo'),
        h('p', {}, 'Todavía no tienes productos.'),
        h('p', {}, 'Agrégalos aquí, o calcula un precio en ¿Cuánto cobro? y guárdalo en tu catálogo.'),
      ),
      h(
        'div',
        { class: 'pila-botones' },
        h('a', { href: '#/catalogo/nuevo', class: 'boton boton-principal boton-bloque' }, icono('mas'), 'Agregar producto'),
        h('a', { href: '#/precio', class: 'boton boton-secundario boton-bloque' }, icono('precio'), 'Ir a ¿Cuánto cobro?'),
        h('a', { href: '#/catalogo/qr', class: 'boton boton-secundario boton-bloque' }, icono('qr'), 'Mi código QR para clientes'),
      ),
    );
    return;
  }

  const compartir = async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    await compartirTexto(mensajeCatalogo(perfil, productos));
    boton.disabled = false;
  };

  anexar(
    vista,
    h(
      'div',
      { class: 'pila-botones pila-arriba' },
      h('a', { href: '#/catalogo/pedido', class: 'boton boton-principal boton-bloque boton-guardar' }, icono('mensaje'), 'Armar pedido'),
      h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: compartir }, icono('compartir'), 'Compartir mi catálogo'),
      h('a', { href: '#/catalogo/qr', class: 'boton boton-secundario boton-bloque' }, icono('qr'), 'Mi código QR para clientes'),
    ),
    h(
      'div',
      { class: 'titulo-con-accion' },
      h('h2', { class: 'seccion-titulo' }, `Mis productos (${productos.length})`),
      h('a', { href: '#/catalogo/nuevo', class: 'boton-texto' }, icono('mas'), 'Agregar'),
    ),
    h(
      'ul',
      { class: 'productos' },
      productos.map((p) =>
        h(
          'li',
          {},
          h(
            'a',
            { href: `#/catalogo/editar/${p.id}`, class: 'producto', 'aria-label': `${p.nombre}, ${pesos(p.precio)}. Tocar para cambiar o quitar.` },
            miniatura(p),
            h('span', { class: 'producto-nombre' }, p.nombre),
            h('span', { class: 'producto-precio numero' }, pesos(p.precio)),
          ),
        ),
      ),
    ),
    h('p', { class: 'pista' }, 'Toca un producto para cambiar su precio, su foto o quitarlo.'),
  );
}

// ---- Agregar o cambiar un producto ----

export async function renderProducto(vista, { id }) {
  const producto = id ? await obtener('productos', id) : null;
  if (id && !producto) {
    anexar(
      vista,
      encabezado('Mi catálogo', { alVolver: () => volver('/catalogo') }),
      h('p', { class: 'vacio' }, 'No encontramos ese producto. Puede que ya esté quitado.'),
      h('div', { class: 'pila-botones' }, h('a', { href: '#/catalogo', class: 'boton boton-secundario boton-bloque' }, 'Ir a Mi catálogo')),
    );
    return;
  }
  const todos = await listar('productos');
  let foto = producto?.foto ?? null;

  const entradaNombre = h('input', {
    class: 'entrada',
    id: 'producto-nombre',
    type: 'text',
    maxlength: '60',
    autocapitalize: 'sentences',
    autocomplete: 'off',
    enterkeyhint: 'next',
    placeholder: 'Ej: pan amasado',
    value: producto?.nombre ?? '',
  });
  const entradaPrecio = h('input', {
    class: 'entrada numero',
    id: 'producto-precio',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    enterkeyhint: 'done',
    placeholder: '0',
    value: producto?.precio ? numero(producto.precio) : '',
  });
  const error = mensajeError();

  // Si el precio viene de ¿Cuánto cobro?, mostramos cuánto gana con el precio escrito.
  const infoGanancia = h('p', { class: 'vista-previa', 'aria-live': 'polite' });
  function pintarGanancia() {
    const costo = producto?.costoUnitario;
    infoGanancia.hidden = !costo;
    if (!costo) return;
    const ganancia = leerMonto(entradaPrecio.value) - costo;
    infoGanancia.className = 'vista-previa ' + (ganancia > 0 ? 'gana' : 'pierde');
    infoGanancia.textContent =
      `Te cuesta ${pesos(costo)}. ` +
      (ganancia > 0 ? `Ganas ${pesos(ganancia)} por cada una.` : ganancia === 0 ? 'No ganas nada.' : `Pierdes ${pesos(-ganancia)} por cada una.`);
  }
  entradaPrecio.addEventListener('input', () => {
    const precio = Math.min(leerMonto(entradaPrecio.value), 999999999);
    entradaPrecio.value = precio ? numero(precio) : '';
    error.replaceChildren();
    pintarGanancia();
  });
  pintarGanancia();

  // -- Foto --
  const zonaFoto = h('div', { class: 'zona-foto' });
  const entradaFoto = h('input', { type: 'file', accept: 'image/*', hidden: true });
  const elegirFoto = () => entradaFoto.click();

  function pintarFoto(estado) {
    if (estado === 'cargando') {
      zonaFoto.replaceChildren(h('p', { class: 'foto-cargando', role: 'status' }, icono('foto'), 'Preparando la foto…'));
      return;
    }
    if (foto) {
      zonaFoto.replaceChildren(
        h('img', { class: 'foto-grande', src: foto, alt: 'Foto del producto' }),
        h(
          'div',
          { class: 'foto-botones' },
          h('button', { type: 'button', class: 'boton boton-secundario', onclick: elegirFoto }, icono('foto'), 'Cambiar foto'),
          h(
            'button',
            {
              type: 'button',
              class: 'boton-texto',
              onclick: () => {
                foto = null;
                pintarFoto();
              },
            },
            icono('cerrar'),
            'Quitar foto',
          ),
        ),
      );
    } else {
      zonaFoto.replaceChildren(
        h(
          'button',
          { type: 'button', class: 'agregar-foto', onclick: elegirFoto },
          icono('foto'),
          h('span', {}, 'Agregar foto ', h('span', { class: 'campo-opcional' }, '(si quieres)')),
        ),
      );
    }
  }
  entradaFoto.addEventListener('change', async () => {
    const archivo = entradaFoto.files?.[0];
    entradaFoto.value = '';
    if (!archivo) return;
    pintarFoto('cargando');
    try {
      foto = await comprimirFoto(archivo);
      error.replaceChildren();
    } catch (e) {
      console.warn(e);
      mostrarError(error, 'No pudimos usar esa foto. Prueba con otra.');
    }
    pintarFoto();
  });
  pintarFoto();

  // -- Guardar y quitar --
  let guardando = false;
  const guardarProducto = async (e) => {
    e.preventDefault();
    if (guardando) return;
    const nombre = entradaNombre.value.trim();
    const precio = leerMonto(entradaPrecio.value);
    if (!nombre) return mostrarError(error, 'Escribe el nombre del producto.', entradaNombre);
    if (!(precio > 0)) return mostrarError(error, 'Pon un precio mayor a $0.', entradaPrecio);
    const repetido = todos.find((p) => p.id !== producto?.id && p.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (repetido) return mostrarError(error, `Ya tienes “${repetido.nombre}” en tu catálogo. Usa otro nombre o cambia ese.`, entradaNombre);

    guardando = true;
    if (producto) {
      const anterior = { ...producto };
      await guardar('productos', { ...producto, nombre, precio, foto, activo: true });
      aviso('Cambio guardado ✔', {
        deshacer: async () => {
          await guardar('productos', anterior);
          avisarCambio();
          aviso('Listo, quedó como antes.');
        },
      });
    } else {
      const nuevo = { id: nuevoId(), nombre, precio, foto, costoUnitario: null, activo: true };
      await agregar('productos', nuevo);
      aviso('Producto agregado ✔', {
        deshacer: async () => {
          await borrar('productos', nuevo.id);
          avisarCambio();
          aviso('Listo, lo quité.');
        },
      });
    }
    volver('/catalogo');
  };

  const quitarProducto = async () => {
    const ok = await confirmar({
      titulo: `¿Quitar “${producto.nombre}” de tu catálogo?`,
      texto: 'Lo que ya anotaste como venta no se borra.',
      si: 'Sí, quitar',
      no: 'No, dejarlo',
      peligro: true,
    });
    if (!ok) return;
    await borrar('productos', producto.id);
    aviso('Producto quitado', {
      deshacer: async () => {
        await guardar('productos', producto);
        avisarCambio();
        aviso('Listo, lo recuperé.');
      },
    });
    volver('/catalogo');
  };

  anexar(
    vista,
    encabezado(producto ? 'Cambiar producto' : 'Nuevo producto', { alVolver: () => volver('/catalogo') }),
    h(
      'form',
      { novalidate: true, onsubmit: guardarProducto },
      zonaFoto,
      entradaFoto,
      h('div', { class: 'campo' }, h('label', { class: 'campo-etiqueta', for: 'producto-nombre' }, '¿Cómo se llama?'), entradaNombre),
      h(
        'div',
        { class: 'campo' },
        h('label', { class: 'campo-etiqueta', for: 'producto-precio' }, '¿A cuánto lo vendes?'),
        h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '$'), entradaPrecio),
        infoGanancia,
      ),
      error,
      h(
        'div',
        { class: 'pila-botones' },
        h('button', { type: 'submit', class: 'boton boton-principal boton-bloque boton-guardar' }, icono('check'), 'Guardar'),
        producto &&
          h('button', { type: 'button', class: 'boton boton-peligro-suave boton-bloque', onclick: quitarProducto }, icono('basura'), 'Quitar del catálogo'),
      ),
    ),
  );
}

// ---- Código QR para clientes: abre el WhatsApp del negocio con un saludo ----

export function enlaceWhatsappNegocio(whatsapp) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent('Hola, quiero hacer un pedido')}`;
}

// Corta un texto en líneas que quepan en `ancho` (para el cartel).
function envolver(ctx, texto, ancho) {
  const lineas = [];
  let actual = '';
  for (const palabra of texto.split(/\s+/)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && ctx.measureText(prueba).width > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const FUENTE_CARTEL = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// Cartel de 1080 x 1440 (para imprimir o subir al estado): nombre, QR, "Escanea y pídeme por WhatsApp" y número.
export async function crearCartel(perfil, enlace) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 1080;
  lienzo.height = 1440;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fbf6ec';
  ctx.fillRect(0, 0, 1080, 1440);
  ctx.strokeStyle = '#231c14';
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, 1020, 1380);

  // Nombre del negocio: hasta 2 líneas, achicando la letra si hace falta.
  ctx.fillStyle = '#231c14';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nombre = perfil.nombreNegocio || 'Mi negocio';
  let tamano = 76;
  let lineas;
  for (; tamano >= 44; tamano -= 8) {
    ctx.font = `800 ${tamano}px ${FUENTE_CARTEL}`;
    lineas = envolver(ctx, nombre, 900);
    if (lineas.length <= 2) break;
  }
  lineas = lineas.slice(0, 2);
  const altoLinea = tamano * 1.15;
  const inicioNombre = lineas.length === 1 ? 210 : 175;
  lineas.forEach((linea, i) => ctx.fillText(linea, 540, inicioNombre + i * altoLinea));

  // QR con marco
  ctx.fillStyle = '#231c14';
  ctx.fillRect(162, 312, 756, 756);
  dibujarQREnCanvas(ctx, enlace, 170, 320, 740);

  ctx.fillStyle = '#231c14';
  ctx.font = `800 64px ${FUENTE_CARTEL}`;
  ctx.fillText('Escanea y pídeme', 540, 1160);
  ctx.fillStyle = '#1d6a40';
  ctx.fillText('por WhatsApp', 540, 1236);
  ctx.fillStyle = '#574b3f';
  ctx.font = `600 52px ${FUENTE_CARTEL}`;
  ctx.fillText(`+56 ${whatsappParaMostrar(perfil.whatsapp)}`, 540, 1320);
  ctx.font = `400 30px ${FUENTE_CARTEL}`;
  ctx.fillText('Hecho con la app Mi Negocio', 540, 1385);

  return new Promise((resolve) => lienzo.toBlob(resolve, 'image/png'));
}

function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = h('a', { href: url, download: nombre });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function renderQR(vista) {
  const perfil = await leerConfig('perfil');
  vista.append(encabezado('Mi código QR', { alVolver: () => volver('/catalogo') }));

  if (!perfil?.whatsapp) {
    anexar(
      vista,
      h('p', { class: 'vacio' }, 'Para crear tu código, primero anota el WhatsApp de tu negocio en Ajustes.'),
      h('div', { class: 'pila-botones' }, h('a', { href: '#/ajustes', class: 'boton boton-principal boton-bloque' }, icono('ajustes'), 'Ir a Ajustes')),
    );
    return;
  }

  const blob = await crearCartel(perfil, enlaceWhatsappNegocio(perfil.whatsapp));
  const urlImagen = URL.createObjectURL(blob);
  const archivo = new File([blob], 'mi-codigo-qr.png', { type: 'image/png' });
  const sePuedeCompartir = navigator.canShare?.({ files: [archivo] });

  const compartir = async (e) => {
    const boton = e.currentTarget;
    boton.disabled = true;
    try {
      await navigator.share({ files: [archivo], title: 'Mi código QR' });
    } catch (error) {
      if (error.name !== 'AbortError') descargarArchivo(blob, archivo.name);
    }
    boton.disabled = false;
  };
  const guardarImagen = () => {
    descargarArchivo(blob, archivo.name);
    aviso('Imagen guardada en Descargas ✔');
  };

  anexar(
    vista,
    h(
      'p',
      { class: 'pregunta-ayuda' },
      'Imprímelo y pégalo en tu local, o súbelo a tu estado de WhatsApp. Quien lo escanee con la cámara del celular te escribe directo a tu WhatsApp.',
    ),
    h('img', { class: 'cartel-qr', src: urlImagen, alt: `Cartel con código QR para escribirle por WhatsApp a ${perfil.nombreNegocio || 'tu negocio'}` }),
    h(
      'div',
      { class: 'pila-botones' },
      sePuedeCompartir &&
        h('button', { type: 'button', class: 'boton boton-principal boton-bloque boton-guardar', onclick: compartir }, icono('compartir'), 'Compartir imagen'),
      h(
        'button',
        { type: 'button', class: 'boton boton-bloque ' + (sePuedeCompartir ? 'boton-secundario' : 'boton-principal boton-guardar'), onclick: guardarImagen },
        icono('descargar'),
        'Guardar en este celular',
      ),
    ),
    h('p', { class: 'pista' }, 'El código abre tu WhatsApp con el mensaje "Hola, quiero hacer un pedido". Si cambias tu número en Ajustes, vuelve a crear el cartel.'),
  );

  return () => URL.revokeObjectURL(urlImagen);
}

// ---- Armar pedido ----

// El pedido en curso se mantiene mientras la app está abierta (por si sale a mirar algo).
function nuevoPedido() {
  return { cantidades: {}, cliente: '', anotadoId: null };
}
let pedido = nuevoPedido();

const puedeElegirContacto = () => 'contacts' in navigator && typeof navigator.contacts?.select === 'function';

export async function renderPedido(vista) {
  const [todos, perfil] = await Promise.all([listar('productos'), leerConfig('perfil')]);
  const productos = ordenarProductos(todos);
  vista.append(encabezado('Armar pedido', { alVolver: () => volver('/catalogo') }));

  if (!productos.length) {
    anexar(
      vista,
      h('p', { class: 'vacio' }, 'Para armar un pedido, primero agrega productos a tu catálogo.'),
      h('div', { class: 'pila-botones' }, h('a', { href: '#/catalogo/nuevo', class: 'boton boton-principal boton-bloque' }, icono('mas'), 'Agregar producto')),
    );
    return;
  }

  const lineasDelPedido = () =>
    productos.filter((p) => (pedido.cantidades[p.id] || 0) > 0).map((p) => ({ producto: p, cantidad: pedido.cantidades[p.id] }));

  const total = h('strong', { class: 'pedido-total-monto numero' });
  const cuantos = h('span', { class: 'pedido-total-cuantos' });
  const error = mensajeError();

  function pintarTotal() {
    const lineas = lineasDelPedido();
    total.textContent = pesos(totalPedido(lineas));
    const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
    cuantos.textContent = unidades ? `${unidades} ${unidades === 1 ? 'producto' : 'productos'}` : 'Elige cuántos de cada uno';
    if (unidades) error.replaceChildren();
  }

  // -- Una fila por producto, con − cantidad + --
  const filas = productos.map((p) => {
    const entrada = h('input', {
      class: 'entrada numero pedido-numero',
      id: `cantidad-${p.id}`,
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      'aria-label': `Cantidad de ${p.nombre}`,
    });
    const subtotal = h('span', { class: 'pedido-subtotal numero' });
    const menos = h('button', { type: 'button', class: 'contador-boton', 'aria-label': `Uno menos de ${p.nombre}`, onclick: () => poner(cantidad() - 1) }, icono('menos'));
    const mas = h('button', { type: 'button', class: 'contador-boton', 'aria-label': `Uno más de ${p.nombre}`, onclick: () => poner(cantidad() + 1) }, icono('mas'));
    const fila = h(
      'li',
      { class: 'pedido-fila' },
      miniatura(p, 'producto-foto-chica'),
      h('div', { class: 'pedido-info' }, h('span', { class: 'producto-nombre' }, p.nombre), h('span', { class: 'pedido-precio' }, `${pesos(p.precio)} cada una`)),
      h('div', { class: 'pedido-cantidad' }, menos, entrada, mas),
      subtotal,
    );
    const cantidad = () => pedido.cantidades[p.id] || 0;
    function poner(n, { escribiendo = false } = {}) {
      const valor = Math.max(0, Math.min(999, n));
      if (valor !== cantidad()) {
        pedido.anotadoId = null; // si cambia el pedido, se puede anotar de nuevo
        pintarAnotar();
      }
      pedido.cantidades[p.id] = valor;
      if (!escribiendo) entrada.value = String(valor);
      menos.disabled = valor <= 0;
      subtotal.textContent = valor ? pesos(valor * p.precio) : '';
      fila.classList.toggle('con-cantidad', valor > 0);
      pintarTotal();
    }
    entrada.addEventListener('input', () => {
      const n = leerMonto(entrada.value);
      entrada.value = entrada.value.replace(/\D/g, '').slice(0, 3);
      poner(n, { escribiendo: true });
    });
    entrada.addEventListener('focus', () => entrada.select());
    entrada.addEventListener('blur', () => (entrada.value = String(cantidad())));
    fila.poner = poner;
    return fila;
  });

  // -- WhatsApp del cliente (opcional) --
  const entradaCliente = h('input', {
    class: 'entrada',
    id: 'pedido-cliente',
    type: 'tel',
    inputmode: 'tel',
    autocomplete: 'off',
    maxlength: '16',
    placeholder: '9 1234 5678',
    value: pedido.cliente,
  });
  entradaCliente.addEventListener('input', () => {
    pedido.cliente = entradaCliente.value;
    entradaCliente.removeAttribute('aria-invalid');
    error.replaceChildren();
  });

  const elegirContacto = async () => {
    try {
      const [contacto] = await navigator.contacts.select(['tel'], { multiple: false });
      const telefono = contacto?.tel?.find((t) => normalizarWhatsapp(t));
      if (!contacto) return;
      if (!telefono) return mostrarError(error, 'Ese contacto no tiene un celular chileno. Escríbelo a mano.', entradaCliente);
      entradaCliente.value = whatsappParaMostrar(normalizarWhatsapp(telefono));
      pedido.cliente = entradaCliente.value;
      error.replaceChildren();
    } catch (e) {
      console.warn(e);
    }
  };

  // -- Enviar, anotar y empezar de nuevo --
  const notaDespues = h('p', { class: 'nota nota-suave', hidden: true }, icono('caja'), '¿Ya te pagaron? Anótalo como venta para que quede en Mi caja.');

  const enviar = () => {
    const lineas = lineasDelPedido();
    if (!lineas.length) return mostrarError(error, 'Agrega al menos un producto con el botón +.');
    const numeroCliente = normalizarWhatsapp(entradaCliente.value);
    if (numeroCliente === null) {
      return mostrarError(error, 'Revisa el WhatsApp del cliente: son 9 números y empieza con 9. También puedes dejarlo en blanco.', entradaCliente);
    }
    abrirWhatsApp(mensajePedido(perfil, lineas), numeroCliente);
    if (!pedido.anotadoId) notaDespues.hidden = false;
  };

  const botonAnotar = h('button', { type: 'button', class: 'boton boton-secundario boton-bloque', onclick: () => anotar() });
  function pintarAnotar() {
    const hecho = !!pedido.anotadoId;
    botonAnotar.disabled = hecho;
    botonAnotar.classList.toggle('boton-hecho', hecho);
    botonAnotar.replaceChildren(icono(hecho ? 'check' : 'caja'), hecho ? 'Anotado en Mi caja' : 'Anotar como venta');
    if (hecho) notaDespues.hidden = true;
  }

  async function anotar() {
    const lineas = lineasDelPedido();
    if (!lineas.length) return mostrarError(error, 'Agrega al menos un producto con el botón +.');
    const venta = {
      id: nuevoId(),
      fecha: hoyISO(),
      monto: totalPedido(lineas),
      concepto: conceptoPedido(lineas),
      productoId: lineas.length === 1 ? lineas[0].producto.id : null,
      creadoEn: new Date().toISOString(),
    };
    botonAnotar.disabled = true;
    await agregar('ventas', venta);
    pedido.anotadoId = venta.id;
    pintarAnotar();
    aviso(`Anotado ✔ Vendí ${pesos(venta.monto)}`, {
      deshacer: async () => {
        await borrar('ventas', venta.id);
        if (pedido.anotadoId === venta.id) pedido.anotadoId = null;
        if (botonAnotar.isConnected) pintarAnotar();
        avisarCambio();
        aviso('Listo, lo quité de Mi caja.');
      },
    });
  }

  const empezarDeNuevo = () => {
    const anterior = pedido;
    pedido = nuevoPedido();
    ir('/catalogo/pedido', { reemplazar: true });
    aviso('Pedido vacío', {
      deshacer: () => {
        pedido = anterior;
        ir('/catalogo/pedido', { reemplazar: true });
      },
    });
  };

  anexar(
    vista,
    h('p', { class: 'pregunta-ayuda' }, 'Toca + para sumar productos al pedido.'),
    h('ul', { class: 'pedido-lista' }, filas),
    h(
      'div',
      { class: 'campo' },
      h('label', { class: 'campo-etiqueta', for: 'pedido-cliente' }, 'WhatsApp del cliente ', h('span', { class: 'campo-opcional' }, '(si quieres)')),
      h('div', { class: 'con-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, '+56'), entradaCliente),
      puedeElegirContacto() &&
        h('button', { type: 'button', class: 'boton boton-secundario', onclick: elegirContacto }, icono('contacto'), 'Elegir de mis contactos'),
      h('p', { class: 'campo-ayuda' }, 'Si lo dejas en blanco, WhatsApp te pregunta a quién mandarlo.'),
    ),
    error,
    h(
      'div',
      { class: 'acciones-fijas pedido-pie' },
      h('p', { class: 'pedido-total' }, h('span', {}, 'Total ', cuantos), total),
      h('button', { type: 'button', class: 'boton boton-principal boton-bloque boton-guardar', onclick: enviar }, icono('mensaje'), 'Enviar por WhatsApp'),
    ),
    notaDespues,
    h('div', { class: 'pila-botones' }, botonAnotar, h('button', { type: 'button', class: 'boton-texto', onclick: empezarDeNuevo }, icono('cerrar'), 'Empezar pedido nuevo')),
    h('p', { class: 'pie-legal' }, icono('info'), 'El mensaje es el detalle del pedido. No reemplaza una boleta.'),
  );

  filas.forEach((fila, i) => fila.poner(pedido.cantidades[productos[i].id] || 0));
  pintarAnotar();
}
