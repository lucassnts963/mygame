/**
 * `@vestigio/engine` — o domínio puro do Vestígio.
 *
 * Este pacote não declara nenhuma dependência de runtime, e isso é proposital (ADR-004): é a
 * forma mais barata de garantir que a regra de jogo permaneça sem I/O. O servidor, o playtest e
 * o validador de módulos importam daqui; nada aqui importa deles.
 */
export * from "./types.ts";
export { bearingDegrees, distanceMeters, isWithinGeofence, resolveAnchor } from "./geo.ts";
export {
  MAX_RADIUS_METERS,
  MIN_RADIUS_METERS,
  missingPrerequisites,
  reachableClueIds,
  unlockedClueIds,
  validateClueGraph,
} from "./clue-graph.ts";
export {
  canCollect,
  collectClue,
  createGameState,
  effectiveAnchor,
  notebook,
  unlockedCharacters,
  visibleClues,
} from "./game-state.ts";
export type { CollectResult, GameStateOptions } from "./game-state.ts";
export { judgeAccusation } from "./accusation.ts";
export type { AccusationResult } from "./accusation.ts";
export { playtestCase } from "./playtest.ts";
export type { PlaytestOptions } from "./playtest.ts";
