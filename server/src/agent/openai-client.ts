import type { ChatMessage, ResolvedProvider, ToolSpec } from "./types.ts";

export interface ChatClient {
  complete(messages: readonly ChatMessage[], tools: readonly ToolSpec[]): Promise<ChatMessage>;
}

/**
 * Assinatura mínima de `fetch` que o cliente usa. Mais estreita que `typeof fetch` de propósito:
 * é o que um servidor falso precisa implementar para substituí-lo nos testes (NFR-04).
 */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Cliente de um endpoint **compatível com a API da OpenAI** (ADR-007).
 *
 * Não há SDK e não há ramificação por fornecedor: o runtime fala um único protocolo, e é isso que
 * faz OpenAI, Groq, OpenRouter, Ollama e llama.cpp servirem sem uma linha de código diferente.
 * `fetchImpl` é injetável para os testes rodarem contra um servidor falso, sem rede (NFR-04).
 */
export function createChatClient(
  provider: ResolvedProvider,
  fetchImpl: FetchLike = fetch,
): ChatClient {
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    async complete(messages, tools) {
      const key = provider.apiKey.reveal();
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Sem chave, sem header: é assim que um modelo local é atendido.
          ...(key ? { Authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          ...(tools.length > 0
            ? {
                tools: tools.map((tool) => ({
                  type: "function",
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.parameters,
                  },
                })),
              }
            : {}),
          ...(provider.temperature === undefined ? {} : { temperature: provider.temperature }),
          ...(provider.maxTokens === undefined ? {} : { max_tokens: provider.maxTokens }),
        }),
      });

      if (!response.ok) {
        // O corpo do erro entra na mensagem, mas a chave nunca: um 401 costuma ser justamente
        // o caso em que alguém vai colar o log num chat pedindo ajuda.
        throw new Error(
          `o provider respondeu ${response.status} em ${url} — ${await safeBody(response)}`,
        );
      }

      const payload = await parseJson(response);
      const message = (payload as { choices?: { message?: ChatMessage }[] }).choices?.[0]?.message;
      if (!message) {
        throw new Error("resposta do provider sem 'choices[0].message' — endpoint incompatível?");
      }
      return message;
    },
  };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // Gateways e proxies erram devolvendo HTML com status 200; sem isto o erro seria um
    // "Unexpected token <" que não diz nada a quem configurou o provider.
    throw new Error(`resposta do provider não é JSON: ${text.slice(0, 120)}`);
  }
}

async function safeBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 200);
  } catch {
    return "(corpo ilegível)";
  }
}
