#!/usr/bin/env node
/** `npm run migrate` — aplica as migrations pendentes em `DATABASE_URL`. */
import { createPool } from "./pool.ts";
import { runMigrations } from "./migrate.ts";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error("defina DATABASE_URL para aplicar as migrations");
  process.exit(2);
}

const pool = createPool(databaseUrl);
try {
  const { applied } = await runMigrations(pool);
  console.log(applied.length === 0 ? "✓ nada a aplicar" : `✓ aplicadas: ${applied.join(", ")}`);
} finally {
  await pool.end();
}
