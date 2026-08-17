import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vestigio/core/geo.dart';
import 'package:vestigio/core/models.dart';
import 'package:vestigio/features/outcome/outcome_screen.dart';

Widget _wrap(Widget child) => MaterialApp(home: child);

const _found = NotebookEntry(
  clueId: 'pista-cantaro',
  title: 'O cântaro abandonado',
  description: 'Um cântaro de barro, cheio, largado na borda do poço.',
  unlockedClues: [],
  unlockedCharacters: [],
);

const _missed = Clue(
  id: 'pista-pegadas',
  title: 'As pegadas na areia',
  description: 'A trilha sai do poço larga e apressada, na direção de Sicar.',
  anchor: LatLng(-1.5089, -48.6247),
  radiusMeters: 25,
);

CaseOutcome _outcome({
  OutcomeVerdict verdict = OutcomeVerdict.solved,
  String? epilogue,
  List<NotebookEntry> foundClues = const [_found],
  List<Clue> missedClues = const [],
  List<Character> missedCharacters = const [],
}) =>
    CaseOutcome(
      verdict: verdict,
      accused: 'samaritana',
      culprit: 'samaritana',
      epilogue: epilogue,
      foundClues: foundClues,
      missedClues: missedClues,
      missedCharacters: missedCharacters,
    );

void main() {
  group('CaseOutcome', () {
    test('TEST-18: fromJson lê veredito, epílogo e listas', () {
      final outcome = CaseOutcome.fromJson({
        'verdict': 'unsupported',
        'accused': 'samaritana',
        'culprit': 'samaritana',
        'epilogue': 'O cântaro continua no poço, e vai continuar.',
        'foundClues': [
          {
            'clueId': 'pista-cantaro',
            'title': 'O cântaro abandonado',
            'description': 'Largado na borda do poço.',
            'unlockedClues': <String>[],
            'unlockedCharacters': ['samaritana'],
          },
        ],
        'missedClues': [
          {
            'id': 'pista-pegadas',
            'title': 'As pegadas na areia',
            'description': 'A trilha sai do poço apressada.',
          },
        ],
        'missedCharacters': [
          {'id': 'discipulo', 'name': 'O discípulo'},
        ],
      });

      expect(outcome.verdict, OutcomeVerdict.unsupported);
      expect(outcome.accused, 'samaritana');
      expect(outcome.culprit, 'samaritana');
      expect(outcome.epilogue, contains('cântaro continua no poço'));
      expect(outcome.foundClues.single.title, 'O cântaro abandonado');
      expect(outcome.missedClues.single.description, contains('apressada'));
      expect(outcome.missedCharacters.single.name, 'O discípulo');
    });

    test('TEST-18: caso sem epílogo e sem listas não quebra a leitura', () {
      final outcome = CaseOutcome.fromJson({
        'verdict': 'wrong',
        'accused': 'discipulo',
        'culprit': 'samaritana',
      });

      expect(outcome.epilogue, isNull);
      expect(outcome.foundClues, isEmpty);
      expect(outcome.missedClues, isEmpty);
      expect(outcome.missedCharacters, isEmpty);
    });

    test('TEST-19: cada veredito tem sua própria manchete', () {
      final headlines = {
        for (final verdict in OutcomeVerdict.values) verdict: _outcome(verdict: verdict).headline,
      };

      // O que importa não é o texto exato, é que sejam três sensações distintas: quem acertou sem
      // provar não pode ler a mesma frase de quem apontou a pessoa errada.
      expect(headlines.values.toSet(), hasLength(OutcomeVerdict.values.length));
      expect(headlines[OutcomeVerdict.unsupported], contains('prova'));
    });
  });

  group('OutcomeScreen', () {
    testWidgets('TEST-20: mostra o epílogo', (tester) async {
      await tester.pumpWidget(_wrap(OutcomeScreen(
        caseTitle: 'O cântaro do poço de Jacó',
        outcome: _outcome(epilogue: 'O cântaro continua no poço, e vai continuar.'),
      )));

      expect(find.byKey(const Key('outcome-epilogue')), findsOneWidget);
      expect(find.textContaining('continua no poço'), findsOneWidget);
      expect(find.byKey(const Key('outcome-headline')), findsOneWidget);
    });

    testWidgets('TEST-21: mostra as pistas que ficaram para trás, com o texto', (tester) async {
      await tester.pumpWidget(_wrap(OutcomeScreen(
        caseTitle: 'O cântaro do poço de Jacó',
        outcome: _outcome(missedClues: const [_missed]),
      )));

      expect(find.byKey(const Key('outcome-missed-clues')), findsOneWidget);
      expect(find.text('As pegadas na areia'), findsOneWidget);
      // O beat só funciona com o conteúdo: "uma pista ficou" sem dizer qual não devolve nada.
      expect(find.textContaining('direção de Sicar'), findsOneWidget);
    });

    testWidgets('TEST-22: sem pistas perdidas, não renderiza seção vazia', (tester) async {
      await tester.pumpWidget(_wrap(OutcomeScreen(
        caseTitle: 'O cântaro do poço de Jacó',
        outcome: _outcome(),
      )));

      expect(find.byKey(const Key('outcome-missed-clues')), findsNothing);
      expect(find.byKey(const Key('outcome-missed-characters')), findsNothing);
      expect(find.text('O cântaro abandonado'), findsOneWidget);
    });

    testWidgets('TEST-23: sem epílogo, mostra o veredito assim mesmo', (tester) async {
      await tester.pumpWidget(_wrap(OutcomeScreen(
        caseTitle: 'Um caso sem página de revelação',
        outcome: CaseOutcome(
          verdict: OutcomeVerdict.wrong,
          accused: 'discipulo',
          culprit: 'samaritana',
          foundClues: const [],
          missedClues: const [_missed],
          missedCharacters: const [],
        ),
      )));

      expect(find.byKey(const Key('outcome-epilogue')), findsNothing);
      expect(find.byKey(const Key('outcome-headline')), findsOneWidget);
      // Quem errou precisa saber quem era — é a promessa desta rodada.
      expect(find.byKey(const Key('outcome-who')), findsOneWidget);
      expect(find.textContaining('samaritana'), findsOneWidget);
    });

    testWidgets('TEST-23: acertando, a tela não dá lição de casa sobre quem era', (tester) async {
      await tester.pumpWidget(_wrap(OutcomeScreen(
        caseTitle: 'O cântaro do poço de Jacó',
        outcome: _outcome(),
      )));

      expect(find.byKey(const Key('outcome-who')), findsNothing);
    });
  });
}
