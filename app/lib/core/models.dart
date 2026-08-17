import 'geo.dart';

/// Uma pista como o servidor a descreve.
class Clue {
  final String id;
  final String title;

  /// O texto do vestígio — o que o detetive lê ao encontrá-lo. É o conteúdo do jogo.
  final String? description;

  /// `null` para pista que não está no mapa — ela só sai da boca de um personagem.
  final LatLng? anchor;
  final double? radiusMeters;

  /// Preenchida pelo servidor quando o app informou a posição do jogador.
  final double? distanceMeters;

  const Clue({
    required this.id,
    required this.title,
    this.description,
    this.anchor,
    this.radiusMeters,
    this.distanceMeters,
  });

  bool get isOnMap => anchor != null;

  factory Clue.fromJson(Map<String, dynamic> json) {
    final anchor = json['anchor'] as Map<String, dynamic>?;
    return Clue(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      anchor: anchor == null
          ? null
          : LatLng((anchor['lat'] as num).toDouble(), (anchor['lng'] as num).toDouble()),
      radiusMeters: (anchor?['radiusMeters'] as num?)?.toDouble(),
      distanceMeters: (json['distanceMeters'] as num?)?.toDouble(),
    );
  }
}

/// Uma entrada do caderno: o que foi descoberto e o que aquilo destravou.
class NotebookEntry {
  final String clueId;
  final String title;
  final String? description;
  final List<String> unlockedClues;
  final List<String> unlockedCharacters;

  const NotebookEntry({
    required this.clueId,
    required this.title,
    this.description,
    required this.unlockedClues,
    required this.unlockedCharacters,
  });

  factory NotebookEntry.fromJson(Map<String, dynamic> json) => NotebookEntry(
        clueId: json['clueId'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        unlockedClues: (json['unlockedClues'] as List? ?? []).cast<String>(),
        unlockedCharacters: (json['unlockedCharacters'] as List? ?? []).cast<String>(),
      );
}

class Character {
  final String id;
  final String name;

  const Character({required this.id, required this.name});

  factory Character.fromJson(Map<String, dynamic> json) =>
      Character(id: json['id'] as String, name: json['name'] as String);
}

class Accusation {
  final String culprit;
  final String reason;

  const Accusation({required this.culprit, required this.reason});

  factory Accusation.fromJson(Map<String, dynamic> json) =>
      Accusation(culprit: json['culprit'] as String, reason: json['reason'] as String);
}

/// O veredito terminal de uma partida.
enum OutcomeVerdict { solved, unsupported, wrong }

/// O desfecho do caso: o que o detetive concluiu, reuniu e deixou para trás.
class CaseOutcome {
  final OutcomeVerdict verdict;

  /// Quem o jogador apontou.
  final String accused;

  /// Quem era de fato — informado inclusive a quem errou.
  final String culprit;

  /// O texto do epílogo, quando o caso declara um.
  final String? epilogue;

  final List<NotebookEntry> foundClues;

  /// O que ficou no mapa. Vem com o texto: a partida acabou, não há o que proteger.
  final List<Clue> missedClues;
  final List<Character> missedCharacters;

  const CaseOutcome({
    required this.verdict,
    required this.accused,
    required this.culprit,
    this.epilogue,
    required this.foundClues,
    required this.missedClues,
    required this.missedCharacters,
  });

  /// A manchete do desfecho. Cada veredito é uma sensação diferente, não um rótulo.
  String get headline => switch (verdict) {
        OutcomeVerdict.solved => 'Você reconstruiu o que aconteceu.',
        // O desfecho mais interessante do jogo: acertou a pessoa, não reuniu a prova.
        OutcomeVerdict.unsupported => 'Você tinha razão. Não tinha a prova.',
        OutcomeVerdict.wrong => 'Não foi quem você pensou.',
      };

  factory CaseOutcome.fromJson(Map<String, dynamic> json) => CaseOutcome(
        verdict: switch (json['verdict'] as String?) {
          'solved' => OutcomeVerdict.solved,
          'unsupported' => OutcomeVerdict.unsupported,
          _ => OutcomeVerdict.wrong,
        },
        accused: json['accused'] as String? ?? '',
        culprit: json['culprit'] as String? ?? '',
        epilogue: json['epilogue'] as String?,
        foundClues: (json['foundClues'] as List? ?? [])
            .map((e) => NotebookEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        missedClues: (json['missedClues'] as List? ?? [])
            .map((e) => Clue.fromJson(e as Map<String, dynamic>))
            .toList(),
        missedCharacters: (json['missedCharacters'] as List? ?? [])
            .map((e) => Character.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// O estado da partida do ponto de vista do app.
class SessionView {
  final String id;
  final String moduleId;
  final String caseTitle;
  final List<Clue> visibleClues;
  final List<NotebookEntry> notebook;
  final List<Character> characters;
  final Accusation? accusation;

  /// Presente apenas depois da acusação — antes disso, o servidor não o envia.
  final CaseOutcome? outcome;

  const SessionView({
    required this.id,
    required this.moduleId,
    required this.caseTitle,
    required this.visibleClues,
    required this.notebook,
    required this.characters,
    this.accusation,
    this.outcome,
  });

  bool get isFinished => accusation != null;

  factory SessionView.fromJson(Map<String, dynamic> json) => SessionView(
        id: json['id'] as String,
        moduleId: json['moduleId'] as String,
        caseTitle: json['caseTitle'] as String,
        visibleClues: (json['visibleClues'] as List? ?? [])
            .map((e) => Clue.fromJson(e as Map<String, dynamic>))
            .toList(),
        notebook: (json['notebook'] as List? ?? [])
            .map((e) => NotebookEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        characters: (json['characters'] as List? ?? [])
            .map((e) => Character.fromJson(e as Map<String, dynamic>))
            .toList(),
        accusation: json['accusation'] == null
            ? null
            : Accusation.fromJson(json['accusation'] as Map<String, dynamic>),
        outcome: json['outcome'] == null
            ? null
            : CaseOutcome.fromJson(json['outcome'] as Map<String, dynamic>),
      );
}

/// Um caso disponível para jogar.
class ModuleSummary {
  final String id;
  final String title;
  final String? synopsis;
  final int clueCount;

  const ModuleSummary({
    required this.id,
    required this.title,
    this.synopsis,
    required this.clueCount,
  });

  factory ModuleSummary.fromJson(Map<String, dynamic> json) => ModuleSummary(
        id: json['id'] as String,
        title: json['title'] as String,
        synopsis: json['synopsis'] as String?,
        clueCount: (json['clueCount'] as num?)?.toInt() ?? 0,
      );
}
