import type { CaseDefinition } from "@vestigio/engine";
import type { LorePage } from "@vestigio/module-schema";
import type { AgentSpec } from "../src/agent/types.ts";

export const BARCARENA = { lat: -1.5089, lng: -48.6247 };

export function lorePage(path: string, title: string, body: string, spoiler = false): LorePage {
  return {
    path,
    content: [
      "---",
      `title: ${JSON.stringify(title)}`,
      "category: personagem",
      "canon: ficcional",
      `spoiler: ${spoiler}`,
      "---",
      "",
      body,
    ].join("\n"),
  };
}

export const LORE: LorePage[] = [
  lorePage("personagens/samaritana", "A mulher do poço", "Ela veio buscar água ao meio-dia, sozinha."),
  lorePage("lugares/poco-de-jaco", "O poço de Jacó", "Um poço fundo na estrada de Sicar."),
  lorePage("casos/a-verdade", "A verdade", "Foi ela quem abandonou o cântaro de propósito.", true),
];

export const SKILL_INTERROGAR = [
  "---",
  "name: guardar-segredo",
  "description: >-",
  "  Decide o quanto revelar conforme o que o detetive já sabe. Use quando ele perguntar",
  "  diretamente sobre algo que a personagem esconde.",
  "---",
  "",
  "# Guardar segredo",
  "",
  "## Purpose",
  "Medir o quanto abrir.",
  "",
  "## Prerequisites",
  "O caderno do detetive.",
  "",
  "## Instructions",
  "### Passo 1",
  "Só admita o que ele já puder provar.",
  "",
  "## Output",
  "Uma fala em personagem.",
  "",
  "## Examples",
  "### Exemplo 1",
  "Ele pergunta pelo cântaro sem ter visto o cântaro.",
  "",
  "## References",
  "lore/WIKI_SCHEMA.md",
].join("\n");

export function agentSpec(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    id: "samaritana",
    name: "A mulher do poço",
    persona: "Você é uma mulher de Samaria, junto ao poço, na hora mais quente do dia.",
    skills: [{ name: "guardar-segredo", content: SKILL_INTERROGAR }],
    reveals: [{ clue: "pista-confissao", requiresClues: ["pista-pegadas"] }],
    ...overrides,
  };
}

/** O mesmo caso do motor, para o runtime ter estado de partida real com que trabalhar. */
export function caseDefinition(): CaseDefinition {
  return {
    id: "caso-teste",
    title: "Caso de teste",
    origin: BARCARENA,
    clues: [
      {
        id: "pista-cantaro",
        title: "O cântaro abandonado",
        requires: [],
        anchor: { position: BARCARENA, radiusMeters: 25 },
        unlocksCharacters: ["samaritana"],
      },
      {
        id: "pista-pegadas",
        title: "Pegadas na terra seca",
        requires: ["pista-cantaro"],
        anchor: { position: { lat: -1.5095, lng: -48.624 }, radiusMeters: 25 },
        unlocksCharacters: [],
      },
      { id: "pista-confissao", title: "O que ela admitiu", requires: ["pista-pegadas"], unlocksCharacters: [] },
    ],
    characters: [{ id: "samaritana", name: "A mulher do poço", requires: ["pista-cantaro"] }],
    solution: { culprit: "samaritana", supportingClues: ["pista-cantaro", "pista-confissao"] },
  };
}
