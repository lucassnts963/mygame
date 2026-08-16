/**
 * Os schemas do bundle de módulo (ADR-009).
 *
 * Princípio: obrigar só o essencial. Campos desconhecidos passam (`additionalProperties` fica
 * aberto por padrão), porque um schema rígido demais trava a criatividade do autor — e o objetivo
 * do jogo é justamente que o limite seja a imaginação dele. O que o schema realmente impede é
 * aquilo que quebraria uma partida ou vazaria um segredo.
 */

/** Ids de conteúdo são slugs legíveis escritos à mão, não UUIDs (ver AGENTS.md## Conventions). */
const SLUG = { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$" } as const;

const LATITUDE = { type: "number", minimum: -90, maximum: 90 } as const;
const LONGITUDE = { type: "number", minimum: -180, maximum: 180 } as const;

const LATLNG = {
  type: "object",
  properties: { lat: LATITUDE, lng: LONGITUDE },
  required: ["lat", "lng"],
} as const;

const ANCHOR = {
  type: "object",
  properties: {
    lat: LATITUDE,
    lng: LONGITUDE,
    // Os limites de raio vivem em `.specs/config.md## Game Constants`; o motor os reforça em
    // `validateClueGraph`. Aqui fica só o intervalo fisicamente aceitável.
    radius: { type: "number", exclusiveMinimum: 0 },
  },
  required: ["lat", "lng", "radius"],
} as const;

export const caseSchema = {
  $id: "https://vestigio.game/schemas/case.json",
  type: "object",
  properties: {
    id: SLUG,
    title: { type: "string", minLength: 1 },
    synopsis: { type: "string" },
    origin: LATLNG,
    clues: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          id: SLUG,
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          requires: { type: "array", items: SLUG },
          anchor: ANCHOR,
          unlocks_characters: { type: "array", items: SLUG },
          lore: { type: "string" },
        },
        required: ["id", "title"],
      },
    },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: SLUG,
          name: { type: "string", minLength: 1 },
          requires: { type: "array", items: SLUG },
          agent: { type: "string", minLength: 1 },
        },
        required: ["id", "name"],
      },
    },
    solution: {
      type: "object",
      properties: {
        culprit: SLUG,
        supporting_clues: { type: "array", items: SLUG },
        reveal: { type: "string" },
      },
      required: ["culprit", "supporting_clues"],
    },
  },
  required: ["id", "title", "clues", "characters", "solution"],
} as const;

export const agentSchema = {
  $id: "https://vestigio.game/schemas/agent.json",
  type: "object",
  properties: {
    id: SLUG,
    name: { type: "string", minLength: 1 },
    persona: { type: "string", minLength: 1 },
    voice: { type: "string" },
    provider: {
      type: "object",
      properties: {
        // Qualquer endpoint compatível com a API da OpenAI serve (ADR-007).
        base_url: { type: "string", pattern: "^https?://" },
        model: { type: "string", minLength: 1 },
        // Só o **nome** da variável de ambiente. A chave em si nunca entra num módulo (ADR-008),
        // e por isso `api_key` é explicitamente proibido pelo schema, não apenas desencorajado.
        api_key_env: { type: "string", pattern: "^[A-Za-z_][A-Za-z0-9_]*$" },
        temperature: { type: "number", minimum: 0, maximum: 2 },
        max_tokens: { type: "integer", exclusiveMinimum: 0 },
      },
      required: ["base_url", "model"],
      not: { required: ["api_key"] },
    },
    skills: { type: "array", items: SLUG },
    tools: { type: "array", items: { type: "string" } },
    lore: { type: "array", items: { type: "string" } },
    reveals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clue: SLUG,
          requires_clues: { type: "array", items: SLUG },
        },
        required: ["clue"],
      },
    },
  },
  required: ["id", "name", "persona"],
} as const;
