import type { GameState } from "@vestigio/engine";
import type { Conversation } from "../agent/types.ts";
import { schemaPrefix, type Pool } from "../db/pool.ts";
import type { GameSession, SessionRepository } from "./session-repository.ts";

export interface PostgresRepositoryOptions {
  /** Schema alvo. Vazio = `public`. Os testes usam um schema por execução. */
  readonly schema?: string;
}

interface SessionRow {
  readonly id: string;
  readonly module_id: string;
  readonly state: GameState;
  readonly player_id: string | null;
}

interface ConversationRow {
  readonly character_id: string;
  readonly conversation: Conversation;
}

/**
 * O repositório de sessões em Postgres.
 *
 * `GameState` e `Conversation` já são dados JSON puros, então vão para `jsonb` sem tradução —
 * a única conversão real é o `Map` de conversas, que vira linhas em `session_conversations`.
 */
export function createPostgresSessionRepository(
  pool: Pool,
  options: PostgresRepositoryOptions = {},
): SessionRepository {
  const p = schemaPrefix(options.schema);

  return {
    async create(moduleId, state, playerId = null) {
      const { rows } = await pool.query<SessionRow>(
        `INSERT INTO ${p}sessions (player_id, module_id, state)
         VALUES ($1, $2, $3)
         RETURNING id, module_id, state, player_id`,
        [playerId, moduleId, JSON.stringify(state)],
      );

      const row = rows[0]!;
      return {
        id: row.id,
        moduleId: row.module_id,
        state: row.state,
        conversations: new Map(),
        playerId: row.player_id,
      };
    },

    async get(id) {
      // Um id que não é UUID (rota chamada com lixo) faria o Postgres lançar `invalid input
      // syntax`. Para quem chama, "não existe" e "não é um id válido" são a mesma coisa.
      if (!isUuid(id)) return undefined;

      const { rows } = await pool.query<SessionRow>(
        `SELECT id, module_id, state, player_id FROM ${p}sessions WHERE id = $1`,
        [id],
      );
      const row = rows[0];
      if (!row) return undefined;

      const { rows: conversationRows } = await pool.query<ConversationRow>(
        `SELECT character_id, conversation FROM ${p}session_conversations WHERE session_id = $1`,
        [id],
      );

      return {
        id: row.id,
        moduleId: row.module_id,
        state: row.state,
        playerId: row.player_id,
        conversations: new Map(conversationRows.map((c) => [c.character_id, c.conversation])),
      };
    },

    async save(session) {
      const client = await pool.connect();
      try {
        // Estado e conversas numa transação só: um turno de chat altera os dois, e gravar
        // metade deixaria o caderno dizendo uma coisa e a conversa outra.
        await client.query("BEGIN");

        await client.query(
          `UPDATE ${p}sessions SET state = $2, updated_at = now() WHERE id = $1`,
          [session.id, JSON.stringify(session.state)],
        );

        for (const [characterId, conversation] of session.conversations) {
          await client.query(
            `INSERT INTO ${p}session_conversations (session_id, character_id, conversation)
             VALUES ($1, $2, $3)
             ON CONFLICT (session_id, character_id)
             DO UPDATE SET conversation = EXCLUDED.conversation, updated_at = now()`,
            [session.id, characterId, JSON.stringify(conversation)],
          );
        }

        await client.query("COMMIT");
      } catch (cause) {
        await client.query("ROLLBACK");
        throw cause;
      } finally {
        client.release();
      }
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID.test(value);
