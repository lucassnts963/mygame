import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

/**
 * Ferramentas para os testes que precisam de Postgres de verdade.
 *
 * A regra é: **sem `DATABASE_URL`, os testes de banco pulam em vez de falhar.** Quem clona o
 * repositório consegue rodar `npm test` sem instalar Postgres; a CI, que tem banco, cobre o
 * resto. Um teste que falha por falta de infraestrutura ensina o time a ignorar teste vermelho.
 */
export const DATABASE_URL = process.env["DATABASE_URL"];
export const hasDatabase = Boolean(DATABASE_URL);

/** Cria um schema isolado para o teste e devolve como limpá-lo. */
export async function withTemporarySchema(pool: Pool): Promise<{
  schema: string;
  drop: () => Promise<void>;
}> {
  // Schema por execução, e não `TRUNCATE` entre testes: arquivos de teste rodam em paralelo no
  // vitest, e compartilhar tabelas faria um teste apagar o dado do outro de forma intermitente —
  // o tipo de falha que se culpa de "flaky" e se re-roda em vez de investigar.
  const schema = `teste_${randomUUID().replace(/-/g, "")}`;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  return {
    schema,
    drop: async () => {
      await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    },
  };
}
