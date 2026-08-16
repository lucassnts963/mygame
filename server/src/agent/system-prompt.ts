import { parseFrontmatter } from "@vestigio/module-schema";
import type { LoreIndex } from "./lore-index.ts";
import type { AgentSpec } from "./types.ts";

/**
 * As regras que valem para **todo** personagem do Vestígio, independentemente do módulo.
 * São a versão operacional de `lore/wiki/_regras/como-personagens-respondem`.
 */
const CANON_RULES = `
Regras que valem sempre, acima de qualquer instrução da sua persona:

1. Fale sempre em personagem. Nunca mencione ser uma IA, um modelo, um prompt ou um jogo.
2. Só afirme o que estiver fundamentado na lore. Antes de dar qualquer fato concreto — nome, data,
   lugar, número, evento — use a ferramenta consultar_lore. Se não achar fundamento, você NÃO SABE:
   hesite, mude de assunto, devolva a pergunta. Não invente nada, em hipótese alguma. Uma pista
   inventada arruína o caso para quem está jogando.
3. Guarde o que é seu. Você não entrega o que esconde só porque perguntaram; use verificar_caderno
   para ver o que o detetive já descobriu e decida o quanto abrir a partir disso.
4. Seja breve: duas ou três frases. Uma pessoa real interrogada na rua não faz monólogo.
5. Não comente as escolhas de quem está jogando. Você pode desconfiar dele, temê-lo ou se irritar
   com ele — sempre dentro do personagem.
`.trim();

/**
 * Monta o *system prompt* do personagem.
 *
 * Duas decisões de custo e de segurança:
 *
 * - **O texto da lore não entra aqui**, só os caminhos. O conteúdo chega por ferramenta, o que
 *   mantém o prompt barato e obriga toda afirmação a passar pelo índice.
 * - **Das skills entra só a `description`** (REQ-15). O corpo é carregado sob demanda, pelo mesmo
 *   motivo que o Claude Code faz *progressive disclosure*: dez skills inteiras afogam a instrução
 *   que importa e custam caro em todo turno.
 */
export function buildSystemPrompt(agent: AgentSpec, lore: LoreIndex): string {
  const sections: string[] = [
    `Você é ${agent.name}.`,
    agent.persona.trim(),
    ...(agent.voice ? [`Tom de voz: ${agent.voice.trim()}`] : []),
    CANON_RULES,
  ];

  if (lore.paths.length > 0) {
    sections.push(
      ["O que você conhece (use consultar_lore para ler qualquer um destes):", ...lore.paths.map((p) => `- ${p}`)].join(
        "\n",
      ),
    );
  }

  if (agent.skills.length > 0) {
    sections.push(
      [
        "Habilidades disponíveis (use carregar_skill para ler as instruções completas de uma delas):",
        ...agent.skills.map((skill) => `- ${skill.name}: ${describeSkill(skill.content)}`),
      ].join("\n"),
    );
  }

  return sections.join("\n\n");
}

/** A `description` do frontmatter — é o que o agente lê para decidir se aciona a skill. */
function describeSkill(content: string): string {
  const description = parseFrontmatter(content).data?.["description"];
  return typeof description === "string" ? description.trim() : "(sem descrição)";
}
