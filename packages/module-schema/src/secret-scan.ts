import type { Diagnostic } from "./types.ts";

/**
 * Valores que **não** são segredo, mesmo aparecendo depois de uma chave com nome suspeito:
 * vazio, nulo, e referências a variável de ambiente (`${VAR}`, `$VAR`, `env:VAR`).
 */
const PLACEHOLDER = /^\s*(|null|~|\$\{[^}]+\}|\$[A-Z_][A-Z0-9_]*|env:[A-Za-z_][\w]*)\s*$/;

/**
 * Padrões de segredo literal.
 *
 * Duas famílias: chaves nomeadas com valor preenchido, e prefixos de credencial reconhecíveis
 * por si sós. `api_key_env` está fora de propósito — ela guarda o *nome* da variável, não a chave.
 */
const PATTERNS: readonly { readonly code: string; readonly regex: RegExp; readonly what: string }[] = [
  {
    code: "secret-literal",
    regex: /\b(api[_-]?key|secret|password|token)\s*[:=]\s*(?!_env\b)(.+)$/i,
    what: "uma chave com valor literal",
  },
  {
    code: "secret-literal",
    regex: /\bauthorization\s*[:=]\s*bearer\s+\S+/i,
    what: "um header Authorization com token",
  },
  {
    code: "secret-literal",
    regex: /\b(sk|rk|pk)-[A-Za-z0-9_-]{16,}\b/,
    what: "uma credencial no formato sk-…",
  },
];

/** Nomes de campo que guardam a *referência* ao segredo, não o segredo. */
const SAFE_KEY = /\b(api[_-]?key|secret|password|token)_env\s*[:=]/i;

/**
 * Procura segredos escritos literalmente num arquivo do módulo.
 *
 * Isto é `error`, e não `warning`, porque um módulo existe para ser compartilhado: no instante em
 * que o autor manda o diretório para alguém, tudo que estiver dentro vazou (ADR-008). Aviso se
 * ignora; erro não.
 */
export function scanForSecrets(file: string, content: string): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  content.split("\n").forEach((rawLine, index) => {
    const line = rawLine.split("#")[0] ?? rawLine; // comentário não é configuração
    if (SAFE_KEY.test(line)) return;

    for (const { code, regex, what } of PATTERNS) {
      const match = line.match(regex);
      if (!match) continue;

      // Para as chaves nomeadas, o grupo 2 é o valor: vazio ou referência a env não é segredo.
      const value = match[2];
      if (value !== undefined && PLACEHOLDER.test(value)) continue;

      diagnostics.push({
        severity: "error",
        code,
        file,
        line: index + 1,
        message: `${what} — um módulo é feito para ser compartilhado; use 'api_key_env' com o nome da variável de ambiente`,
      });
      return; // um diagnóstico por linha basta
    }
  });

  return diagnostics;
}
