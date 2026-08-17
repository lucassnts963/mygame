import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { createPool, schemaPrefix } from "../src/db/pool.ts";
import { runMigrations } from "../src/db/migrate.ts";
import { DATABASE_URL, hasDatabase, withTemporarySchema } from "./db-harness.ts";

describe("schemaPrefix", () => {
  it("devolve vazio sem schema — em produção as tabelas ficam em public", () => {
    expect(schemaPrefix()).toBe("");
    expect(schemaPrefix(undefined)).toBe("");
  });

  it("aspas no nome do schema, porque os dos testes têm formato incomum", () => {
    expect(schemaPrefix("teste_abc123")).toBe('"teste_abc123".');
  });
});

describe("createPool", () => {
  const pools: ReturnType<typeof createPool>[] = [];
  afterAll(async () => {
    for (const pool of pools) await pool.end();
  });

  it("não exige TLS num banco local", () => {
    // Postgres local não tem certificado que valide; exigir TLS impediria rodar em casa.
    const pool = createPool("postgresql://postgres@localhost:5432/x");
    pools.push(pool);
    expect((pool.options as { ssl?: unknown }).ssl).toBeFalsy();
  });

  it("não exige TLS num socket unix", () => {
    const pool = createPool("postgresql://postgres@/x?host=/tmp");
    pools.push(pool);
    expect((pool.options as { ssl?: unknown }).ssl).toBeFalsy();
  });

  it("usa TLS num host remoto — é o caso do Supabase e afins", () => {
    const pool = createPool("postgresql://user:pw@db.exemplo.supabase.co:5432/postgres");
    pools.push(pool);
    expect((pool.options as { ssl?: unknown }).ssl).toBeTruthy();
  });
});

const suite = hasDatabase ? describe : describe.skip;

suite("runMigrations", () => {
  const cleanups: (() => Promise<void>)[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  /** Diretório de migrations descartável, para exercitar o runner sem tocar nas reais. */
  function migrationsDir(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "vestigio-mig-"));
    dirs.push(dir);
    for (const [name, sql] of Object.entries(files)) writeFileSync(join(dir, name), sql, "utf8");
    return dir;
  }

  it("TEST-12: uma migration com erro NÃO deixa metade aplicada", async () => {
    // Sem transação, a primeira instrução ficaria de pé e o registro diria que tudo correu bem —
    // o pior estado possível para depurar, porque o banco mente sobre onde parou.
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);
    cleanups.push(temp.drop, async () => pool.end());

    const directory = migrationsDir({
      "001_quebrada.sql": `
        CREATE TABLE metade_aplicada (id int);
        ISTO NÃO É SQL VÁLIDO;
      `,
    });

    await expect(runMigrations(pool, { schema: temp.schema, directory })).rejects.toThrow(
      /001_quebrada/,
    );

    const { rows } = await pool.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = 'metade_aplicada'`,
      [temp.schema],
    );
    expect(rows[0]?.count).toBe(0);
  });

  it("TEST-12: a migration quebrada não é registrada como aplicada", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);
    cleanups.push(temp.drop, async () => pool.end());

    const directory = migrationsDir({ "001_quebrada.sql": "SELECT * FROM tabela_que_nao_existe;" });
    await expect(runMigrations(pool, { schema: temp.schema, directory })).rejects.toThrow();

    const { rows } = await pool.query<{ version: string }>(
      `SELECT version FROM "${temp.schema}".schema_migrations`,
    );
    expect(rows).toEqual([]);
  });

  it("TEST-11: aplica em ordem de nome, não em ordem de leitura do disco", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);
    cleanups.push(temp.drop, async () => pool.end());

    // A segunda depende da primeira: se a ordem não fosse garantida, isto falharia.
    const directory = migrationsDir({
      "002_coluna.sql": "ALTER TABLE primeira ADD COLUMN nome text;",
      "001_tabela.sql": "CREATE TABLE primeira (id int);",
    });

    const { applied } = await runMigrations(pool, { schema: temp.schema, directory });
    expect(applied).toEqual(["001_tabela", "002_coluna"]);
  });

  it("TEST-11: ignora arquivos que não são .sql", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);
    cleanups.push(temp.drop, async () => pool.end());

    const directory = migrationsDir({
      "001_ok.sql": "CREATE TABLE t (id int);",
      "LEIA-ME.md": "isto não é uma migration",
    });

    const { applied } = await runMigrations(pool, { schema: temp.schema, directory });
    expect(applied).toEqual(["001_ok"]);
  });

  it("TEST-11: aplica só o que falta quando uma migration nova aparece", async () => {
    const pool = createPool(DATABASE_URL!);
    const temp = await withTemporarySchema(pool);
    cleanups.push(temp.drop, async () => pool.end());

    const primeira = migrationsDir({ "001_a.sql": "CREATE TABLE a (id int);" });
    await runMigrations(pool, { schema: temp.schema, directory: primeira });

    const segunda = migrationsDir({
      "001_a.sql": "CREATE TABLE a (id int);",
      "002_b.sql": "CREATE TABLE b (id int);",
    });
    const { applied } = await runMigrations(pool, { schema: temp.schema, directory: segunda });

    expect(applied).toEqual(["002_b"]);
  });
});
