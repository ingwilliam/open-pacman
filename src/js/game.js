// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.
// Cada fantasma sigue su 'kind' (hunter, ambusher, random, shy) y pasa por las
// fases waiting -> leaving -> active. Las distancias se calculan por BFS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Ticks de espera dentro de la pen antes de salir, por tipo de fantasma.
// El hunter sale en el primer update; el resto espera 2, 4 y 6 s a 60 fps.
const GHOST_RELEASE_TICKS = { hunter: 0, ambusher: 120, random: 240, shy: 360 };
// Interior de la pen donde esperan los fantasmas en fase 'waiting'.
const PEN_INTERIOR = { minX: 11, maxX: 16, minY: 13, maxY: 15 };
// Casilla por encima de la puerta a la que se dirigen los fantasmas al salir.
const PEN_EXIT = { x: 13, y: 11 };
// Celdas por delante de Pac-Man que usa el 'ambusher' como objetivo.
const AMBUSH_AHEAD = 4;
// El 'shy' persigue si Pac-Man está a más de SHY_RADIUS celdas (Manhattan);
// si no, se retira a SHY_CORNER.
const SHY_RADIUS = 8;
const SHY_CORNER = { x: 1, y: 29 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    ticks: 0,
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      phase: 'waiting',
      releaseTick: GHOST_RELEASE_TICKS[ g.kind ],
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Devuelve true si la casilla (x,y) está dentro del interior de la pen.
function isInsidePen( x, y ) {
  return x >= PEN_INTERIOR.minX && x <= PEN_INTERIOR.maxX
    && y >= PEN_INTERIOR.minY && y <= PEN_INTERIOR.maxY;
}

// Criterio que acepta cualquier casilla transitable.
function anyCell() {
  return true;
}

// Direcciones válidas para el fantasma g que además cumplen isAllowedCell.
// No da la vuelta salvo en callejón sin salida (regla existente): en ese caso
// devuelve solo el giro de 180.
function ghostOptions( game, g, isAllowedCell ) {
  const dirs = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( game.grid, g.x, g.y, dir, 'ghost' )
  );
  const allowed = dirs.filter(
    ( dir ) => isAllowedCell( g.x + DIRS[ dir ].x, g.y + DIRS[ dir ].y )
  );
  if ( allowed.length ) return allowed;
  return [ OPPOSITE[ g.dir ] ];
}

// Celda que se alcanza desde cell moviéndose en dir. En la fila del túnel,
// salir por un borde entra por el otro lado.
function neighborCell( cell, dir, width ) {
  const d = DIRS[ dir ];
  const x = cell.x + d.x;
  const y = cell.y + d.y;
  if ( y === TUNNEL_ROW ) return { x: ( x + width ) % width, y };
  return { x, y };
}

// Distancia en pasos desde target a cada casilla transitable para un fantasma
// (BFS). Las casillas inalcanzables quedan en Infinity.
function distancesFrom( grid, target ) {
  const width = grid[ 0 ].length;
  const dist = grid.map( ( row ) => row.map( () => Infinity ) );
  dist[ target.y ][ target.x ] = 0;

  const queue = [ target ];
  for ( let i = 0; i < queue.length; i++ ) {
    const cell = queue[ i ];
    for ( const dir of Object.keys( DIRS ) ) {
      if ( !canMove( grid, cell.x, cell.y, dir, 'ghost' ) ) continue;
      const next = neighborCell( cell, dir, width );
      if ( dist[ next.y ][ next.x ] !== Infinity ) continue;
      dist[ next.y ][ next.x ] = dist[ cell.y ][ cell.x ] + 1;
      queue.push( next );
    }
  }
  return dist;
}

