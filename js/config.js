// Constantes de la app.
// Si cambias APP_VERSION, cambia también CACHE_VERSION en sw.js (deben ir juntas).
export const APP_VERSION = '1.1.0';

// Cuánto dura el botón "Deshacer" después de anotar, cambiar o borrar.
export const DESHACER_MS = 5000;

// Después de cuántos días sin respaldo mostramos el recordatorio.
export const DIAS_RECORDATORIO_RESPALDO = 14;

// Cuántas sugerencias ("chips") mostrar en "¿Qué fue?".
export const MAX_SUGERENCIAS = 8;

// Tope para el teclado de montos: 9 cifras ($999.999.999).
export const MAX_CIFRAS_MONTO = 9;

// Opciones de "¿Cuánto quieres ganar?". La frase explica el cálculo sin fórmulas.
export const GANANCIAS = [
  { etiqueta: 'Poco', porcentaje: 30, frase: 'Le sumamos un 30% para que ganes' },
  { etiqueta: 'Normal', porcentaje: 50, frase: 'Le sumamos la mitad (50%) para que ganes' },
  { etiqueta: 'Harto', porcentaje: 100, frase: 'Lo cobramos al doble (100%) para que ganes' },
];

// Textos legales y de privacidad: usar tal cual (CLAUDE.md §8).
export const TEXTOS = {
  legalCaja: 'Esta app te ayuda a llevar tus cuentas. No reemplaza boletas ni facturas.',
  privacidad:
    'Tus datos están solo en este celular. Nadie más los ve. Si borras los datos del navegador o cambias de celular, se pierden. Guarda tu respaldo.',
  tiempoVale: 'Si tu tiempo también vale, súmalo como un gasto.',
};
