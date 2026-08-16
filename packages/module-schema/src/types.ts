/** Severidade de um diagnóstico. Só `error` reprova o módulo. */
export type Severity = "error" | "warning";

/**
 * Um problema encontrado no módulo.
 *
 * O validador acumula diagnósticos em vez de lançar no primeiro erro: um autor com cinco
 * problemas quer ver os cinco de uma vez, não descobrir um por execução.
 */
export interface Diagnostic {
  readonly severity: Severity;
  readonly code: string;
  /** Caminho relativo ao módulo — sempre preenchido, para o autor saber onde mexer. */
  readonly file: string;
  readonly message: string;
  readonly line?: number;
}

/** Uma página de lore, identificada pelo caminho sem `lore/wiki/` e sem `.md`. */
export interface LorePage {
  readonly path: string;
  readonly content: string;
}

export interface LoadedSkill {
  readonly name: string;
  readonly file: string;
  readonly content: string;
}

export interface LoadedAgent {
  readonly id: string;
  readonly file: string;
  readonly document: unknown;
  readonly content: string;
}

export interface LoadedModule {
  readonly root: string;
  readonly caseDocument: unknown;
  readonly caseFile: string;
  readonly agents: readonly LoadedAgent[];
  readonly skills: readonly LoadedSkill[];
  readonly lore: readonly LorePage[];
  /** Todo arquivo de texto do bundle, para varreduras que valem no módulo inteiro. */
  readonly files: readonly { readonly path: string; readonly content: string }[];
}

/** Âncora como o autor escreve no YAML: plana, com o raio junto. */
export interface AnchorDocument {
  readonly lat: number;
  readonly lng: number;
  readonly radius: number;
}

export interface ClueDocument {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly requires?: readonly string[];
  readonly anchor?: AnchorDocument;
  readonly unlocks_characters?: readonly string[];
  readonly lore?: string;
}

export interface CharacterDocument {
  readonly id: string;
  readonly name: string;
  readonly requires?: readonly string[];
  readonly agent?: string;
}

export interface CaseDocument {
  readonly id: string;
  readonly title: string;
  readonly synopsis?: string;
  readonly origin?: { readonly lat: number; readonly lng: number };
  readonly clues: readonly ClueDocument[];
  readonly characters: readonly CharacterDocument[];
  readonly solution: {
    readonly culprit: string;
    readonly supporting_clues: readonly string[];
    readonly reveal?: string;
  };
}

/** Provider de LLM: qualquer endpoint compatível com a API da OpenAI (ADR-007). */
export interface ProviderDocument {
  readonly base_url: string;
  readonly model: string;
  /** **Nome** da variável de ambiente que guarda a chave — nunca a chave (ADR-008). */
  readonly api_key_env?: string;
  readonly temperature?: number;
  readonly max_tokens?: number;
}

export interface RevealDocument {
  readonly clue: string;
  readonly requires_clues?: readonly string[];
}

export interface AgentDocument {
  readonly id: string;
  readonly name: string;
  readonly persona: string;
  readonly voice?: string;
  readonly provider?: ProviderDocument;
  readonly skills?: readonly string[];
  readonly tools?: readonly string[];
  readonly lore?: readonly string[];
  readonly reveals?: readonly RevealDocument[];
}
