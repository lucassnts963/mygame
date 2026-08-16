import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadModule } from "../src/loader.ts";
import { validateModule } from "../src/validate.ts";

const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Escreve uma árvore de arquivos num diretório temporário e devolve o caminho. */
function moduleDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "vestigio-"));
  created.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const full = join(root, relative);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
  return root;
}

const CASE_YAML = `
id: caso-teste
title: Caso de teste
origin: { lat: -1.5089, lng: -48.6247 }
clues:
  - id: pista-cantaro
    title: O cântaro abandonado
    requires: []
    anchor: { lat: -1.5089, lng: -48.6247, radius: 25 }
    unlocks_characters: [samaritana]
  - id: pista-confissao
    title: A confissão
    requires: [pista-cantaro]
characters:
  - id: samaritana
    name: A mulher do poço
    requires: []
    agent: agents/samaritana.agent.yaml
solution:
  culprit: samaritana
  supporting_clues: [pista-cantaro, pista-confissao]
`.trim();

const AGENT_YAML = `
id: samaritana
name: A mulher do poço
persona: |
  Você é uma mulher de Samaria, junto ao poço, ao meio-dia.
provider:
  base_url: https://api.openai.com/v1
  model: gpt-4o-mini
  api_key_env: VESTIGIO_SAMARITANA_KEY
skills: [interrogar-testemunha]
lore: [personagens/samaritana]
`.trim();

const SKILL_MD = [
  "---",
  "name: interrogar-testemunha",
  "description: >-",
  "  Conduz um interrogatório em personagem sem afirmar nada fora da lore.",
  "  Use quando o detetive fizer uma pergunta direta à testemunha.",
  "---",
  "",
  "# Interrogar testemunha",
  "",
  "## Purpose",
  "Conduzir o interrogatório.",
  "",
  "## Prerequisites",
  "A lore do módulo.",
  "",
  "## Instructions",
  "### Passo 1",
  "Consulte a lore antes de afirmar qualquer coisa.",
  "",
  "## Output",
  "Uma fala em personagem.",
  "",
  "## Examples",
  "### Exemplo 1",
  "O detetive pergunta pelo cântaro.",
  "",
  "## References",
  "lore/WIKI_SCHEMA.md",
].join("\n");

const LORE_SAMARITANA = [
  "---",
  'title: "A mulher do poço"',
  "category: personagem",
  "canon: ficcional",
  "spoiler: false",
  "---",
  "",
  "Ela veio buscar água na hora mais quente do dia, quando ninguém mais ia.",
].join("\n");

const LORE_SPOILER = [
  "---",
  'title: "A verdade"',
  "category: caso",
  "canon: ficcional",
  "spoiler: true",
  "---",
  "",
  "Foi ela quem deixou o cântaro para trás, de propósito.",
].join("\n");

/** Módulo íntegro; `overrides` substitui ou acrescenta arquivos para criar variantes quebradas. */
function validModule(overrides: Record<string, string> = {}): string {
  return moduleDir({
    "case.yaml": CASE_YAML,
    "agents/samaritana.agent.yaml": AGENT_YAML,
    "skills/interrogar-testemunha/SKILL.md": SKILL_MD,
    "lore/wiki/personagens/samaritana.md": LORE_SAMARITANA,
    "lore/wiki/casos/a-verdade.md": LORE_SPOILER,
    ...overrides,
  });
}

const codes = (ds: readonly { code: string }[]) => ds.map((d) => d.code);
const errors = (ds: readonly { severity: string }[]) => ds.filter((d) => d.severity === "error");

