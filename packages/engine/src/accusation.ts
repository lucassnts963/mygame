import type { AccusationVerdict, CaseDefinition, GameState } from "./types.ts";

export interface AccusationResult {
  readonly state: GameState;
  readonly verdict: AccusationVerdict;
}

/**
 * Julga a acusação final do detetive.
 *
 * A regra que dá identidade ao jogo está em `unsupported`: acertar o culpado **sem** ter
 * coletado as pistas que sustentam a conclusão não resolve o caso. Num elenco pequeno, adivinhar
 * é fácil demais; exigir a sustentação é o que faz o jogo premiar dedução em vez de sorte.
 *
 * A acusação é gasta mesmo quando o veredito é negativo — é o que dá peso à decisão. A exceção é
 * acusar alguém que nem é do caso: isso é erro de entrada, não uma decisão do jogador, e seria
 * cruel cobrar por ele.
 */
export function judgeAccusation(
  caseDef: CaseDefinition,
  state: GameState,
  culprit: string,
): AccusationResult {
  if (state.accusation) {
    return { state, verdict: { ok: false, reason: "already-accused" } };
  }

  if (!caseDef.characters.some((c) => c.id === culprit)) {
    return { state, verdict: { ok: false, reason: "unknown-character" } };
  }

  const spend = (verdict: AccusationVerdict): AccusationResult => ({
    state: { ...state, accusation: { culprit, reason: verdict.reason } },
    verdict,
  });

  if (culprit !== caseDef.solution.culprit) {
    return spend({ ok: false, reason: "wrong" });
  }

  const missing = caseDef.solution.supportingClues.filter(
    (id) => !state.collectedClues.includes(id),
  );
  if (missing.length > 0) {
    return spend({ ok: false, reason: "unsupported", missing });
  }

  return spend({
    ok: true,
    reason: "solved",
    supportingClues: [...caseDef.solution.supportingClues],
  });
}
