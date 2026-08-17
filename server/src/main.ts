#!/usr/bin/env node
/**
 * Ponto de entrada do servidor. Só amarra processo: lê ambiente, carrega módulos, sobe a porta.
 * Toda a regra vive em `app.ts` e abaixo — é o que permite testar a API inteira sem abrir socket.
 */
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.ts";
import { createPool } from "./db/pool.ts";
import { runMigrations } from "./db/migrate.ts";
import { loadModuleRegistry } from "./repositories/module-registry.ts";
import { createPostgresSessionRepository } from "./repositories/postgres-session-repository.ts";
import type { SessionRepository } from "./repositories/session-repository.ts";
import type { ProviderConfig } from "./agent/types.ts";

const MODULES_DIR = process.env["VESTIGIO_MODULES_DIR"] ?? fileURLToPath(new URL("../../modules", import.meta.url));
const PORT = Number(process.env["PORT"] ?? 3000);

/** Provider padrão do servidor — o último degrau da cascata (REQ-12). Opcional. */
const defaultProvider: ProviderConfig | undefined = process.env["VESTIGIO_BASE_URL"]
  ? {
      baseUrl: process.env["VESTIGIO_BASE_URL"],
      model: process.env["VESTIGIO_MODEL"] ?? "gpt-4o-mini",
      ...(process.env["VESTIGIO_API_KEY_ENV"] ? { apiKeyEnv: process.env["VESTIGIO_API_KEY_ENV"] } : {}),
    }
  : undefined;

/**
 * Com `DATABASE_URL`, as partidas persistem. Sem, ficam em memória e somem ao reiniciar — o que
 * é aceitável para desenvolvimento e inaceitável em produção, então o aviso é alto.
 *
 * Se a URL existe mas o banco não responde, o servidor **falha ao subir**. Aceitar partidas que
 * não vai conseguir salvar seria pior do que não subir.
 */
let sessions: SessionRepository | undefined;
const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl) {
  const pool = createPool(databaseUrl);
  const { applied } = await runMigrations(pool);
  if (applied.length > 0) console.log(`migrations aplicadas: ${applied.join(", ")}`);
  sessions = createPostgresSessionRepository(pool);
}

const modules = loadModuleRegistry(MODULES_DIR);
const app = buildApp({
  modules,
  ...(sessions ? { sessions } : {}),
  ...(defaultProvider ? { defaultProvider } : {}),
  logger: true,
});

if (!sessions) {
  app.log.warn("sem DATABASE_URL — as partidas ficam em memória e somem ao reiniciar");
}

app.log.info(`módulos carregados: ${modules.list().map((m) => m.id).join(", ") || "(nenhum)"}`);
if (!defaultProvider) {
  // O jogo sobe sem IA: mapa, AR, caderno e acusação funcionam; só o interrogatório fica 503.
  app.log.warn("nenhum provider padrão configurado (VESTIGIO_BASE_URL) — o chat responderá 503");
}

await app.listen({ port: PORT, host: "0.0.0.0" });
