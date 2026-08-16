import 'geo.dart';

/// Uma pista como o servidor a descreve.
class Clue {
  final String id;
  final String title;

  /// `null` para pista que não está no mapa — ela só sai da boca de um personagem.
  final LatLng? anchor;
  final double? radiusMeters;

  /// Preenchida pelo servidor quando o app informou a posição do jogador.
  final double? distanceMeters;

  const Clue({
    required this.id,
    required this.title,
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
  final List<String> unlockedClues;
  final List<String> unlockedCharacters;

  const NotebookEntry({
    required this.clueId,
    required this.title,
    required this.unlockedClues,
    required this.unlockedCharacters,
  });

  factory NotebookEntry.fromJson(Map<String, dynamic> json) => NotebookEntry(
        clueId: json['clueId'] as String,
        title: json['title'] as String,
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

/// O estado da partida do ponto de vista do app.
class SessionView {
  final String id;
  final String moduleId;
  final String caseTitle;
  final List<Clue> visibleClues;
  final List<NotebookEntry> notebook;
  final List<Character> characters;
  final Accusation? accusation;

  const SessionView({
    required this.id,
    required this.moduleId,
    required this.caseTitle,
    required this.visibleClues,
    required this.notebook,
    required this.characters,
    this.accusation,
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
