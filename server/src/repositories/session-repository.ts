import { randomUUID } from "node:crypto";
import type { GameState } from "@vestigio/engine";
import type { Conversation } from "../agent/types.ts";

export interface GameSession {
  readonly id: string;
  readonly moduleId: string;
  readonly state: GameState;
  /** Histórico por personagem. */
  readonly conversations: ReadonlyMap<string, Conversation>;
  /** Dono da partida. `null` enquanto houver partida anônima (CHG-008 passa a preencher). */
  readonly playerId?: string | null;
}

/**
 * O repositório de sessões.
 *
 * **A interface é assíncrona**, e isso não é cerimônia: qualquer banco de verdade é assíncrono, e
 * uma interface síncrona teria obrigado uma reescrita das camadas acima no dia da troca — que foi
 * exatamente o que aconteceu quando o Postgres entrou. O motor, esse sim, continua síncrono e
 * puro (ADR-004): a fronteira do I/O é aqui.
 */
export interface SessionRepository {
  create(moduleId: string, state: GameState, playerId?: string | null): Promise<GameSession>;
  get(id: string): Promise<GameSession | undefined>;
  save(session: GameSession): Promise<void>;
}

/**
 * Repositório em memória.
 *
 * Não é código morto nem "fallback de emergência": é como o projeto roda **sem banco**. Quem
 * clona o repositório joga sem instalar Postgres, e a suíte da API continua rápida. As duas
 * implementações passam pela mesma suíte de contrato (`session-repository-contract.ts`), que é o
 * que impede uma de divergir da outra em silêncio.
 */
export function createInMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, GameSession>();

  return {
    async create(moduleId, state, playerId = null) {
      const session: GameSession = {
        id: randomUUID(),
        moduleId,
        state,
        conversations: new Map(),
        playerId,
      };
      sessions.set(session.id, session);
      return session;
    },

    async get(id) {
      return sessions.get(id);
    },

    async save(session) {
      sessions.set(session.id, session);
    },
  };
}
