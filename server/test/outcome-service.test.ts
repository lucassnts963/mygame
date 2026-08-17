import type { CaseDefinition } from "@vestigio/engine";
import type { LoadedModule, LorePage } from "@vestigio/module-schema";
import { describe, expect, it } from "vitest";
import type { GameModule, ModuleRegistry } from "../src/repositories/module-registry.ts";
import { createInMemorySessionRepository } from "../src/repositories/session-repository.ts";
import { createGameService } from "../src/services/game-service.ts";
import { caseDefinition, lorePage } from "./fixtures.ts";

/**
 * O desfecho de casos que o módulo piloto não representa: sem página de revelação, com um
 * `reveal` apontando para o vazio, e com uma página que só tem nota de autoria.
 *
 * Nenhum deles pode derrubar o fim do caso — o jogador acusou, e o veredito é dele por direito.
 * Perder o epílogo é degradação aceitável; perder o desfecho inteiro não é.
 */

/** Um módulo de mentira, montado à mão, para testar o serviço sem depender de disco. */
function moduleWith(
  solution: CaseDefinition["solution"],
  lore: readonly LorePage[] = [],
): GameModule {
  const base = caseDefinition();
  return {
    id: "caso-teste",
    title: "Caso de teste",
    caseDefinition: { ...base, solution },
    agents: new Map(),
    agentProviders: new Map(),
    loaded: {
      root: "/inexistente",
      caseDocument: {},
      caseFile: "case.yaml",
      agents: [],
      skills: [],
      lore,
      files: [],
    } satisfies LoadedModule,
  };
}

function serviceFor(module: GameModule) {
  const registry: ModuleRegistry = {
    list: () => [module],
    get: (id) => (id === module.id ? module : undefined),
  };

  return createGameService({
    modules: registry,
    sessions: createInMemorySessionRepository(),
    env: {},
    fetchImpl: async () => {
      throw new Error("nenhum teste deste arquivo fala com um provider");
    },
  });
}

/** Abre a partida, coleta tudo e acusa — o caminho mais curto até um desfecho `solved`. */
async function playToTheEnd(module: GameModule) {
  const service = serviceFor(module);
  const started = await service.start(module.id);

  for (const clue of module.caseDefinition.clues) {
    await service.collect(started.id, clue.id, clue.anchor?.position ?? { lat: 0, lng: 0 });
  }

  const { view } = await service.accuse(started.id, module.caseDefinition.solution.culprit);
  return view;
}

describe("desfecho sem epílogo", () => {
  const solution = { culprit: "samaritana", supportingClues: ["pista-cantaro"] };

  it("TEST-15: caso sem `reveal` termina com veredito e sem epílogo, sem quebrar", async () => {
    const view = await playToTheEnd(moduleWith(solution));

    expect(view.outcome?.verdict).toBe("solved");
    expect(view.outcome?.epilogue).toBeUndefined();
    expect(view.outcome).not.toHaveProperty("reveal");
  });

  it("TEST-15: `reveal` apontando para página inexistente não derruba o desfecho", async () => {
    // O lint do módulo reprova isso na validação. Se ainda assim chegar aqui — módulo carregado
    // de outro jeito, página renomeada — o jogador perde o epílogo, não o fim do caso.
    const view = await playToTheEnd(moduleWith({ ...solution, reveal: "casos/pagina-que-sumiu" }));

    expect(view.outcome?.verdict).toBe("solved");
    expect(view.outcome?.epilogue).toBeUndefined();
  });

  it("TEST-15: página de revelação só com nota de autoria não vira epílogo vazio", async () => {
    // Sem isto o app abriria um cartão em branco, que parece defeito. Melhor não ter cartão.
    const soComentario = lorePage("casos/a-verdade", "A verdade", "<!-- nota para o autor -->", true);
    const view = await playToTheEnd(
      moduleWith({ ...solution, reveal: "casos/a-verdade" }, [soComentario]),
    );

    expect(view.outcome?.verdict).toBe("solved");
    expect(view.outcome?.epilogue).toBeUndefined();
  });

  it("TEST-15: com a página escrita, o epílogo é o corpo dela, sem frontmatter", async () => {
    const pagina = lorePage("casos/a-verdade", "A verdade", "Ela largou o cântaro porque quis.", true);
    const view = await playToTheEnd(moduleWith({ ...solution, reveal: "casos/a-verdade" }, [pagina]));

    expect(view.outcome?.epilogue).toBe("Ela largou o cântaro porque quis.");
    // O `reveal` é caminho de arquivo: é detalhe de autoria e não tem por que vazar para o app.
    expect(view.outcome).not.toHaveProperty("reveal");
  });
});
