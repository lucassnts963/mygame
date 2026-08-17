/**
 * Tipos do domínio do Vestígio.
 *
 * Tudo aqui é dado imutável: o motor recebe estado e devolve estado novo, nunca muta
 * (ADR-004). `readonly` em toda parte é o que torna essa promessa verificável pelo compilador.
 */

/** Coordenada geográfica em graus decimais. */
export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

/** Onde uma pista existe no mundo, e com que folga o jogador pode alcançá-la. */
export interface Anchor {
  readonly position: LatLng;
  /** Raio de tolerância. Limites em `.specs/config.md## Game Constants`. */
  readonly radiusMeters: number;
}

/**
 * Uma pista. Sem `anchor`, ela não é achada andando — só pode ser concedida por um
 * personagem em conversa (`revelar_pista`).
 */
export interface ClueDefinition {
  readonly id: string;
  readonly title: string;
  /**
   * O texto do vestígio — o que o detetive lê ao encontrá-lo.
   *
   * Isto é dado de **domínio**, não de apresentação: é o conteúdo do caso, e é o motor quem
   * monta o caderno. Deixá-lo fora daqui obrigaria a API a reabrir o módulo só para buscar o
   * texto, criando duas fontes para o mesmo dado.
   */
  readonly description?: string;
  /** Pistas que precisam estar no caderno antes desta ficar alcançável. */
  readonly requires: readonly string[];
  readonly anchor?: Anchor;
  /** Personagens que passam a ser interrogáveis quando esta pista é coletada. */
  readonly unlocksCharacters: readonly string[];
}

export interface CharacterRef {
  readonly id: string;
  readonly name: string;
  /** Pistas que destravam este personagem. Vazio = disponível desde o início. */
  readonly requires: readonly string[];
}

/**
 * A verdade do caso. Vive fora do alcance do agente (ADR-006): o motor julga a acusação,
 * o personagem nunca vê esta estrutura.
 */
export interface SolutionDefinition {
  readonly culprit: string;
  /** Sem estas pistas no caderno, acertar o culpado é palpite — e palpite não resolve o caso. */
  readonly supportingClues: readonly string[];
  /**
   * Caminho da página de lore com o epílogo — a leitura completa do caso.
   *
   * A página é `spoiler: true`: nunca entra no contexto de um agente (ADR-006) e não é indexada.
   * O que muda no fim é a direção: depois da acusação, e só depois, ela vai para o **jogador**.
   */
  readonly reveal?: string;
}

export interface CaseDefinition {
  readonly id: string;
  readonly title: string;
  /** Origem em que as âncoras foram escritas. Habilita relocar o caso (REQ-19). */
  readonly origin?: LatLng;
  readonly clues: readonly ClueDefinition[];
  readonly characters: readonly CharacterRef[];
  readonly solution: SolutionDefinition;
}

export interface AccusationRecord {
  readonly culprit: string;
  readonly reason: AccusationReason;
}

export interface GameState {
  readonly caseId: string;
  readonly collectedClues: readonly string[];
  /** `null` enquanto o detetive não acusou. Uma acusação por caso (REQ-10). */
  readonly accusation: AccusationRecord | null;
  /** Origem escolhida para esta partida; `null` = jogar nas coordenadas originais. */
  readonly origin: LatLng | null;
}

/**
 * Resultado de uma tentativa de coleta.
 *
 * É um tipo discriminado, e não um booleano, porque toda recusa precisa virar uma frase útil:
 * "faltam 218 m" e "você ainda não descobriu o cântaro" pedem reações diferentes do jogador.
 */
export type CollectVerdict =
  | { readonly ok: true; readonly reason: "ok" }
  | { readonly ok: true; readonly reason: "already-collected" }
  | {
      readonly ok: false;
      readonly reason: "too-far";
      readonly distanceMeters: number;
      /** Quanto ainda falta andar para entrar no raio. */
      readonly missingMeters: number;
    }
  | { readonly ok: false; readonly reason: "locked"; readonly missing: readonly string[] }
  | { readonly ok: false; readonly reason: "unknown-clue" }
  | { readonly ok: false; readonly reason: "position-required" };

export type AccusationReason = "solved" | "unsupported" | "wrong" | "already-accused" | "unknown-character";

export type AccusationVerdict =
  | { readonly ok: true; readonly reason: "solved"; readonly supportingClues: readonly string[] }
  | { readonly ok: false; readonly reason: "unsupported"; readonly missing: readonly string[] }
  | { readonly ok: false; readonly reason: "wrong" }
  | { readonly ok: false; readonly reason: "already-accused" }
  | { readonly ok: false; readonly reason: "unknown-character" };

export type GraphIssueKind =
  | "cycle"
  | "dangling-requirement"
  | "unreachable"
  | "radius-out-of-range"
  | "duplicate-clue-id"
  | "unknown-character"
  | "unknown-culprit"
  | "unknown-supporting-clue";

export interface GraphIssue {
  readonly kind: GraphIssueKind;
  /** A pista onde o problema está, quando ele é de uma pista. */
  readonly clueId?: string;
  readonly detail: string;
}

export interface NotebookEntry {
  readonly clueId: string;
  readonly title: string;
  readonly description?: string;
  readonly unlockedClues: readonly string[];
  readonly unlockedCharacters: readonly string[];
}

/** O veredito terminal de uma partida — os três que encerram o caso. */
export type OutcomeVerdict = "solved" | "unsupported" | "wrong";

/** O desfecho: o que o detetive concluiu, o que reuniu e o que deixou para trás. */
export interface CaseOutcome {
  readonly verdict: OutcomeVerdict;
  /** Quem o jogador apontou. */
  readonly accused: string;
  /** Quem era de fato — informado inclusive a quem errou. */
  readonly culprit: string;
  readonly foundClues: readonly NotebookEntry[];
  /** O que ficou no mapa. Vem com o texto: a partida acabou, não há o que proteger. */
  readonly missedClues: readonly ClueDefinition[];
  readonly missedCharacters: readonly CharacterRef[];
  /** Caminho da página de epílogo, quando o caso declara uma. */
  readonly reveal?: string;
}

export interface PlaytestReport {
  readonly caseId: string;
  readonly solvable: boolean;
  /** Ordem em que um detetive perfeito coletaria as pistas. */
  readonly collectedOrder: readonly string[];
  /** Pistas que nenhum percurso alcança. */
  readonly unreachable: readonly string[];
  readonly issues: readonly GraphIssue[];
  readonly verdict: AccusationVerdict;
}
