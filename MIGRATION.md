# Migración de datos → privtr.ee

Objetivo: poder llevar **la gestión y los usuarios actuales de privacidad.me**
(basado en LinkStack) a privtr.ee sin pérdidas y de forma repetible.

## 0. Compatibilidad de URLs (leer antes que nada)

La dirección pública es **`privtr.ee/@usuario`**. Esto ya funciona:

| Entrada | Resultado |
|---|---|
| `privtr.ee/@ana` | perfil de Ana, **200 OK** (reescritura a `u.html`, ver `deploy/`) |
| `privtr.ee/u.html?u=ana` | **301** → `privtr.ee/@ana` |
| `privacidad.me/@ana` | **301** → `privtr.ee/@ana` |
| `privtree.com/@ana` | **301** → `privtr.ee/@ana` |
| `privtr.ee/@noexiste` | página "aún no publicada" con opción de reclamarlo |
| ruta desconocida | `404.html` |

En hosting estático sin reescrituras (GitHub Pages) `404.html` hace de router y
resuelve `/@ana` igual, sólo que con estado 404 en vez de 200. Para producción
usa una de las configuraciones de `deploy/` (nginx, Apache, Caddy).

Pruébalo en local imitando los dos escenarios:

```sh
python3 deploy/dev-server.py            # como nginx/Apache  (/@ana -> 200)
python3 deploy/dev-server.py 8098 --pages   # como GitHub Pages (/@ana -> 404.html)
```

### Nombres de usuario: dos cambios que afectan al traslado

1. **Acentos y espacios.** `sanitizeUsername()` translitera en vez de borrar:
   `@José Pérez` → `@jose-perez`, `@Ñoño` → `@nono`, `@Ana.Ruiz` → `@ana-ruiz`.
   (Antes se borraban los caracteres no ASCII y `maría` acababa en `mara`.)
   Todo usuario cuyo `@` cambie queda anotado en `_migrationNotes` con el aviso
   de crear la **redirección 301 desde la dirección antigua**.
2. **Nombres reservados.** `PrivStore.RESERVED_USERNAMES` bloquea los `@` que
   chocan con rutas del sitio (`admin`, `panel`, `faq`, `assets`, `js`…) y los
   suplantables (`soporte`, `seguridad`, `oficial`…). En el alta self-service se
   rechazan; en la importación **no se descartan**, se marcan para que decidas
   (renombrar al usuario y redirigir).

**Colisiones.** Si dos usuarios distintos acaban en el mismo `@` (p. ej.
`José Pérez` y `jose.perez` → ambos `jose-perez`), el segundo recibe sufijo
(`jose-perez-2`) y un aviso. Sin esto, la importación sobrescribiría el perfil
del primero **en silencio**.

## 1. Esquema del perfil (versionado)

Cada perfil es un objeto JSON con `schemaVersion` (entero). La versión actual
es `PrivStore.SCHEMA_VERSION` (hoy **1**). El punto único de evolución es
`migratePage(d)` en `js/store.js`: al subir la versión se añade ahí la
transformación `if (v < N) { ... }`. `normalize()` llama a `migratePage()`
siempre, así que cualquier perfil viejo se actualiza al cargarse.

Campos (v1):

| campo | tipo | notas |
|---|---|---|
| `schemaVersion` | number | sello de versión |
| `username` | string | `[a-z0-9_-]`, ≤32, sin `@`. Es la URL: `privtr.ee/@<username>` |
| `name` | string | nombre visible |
| `bio` | string | |
| `avatar` | string | URL `https://…`, `data:image/...;base64,…` o ruta same-origin |
| `bgImage` | string | igual que `avatar` |
| `shape` | `rounded\|pill\|square` | |
| `btnStyle` | `outline\|solid\|soft\|ghost` | |
| `btnSize` | `sm\|md\|lg` | |
| `btnGlow` | bool | |
| `accentColor` | `#rgb`/`#rrggbb` | |
| `profileMode` | `both\|card\|links` | |
| `verified` | bool | **solo lo cambia admin** |
| `sameTab` | bool | abrir enlaces en la misma pestaña |
| `social` | objeto | claves fijas: `youtube telegram x instagram discord github linkedin mastodon email` → URL |
| `socialOrder` | string[] | orden de los iconos sociales |
| `links` | objeto[] | ver abajo |
| `contact` | objeto | vCard: `{enabled,title,org,note,email,phone,web,borderColor,qrStyle,showQr}` |
| `ogTitle`, `ogDesc` | string | metadatos de compartición (reservado) |
| `updatedAt` | number | epoch ms |

`links[]`: `{ id, type: link|heading|text|spacer, title, url, color, customColor, icon, brand, iconMode: none|preset|favicon }`.
El `icon` se guarda como cadena estilo Font Awesome (`"fa-brands fa-youtube"`),
que es también el identificador estable de icono en `js/icons.js` y en LinkStack.

## 2. Formato de exportación / importación

`PrivStore.exportAll()` →

```json
{ "generator": "privtr.ee", "schemaVersion": 1, "exportedAt": "2026-…Z",
  "pages": [ { …perfil… }, … ] }
```

