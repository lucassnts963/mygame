import 'package:flutter_test/flutter_test.dart';
import 'package:vestigio/core/ar_projection.dart';

void main() {
  const screenWidth = 400.0;
  const fov = 60.0; // campo de visão típico da câmera traseira

  group('projectToScreen', () {
    test('TEST-06: o que está bem à frente cai no centro da tela', () {
      final x = projectToScreen(
        bearing: 90,
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, closeTo(screenWidth / 2, 0.001));
    });

    test('TEST-07: o que está à direita cai à direita do centro', () {
      final x = projectToScreen(
        bearing: 105,
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, isNotNull);
      expect(x!, greaterThan(screenWidth / 2));
    });

    test('TEST-07: o que está à esquerda cai à esquerda do centro', () {
      final x = projectToScreen(
        bearing: 75,
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x!, lessThan(screenWidth / 2));
    });

    test('TEST-07: na borda do campo de visão, cai na borda da tela', () {
      final x = projectToScreen(
        bearing: 120, // exatamente meio campo de visão à direita
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, closeTo(screenWidth, 0.001));
    });

    test('TEST-08: fora do campo de visão devolve nulo', () {
      // Não desenhar é diferente de desenhar grudado na borda: o app mostra uma seta dizendo
      // para que lado girar, e "a pista sumiu" vira "vire à direita".
      final x = projectToScreen(
        bearing: 200,
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, isNull);
    });

    test('TEST-08: atrás do jogador devolve nulo', () {
      final x = projectToScreen(
        bearing: 270,
        heading: 90,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, isNull);
    });

    test('TEST-06: funciona atravessando o norte', () {
      final x = projectToScreen(
        bearing: 10,
        heading: 350,
        screenWidth: screenWidth,
        fieldOfView: fov,
      );
      expect(x, isNotNull);
      expect(x!, greaterThan(screenWidth / 2));
    });
  });

  group('turnHint', () {
    test('TEST-08: manda girar à direita quando a pista está à direita', () {
      expect(turnHint(bearing: 200, heading: 90), TurnHint.right);
    });

    test('TEST-08: manda girar à esquerda quando a pista está à esquerda', () {
      expect(turnHint(bearing: 20, heading: 180), TurnHint.left);
    });

    test('TEST-08: não manda girar quando já está à frente', () {
      expect(turnHint(bearing: 92, heading: 90), TurnHint.ahead);
    });
  });
}
