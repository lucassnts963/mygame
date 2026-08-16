import { describe, expect, it } from "vitest";
import { buildLoreIndex } from "../src/agent/lore-index.ts";
import { buildSystemPrompt } from "../src/agent/system-prompt.ts";
import { LORE, agentSpec } from "./fixtures.ts";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt(agentSpec(), buildLoreIndex(LORE));

  it("TEST-17: traz a persona do personagem", () => {
    expect(prompt).toContain("Você é uma mulher de Samaria");
  });

  it("TEST-17: traz o nome do personagem", () => {
    expect(prompt).toContain("A mulher do poço");
  });

  it("TEST-17: traz as regras do cânone que valem para todo NPC", () => {
    // As cinco regras de lore/wiki/_regras/como-personagens-respondem.
    expect(prompt).toMatch(/em personagem/i);
    expect(prompt).toMatch(/consultar_lore/);
    expect(prompt).toMatch(/n[ãa]o invente/i);
  });

  it("TEST-17: instrui a desconversar em vez de inventar", () => {
    expect(prompt).toMatch(/desconvers|n[ãa]o sabe/i);
  });

  it("TEST-17: pede respostas curtas — custo de token e realismo", () => {
    expect(prompt).toMatch(/breve|curt/i);
  });

  it("TEST-18: lista as skills por nome e description, sem o corpo", () => {
    expect(prompt).toContain("guardar-segredo");
    expect(prompt).toContain("Decide o quanto revelar");
    // O corpo da skill só entra quando ela for acionada (progressive disclosure).
    expect(prompt).not.toContain("Só admita o que ele já puder provar");
    expect(prompt).not.toContain("## Instructions");
  });

  it("TEST-18: sem skills, não inventa uma seção vazia de skills", () => {
    const semSkills = buildSystemPrompt(agentSpec({ skills: [] }), buildLoreIndex(LORE));
    expect(semSkills).not.toMatch(/carregar_skill/);
  });

  it("TEST-18: anuncia o índice da lore para o agente saber o que existe", () => {
    expect(prompt).toContain("personagens/samaritana");
    expect(prompt).toContain("lugares/poco-de-jaco");
  });

  it("TEST-19: NÃO contém a página spoiler nem o caminho dela", () => {
    expect(prompt).not.toContain("casos/a-verdade");
    expect(prompt).not.toContain("abandonou o cântaro de propósito");
  });

  it("TEST-17: inclui o tom de voz quando o personagem declara um", () => {
    const comVoz = buildSystemPrompt(agentSpec({ voice: "seca, desconfiada" }), buildLoreIndex(LORE));
    expect(comVoz).toContain("seca, desconfiada");
  });

  it("TEST-17: sem tom de voz, não cria uma linha vazia de tom", () => {
    expect(prompt).not.toMatch(/Tom de voz:\s*$/m);
  });

  it("TEST-18: skill sem description no frontmatter não quebra o prompt", () => {
    const semDescricao = buildSystemPrompt(
      agentSpec({ skills: [{ name: "muda", content: "---\nname: muda\n---\n\n## Purpose\nnada" }] }),
      buildLoreIndex(LORE),
    );
    expect(semDescricao).toContain("muda");
    expect(semDescricao).toContain("(sem descrição)");
  });

  it("TEST-18: lore vazia não cria uma seção de lore vazia", () => {
    const semLore = buildSystemPrompt(agentSpec(), buildLoreIndex([]));
    expect(semLore).not.toContain("consultar_lore para ler qualquer um destes");
  });

  it("TEST-19: não contém o texto de nenhuma página — só os caminhos", () => {
    // O conteúdo chega por ferramenta, não pelo prompt: é o que mantém o prompt barato
    // e força a consulta a passar pelo índice.
    expect(prompt).not.toContain("Ela veio buscar água ao meio-dia");
  });
});
