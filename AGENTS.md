# AGENTS.md

Juego de Pac-Man en JavaScript vanilla (HTML + CSS + JS). No hay build, paquetes ni tests automatizados.

## Comandos y verificación

- No existe `package.json`, linter, formateador ni suite de tests. No inventes comandos (`npm test`, `npm run lint`, etc.).
- Ejecutar: abrir `src/index.html` directamente en el navegador (no requiere servidor; el código no usa `fetch` ni módulos ES).
- Verificación disponible de sintaxis: `node --check src/js/<archivo>.js` (cada archivo, uno por uno). Node v22 está instalado.
- La comprobación funcional es manual en el navegador. Di explícitamente que no se probó en el navegador si no lo hiciste.

## Arquitectura

- Los scripts se cargan como scripts clásicos en `src/index.html` **en este orden**: `maze.js`, `game.js`, `render.js`, `main.js`. El orden importa: no hay `import`/`export`.
- Las funciones y datos compartidos entre archivos se exponen con `window.X = X` al final de cada archivo y se usan como globals:
  - `maze.js`: `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
  - `game.js`: `createGame`, `update`, `DIRS`. Depende de los globals de `maze.js`.
  - `render.js`: `draw`. Usa `DIRS` de `game.js`.
  - `main.js`: no exporta nada; depende de `createGame`, `update` y `draw`. Arranca el bucle con `loop()` al cargar.
- Si añades un archivo nuevo o una función que cruza archivos, debes agregar el `<script>` en el orden correcto y el `window.` export correspondiente.
- Responsabilidades: `maze.js` = datos del laberinto; `game.js` = estado y reglas (sin DOM); `render.js` = dibujo en canvas; `main.js` = teclado, overlays y bucle.

### Modelo de datos del laberinto

- `MAZE_STR` son 31 filas de 28 caracteres. Se parsea a códigos numéricos: `0` vacío transitable, `1` pared, `2` punto, `3` puerta de la pen (bloquea a Pac-Man, los fantasmas sí pasan).
- `MAZE` es la matriz original y **no debe mutarse**. `createGame()` copia cada partida en `game.grid`; los puntos comidos se borran de `game.grid`, no de `MAZE`.
- Canvas 560x620 = 28x31 celdas de `TILE = 20` píxeles (`render.js`). Si cambias el tamaño del laberinto, cambia también el canvas y `TILE`.
- `TUNNEL_ROW = 14` es la única fila donde existe el túnel: salir por un borde la reenvía al otro lado (`wrapTunnel`).
- Pac-Man y los fantasmas se mueven en coordenadas fraccionarias y solo cambian de dirección al estar alineados con una celda (`aligned`). `nextDir` guarda el giro pedido hasta que sea posible.
- Los fantasmas tienen `kind` `'hunter'` (persigue por distancia Manhattan) o `'random'`.
- Los puntos se cuentan en `createGame()`; la victoria ocurre cuando `dotsRemaining` llega a 0 (`update`).
- Tras una colisión se restan vidas y se reinician posiciones (`resetPositions`); en 0 vidas el estado pasa a `'lost'`.

### Flujo de estados

- `game.state`: `'start'` → `'playing'` → `'won'` | `'lost'`. Las flechas solo se procesan en `'playing'`.
- `showOverlay()` reemplaza el `innerHTML` del overlay, así que el listener del botón se vuelve a enlazar ahí. No enlaces el botón una sola vez de forma estática para los reinicios.

## Especificaciones (spec-driven)

- El proyecto se desarrolla con specs. Las skills están en `.agents/skills/spec` (diseñar) y `.agents/skills/spec-impl` (implementar).
- Las specs van en `specs/NN-slug.md` en la raíz; la carpeta `specs/` aún no existe. Numera con el siguiente número disponible y lee las dos más recientes para copiar idioma y redacción de estados.
- Implementa solo specs cuyo estado sea "Approved" (`**Status:**` en la plantilla `spec/template.md`; `spec-impl` acepta el equivalente en cualquier idioma).
- `spec-impl` crea la rama `spec-NN-slug` salvo que `specs/.spec-config.yml` tenga `AutoCreateBranch: false`.

## Convenciones

- Comentarios y mensajes visibles al usuario en español; identificadores (variables, funciones, archivos) en inglés. Mantén el estilo de comentarios de cada archivo.
- Estilo mixto de espacios dentro de paréntesis y corchetes (`getElementById( 'game' )` vs. `createGame()`): sigue el archivo que editas.
- No agregues dependencias ni herramientas de build sin consultar.
- No hay CI, hooks de pre-commit ni reglas de Cursor/Copilot en el repo; no buscarlos.
