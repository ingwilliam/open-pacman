# SPEC 01 — Cuatro fantasmas con comportamientos distintos

> **Status:** Aprobado
> **Depends on:** Ninguna
> **Date:** 2026-10-28
> **Objective:** Pasar de dos a cuatro fantasmas con comportamientos distintos, de modo que uno de ellos persiga activamente a Pac-Man.

---

## Scope

**In:**

- Cuatro fantasmas en `GHOST_STARTS` con los `kind` `hunter` (persecutor), `ambusher` (emboscada), `random` (aleatorio, ya existente) y `shy` (tímido).
- Colores por índice sin cambios en `GHOST_COLORS` (`render.js`): rojo para `hunter`, cian para `ambusher`, rosa para `random` y naranja para `shy`.
- El persecutor (`hunter`) avanza por la ruta más corta hasta Pac-Man, calculada por búsqueda por distancias (BFS).
- Salida escalonada de la pen: cada fantasma espera dentro de la pen un tiempo fijo antes de salir.
- Tras una colisión, los fantasmas vuelven a la pen y el escalonado se reinicia.

**Out of scope (for future specs):**

- Modo asustado (al comer una power pellet) y sus efectos.
- Ciclo scatter/chase (alternancia de objetivos por tiempo).
- Velocidad distinta por fantasma.
- Cambios en `render.js` más allá de lo ya existente (sprites, colores nuevos, animaciones).
- Puntos por comer fantasmas, dificultad por nivel o nuevos niveles.
- Cambios en vidas, puntuación o condición de victoria.

---

## Data model

Dos cambios: nuevos `kind` y campos de estado por fantasma. Ningún dato persistido.

```js
// maze.js
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter' },   // persecutor (rojo)
  { x: 14, y: 14, kind: 'ambusher' }, // emboscada (cian)
  { x: 12, y: 14, kind: 'random' },   // aleatorio (rosa)
  { x: 15, y: 14, kind: 'shy' },      // tímido (naranja)
];
```

```js
// game.js
// Ticks de espera dentro de la pen antes de salir, por tipo de fantasma.
const GHOST_RELEASE_TICKS = { hunter: 0, ambusher: 120, random: 240, shy: 360 };

// Estado de cada fantasma (campos nuevos):
// phase:       'waiting' | 'leaving' | 'active'
// releaseTick: tick de game.ticks en el que pasa de 'waiting' a 'leaving'

game.ticks; // número de updates desde createGame(), incrementado en update()
```

Convenciones:

- Coordenadas de celda con origen arriba-izquierda, como en `MAZE`.
- Interior de la pen: `x` en [11, 16], `y` en [13, 15]. Sin muros interiores.
- Salida de la pen: `PEN_EXIT = { x: 13, y: 11 }` (corredor por encima de la puerta, fila 12).
- Los ticks equivalen a frames a 60 fps (`requestAnimationFrame`), así que 120 ticks son unos 2 s.

---

## Implementation plan

1. `maze.js`: sustituir `GHOST_STARTS` por las cuatro entradas del modelo de datos. Los `kind` `ambusher` y `shy` se comportarán como `random` hasta sus pasos. Verificación: `node --check` y abrir el juego, deben verse cuatro fantasmas dentro de la pen.
2. `game.js`: añadir `game.ticks`, `GHOST_RELEASE_TICKS` y las fases `waiting` / `leaving` / `active`. En `waiting` los fantasmas se mueven al azar solo dentro del interior de la pen. Al cumplir `releaseTick` pasan a `leaving` y se dirigen a `PEN_EXIT` (por ahora con la heurística de distancia Manhattan existente) y, al llegar, a `active`. `resetPositions` reinicia fases y `releaseTick = game.ticks + GHOST_RELEASE_TICKS[kind]`. Verificación: el `hunter` sale al instante y los demás salen en los ticks indicados.
3. `game.js`: cálculo de distancias por BFS desde un objetivo (la casilla de Pac-Man, o `PEN_EXIT` en `leaving`). Los fantasmas en `active` con `kind` `hunter` eligen el vecino de menor distancia, sin dar la vuelta salvo en callejón sin salida (regla existente). Verificación: el persecutor llega a Pac-Man sin quedarse atascado en muros.
4. `game.js`: comportamiento `ambusher`. Objetivo = casilla de Pac-Man desplazada 4 celdas en su dirección actual. Si el objetivo cae fuera del laberinto se recorta a sus límites; si cae en un muro se usa la casilla de Pac-Man. Se usa la misma BFS del paso 3. Verificación: el fantasma cian intercepta por delante de Pac-Man en lugar de seguir su estela.
5. `game.js`: comportamiento `shy`. Si la distancia Manhattan a Pac-Man es mayor de 8 celdas, persigue como `hunter`; si es 8 o menos, va a la esquina inferior izquierda `{ x: 1, y: 29 }`. Verificación: el naranja se aleja cuando Pac-Man se acerca y vuelve a perseguir cuando se aleja.
6. Limpieza: actualizar los comentarios de cabecera de `maze.js` y `game.js` y la línea de `AGENTS.md` que describe los `kind` de los fantasmas. Verificación: `node --check` sobre `maze.js` y `game.js`.

