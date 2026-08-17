import { collectClue, createGameState, judgeAccusation } from "@vestigio/engine";
import { beforeEach, describe, expect, it } from "vitest";
import type { SessionRepository } from "../src/repositories/session-repository.ts";
import { BARCARENA, caseDefinition } from "./fixtures.ts";

/**
 * A suíte de contrato do repositório de sessões.
 *
 * Roda **igual** contra memória e contra Postgres. É o que impede as duas implementações de
 * divergirem em silêncio — o modo de falha mais caro possível aqui, porque a divergência só
 * apareceria em produção, na partida de alguém.
 */
export function describeSessionRepositoryContract(
  name: string,
  createRepository: () => Promise<SessionRepository>,
): void {
  describe(`SessionRepository — contrato (${name})`, () => {
    const def = caseDefinition();
    let repo: SessionRepository;

    beforeEach(async () => {
      repo = await createRepository();
    });

    it("TEST-01: create devolve uma sessão com id e estado inicial", async () => {
      const session = await repo.create("caso-teste", createGameState(def));

      expect(session.id).toBeTruthy();
      expect(session.moduleId).toBe("caso-teste");
      expect(session.state.collectedClues).toEqual([]);
      expect(session.conversations.size).toBe(0);
    });

    it("TEST-01: cada create gera um id diferente", async () => {
      const a = await repo.create("caso-teste", createGameState(def));
      const b = await repo.create("caso-teste", createGameState(def));
      expect(a.id).not.toBe(b.id);
    });

    it("TEST-02: get devolve o que create criou", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      const found = await repo.get(created.id);

      expect(found?.id).toBe(created.id);
      expect(found?.moduleId).toBe("caso-teste");
    });

    it("TEST-03: get de id inexistente devolve undefined", async () => {
      expect(await repo.get("00000000-0000-4000-8000-000000000000")).toBeUndefined();
    });

    it("TEST-04: save persiste o estado alterado", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      const state = collectClue(def, created.state, "pista-cantaro", BARCARENA).state;

      await repo.save({ ...created, state });

      const found = await repo.get(created.id);
      expect(found?.state.collectedClues).toEqual(["pista-cantaro"]);
    });

    it("TEST-05: save preserva a conversa de um personagem", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      const conversations = new Map(created.conversations);
      conversations.set("samaritana", {
        messages: [
          { role: "user", content: "Este cântaro é seu?" },
          { role: "assistant", content: "É de quem precisar dele." },
        ],
        turns: 1,
      });

      await repo.save({ ...created, conversations });

      const found = await repo.get(created.id);
      const conversation = found?.conversations.get("samaritana");
      expect(conversation?.turns).toBe(1);
      expect(conversation?.messages).toHaveLength(2);
      expect(conversation?.messages[1]?.content).toBe("É de quem precisar dele.");
    });

    it("TEST-06: conversas de personagens diferentes não se misturam", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      const conversations = new Map(created.conversations);
      conversations.set("samaritana", {
        messages: [{ role: "assistant", content: "Fala da samaritana" }],
        turns: 1,
      });
      conversations.set("discipulo", {
        messages: [{ role: "assistant", content: "Fala do discípulo" }],
        turns: 3,
      });

      await repo.save({ ...created, conversations });

      const found = await repo.get(created.id);
      expect(found?.conversations.get("samaritana")?.turns).toBe(1);
      expect(found?.conversations.get("discipulo")?.turns).toBe(3);
      expect(found?.conversations.get("samaritana")?.messages[0]?.content).toBe("Fala da samaritana");
    });

    it("TEST-05: uma conversa atualizada substitui a anterior, sem duplicar", async () => {
      const created = await repo.create("caso-teste", createGameState(def));

      for (const turns of [1, 2, 3]) {
        const conversations = new Map<string, { messages: never[]; turns: number }>();
        conversations.set("samaritana", { messages: [], turns });
        await repo.save({ ...created, conversations });
      }

      const found = await repo.get(created.id);
      expect(found?.conversations.size).toBe(1);
      expect(found?.conversations.get("samaritana")?.turns).toBe(3);
    });

    it("TEST-07: a origem da partida sobrevive à ida e volta", async () => {
      const origin = { lat: -23.5505, lng: -46.6333 };
      const created = await repo.create("caso-teste", createGameState(def, { origin }));

      expect((await repo.get(created.id))?.state.origin).toEqual(origin);
    });

    it("TEST-07: uma partida sem origem volta com origin nulo, não indefinido", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      expect((await repo.get(created.id))?.state.origin).toBeNull();
    });

    it("TEST-08: a acusação sobrevive à ida e volta", async () => {
      const created = await repo.create("caso-teste", createGameState(def));
      const { state } = judgeAccusation(def, created.state, "samaritana");

      await repo.save({ ...created, state });

      const found = await repo.get(created.id);
      expect(found?.state.accusation).toEqual({ culprit: "samaritana", reason: "unsupported" });
    });

    it("TEST-09: duas sessões não se contaminam", async () => {
      const a = await repo.create("caso-teste", createGameState(def));
      const b = await repo.create("caso-teste", createGameState(def));

      await repo.save({
        ...a,
        state: collectClue(def, a.state, "pista-cantaro", BARCARENA).state,
      });

      expect((await repo.get(a.id))?.state.collectedClues).toEqual(["pista-cantaro"]);
      expect((await repo.get(b.id))?.state.collectedClues).toEqual([]);
    });

    it("TEST-09: salvar uma sessão não apaga a conversa de outra", async () => {
      const a = await repo.create("caso-teste", createGameState(def));
      const b = await repo.create("caso-teste", createGameState(def));

      const conversations = new Map(a.conversations);
      conversations.set("samaritana", { messages: [], turns: 2 });
      await repo.save({ ...a, conversations });
      await repo.save({ ...b, state: b.state });

      expect((await repo.get(a.id))?.conversations.get("samaritana")?.turns).toBe(2);
    });
  });
}
