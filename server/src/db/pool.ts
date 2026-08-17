import pg from "pg";

/**
 * `pg` retorna `bigint` (int8) como string por segurança — em JS um inteiro de 64 bits não cabe
 * num `number`. Este projeto não usa int8, mas deixar explícito evita a surpresa clássica de
 * `count(*)` voltar `"3"` em vez de `3`.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Pool = pg.Pool;

/** Cria um pool de conexões a partir de uma URL de Postgres. */
export function createPool(databaseUrl: string): Pool {
  return new pg.Pool({
    connectionString: databaseUrl,
    // Supabase e a maioria dos hosts gerenciados exigem TLS; um Postgres local não tem
    // certificado que valide. `rejectUnauthorized: false` é o meio-termo usual para pooler
    // gerenciado — não vale para um banco exposto na internet aberta.
    ...(databaseUrl.includes("localhost") || databaseUrl.includes("host=/")
      ? {}
      : { ssl: { rejectUnauthorized: false } }),
  });
}

/**
 * Prefixo de schema para as consultas.
 *
 * Existe para os testes: cada arquivo de teste roda no seu próprio schema, o que permite
 * paralelismo real sem um teste apagar o dado do outro. Em produção fica vazio (`public`).
 */
export function schemaPrefix(schema?: string): string {
  return schema ? `"${schema}".` : "";
}
