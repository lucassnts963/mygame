import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:vestigio/core/game_api_client.dart';
import 'package:vestigio/core/geo.dart';
import 'package:vestigio/core/models.dart';

/// Resposta de `GET /sessions/:id` como a API a devolve.
const sessionJson = {
  'id': 'sessao-1',
  'moduleId': 'poco-de-jaco',
  'caseTitle': 'O Cântaro Abandonado',
  'visibleClues': [
    {
      'id': 'pista-cantaro',
      'title': 'O cântaro abandonado',
      'anchor': {'lat': -1.5089, 'lng': -48.6247, 'radiusMeters': 25},
      'distanceMeters': 218,
    },
    {'id': 'pista-confissao', 'title': 'O que ela mesma disse'},
  ],
  'notebook': [
    {
      'clueId': 'pista-cantaro',
      'title': 'O cântaro abandonado',
      'unlockedClues': ['pista-hora-errada'],
      'unlockedCharacters': ['samaritana'],
    }
  ],
  'characters': [
    {'id': 'samaritana', 'name': 'A mulher de Samaria'}
  ],
  'accusation': null,
};

/// Cliente HTTP falso: guarda o que foi pedido e devolve o que foi roteirizado.
class _FakeClient extends http.BaseClient {
  final int status;
  final Object body;
  final List<http.BaseRequest> requests = [];
  final List<String> bodies = [];

  _FakeClient({this.status = 200, this.body = sessionJson});

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    requests.add(request);
    if (request is http.Request) bodies.add(request.body);
    return http.StreamedResponse(
      Stream.value(utf8.encode(jsonEncode(body))),
      status,
      headers: {'content-type': 'application/json'},
    );
  }
}

void main() {
  group('modelos', () {
    test('TEST-09: Clue lê a pista com âncora e distância', () {
      final clue = Clue.fromJson(
        (sessionJson['visibleClues'] as List)[0] as Map<String, dynamic>,
      );

      expect(clue.id, 'pista-cantaro');
      expect(clue.title, 'O cântaro abandonado');
      expect(clue.anchor, const LatLng(-1.5089, -48.6247));
      expect(clue.radiusMeters, 25);
      expect(clue.distanceMeters, 218);
    });

    test('TEST-09: uma pista sem âncora não ganha coordenada inventada', () {
      // Pista revelada em conversa não está em lugar nenhum do mapa.
      final clue = Clue.fromJson(
        (sessionJson['visibleClues'] as List)[1] as Map<String, dynamic>,
      );
      expect(clue.anchor, isNull);
      expect(clue.isOnMap, isFalse);
    });

    test('TEST-10: SessionView lê o estado completo', () {
      final view = SessionView.fromJson(sessionJson);

      expect(view.id, 'sessao-1');
      expect(view.caseTitle, 'O Cântaro Abandonado');
      expect(view.visibleClues, hasLength(2));
      expect(view.notebook.first.title, 'O cântaro abandonado');
      expect(view.characters.first.name, 'A mulher de Samaria');
      expect(view.accusation, isNull);
    });

    test('TEST-10: lê a acusação quando já houve uma', () {
      final view = SessionView.fromJson({
        ...sessionJson,
        'accusation': {'culprit': 'samaritana', 'reason': 'solved'},
      });
      expect(view.accusation?.reason, 'solved');
      expect(view.accusation?.culprit, 'samaritana');
    });

    test('TEST-10: caderno vazio não quebra', () {
      final view = SessionView.fromJson({...sessionJson, 'notebook': []});
      expect(view.notebook, isEmpty);
    });
  });

  group('GameApiClient', () {
    test('TEST-11: monta a URL de coleta com sessão e pista', () async {
      final fake = _FakeClient();
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      await client.collectClue('sessao-1', 'pista-cantaro', const LatLng(-1.5, -48.6));

      expect(
        fake.requests.first.url.toString(),
        'http://api.local/sessions/sessao-1/clues/pista-cantaro/collect',
      );
      expect(fake.bodies.first, contains('-1.5'));
    });

    test('TEST-11: passa a posição na query ao buscar o estado', () async {
      final fake = _FakeClient();
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      await client.getSession('sessao-1', position: const LatLng(-1.5, -48.6));

      expect(fake.requests.first.url.query, contains('lat=-1.5'));
      expect(fake.requests.first.url.query, contains('lng=-48.6'));
    });

    test('TEST-11: sem posição, não manda query', () async {
      final fake = _FakeClient();
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      await client.getSession('sessao-1');
      expect(fake.requests.first.url.query, isEmpty);
    });

    test('TEST-12: um 409 vira recusa de JOGO, não erro de aplicativo', () async {
      // "Faltam 218 m" é jogo. Se isto virasse exceção genérica, o app mostraria "erro" para
      // algo que é simplesmente o jogador não ter chegado ainda.
      final fake = _FakeClient(status: 409, body: {
        'message': 'coleta recusada',
        'verdict': {'reason': 'too-far', 'missingMeters': 218.4},
      });
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      final result = await client.collectClue(
        'sessao-1',
        'pista-cantaro',
        const LatLng(0, 0),
      );

      expect(result.refused, isTrue);
      expect(result.reason, 'too-far');
      expect(result.playerMessage, contains('218'));
    });

    test('TEST-12: recusa por pré-requisito diz o que falta descobrir', () async {
      final fake = _FakeClient(status: 409, body: {
        'message': 'coleta recusada',
        'verdict': {
          'reason': 'locked',
          'missing': ['pista-cantaro'],
        },
      });
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      final result = await client.collectClue('s', 'p', const LatLng(0, 0));
      expect(result.reason, 'locked');
      expect(result.playerMessage.toLowerCase(), contains('descobrir'));
    });

    test('TEST-12: uma coleta aceita devolve o estado atualizado', () async {
      final fake = _FakeClient(body: {...sessionJson, 'verdict': {'reason': 'ok'}});
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      final result = await client.collectClue('s', 'p', const LatLng(0, 0));
      expect(result.refused, isFalse);
      expect(result.view?.caseTitle, 'O Cântaro Abandonado');
    });

    test('TEST-12: um 500 continua sendo erro de verdade', () async {
      final fake = _FakeClient(status: 500, body: {'message': 'erro interno'});
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      expect(
        () => client.getSession('sessao-1'),
        throwsA(isA<GameApiException>()),
      );
    });

    test('TEST-11: envia a mensagem do chat e lê a resposta', () async {
      final fake = _FakeClient(body: {
        ...sessionJson,
        'reply': 'Não sei de que cântaro você fala.',
        'revealedClues': <String>[],
      });
      final client = GameApiClient(baseUrl: 'http://api.local', httpClient: fake);

      final result = await client.chat('sessao-1', 'samaritana', 'É seu?');

      expect(result.reply, 'Não sei de que cântaro você fala.');
      expect(fake.bodies.first, contains('É seu?'));
    });
  });
}
