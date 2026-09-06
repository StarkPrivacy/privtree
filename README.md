# privtr.ee

Página de enlaces orientada a la privacidad.

**Dominio del servicio:** privtr.ee
`privtree.com` redirige a privtr.ee. `privacidad.me` será un proyecto distinto.

Demo de interfaz (estática): uso interno de desarrollo. Hasta la publicación
formal no se comunica como proyecto open source ni se indexa
(`robots.txt` + `<meta name="robots" content="noindex">` en todas las páginas).

## Sin terceros

No se carga nada de Google ni de CDNs de terceros. Todo es de origen propio:

- **CSS**: Tailwind **precompilado** a `assets/app.css` (no el CDN de Tailwind).
- **Tipografía**: Inter autoalojada en `assets/fonts/*.woff2` (subconjuntos latin / latin-ext).
- **Iconos**: SVG autoalojados en `js/icons.js` (Font Awesome Free 6.5.2, CC BY 4.0),
  sin fuente de iconos ni CSS de FA. `<i class="fa-…">` se hidrata a `<svg>` en carga.
- **QR**: `qrcode-generator` 1.4.4 autoalojado en `js/vendor/qrcode.min.js` (MIT).

Comprobación: `grep -r "googleapis\|gstatic\|cdnjs\|jsdelivr\|unpkg\|cloudflare" *.html js/` → sin resultados.

## Estructura

```
*.html               páginas (una hoja: assets/app.css)
404.html             404 + router de /@usuario en hosting estático
assets/app.css       CSS compilado (generado — no editar a mano)
assets/fonts/        Inter woff2
assets/img/          imágenes locales (og.jpg, iconos, avatar demo)
src/input.css        fuente del CSS (aquí se editan estilos)
tailwind.config.js   tema único (colores, tipografías, animaciones)
build.sh             compila assets/app.css (descarga el CLI standalone; sin Node)
js/store.js          datos, saneado, @usuario, URLs, export/import, migración
js/profile-view.js   arranque del perfil público (u.html y 404.html)
js/panel-app.js      lógica del panel de edición
js/icons.js          mapa de iconos SVG (generado)
deploy/              nginx.conf · .htaccess · Caddyfile · dev-server.py
robots.txt           interruptor de lanzamiento (bloquea el rastreo hasta abrir)
sitemap.xml          páginas fijas
MIGRATION.md         esquema, URLs, redirecciones y migración desde privacidad.me
```

## Direcciones

La URL pública es **`privtr.ee/@usuario`**. En producción la sirve una
reescritura a `u.html` (ver `deploy/`); en hosting estático la resuelve
`404.html`. `u.html?u=ana` sigue funcionando y redirige a `/@ana`.

Probar en local los dos escenarios:

```sh
python3 deploy/dev-server.py              # como nginx/Apache
python3 deploy/dev-server.py 8098 --pages # como GitHub Pages
```

## Build del CSS

```sh
./build.sh          # una vez
./build.sh --watch  # recompila al guardar src/input.css o cambiar clases
```

`build.sh` descarga el binario **standalone** de Tailwind en `tools/`
(no requiere Node; `tools/` está en `.gitignore`). Con Node disponible el
equivalente es `npx tailwindcss -c tailwind.config.js -i src/input.css -o assets/app.css --minify`.

Tras tocar clases en HTML/JS o `src/input.css`, **hay que recompilar** y
versionar `assets/app.css` (el render es determinista, no se compila en runtime).

## Datos y migración

Ver [MIGRATION.md](MIGRATION.md). Resumen: cada perfil lleva `schemaVersion`;
`PrivStore.exportAll()` produce un JSON versionado; el panel admin importa
respaldos propios y exportaciones de LinkStack / privacidad.me
(`PrivStore.fromLinkStack()`).

## Seguridad

- CSP en `<meta>` en todas las páginas y, más estricta, en las cabeceras de
  `deploy/` (allí sí vale `frame-ancestors`). Bloquea scripts externos, envío de
  formularios a terceros y conexiones salientes.
- Saneado de entrada en `js/store.js`: `esc()`, `safeUrl()`, `safeImg()`,
  `safeHex()` y `normalize()`; vCard escapada según RFC 6350.
- `@usuario` con lista de reservados para evitar colisiones de ruta y
  suplantación (`soporte`, `oficial`, `seguridad`…).
- Sin terceros: nada de CDNs, fuentes remotas ni servicios de favicon.

## Pendiente

- Backend real (skin sobre LinkStack) — el contrato de datos es el de `MIGRATION.md`.
- **`og:`/`title` de los perfiles renderizados en servidor**: los rastreadores de
  WhatsApp/X/Telegram no ejecutan JS (detalle en `MIGRATION.md`).
- `admin.html` no tiene control de acceso (es demo localStorage); irá tras el rol admin del backend.
- `acceso.html` no valida contraseña (no hay backend de autenticación todavía).
