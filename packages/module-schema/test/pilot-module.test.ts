import { fileURLToPath } from "node:url";
import { playtestCase } from "@vestigio/engine";
import { describe, expect, it } from "vitest";
import { loadModule } from "../src/loader.ts";
import { toCaseDefinition } from "../src/schemas/index.ts";
import type { CaseDocument } from "../src/types.ts";
import { validateModule } from "../src/validate.ts";

/**
 * O módulo piloto é conteúdo que acompanha o jogo, e conteúdo apodrece calado: um `requires`
 * renomeado ou uma página de lore movida não quebram teste nenhum — só quebram a partida de
 * quem for jogar. Estes testes são o alarme.
 */
const PILOT = fileURLToPath(new URL("../../../modules/poco-de-jaco", import.meta.url));

describe("módulo piloto — poco-de-jaco", () => {
  it("passa na validação sem nenhum erro", () => {
    const errors = validateModule(PILOT).filter((d) => d.severity === "error");
    expect(errors).toEqual([]);
  });

  it("passa sem nem avisos — é o exemplo que os autores vão copiar", () => {
    expect(validateModule(PILOT)).toEqual([]);
  });

  it("fecha: o percurso simulado termina em acusação resolvida", () => {
    const caseDef = toCaseDefinition(loadModule(PILOT).caseDocument as CaseDocument);
    const report = playtestCase(caseDef);

    expect(report.solvable).toBe(true);
    expect(report.verdict).toMatchObject({ ok: true, reason: "solved" });
    expect(report.unreachable).toEqual([]);
  });

  it("exige deslocamento real: as três primeiras pistas têm âncora no mapa", () => {
    const caseDef = toCaseDefinition(loadModule(PILOT).caseDocument as CaseDocument);
    const comAncora = caseDef.clues.filter((c) => c.anchor);
    expect(comAncora).toHaveLength(3);
  });

  it("a última pista não está no mapa — ela só sai da boca da personagem", () => {
    const caseDef = toCaseDefinition(loadModule(PILOT).caseDocument as CaseDocument);
    const confissao = caseDef.clues.find((c) => c.id === "pista-confissao");
    expect(confissao?.anchor).toBeUndefined();
  });

  it("a verdade do caso está marcada como spoiler e fora do alcance dos agentes", () => {
    const loaded = loadModule(PILOT);
    const verdade = loaded.lore.find((p) => p.path === "casos/a-verdade");

    expect(verdade?.content).toContain("spoiler: true");
    // Nenhum agente pode listá-la — o validador reprovaria, mas checar aqui documenta a intenção.
    for (const agent of loaded.agents) {
      expect(agent.content).not.toContain("casos/a-verdade");
    }
  });

  it("nenhum agente carrega chave literal — só o nome da variável de ambiente", () => {
    for (const agent of loadModule(PILOT).agents) {
      expect(agent.content).not.toMatch(/\bapi_key\s*:/);
      expect(agent.content).not.toMatch(/\bsk-[A-Za-z0-9]{16,}/);
    }
  });

  it("TEST-07: TODA pista do caso piloto tem texto para o jogador ler", () => {
    // Sem descrição, o jogador anda até o lugar e recebe um título de quatro palavras.
    // O texto do vestígio é o conteúdo do jogo, não um detalhe de conteúdo opcional.
    const caseDef = toCaseDefinition(loadModule(PILOT).caseDocument as CaseDocument);

    for (const clue of caseDef.clues) {
      expect(clue.description, `pista '${clue.id}' sem descrição`).toBeTruthy();
      expect(clue.description!.length).toBeGreaterThan(40);
    }
  });

  it("acertar o culpado sem a sustentação não resolve o caso", () => {
    // A regra que dá identidade ao jogo, verificada no conteúdo real: com dois personagens,
    // o palpite acerta metade das vezes — a dedução é que tem de ser cobrada.
    const caseDef = toCaseDefinition(loadModule(PILOT).caseDocument as CaseDocument);
    expect(caseDef.solution.supportingClues.length).toBeGreaterThanOrEqual(2);
    expect(caseDef.characters.length).toBeGreaterThanOrEqual(2);
  });
});
