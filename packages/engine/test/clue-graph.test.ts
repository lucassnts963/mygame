import { describe, expect, it } from "vitest";
import {
  missingPrerequisites,
  unlockedClueIds,
  validateClueGraph,
} from "../src/clue-graph.ts";
import { BARCARENA, caseWith, solvableCase } from "./fixtures.ts";

const kinds = (issues: readonly { kind: string }[]) => issues.map((i) => i.kind);

describe("unlockedClueIds", () => {
  it("TEST-07: começa liberando só as pistas sem pré-requisito", () => {
    expect(unlockedClueIds(solvableCase(), [])).toEqual(["pista-cantaro"]);
  });

  it("TEST-08: libera a dependente assim que o pré-requisito entra no caderno", () => {
    expect(unlockedClueIds(solvableCase(), ["pista-cantaro"])).toEqual([
      "pista-cantaro",
      "pista-pegadas",
    ]);
  });

  it("TEST-08: libera a cadeia inteira com o caderno completo", () => {
    const all = unlockedClueIds(solvableCase(), ["pista-cantaro", "pista-pegadas"]);
    expect(all).toContain("pista-confissao");
  });
});

describe("missingPrerequisites", () => {
  it("TEST-07: lista o que falta para uma pista bloqueada", () => {
    const clue = solvableCase().clues[1]!;
    expect(missingPrerequisites(clue, [])).toEqual(["pista-cantaro"]);
  });

  it("TEST-07: devolve vazio quando tudo já foi coletado", () => {
    const clue = solvableCase().clues[1]!;
    expect(missingPrerequisites(clue, ["pista-cantaro"])).toEqual([]);
  });
});

describe("validateClueGraph", () => {
  it("TEST-09/10/11/12: aprova um caso bem formado", () => {
    expect(validateClueGraph(solvableCase())).toEqual([]);
  });

  it("TEST-09: detecta ciclo em requires", () => {
    const broken = caseWith({
      clues: [
        { id: "a", title: "A", requires: ["b"], unlocksCharacters: [] },
        { id: "b", title: "B", requires: ["a"], unlocksCharacters: [] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["a"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("cycle");
  });

  it("TEST-10: detecta requires apontando para pista inexistente", () => {
    const broken = caseWith({
      clues: [{ id: "a", title: "A", requires: ["fantasma"], unlocksCharacters: [] }],
      solution: { culprit: "samaritana", supportingClues: ["a"] },
    });
    const issues = validateClueGraph(broken);
    expect(kinds(issues)).toContain("dangling-requirement");
    expect(issues.find((i) => i.kind === "dangling-requirement")?.detail).toContain("fantasma");
  });

  it("TEST-11: detecta pista que nunca fica alcançável", () => {
    const broken = caseWith({
      clues: [
        { id: "raiz", title: "Raiz", requires: [], unlocksCharacters: [] },
        { id: "presa", title: "Presa", requires: ["ciclo-a"], unlocksCharacters: [] },
        { id: "ciclo-a", title: "A", requires: ["ciclo-b"], unlocksCharacters: [] },
        { id: "ciclo-b", title: "B", requires: ["ciclo-a"], unlocksCharacters: [] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["raiz"] },
    });
    const unreachable = validateClueGraph(broken)
      .filter((i) => i.kind === "unreachable")
      .map((i) => i.clueId);
    expect(unreachable).toContain("presa");
    expect(unreachable).not.toContain("raiz");
  });

  it("TEST-12: detecta raio menor que o mínimo", () => {
    const broken = caseWith({
      clues: [
        {
          id: "pista-cantaro",
          title: "Cântaro",
          requires: [],
          anchor: { position: BARCARENA, radiusMeters: 3 },
          unlocksCharacters: [],
        },
      ],
      solution: { culprit: "samaritana", supportingClues: ["pista-cantaro"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("radius-out-of-range");
  });

  it("TEST-12: detecta raio maior que o máximo", () => {
    const broken = caseWith({
      clues: [
        {
          id: "pista-cantaro",
          title: "Cântaro",
          requires: [],
          anchor: { position: BARCARENA, radiusMeters: 2000 },
          unlocksCharacters: [],
        },
      ],
      solution: { culprit: "samaritana", supportingClues: ["pista-cantaro"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("radius-out-of-range");
  });

  it("TEST-11: detecta solução que aponta para pista inexistente", () => {
    const broken = caseWith({
      solution: { culprit: "samaritana", supportingClues: ["pista-que-nao-existe"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("unknown-supporting-clue");
  });

  it("TEST-11: detecta culpado que não é personagem do caso", () => {
    const broken = caseWith({
      solution: { culprit: "ninguem", supportingClues: ["pista-cantaro"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("unknown-culprit");
  });

  it("TEST-10: detecta personagem que exige pista inexistente", () => {
    const broken = caseWith({
      characters: [{ id: "samaritana", name: "A mulher", requires: ["fantasma"] }],
    });
    expect(kinds(validateClueGraph(broken))).toContain("dangling-requirement");
  });

  it("TEST-10: detecta ids de pista duplicados", () => {
    const broken = caseWith({
      clues: [
        { id: "a", title: "A", requires: [], unlocksCharacters: [] },
        { id: "a", title: "A de novo", requires: [], unlocksCharacters: [] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["a"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("duplicate-clue-id");
  });

  it("TEST-10: detecta pista que destrava personagem inexistente", () => {
    const broken = caseWith({
      clues: [
        { id: "a", title: "A", requires: [], unlocksCharacters: ["ninguem"] },
      ],
      solution: { culprit: "samaritana", supportingClues: ["a"] },
    });
    expect(kinds(validateClueGraph(broken))).toContain("unknown-character");
  });
});
