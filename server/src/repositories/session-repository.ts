import { randomUUID } from "node:crypto";
import type { GameState } from "@vestigio/engine";
import type { Conversation } from "../agent/types.ts";

export interface GameSession {
  readonly id: string;
  readonly moduleId: string;
  readonly state: GameState;
  /** Histórico por personagem. */
  readonly conversations: ReadonlyMap<string, Conversation>;
}

export interface SessionRepository {
  create(moduleId: string, state: GameState): GameSession;
  get(id: string): GameSession | undefined;
  save(session: GameSession): void;
}

/**
 * Repositório em memória.
 *
 * O MVP perde as partidas ao reiniciar, e isso está registrado como lacuna conhecida. O que
 * importa é a **forma**: sessão é um valor imutável, então trocar o Postgres por isto — ou o
 * contrário — não toca em nenhuma rota nem no motor.
 */
export function createInMemorySessionRepository(): SessionRepository {
  const sessions = new Map<string, GameSession>();

  return {
    create(moduleId, state) {
      const session: GameSession = {
        id: randomUUID(),
        moduleId,
        state,
        conversations: new Map(),
      };
      sessions.set(session.id, session);
      return session;
    },

    get: (id) => sessions.get(id),

    save(session) {
      sessions.set(session.id, session);
    },
  };
}
