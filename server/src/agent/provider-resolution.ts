import { SecretKey } from "./crypto.ts";
import type { ProviderConfig, ResolvedProvider } from "./types.ts";

export interface ProviderCascade {
  /** Declarado no `agent.yaml` do personagem — o mais específico, tem a primeira chance. */
  readonly character?: ProviderConfig;
  /** Declarado pelo módulo — vale para os personagens que não declararem o seu. */
  readonly module?: ProviderConfig;
  /** O padrão do servidor — o último recurso. */
  readonly server?: ProviderConfig;
  readonly env: Record<string, string | undefined>;
}

/**
 * Resolve qual provider atende este personagem: **personagem → módulo → servidor** (REQ-12).
 *
 * Duas regras, e a segunda é o que faz módulos serem compartilháveis:
 *
 * 1. **A escolha é por nível inteiro, não campo a campo.** Herdar o modelo de um nível e a URL de
 *    outro produziria combinações que ninguém escreveu — um `base_url` de Ollama com um nome de
 *    modelo da OpenAI — e o erro só apareceria na cara do jogador.
 *
 * 2. **Um nível cuja chave não está configurada é pulado, não fatal.** Um módulo é feito para ser
 *    compartilhado: se a Samaritana declara `VESTIGIO_SAMARITANA_KEY`, essa variável existe na
 *    máquina do *autor* e em mais nenhuma. Falhar ali tornaria todo módulo publicado injogável
 *    por qualquer outra pessoa. Pulando, quem recebe o módulo joga com o provider que tem — e o
 *    autor continua rodando com o dele.
 *
 * Só quando **nenhum** nível é utilizável a resolução falha, e a mensagem diz o que foi pulado e
 * por quê — para o dono do servidor não ficar adivinhando.
 */
export function resolveProvider(cascade: ProviderCascade): ResolvedProvider {
  const levels: readonly (readonly [string, ProviderConfig | undefined])[] = [
    ["personagem", cascade.character],
    ["módulo", cascade.module],
    ["servidor", cascade.server],
  ];

  const skipped: string[] = [];

  for (const [label, config] of levels) {
    if (!config) continue;

    const key = readKey(config, cascade.env);
    if (key === MISSING) {
      skipped.push(`${label} (a variável '${config.apiKeyEnv}' não está definida)`);
      continue;
    }

    return {
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: new SecretKey(key),
      ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
      ...(config.maxTokens === undefined ? {} : { maxTokens: config.maxTokens }),
    };
  }

  throw new Error(
    skipped.length > 0
      ? `nenhum provider utilizável: ${skipped.join("; ")}`
      : "nenhum provider configurado: declare um em provider no agent.yaml, no módulo ou no servidor",
  );
}

/** Sentinela para distinguir "sem chave por design" de "chave que deveria existir e não existe". */
const MISSING = Symbol("chave ausente");

/**
 * Lê a chave da variável de ambiente nomeada.
 *
 * Um provider **sem** `apiKeyEnv` é legítimo, e devolve string vazia: é assim que se aponta para
 * um modelo local (Ollama, llama.cpp), que não pede credencial nenhuma.
 */
function readKey(config: ProviderConfig, env: Record<string, string | undefined>): string | typeof MISSING {
  if (!config.apiKeyEnv) return "";
  return env[config.apiKeyEnv] || MISSING;
}