// De las direcciones dadas, elige la que lleva al fantasma a la casilla
// de menor distancia según la tabla de distancias.
function closestDir( g, dirs, distances ) {
  const width = distances[ 0 ].length;
  let best = dirs[ 0 ];
  let bestDist = Infinity;
  for ( const dir of dirs ) {
    const next = neighborCell( g, dir, width );
    const dist = distances[ next.y ][ next.x ];
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

// Decide la siguiente dirección de un fantasma alineado con una casilla.
// Según su fase: 'waiting' vaga dentro de la pen; 'leaving' se dirige a PEN_EXIT;
// 'active' persigue (hunter) o se mueve al azar.
function decideGhost( game, g ) {
  if ( g.phase === 'waiting' ) {
    const options = ghostOptions( game, g, isInsidePen );
    g.dir = options[ Math.floor( Math.random() * options.length ) ];
    return;
  }

  if ( g.phase === 'leaving' ) {
    const options = ghostOptions( game, g, anyCell );
    g.dir = closestDir( g, options, distancesFrom( game.grid, PEN_EXIT ) );
    return;
  }

  const options = ghostOptions( game, g, anyCell );
  if ( g.kind === 'hunter' ) {
    const target = { x: Math.round( game.pacman.x ), y: Math.round( game.pacman.y ) };
    g.dir = closestDir( g, options, distancesFrom( game.grid, target ) );
    return;
  }
  if ( g.kind === 'ambusher' ) {
    g.dir = closestDir( g, options, distancesFrom( game.grid, ambushTarget( game ) ) );
    return;
  }
  if ( g.kind === 'shy' ) {
    const target = shyTarget( game, g );
    g.dir = closestDir( g, options, distancesFrom( game.grid, target ) );
    return;
  }
  g.dir = options[ Math.floor( Math.random() * options.length ) ];
}

// Objetivo del 'ambusher': la casilla AMBUSH_AHEAD celdas delante de Pac-Man,
// recortada a los límites del laberinto. Si cae en un muro se usa la casilla
// de Pac-Man, para no apuntar a un destino inalcanzable.
function ambushTarget( game ) {
  const grid = game.grid;
  const height = grid.length;
  const width = grid[ 0 ].length;
  const px = Math.round( game.pacman.x );
  const py = Math.round( game.pacman.y );
  const d = DIRS[ game.pacman.dir ];

  const aheadX = clamp( px + d.x * AMBUSH_AHEAD, 0, width - 1 );
  const aheadY = clamp( py + d.y * AMBUSH_AHEAD, 0, height - 1 );
  if ( isWall( grid, aheadX, aheadY, 'ghost' ) ) return { x: px, y: py };
  return { x: aheadX, y: aheadY };
}

// Objetivo del 'shy': Pac-Man si está a más de SHY_RADIUS celdas del fantasma
// (distancia Manhattan), o la esquina SHY_CORNER si está más cerca.
function shyTarget( game, g ) {
  const px = Math.round( game.pacman.x );
  const py = Math.round( game.pacman.y );
  const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
  if ( dist > SHY_RADIUS ) return { x: px, y: py };
  return SHY_CORNER;
}

// Limita v al intervalo [min, max].
function clamp( v, min, max ) {
  return Math.min( Math.max( v, min ), max );
}

// Cambia la fase del fantasma: 'waiting' -> 'leaving' al cumplir releaseTick,
// y 'leaving' -> 'active' al llegar a PEN_EXIT.
function updateGhostPhase( game, g ) {
  if ( g.phase === 'waiting' && game.ticks >= g.releaseTick ) {
    g.phase = 'leaving';
    return;
  }
  const atExit = Math.round( g.x ) === PEN_EXIT.x && Math.round( g.y ) === PEN_EXIT.y;
  if ( g.phase === 'leaving' && atExit ) g.phase = 'active';
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.phase = 'waiting';
    g.releaseTick = game.ticks + GHOST_RELEASE_TICKS[ g.kind ];
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.ticks++;
  movePacman( game );
  game.ghosts.forEach( ( g ) => {
    updateGhostPhase( game, g );
    moveGhost( game, g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
