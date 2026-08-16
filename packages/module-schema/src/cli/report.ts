import type { Diagnostic } from "../types.ts";

/** Imprime os diagnósticos e devolve o código de saída (0 = sem erros). */
export function reportDiagnostics(diagnostics: readonly Diagnostic[]): number {
  if (diagnostics.length === 0) {
    console.log("✓ módulo válido — nenhum problema encontrado.");
    return 0;
  }

  for (const d of diagnostics) {
    const mark = d.severity === "error" ? "ERRO " : "aviso";
    const where = d.line ? `${d.file}:${d.line}` : d.file;
    console.log(`  ${mark} ${where}\n        [${d.code}] ${d.message}`);
  }

  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.length - errors;
  console.log(`\n${errors} erro(s), ${warnings} aviso(s).`);

  // Aviso não reprova: página órfã ou NPC mudo podem ser escolhas do autor.
  return errors > 0 ? 1 : 0;
}

/** Resolve o argumento de linha de comando para um caminho de módulo. */
export function moduleArgument(argv: readonly string[], command: string): string {
  const target = argv[2];
  if (!target) {
    console.error(`uso: npm run ${command} -- <caminho-do-modulo>`);
    process.exit(2);
  }
  return target;
}
