import 'package:flutter_test/flutter_test.dart';
import 'package:vestigio/core/investigate_mode.dart';

void main() {
  group('resolveInvestigateMode', () {
    test('TEST-10: com bússola e câmera, usa a realidade aumentada', () {
      const capabilities = InvestigateCapabilities(hasCompass: true, hasCamera: true);
      expect(resolveInvestigateMode(capabilities), InvestigateMode.augmented);
    });

    test('TEST-10: sem bússola, cai no modo textual', () {
      // Sem bússola não há como saber para onde o aparelho aponta — ancorar seria mentira.
      const capabilities = InvestigateCapabilities(hasCompass: false, hasCamera: true);
      expect(resolveInvestigateMode(capabilities), InvestigateMode.textual);
    });

    test('TEST-11: sem câmera, cai no modo textual', () {
      const capabilities = InvestigateCapabilities(hasCompass: true, hasCamera: false);
      expect(resolveInvestigateMode(capabilities), InvestigateMode.textual);
    });

    test('TEST-11: sem nenhum dos dois, modo textual', () {
      const capabilities = InvestigateCapabilities(hasCompass: false, hasCamera: false);
      expect(resolveInvestigateMode(capabilities), InvestigateMode.textual);
    });

    test('TEST-12: a escolha do jogador vence o aparelho', () {
      const capabilities = InvestigateCapabilities(
        hasCompass: true,
        hasCamera: true,
        playerPrefersText: true,
      );
      expect(resolveInvestigateMode(capabilities), InvestigateMode.textual);
    });
  });

  group('textModeReason', () {
    test('TEST-10: explica a falta de bússola', () {
      const capabilities = InvestigateCapabilities(hasCompass: false, hasCamera: true);
      expect(textModeReason(capabilities), contains('bússola'));
    });

    test('TEST-11: explica a falta de câmera', () {
      const capabilities = InvestigateCapabilities(hasCompass: true, hasCamera: false);
      expect(textModeReason(capabilities), contains('câmera'));
    });

    test('TEST-12: não justifica quando foi escolha do jogador', () {
      // Explicar uma escolha do próprio jogador soaria como desculpa por algo que ele quis.
      const capabilities = InvestigateCapabilities(
        hasCompass: true,
        hasCamera: true,
        playerPrefersText: true,
      );
      expect(textModeReason(capabilities), isNull);
    });

    test('TEST-10: não justifica nada quando a AR está disponível', () {
      const capabilities = InvestigateCapabilities(hasCompass: true, hasCamera: true);
      expect(textModeReason(capabilities), isNull);
    });
  });
}
