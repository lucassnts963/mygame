#!/usr/bin/env node
/**
 * `npm run playtest -- <caminho>` — percorre o caso com GPS simulado.
 *
 * Serve para responder, sem sair do lugar, a pergunta que de outro modo só apareceria na rua:
 * **este caso fecha?**
 */
import { playtestCase } from "@vestigio/engine";
import { loadModule } from "../loader.ts";
import { toCaseDefinition } from "../schemas/index.ts";
import type { CaseDocument } from "../types.ts";
import { moduleArgument } from "./report.ts";

const target = moduleArgument(process.argv, "playtest");

try {
  const loaded = loadModule(target);
  const caseDef = toCaseDefinition(loaded.caseDocument as CaseDocument);
  const report = playtestCase(caseDef);

  console.log(`Playtest: ${caseDef.title} (${report.caseId})\n`);

  console.log("Percurso do detetive:");
  report.collectedOrder.forEach((id, index) => {
    const clue = caseDef.clues.find((c) => c.id === id);
    const where = clue?.anchor ? "no mapa" : "em conversa";
    console.log(`  ${index + 1}. ${clue?.title ?? id} (${where})`);
  });

  if (report.unreachable.length > 0) {
    console.log(`\nPistas inalcançáveis: ${report.unreachable.join(", ")}`);
  }
  for (const issue of report.issues) {
    console.log(`  ERRO [${issue.kind}] ${issue.detail}`);
  }

  console.log(`\nAcusação simulada: ${report.verdict.reason}`);
  console.log(report.solvable ? "\n✓ O caso fecha." : "\n✗ O caso NÃO fecha.");
  process.exit(report.solvable ? 0 : 1);
} catch (cause) {
  console.error(`falha ao carregar o módulo: ${cause instanceof Error ? cause.message : cause}`);
  process.exit(1);
}
