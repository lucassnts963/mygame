import { collectClue, createGameState } from "@vestigio/engine";
import { describe, expect, it } from "vitest";
import { buildLoreIndex } from "../src/agent/lore-index.ts";
import { createToolset } from "../src/agent/tools.ts";
import { BARCARENA, LORE, agentSpec, caseDefinition } from "./fixtures.ts";

const def = caseDefinition();

/** Contexto de ferramentas com o caderno já contendo as pistas informadas. */
function toolsWith(collected: readonly string[]) {
  let state = createGameState(def);
  for (const id of collected) {
    const clue = def.clues.find((c) => c.id === id);
    state = collectClue(def, state, id, clue?.anchor?.position).state;
  }
  return createToolset({
    caseDefinition: def,
    agent: agentSpec(),
    lore: buildLoreIndex(LORE),
    state,
  });
}

describe("createToolset", () => {
  it("TEST-20: declara as ferramentas com nome e schema", () => {
    const names = toolsWith([]).specs.map((s) => s.name);
    expect(names).toContain("consultar_lore");
    expect(names).toContain("verificar_caderno");
    expect(names).toContain("revelar_pista");
    expect(names).toContain("recusar_responder");
  });

  it("TEST-20: consultar_lore devolve trechos da lore", async () => {
    const result = await toolsWith([]).call("consultar_lore", { busca: "poço" });
    expect(result.content).toContain("Sicar");
  });

  it("TEST-20: consultar_lore sem resultado diz que não há fundamento", async () => {
    const result = await toolsWith([]).call("consultar_lore", { busca: "dragão" });
    expect(result.content).toMatch(/nada|não encontr/i);
  });

  it("TEST-20: consultar_lore nunca alcança a página spoiler", async () => {
    const result = await toolsWith([]).call("consultar_lore", { busca: "propósito" });
    expect(result.content).not.toContain("abandonou o cântaro");
  });

  it("TEST-20: consultar_lore sem argumento não quebra", async () => {
    const result = await toolsWith([]).call("consultar_lore", {});
    expect(result.content).toBeTruthy();
  });

  it("TEST-21: verificar_caderno lista o que o detetive já descobriu", async () => {
    const result = await toolsWith(["pista-cantaro"]).call("verificar_caderno", {});
    expect(result.content).toContain("O cântaro abandonado");
  });

  it("TEST-21: verificar_caderno com caderno vazio informa isso", async () => {
    const result = await toolsWith([]).call("verificar_caderno", {});
    expect(result.content).toMatch(/nada|vazio|nenhuma/i);
  });

  it("TEST-22: revelar_pista concede quando as condições estão atendidas", async () => {
    const toolset = toolsWith(["pista-cantaro", "pista-pegadas"]);
    const result = await toolset.call("revelar_pista", { pista: "pista-confissao" });

    expect(result.content).toMatch(/revelad|concedid/i);
    expect(toolset.state.collectedClues).toContain("pista-confissao");
  });

  it("TEST-23: revelar_pista recusa quando faltam as pistas exigidas", async () => {
    const toolset = toolsWith(["pista-cantaro"]);
    const result = await toolset.call("revelar_pista", { pista: "pista-confissao" });

    expect(result.content).toMatch(/ainda não|não pode/i);
    expect(toolset.state.collectedClues).not.toContain("pista-confissao");
  });

  it("TEST-23: revelar_pista recusa pista que o agente não tem permissão de conceder", async () => {
    const toolset = toolsWith(["pista-cantaro", "pista-pegadas"]);
    const result = await toolset.call("revelar_pista", { pista: "pista-cantaro" });
    expect(result.content).toMatch(/não pode|não está autorizad/i);
  });

  it("TEST-23: revelar_pista recusa pista inexistente", async () => {
    const result = await toolsWith([]).call("revelar_pista", { pista: "pista-fantasma" });
    expect(result.content).toMatch(/não pode|não existe|não está autorizad/i);
  });

  it("TEST-24: revelar_pista é idempotente", async () => {
    const toolset = toolsWith(["pista-cantaro", "pista-pegadas"]);
    await toolset.call("revelar_pista", { pista: "pista-confissao" });
    await toolset.call("revelar_pista", { pista: "pista-confissao" });

    expect(toolset.state.collectedClues.filter((id) => id === "pista-confissao")).toHaveLength(1);
  });

  it("TEST-25: carregar_skill devolve o corpo da skill", async () => {
    const result = await toolsWith([]).call("carregar_skill", { skill: "guardar-segredo" });
    expect(result.content).toContain("Só admita o que ele já puder provar");
  });

  it("TEST-25: carregar_skill recusa skill inexistente", async () => {
    const result = await toolsWith([]).call("carregar_skill", { skill: "nao-existe" });
    expect(result.content).toMatch(/não existe|desconhecid/i);
  });

  it("TEST-20: recusar_responder devolve uma orientação, não um erro", async () => {
    const result = await toolsWith([]).call("recusar_responder", { motivo: "não sei disso" });
    expect(result.isError).toBeFalsy();
  });

  it("TEST-26: ferramenta desconhecida vira resultado de erro, não exceção", async () => {
    // Derrubar o turno porque o modelo alucinou um nome de ferramenta seria pior para o
    // jogador do que devolver o erro e deixar a conversa seguir.
    const result = await toolsWith([]).call("ferramenta_inventada", {});
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/desconhecid|não existe/i);
  });

  it("TEST-23: revelar_pista recusa quando o motor ainda bloqueia a pista", () => {
    // O módulo autoriza a revelação, mas o grafo de pistas não: conceder burla a geografia,
    // nunca a dedução. Sem isto, uma regra mal escrita atalharia o caso inteiro.
    const toolset = createToolset({
      caseDefinition: def,
      agent: agentSpec({ reveals: [{ clue: "pista-confissao", requiresClues: [] }] }),
      lore: buildLoreIndex(LORE),
      state: createGameState(def),
    });
    return toolset.call("revelar_pista", { pista: "pista-confissao" }).then((result) => {
      expect(result.content).toMatch(/não pode/i);
      expect(toolset.state.collectedClues).not.toContain("pista-confissao");
    });
  });

  it("TEST-20: agente sem reveals não expõe a ferramenta revelar_pista", () => {
    const semReveals = createToolset({
      caseDefinition: def,
      agent: agentSpec({ reveals: [] }),
      lore: buildLoreIndex(LORE),
      state: createGameState(def),
    });
    expect(semReveals.specs.map((s) => s.name)).not.toContain("revelar_pista");
  });

  it("TEST-25: agente sem skills não expõe a ferramenta carregar_skill", () => {
    const semSkills = createToolset({
      caseDefinition: def,
      agent: agentSpec({ skills: [] }),
      lore: buildLoreIndex(LORE),
      state: createGameState(def),
    });
    expect(semSkills.specs.map((s) => s.name)).not.toContain("carregar_skill");
  });

  it("TEST-24: o estado inicial reflete o caderno recebido", () => {
    expect(toolsWith(["pista-cantaro"]).state.collectedClues).toEqual(["pista-cantaro"]);
  });

  it("TEST-22: uma pista revelada desbloqueia o que dependia dela", async () => {
    const semReveals = createToolset({
      caseDefinition: def,
      agent: agentSpec({ reveals: [{ clue: "pista-pegadas", requiresClues: [] }] }),
      lore: buildLoreIndex(LORE),
      state: collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state,
    });
    await semReveals.call("revelar_pista", { pista: "pista-pegadas" });
    expect(semReveals.state.collectedClues).toContain("pista-pegadas");
  });
});
