import { unlockedCharacters, type CaseDefinition, type GameState } from "@vestigio/engine";
import type { LorePage } from "@vestigio/module-schema";
import { buildLoreIndex } from "./lore-index.ts";
import type { ChatClient } from "./openai-client.ts";
import { buildSystemPrompt } from "./system-prompt.ts";
import { createToolset } from "./tools.ts";
import type { AgentSpec, ChatMessage, Conversation } from "./types.ts";

/** Teto de turnos por conversa, espelhando `.specs/config.md## Game Constants`. */
export const MAX_TURNS_PER_CONVERSATION = 30;

/**
 * Teto de chamadas de ferramenta dentro de **um** turno.
 *
 * Um modelo que só pede ferramenta e nunca conclui deixaria o jogador esperando para sempre e
 * queimaria tokens sem limite. Quatro é folgado para o uso legítimo (consultar a lore, ver o
 * caderno, revelar) e curto o bastante para não virar prejuízo.
 */
const MAX_TOOL_CALLS_PER_TURN = 4;

/** O que dizer quando o modelo devolve um turno sem texto — nunca mostre "null" ao jogador. */
const SILENCE = "…";

export interface AgentTurnInput {
  readonly client: ChatClient;
  readonly caseDefinition: CaseDefinition;
  readonly agent: AgentSpec;
  readonly lore: readonly LorePage[];
  readonly state: GameState;
  readonly conversation: Conversation;
  readonly playerMessage: string;
}

export interface AgentTurnResult {
  readonly reply: string;
  readonly state: GameState;
  readonly conversation: Conversation;
  readonly revealedClues: readonly string[];
}

/**
 * Roda um turno de interrogatório.
 *
 * O laço é o clássico de *function calling*: manda as mensagens, e enquanto o modelo pedir
 * ferramentas, executa e devolve os resultados, até ele finalmente falar.
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  assertCharacterUnlocked(input);

  if (input.conversation.turns >= MAX_TURNS_PER_CONVERSATION) {
    throw new Error(
      `limite de ${MAX_TURNS_PER_CONVERSATION} turnos desta conversa atingido — investigue e volte depois`,
    );
  }

  const lore = buildLoreIndex(input.lore);
  const toolset = createToolset({
    caseDefinition: input.caseDefinition,
    agent: input.agent,
    lore,
    state: input.state,
  });

  const systemPrompt = buildSystemPrompt(input.agent, lore);
  // O histórico guardado não inclui a mensagem de sistema: ela é remontada a cada turno, para
  // que uma edição na lore ou na persona valha na conversa em andamento.
  const history: ChatMessage[] = [
    ...input.conversation.messages,
    { role: "user", content: input.playerMessage },
  ];

  let working: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history];
  let reply = SILENCE;

  for (let call = 0; call <= MAX_TOOL_CALLS_PER_TURN; call += 1) {
    const message = await input.client.complete(working, toolset.specs);
    const toolCalls = message.tool_calls ?? [];

    if (toolCalls.length === 0 || call === MAX_TOOL_CALLS_PER_TURN) {
      reply = message.content?.trim() || SILENCE;
      history.push({ role: "assistant", content: reply });
      break;
    }

    working = [...working, message];
    for (const toolCall of toolCalls) {
      const result = await toolset.call(toolCall.function.name, parseArguments(toolCall.function.arguments));
      working.push({ role: "tool", tool_call_id: toolCall.id, content: result.content });
    }
  }

  return {
    reply,
    state: toolset.state,
    conversation: { messages: history, turns: input.conversation.turns + 1 },
    revealedClues: toolset.revealedClues,
  };
}

/**
 * Um personagem bloqueado não conversa.
 *
 * A checagem acontece **antes** de qualquer chamada ao provider: além de ser a regra do jogo,
 * evita gastar token com uma conversa que não deveria existir.
 */
function assertCharacterUnlocked(input: AgentTurnInput): void {
  const unlocked = unlockedCharacters(input.caseDefinition, input.state);
  if (!unlocked.some((character) => character.id === input.agent.id)) {
    throw new Error(`o personagem '${input.agent.id}' ainda está bloqueado nesta partida`);
  }
}

/** Argumentos de ferramenta vêm como string JSON, e um modelo pode mandar algo inválido. */
function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
