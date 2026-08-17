import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { loadModuleRegistry } from "../src/repositories/module-registry.ts";
import { fakeOpenAI, type ScriptedTurn } from "./fake-openai.ts";

const MODULES_DIR = fileURLToPath(new URL("../../modules", import.meta.url));

/** Coordenadas das âncoras do módulo piloto — o detetive precisa estar nelas. */
const AT = {
  cantaro: { lat: -1.5089, lng: -48.6247 },
  hora: { lat: -1.5096, lng: -48.6239 },
  pegadas: { lat: -1.5081, lng: -48.6253 },
  longe: { lat: -23.5505, lng: -46.6333 },
};

let app: FastifyInstance;
let fake: ReturnType<typeof fakeOpenAI>;

function build(script: readonly ScriptedTurn[] = [{ content: "Não sei do que fala." }]) {
  fake = fakeOpenAI(script);
  return buildApp({
    modules: loadModuleRegistry(MODULES_DIR),
    defaultProvider: { baseUrl: "https://provedor.exemplo/v1", model: "m", apiKeyEnv: "VESTIGIO_TEST_KEY" },
    env: { VESTIGIO_TEST_KEY: "sk-chave-secretissima-do-servidor" },
    fetchImpl: fake.fetch,
  });
}

beforeEach(() => {
  app = build();
});
afterEach(async () => {
  await app.close();
});

/** Abre uma partida e devolve o id. */
async function openSession(body: Record<string, unknown> = { moduleId: "poco-de-jaco" }) {
  const response = await app.inject({ method: "POST", url: "/sessions", payload: body });
  return { response, id: response.json().id as string };
}

async function collect(id: string, clueId: string, position: Record<string, number>) {
  return app.inject({
    method: "POST",
    url: `/sessions/${id}/clues/${clueId}/collect`,
    payload: position,
  });
}

/** Percorre as três pistas do mapa, deixando a partida pronta para o interrogatório final. */
async function walkTheCase(id: string) {
  await collect(id, "pista-cantaro", AT.cantaro);
  await collect(id, "pista-hora-errada", AT.hora);
  await collect(id, "pista-pegadas", AT.pegadas);
}

