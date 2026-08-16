import type { ChatMessage, ToolCall } from "../src/agent/types.ts";

/**
 * Um servidor OpenAI-compatible **falso**, em memória.
 *
 * Não sobe porta e não usa rede: implementa a mesma assinatura de `fetch` e devolve respostas
 * roteirizadas. É o que torna viável testar um agente de verdade — a suíte inteira roda offline,
 * de forma determinística e sem custo de token (NFR-04).
 */
export interface ScriptedTurn {
  /** Fala do assistente neste turno. */
  readonly content?: string;
  /** Ferramentas que o modelo decide chamar neste turno. */
  readonly toolCalls?: readonly { readonly name: string; readonly arguments: unknown }[];
}

export interface FakeOpenAI {
  /** Compatível com `fetch`, para injetar no cliente. */
  readonly fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Toda requisição recebida, para inspecionar o que o runtime realmente enviou. */
  readonly requests: {
    url: string;
    headers: Record<string, string>;
    body: { messages: ChatMessage[]; tools?: { function: { name: string } }[]; model: string };
  }[];
}

/** Cria o servidor falso com uma fila de turnos. O último se repete se a fila acabar. */
export function fakeOpenAI(script: readonly ScriptedTurn[]): FakeOpenAI {
  const requests: FakeOpenAI["requests"] = [];
  let index = 0;

  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const headers = Object.fromEntries(
      Object.entries((init?.headers ?? {}) as Record<string, string>),
    );
    requests.push({ url, headers, body: JSON.parse(String(init?.body ?? "{}")) });

    const turn = script[Math.min(index, script.length - 1)] ?? {};
    index += 1;

    const toolCalls: ToolCall[] | undefined = turn.toolCalls?.map((call, i) => ({
      id: `call_${index}_${i}`,
      type: "function" as const,
      function: { name: call.name, arguments: JSON.stringify(call.arguments) },
    }));

    return jsonResponse(200, {
      choices: [
        {
          message: {
            role: "assistant",
            content: turn.content ?? null,
            ...(toolCalls ? { tool_calls: toolCalls } : {}),
          },
          finish_reason: toolCalls ? "tool_calls" : "stop",
        },
      ],
    });
  };

  return { fetch: fetchImpl, requests };
}

/** Servidor falso que sempre falha, para exercitar o tratamento de erro. */
export function failingOpenAI(status: number, body: unknown = { error: "falha" }): FakeOpenAI["fetch"] {
  return async () => jsonResponse(status, body);
}

/** Servidor falso que devolve algo que não é JSON. */
export function garbageOpenAI(): FakeOpenAI["fetch"] {
  return async () =>
    new Response("<html>gateway error</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
