# Pruebas manuales (smoke) — Mi Negocio

Hacer estas pruebas en un celular Android con Chrome (o en el computador con la
ventana angosta, 360 px). Marcar con `x` lo que funciona. Si algo falla, anotar
qué se hizo y qué pasó.

> Para empezar de cero: Ajustes → Borrar todo.

## 0. Primera vez (bienvenida)

- [ ] Al abrir por primera vez aparece "¡Hola!" con dos preguntas: nombre del negocio y WhatsApp.
- [ ] Escribir un WhatsApp malo (ej. `4321`) y tocar **Empezar** → aparece un mensaje amable en rojo, no avanza.
- [ ] Dejar el WhatsApp en blanco → se puede empezar igual.
- [ ] Con `9 1234 5678` → avanza al inicio.
- [ ] El nombre del negocio aparece arriba en el inicio.

## 1. Inicio

- [ ] Arriba dice "Hoy te quedó" y un monto con formato `$12.000`.
- [ ] Sin movimientos dice "Todavía no anotas nada hoy."
- [ ] Hay dos tarjetas grandes: **Mi caja** y **¿Cuánto cobro?**, y un enlace chico **Ajustes**.
- [ ] Con ventas y gastos de hoy, muestra "Vendiste $X · Gastaste $Y" y el saldo correcto.
- [ ] Si se gastó más de lo vendido, el monto sale negativo (`-$5.000`).
- [ ] Debajo aparece "En [mes] te quedó $X" con lo vendido y gastado desde el día 1 del mes hasta hoy
      (incluye días anteriores; no aparece si en el mes no hay nada anotado).

## 2. Mi caja

- [ ] Arriba dice **Hoy** y la fecha. La flecha ▶ está apagada (no se puede ir al futuro).
- [ ] Botones grandes **VENDÍ** (verde) y **GASTÉ** (naranjo).
- [ ] Al pie: "Esta app te ayuda a llevar tus cuentas. No reemplaza boletas ni facturas."

### Anotar
- [ ] Tocar **VENDÍ** → pantalla verde "Vendí" con teclado grande.
- [ ] Tocar **Guardar** sin monto → mensaje "Pon un monto mayor a $0…" dentro del recuadro, y el teclado **no se mueve**.
- [ ] Teclear `1`, `2`, `000` → muestra `$12.000`. La tecla ⌫ borra el último número; la ✕ borra todo.
- [ ] "¿Qué fue?" es opcional. Escribir "Pan amasado" y **Guardar**.
- [ ] Vuelve a Mi caja, aparece "Anotado ✔ Vendí $12.000" con **Deshacer** y una barrita que se acaba en 5 segundos.
- [ ] La línea aparece arriba en la lista con `+$12.000` y la hora.
- [ ] El resumen dice Entró `$12.000`, Salió `$0`, Me quedó `$12.000`.
- [ ] Anotar un **GASTÉ** de `$8.500` → Me quedó `$3.500`.
- [ ] Tocar **Deshacer** antes de 5 segundos → el gasto desaparece y el resumen vuelve atrás.
- [ ] La próxima vez que se toca VENDÍ, "Pan amasado" aparece como sugerencia (botón redondo). Al tocarla se escribe sola.
- [ ] Tocar Guardar dos veces muy rápido **no** anota dos veces.

### Cambiar y borrar
- [ ] Tocar una línea → pantalla "Cambiar venta" con el monto y el texto ya puestos.
- [ ] Cambiar el monto y **Guardar cambio** → la lista y el resumen se actualizan. **Deshacer** lo deja como antes.
- [ ] **Borrar esta línea** → pregunta "¿Borrar esta línea?". "No, dejarla" no borra nada.
- [ ] "Sí, borrar" → desaparece; **Deshacer** la recupera.

### Otros días
- [ ] Tocar ◀ → dice **Ayer** y aparece el aviso "Estás mirando otro día…".
- [ ] Anotar algo estando en ayer → la pantalla de anotar dice "Se anota en: Ayer" y queda en ese día.
- [ ] El inicio sigue mostrando solo lo de hoy.
- [ ] **Volver a hoy** regresa a hoy.

### Botón atrás del celular
- [ ] Desde "Vendí", el botón atrás del celular vuelve a Mi caja (no cierra la app).
- [ ] Después de guardar, el botón atrás desde Mi caja va al inicio (no vuelve a abrir "Vendí").

## 3. ¿Cuánto cobro?