describe("POST /sessions", () => {
  it("TEST-01: abre uma partida no módulo piloto", async () => {
    const { response } = await openSession();
    expect(response.statusCode).toBe(201);

    const body = response.json();
    expect(body.id).toBeTruthy();
    expect(body.caseTitle).toBe("O Cântaro Abandonado");
    expect(body.visibleClues.map((c: { id: string }) => c.id)).toEqual(["pista-cantaro"]);
  });

  it("TEST-02: módulo inexistente vira 404 nomeando o módulo", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sessions",
      payload: { moduleId: "caso-que-nao-existe" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain("caso-que-nao-existe");
  });

  it("TEST-02: sem moduleId vira 400", async () => {
    const response = await app.inject({ method: "POST", url: "/sessions", payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it("TEST-03: aceita origem para relocar o caso para outra cidade", async () => {
    const { id } = await openSession({ moduleId: "poco-de-jaco", origin: AT.longe });
    // Na coordenada original agora o jogador está longe...
    expect((await collect(id, "pista-cantaro", AT.cantaro)).statusCode).toBe(409);
    // ...e na nova origem, em cima da pista.
    expect((await collect(id, "pista-cantaro", AT.longe)).statusCode).toBe(200);
  });
});

describe("GET /sessions/:id", () => {
  it("TEST-04: traz pistas visíveis, caderno e personagens desbloqueados", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    expect(body.visibleClues.map((c: { id: string }) => c.id)).toEqual(["pista-hora-errada"]);
    expect(body.notebook.map((n: { clueId: string }) => n.clueId)).toEqual(["pista-cantaro"]);
    expect(body.characters.map((c: { id: string }) => c.id)).toContain("samaritana");
  });

  it("TEST-05: traz a distância até cada pista quando a posição é informada", async () => {
    const { id } = await openSession();
    const body = (
      await app.inject({ method: "GET", url: `/sessions/${id}?lat=${AT.longe.lat}&lng=${AT.longe.lng}` })
    ).json();

    expect(body.visibleClues[0].distanceMeters).toBeGreaterThan(1000);
  });

  it("TEST-05: sem posição, não inventa distância", async () => {
    const { id } = await openSession();
    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    expect(body.visibleClues[0].distanceMeters).toBeUndefined();
  });

  it("TEST-06: sessão inexistente vira 404", async () => {
    expect((await app.inject({ method: "GET", url: "/sessions/nao-existe" })).statusCode).toBe(404);
  });
});

describe("POST /sessions/:id/clues/:clueId/collect", () => {
  it("TEST-07: dentro do raio coleta e devolve o caderno atualizado", async () => {
    const { id } = await openSession();
    const response = await collect(id, "pista-cantaro", AT.cantaro);

    expect(response.statusCode).toBe(200);
    expect(response.json().notebook).toHaveLength(1);
    expect(response.json().verdict.reason).toBe("ok");
  });

  it("TEST-08: longe demais vira 409 dizendo quantos metros faltam", async () => {
    const { id } = await openSession();
    const response = await collect(id, "pista-cantaro", AT.longe);

    expect(response.statusCode).toBe(409);
    expect(response.json().verdict.reason).toBe("too-far");
    expect(response.json().verdict.missingMeters).toBeGreaterThan(0);
  });

  it("TEST-08: o servidor revalida — o cliente não é fonte de verdade", async () => {
    const { id } = await openSession();
    // Um cliente adulterado pediria a coleta estando longe; o servidor mede por conta própria.
    await collect(id, "pista-cantaro", AT.longe);

    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    expect(body.notebook).toHaveLength(0);
  });

  it("TEST-09: pista bloqueada vira 409 nomeando o que falta descobrir", async () => {
    const { id } = await openSession();
    const response = await collect(id, "pista-pegadas", AT.pegadas);

    expect(response.statusCode).toBe(409);
    expect(response.json().verdict.reason).toBe("locked");
    expect(response.json().verdict.missing).toContain("pista-hora-errada");
  });

  it("TEST-10: coletar de novo é idempotente e continua 200", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const again = await collect(id, "pista-cantaro", AT.cantaro);

    expect(again.statusCode).toBe(200);
    expect(again.json().notebook).toHaveLength(1);
  });

  it("TEST-11: pista inexistente vira 404", async () => {
    const { id } = await openSession();
    expect((await collect(id, "pista-fantasma", AT.cantaro)).statusCode).toBe(404);
  });

  it("TEST-11: posição malformada vira 400", async () => {
    const { id } = await openSession();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/clues/pista-cantaro/collect`,
      payload: { lat: "aqui" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("TEST-12: coletar desbloqueia o personagem que a pista libera", async () => {
    const { id } = await openSession();
    const response = await collect(id, "pista-cantaro", AT.cantaro);
    expect(response.json().characters.map((c: { id: string }) => c.id)).toContain("samaritana");
  });
});

describe("POST /sessions/:id/characters/:characterId/chat", () => {
  it("TEST-13: devolve a fala do personagem", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Este cântaro é seu?" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().reply).toBe("Não sei do que fala.");
  });

  it("TEST-14: personagem bloqueado vira 409 e não chama o provider", async () => {
    const { id } = await openSession();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Olá?" },
    });

    expect(response.statusCode).toBe(409);
    // Nenhum token gasto com uma conversa que não deveria existir.
    expect(fake.requests).toHaveLength(0);
  });

  it("TEST-14: personagem inexistente vira 404", async () => {
    const { id } = await openSession();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/ninguem/chat`,
      payload: { message: "Olá?" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("TEST-15: a pista revelada em conversa entra no caderno", async () => {
    app = build([
      { toolCalls: [{ name: "revelar_pista", arguments: { pista: "pista-confissao" } }] },
      { content: "Fui chamar a cidade." },
    ]);
    const { id } = await openSession();
    await walkTheCase(id);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Por que você correu para Sicar?" },
    });

    expect(response.json().revealedClues).toContain("pista-confissao");
    expect(response.json().notebook.map((n: { clueId: string }) => n.clueId)).toContain("pista-confissao");
  });

  it("TEST-16: mantém o histórico entre turnos", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const url = `/sessions/${id}/characters/samaritana/chat`;

    await app.inject({ method: "POST", url, payload: { message: "Primeira pergunta" } });
    await app.inject({ method: "POST", url, payload: { message: "Segunda pergunta" } });

    const messages = fake.requests[1]?.body.messages ?? [];
    expect(messages.some((m) => m.content === "Primeira pergunta")).toBe(true);
  });

  it("TEST-13: mensagem vazia vira 400", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "   " },
    });
    expect(response.statusCode).toBe(400);
  });

  it("TEST-17: NENHUMA resposta da API contém a chave do provider", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const chat = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Olá" },
    });
    const state = await app.inject({ method: "GET", url: `/sessions/${id}` });

    for (const response of [chat, state]) {
      expect(response.body).not.toContain("sk-chave-secretissima-do-servidor");
    }
  });
});

