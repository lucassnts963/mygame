import 'package:flutter_test/flutter_test.dart';
import 'package:vestigio/core/geo.dart';

/// Um grau de latitude numa esfera de raio 6.371 km — a mesma constante do motor em TypeScript.
const degreeMeters = 111194.9;

void main() {
  group('distanceMeters', () {
    test('TEST-01: mede um grau de latitude com erro abaixo de 0,5%', () {
      final d = distanceMeters(const LatLng(0, 0), const LatLng(1, 0));
      expect((d - degreeMeters).abs() / degreeMeters, lessThan(0.005));
    });

    test('TEST-01: usa a mesma fórmula do motor — 0,001° ≈ 111,19 m', () {
      // Se este número divergir do lado TypeScript, o app dirá "faltam 30 m" enquanto o
      // servidor recusa a coleta. É a divergência mais confusa possível para o jogador.
      final d = distanceMeters(const LatLng(0, 0), const LatLng(0.001, 0));
      expect(d, closeTo(111.19, 0.1));
    });

    test('TEST-01: é zero para o mesmo ponto', () {
      const p = LatLng(-1.5089, -48.6247);
      expect(distanceMeters(p, p), 0);
    });

    test('TEST-01: é simétrica', () {
      const a = LatLng(-1.5089, -48.6247);
      const b = LatLng(-1.52, -48.61);
      expect(distanceMeters(a, b), closeTo(distanceMeters(b, a), 1e-9));
    });
  });

  group('bearingDegrees', () {
    test('TEST-02: aponta 0° para o norte', () {
      expect(bearingDegrees(const LatLng(0, 0), const LatLng(1, 0)), closeTo(0, 1e-6));
    });

    test('TEST-02: aponta 90° para o leste', () {
      expect(bearingDegrees(const LatLng(0, 0), const LatLng(0, 1)), closeTo(90, 1e-6));
    });

    test('TEST-02: aponta 180° para o sul', () {
      expect(bearingDegrees(const LatLng(0, 0), const LatLng(-1, 0)), closeTo(180, 1e-6));
    });

    test('TEST-02: aponta 270° para o oeste', () {
      expect(bearingDegrees(const LatLng(0, 0), const LatLng(0, -1)), closeTo(270, 1e-6));
    });

    test('TEST-02: devolve sempre um rumo em [0, 360)', () {
      final b = bearingDegrees(const LatLng(10, 10), const LatLng(9, 9));
      expect(b, greaterThanOrEqualTo(0));
      expect(b, lessThan(360));
    });
  });

  group('isWithinGeofence', () {
    const anchor = LatLng(-1.5089, -48.6247);

    test('TEST-03: aceita dentro do raio', () {
      expect(isWithinGeofence(const LatLng(-1.5088, -48.6247), anchor, 25), isTrue);
    });

    test('TEST-03: a borda conta como dentro', () {
      expect(isWithinGeofence(anchor, anchor, 0), isTrue);
    });

    test('TEST-03: recusa fora do raio', () {
      expect(isWithinGeofence(const LatLng(-1.4989, -48.6247), anchor, 25), isFalse);
    });
  });

  group('formatDistance', () {
    test('TEST-04: mostra metros inteiros abaixo de 1 km', () {
      expect(formatDistance(12.4), '12 m');
      expect(formatDistance(999), '999 m');
    });

    test('TEST-04: passa para quilômetros a partir de 1 km', () {
      expect(formatDistance(1000), '1,0 km');
      expect(formatDistance(2350), '2,4 km');
    });

    test('TEST-04: usa vírgula decimal — o jogo é em pt-BR', () {
      expect(formatDistance(1500), contains(','));
    });

    test('TEST-04: trata distância zero', () {
      expect(formatDistance(0), '0 m');
    });
  });

  group('relativeBearing', () {
    test('TEST-05: zero quando o aparelho aponta para a pista', () {
      expect(relativeBearing(90, 90), closeTo(0, 1e-9));
    });

    test('TEST-05: positivo quando a pista está à direita', () {
      expect(relativeBearing(100, 90), closeTo(10, 1e-9));
    });

    test('TEST-05: negativo quando a pista está à esquerda', () {
      expect(relativeBearing(80, 90), closeTo(-10, 1e-9));
    });

    test('TEST-05: normaliza pelo caminho curto ao cruzar o norte', () {
      // Apontando para 350° com a pista em 10°: são 20° à direita, não 340° à esquerda.
      expect(relativeBearing(10, 350), closeTo(20, 1e-9));
      expect(relativeBearing(350, 10), closeTo(-20, 1e-9));
    });

    test('TEST-05: o resultado fica sempre em (-180, 180]', () {
      for (var heading = 0; heading < 360; heading += 37) {
        for (var bearing = 0; bearing < 360; bearing += 41) {
          final r = relativeBearing(bearing.toDouble(), heading.toDouble());
          expect(r, greaterThan(-180.0001));
          expect(r, lessThanOrEqualTo(180.0001));
        }
      }
    });
  });
}
