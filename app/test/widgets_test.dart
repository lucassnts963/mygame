import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vestigio/core/game_api_client.dart';
import 'package:vestigio/core/geo.dart';
import 'package:vestigio/core/location_service.dart';
import 'package:vestigio/core/models.dart';
import 'package:vestigio/features/map/clue_card.dart';
import 'package:vestigio/features/notebook/clue_reveal_card.dart';
import 'package:vestigio/features/notebook/notebook_view.dart';
import 'package:vestigio/main.dart';

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

    testWidgets('TEST-13: mostra o TEXTO da pista, não só o título', (tester) async {
      // Sem isto o caderno é uma lista de títulos, e a dedução final fica impossível de fazer.
      await tester.pumpWidget(_wrap(const NotebookView(entries: [
        NotebookEntry(
          clueId: 'pista-cantaro',
          title: 'O cântaro abandonado',
          description: 'Um cântaro de barro, cheio, largado na borda do poço.',
          unlockedClues: [],
          unlockedCharacters: [],
        ),
      ])));

      expect(find.textContaining('cântaro de barro'), findsOneWidget);
    });

    testWidgets('TEST-14: pista sem descrição não deixa espaço vazio', (tester) async {
      await tester.pumpWidget(_wrap(const NotebookView(entries: [
        NotebookEntry(
          clueId: 'p',
          title: 'Só o título',
          unlockedClues: [],
          unlockedCharacters: [],
        ),
      ])));

      expect(find.text('Só o título'), findsOneWidget);
      // Nenhum Text extra além do título e do número do avatar.
      expect(find.byType(Text), findsNWidgets(2));
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

  group('ClueRevealCard', () {
    testWidgets('TEST-15: mostra título e descrição', (tester) async {
      await tester.pumpWidget(_wrap(const ClueRevealCard(
        title: 'O que ela mesma disse',
        description: 'Vinde, vede um homem que me disse tudo quanto tenho feito.',
      )));

      expect(find.text('O que ela mesma disse'), findsOneWidget);
      expect(find.textContaining('Vinde, vede'), findsOneWidget);
    });

    testWidgets('TEST-15: sem descrição, mostra só o título', (tester) async {
      await tester.pumpWidget(_wrap(const ClueRevealCard(title: 'Só o título')));

      expect(find.text('Só o título'), findsOneWidget);
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('TEST-15: descrição só de espaços conta como ausente', (tester) async {
      await tester.pumpWidget(_wrap(const ClueRevealCard(title: 'T', description: '   ')));
      expect(find.byType(Text), findsOneWidget);
    });
  });

  group('CaseListScreen', () {
    testWidgets('TEST-16: a lista de casos mostra a sinopse', (tester) async {
      // A sinopse é o convite: é ela que faz alguém querer sair de casa para jogar.
      final fake = _FakeModulesClient([
        {
          'id': 'poco-de-jaco',
          'title': 'O Cântaro Abandonado',
          'synopsis': 'Uma mulher deixou seu cântaro no poço e saiu correndo. Descubra por quê.',
          'clueCount': 4,
        }
      ]);

      await tester.pumpWidget(MaterialApp(
        home: CaseListScreen(
          api: GameApiClient(baseUrl: 'http://api.local', httpClient: fake),
          location: _SilentLocationService(),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('O Cântaro Abandonado'), findsOneWidget);
      expect(find.textContaining('saiu correndo'), findsOneWidget);
      expect(find.textContaining('4 pistas'), findsOneWidget);
    });

    testWidgets('TEST-16: um caso sem sinopse não deixa linha vazia', (tester) async {
      final fake = _FakeModulesClient([
        {'id': 'sem-sinopse', 'title': 'Caso sem sinopse', 'clueCount': 2}
      ]);

      await tester.pumpWidget(MaterialApp(
        home: CaseListScreen(
          api: GameApiClient(baseUrl: 'http://api.local', httpClient: fake),
          location: _SilentLocationService(),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Caso sem sinopse'), findsOneWidget);
      expect(find.textContaining('2 pistas'), findsOneWidget);
    });

    testWidgets('TEST-16: servidor fora do ar oferece tentar de novo', (tester) async {
      final fake = _FakeModulesClient([], status: 500);

      await tester.pumpWidget(MaterialApp(
        home: CaseListScreen(
          api: GameApiClient(baseUrl: 'http://api.local', httpClient: fake),
          location: _SilentLocationService(),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tentar de novo'), findsOneWidget);
    });
  });
}

/// Cliente HTTP falso que devolve uma lista de módulos.
class _FakeModulesClient extends http.BaseClient {
  final List<Map<String, Object?>> modules;
  final int status;

  _FakeModulesClient(this.modules, {this.status = 200});

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async => http.StreamedResponse(
        Stream.value(utf8.encode(jsonEncode(status == 200 ? modules : {'message': 'erro'}))),
        status,
        headers: {'content-type': 'application/json'},
      );
}

/// Localização que nunca emite: a tela de lista não depende de GPS.
class _SilentLocationService implements LocationService {
  @override
  Future<bool> ensurePermission() async => false;

  @override
  Stream<LatLng> positions() => const Stream.empty();
}
