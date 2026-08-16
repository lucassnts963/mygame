import 'dart:math' as math;

/// Coordenada geográfica em graus decimais.
class LatLng {
  final double lat;
  final double lng;

  const LatLng(this.lat, this.lng);

  @override
  bool operator ==(Object other) =>
      other is LatLng && other.lat == lat && other.lng == lng;

  @override
  int get hashCode => Object.hash(lat, lng);

  @override
  String toString() => 'LatLng($lat, $lng)';
}

/// Raio médio da Terra, em metros. **Precisa ser idêntico ao do `packages/engine`**.
const _earthRadiusMeters = 6371000.0;

double _toRadians(double degrees) => degrees * math.pi / 180;
double _toDegrees(double radians) => radians * 180 / math.pi;

/// Distância de grande círculo entre dois pontos, em metros (Haversine).
///
/// É a mesma fórmula e a mesma constante do motor em TypeScript, e isso não é coincidência: o
/// app calcula para **mostrar** ("faltam 200 m") e o servidor calcula para **decidir** se a
/// coleta vale. Se os dois divergissem, o jogador veria "faltam 30 m" e ainda assim seria
/// recusado — o pior tipo de bug, porque parece má-fé do jogo.
double distanceMeters(LatLng a, LatLng b) {
  final dLat = _toRadians(b.lat - a.lat);
  final dLng = _toRadians(b.lng - a.lng);
  final lat1 = _toRadians(a.lat);
  final lat2 = _toRadians(b.lat);

  final h = math.pow(math.sin(dLat / 2), 2) +
      math.cos(lat1) * math.cos(lat2) * math.pow(math.sin(dLng / 2), 2);

  return 2 * _earthRadiusMeters * math.asin(math.min(1, math.sqrt(h)));
}

/// Rumo inicial de [from] para [to], em graus no sentido horário a partir do norte ([0, 360)).
double bearingDegrees(LatLng from, LatLng to) {
  final lat1 = _toRadians(from.lat);
  final lat2 = _toRadians(to.lat);
  final dLng = _toRadians(to.lng - from.lng);

  final y = math.sin(dLng) * math.cos(lat2);
  final x = math.cos(lat1) * math.sin(lat2) -
      math.sin(lat1) * math.cos(lat2) * math.cos(dLng);

  return (_toDegrees(math.atan2(y, x)) + 360) % 360;
}

/// A posição está dentro do raio da âncora? A borda conta como dentro.
bool isWithinGeofence(LatLng position, LatLng anchor, double radiusMeters) =>
    distanceMeters(position, anchor) <= radiusMeters;

/// Distância legível para o jogador, em pt-BR (vírgula decimal).
String formatDistance(double meters) {
  if (meters < 1000) return '${meters.floor()} m';
  final km = meters / 1000;
  return '${km.toStringAsFixed(1).replaceAll('.', ',')} km';
}

/// Quanto o jogador precisa girar para encarar [bearing], estando voltado para [heading].
///
/// O resultado é normalizado para (-180, 180]: positivo à direita, negativo à esquerda. A
/// normalização é o que faz a bússola atravessar o norte sem mandar o jogador dar a volta —
/// de 350° para 10° são 20° à direita, não 340° à esquerda.
double relativeBearing(double bearing, double heading) {
  var delta = (bearing - heading) % 360;
  if (delta > 180) delta -= 360;
  if (delta <= -180) delta += 360;
  return delta;
}
