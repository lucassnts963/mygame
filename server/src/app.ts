import Fastify, { type FastifyInstance } from "fastify";
import type { FetchLike } from "./agent/openai-client.ts";
import type { ProviderConfig } from "./agent/types.ts";
import type { ModuleRegistry } from "./repositories/module-registry.ts";
import {
  createInMemorySessionRepository,
  type SessionRepository,
} from "./repositories/session-repository.ts";
import { registerGameRoutes } from "./routes/game-routes.ts";
import { GameError, createGameService } from "./services/game-service.ts";

export interface AppOptions {
  readonly modules: ModuleRegistry;
  /** Onde as partidas ficam. Sem isto, memória — que é como o jogo roda sem banco. */
  readonly sessions?: SessionRepository;
  /** Provider padrão do servidor — o último degrau da cascata (REQ-12). */
  readonly defaultProvider?: ProviderConfig;
  readonly env?: Record<string, string | undefined>;
  /** Injetável para a suíte rodar contra o servidor OpenAI falso, sem rede (NFR-04). */
  readonly fetchImpl?: FetchLike;
  readonly logger?: boolean;
}

/**
 * Compõe o servidor. Tudo que toca o mundo externo — módulos, ambiente, `fetch` — entra por
 * parâmetro, e é isso que permite testar a API inteira com `inject`, sem porta e sem rede.
 */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  const game = createGameService({
    modules: options.modules,
    sessions: options.sessions ?? createInMemorySessionRepository(),
    ...(options.defaultProvider ? { defaultProvider: options.defaultProvider } : {}),
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? fetch,
  });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof GameError) {
      // Recusa de regra carrega o veredito do motor, para o app virar mensagem em vez de
      // um erro genérico: "faltam 218 m" é jogo; "erro 500" é bug.
      return reply.code(error.status).send({ message: error.message, ...(error.details ?? {}) });
    }

    // Erros do próprio Fastify (JSON malformado, rota inexistente) já trazem o status certo.
    const status = (error as { statusCode?: number }).statusCode;
    const message = error instanceof Error ? error.message : "erro interno";
    if (status && status < 500) return reply.code(status).send({ message });

    app.log.error(error);
    return reply.code(500).send({ message: "erro interno" });
  });

  registerGameRoutes(app, game);
  return app;
}
