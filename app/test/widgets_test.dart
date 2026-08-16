import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vestigio/core/geo.dart';
import 'package:vestigio/core/models.dart';
import 'package:vestigio/features/map/clue_card.dart';
import 'package:vestigio/features/notebook/notebook_view.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

const _anchor = LatLng(-1.5089, -48.6247);

const _clueOnMap = Clue(
  id: 'pista-cantaro',
  title: 'O cântaro abandonado',
  anchor: _anchor,
  radiusMeters: 25,
);

void main() {
  group('NotebookView', () {
    testWidgets('TEST-13: lista as pistas coletadas', (tester) async {
      await tester.pumpWidget(_wrap(const NotebookView(entries: [
        NotebookEntry(
          clueId: 'pista-cantaro',
          title: 'O cântaro abandonado',
          unlockedClues: ['pista-hora-errada'],
          unlockedCharacters: ['samaritana'],
        ),
      ])));

      expect(find.text('O cântaro abandonado'), findsOneWidget);
      expect(find.textContaining('samaritana'), findsOneWidget);
      expect(find.textContaining('pista-hora-errada'), findsOneWidget);
    });

    testWidgets('TEST-14: caderno vazio orienta o jogador em vez de ficar em branco', (tester) async {
      await tester.pumpWidget(_wrap(const NotebookView(entries: [])));

      expect(find.byKey(const Key('notebook-empty')), findsOneWidget);
      expect(find.textContaining('mapa'), findsOneWidget);
      expect(find.byKey(const Key('notebook-list')), findsNothing);
    });

    testWidgets('TEST-13: uma pista que não destravou nada não mostra linhas vazias', (tester) async {
      await tester.pumpWidget(_wrap(const NotebookView(entries: [
        NotebookEntry(
          clueId: 'p',
          title: 'Pista solta',
          unlockedClues: [],
          unlockedCharacters: [],
        ),
      ])));

      expect(find.textContaining('Abriu conversa'), findsNothing);
      expect(find.textContaining('Levou a'), findsNothing);
    });
  });

  group('ClueCard', () {
    testWidgets('TEST-15: fora do raio, investigar fica desabilitado', (tester) async {
      await tester.pumpWidget(_wrap(ClueCard(
        clue: _clueOnMap,
        position: const LatLng(-1.4989, -48.6247), // ~1,1 km
        onInvestigate: () {},
      )));

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('investigate-pista-cantaro')),
      );
      expect(button.onPressed, isNull);
      expect(find.textContaining('A 1,1 km'), findsOneWidget);
    });

    testWidgets('TEST-15: dentro do raio, investigar habilita', (tester) async {
      var tapped = false;
      await tester.pumpWidget(_wrap(ClueCard(
        clue: _clueOnMap,
        position: const LatLng(-1.50895, -48.6247), // poucos metros
        onInvestigate: () => tapped = true,
      )));

      await tester.tap(find.byKey(const Key('investigate-pista-cantaro')));
      expect(tapped, isTrue);
      expect(find.text('Você chegou'), findsOneWidget);
    });

    testWidgets('TEST-15: sem posição, não deixa investigar nem inventa distância', (tester) async {
      await tester.pumpWidget(_wrap(ClueCard(
        clue: _clueOnMap,
        position: null,
        onInvestigate: () {},
      )));

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('investigate-pista-cantaro')),
      );
      expect(button.onPressed, isNull);
      expect(find.text('Em algum lugar do mapa'), findsOneWidget);
    });

    testWidgets('TEST-15: pista sem âncora não oferece investigar', (tester) async {
      await tester.pumpWidget(_wrap(ClueCard(
        clue: const Clue(id: 'pista-confissao', title: 'O que ela mesma disse'),
        position: const LatLng(-1.5089, -48.6247),
        onInvestigate: () {},
      )));

      expect(find.byType(FilledButton), findsNothing);
      expect(find.textContaining('pergunte por aí'), findsOneWidget);
    });

    testWidgets('TEST-15: usa a distância do servidor quando não há GPS local', (tester) async {
      await tester.pumpWidget(_wrap(ClueCard(
        clue: const Clue(
          id: 'p',
          title: 'Pista',
          anchor: _anchor,
          radiusMeters: 25,
          distanceMeters: 218,
        ),
        position: null,
        onInvestigate: () {},
      )));

      expect(find.textContaining('218 m'), findsOneWidget);
    });
  });
}
