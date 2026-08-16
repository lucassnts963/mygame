import { existsSync } from "node:fs";
import { join } from "node:path";
import { playtestCase } from "@vestigio/engine";
import { isSpoiler, lintLore } from "./lore-lint.ts";
import { loadModule } from "./loader.ts";
import { toCaseDefinition, validateAgentDocument, validateCaseDocument } from "./schemas/index.ts";
import { scanForSecrets } from "./secret-scan.ts";
import { validateSkill } from "./skill-validator.ts";
import type { AgentDocument, CaseDocument, Diagnostic, LoadedModule } from "./types.ts";

/**
 * Valida um módulo já carregado. Devolve **todos** os problemas de uma vez, ordenados por
 * severidade — erros primeiro, porque é neles que o autor precisa mexer.
 */
export function validateLoadedModule(loaded: LoadedModule): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Um segredo literal reprova venha de onde vier — inclusive da lore e das skills, não só do
  // agent.yaml. É o arquivo inteiro que o autor compartilha (ADR-008).
  for (const file of loaded.files) diagnostics.push(...scanForSecrets(file.path, file.content));

  diagnostics.push(...validateCaseDocument(loaded.caseDocument, loaded.caseFile));
  for (const agent of loaded.agents) {
    diagnostics.push(...validateAgentDocument(agent.document, agent.file));
  }
  for (const skill of loaded.skills) {
    diagnostics.push(...validateSkill(skill.name, skill.content));
  }
  diagnostics.push(...lintLore(loaded.lore));

  // Sem um caso estruturalmente válido não dá para checar referências cruzadas com honestidade:
  // os erros seguintes seriam consequência do primeiro, e ruído atrapalha mais que ajuda.
  if (diagnostics.some((d) => d.code === "schema-invalid" && d.file === loaded.caseFile)) {
    return sortBySeverity(diagnostics);
  }

  const caseDocument = loaded.caseDocument as CaseDocument;
  diagnostics.push(...checkCrossReferences(loaded, caseDocument));
  diagnostics.push(...checkSolvability(loaded, caseDocument));

  return sortBySeverity(diagnostics);
}

/** Carrega e valida um módulo a partir do diretório. */
export function validateModule(root: string): readonly Diagnostic[] {
  return validateLoadedModule(loadModule(root));
}

/** Referências entre as partes do bundle: personagem→agente, agente→skill, agente→lore. */
function checkCrossReferences(
  loaded: LoadedModule,
  caseDocument: CaseDocument,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const skillNames = new Set(loaded.skills.map((s) => s.name));
  const lorePaths = new Set(loaded.lore.map((p) => p.path));
  const spoilers = new Set(loaded.lore.filter(isSpoiler).map((p) => p.path));

  for (const character of caseDocument.characters ?? []) {
    if (!character.agent) {
      diagnostics.push({
        severity: "warning",
        code: "character-without-agent",
        file: loaded.caseFile,
        message: `'${character.id}' não tem agente — ele existirá no caso, mas não poderá ser interrogado`,
      });
      continue;
    }
    if (!existsSync(join(loaded.root, character.agent))) {
      diagnostics.push({
        severity: "error",
        code: "missing-agent-file",
        file: loaded.caseFile,
        message: `'${character.id}' aponta para '${character.agent}', que não existe no módulo`,
      });
    }
  }

  for (const agent of loaded.agents) {
    const document = agent.document as AgentDocument;

    for (const skill of document.skills ?? []) {
      if (!skillNames.has(skill)) {
        diagnostics.push({
          severity: "error",
          code: "unknown-skill",
          file: agent.file,
          message: `a skill '${skill}' não existe em skills/ — esperado 'skills/${skill}/SKILL.md'`,
        });
      }
    }

    for (const page of document.lore ?? []) {
      const path = page.replace(/^lore\/wiki\//, "").replace(/\.md$/, "");
      if (!lorePaths.has(path)) {
        diagnostics.push({
          severity: "error",
          code: "unknown-lore-page",
          file: agent.file,
          message: `a página de lore '${page}' não existe no módulo`,
        });
        continue;
      }
      // O ponto mais importante do bundle inteiro: a verdade do caso não pode entrar no contexto
      // do agente, ou o jogador extrai a solução conversando (ADR-006).
      if (spoilers.has(path)) {
        diagnostics.push({
          severity: "error",
          code: "spoiler-exposed",
          file: agent.file,
          message: `'${page}' é uma página spoiler e não pode ser dada a um personagem — ela revelaria a solução`,
        });
      }
    }
  }

  return diagnostics;
}

/** O caso fecha? Usa exatamente o motor que roda em partida — não uma segunda opinião. */
function checkSolvability(loaded: LoadedModule, caseDocument: CaseDocument): readonly Diagnostic[] {
  const report = playtestCase(toCaseDefinition(caseDocument));

  const diagnostics: Diagnostic[] = report.issues.map((issue) => ({
    severity: "error" as const,
    code: issue.kind,
    file: loaded.caseFile,
    message: issue.detail,
  }));

  if (!report.solvable) {
    diagnostics.push({
      severity: "error",
      code: "case-unsolvable",
      file: loaded.caseFile,
      message: `o caso não fecha: o percurso simulado terminou em '${report.verdict.reason}'`,
    });
  }

  return diagnostics;
}

function sortBySeverity(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
  return [...diagnostics].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
}
