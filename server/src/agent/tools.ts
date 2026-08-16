import { grantClue, notebook, type CaseDefinition, type GameState } from "@vestigio/engine";
import type { LoreIndex } from "./lore-index.ts";
import type { AgentSpec, ToolResult, ToolSpec } from "./types.ts";

export interface ToolsetContext {
  readonly caseDefinition: CaseDefinition;
  readonly agent: AgentSpec;
  readonly lore: LoreIndex;
  readonly state: GameState;
}

export interface Toolset {
  readonly specs: readonly ToolSpec[];
  /** Estado da partida, que avança quando o personagem concede uma pista. */
  readonly state: GameState;
  readonly revealedClues: readonly string[];
  call(name: string, args: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * As ferramentas que um personagem tem em mãos.
 *
 * Este é o ponto onde a liberdade da conversa encontra as regras do jogo: o modelo escreve o que
 * quiser, mas **fatos** só saem de `consultar_lore` e **pistas** só saem de `revelar_pista`, que
 * pergunta ao motor se aquilo é permitido.
 */
export function createToolset(context: ToolsetContext): Toolset {
  let state = context.state;
  const revealed: string[] = [];

  const toolset: Toolset = {
    specs: buildSpecs(context.agent),

    get state() {
      return state;
    },
    get revealedClues() {
      return revealed;
    },

    async call(name, args) {
      switch (name) {
        case "consultar_lore":
          return consultarLore(context.lore, String(args["busca"] ?? ""));

        case "verificar_caderno":
          return verificarCaderno(context.caseDefinition, state);

        case "revelar_pista": {
          const result = revelarPista(context, state, String(args["pista"] ?? ""));
          if (result.state !== state) {
            state = result.state;
            if (!revealed.includes(result.clueId)) revealed.push(result.clueId);
          }
          return result.output;
        }

        case "carregar_skill":
          return carregarSkill(context.agent, String(args["skill"] ?? ""));

        case "recusar_responder":
          return {
            content:
              "Certo. Não afirme nada que a lore não sustente — desconverse em personagem e siga a conversa.",
          };

        default:
          // Derrubar o turno porque o modelo alucinou um nome de ferramenta seria pior para o
          // jogador do que devolver o erro e deixar a conversa continuar.
          return { content: `ferramenta desconhecida: '${name}'`, isError: true };
      }
    },
  };

  return toolset;
}

function consultarLore(lore: LoreIndex, query: string): ToolResult {
  const hits = lore.search(query);
  if (hits.length === 0) {
    return {
      content:
        "Nada encontrado na lore sobre isso. Você NÃO SABE deste assunto: não afirme nada a respeito.",
    };
  }
  return {
    content: hits.map((hit) => `## ${hit.title} (${hit.path})\n${hit.excerpt}`).join("\n\n"),
  };
}

function verificarCaderno(caseDefinition: CaseDefinition, state: GameState): ToolResult {
  const entries = notebook(caseDefinition, state);
  if (entries.length === 0) {
    return { content: "O caderno do detetive está vazio: ele ainda não descobriu nada." };
  }
  return {
    content: ["O detetive já descobriu:", ...entries.map((entry) => `- ${entry.title}`)].join("\n"),
  };
}

interface RevealOutcome {
  readonly state: GameState;
  readonly clueId: string;
  readonly output: ToolResult;
}

function revelarPista(context: ToolsetContext, state: GameState, clueId: string): RevealOutcome {
  // Um personagem só concede o que o módulo autorizou. Sem isto, um modelo persuadido entregaria
  // qualquer pista do caso e o grafo de dedução perderia o sentido.
  const rule = context.agent.reveals.find((r) => r.clue === clueId);
  if (!rule) {
    return {
      state,
      clueId,
      output: { content: `Você não está autorizada a revelar '${clueId}'. Desconverse.` },
    };
  }

  const missing = rule.requiresClues.filter((id) => !state.collectedClues.includes(id));
  if (missing.length > 0) {
    return {
      state,
      clueId,
      output: {
        content: `Ainda não. O detetive precisa descobrir antes: ${missing.join(", ")}. Não entregue isso agora.`,
      },
    };
  }

  // Conceder, não coletar: a pista vem da boca da personagem, então o geofence não se aplica
  // (UC-01 Alt-02). Os pré-requisitos continuam valendo.
  const { state: next, verdict } = grantClue(context.caseDefinition, state, clueId);
  if (!verdict.ok) {
    return { state, clueId, output: { content: `Não pode revelar '${clueId}' agora (${verdict.reason}).` } };
  }

  return {
    state: next,
    clueId,
    output: {
      content:
        verdict.reason === "already-collected"
          ? `O detetive já sabia disso — não repita como novidade.`
          : `Pista revelada: '${clueId}'. Conte isso agora, em personagem, com suas palavras.`,
    },
  };
}

function carregarSkill(agent: AgentSpec, name: string): ToolResult {
  const skill = agent.skills.find((s) => s.name === name);
  if (!skill) return { content: `habilidade desconhecida: '${name}'`, isError: true };
  return { content: skill.content };
}

function buildSpecs(agent: AgentSpec): readonly ToolSpec[] {
  const specs: ToolSpec[] = [
    {
      name: "consultar_lore",
      description:
        "Consulta o que você sabe. Use ANTES de afirmar qualquer fato concreto. Se não vier nada, você não sabe.",
      parameters: {
        type: "object",
        properties: { busca: { type: "string", description: "Palavra ou expressão a procurar" } },
        required: ["busca"],
      },
    },
    {
      name: "verificar_caderno",
      description: "Vê o que o detetive já descobriu, para decidir o quanto revelar.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "recusar_responder",
      description: "Use quando a lore não sustenta a resposta e você precisa desconversar.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string", description: "Por que não pode responder" } },
      },
    },
  ];

  if (agent.reveals.length > 0) {
    specs.push({
      name: "revelar_pista",
      description: "Concede ao detetive uma pista que você guardava, se as condições permitirem.",
      parameters: {
        type: "object",
        properties: { pista: { type: "string", description: "Id da pista" } },
        required: ["pista"],
      },
    });
  }

  if (agent.skills.length > 0) {
    specs.push({
      name: "carregar_skill",
      description: "Lê as instruções completas de uma das suas habilidades.",
      parameters: {
        type: "object",
        properties: { skill: { type: "string", description: "Nome da habilidade" } },
        required: ["skill"],
      },
    });
  }

  return specs;
}