---

## Acceptance criteria

- [ ] `GHOST_STARTS` tiene exactamente 4 entradas con `kind` `hunter`, `ambusher`, `random` y `shy`, en ese orden.
- [ ] Las 4 posiciones iniciales son casillas distintas dentro de la pen (x en [11, 16], y en [13, 15]) y no son muro.
- [ ] Al iniciar una partida, `game.ghosts.length` es 4 y los colores visibles son rojo, cian, rosa y naranja, en ese orden.
- [ ] El `hunter` sale de la pen en el primer `update` (`releaseTick` 0).
- [ ] Los fantasmas `ambusher`, `random` y `shy` permanecen dentro de la pen hasta sus ticks de salida (120, 240 y 360) y después salen por `PEN_EXIT`.
- [ ] Mientras un fantasma está en `waiting`, nunca sale del interior de la pen.
- [ ] El `hunter` llega a la casilla de Pac-Man en el laberinto sin quedarse atascado en un muro, con Pac-Man parado en una casilla.
- [ ] El `hunter` no da la vuelta sobre su propia dirección salvo cuando está en un callejón sin salida.
- [ ] El `ambusher` no usa la distancia directa a Pac-Man: su objetivo es la casilla desplazada 4 celdas delante de Pac-Man (o Pac-Man si esa casilla es muro).
- [ ] El `shy` persigue cuando Pac-Man está a más de 8 celdas (Manhattan) y se dirige a `{ x: 1, y: 29 }` cuando está a 8 o menos.
- [ ] El `random` se mueve como antes una vez fuera de la pen.
- [ ] Tras una colisión que no termina la partida, los fantasmas vuelven a la pen y repiten el escalonado desde ese momento.
- [ ] Puntos, vidas y condición de victoria funcionan igual que antes.
- [ ] La consola del navegador no muestra errores al abrir `src/index.html` y jugar una partida.
- [ ] `node --check` pasa para `src/js/maze.js` y `src/js/game.js`.

La comprobación de comportamiento es manual en el navegador: el proyecto no tiene tests automatizados.

---

## Decisions

- **Yes:** cuatro comportamientos (persecutor, emboscada, aleatorio y tímido). Son los del Pac-Man clásico, así cada fantasma se distingue por su forma de moverse.
- **No:** mantener la heurística de distancia Manhattan para el persecutor. Se atasca en muros y no garantiza llegar a Pac-Man.
- **Yes:** BFS para el persecutor, calculando distancias desde el objetivo y eligiendo el vecino más cercano. Garantiza una ruta correcta sin cambiar la regla de no dar la vuelta.
- **Yes:** `kind` `hunter` se mantiene para el persecutor. Evita renombrar código existente.
- **Yes:** salida escalonada por tiempo (ticks) en lugar de por puntos. Es predecible y no depende de la habilidad del jugador.
- **Yes:** los ticks de espera se reinician tras una colisión. Así el escalonado se nota en cada vida, no solo al inicio de la partida.
- **Yes:** objetivo de `shy` con radio de 8 celdas y esquina `{ x: 1, y: 29 }`. Valores iniciales ajustables como constantes.
- **Yes:** objetivo de `ambusher` a 4 celdas delante de Pac-Man, con respaldo a Pac-Man si la casilla es muro. Evita objetivos inalcanzables.
- **No:** modo asustado, scatter/chase y velocidad por fantasma. Cada uno merece su propia spec.
- **No:** nuevos sprites o colores. Los colores existentes en `GHOST_COLORS` bastan.
- **No:** guardar el escalonado entre sesiones. El estado vive solo en memoria, como el resto de la partida.

---

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| BFS por cada decisión de cada fantasma puede dar tirones en el navegador. | El laberinto tiene 868 casillas y 4 fantasmas. Si aparece lag, cachear la tabla de distancias por tick de Pac-Man. |
| El `ambusher` o el `shy` podrían apuntar a una casilla inalcanzable. | Recorte a límites y respaldo a Pac-Man (paso 4); esquina `{ x: 1, y: 29 }` verificada como casilla libre. |
| Un fantasma queda encerrado en la pen si `leaving` no encuentra ruta. | La BFS de salida usa `canMove` para fantasmas, que sí atraviesa la puerta (valor 3). Verificar en el paso 2. |

---

## What is **not** in this spec

- Modo asustado con power pellets.
- Ciclo scatter/chase.
- Velocidad distinta por fantasma.
- Cambios visuales en `render.js` más allá de los colores ya existentes.
- Puntos por fantasma comido y dificultad por nivel.

Cada una de estas, si se implementa, va en su propia spec.