describe("POST /sessions/:id/accuse", () => {
  it("TEST-18: culpado certo com sustentação resolve o caso", async () => {
    app = build([
      { toolCalls: [{ name: "revelar_pista", arguments: { pista: "pista-confissao" } }] },
      { content: "Fui chamar a cidade." },
    ]);
    const { id } = await openSession();
    await walkTheCase(id);
    await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Por quê?" },
    });

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().verdict.reason).toBe("solved");
  });

  it("TEST-19: acertar sem a sustentação é palpite — 409 unsupported", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().verdict.reason).toBe("unsupported");
    expect(response.json().verdict.missing).toContain("pista-confissao");
  });

  it("TEST-20: a segunda acusação é recusada", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const payload = { culprit: "discipulo" };

    await app.inject({ method: "POST", url: `/sessions/${id}/accuse`, payload });
    const second = await app.inject({ method: "POST", url: `/sessions/${id}/accuse`, payload });

    expect(second.statusCode).toBe(409);
    expect(second.json().verdict.reason).toBe("already-accused");
  });

  it("TEST-20: acusar quem não é do caso vira 404", async () => {
    const { id } = await openSession();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "ninguem" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("TEST-20: sem culprit vira 400", async () => {
    const { id } = await openSession();
    expect(
      (await app.inject({ method: "POST", url: `/sessions/${id}/accuse`, payload: {} })).statusCode,
    ).toBe(400);
  });
});

describe("provider não configurado", () => {
  it("TEST-13: sem nenhum provider utilizável, o chat vira 503 — o jogo está de pé, a IA não", async () => {
    await app.close();
    fake = fakeOpenAI([{ content: "..." }]);
    app = buildApp({ modules: loadModuleRegistry(MODULES_DIR), env: {}, fetchImpl: fake.fetch });

    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Olá" },
    });

    expect(response.statusCode).toBe(503);
    // O resto do jogo continua funcionando sem IA nenhuma.
    expect((await app.inject({ method: "GET", url: `/sessions/${id}` })).statusCode).toBe(200);
  });

  it("TEST-13: o módulo compartilhado é jogável mesmo sem a chave do autor", async () => {
    // A Samaritana declara VESTIGIO_SAMARITANA_KEY, que só existe na máquina de quem escreveu o
    // módulo. A cascata pula esse nível e usa o provider do servidor.
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Olá" },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe("GET /modules", () => {
  it("TEST-21: lista os módulos disponíveis", async () => {
    const body = (await app.inject({ method: "GET", url: "/modules" })).json();
    expect(body.map((m: { id: string }) => m.id)).toContain("poco-de-jaco");
    expect(body[0].title).toBeTruthy();
  });

  it("TEST-22: a listagem não expõe a solução do caso", async () => {
    const response = await app.inject({ method: "GET", url: "/modules" });
    expect(response.body).not.toContain("culprit");
    expect(response.body).not.toContain("samaritana");
  });
});