- **Exportar**: Admin → Configuración → «Exportar todo (JSON)».
- **Importar respaldo privtr.ee**: Admin → «Importar respaldo privtr.ee».
  Acepta el objeto anterior, un array de perfiles, o un perfil suelto.
  `PrivStore.importPages(payload)` normaliza sin guardar; `saveImported(pages)`
  persiste cada uno en su clave `priv_page_<username>`.

## 3. Importar desde LinkStack / privacidad.me

`PrivStore.fromLinkStack(input)` acepta:

- exportación relacional: `{ "users": [...], "links": [...] }` (se cruzan por `user_id`)
- exportación anidada: `[ { …usuario…, "links": [ … ] }, … ]`
- un único usuario: `{ … }`

Mapeo aplicado:

| LinkStack | privtr.ee |
|---|---|
| `littlelink_name` (o `username`/`handle`/`name`) | `username` |
| `name` / `display_name` | `name` |
| `littlelink_description` / `description` | `bio` |
| `image` / `img` / `avatar` (si es URL `http(s)`) | `avatar` |
| `verified` / `is_verified` | `verified` |
| `links[]` ordenados por `order`/`position` | `links[]` |
| `link.type` `heading/header/group` → `heading`; `divider/spacer` → `spacer`; `text` → `text`; resto → `link` |
| `link.button` conocido y social (youtube, telegram, twitter/x, instagram, discord, github, linkedin, mastodon, email) | se mueve a `social{}` |
| `link.button` conocido no social (website, newsletter, podcast, shop, phone…) | `link.icon` = FA equivalente, `iconMode: preset` |
| `custom_css` / `custom_js` | **no se importa** (anotado) |

Lo que no se puede mapear queda en `page._migrationNotes` (array de strings)
y se muestra en el informe de importación del panel admin. Revisar:

- avatares que eran rutas/archivos locales de LinkStack (subir o poner URL),
- botones LinkStack sin equivalencia (elegir icono/color),
- CSS/JS personalizado.

### Recomendado para el corte real

1. Congelar escrituras en privacidad.me.
2. Exportar de LinkStack (BD → JSON con la forma de arriba; si el panel de
   LinkStack no exporta ese shape, un `SELECT` de `users` + `links` a JSON vale).
3. `fromLinkStack()` → **revisar `_migrationNotes` de arriba abajo** →
   `saveImported()`. Los tres avisos que hay que resolver sí o sí:
   - `@` reservado → renombrar al usuario y anotar la redirección.
   - colisión con sufijo `-2` → decidir quién se queda el `@` original.
   - `@` cambiado al normalizar → añadir su 301.
4. Verificar una muestra de perfiles en `/@<usuario>`.
5. Publicar el mapa de redirecciones `privacidad.me/@viejo → privtr.ee/@nuevo`.
   Las reglas genéricas de `deploy/` cubren el caso "mismo `@`"; las excepciones
   del punto 3 hay que añadirlas a mano.
6. Avisar por correo a los usuarios cuyo `@` haya cambiado.

### Checklist de lanzamiento

- [ ] DNS de `privtr.ee` apuntando al servidor; TLS emitido.
- [ ] Configuración de `deploy/` instalada (reescritura `/@usuario` + cabeceras).
- [ ] Redirecciones 301 desde `privacidad.me` y `privtree.com` verificadas.
- [ ] Importación hecha y `_migrationNotes` resueltas.
- [ ] `robots.txt`: quitar el bloque PRE-LANZAMIENTO y activar el de PRODUCCIÓN.
- [ ] `sitemap.xml` actualizado (y perfiles añadidos por el backend).
- [ ] Comprobar `og:` de un perfil real con el depurador de X/Facebook.
- [ ] **Inyectar `og:`/`title` en servidor** para los perfiles (ver abajo).

## 4. Cuando exista backend

Estos mismos objetos son el contrato con el servidor: el endpoint de
importación del backend debe aceptar el formato de `exportAll()` y aplicar la
misma normalización/saneado que `normalize()` + `safeUrl()`/`safeImg()` del
cliente (en PHP: `htmlspecialchars` + validación de esquema de URL), además de
la lista de reservados y la transliteración de `sanitizeUsername()`.

### Metadatos de compartición (importante para un "link in bio")

Ahora mismo `og:title`, `og:description` y `og:image` de un perfil los actualiza
**JavaScript** (`js/profile-view.js`). Eso vale para el navegador, pero **los
rastreadores de WhatsApp, Telegram, X y Facebook no ejecutan JS**: verán los
valores por defecto del HTML, no los del usuario.

Cuando el backend sirva `/@usuario`, debe **renderizar en servidor** al menos:

```html
<title>{nombre} — privtr.ee</title>
<meta name="description"        content="{bio}">
<link rel="canonical"           href="https://privtr.ee/@{usuario}">
<meta property="og:type"        content="profile">
<meta property="og:title"       content="{nombre} — privtr.ee">
<meta property="og:description" content="{bio}">
<meta property="og:url"         content="https://privtr.ee/@{usuario}">
<meta property="og:image"       content="{avatar absoluto o og.jpg}">
<meta name="twitter:card"       content="summary">
```

Los campos `ogTitle` y `ogDesc` del esquema existen justo para esto: si el
usuario los rellena, tienen prioridad sobre `name`/`bio`.
