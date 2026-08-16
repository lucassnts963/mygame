import { describe, expect, it } from "vitest";
import { judgeAccusation } from "../src/accusation.ts";
import { collectClue, createGameState } from "../src/game-state.ts";
import type { CaseDefinition, GameState } from "../src/types.ts";
import { BARCARENA, solvableCase } from "./fixtures.ts";

/** Caderno com toda a sustentação da solução coletada. */
function fullyInformed(def: CaseDefinition): GameState {
  let state = createGameState(def);
  state = collectClue(def, state, "pista-cantaro", BARCARENA).state;
  state = collectClue(def, state, "pista-pegadas", { lat: -1.5095, lng: -48.624 }).state;
  state = collectClue(def, state, "pista-confissao").state;
  return state;
}

describe("judgeAccusation", () => {
  const def = solvableCase();

  it("TEST-22: culpado certo com a sustentação coletada resolve o caso", () => {
    const { state, verdict } = judgeAccusation(def, fullyInformed(def), "samaritana");

    expect(verdict).toMatchObject({ ok: true, reason: "solved" });
    if (!verdict.ok) throw new Error("esperava solved");
    expect(verdict.supportingClues).toEqual(["pista-cantaro", "pista-confissao"]);
    expect(state.accusation).toMatchObject({ culprit: "samaritana", reason: "solved" });
  });

  it("TEST-23: culpado certo sem sustentação é palpite, não dedução", () => {
    const halfway = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    const { state, verdict } = judgeAccusation(def, halfway, "samaritana");

    expect(verdict.ok).toBe(false);
    if (verdict.ok || verdict.reason !== "unsupported") throw new Error("esperava unsupported");
    expect(verdict.missing).toEqual(["pista-confissao"]);
    // Mesmo recusada, a acusação foi gasta: é uma por caso.
    expect(state.accusation).not.toBeNull();
  });

  it("TEST-24: culpado errado é veredito wrong", () => {
    const { verdict } = judgeAccusation(def, fullyInformed(def), "escriba");
    expect(verdict).toMatchObject({ ok: false, reason: "wrong" });
  });

  it("TEST-24: acusar quem não é personagem do caso é recusado", () => {
    const { verdict } = judgeAccusation(def, fullyInformed(def), "ninguem");
    expect(verdict).toMatchObject({ ok: false, reason: "unknown-character" });
  });

  it("TEST-24: acusar alguém inexistente não gasta a acusação", () => {
    const { state } = judgeAccusation(def, fullyInformed(def), "ninguem");
    expect(state.accusation).toBeNull();
  });

  it("TEST-25: a segunda acusação é recusada", () => {
    const first = judgeAccusation(def, fullyInformed(def), "escriba").state;
    const { state, verdict } = judgeAccusation(def, first, "samaritana");

    expect(verdict).toMatchObject({ ok: false, reason: "already-accused" });
    // O veredito original é preservado — a segunda tentativa não reescreve a história.
    expect(state.accusation).toMatchObject({ culprit: "escriba", reason: "wrong" });
  });

  it("TEST-22: não muta o estado anterior", () => {
    const before = fullyInformed(def);
    judgeAccusation(def, before, "samaritana");
    expect(before.accusation).toBeNull();
  });
});