describe("desfecho do caso", () => {
  /** Percorre tudo e arranca a confissão, deixando a partida pronta para acusar com prova. */
  async function fullyInformed() {
    app = build([
      { toolCalls: [{ name: "revelar_pista", arguments: { pista: "pista-confissao" } }] },
      { content: "Fui chamar a cidade." },
    ]);
    const { id } = await openSession();
    await walkTheCase(id);
    await app.inject({
      method: "POST",
      url: `/sessions/${id}/characters/samaritana/chat`,
      payload: { message: "Por que você correu?" },
    });
    return id;
  }

  it("TEST-13: outcome ausente enquanto a partida não terminou", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    expect(body.outcome).toBeUndefined();
  });

  it("TEST-11: NENHUMA resposta contém o texto da solução antes da acusação", async () => {
    // O teste mais importante desta spec. A página de epílogo é `spoiler: true` e só pode chegar
    // ao jogador depois da acusação — antes disso, um jogador curioso lendo a API não pode achá-la.
    const { id } = await openSession();

    const respostas = [
      await app.inject({ method: "GET", url: "/modules" }),
      await app.inject({ method: "GET", url: `/sessions/${id}` }),
      await collect(id, "pista-cantaro", AT.cantaro),
      await collect(id, "pista-hora-errada", AT.hora),
      await collect(id, "pista-pegadas", AT.pegadas),
      await app.inject({
        method: "POST",
        url: `/sessions/${id}/characters/samaritana/chat`,
        payload: { message: "Quem foi?" },
      }),
      await app.inject({ method: "GET", url: `/sessions/${id}` }),
    ];

    for (const resposta of respostas) {
      expect(resposta.body).not.toContain("cântaro continua no poço");
      expect(resposta.body).not.toContain("a-verdade");
      expect(resposta.body.toLowerCase()).not.toContain("epilogue");
    }
  });

  it("TEST-12: depois de acusar certo, o outcome traz o epílogo", async () => {
    const id = await fullyInformed();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    const outcome = response.json().outcome;
    expect(outcome.verdict).toBe("solved");
    expect(outcome.culprit).toBe("samaritana");
    expect(outcome.epilogue).toContain("cântaro continua no poço");
  });

  it("TEST-12: o epílogo entregue não contém a nota de autoria", async () => {
    const id = await fullyInformed();
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    const epilogue = response.json().outcome.epilogue as string;
    expect(epilogue).not.toContain("NOTA DE AUTORIA");
    expect(epilogue).not.toContain("ADR-006");
    expect(epilogue).not.toContain("spoiler");
  });

  it("TEST-14: ERRAR também traz o epílogo — o caso acabou de qualquer forma", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "discipulo" },
    });

    // 409 porque o veredito é negativo, mas o desfecho vem junto.
    expect(response.statusCode).toBe(409);
    const outcome = response.json().view.outcome;
    expect(outcome.verdict).toBe("wrong");
    expect(outcome.accused).toBe("discipulo");
    expect(outcome.culprit).toBe("samaritana");
    expect(outcome.epilogue).toContain("cântaro continua no poço");
  });

  it("TEST-14: acertar sem prova é unsupported, e também recebe o desfecho", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    const outcome = response.json().view.outcome;
    expect(outcome.verdict).toBe("unsupported");
    expect(outcome.epilogue).toBeTruthy();
  });

  it("TEST-12: o desfecho lista o que ficou para trás", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    const outcome = response.json().view.outcome;
    expect(outcome.missedClues.map((c: { id: string }) => c.id)).toContain("pista-pegadas");
    // As perdidas vêm com o texto: é recompensa por terminar, não spoiler.
    expect(outcome.missedClues[0].description).toBeTruthy();
    expect(outcome.missedCharacters.map((c: { id: string }) => c.id)).toContain("discipulo");
  });

  it("TEST-12: o desfecho continua acessível depois, em modo leitura", async () => {
    const id = await fullyInformed();
    await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    expect(body.outcome.verdict).toBe("solved");
    expect(body.outcome.epilogue).toBeTruthy();
    // E o caderno continua lá — nada do que o jogador construiu é descartado.
    expect(body.notebook.length).toBeGreaterThan(0);
  });
});

describe("tratamento de erro", () => {
  it("TEST-11: rota inexistente vira 404, não 500", async () => {
    expect((await app.inject({ method: "GET", url: "/rota-que-nao-existe" })).statusCode).toBe(404);
  });

  it("TEST-11: JSON malformado vira 400 com mensagem, não stack trace", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/sessions",
      headers: { "content-type": "application/json" },
      payload: "{isto não é json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBeTruthy();
    expect(response.body).not.toContain("at Object.");
  });

  it("TEST-19: a recusa de acusação devolve o estado junto do veredito", async () => {
    // O app precisa poder redesenhar a tela mesmo quando o desfecho é negativo.
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);

    const response = await app.inject({
      method: "POST",
      url: `/sessions/${id}/accuse`,
      payload: { culprit: "samaritana" },
    });

    expect(response.json().view.notebook).toHaveLength(1);
    expect(response.json().view.accusation.reason).toBe("unsupported");
  });
});

describe("privacidade da localização (NFR-01)", () => {
  it("TEST-22: a posição é usada para validar e não fica guardada na sessão", async () => {
    const { id } = await openSession();
    await collect(id, "pista-cantaro", AT.cantaro);
    await collect(id, "pista-hora-errada", AT.hora);

    // O estado devolvido não carrega histórico de posições — nem por outro nome.
    const body = (await app.inject({ method: "GET", url: `/sessions/${id}` })).json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("-1.5096");
    expect(serialized).not.toMatch(/trajeto|positions|history/i);
  });
});
