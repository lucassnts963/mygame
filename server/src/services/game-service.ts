import {
  collectClue,
  createGameState,
  distanceMeters,
  effectiveAnchor,
  judgeAccusation,
  notebook,
  unlockedCharacters,
  visibleClues,
  type AccusationVerdict,
  type CollectVerdict,
  type LatLng,
} from "@vestigio/engine";
import { createChatClient, type FetchLike } from "../agent/openai-client.ts";
import { resolveProvider } from "../agent/provider-resolution.ts";
import { runAgentTurn } from "../agent/runtime.ts";
import type { Conversation, ProviderConfig } from "../agent/types.ts";
import type { GameModule, ModuleRegistry } from "../repositories/module-registry.ts";
import type { GameSession, SessionRepository } from "../repositories/session-repository.ts";

/** Erro de regra de jogo — vira status HTTP, nunca 500. */
export class GameError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "GameError";
    this.status = status;
    this.details = details;
  }
}

export interface GameServiceDeps {
  readonly modules: ModuleRegistry;
  readonly sessions: SessionRepository;
  readonly defaultProvider?: ProviderConfig;
  readonly env: Record<string, string | undefined>;
  readonly fetchImpl: FetchLike;
}

/** O que o app precisa saber para desenhar mapa, caderno e lista de personagens. */
export interface SessionView {
  readonly id: string;
  readonly moduleId: string;
  readonly caseTitle: string;
  readonly visibleClues: readonly {
    readonly id: string;
    readonly title: string;
    readonly description?: string;
    readonly anchor?: { readonly lat: number; readonly lng: number; readonly radiusMeters: number };
    readonly distanceMeters?: number;
  }[];
  readonly notebook: ReturnType<typeof notebook>;
  readonly characters: readonly { readonly id: string; readonly name: string }[];
  readonly accusation: GameSession["state"]["accusation"];
}

