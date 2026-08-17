import { notebook, unlockedCharacters } from "./game-state.ts";
import type {
  CaseDefinition,
  CaseOutcome,
  CharacterRef,
  ClueDefinition,
  GameState,
} from "./types.ts";

/**
 * O desfecho do caso: o que o detetive concluiu, o que reuniu e **o que deixou para trás**.
 *
 * Devolve `null` enquanto a partida não terminou. Só existe fim por acusação — abandonar um caso
 * não produz desfecho, porque não houve conclusão a julgar.
 *
 * Vive no motor, e não na tela, pelo mesmo motivo do resto do domínio (ADR-004): é regra de jogo,
 * é testável sem aparelho, e o playtest passa a poder afirmar "este caso tem desfecho" além de
 * "este caso fecha".
 */
export function caseOutcome(caseDef: CaseDefinition, state: GameState): CaseOutcome | null {
  const accusation = state.accusation;
  if (!accusation) return null;

  // `already-accused` e `unknown-character` não são desfechos: o primeiro nunca chega a ser
  // gravado (a acusação original permanece) e o segundo não gasta a acusação.
  if (accusation.reason !== "solved" && accusation.reason !== "unsupported" && accusation.reason !== "wrong") {
    return null;
  }

  const found = notebook(caseDef, state);
  const foundIds = found.map((entry) => entry.clueId);
  const unlocked = unlockedCharacters(caseDef, state).map((c) => c.id);

  const missedClues: ClueDefinition[] = caseDef.clues.filter((clue) => !foundIds.includes(clue.id));
  const missedCharacters: CharacterRef[] = caseDef.characters.filter(
    (character) => !unlocked.includes(character.id),
  );

  return {
    verdict: accusation.reason,
    accused: accusation.culprit,
    // Quem era, **sempre** — inclusive para quem errou. A acusação é uma só e o caso acabou de
    // qualquer forma; um mistério sem resposta não fecha.
    culprit: caseDef.solution.culprit,
    foundClues: found,
    // As perdidas vêm com o texto: a partida acabou, então não há nada a proteger, e ver o que
    // ficou pelo caminho é a recompensa por terminar — além do motivo para querer o próximo caso.
    missedClues,
    missedCharacters,
    ...(caseDef.solution.reveal ? { reveal: caseDef.solution.reveal } : {}),
  };
}
