import { missingPrerequisites, unlockedClueIds } from "./clue-graph.ts";
import { distanceMeters, resolveAnchor } from "./geo.ts";
import type {
  Anchor,
  CaseDefinition,
  CharacterRef,
  ClueDefinition,
  CollectVerdict,
  GameState,
  LatLng,
  NotebookEntry,
} from "./types.ts";

export interface GameStateOptions {
  /** Origem desta partida. Definir relocaliza o caso inteiro (REQ-19). */
  readonly origin?: LatLng;
}

export function createGameState(caseDef: CaseDefinition, options: GameStateOptions = {}): GameState {
  return {
    caseId: caseDef.id,
    collectedClues: [],
    accusation: null,
    origin: options.origin ?? null,
  };
}

function findClue(caseDef: CaseDefinition, clueId: string): ClueDefinition | undefined {
  return caseDef.clues.find((c) => c.id === clueId);
}

/** Âncora da pista já reposicionada para a origem da partida. */
export function effectiveAnchor(
  caseDef: CaseDefinition,
  state: GameState,
  clue: ClueDefinition,
): Anchor | undefined {
  if (!clue.anchor) return undefined;
  return resolveAnchor(clue.anchor, caseDef.origin, state.origin);
}

/**
 * O detetive pode coletar esta pista agora?
 *
 * A ordem das verificações é deliberada: uma pista bloqueada é recusada como `locked` mesmo que
 * o jogador também esteja longe. Dizer "faltam 3 km" para algo que ele nem devia procurar ainda
 * o mandaria atravessar a cidade à toa.
 */
export function canCollect(
  caseDef: CaseDefinition,
  state: GameState,
  clueId: string,
  position?: LatLng,
): CollectVerdict {
  const clue = findClue(caseDef, clueId);
  if (!clue) return { ok: false, reason: "unknown-clue" };

  // Idempotência antes de tudo: o que já está no caderno não sai dele por oscilação de GPS (NFR-06).
  if (state.collectedClues.includes(clueId)) return { ok: true, reason: "already-collected" };

  const missing = missingPrerequisites(clue, state.collectedClues);
  if (missing.length > 0) return { ok: false, reason: "locked", missing };

  const anchor = effectiveAnchor(caseDef, state, clue);
  if (!anchor) return { ok: true, reason: "ok" }; // pista sem lugar: só um personagem concede

  if (!position) return { ok: false, reason: "position-required" };

  const distance = distanceMeters(position, anchor.position);
  if (distance > anchor.radiusMeters) {
    return {
      ok: false,
      reason: "too-far",
      distanceMeters: distance,
      missingMeters: distance - anchor.radiusMeters,
    };
  }

  return { ok: true, reason: "ok" };
}

export interface CollectResult {
  readonly state: GameState;
  readonly verdict: CollectVerdict;
}

/**
 * Tenta coletar uma pista. Devolve estado novo em caso de sucesso e **o mesmo objeto de estado**
 * quando recusa — assim o chamador pode comparar por identidade para saber se algo mudou.
 */
export function collectClue(
  caseDef: CaseDefinition,
  state: GameState,
  clueId: string,
  position?: LatLng,
): CollectResult {
  const verdict = canCollect(caseDef, state, clueId, position);
  if (!verdict.ok || verdict.reason === "already-collected") return { state, verdict };

  return {
    state: { ...state, collectedClues: [...state.collectedClues, clueId] },
    verdict,
  };
}

/** Pistas que o mapa deve mostrar agora: desbloqueadas e ainda não coletadas (REQ-01). */
export function visibleClues(caseDef: CaseDefinition, state: GameState): readonly ClueDefinition[] {
  const unlocked = unlockedClueIds(caseDef, state.collectedClues);
  return caseDef.clues.filter(
    (clue) => unlocked.includes(clue.id) && !state.collectedClues.includes(clue.id),
  );
}

/** Personagens que o detetive já pode interrogar. */
export function unlockedCharacters(
  caseDef: CaseDefinition,
  state: GameState,
): readonly CharacterRef[] {
  return caseDef.characters.filter((character) =>
    character.requires.every((id) => state.collectedClues.includes(id)),
  );
}

/**
 * O caderno do detetive: o que foi descoberto e o que cada descoberta abriu.
 *
 * Ids que não existem mais no caso são ignorados em silêncio — um módulo editado entre partidas
 * pode ter removido uma pista, e isso não é motivo para quebrar o caderno de quem já jogou.
 */
export function notebook(caseDef: CaseDefinition, state: GameState): readonly NotebookEntry[] {
  const entries: NotebookEntry[] = [];

  for (const clueId of state.collectedClues) {
    const clue = findClue(caseDef, clueId);
    if (!clue) continue;

    entries.push({
      clueId: clue.id,
      title: clue.title,
      unlockedClues: caseDef.clues.filter((c) => c.requires.includes(clue.id)).map((c) => c.id),
      unlockedCharacters: [...clue.unlocksCharacters],
    });
  }
  return entries;
}
