import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  distanceMeters,
  isWithinGeofence,
  resolveAnchor,
} from "../src/geo.ts";
import { BARCARENA } from "./fixtures.ts";

/** Um grau de latitude numa esfera de raio 6.371 km. */
const DEGREE_METERS = 111_194.9;

describe("distanceMeters", () => {
  it("TEST-01: mede um grau de latitude com erro abaixo de 0,5%", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeCloseTo(DEGREE_METERS, -2);
    expect(Math.abs(d - DEGREE_METERS) / DEGREE_METERS).toBeLessThan(0.005);
  });

  it("TEST-01: mede um grau de longitude no equador", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(Math.abs(d - DEGREE_METERS) / DEGREE_METERS).toBeLessThan(0.005);
  });

  it("TEST-01: mede distâncias curtas — 0,001° ≈ 111 m", () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 0.001, lng: 0 });
    expect(d).toBeCloseTo(111.19, 1);
  });

  it("TEST-01: atravessa o antimeridiano pelo caminho curto", () => {
    // 179,9°E → 179,9°W são 0,2° de distância, não 359,8°.
    const d = distanceMeters({ lat: 0, lng: 179.9 }, { lat: 0, lng: -179.9 });
    expect(d).toBeCloseTo(0.2 * DEGREE_METERS, -2);
  });

  it("TEST-02: é zero para o mesmo ponto", () => {
    expect(distanceMeters(BARCARENA, BARCARENA)).toBe(0);
  });

  it("TEST-03: é simétrica", () => {
    const a = BARCARENA;
    const b = { lat: -1.52, lng: -48.61 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 9);
  });
});

describe("bearingDegrees", () => {
  it("TEST-04: aponta 0° para o norte", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(0, 6);
  });

  it("TEST-04: aponta 90° para o leste", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(90, 6);
  });

  it("TEST-04: aponta 180° para o sul", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: -1, lng: 0 })).toBeCloseTo(180, 6);
  });

  it("TEST-04: aponta 270° para o oeste", () => {
    expect(bearingDegrees({ lat: 0, lng: 0 }, { lat: 0, lng: -1 })).toBeCloseTo(270, 6);
  });

  it("TEST-04: devolve sempre um rumo em [0, 360)", () => {
    const b = bearingDegrees({ lat: 10, lng: 10 }, { lat: 9, lng: 9 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("isWithinGeofence", () => {
  const anchor = { position: BARCARENA, radiusMeters: 25 };

  it("TEST-05: aceita quem está dentro do raio", () => {
    // ~11 m ao norte da âncora.
    expect(isWithinGeofence({ lat: BARCARENA.lat + 0.0001, lng: BARCARENA.lng }, anchor)).toBe(true);
  });

  it("TEST-05: aceita quem está exatamente na borda", () => {
    const onEdge = { position: BARCARENA, radiusMeters: 0 };
    expect(isWithinGeofence(BARCARENA, onEdge)).toBe(true);
  });

  it("TEST-05: recusa quem está fora do raio", () => {
    expect(isWithinGeofence({ lat: BARCARENA.lat + 0.01, lng: BARCARENA.lng }, anchor)).toBe(false);
  });
});

describe("resolveAnchor", () => {
  const SAO_PAULO = { lat: -23.5505, lng: -46.6333 };

  it("TEST-06: devolve a âncora intacta quando a partida não define origem", () => {
    const anchor = { position: BARCARENA, radiusMeters: 25 };
    expect(resolveAnchor(anchor, BARCARENA, null)).toEqual(anchor);
  });

  it("TEST-06: devolve a âncora intacta quando o caso não declara origem", () => {
    const anchor = { position: BARCARENA, radiusMeters: 25 };
    expect(resolveAnchor(anchor, null, SAO_PAULO)).toEqual(anchor);
  });

  it("TEST-06: translada a âncora para a nova origem", () => {
    const anchor = { position: BARCARENA, radiusMeters: 25 };
    const moved = resolveAnchor(anchor, BARCARENA, SAO_PAULO);
    // A âncora que estava na origem do caso passa a estar na origem da partida.
    expect(distanceMeters(moved.position, SAO_PAULO)).toBeLessThan(1);
    expect(moved.radiusMeters).toBe(25);
  });

  it("TEST-06: preserva a distância entre âncoras mesmo mudando de latitude", () => {
    const a = { position: BARCARENA, radiusMeters: 25 };
    const b = { position: { lat: -1.5095, lng: -48.6240 }, radiusMeters: 25 };
    const original = distanceMeters(a.position, b.position);

    const movedA = resolveAnchor(a, BARCARENA, SAO_PAULO);
    const movedB = resolveAnchor(b, BARCARENA, SAO_PAULO);
    const moved = distanceMeters(movedA.position, movedB.position);

    expect(Math.abs(moved - original) / original).toBeLessThan(0.005);
  });
});
