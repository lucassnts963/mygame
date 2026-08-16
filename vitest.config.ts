import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "server/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts", "server/src/**/*.ts"],
      // O limiar vive em .specs/config.md## Defaults — este é o espelho executável dele.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
      // Pontos de entrada e CLIs são casca: delegam para código já coberto e só
      // existem para amarrar processo (argv, stdout, listen). Testá-los mediria o
      // runtime do Node, não a regra de jogo.
      exclude: ["**/cli/**", "**/main.ts", "**/index.ts"],
    },
  },
});
