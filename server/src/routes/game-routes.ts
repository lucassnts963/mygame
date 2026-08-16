import type { LatLng } from "@vestigio/engine";
import type { FastifyInstance } from "fastify";
import { GameError, type GameService } from "../services/game-service.ts";

/**
 * As rotas são cascas finas: leem a requisição, chamam o serviço, formatam a resposta
 * (`.specs/memory/conventions.md## Backend`). Nenhuma regra de jogo mora aqui.
 */
export function registerGameRoutes(app: FastifyInstance, game: GameService): void {
  app.get("/modules", async () => game.listModules());

  app.post("/sessions", async (request, reply) => {
    const body = (request.body ?? {}) as { moduleId?: unknown; origin?: unknown };
    if (typeof body.moduleId !== "string" || body.moduleId.length === 0) {
      throw new GameError(400, "informe 'moduleId'");
    }
    const origin = parseOptionalLatLng(body.origin);
    return reply.code(201).send(game.start(body.moduleId, origin));
  });

  app.get("/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { lat?: string; lng?: string };
    return game.get(id, parseOptionalLatLng(query.lat && query.lng ? { lat: query.lat, lng: query.lng } : undefined));
  });

  app.post("/sessions/:id/clues/:clueId/collect", async (request) => {
    const { id, clueId } = request.params as { id: string; clueId: string };
    const position = parseOptionalLatLng(request.body);
    if (!position) throw new GameError(400, "informe a posição como { lat, lng }");

    const { view, verdict } = game.collect(id, clueId, position);
    return { ...view, verdict };
  });

  app.post("/sessions/:id/characters/:characterId/chat", async (request) => {
    const { id, characterId } = request.params as { id: string; characterId: string };
    const body = (request.body ?? {}) as { message?: unknown };
    if (typeof body.message !== "string" || body.message.trim().length === 0) {
      throw new GameError(400, "informe 'message'");
    }

    const { reply, revealedClues, view } = await game.chat(id, characterId, body.message.trim());
    return { ...view, reply, revealedClues };
  });

  app.post("/sessions/:id/accuse", async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { culprit?: unknown };
    if (typeof body.culprit !== "string" || body.culprit.length === 0) {
      throw new GameError(400, "informe 'culprit'");
    }

    const { view, verdict } = game.accuse(id, body.culprit);
    return { ...view, verdict };
  });
}

/** Aceita `{ lat, lng }` como número ou string (querystring), e recusa qualquer outra coisa. */
function parseOptionalLatLng(value: unknown): LatLng | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") throw new GameError(400, "posição inválida");

  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  const parsed = { lat: toNumber(lat), lng: toNumber(lng) };
  if (parsed.lat === undefined || parsed.lng === undefined) {
    throw new GameError(400, "posição inválida: informe 'lat' e 'lng' numéricos");
  }
  return { lat: parsed.lat, lng: parsed.lng };
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}
