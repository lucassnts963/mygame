import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "./pool.ts";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

export interface MigrateOptions {
  /** Schema alvo. Usado pelos testes para isolar execuções; vazio = `public`. */
  readonly schema?: string;
  readonly directory?: string;
}

export interface MigrateResult {
  readonly applied: readonly string[];
}

/**
 * Aplica as migrations pendentes, em ordem de nome.
 *
 * SQL puro em vez de um ORM, e ~40 linhas em vez de um framework: combina com um projeto que roda
 * sem passo de build, e mantém os arquivos legíveis por quem for aplicá-los à mão no painel do
 * Supabase.
 *
 * **Cada migration roda dentro de uma transação** junto com o registro em `schema_migrations`.
 * Sem isso, uma falha no meio deixaria metade aplicada e o registro dizendo que tudo correu bem —
 * o pior estado possível para depurar.
 */
export async function runMigrations(pool: Pool, options: MigrateOptions = {}): Promise<MigrateResult> {
  const directory = options.directory ?? MIGRATIONS_DIR;
  const prefix = options.schema ? `"${options.schema}".` : "";

  const client = await pool.connect();
  try {
    // `search_path` faz o SQL das migrations cair no schema certo sem precisar qualificar cada
    // tabela — é o que permite o mesmo arquivo servir a produção e aos schemas dos testes.
    if (options.schema) await client.query(`SET search_path TO "${options.schema}"`);

    await client.query(
      `CREATE TABLE IF NOT EXISTS ${prefix}schema_migrations (
         version    text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );

    const { rows } = await client.query<{ version: string }>(
      `SELECT version FROM ${prefix}schema_migrations`,
    );
    const done = new Set(rows.map((row) => row.version));

    const pending = readdirSync(directory)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      .filter((file) => !done.has(versionOf(file)));

    const applied: string[] = [];
    for (const file of pending) {
      const sql = readFileSync(join(directory, file), "utf8");
      await client.query("BEGIN");
      try {
        if (options.schema) await client.query(`SET search_path TO "${options.schema}"`);
        await client.query(sql);
        await client.query(`INSERT INTO ${prefix}schema_migrations (version) VALUES ($1)`, [
          versionOf(file),
        ]);
        await client.query("COMMIT");
        applied.push(versionOf(file));
      } catch (cause) {
        await client.query("ROLLBACK");
        throw new Error(
          `migration '${file}' falhou: ${cause instanceof Error ? cause.message : cause}`,
        );
      }
    }

    return { applied };
  } finally {
    client.release();
  }
}

function versionOf(file: string): string {
  return file.replace(/\.sql$/, "");
}
