import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { CaseDefinition } from "@vestigio/engine";
import {
  loadModule,
  toCaseDefinition,
  type AgentDocument,
  type CaseDocument,
  type LoadedModule,
} from "@vestigio/module-schema";
import type { AgentSpec, ProviderConfig } from "../agent/types.ts";

export interface GameModule {
  readonly id: string;
  readonly title: string;
  readonly synopsis?: string;
  readonly caseDefinition: CaseDefinition;
  readonly agents: ReadonlyMap<string, AgentSpec>;
  /** Provider do módulo, quando o autor declara um para todos os personagens (REQ-12). */
  readonly provider?: ProviderConfig;
  /** Providers declarados por personagem. */
  readonly agentProviders: ReadonlyMap<string, ProviderConfig>;
  readonly loaded: LoadedModule;
}

export interface ModuleRegistry {
  list(): readonly GameModule[];
  get(id: string): GameModule | undefined;
}

/**
 * Carrega todos os módulos de um diretório na subida do servidor.
 *
 * Carregar tudo de uma vez, e não sob demanda, é proposital: um módulo quebrado aparece quando o
 * servidor sobe, e não no meio da partida de alguém.
 */
export function loadModuleRegistry(root: string): ModuleRegistry {
  const modules = new Map<string, GameModule>();

  if (existsSync(root)) {
    for (const entry of readdirSync(root)) {
      const dir = join(root, entry);
      if (!statSync(dir).isDirectory() || !existsSync(join(dir, "case.yaml"))) continue;
      const module = toGameModule(loadModule(dir));
      modules.set(module.id, module);
    }
  }

  return {
    list: () => [...modules.values()],
    get: (id) => modules.get(id),
  };
}

function toGameModule(loaded: LoadedModule): GameModule {
  const document = loaded.caseDocument as CaseDocument;
  const agents = new Map<string, AgentSpec>();
  const agentProviders = new Map<string, ProviderConfig>();

  for (const agent of loaded.agents) {
    const spec = agent.document as AgentDocument;
    agents.set(spec.id, {
      id: spec.id,
      name: spec.name,
      persona: spec.persona,
      ...(spec.voice ? { voice: spec.voice } : {}),
      skills: (spec.skills ?? []).flatMap((name) => {
        const skill = loaded.skills.find((s) => s.name === name);
        return skill ? [{ name: skill.name, content: skill.content }] : [];
      }),
      reveals: (spec.reveals ?? []).map((reveal) => ({
        clue: reveal.clue,
        requiresClues: [...(reveal.requires_clues ?? [])],
      })),
    });

    if (spec.provider) {
      agentProviders.set(spec.id, {
        baseUrl: spec.provider.base_url,
        model: spec.provider.model,
        ...(spec.provider.api_key_env ? { apiKeyEnv: spec.provider.api_key_env } : {}),
        ...(spec.provider.temperature === undefined ? {} : { temperature: spec.provider.temperature }),
        ...(spec.provider.max_tokens === undefined ? {} : { maxTokens: spec.provider.max_tokens }),
      });
    }
  }

  return {
    id: document.id,
    title: document.title,
    ...(document.synopsis ? { synopsis: document.synopsis } : {}),
    caseDefinition: toCaseDefinition(document),
    agents,
    agentProviders,
    loaded,
  };
}
