// Generador de códigos QR propio, sin librerías (modo byte, corrección de errores nivel M).
// Sigue la norma ISO/IEC 18004. Basado en el algoritmo conocido de Project Nayuki (licencia MIT).
// Uso: const matriz = crearQR('https://...'); // matriz[y][x] = true si el cuadrito es negro

// Nivel M: recupera hasta ~15% del código dañado (suficiente para un papel pegado en el local).
const NIVEL_M = 1; // índice en las tablas (L=0, M=1, Q=2, H=3)
const BITS_FORMATO_M = 0;

// Por versión (1 a 40): códigos de corrección por bloque y cantidad de bloques, nivel M.
const ECC_POR_BLOQUE = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const BLOQUES = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

function modulosDeDatos(version) {
  let total = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alineaciones = Math.floor(version / 7) + 2;
    total -= (25 * alineaciones - 10) * alineaciones - 55;
    if (version >= 7) total -= 36;
  }
  return total;
}

const palabrasDeDatos = (version) => Math.floor(modulosDeDatos(version) / 8) - ECC_POR_BLOQUE[version] * BLOQUES[version];

// ---- Reed-Solomon en GF(2^8) ----
function multiplicar(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function divisorRS(grado) {
  const resultado = new Array(grado).fill(0);
  resultado[grado - 1] = 1;
  let raiz = 1;
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < resultado.length; j++) {
      resultado[j] = multiplicar(resultado[j], raiz);
      if (j + 1 < resultado.length) resultado[j] ^= resultado[j + 1];
    }
    raiz = multiplicar(raiz, 0x02);
  }
  return resultado;
}

function restoRS(datos, divisor) {
  const resultado = new Array(divisor.length).fill(0);
  for (const b of datos) {
    const factor = b ^ resultado.shift();
    resultado.push(0);
    divisor.forEach((coef, i) => (resultado[i] ^= multiplicar(coef, factor)));
  }
  return resultado;
}

// Divide los datos en bloques, agrega la corrección de errores e intercala.
function agregarCorreccion(datos, version) {
  const cantidadBloques = BLOQUES[version];
  const largoEcc = ECC_POR_BLOQUE[version];
  const palabrasTotales = Math.floor(modulosDeDatos(version) / 8);
  const bloquesCortos = cantidadBloques - (palabrasTotales % cantidadBloques);
  const largoCorto = Math.floor(palabrasTotales / cantidadBloques);
  const divisor = divisorRS(largoEcc);
  const bloques = [];
  for (let i = 0, k = 0; i < cantidadBloques; i++) {
    const dat = datos.slice(k, k + largoCorto - largoEcc + (i < bloquesCortos ? 0 : 1));
    k += dat.length;
    const ecc = restoRS(dat, divisor);
    if (i < bloquesCortos) dat.push(0);
    bloques.push(dat.concat(ecc));
  }
  const resultado = [];
  for (let i = 0; i < bloques[0].length; i++) {
    bloques.forEach((bloque, j) => {
      if (i !== largoCorto - largoEcc || j >= bloquesCortos) resultado.push(bloque[i]);
    });
  }
  return resultado;
}

// ---- Dibujo de la matriz ----
function posicionesAlineacion(version) {
  if (version === 1) return [];
  const cantidad = Math.floor(version / 7) + 2;
  const paso = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (cantidad * 2 - 2)) * 2;
  const resultado = [6];
  for (let pos = version * 4 + 17 - 7; resultado.length < cantidad; pos -= paso) resultado.splice(1, 0, pos);
  return resultado;
}

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function crearMatriz(version) {
  const tam = version * 4 + 17;
  const negro = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const fijo = Array.from({ length: tam }, () => new Array(tam).fill(false));
  const poner = (x, y, valor) => {
    negro[y][x] = valor;
    fijo[y][x] = true;
  };
  return { tam, negro, fijo, poner };
}

function dibujarFormato(m, mascara) {
  const datos = (BITS_FORMATO_M << 3) | mascara;
  let resto = datos;
  for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
  const bits = ((datos << 10) | resto) ^ 0x5412;
  for (let i = 0; i <= 5; i++) m.poner(8, i, bit(bits, i));
  m.poner(8, 7, bit(bits, 6));
  m.poner(8, 8, bit(bits, 7));
  m.poner(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) m.poner(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) m.poner(m.tam - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) m.poner(8, m.tam - 15 + i, bit(bits, i));
  m.poner(8, m.tam - 8, true); // módulo siempre negro
}

function dibujarPatrones(m, version) {
  const { tam } = m;
  for (let i = 0; i < tam; i++) {
    m.poner(6, i, i % 2 === 0);
    m.poner(i, 6, i % 2 === 0);
  }
  // Los tres cuadrados grandes de las esquinas
  for (const [cx, cy] of [[3, 3], [tam - 4, 3], [3, tam - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        const distancia = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < tam && y >= 0 && y < tam) m.poner(x, y, distancia !== 2 && distancia !== 4);
      }
    }
  }
  // Cuadrados chicos de alineación
  const pos = posicionesAlineacion(version);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) m.poner(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  dibujarFormato(m, 0); // se reemplaza después con la máscara elegida
  if (version >= 7) {
    let resto = version;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
    const bits = (version << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const a = tam - 11 + (i % 3);
      const b = Math.floor(i / 3);
      m.poner(a, b, bit(bits, i));
      m.poner(b, a, bit(bits, i));
    }
  }
}

