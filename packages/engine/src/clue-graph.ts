import type { CaseDefinition, ClueDefinition, GraphIssue } from "./types.ts";

/**
 * Limites de raio de geofence, espelhando `.specs/config.md## Game Constants`.
 * Abaixo do mínimo o erro de GPS torna a pista inalcançável; acima do máximo ela deixa de
 * exigir deslocamento real.
 */
export const MIN_RADIUS_METERS = 10;
export const MAX_RADIUS_METERS = 500;

/** Pré-requisitos de `clue` que ainda não estão no caderno. */
export function missingPrerequisites(
  clue: ClueDefinition,
  collected: readonly string[],
): readonly string[] {
  return clue.requires.filter((id) => !collected.includes(id));
}

/** Ids das pistas cujos pré-requisitos estão satisfeitos, na ordem em que o caso as declara. */
export function unlockedClueIds(
  caseDef: CaseDefinition,
  collected: readonly string[],
): readonly string[] {
  return caseDef.clues
    .filter((clue) => missingPrerequisites(clue, collected).length === 0)
    .map((clue) => clue.id);
}

/**
 * Conjunto de pistas que um detetive perfeito consegue reunir, por ponto fixo: parte do caderno
 * vazio e vai acrescentando tudo que estiver desbloqueado, até não haver progresso.
 *
 * O que sobrar fora do conjunto é inalcançável — e essa é a definição geral: cobre ciclos,
 * cadeias presas a um ciclo e dependências para ids inexistentes, sem precisar de um caso
 * especial para cada um.
 */
export function reachableClueIds(caseDef: CaseDefinition): readonly string[] {
  const reached: string[] = [];
  let progressed = true;

  while (progressed) {
    progressed = false;
    for (const clue of caseDef.clues) {
      if (reached.includes(clue.id)) continue;
      if (missingPrerequisites(clue, reached).length > 0) continue;
      reached.push(clue.id);
      progressed = true;
    }
  }
  return reached;
}

/** Ids de pista que participam de um ciclo de `requires`. */
function findCycles(caseDef: CaseDefinition): readonly string[] {
  const byId = new Map(caseDef.clues.map((c) => [c.id, c]));
  const inCycle = new Set<string>();

  const visit = (id: string, path: string[]): void => {
    const cycleStart = path.indexOf(id);
    if (cycleStart !== -1) {
      for (const member of path.slice(cycleStart)) inCycle.add(member);
      return;
    }
    const clue = byId.get(id);
    if (!clue) return;
    for (const req of clue.requires) visit(req, [...path, id]);
  };

  for (const clue of caseDef.clues) visit(clue.id, []);
  return [...inCycle];
}

/**
 * Verifica a integridade estrutural do caso: é o que impede um módulo quebrado de virar uma
 * partida travada. Roda antes de jogar (validação de módulo) e antes do playtest.
 */
export function validateClueGraph(caseDef: CaseDefinition): readonly GraphIssue[] {
  const issues: GraphIssue[] = [];
  const clueIds = caseDef.clues.map((c) => c.id);
  const characterIds = caseDef.characters.map((c) => c.id);

  const seen = new Set<string>();
  for (const id of clueIds) {
    if (seen.has(id)) {
      issues.push({ kind: "duplicate-clue-id", clueId: id, detail: `pista '${id}' declarada mais de uma vez` });
    }
    seen.add(id);
  }

  for (const clue of caseDef.clues) {
    for (const req of clue.requires) {
      if (!clueIds.includes(req)) {
        issues.push({
          kind: "dangling-requirement",
          clueId: clue.id,
          detail: `'${clue.id}' exige a pista '${req}', que não existe no caso`,
        });
      }
    }
    for (const characterId of clue.unlocksCharacters) {
      if (!characterIds.includes(characterId)) {
        issues.push({
          kind: "unknown-character",
          clueId: clue.id,
          detail: `'${clue.id}' destrava o personagem '${characterId}', que não existe no caso`,
        });
      }
    }
    if (clue.anchor) {
      const { radiusMeters } = clue.anchor;
      if (radiusMeters < MIN_RADIUS_METERS || radiusMeters > MAX_RADIUS_METERS) {
        issues.push({
          kind: "radius-out-of-range",
          clueId: clue.id,
          detail: `raio de ${radiusMeters} m fora do intervalo permitido (${MIN_RADIUS_METERS}–${MAX_RADIUS_METERS} m)`,
        });
      }
    }
  }

  for (const character of caseDef.characters) {
    for (const req of character.requires) {
      if (!clueIds.includes(req)) {
        issues.push({
          kind: "dangling-requirement",
          detail: `o personagem '${character.id}' exige a pista '${req}', que não existe no caso`,
        });
      }
    }
  }

  for (const id of findCycles(caseDef)) {
    issues.push({ kind: "cycle", clueId: id, detail: `'${id}' participa de um ciclo de pré-requisitos` });
  }

  const reachable = reachableClueIds(caseDef);
  for (const id of clueIds) {
    // Pista em ciclo já foi reportada como `cycle`; reportá-la de novo como inalcançável
    // seria ruído em cima do mesmo defeito.
    if (!reachable.includes(id) && !issues.some((i) => i.kind === "cycle" && i.clueId === id)) {
      issues.push({ kind: "unreachable", clueId: id, detail: `'${id}' nunca fica alcançável` });
    }
  }

  if (!characterIds.includes(caseDef.solution.culprit)) {
    issues.push({
      kind: "unknown-culprit",
      detail: `a solução acusa '${caseDef.solution.culprit}', que não é personagem do caso`,
    });
  }
  for (const id of caseDef.solution.supportingClues) {
    if (!clueIds.includes(id)) {
      issues.push({
        kind: "unknown-supporting-clue",
        detail: `a solução se apoia na pista '${id}', que não existe no caso`,
      });
    }
  }

  return issues;
}
