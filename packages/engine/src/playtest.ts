import { judgeAccusation } from "./accusation.ts";
import { reachableClueIds, validateClueGraph } from "./clue-graph.ts";
import { collectClue, createGameState, effectiveAnchor, visibleClues } from "./game-state.ts";
import type { CaseDefinition, GameState, LatLng, PlaytestReport } from "./types.ts";

export interface PlaytestOptions {
  /** Origem da partida simulada, como se o jogador estivesse em outra cidade (REQ-19). */
  readonly origin?: LatLng;
}

/**
 * Percorre o caso como um detetive perfeito: a cada passo, vai até cada pista visível e a coleta,
 * até não sobrar nenhuma alcançável. Ao final, acusa o culpado declarado na solução.
 *
 * O ponto do playtest é responder à pergunta que só se descobriria na rua: **este caso fecha?**
 * Um `requires` escrito errado transforma o caso num beco sem saída, e sem isto o autor só
 * descobriria depois de andar até a pista. Por isso o percurso usa exatamente as mesmas funções
 * que o servidor usa em partida — um caso aprovado aqui não pode travar lá.
 */
export function playtestCase(
  caseDef: CaseDefinition,
  options: PlaytestOptions = {},
): PlaytestReport {
  const issues = validateClueGraph(caseDef);
  const reachable = reachableClueIds(caseDef);
  const unreachable = caseDef.clues.map((c) => c.id).filter((id) => !reachable.includes(id));

  let state: GameState = createGameState(
    caseDef,
    options.origin ? { origin: options.origin } : {},
  );
  const collectedOrder: string[] = [];

  // Cada volta coleta tudo que está visível agora; coletar destrava novas pistas, e o laço
  // termina quando uma volta inteira não acrescenta nada.
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const clue of visibleClues(caseDef, state)) {
      // O detetive simulado se teletransporta até a âncora — o que se testa aqui é o grafo
      // de pistas, não a caminhada.
      const anchor = effectiveAnchor(caseDef, state, clue);
      const result = collectClue(caseDef, state, clue.id, anchor?.position);
      // Uma pista visível, alcançada na própria âncora, sempre coleta — então este `if` é
      // hoje inalcançável pelo lado falso, e a cobertura o acusa. Ele fica assim mesmo: é o que
      // impede `progressed = true` de rodar sem o estado avançar, ou seja, um laço infinito.
      // Guarda de terminação vale mais que um ponto de cobertura.
      if (result.verdict.ok) {
        state = result.state;
        collectedOrder.push(clue.id);
        progressed = true;
      }
    }
  }

  const { verdict } = judgeAccusation(caseDef, state, caseDef.solution.culprit);

  return {
    caseId: caseDef.id,
    // Um caso só passa se fecha **e** está estruturalmente íntegro: uma pista órfã que não
    // impede a solução ainda é conteúdo que o jogador nunca verá, e o autor precisa saber.
    solvable: verdict.ok && issues.length === 0 && unreachable.length === 0,
    collectedOrder,
    unreachable,
    issues,
    verdict,
  };
}