- [ ] Una pregunta por pantalla, con "Paso N de 4" arriba.
- [ ] Paso 1 vacío y **Siguiente** → "Escribe qué vas a vender…".
- [ ] Paso 2: **Agregar otra cosa** suma una tarjeta; **Quitar** la saca. El total se actualiza al escribir.
- [ ] Paso 2: una cosa con nombre pero sin monto → "Falta cuánto gastas en “…”".
- [ ] Paso 2: **Sumar mi tiempo** agrega "Mi tiempo" y deja el cursor en el monto.
- [ ] Paso 3: botones − y + cambian el número; con 0 o vacío → "Pon cuántas te salen. Tiene que ser 1 o más."
- [ ] Paso 4: Poco / Normal / Harto muestran cuánto cobras y cuánto ganas en pesos por cada una.
- [ ] Paso 4: **Pongo yo el precio** abre un campo. Al escribir dice "Ganas $X por cada una" (verde)
      o "Pierdes $X por cada una" (rojo). Vacío y **Ver resultado** → "Escribe cuánto quieres cobrar…".
- [ ] Precio propio $1.500 (con harina $8.500 + gas $3.000, 10 unidades) → Cobra $1.500, ganas $350; "Si vendes las 10, ganas $3.500".
- [ ] Precio propio $1.000 en el mismo caso → "Pierdes $150", aviso rojo "Para no perder, cobra al menos $1.150", "Si vendes las 10, pierdes $1.500".
- [ ] Volver atrás desde el resultado deja el precio propio escrito; elegir **Normal** después vuelve a $1.730.
- [ ] El botón atrás del celular vuelve al paso anterior sin perder lo escrito.

**Casos de prueba (deben dar exacto):**
- [ ] Harina $8.500 + gas $3.000, 10 unidades, **Normal** → **Cobra $1.730**, te cuesta $1.150, ganas $580; "Si vendes las 10, ganas $5.800".
- [ ] Servicio: materiales $2.000, 1 unidad, **Harto** → **Cobra $4.000**, te cuesta $2.000, ganas $2.000.
- [ ] 0 unidades o monto vacío → mensaje amable, nunca "Infinity" ni "NaN".

### Resultado
- [ ] Explica el cálculo en pasos con palabras simples (sin fórmulas).
- [ ] **Guardar en mi catálogo** → "Guardado en tu catálogo ✔" con Deshacer. El botón queda en "Guardado".
- [ ] Guardar otra vez el mismo nombre con otro precio → pregunta si cambiar el precio.
- [ ] En Mi caja → VENDÍ aparece el producto como sugerencia con su precio; al tocarlo pone el monto.
- [ ] **Calcular otro precio** vuelve al paso 1 vacío.
- [ ] **Volver al inicio** lleva al inicio.

## 3b. Mi catálogo (fase 3)

- [ ] El inicio muestra 4 tarjetas en 2 columnas: Mi caja, ¿Cuánto cobro?, Mi catálogo, Mi semana.
- [ ] Sin productos: "Todavía no tienes productos" con **Agregar producto** e **Ir a ¿Cuánto cobro?**.
- [ ] **Agregar producto**: nombre y precio. Vacío → mensaje amable. Precio 0 → "Pon un precio mayor a $0".
- [ ] Nombre repetido (aunque cambien mayúsculas) → "Ya tienes “…” en tu catálogo".
- [ ] **Agregar foto**: elegir una foto del celular → aparece en grande; se guarda achicada (no más de 60 KB).
      **Cambiar foto** y **Quitar foto** funcionan.
- [ ] Si el producto vino de ¿Cuánto cobro?, al cambiar el precio dice "Te cuesta $X. Ganas $Y por cada una".
- [ ] La lista muestra foto (o ícono), nombre y precio, ordenada por nombre.
- [ ] **Quitar del catálogo** pregunta antes; **Deshacer** lo recupera. Las ventas anotadas no se borran.
- [ ] **Compartir mi catálogo** abre el menú Compartir con la lista de productos y precios
      (y "Haz tu pedido por WhatsApp al +56 …" si el negocio tiene WhatsApp).

### Armar pedido
- [ ] Cada producto tiene − cantidad +. Se puede escribir la cantidad. Los elegidos se marcan en verde con su subtotal.
- [ ] Abajo, fijo: **Total** con cuántos productos, y **Enviar por WhatsApp**.
- [ ] Sin productos elegidos → "Agrega al menos un producto con el botón +".
- [ ] WhatsApp del cliente malo → mensaje amable. En blanco → WhatsApp pregunta a quién mandarlo.
- [ ] Con número → se abre el chat de ese cliente con el detalle: cantidades, precios, total y "¡Gracias por tu pedido!".
- [ ] En Android, **Elegir de mis contactos** trae el celular del contacto.
- [ ] Después de enviar aparece "¿Ya te pagaron? Anótalo como venta".
- [ ] **Anotar como venta** → "Anotado ✔ Vendí $X" con Deshacer; queda en Mi caja como "Pedido: 3 Pan amasado, 1 …".
      El botón queda en "Anotado en Mi caja" (no se anota dos veces). Si se cambia el pedido, se puede anotar de nuevo.
