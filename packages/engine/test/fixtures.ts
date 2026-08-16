import type { CaseDefinition, LatLng } from "../src/types.ts";

/** Barcarena/PA — ponto de referência dos casos escritos por padrão. */
export const BARCARENA: LatLng = { lat: -1.5089, lng: -48.6247 };

/**
 * Caso mínimo, solúvel, com as três formas de pista que o motor precisa distinguir:
 * uma inicial sem pré-requisito, uma que depende dela, e uma sem âncora (revelada por NPC).
 */
export function solvableCase(): CaseDefinition {
  return {
    id: "caso-teste",
    title: "Caso de teste",
    origin: BARCARENA,
    clues: [
      {
        id: "pista-cantaro",
        title: "O cântaro abandonado",
        requires: [],
        anchor: { position: BARCARENA, radiusMeters: 25 },
        unlocksCharacters: ["samaritana"],
      },
      {
        id: "pista-pegadas",
        title: "Pegadas na terra seca",
        requires: ["pista-cantaro"],
        anchor: { position: { lat: -1.5095, lng: -48.6240 }, radiusMeters: 25 },
        unlocksCharacters: [],
      },
      {
        id: "pista-confissao",
        title: "O que ela admitiu",
        requires: ["pista-pegadas"],
        unlocksCharacters: [],
      },
    ],
    characters: [
      { id: "samaritana", name: "A mulher do poço", requires: ["pista-cantaro"] },
      { id: "escriba", name: "O escriba", requires: [] },
    ],
    solution: {
      culprit: "samaritana",
      supportingClues: ["pista-cantaro", "pista-confissao"],
    },
  };
}

/** Variante do caso com uma alteração pontual — evita repetir o literal inteiro nos testes. */
export function caseWith(patch: Partial<CaseDefinition>): CaseDefinition {
  return { ...solvableCase(), ...patch };
}

/** Posição deslocada de `origin` por um offset aproximado em graus. */
export function nearby(origin: LatLng, dLat: number, dLng: number): LatLng {
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}