describe("loadModule", () => {
  it("TEST-19: lê um módulo completo do disco", () => {
    const loaded = loadModule(validModule());

    expect(loaded.caseDocument).toMatchObject({ id: "caso-teste" });
    expect(loaded.agents.map((a) => a.id)).toEqual(["samaritana"]);
    expect(loaded.skills.map((s) => s.name)).toEqual(["interrogar-testemunha"]);
    expect(loaded.lore.map((p) => p.path).sort()).toEqual([
      "casos/a-verdade",
      "personagens/samaritana",
    ]);
  });

  it("TEST-20: reclama claramente de um diretório sem case.yaml", () => {
    const root = moduleDir({ "leia-me.md": "vazio" });
    expect(() => loadModule(root)).toThrow(/case\.yaml/);
  });

  it("TEST-20: reclama de YAML inválido apontando o arquivo", () => {
    const root = validModule({ "case.yaml": "id: [não fecha" });
    expect(() => loadModule(root)).toThrow(/case\.yaml/);
  });

  it("TEST-19: aceita um módulo mínimo, só com case.yaml", () => {
    // Um caso sem personagens interrogáveis, sem skills e sem lore continua sendo um caso.
    const loaded = loadModule(moduleDir({ "case.yaml": CASE_YAML }));
    expect(loaded.agents).toEqual([]);
    expect(loaded.skills).toEqual([]);
    expect(loaded.lore).toEqual([]);
  });

  it("TEST-19: aceita agente com extensão .yml", () => {
    const root = validModule({ "agents/escriba.yml": AGENT_YAML.replace("id: samaritana", "id: escriba") });
    expect(loadModule(root).agents.map((a) => a.id).sort()).toEqual(["escriba", "samaritana"]);
  });

  it("TEST-19: usa o nome do arquivo quando o agente não declara id", () => {
    const semId = AGENT_YAML.replace("id: samaritana\n", "");
    const root = moduleDir({ "case.yaml": CASE_YAML, "agents/samaritana.agent.yaml": semId });
    expect(loadModule(root).agents[0]?.id).toBe("samaritana");
  });

  it("TEST-19: ignora arquivos que não são YAML dentro de agents/", () => {
    const root = validModule({ "agents/LEIA-ME.md": "anotações do autor" });
    expect(loadModule(root).agents.map((a) => a.id)).toEqual(["samaritana"]);
  });
});

