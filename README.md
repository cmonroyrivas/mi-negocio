# Mi Negocio

App gratuita para el celular que ayuda a las emprendedoras y emprendedores del programa
FOSIS Reparación y Emprendimiento 2026 a llevar su negocio día a día:

- **Mi caja**: anotar lo que venden y gastan, y ver cuánto les quedó.
- **¿Cuánto cobro?**: calcular el precio de un producto o servicio.
- **Ajustes**: datos del negocio y respaldo.

No pide registro, correo ni contraseña. Funciona sin internet una vez instalada.
Los datos quedan **solo en el celular de cada persona**: no hay servidor ni base de datos en internet.

> Esta app no reemplaza boletas ni facturas.

---

## 1. Probar en el computador

1. Abre la app **Terminal** del Mac.
2. Escribe `cd ` (con un espacio al final), arrastra la carpeta `mi-negocio` a la ventana y presiona Enter.
3. Escribe esto y presiona Enter:

   ```bash
   python3 -m http.server 8000
   ```

4. Abre Chrome y entra a **http://localhost:8000**
5. Para ver cómo se ve en un celular: clic derecho → **Inspeccionar** → ícono de celular (arriba a la izquierda del panel).
6. Para apagar el servidor: vuelve a la Terminal y presiona `Ctrl + C`.

## 2. Probar en el celular (misma red wifi)

Sirve para mirar las pantallas, pero **no** permite instalar la app ni probar el modo
sin internet (el celular exige una dirección segura `https`, ver punto 3).

1. Con el servidor del punto 1 encendido, averigua la dirección del Mac:

   ```bash
   ipconfig getifaddr en0
   ```

   Te mostrará algo como `192.168.1.25`.
2. Con el celular conectado **al mismo wifi**, abre Chrome y entra a
   `http://192.168.1.25:8000` (con el número que te salió).

## 3. Publicar gratis en GitHub Pages (para que las usuarias la instalen)

Se hace una sola vez. Después solo se suben los cambios.

1. Crea una cuenta gratis en **https://github.com** (si no tienes).
2. Arriba a la derecha, botón **+** → **New repository**.
   - Nombre: `mi-negocio`
   - Marca **Public** (GitHub Pages gratis necesita que sea público; solo se publica
     el programa, **nunca** los datos de las usuarias, que viven en sus celulares).
   - Clic en **Create repository**.
3. En la página que aparece, clic en **uploading an existing file**.
4. Arrastra **todo lo que está dentro** de la carpeta `mi-negocio`
   (`index.html`, `manifest.webmanifest`, `sw.js` y las carpetas `css`, `js`, `icons`, `tests`).
   Abajo, clic en **Commit changes**.
5. Ve a **Settings** → **Pages** (menú de la izquierda).
   En "Branch" elige **main** y **/ (root)** → **Save**.
6. Espera 1 o 2 minutos y recarga. Aparecerá el enlace, parecido a:
   **https://TU-USUARIO.github.io/mi-negocio/**

Ese es el enlace que se comparte con las usuarias (por WhatsApp, o en un código QR impreso).

## 4. Cómo la instalan las usuarias

**Android (Chrome)**
1. Abrir el enlace en Chrome.
2. Tocar el menú **⋮** (arriba a la derecha).
3. Tocar **Instalar app** o **Agregar a la pantalla principal**.
4. Queda el ícono de Mi Negocio junto a sus otras apps. Desde ahí se abre sin barra del navegador.

**iPhone (Safari)**
1. Abrir el enlace en Safari.
2. Tocar **Compartir** (cuadrado con flecha hacia arriba).
3. Tocar **Agregar a inicio** → **Agregar**.

Dentro de la app, en **Ajustes → Instalar la app**, están estas mismas instrucciones.

## 5. Publicar una versión nueva

Cada vez que se cambie algo de la app:

1. En `sw.js`, cambia el número en `CACHE_VERSION` (por ejemplo de `v1.0.0` a `v1.0.1`).
2. En `js/config.js`, cambia `APP_VERSION` al mismo número (`1.0.1`).
3. Sube los archivos cambiados a GitHub (en el repositorio: **Add file → Upload files**).

Las usuarias verán arriba: **"Hay una versión nueva, toca para actualizar"**.
Sus datos **no** se pierden al actualizar.

## 6. Respaldos (importante para las usuarias)

Como los datos están solo en el celular, si se borra el navegador o se cambia de
celular, se pierden. Por eso:

- En **Ajustes → Guardar mi respaldo** se abre el menú Compartir: lo más fácil es
  mandárselo a su propio WhatsApp ("Mensaje a mí misma/o") o guardarlo en Drive.
- En un celular nuevo, en la primera pantalla aparece **"¿Cambiaste de celular? Recupera tu respaldo"**.
- La app recuerda guardar un respaldo si pasan más de 14 días.

## 7. Pruebas

La lista de pruebas por pantalla está en [`tests/smoke.md`](tests/smoke.md).
Úsala antes de entregar una versión nueva.

## 8. Cómo está hecha (para quien la mantenga)

- HTML, CSS y JavaScript sin frameworks ni dependencias, sin paso de compilación.
- Datos en IndexedDB del navegador (`js/db.js`). Montos en pesos enteros, fechas `AAAA-MM-DD`.
- Service worker propio (`sw.js`): guarda la app para usarla sin internet.
- Peso total: unos 140 KB (unos 50 KB transferidos comprimidos).
- Sin analítica, sin rastreadores, sin anuncios.

```
mi-negocio/
├── index.html             página principal
├── manifest.webmanifest   nombre, ícono y colores al instalar
├── sw.js                  modo sin internet
├── css/styles.css         estilos
├── js/
│   ├── app.js             arranque y navegación entre pantallas
│   ├── db.js              datos en el celular (IndexedDB)
│   ├── config.js          versión, textos legales y constantes
│   ├── ui.js              botones, avisos, diálogos, teclado
│   ├── format.js          pesos, fechas, redondeo, WhatsApp
│   ├── backup.js          guardar y recuperar respaldo
│   └── screens/           inicio, caja, precio, ajustes
├── icons/                 íconos de la app (icono.svg es el dibujo original)
└── tests/smoke.md         lista de pruebas manuales
```
