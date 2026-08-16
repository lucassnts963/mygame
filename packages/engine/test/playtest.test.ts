import { describe, expect, it } from "vitest";
import { playtestCase } from "../src/playtest.ts";
import { BARCARENA, caseWith, solvableCase } from "./fixtures.ts";

describe("playtestCase", () => {
  it("TEST-26: percorre um caso solúvel e reporta a ordem das pistas", () => {
    const report = playtestCase(solvableCase());

    expect(report.solvable).toBe(true);
    expect(report.collectedOrder).toEqual([
      "pista-cantaro",
      "pista-pegadas",
      "pista-confissao",
    ]);
    expect(report.unreachable).toEqual([]);
    expect(report.issues).toEqual([]);
    expect(report.verdict).toMatchObject({ ok: true, reason: "solved" });
  });

  it("TEST-27: reprova um caso cuja sustentação nunca pode ser alcançada", () => {
    // A pista que sustenta a solução depende de si mesma: o detetive jamais a alcança.
    const broken = caseWith({
      clues: [
        {
          id: "pista-cantaro",
          title: "Cântaro",
          requires: [],
          anchor: { position: BARCARENA, radiusMeters: 25 },
          unlocksCharacters: ["samaritana"],
        },
        { id: "pista-presa", title: "Presa", requires: ["pista-presa"], unlocksCharacters: [] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["pista-cantaro", "pista-presa"] },
    });

    const report = playtestCase(broken);
    expect(report.solvable).toBe(false);
    expect(report.verdict).toMatchObject({ ok: false, reason: "unsupported" });
  });

  it("TEST-28: nomeia as pistas que ficaram inalcançáveis", () => {
    const broken = caseWith({
      clues: [
        {
          id: "pista-cantaro",
          title: "Cântaro",
          requires: [],
          anchor: { position: BARCARENA, radiusMeters: 25 },
          unlocksCharacters: ["samaritana"],
        },
        { id: "pista-orfa", title: "Órfã", requires: ["nao-existe"], unlocksCharacters: [] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["pista-cantaro"] },
    });

    const report = playtestCase(broken);
    expect(report.unreachable).toEqual(["pista-orfa"]);
    // A estrutura quebrada é reportada mesmo quando a solução por acaso continua alcançável.
    expect(report.issues.map((i) => i.kind)).toContain("dangling-requirement");
    expect(report.solvable).toBe(false);
  });

  it("TEST-27: reprova um caso com problema estrutural antes de percorrer", () => {
    const broken = caseWith({
      solution: { culprit: "ninguem", supportingClues: ["pista-cantaro"] },
    });
    const report = playtestCase(broken);
    expect(report.solvable).toBe(false);
    expect(report.issues.map((i) => i.kind)).toContain("unknown-culprit");
  });

  it("TEST-26: percorre a partir da origem escolhida para a partida (REQ-19)", () => {
    const report = playtestCase(solvableCase(), { origin: { lat: -23.5505, lng: -46.6333 } });
    expect(report.solvable).toBe(true);
    expect(report.collectedOrder).toHaveLength(3);
  });
});
