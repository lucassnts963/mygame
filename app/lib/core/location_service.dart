import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'geo.dart';

/// Acesso ao GPS, isolado atrás de uma interface para as telas não dependerem do plugin.
abstract class LocationService {
  /// Fluxo de posições. Emite quando o jogador **se move**, não a cada segundo.
  Stream<LatLng> positions();

  /// Pede permissão. `false` quando o jogador nega — e aí o jogo cai no modo textual (NFR-07).
  Future<bool> ensurePermission();
}

class GeolocatorLocationService implements LocationService {
  /// Metros de deslocamento para emitir uma nova posição.
  ///
  /// Filtrar por distância, e não por tempo, é o que evita drenar bateria: parado, o stream fica
  /// quieto; andando, ele acompanha. Cinco metros é fino o bastante para o raio de 25 m.
  static const _distanceFilterMeters = 5;

  const GeolocatorLocationService();

  @override
  Future<bool> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  @override
  Stream<LatLng> positions() => Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          distanceFilter: _distanceFilterMeters,
        ),
      ).map((p) => LatLng(p.latitude, p.longitude));
}