- [ ] Si sale del pedido y vuelve, sigue armado. **Empezar pedido nuevo** lo vacía (con Deshacer).
- [ ] Los pedidos anotados no aparecen como sugerencia al tocar VENDÍ.

## 3c. Mi semana (fase 3)

- [ ] Dice "Últimos 7 días · 13 al 19 de octubre" (las fechas de hoy y 6 días atrás).
- [ ] Gráfico de barras: una por día, con el monto arriba ("12 mil"), el día abajo y **hoy** destacado.
      Los días sin ventas muestran una rayita.
- [ ] Vendí (con cantidad de ventas) / Gasté / Me quedó de los 7 días, correctos.
- [ ] "Vendiste $X más/menos que la semana anterior" (o "La semana anterior no anotaste ventas").
- [ ] "En octubre: vendiste $X (N ventas) y te quedó $Y".
- [ ] Sin facilitadora: botón **Compartir mi resumen** y aviso de pedirle su enlace.
- [ ] Con facilitadora: **Enviar mi resumen a [nombre]** abre su chat de WhatsApp con el resumen de la semana y del mes,
      cada uno con Vendí / Gasté / Me quedó y cantidad de ventas. **Compartir con otra persona** abre el menú Compartir.
- [ ] El mensaje no trae datos de clientes.

### Enlace de la facilitadora
- [ ] Abrir `…/mi-negocio/#/facilitadora?nombre=Carla&wsp=569XXXXXXXX` → "¿Guardar a Carla como tu facilitadora?" con su número.
- [ ] **Sí, guardar** → "Listo ✔ Carla quedó como tu facilitadora" y vuelve al inicio. **No, gracias** no guarda nada.
- [ ] Abrirlo otra vez → "Carla ya es tu facilitadora ✔". Enlace sin número → "Este enlace no está completo…".
- [ ] En Ajustes → **Mi facilitadora** se puede cambiar el nombre y número, o **Quitar facilitadora** (con Deshacer).
- [ ] El respaldo guarda y recupera la facilitadora y las fotos de los productos.

## 4. Ajustes

- [ ] Se ven y se pueden cambiar: nombre del negocio, tu nombre, WhatsApp y a qué te dedicas. **Guardar cambios** → "Guardado ✔".
- [ ] WhatsApp malo → mensaje amable; no guarda.
- [ ] Aparece el texto: "Tus datos están solo en este celular. Nadie más los ve…".
- [ ] Dice "Todavía no guardas ningún respaldo." (o la fecha del último).
- [ ] **Guardar mi respaldo** abre el menú Compartir del celular (WhatsApp, Drive…). En computador, se descarga un archivo.
- [ ] Después dice "Tu último respaldo: … (hoy)".
- [ ] **Recuperar mi respaldo** con un archivo que no es respaldo → "No pudimos leer ese archivo".
- [ ] **Borrar todo** pregunta dos veces. Al final vuelve a la bienvenida.
- [ ] **Recuperar mi respaldo** con el archivo guardado → dice cuántas ventas, gastos y productos trae; al aceptar, vuelven **idénticos** (montos, textos, fechas y nombre del negocio).
- [ ] "Instalar la app" muestra pasos para Android y iPhone. Si Chrome lo permite, aparece **Instalar en mi celular**.
- [ ] Abajo dice la versión de la app.

## 5. Recordatorio de respaldo

- [ ] Con movimientos anotados y más de 14 días sin respaldo, el inicio muestra un aviso con **Guardar mi respaldo** (no es una ventana que interrumpe).

## 6. App instalable y sin internet (requiere https: GitHub Pages o Vercel)

- [ ] En Chrome Android: menú ⋮ → "Instalar app" → queda el ícono en el celular.
- [ ] Al abrirla desde el ícono, se ve sin barra del navegador.
- [ ] Poner el celular en **modo avión** → la app abre y se puede anotar una venta.
- [ ] Al publicar una versión nueva aparece arriba "Hay una versión nueva, toca para actualizar".

## 7. Generales

- [ ] A 360 px de ancho no hay que mover la pantalla hacia los lados.
- [ ] Todo se lee bien sin lentes de cerca (texto base 18 px, montos grandes).
- [ ] Sin errores en la consola (Chrome → Inspeccionar → Console).
- [ ] Peso de la primera carga bajo 300 KB (Chrome → Inspeccionar → Network → "transferred").
- [ ] Lighthouse: Accesibilidad 90 o más.