function dibujarDatos(m, palabras) {
  let i = 0;
  for (let derecha = m.tam - 1; derecha >= 1; derecha -= 2) {
    if (derecha === 6) derecha = 5;
    for (let vert = 0; vert < m.tam; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = derecha - j;
        const subiendo = ((derecha + 1) & 2) === 0;
        const y = subiendo ? m.tam - 1 - vert : vert;
        if (!m.fijo[y][x] && i < palabras.length * 8) {
          m.negro[y][x] = bit(palabras[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASCARAS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function aplicarMascara(m, mascara) {
  for (let y = 0; y < m.tam; y++) {
    for (let x = 0; x < m.tam; x++) if (!m.fijo[y][x] && MASCARAS[mascara](x, y)) m.negro[y][x] = !m.negro[y][x];
  }
}

// Puntaje de "qué tan difícil de leer" (más bajo es mejor). Reglas de la norma, en versión simple.
function penalizacion(m) {
  const { tam, negro } = m;
  let puntos = 0;
  const lineas = [];
  for (let i = 0; i < tam; i++) {
    lineas.push(negro[i]);
    lineas.push(negro.map((fila) => fila[i]));
  }
  const parecidoAEsquina = [true, false, true, true, true, false, true];
  for (const linea of lineas) {
    // Corridas de 5 o más del mismo color
    let corrida = 1;
    for (let i = 1; i <= tam; i++) {
      if (i < tam && linea[i] === linea[i - 1]) corrida++;
      else {
        if (corrida >= 5) puntos += 3 + (corrida - 5);
        corrida = 1;
      }
    }
    // Patrones que parecen las esquinas (1:1:3:1:1) con 4 blancos a un lado
    for (let i = 0; i + 7 <= tam; i++) {
      if (!parecidoAEsquina.every((v, k) => linea[i + k] === v)) continue;
      const blancoAntes = [1, 2, 3, 4].every((k) => i - k < 0 || !linea[i - k]);
      const blancoDespues = [1, 2, 3, 4].every((k) => i + 6 + k >= tam || !linea[i + 6 + k]);
      if (blancoAntes || blancoDespues) puntos += 40;
    }
  }
  // Cuadrados de 2x2 del mismo color
  for (let y = 0; y < tam - 1; y++) {
    for (let x = 0; x < tam - 1; x++) {
      const c = negro[y][x];
      if (c === negro[y][x + 1] && c === negro[y + 1][x] && c === negro[y + 1][x + 1]) puntos += 3;
    }
  }
  // Equilibrio entre negro y blanco
  const negros = negro.reduce((s, fila) => s + fila.filter(Boolean).length, 0);
  const total = tam * tam;
  puntos += (Math.ceil(Math.abs(negros * 20 - total * 10) / total) - 1) * 10;
  return puntos;
}

// ---- Uso principal ----
export function crearQR(texto) {
  const bytes = Array.from(new TextEncoder().encode(texto));
  let version = 1;
  for (; version <= 40; version++) {
    const bitsCuenta = version <= 9 ? 8 : 16;
    if (4 + bitsCuenta + bytes.length * 8 <= palabrasDeDatos(version) * 8) break;
  }
  if (version > 40) throw new Error('texto-muy-largo-para-qr');

  // Bits: modo byte (0100), largo y datos
  const bits = [];
  const agregar = (valor, largo) => {
    for (let i = largo - 1; i >= 0; i--) bits.push((valor >>> i) & 1);
  };
  agregar(0b0100, 4);
  agregar(bytes.length, version <= 9 ? 8 : 16);
  bytes.forEach((b) => agregar(b, 8));
  const capacidad = palabrasDeDatos(version) * 8;
  agregar(0, Math.min(4, capacidad - bits.length));
  agregar(0, (8 - (bits.length % 8)) % 8);
  for (let relleno = 0xec; bits.length < capacidad; relleno ^= 0xec ^ 0x11) agregar(relleno, 8);
  const palabras = [];
  for (let i = 0; i < bits.length; i += 8) palabras.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const m = crearMatriz(version);
  dibujarPatrones(m, version);
  dibujarDatos(m, agregarCorreccion(palabras, version));

  let mejor = 0;
  let menorPuntaje = Infinity;
  for (let mascara = 0; mascara < 8; mascara++) {
    aplicarMascara(m, mascara);
    dibujarFormato(m, mascara);
    const puntaje = penalizacion(m);
    if (puntaje < menorPuntaje) {
      menorPuntaje = puntaje;
      mejor = mascara;
    }
    aplicarMascara(m, mascara); // deshacer
  }
  aplicarMascara(m, mejor);
  dibujarFormato(m, mejor);
  return m.negro;
}

// SVG listo para mostrar (con el margen blanco de 4 cuadritos que exige la norma).
export function qrSVG(texto, { titulo = 'Código QR' } = {}) {
  const matriz = crearQR(texto);
  const tam = matriz.length + 8;
  let camino = '';
  matriz.forEach((fila, y) => fila.forEach((negro, x) => negro && (camino += `M${x + 4},${y + 4}h1v1h-1z`)));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${tam} ${tam}`);
  svg.setAttribute('class', 'qr');
  svg.setAttribute('role', 'img');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = titulo;
  const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  fondo.setAttribute('width', tam);
  fondo.setAttribute('height', tam);
  fondo.setAttribute('fill', '#fff');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', camino);
  p.setAttribute('fill', '#000');
  svg.append(t, fondo, p);
  return svg;
}

// Dibuja el QR en un canvas, en la posición y tamaño dados (incluye margen blanco).
export function dibujarQREnCanvas(ctx, texto, x, y, lado) {
  const matriz = crearQR(texto);
  const celdas = matriz.length + 8;
  const celda = Math.floor(lado / celdas);
  const inicio = Math.round((lado - celda * celdas) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = '#000';
  matriz.forEach((fila, fy) =>
    fila.forEach((negro, fx) => negro && ctx.fillRect(x + inicio + (fx + 4) * celda, y + inicio + (fy + 4) * celda, celda, celda)),
  );
}
