import { Ajv, type ErrorObject, type Schema } from "ajv";
import type { CaseDefinition } from "@vestigio/engine";
import type { CaseDocument, Diagnostic } from "../types.ts";
import { agentSchema, caseSchema } from "./definitions.ts";

const ajv = new Ajv({ allErrors: true, strict: false });
const validateCase = ajv.compile(caseSchema as Schema);
const validateAgent = ajv.compile(agentSchema as Schema);

/** Transforma os erros do ajv em diagnósticos legíveis para quem escreveu o YAML. */
function toDiagnostics(errors: readonly ErrorObject[] | null | undefined, file: string): Diagnostic[] {
  return (errors ?? []).map((error) => {
    // O ajv guarda o nome do campo faltante em `params`; sem ele a mensagem vira um enigma.
    const missing = error.params["missingProperty"];
    const suffix = typeof missing === "string" ? `: ${missing}` : "";
    return {
      severity: "error" as const,
      code: "schema-invalid",
      file,
      message: `${error.instancePath || "(raiz)"} ${error.message ?? "inválido"}${suffix}`,
    };
  });
}

export function validateCaseDocument(document: unknown, file: string): readonly Diagnostic[] {
  return validateCase(document) ? [] : toDiagnostics(validateCase.errors, file);
}

export function validateAgentDocument(document: unknown, file: string): readonly Diagnostic[] {
  return validateAgent(document) ? [] : toDiagnostics(validateAgent.errors, file);
}

/**
 * Converte o `case.yaml` — escrito em `snake_case` por um autor humano — nos tipos que o motor
 * consome. A tradução acontece só aqui: o motor nunca vê o formato de arquivo, e o autor nunca
 * precisa saber como o motor guarda as coisas.
 */
export function toCaseDefinition(document: CaseDocument): CaseDefinition {
  return {
    id: document.id,
    title: document.title,
    ...(document.origin ? { origin: { lat: document.origin.lat, lng: document.origin.lng } } : {}),
    clues: document.clues.map((clue) => ({
      id: clue.id,
      title: clue.title,
      // Sem esta linha o texto do vestígio era lido do YAML, validado pelo schema e descartado
      // aqui — toda a escrita do caso ficava invisível para quem joga.
      ...(clue.description ? { description: clue.description } : {}),
      requires: [...(clue.requires ?? [])],
      // Uma pista sem âncora não ganha âncora vazia: ela simplesmente não tem lugar no mundo,
      // e é isso que diz ao motor que só um personagem pode concedê-la.
      ...(clue.anchor
        ? {
            anchor: {
              position: { lat: clue.anchor.lat, lng: clue.anchor.lng },
              radiusMeters: clue.anchor.radius,
            },
          }
        : {}),
      unlocksCharacters: [...(clue.unlocks_characters ?? [])],
    })),
    characters: document.characters.map((character) => ({
      id: character.id,
      name: character.name,
      requires: [...(character.requires ?? [])],
    })),
    solution: {
      culprit: document.solution.culprit,
      supportingClues: [...document.solution.supporting_clues],
      // Segundo campo que o schema aceitava e o domínio descartava, depois da `description`.
      // Sem esta linha o epílogo do caso fica escrito no módulo e inalcançável para quem joga.
      ...(document.solution.reveal ? { reveal: document.solution.reveal } : {}),
    },
  };
}
