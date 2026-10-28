# SPEC 01: Comportamientos propios para 4 fantasmas

**Estado:** Aprobado
**Fecha:** 2026-10-28
**Depende de:** ninguna
**Objetivo:** Que los 4 fantasmas (rojo, rosa, azul y naranja) tengan cada uno una lógica de persecución distinta, y que el rojo persiga agresivamente a Pac-Man.

## 1. Alcance

**Dentro:**
- Cuatro fantasmas con comportamiento propio, sustituyendo los `kind` `hunter` y `random`.
- Salida escalonada desde la pen: 0 s, 4 s, 8 s y 12 s (rojo, rosa, azul, naranja), a 60 FPS, es decir 0, 240, 480 y 720 frames.
- Tras perder una vida, los fantasmas vuelven a la pen y se escalonan de nuevo.
- Velocidad igual para los cuatro (`GHOST_SPEED = 0.1`).

**Fuera (specs futuros):**
- Modos scatter/chase por ciclos.
- Power pellets y modo asustado.
- Velocidades distintas por fantasma.
- Emulación de bugs del arcade original (por ejemplo, el desvío de rosa cuando Pac-Man mira hacia arriba).

## 2. Modelo de datos

- `GHOST_STARTS` (en `maze.js`) pasa a tener 4 entradas, cada una con `x`, `y`, `kind` y `releaseDelay` (en frames). Las posiciones de salida están dentro de la pen (filas 13-15, columnas 11-16).
- `kind` pasa a ser:
  - `'chaser'` (rojo): persigue a Pac-Man.
  - `'ambusher'` (rosa): se dirige a 4 celdas delante de Pac-Man.
  - `'flanker'` (azul): usa la posición del rojo para flanquear.
  - `'guard'` (naranja): persigue si está lejos y se retira a su esquina si está cerca.
- `game.ghosts[i]` añade `releaseDelay` y un contador de frames (`frameCount` o equivalente) para saber cuándo sale de la pen.

## 3. Plan de implementación

1. **`maze.js`:** definir las 4 posiciones de inicio dentro de la pen con sus `kind` y `releaseDelay`. Verificar que las 4 celdas son transitables para fantasmas. Verificación: `node --check src/js/maze.js`.
2. **`game.js`, objetivo por `kind`:** extraer una función `getGhostTarget( game, g )` que devuelva la celda objetivo según el `kind`. Reutilizar la selección de dirección existente en `decideGhost` (distancia mínima sin giro de 180°). Verificación: `node --check src/js/game.js`.
3. **`game.js`, salida de pen:** un fantasma no se mueve hasta que transcurre su `releaseDelay`. Antes de salir, permanece en su celda de inicio.
4. **`game.js`, reinicio:** `resetPositions` devuelve cada fantasma a su inicio y reinicia su contador de salida.
5. **`game.js`, limpieza:** eliminar la rama `random` y el `kind` `hunter` de `decideGhost`.
6. **`render.js`:** sin cambios; `GHOST_COLORS` ya tiene 4 colores. Verificación final: `node --check` en los cuatro archivos y prueba manual en el navegador.

Cada paso deja el juego jugable.

## 4. Criterios de aceptación

- [ ] `node --check` pasa en `maze.js`, `game.js` y `render.js`.
- [ ] Hay exactamente 4 fantasmas, con `kind` `chaser`, `ambusher`, `flanker` y `guard`.
- [ ] Al iniciar la partida, el rojo sale en el frame 0, el rosa en el 240, el azul en el 480 y el naranja en el 720.
- [ ] Antes de su retardo, un fantasma no cambia de posición.
- [ ] `chaser` apunta a la celda de Pac-Man.
- [ ] `ambusher` apunta a 4 celdas delante de Pac-Man en su dirección actual.
- [ ] `flanker` apunta a `rojo + 2 · (pivote - rojo)`, donde el pivote es 2 celdas delante de Pac-Man.
- [ ] `guard` persigue si la distancia euclídea a Pac-Man es mayor que 8; si es 8 o menos, apunta a su esquina inferior izquierda.
- [ ] Al perder una vida, los 4 vuelven a la pen y se escalonan de nuevo.
- [ ] No queda ningún rastro de `'random'` ni `'hunter'` en el código.
- [ ] Prueba manual en el navegador: los 4 fantasmas se comportan de forma visiblemente distinta. **Pendiente: no probado en navegador.**

## 5. Decisiones tomadas y descartadas

- **Esquema clásico de 4 fantasmas** (elegido). Descartado: comportamientos inventados, porque el esquema clásico está validado en diseño de juego.
- **Salida escalonada por tiempo** (elegido). Descartado: salida por puntos, por complicar el estado.
- **Retardo 0/4/8/12 s** (elegido). Alternativa 0/3/6/9 s descartada por una presión temprana excesiva.
- **Reinicio con escalonado** (elegido). Descartado: salida simultánea, porque no coincide con el comportamiento clásico.
- **Sustituir `random` por los clásicos** (elegido). Descartado: mantener 5 fantasmas, porque el juego tiene 4.
- **Sin modos scatter/chase ni power pellets** (elegido). Quedan para specs futuros.
- **Distancia euclídea para `guard`** (elegido, confirmado por el usuario). Se aparta de la Manhattan que usa `hunter` hoy, siguiendo el juego clásico.
- **Reutilizar `decideGhost`** en lugar de crear un motor de rutas nuevo (DRY).
- **Sin emulación de bugs del arcade.** Pac-Man se considera mirando en su dirección actual.

## 6. Riesgos

- **Cuatro fantasmas en la pen:** si las posiciones de salida quedan demasiado juntas, pueden bloquearse entre sí. Mitigación: verificar en el paso 1 que las 4 celdas están libres y son transitables.
- **Dificultad:** con 4 fantasmas el juego puede resultar más duro. Se ajusta con los retardos sin cambiar la lógica.
