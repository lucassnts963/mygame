import 'dart:convert';

import 'package:http/http.dart' as http;

import 'geo.dart';
import 'models.dart';

/// Falha de verdade: rede fora, servidor com erro, resposta ilegível.
class GameApiException implements Exception {
  final int? status;
  final String message;

  GameApiException(this.message, {this.status});

  @override
  String toString() => 'GameApiException($status): $message';
}

/// Resultado de uma ação que o jogo pode **recusar** por regra.
///
/// A distinção entre isto e [GameApiException] é a coisa mais importante deste arquivo: "faltam
/// 218 m" não é erro, é o jogo funcionando. Se caísse no caminho de exceção, o app mostraria
/// "erro" para o jogador que simplesmente ainda não chegou lá.
class ActionResult {
  final bool refused;
  final String? reason;
  final String playerMessage;
  final SessionView? view;

  const ActionResult({
    required this.refused,
    required this.playerMessage,
    this.reason,
    this.view,
  });
}

class ChatResult {
  final String reply;
  final List<String> revealedClues;
  final SessionView view;

  const ChatResult({
    required this.reply,
    required this.revealedClues,
    required this.view,
  });
}

class GameApiClient {
  final String baseUrl;
  final http.Client _http;

  GameApiClient({required this.baseUrl, http.Client? httpClient})
      : _http = httpClient ?? http.Client();

  Future<List<ModuleSummary>> listModules() async {
    final body = await _send('GET', '/modules');
    return (body as List).map((e) => ModuleSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<SessionView> startSession(String moduleId, {LatLng? origin}) async {
    final body = await _send('POST', '/sessions', body: {
      'moduleId': moduleId,
      if (origin != null) 'origin': {'lat': origin.lat, 'lng': origin.lng},
    });
    return SessionView.fromJson(body as Map<String, dynamic>);
  }

  Future<SessionView> getSession(String sessionId, {LatLng? position}) async {
    final query = position == null ? '' : '?lat=${position.lat}&lng=${position.lng}';
    final body = await _send('GET', '/sessions/$sessionId$query');
    return SessionView.fromJson(body as Map<String, dynamic>);
  }

  Future<ActionResult> collectClue(String sessionId, String clueId, LatLng position) =>
      _gameAction(
        'POST',
        '/sessions/$sessionId/clues/$clueId/collect',
        body: {'lat': position.lat, 'lng': position.lng},
      );

  Future<ActionResult> accuse(String sessionId, String culprit) =>
      _gameAction('POST', '/sessions/$sessionId/accuse', body: {'culprit': culprit});

  Future<ChatResult> chat(String sessionId, String characterId, String message) async {
    final body = await _send(
      'POST',
      '/sessions/$sessionId/characters/$characterId/chat',
      body: {'message': message},
    ) as Map<String, dynamic>;

    return ChatResult(
      reply: body['reply'] as String? ?? '…',
      revealedClues: (body['revealedClues'] as List? ?? []).cast<String>(),
      view: SessionView.fromJson(body),
    );
  }

  /// Ação que o jogo pode recusar: o 409 vira [ActionResult.refused], não exceção.
  Future<ActionResult> _gameAction(String method, String path, {Object? body}) async {
    final response = await _request(method, path, body: body);
    final decoded = _decode(response);

    if (response.statusCode == 409) {
      final verdict = (decoded as Map<String, dynamic>)['verdict'] as Map<String, dynamic>?;
      final reason = verdict?['reason'] as String?;
      return ActionResult(
        refused: true,
        reason: reason,
        playerMessage: _explain(reason, verdict),
        view: decoded['view'] == null
            ? null
            : SessionView.fromJson(decoded['view'] as Map<String, dynamic>),
      );
    }

    _throwIfFailed(response, decoded);
    final map = decoded as Map<String, dynamic>;
    return ActionResult(
      refused: false,
      reason: (map['verdict'] as Map<String, dynamic>?)?['reason'] as String?,
      playerMessage: '',
      view: SessionView.fromJson(map),
    );
  }

  /// Traduz o veredito do motor numa frase que o jogador entende.
  String _explain(String? reason, Map<String, dynamic>? verdict) {
    switch (reason) {
      case 'too-far':
        final missing = (verdict?['missingMeters'] as num?)?.toDouble() ?? 0;
        return 'Ainda faltam ${formatDistance(missing)} até esta pista.';
      case 'locked':
        final missing = (verdict?['missing'] as List? ?? []).join(', ');
        return 'Há algo a descobrir antes desta pista: $missing.';
      case 'unsupported':
        final missing = (verdict?['missing'] as List? ?? []).join(', ');
        return 'Você pode ter razão, mas não reuniu o que prova. Falta: $missing.';
      case 'wrong':
        return 'Não foi essa pessoa.';
      case 'already-accused':
        return 'Você já fez sua acusação neste caso.';
      case 'position-required':
        return 'Não foi possível ler sua posição.';
      default:
        return 'Ação recusada.';
    }
  }

  Future<Object?> _send(String method, String path, {Object? body}) async {
    final response = await _request(method, path, body: body);
    final decoded = _decode(response);
    _throwIfFailed(response, decoded);
    return decoded;
  }

  Future<http.Response> _request(String method, String path, {Object? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.Request(method, uri);
    if (body != null) {
      request.headers['content-type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    try {
      return await http.Response.fromStream(await _http.send(request));
    } catch (cause) {
      throw GameApiException('não foi possível falar com o servidor do jogo: $cause');
    }
  }

  Object? _decode(http.Response response) {
    if (response.body.isEmpty) return null;
    try {
      return jsonDecode(response.body) as Object;
    } catch (_) {
      throw GameApiException('resposta ilegível do servidor', status: response.statusCode);
    }
  }

  void _throwIfFailed(http.Response response, Object? decoded) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    final message = decoded is Map<String, dynamic>
        ? decoded['message'] as String? ?? 'falha na requisição'
        : 'falha na requisição';
    throw GameApiException(message, status: response.statusCode);
  }
}
