import { describe, expect, it } from "vitest";
import { judgeAccusation } from "../src/accusation.ts";
import { collectClue, createGameState } from "../src/game-state.ts";
import { caseOutcome } from "../src/outcome.ts";
import type { CaseDefinition, GameState } from "../src/types.ts";
import { BARCARENA, solvableCase } from "./fixtures.ts";

const PEGADAS = { lat: -1.5095, lng: -48.624 };

/** Coleta a lista de pistas informada, na ordem. */
function collected(def: CaseDefinition, ids: readonly string[]): GameState {
  let state = createGameState(def);
  for (const id of ids) {
    const clue = def.clues.find((c) => c.id === id);
    state = collectClue(def, state, id, clue?.anchor ? clue.anchor.position : undefined).state;
  }
  return state;
}

/** Estado com tudo coletado. */
function fullyExplored(def: CaseDefinition): GameState {
  return collected(def, ["pista-cantaro", "pista-pegadas", "pista-confissao"]);
}

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe("caseOutcome", () => {
  const def = solvableCase();

  it("TEST-01: devolve null enquanto a partida não acabou", () => {
    expect(caseOutcome(def, createGameState(def))).toBeNull();
    expect(caseOutcome(def, collected(def, ["pista-cantaro"]))).toBeNull();
  });

  it("TEST-02: solved quando acertou com a sustentação reunida", () => {
    const state = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(outcome?.verdict).toBe("solved");
    expect(outcome?.accused).toBe("samaritana");
    expect(outcome?.culprit).toBe("samaritana");
  });

  it("TEST-03: unsupported quando acertou a pessoa sem reunir a prova", () => {
    // O desfecho mais interessante do jogo: certo sobre quem, sem o que sustentava.
    const state = judgeAccusation(def, collected(def, ["pista-cantaro"]), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(outcome?.verdict).toBe("unsupported");
    expect(outcome?.accused).toBe("samaritana");
    expect(outcome?.culprit).toBe("samaritana");
  });

  it("TEST-04: wrong quando apontou a pessoa errada", () => {
    const state = judgeAccusation(def, fullyExplored(def), "escriba").state;
    const outcome = caseOutcome(def, state);

    expect(outcome?.verdict).toBe("wrong");
    expect(outcome?.accused).toBe("escriba");
    // Quem era, sempre — o jogador fica sabendo mesmo tendo errado.
    expect(outcome?.culprit).toBe("samaritana");
  });

  it("TEST-05: lista as pistas encontradas, com o texto do vestígio", () => {
    const state = judgeAccusation(def, collected(def, ["pista-cantaro"]), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(ids(outcome!.foundClues.map((c) => ({ id: c.clueId })))).toEqual(["pista-cantaro"]);
    expect(outcome?.foundClues[0]?.description).toContain("cântaro de barro");
  });

  it("TEST-06: lista as pistas que ficaram no mapa", () => {
    const state = judgeAccusation(def, collected(def, ["pista-cantaro"]), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(ids(outcome!.missedClues)).toEqual(["pista-pegadas", "pista-confissao"]);
  });

  it("TEST-06: as pistas perdidas trazem o texto — é a recompensa por terminar", () => {
    const state = judgeAccusation(def, createGameState(def), "samaritana").state;
    const outcome = caseOutcome(def, state);
    const cantaro = outcome?.missedClues.find((c) => c.id === "pista-cantaro");

    expect(cantaro?.description).toContain("cântaro de barro");
  });

  it("TEST-07: lista os personagens com quem nunca falou", () => {
    // Sem pista nenhuma, a samaritana nunca foi desbloqueada.
    const state = judgeAccusation(def, createGameState(def), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(ids(outcome!.missedCharacters)).toContain("samaritana");
  });

  it("TEST-07: personagem desbloqueado não conta como perdido", () => {
    const state = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(ids(outcome!.missedCharacters)).not.toContain("samaritana");
  });

  it("TEST-08: caso totalmente explorado devolve listas vazias, não ausentes", () => {
    const state = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(outcome?.missedClues).toEqual([]);
    expect(outcome?.missedCharacters).toEqual([]);
    expect(outcome?.foundClues).toHaveLength(3);
  });

  it("TEST-02: carrega o caminho da página de revelação quando o caso declara uma", () => {
    const comReveal: CaseDefinition = {
      ...def,
      solution: { ...def.solution, reveal: "casos/a-verdade" },
    };
    const state = judgeAccusation(comReveal, fullyExplored(comReveal), "samaritana").state;

    expect(caseOutcome(comReveal, state)?.reveal).toBe("casos/a-verdade");
  });

  it("TEST-01: um caso sem revelação não ganha campo vazio", () => {
    const state = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    expect(caseOutcome(def, state)).not.toHaveProperty("reveal");
  });

  it("TEST-01: acusação de personagem inexistente não gera desfecho", () => {
    // `judgeAccusation` recusa sem gastar a acusação, então a partida continua.
    const { state } = judgeAccusation(def, fullyExplored(def), "ninguem");
    expect(caseOutcome(def, state)).toBeNull();
  });

  it("TEST-01: um motivo não terminal gravado no estado não vira desfecho", () => {
    // `already-accused` nunca chega a ser gravado por `judgeAccusation` — a acusação original
    // permanece. Mas o estado é serializado e volta do banco, e um desfecho montado a partir de
    // um motivo que não é veredito mostraria "Não foi quem você pensou" para quem nem acusou.
    const base = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    const state: GameState = {
      ...base,
      accusation: { culprit: "samaritana", reason: "already-accused" as never },
    };

    expect(caseOutcome(def, state)).toBeNull();
  });

  it("TEST-05: ignora id coletado que não existe mais no caso", () => {
    const base = judgeAccusation(def, collected(def, ["pista-cantaro"]), "samaritana").state;
    const state: GameState = { ...base, collectedClues: [...base.collectedClues, "pista-removida"] };

    expect(caseOutcome(def, state)?.foundClues.map((c) => c.clueId)).toEqual(["pista-cantaro"]);
  });

  it("TEST-06: usa a coleta por conversa também — pista sem âncora conta como encontrada", () => {
    const state = judgeAccusation(def, fullyExplored(def), "samaritana").state;
    const outcome = caseOutcome(def, state);

    expect(outcome?.foundClues.map((c) => c.clueId)).toContain("pista-confissao");
    expect(ids(outcome!.missedClues)).not.toContain("pista-confissao");
  });

  it("TEST-08: uma partida com pistas parciais separa encontradas e perdidas sem sobreposição", () => {
    const state = judgeAccusation(def, collected(def, ["pista-cantaro"]), "escriba").state;
    const outcome = caseOutcome(def, state)!;

    const found = outcome.foundClues.map((c) => c.clueId);
    const missed = ids(outcome.missedClues);
    expect(found.filter((id) => missed.includes(id))).toEqual([]);
    expect(found.length + missed.length).toBe(def.clues.length);
  });
});

describe("caseOutcome — com o cenário do piloto", () => {
  it("TEST-03: o jogador que só achou o cântaro e acusou certo recebe unsupported", () => {
    const def = solvableCase();
    const state = judgeAccusation(def, collected(def, ["pista-cantaro"]), "samaritana").state;
    const outcome = caseOutcome(def, state)!;

    expect(outcome.verdict).toBe("unsupported");
    expect(ids(outcome.missedClues)).toHaveLength(2);
  });

  it("TEST-06: quem andou o mapa mas não arrancou a confissão perde só ela", () => {
    const def = solvableCase();
    const state = judgeAccusation(
      def,
      collected(def, ["pista-cantaro", "pista-pegadas"]),
      "samaritana",
    ).state;

    expect(ids(caseOutcome(def, state)!.missedClues)).toEqual(["pista-confissao"]);
  });
});

// `BARCARENA` e `PEGADAS` documentam as âncoras usadas pelo fixture.
void BARCARENA;
void PEGADAS;
