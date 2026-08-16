import type { Anchor, LatLng } from "./types.ts";

/** Raio médio da Terra, em metros (esfera de referência WGS84). */
const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Distância de grande círculo entre dois pontos, em metros (Haversine).
 *
 * Haversine assume a Terra esférica, o que custa até ~0,3% de erro contra o elipsoide. Em
 * distâncias de jogo (dezenas a centenas de metros) isso é ordens de grandeza menor que o erro
 * do próprio GPS do aparelho, então a precisão extra de Vincenty não compraria nada.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Rumo inicial de `from` para `to`, em graus no sentido horário a partir do norte ([0, 360)).
 *
 * É o que a tela de AR usa para decidir onde desenhar o vestígio: comparando este rumo com o
 * heading da bússola, sabe-se para que lado da imagem a pista cai.
 */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** A posição está dentro do raio da âncora? A borda conta como dentro. */
export function isWithinGeofence(position: LatLng, anchor: Anchor): boolean {
  return distanceMeters(position, anchor.position) <= anchor.radiusMeters;
}

/** Deslocamento de um ponto em relação a uma origem, em metros nos eixos norte e leste. */
interface LocalOffset {
  readonly north: number;
  readonly east: number;
}

/** Converte um ponto para deslocamento métrico a partir de uma origem. */
function toLocalMeters(origin: LatLng, point: LatLng): LocalOffset {
  const north = distanceMeters(origin, { lat: point.lat, lng: origin.lng }) * Math.sign(point.lat - origin.lat);
  const east = distanceMeters(origin, { lat: origin.lat, lng: point.lng }) * Math.sign(point.lng - origin.lng);
  return { north, east };
}

/** Aplica um deslocamento métrico a uma origem, devolvendo a coordenada resultante. */
function offsetMeters(origin: LatLng, offset: LocalOffset): LatLng {
  const metersPerDegreeLat = (Math.PI / 180) * EARTH_RADIUS_METERS;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos(toRadians(origin.lat));

  return {
    lat: origin.lat + offset.north / metersPerDegreeLat,
    lng: origin.lng + offset.east / metersPerDegreeLng,
  };
}

/**
 * Reposiciona uma âncora escrita em torno de `caseOrigin` para uma partida que roda em
 * `sessionOrigin` (REQ-19) — é o que deixa um caso escrito para Barcarena ser jogado em
 * qualquer cidade.
 *
 * A translação passa pelo espaço métrico em vez de somar graus diretamente: um grau de longitude
 * vale ~111 km no equador e ~102 km em São Paulo, então somar deltas em graus deformaria o caso
 * ao mudar de latitude. Convertendo para metros e reprojetando, as distâncias entre pistas — que
 * são o desenho do caso — sobrevivem à mudança.
 */
export function resolveAnchor(
  anchor: Anchor,
  caseOrigin: LatLng | null | undefined,
  sessionOrigin: LatLng | null | undefined,
): Anchor {
  if (!caseOrigin || !sessionOrigin) return anchor;
  return {
    position: offsetMeters(sessionOrigin, toLocalMeters(caseOrigin, anchor.position)),
    radiusMeters: anchor.radiusMeters,
  };
}
