import { afterAll, describe, it } from "vitest";
import { createInMemorySessionRepository } from "../src/repositories/session-repository.ts";
import { createPostgresSessionRepository } from "../src/repositories/postgres-session-repository.ts";
import { createPool } from "../src/db/pool.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { DATABASE_URL, hasDatabase, withTemporarySchema } from "./db-harness.ts";
import { describeSessionRepositoryContract } from "./session-repository-contract.ts";

// A mesma suíte, as duas implementações. É o contrato que impede a divergência silenciosa.
describeSessionRepositoryContract("memória", async () => createInMemorySessionRepository());

if (hasDatabase) {
  const pool = createPool(DATABASE_URL!);
  const cleanups: (() => Promise<void>)[] = [];

  afterAll(async () => {
    for (const cleanup of cleanups) await cleanup();
    await pool.end();
  });

  describeSessionRepositoryContract("postgres", async () => {
    const { schema, drop } = await withTemporarySchema(pool);
    cleanups.push(drop);
    await runMigrations(pool, { schema });
    return createPostgresSessionRepository(pool, { schema });
  });
} else {
  describe("SessionRepository — contrato (postgres)", () => {
    it.skip("pulado: defina DATABASE_URL para rodar os testes de Postgres", () => {});
  });
}
