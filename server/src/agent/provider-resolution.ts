import { SecretKey } from "./crypto.ts";
import type { ProviderConfig, ResolvedProvider } from "./types.ts";

export interface ProviderCascade {
  /** Declarado no `agent.yaml` do personagem — o mais específico, vence todos. */
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
 * A escolha é por **nível inteiro**, não campo a campo. Herdar o modelo de um nível e a URL de
 * outro produziria combinações que ninguém escreveu — um `base_url` de Ollama com um nome de
 * modelo da OpenAI, por exemplo — e o erro só apareceria em produção, na cara do jogador.
 */
export function resolveProvider(cascade: ProviderCascade): ResolvedProvider {
  const config = cascade.character ?? cascade.module ?? cascade.server;
  if (!config) {
    throw new Error(
      "nenhum provider configurado: declare um em provider no agent.yaml, no módulo ou no servidor",
    );
  }

  return {
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: new SecretKey(resolveKey(config, cascade.env)),
    ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
    ...(config.maxTokens === undefined ? {} : { maxTokens: config.maxTokens }),
  };
}

/**
 * Carrega a chave da variável de ambiente nomeada.
 *
 * Um provider **sem** `apiKeyEnv` é legítimo: é assim que se aponta para um modelo local
 * (Ollama, llama.cpp), que não pede credencial nenhuma.
 */
function resolveKey(config: ProviderConfig, env: Record<string, string | undefined>): string {
  if (!config.apiKeyEnv) return "";

  const value = env[config.apiKeyEnv];
  if (!value) {
    throw new Error(
      `a variável de ambiente '${config.apiKeyEnv}' não está definida — ela deveria conter a chave do provider`,
    );
  }
  return value;
}