describe("validateModule", () => {
  it("TEST-21: aprova um módulo íntegro", () => {
    expect(validateModule(validModule())).toEqual([]);
  });

  it("TEST-22: reprova página spoiler exposta ao agente", () => {
    const agentComSpoiler = AGENT_YAML.replace(
      "lore: [personagens/samaritana]",
      "lore: [personagens/samaritana, casos/a-verdade]",
    );
    const ds = validateModule(validModule({ "agents/samaritana.agent.yaml": agentComSpoiler }));

    expect(codes(ds)).toContain("spoiler-exposed");
    expect(errors(ds).length).toBeGreaterThan(0);
  });

  it("TEST-22: reprova agente que referencia página de lore inexistente", () => {
    const agente = AGENT_YAML.replace("lore: [personagens/samaritana]", "lore: [personagens/fantasma]");
    expect(codes(validateModule(validModule({ "agents/samaritana.agent.yaml": agente })))).toContain(
      "unknown-lore-page",
    );
  });

  it("TEST-23: reprova skill declarada mas ausente do bundle", () => {
    const agente = AGENT_YAML.replace("skills: [interrogar-testemunha]", "skills: [nao-existe]");
    expect(codes(validateModule(validModule({ "agents/samaritana.agent.yaml": agente })))).toContain(
      "unknown-skill",
    );
  });

  it("TEST-23: reprova SKILL.md malformada", () => {
    const semOutput = SKILL_MD.replace("## Output\nUma fala em personagem.\n\n", "");
    expect(
      codes(validateModule(validModule({ "skills/interrogar-testemunha/SKILL.md": semOutput }))),
    ).toContain("skill-missing-section");
  });

  it("TEST-24: reprova caso insolúvel", () => {
    const insoluvel = CASE_YAML.replace("requires: [pista-cantaro]", "requires: [pista-que-nao-existe]");
    const ds = validateModule(validModule({ "case.yaml": insoluvel }));
    expect(codes(ds)).toContain("dangling-requirement");
    expect(codes(ds)).toContain("case-unsolvable");
  });

  it("TEST-24: reprova personagem do case.yaml sem agente correspondente", () => {
    const semAgente = CASE_YAML.replace("    agent: agents/samaritana.agent.yaml\n", "");
    const ds = validateModule(validModule({ "case.yaml": semAgente }));
    expect(codes(ds)).toContain("character-without-agent");
    // NPC mudo pode ser intencional — é aviso, não erro.
    expect(ds.find((d) => d.code === "character-without-agent")?.severity).toBe("warning");
  });

  it("TEST-24: reprova agente apontando para arquivo inexistente", () => {
    const apontaErrado = CASE_YAML.replace(
      "agent: agents/samaritana.agent.yaml",
      "agent: agents/nao-existe.agent.yaml",
    );
    expect(codes(validateModule(validModule({ "case.yaml": apontaErrado })))).toContain(
      "missing-agent-file",
    );
  });

  it("TEST-25: reprova segredo literal em qualquer arquivo do bundle", () => {
    const comSegredo = AGENT_YAML.replace(
      "api_key_env: VESTIGIO_SAMARITANA_KEY",
      "api_key: sk-abc123def456ghi789jkl012",
    );
    expect(codes(validateModule(validModule({ "agents/samaritana.agent.yaml": comSegredo })))).toContain(
      "secret-literal",
    );
  });

  it("TEST-25: reprova segredo escondido dentro de uma página de lore", () => {
    const loreComSegredo = LORE_SAMARITANA + "\n\nAnotação do autor: api_key: sk-abc123def456ghi789.";
    expect(
      codes(validateModule(validModule({ "lore/wiki/personagens/samaritana.md": loreComSegredo }))),
    ).toContain("secret-literal");
  });

  it("TEST-25: junta vários diagnósticos numa passada só", () => {
    const agenteRuim = AGENT_YAML.replace("skills: [interrogar-testemunha]", "skills: [nao-existe]").replace(
      "lore: [personagens/samaritana]",
      "lore: [personagens/fantasma]",
    );
    const ds = validateModule(validModule({ "agents/samaritana.agent.yaml": agenteRuim }));

    expect(codes(ds)).toContain("unknown-skill");
    expect(codes(ds)).toContain("unknown-lore-page");
  });

  it("TEST-25: para nas violações de schema do caso, sem empilhar erros derivados", () => {
    // Sem um caso válido, as checagens cruzadas produziriam ruído em cima do primeiro erro.
    const ds = validateModule(validModule({ "case.yaml": "id: caso-teste\ntitle: Só isso" }));
    expect(codes(ds)).toContain("schema-invalid");
    expect(codes(ds)).not.toContain("case-unsolvable");
  });

  it("TEST-25: aceita agente sem skills e sem lore declaradas", () => {
    const minimo = ["id: samaritana", "name: A mulher do poço", "persona: Você é uma mulher de Samaria."].join("\n");
    const ds = validateModule(validModule({ "agents/samaritana.agent.yaml": minimo }));
    expect(errors(ds)).toEqual([]);
  });

  it("TEST-25: ordena os erros antes dos avisos", () => {
    const semAgente = CASE_YAML.replace("    agent: agents/samaritana.agent.yaml\n", "");
    const agenteRuim = AGENT_YAML.replace("skills: [interrogar-testemunha]", "skills: [nao-existe]");
    const ds = validateModule(
      validModule({ "case.yaml": semAgente, "agents/samaritana.agent.yaml": agenteRuim }),
    );

    const primeiroAviso = ds.findIndex((d) => d.severity === "warning");
    const ultimoErro = ds.map((d) => d.severity).lastIndexOf("error");
    expect(primeiroAviso).toBeGreaterThan(ultimoErro);
  });

  it("TEST-21: todo diagnóstico diz em que arquivo o problema está", () => {
    const ds = validateModule(validModule({ "case.yaml": CASE_YAML.replace("id: caso-teste", "id: Caso Teste") }));
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.every((d) => typeof d.file === "string" && d.file.length > 0)).toBe(true);
  });
});
