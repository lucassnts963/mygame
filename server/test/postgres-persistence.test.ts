import { collectClue, createGameState } from "@vestigio/engine";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { createPool } from "../src/db/pool.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { loadModuleRegistry } from "../src/repositories/module-registry.ts";
import { createPostgresSessionRepository } from "../src/repositories/postgres-session-repository.ts";
import { DATABASE_URL, hasDatabase, withTemporarySchema } from "./db-harness.ts";
import { fakeOpenAI } from "./fake-openai.ts";
import { BARCARENA, caseDefinition } from "./fixtures.ts";

const MODULES_DIR = fileURLToPath(new URL("../../modules", import.meta.url));

const suite = hasDatabase ? describe : describe.skip;

suite("persistência em Postgres", () => {
  const def = caseDefinition();
  let schema: string;
  let dropSchema: () => Promise<void>;
  // O pool da suíte vive do começo ao fim: fechá-lo no `beforeAll` deixaria o `afterAll` sem
  // conexão para limpar o schema, e o teste terminaria sujo.
  let suitePool: ReturnType<typeof createPool>;

  beforeAll(async () => {
    suitePool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(suitePool);
    schema = temp.schema;
    dropSchema = temp.drop;
    await runMigrations(suitePool, { schema });
  });

  afterAll(async () => {
    await dropSchema();
    await suitePool.end();
  });

  it("TEST-10: um pool NOVO enxerga o que o anterior gravou", async () => {
    // Este é o teste que descreve o problema que motivou a rodada: reiniciar o servidor
    // apagava a partida de quem estava jogando.
    const primeiroPool = createPool(DATABASE_URL!);
    const primeiro = createPostgresSessionRepository(primeiroPool, { schema });

    const created = await primeiro.create("caso-teste", createGameState(def));
    await primeiro.save({
      ...created,
      state: collectClue(def, created.state, "pista-cantaro", BARCARENA).state,
    });
    await primeiroPool.end(); // o "servidor" morreu

    const segundoPool = createPool(DATABASE_URL!);
    const segundo = createPostgresSessionRepository(segundoPool, { schema });
    const recuperada = await segundo.get(created.id);
    await segundoPool.end();

    expect(recuperada?.state.collectedClues).toEqual(["pista-cantaro"]);
    expect(recuperada?.moduleId).toBe("caso-teste");
  });

  it("TEST-11: rodar as migrations duas vezes não quebra", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);

    await runMigrations(pool, { schema: temp.schema });
    const segunda = await runMigrations(pool, { schema: temp.schema });

    expect(segunda.applied).toEqual([]); // nada a aplicar na segunda vez
    await temp.drop();
    await pool.end();
  });

  it("TEST-11: a primeira execução reporta o que aplicou", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);

    const primeira = await runMigrations(pool, { schema: temp.schema });

    expect(primeira.applied.length).toBeGreaterThan(0);
    expect(primeira.applied[0]).toContain("001");
    await temp.drop();
    await pool.end();
  });

  it("TEST-13: NENHUMA tabela guarda posição ou trajeto do jogador (NFR-01)", async () => {
    // O NFR-01 é uma decisão de schema, não de código: a forma de garantir que nenhum trajeto
    // seja guardado é não haver coluna onde escrevê-lo. Isto verifica no catálogo do banco.
    const pool = createPool(DATABASE_URL!);
    const { rows } = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1`,
      [schema],
    );
    await pool.end();

    const suspeitas = rows.filter((row) =>
      /(^|_)(lat|lng|latitude|longitude|position|posicao|trajeto|track|geo)(_|$)/i.test(
        row.column_name,
      ),
    );

    expect(suspeitas).toEqual([]);
    expect(rows.length).toBeGreaterThan(0); // provando que a consulta olhou para algo
  });

  it("TEST-14: a API inteira funciona sobre Postgres", async () => {
    const pool = createPool(DATABASE_URL!);
    const fake = fakeOpenAI([{ content: "Não sei do que fala." }]);
    const app = buildApp({
      modules: loadModuleRegistry(MODULES_DIR),
      sessions: createPostgresSessionRepository(pool, { schema }),
      defaultProvider: { baseUrl: "https://p.exemplo/v1", model: "m", apiKeyEnv: "K" },
      env: { K: "sk-teste" },
      fetchImpl: fake.fetch,
    });

    const created = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { moduleId: "poco-de-jaco" },
    });
    const id = created.json().id as string;

    const collected = await app.inject({
      method: "POST",
      url: `/sessions/${id}/clues/pista-cantaro/collect`,
      payload: { lat: -1.5089, lng: -48.6247 },
    });
    expect(collected.statusCode).toBe(200);

    const chat = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Este cântaro é seu?" },
    });
    expect(chat.statusCode).toBe(200);

    // E o estado continua lá quando se pergunta de novo.
    const state = await app.inject({ method: "GET", url: `/sessions/${id}` });
    expect(state.json().notebook).toHaveLength(1);

    await app.close();
    await pool.end();
  });

  it("TEST-14: a conversa gravada pela API volta no próximo turno", async () => {
    const pool = createPool(DATABASE_URL!);
    const fake = fakeOpenAI([{ content: "Primeira." }, { content: "Segunda." }]);
    const app = buildApp({
      modules: loadModuleRegistry(MODULES_DIR),
      sessions: createPostgresSessionRepository(pool, { schema }),
      defaultProvider: { baseUrl: "https://p.exemplo/v1", model: "m", apiKeyEnv: "K" },
      env: { K: "sk-teste" },
      fetchImpl: fake.fetch,
    });

    const id = (
      await app.inject({ method: "POST", url: "/sessions", payload: { moduleId: "poco-de-jaco" } })
    ).json().id as string;
    await app.inject({
      method: "POST",
      url: `/sessions/${id}/clues/pista-cantaro/collect`,
      payload: { lat: -1.5089, lng: -48.6247 },
    });

    const url = `/sessions/${id}/characters/samaritana/chat`;
    await app.inject({ method: "POST", url, payload: { message: "Primeira pergunta" } });
    await app.inject({ method: "POST", url, payload: { message: "Segunda pergunta" } });

    // O histórico veio do banco, não da memória do processo.
    const messages = fake.requests[1]?.body.messages ?? [];
    expect(messages.some((m) => m.content === "Primeira pergunta")).toBe(true);

    await app.close();
    await pool.end();
  });
});