export function createGameService(deps: GameServiceDeps) {
  const requireModule = (id: string): GameModule => {
    const module = deps.modules.get(id);
    if (!module) throw new GameError(404, `módulo '${id}' não encontrado`);
    return module;
  };

  const requireSession = async (id: string): Promise<GameSession> => {
    const session = await deps.sessions.get(id);
    if (!session) throw new GameError(404, `sessão '${id}' não encontrada`);
    return session;
  };

  /**
   * Monta a visão da partida. A `position` entra apenas para calcular distâncias **nesta
   * resposta** e é descartada — nenhum trajeto do jogador é armazenado (NFR-01).
   */
  const view = (session: GameSession, position?: LatLng): SessionView => {
    const module = requireModule(session.moduleId);
    const { caseDefinition } = module;

    return {
      id: session.id,
      moduleId: session.moduleId,
      caseTitle: module.title,
      visibleClues: visibleClues(caseDefinition, session.state).map((clue) => {
        const anchor = effectiveAnchor(caseDefinition, session.state, clue);
        return {
          id: clue.id,
          title: clue.title,
          ...(anchor
            ? {
                anchor: {
                  lat: anchor.position.lat,
                  lng: anchor.position.lng,
                  radiusMeters: anchor.radiusMeters,
                },
              }
            : {}),
          ...(anchor && position
            ? { distanceMeters: Math.round(distanceMeters(position, anchor.position)) }
            : {}),
        };
      }),
      notebook: notebook(caseDefinition, session.state),
      characters: unlockedCharacters(caseDefinition, session.state).map((c) => ({
        id: c.id,
        name: c.name,
      })),
      accusation: session.state.accusation,
    };
  };

  return {
    listModules: () =>
      deps.modules.list().map((module) => ({
        id: module.id,
        title: module.title,
        ...(module.synopsis ? { synopsis: module.synopsis } : {}),
        clueCount: module.caseDefinition.clues.length,
      })),

    async start(moduleId: string, origin?: LatLng): Promise<SessionView> {
      const module = requireModule(moduleId);
      const state = createGameState(module.caseDefinition, origin ? { origin } : {});
      return view(await deps.sessions.create(moduleId, state));
    },

    async get(sessionId: string, position?: LatLng): Promise<SessionView> {
      return view(await requireSession(sessionId), position);
    },

    /**
     * Coleta uma pista. **O servidor revalida a posição** — o cliente informa onde está, mas
     * quem decide é aqui (REQ-02, ADR-004).
     */
    async collect(
      sessionId: string,
      clueId: string,
      position: LatLng,
    ): Promise<{ view: SessionView; verdict: CollectVerdict }> {
      const session = await requireSession(sessionId);
      const module = requireModule(session.moduleId);

      if (!module.caseDefinition.clues.some((clue) => clue.id === clueId)) {
        throw new GameError(404, `pista '${clueId}' não existe neste caso`);
      }

      const { state, verdict } = collectClue(module.caseDefinition, session.state, clueId, position);
      if (!verdict.ok) {
        // Recusa por distância ou por pré-requisito é resultado esperado do jogo, não falha:
        // vai como 409 com o veredito estruturado, para o app virar mensagem útil.
        throw new GameError(409, "coleta recusada", { verdict });
      }

      const updated = { ...session, state };
      await deps.sessions.save(updated);
      return { view: view(updated), verdict };
    },

    async chat(sessionId: string, characterId: string, message: string) {
      const session = await requireSession(sessionId);
      const module = requireModule(session.moduleId);

      const agent = module.agents.get(characterId);
      if (!agent) throw new GameError(404, `personagem '${characterId}' não existe neste caso`);

      const provider = resolveProviderOrFail(module, characterId);
      const conversation: Conversation =
        session.conversations.get(characterId) ?? { messages: [], turns: 0 };

      let result;
      try {
        result = await runAgentTurn({
          client: createChatClient(provider, deps.fetchImpl),
          caseDefinition: module.caseDefinition,
          agent,
          lore: module.loaded.lore,
          state: session.state,
          conversation,
          playerMessage: message,
        });
      } catch (cause) {
        // Personagem bloqueado e teto de turnos são regra de jogo; o resto é falha real.
        const detail = cause instanceof Error ? cause.message : String(cause);
        if (/bloquead|turnos/i.test(detail)) throw new GameError(409, detail);
        throw cause;
      }

      const conversations = new Map(session.conversations);
      conversations.set(characterId, result.conversation);
      const updated = { ...session, state: result.state, conversations };
      await deps.sessions.save(updated);

      return { reply: result.reply, revealedClues: result.revealedClues, view: view(updated) };
    },

    async accuse(
      sessionId: string,
      culprit: string,
    ): Promise<{ view: SessionView; verdict: AccusationVerdict }> {
      const session = await requireSession(sessionId);
      const module = requireModule(session.moduleId);

      const { state, verdict } = judgeAccusation(module.caseDefinition, session.state, culprit);
      if (!verdict.ok && verdict.reason === "unknown-character") {
        throw new GameError(404, `'${culprit}' não é personagem deste caso`);
      }

      const updated = { ...session, state };
      await deps.sessions.save(updated);

      // Errar ou acusar sem sustentação é desfecho do jogo, não erro do cliente — mas precisa
      // de status distinto para o app não celebrar um veredito negativo.
      if (!verdict.ok) throw new GameError(409, "acusação recusada", { verdict, view: view(updated) });
      return { view: view(updated), verdict };
    },
  };

  function resolveProviderOrFail(module: GameModule, characterId: string) {
    try {
      return resolveProvider({
        ...(module.agentProviders.get(characterId)
          ? { character: module.agentProviders.get(characterId)! }
          : {}),
        ...(module.provider ? { module: module.provider } : {}),
        ...(deps.defaultProvider ? { server: deps.defaultProvider } : {}),
        env: deps.env,
      });
    } catch (cause) {
      // O jogo está de pé; a IA é que não está configurada. 503 diz exatamente isso.
      throw new GameError(503, cause instanceof Error ? cause.message : String(cause));
    }
  }
}

export type GameService = ReturnType<typeof createGameService>;
