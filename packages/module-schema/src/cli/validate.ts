#!/usr/bin/env node
/** `npm run validate-module -- <caminho>` — valida um bundle de módulo antes de jogar. */
import { validateModule } from "../validate.ts";
import { moduleArgument, reportDiagnostics } from "./report.ts";

const target = moduleArgument(process.argv, "validate-module");

try {
  console.log(`Validando módulo: ${target}\n`);
  process.exit(reportDiagnostics(validateModule(target)));
} catch (cause) {
  console.error(`falha ao carregar o módulo: ${cause instanceof Error ? cause.message : cause}`);
  process.exit(1);
}
