import type { SecretKey } from "./crypto.ts";

/** Uma mensagem no formato da API da OpenAI — o único protocolo que o runtime fala (ADR-007). */
export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | null;
  readonly tool_calls?: readonly ToolCall[];
  readonly tool_call_id?: string;
}

export interface ToolCall {
  readonly id: string;
  readonly type: "function";
  readonly function: { readonly name: string; readonly arguments: string };
}

/** Declaração de ferramenta, no formato de *function calling* da OpenAI. */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/** Provider como declarado num `agent.yaml` ou na configuração do servidor: sem a chave. */
export interface ProviderConfig {
  readonly baseUrl: string;
  readonly model: string;
  /** **Nome** da variável de ambiente que guarda a chave — nunca a chave (ADR-008). */
  readonly apiKeyEnv?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

/** Provider já resolvido, com a chave carregada e embrulhada em `SecretKey`. */
export interface ResolvedProvider {
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey: SecretKey;
  readonly temperature?: number;
  readonly maxTokens?: number;
}

export interface SkillRef {
  readonly name: string;
  /** O `SKILL.md` inteiro. Só a `description` vai ao prompt até a skill ser acionada (REQ-15). */
  readonly content: string;
}

/** Uma pista que este personagem pode conceder, e sob que condição. */
export interface RevealRule {
  readonly clue: string;
  readonly requiresClues: readonly string[];
}

/** O personagem, do ponto de vista do runtime. */
export interface AgentSpec {
  readonly id: string;
  readonly name: string;
  readonly persona: string;
  readonly voice?: string;
  readonly skills: readonly SkillRef[];
  readonly reveals: readonly RevealRule[];
}

/** Histórico de uma conversa com um personagem, incluindo o consumo do teto de turnos. */
export interface Conversation {
  /** Sem a mensagem de sistema — ela é remontada a cada turno. */
  readonly messages: readonly ChatMessage[];
  readonly turns: number;
}

export interface ToolResult {
  readonly content: string;
  readonly isError?: boolean;
}
