/**
 * `@vestigio/module-schema` — o contrato do que um jogador cria.
 *
 * Um módulo é um bundle declarativo (ADR-009): `case.yaml`, agentes, skills no formato do kit e
 * lore. Nada aqui executa código de usuário; tudo é lido, validado e transformado nos tipos que
 * o motor entende.
 */
export * from "./types.ts";
export { parseFrontmatter } from "./frontmatter.ts";
export type { Frontmatter } from "./frontmatter.ts";
export { CANONICAL_SECTIONS, validateSkill } from "./skill-validator.ts";
export { scanForSecrets } from "./secret-scan.ts";
export { isSpoiler, lintLore } from "./lore-lint.ts";
export { toCaseDefinition, validateAgentDocument, validateCaseDocument } from "./schemas/index.ts";
export { agentSchema, caseSchema } from "./schemas/definitions.ts";
export { loadModule } from "./loader.ts";
export { validateLoadedModule, validateModule } from "./validate.ts";
