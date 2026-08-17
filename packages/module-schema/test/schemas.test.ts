import { describe, expect, it } from "vitest";
import { toCaseDefinition, validateAgentDocument, validateCaseDocument } from "../src/schemas/index.ts";

function validCase(): Record<string, unknown> {
  return {
    id: "poco-de-jaco",
    title: "O Cântaro Abandonado",
    origin: { lat: -1.5089, lng: -48.6247 },
    clues: [
      {
        id: "pista-cantaro",
        title: "O cântaro abandonado",
        requires: [],
        anchor: { lat: -1.5089, lng: -48.6247, radius: 25 },
        unlocks_characters: ["samaritana"],
      },
      { id: "pista-confissao", title: "A confissão", requires: ["pista-cantaro"] },
    ],
    characters: [
      { id: "samaritana", name: "A mulher do poço", requires: [], agent: "agents/samaritana.agent.yaml" },
    ],
    solution: { culprit: "samaritana", supporting_clues: ["pista-cantaro", "pista-confissao"] },
  };
}

function validAgent(): Record<string, unknown> {
  return {
    id: "samaritana",
    name: "A mulher do poço",
    persona: "Você é uma mulher de Samaria, ao meio-dia, junto ao poço.",
    provider: { base_url: "https://api.openai.com/v1", model: "gpt-4o-mini", api_key_env: "VESTIGIO_KEY" },
    skills: ["interrogar-testemunha"],
    lore: ["personagens/samaritana"],
  };
}

const codes = (ds: readonly { code: string }[]) => ds.map((d) => d.code);

describe("validateCaseDocument", () => {
  it("TEST-14: aceita um caso válido", () => {
    expect(validateCaseDocument(validCase(), "case.yaml")).toEqual([]);
  });

  it("TEST-15: recusa id fora de kebab-case", () => {
    const doc = { ...validCase(), id: "Poço De Jacó" };
    expect(codes(validateCaseDocument(doc, "case.yaml"))).toContain("schema-invalid");
  });

  it("TEST-16: recusa caso sem solução", () => {
    const doc = validCase();
    delete doc["solution"];
    const ds = validateCaseDocument(doc, "case.yaml");
    expect(codes(ds)).toContain("schema-invalid");
    expect(ds[0]?.message).toContain("solution");
  });

  it("TEST-16: recusa pista sem título", () => {
    const doc = validCase();
    (doc["clues"] as Record<string, unknown>[])[0]!["title"] = undefined;
    delete (doc["clues"] as Record<string, unknown>[])[0]!["title"];
    expect(codes(validateCaseDocument(doc, "case.yaml"))).toContain("schema-invalid");
  });

  it("TEST-16: recusa âncora sem raio", () => {
    const doc = validCase();
    (doc["clues"] as Record<string, unknown>[])[0]!["anchor"] = { lat: 0, lng: 0 };
    expect(codes(validateCaseDocument(doc, "case.yaml"))).toContain("schema-invalid");
  });

  it("TEST-16: recusa latitude impossível", () => {
    const doc = validCase();
    (doc["clues"] as Record<string, unknown>[])[0]!["anchor"] = { lat: 120, lng: 0, radius: 25 };
    expect(codes(validateCaseDocument(doc, "case.yaml"))).toContain("schema-invalid");
  });

  it("TEST-14: aceita caso sem origin", () => {
    const doc = validCase();
    delete doc["origin"];
    expect(validateCaseDocument(doc, "case.yaml")).toEqual([]);
  });

  it("TEST-16: recusa documento que nem é objeto", () => {
    expect(codes(validateCaseDocument("isto não é um caso", "case.yaml"))).toContain("schema-invalid");
  });
});

describe("validateAgentDocument", () => {
  it("TEST-14: aceita um agente válido", () => {
    expect(validateAgentDocument(validAgent(), "a.yaml")).toEqual([]);
  });

  it("TEST-14: aceita agente sem provider (cai na cascata do módulo/servidor)", () => {
    const doc = validAgent();
    delete doc["provider"];
    expect(validateAgentDocument(doc, "a.yaml")).toEqual([]);
  });

  it("TEST-17: recusa api_key literal no provider", () => {
    const doc = validAgent();
    doc["provider"] = { base_url: "https://api.openai.com/v1", model: "gpt-4o-mini", api_key: "sk-abc123" };
    expect(codes(validateAgentDocument(doc, "a.yaml"))).toContain("schema-invalid");
  });

  it("TEST-16: recusa agente sem persona", () => {
    const doc = validAgent();
    delete doc["persona"];
    expect(codes(validateAgentDocument(doc, "a.yaml"))).toContain("schema-invalid");
  });

  it("TEST-16: recusa base_url que não é URL", () => {
    const doc = validAgent();
    doc["provider"] = { base_url: "não é url", model: "m", api_key_env: "K" };
    expect(codes(validateAgentDocument(doc, "a.yaml"))).toContain("schema-invalid");
  });
});

describe("toCaseDefinition", () => {
  it("TEST-18: mapeia o YAML do autor para os tipos do motor", () => {
    const def = toCaseDefinition(validCase() as never);

    expect(def.id).toBe("poco-de-jaco");
    expect(def.origin).toEqual({ lat: -1.5089, lng: -48.6247 });
    expect(def.clues[0]).toEqual({
      id: "pista-cantaro",
      title: "O cântaro abandonado",
      requires: [],
      anchor: { position: { lat: -1.5089, lng: -48.6247 }, radiusMeters: 25 },
      unlocksCharacters: ["samaritana"],
    });
    // Pista sem âncora não ganha uma âncora vazia — ela simplesmente não tem lugar.
    expect(def.clues[1]).not.toHaveProperty("anchor");
    expect(def.solution).toEqual({
      culprit: "samaritana",
      supportingClues: ["pista-cantaro", "pista-confissao"],
    });
  });

  it("TEST-03: mapeia a description da pista — o texto do vestígio", () => {
    const doc = validCase();
    (doc["clues"] as Record<string, unknown>[])[0]!["description"] =
      "Um cântaro de barro, cheio, largado na borda do poço.";

    const def = toCaseDefinition(doc as never);
    expect(def.clues[0]?.description).toContain("cântaro de barro");
  });

  it("TEST-04: não inventa description quando o autor não escreveu uma", () => {
    const def = toCaseDefinition(validCase() as never);
    expect(def.clues[0]).not.toHaveProperty("description");
  });

  it("TEST-09: mapeia solution.reveal — o caminho do epílogo", () => {
    const doc = validCase();
    (doc["solution"] as Record<string, unknown>)["reveal"] = "casos/a-verdade";

    expect(toCaseDefinition(doc as never).solution.reveal).toBe("casos/a-verdade");
  });

  it("TEST-10: não inventa reveal quando o caso não declara um", () => {
    expect(toCaseDefinition(validCase() as never).solution).not.toHaveProperty("reveal");
  });

  it("TEST-18: preenche listas ausentes com vazio", () => {
    const doc = validCase();
    (doc["clues"] as Record<string, unknown>[])[1] = { id: "pista-solta", title: "Solta" };
    const def = toCaseDefinition(doc as never);
    expect(def.clues[1]?.requires).toEqual([]);
    expect(def.clues[1]?.unlocksCharacters).toEqual([]);
  });
});
