import { describe, expect, it } from "vitest";
import {
  canCollect,
  collectClue,
  createGameState,
  notebook,
  unlockedCharacters,
  visibleClues,
} from "../src/game-state.ts";
import { BARCARENA, caseWith, nearby, solvableCase } from "./fixtures.ts";

const ids = (xs: readonly { id: string }[]) => xs.map((x) => x.id);

describe("canCollect", () => {
  const def = solvableCase();
  const fresh = createGameState(def);

  it("TEST-13: aceita quem está dentro do raio", () => {
    const v = canCollect(def, fresh, "pista-cantaro", nearby(BARCARENA, 0.0001, 0));
    expect(v).toMatchObject({ ok: true, reason: "ok" });
  });

  it("TEST-13: recusa quem está longe, informando quanto falta", () => {
    const v = canCollect(def, fresh, "pista-cantaro", nearby(BARCARENA, 0.002, 0));
    expect(v.ok).toBe(false);
    if (v.ok || v.reason !== "too-far") throw new Error("esperava too-far");
    expect(v.distanceMeters).toBeGreaterThan(200);
    // A distância que falta é o que excede o raio — é isso que vira mensagem para o jogador.
    expect(v.missingMeters).toBeCloseTo(v.distanceMeters - 25, 5);
  });

  it("TEST-14: recusa pista bloqueada nomeando o pré-requisito", () => {
    const v = canCollect(def, fresh, "pista-pegadas", { lat: -1.5095, lng: -48.624 });
    expect(v.ok).toBe(false);
    if (v.ok || v.reason !== "locked") throw new Error("esperava locked");
    expect(v.missing).toEqual(["pista-cantaro"]);
  });

  it("TEST-14: o bloqueio tem precedência sobre a distância", () => {
    // Longe E bloqueada: o jogador precisa saber que nem adianta ir até lá ainda.
    const v = canCollect(def, fresh, "pista-pegadas", { lat: 0, lng: 0 });
    expect(v).toMatchObject({ ok: false, reason: "locked" });
  });

  it("TEST-15: recusa id inexistente", () => {
    expect(canCollect(def, fresh, "pista-fantasma", BARCARENA)).toMatchObject({
      ok: false,
      reason: "unknown-clue",
    });
  });

  it("TEST-16: dispensa posição quando a pista não tem âncora", () => {
    const afterCantaro = collectClue(def, fresh, "pista-cantaro", BARCARENA).state;
    const afterPegadas = collectClue(def, afterCantaro, "pista-pegadas", {
      lat: -1.5095,
      lng: -48.624,
    }).state;
    expect(canCollect(def, afterPegadas, "pista-confissao")).toMatchObject({ ok: true });
  });

  it("TEST-16: exige posição quando a pista tem âncora", () => {
    expect(canCollect(def, fresh, "pista-cantaro")).toMatchObject({
      ok: false,
      reason: "position-required",
    });
  });

  it("TEST-13: aplica a origem da partida antes de medir (REQ-19)", () => {
    const relocated = createGameState(def, { origin: { lat: -23.5505, lng: -46.6333 } });
    // Na coordenada original o jogador agora está longe...
    expect(canCollect(def, relocated, "pista-cantaro", BARCARENA)).toMatchObject({
      ok: false,
      reason: "too-far",
    });
    // ...e na nova origem, dentro do raio.
    expect(canCollect(def, relocated, "pista-cantaro", { lat: -23.5505, lng: -46.6333 })).toMatchObject({
      ok: true,
    });
  });
});

describe("collectClue", () => {
  const def = solvableCase();

  it("TEST-17: acrescenta ao caderno sem mutar o estado anterior", () => {
    const before = createGameState(def);
    const { state, verdict } = collectClue(def, before, "pista-cantaro", BARCARENA);

    expect(verdict).toMatchObject({ ok: true, reason: "ok" });
    expect(state.collectedClues).toEqual(["pista-cantaro"]);
    expect(before.collectedClues).toEqual([]);
    expect(state).not.toBe(before);
  });

  it("TEST-18: coletar de novo é idempotente", () => {
    const once = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    const { state: twice, verdict } = collectClue(def, once, "pista-cantaro", BARCARENA);

    expect(verdict).toMatchObject({ ok: true, reason: "already-collected" });
    expect(twice.collectedClues).toEqual(["pista-cantaro"]);
  });

  it("TEST-18: coleta repetida vale mesmo se o jogador já saiu do raio", () => {
    // NFR-06: oscilação de GPS não pode tirar do jogador o que ele já descobriu.
    const once = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    const { verdict } = collectClue(def, once, "pista-cantaro", { lat: 0, lng: 0 });
    expect(verdict).toMatchObject({ ok: true, reason: "already-collected" });
  });

  it("TEST-17: uma coleta recusada não altera o estado", () => {
    const before = createGameState(def);
    const { state, verdict } = collectClue(def, before, "pista-cantaro", { lat: 0, lng: 0 });
    expect(verdict.ok).toBe(false);
    expect(state).toBe(before);
  });

  it("TEST-19: desbloqueia as pistas dependentes", () => {
    const before = createGameState(def);
    expect(ids(visibleClues(def, before))).toEqual(["pista-cantaro"]);

    const { state } = collectClue(def, before, "pista-cantaro", BARCARENA);
    expect(ids(visibleClues(def, state))).toEqual(["pista-pegadas"]);
  });
});

describe("visibleClues", () => {
  const def = solvableCase();

  it("TEST-20: esconde as já coletadas e as ainda bloqueadas", () => {
    const state = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    const visible = ids(visibleClues(def, state));
    expect(visible).not.toContain("pista-cantaro");
    expect(visible).not.toContain("pista-confissao");
    expect(visible).toEqual(["pista-pegadas"]);
  });

  it("TEST-20: fica vazio quando tudo foi coletado", () => {
    let state = createGameState(def);
    state = collectClue(def, state, "pista-cantaro", BARCARENA).state;
    state = collectClue(def, state, "pista-pegadas", { lat: -1.5095, lng: -48.624 }).state;
    state = collectClue(def, state, "pista-confissao").state;
    expect(visibleClues(def, state)).toEqual([]);
  });
});

describe("unlockedCharacters", () => {
  const def = solvableCase();

  it("TEST-21: começa só com os personagens sem pré-requisito", () => {
    expect(ids(unlockedCharacters(def, createGameState(def)))).toEqual(["escriba"]);
  });

  it("TEST-21: libera o personagem quando a pista dele entra no caderno", () => {
    const state = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    expect(ids(unlockedCharacters(def, state))).toEqual(["samaritana", "escriba"]);
  });
});

describe("notebook", () => {
  const def = solvableCase();

  it("TEST-05: registra a pista coletada e o que ela destravou", () => {
    const state = collectClue(def, createGameState(def), "pista-cantaro", BARCARENA).state;
    expect(notebook(def, state)).toEqual([
      {
        clueId: "pista-cantaro",
        title: "O cântaro abandonado",
        unlockedClues: ["pista-pegadas"],
        unlockedCharacters: ["samaritana"],
      },
    ]);
  });

  it("TEST-05: começa vazio", () => {
    expect(notebook(def, createGameState(def))).toEqual([]);
  });

  it("TEST-05: ignora id coletado que não existe mais no caso", () => {
    // Um módulo editado entre partidas pode remover uma pista já coletada.
    const state = { ...createGameState(def), collectedClues: ["pista-removida"] };
    expect(notebook(caseWith({}), state)).toEqual([]);
  });
});
