import 'package:flutter/material.dart';

import '../../core/geo.dart';
import '../../core/models.dart';

/// Cartão de uma pista no mapa, com a distância e o botão de investigar.
///
/// O botão só habilita dentro do raio (REQ-02). O app decide isso pela distância que ele mesmo
/// calcula — e o servidor revalida ao receber a coleta. O app antecipa; a autoridade é de lá.
class ClueCard extends StatelessWidget {
  final Clue clue;
  final LatLng? position;
  final VoidCallback onInvestigate;

  /// `false` depois da acusação: o caso acabou, e o mapa vira leitura.
  final bool enabled;

  const ClueCard({
    super.key,
    required this.clue,
    required this.position,
    required this.onInvestigate,
    this.enabled = true,
  });

  /// Distância até a pista, calculada aqui quando há posição — senão, a que o servidor mandou.
  double? get _distance {
    final anchor = clue.anchor;
    if (anchor == null) return null;
    if (position != null) return distanceMeters(position!, anchor);
    return clue.distanceMeters;
  }

  bool get _inRange {
    final distance = _distance;
    final radius = clue.radiusMeters;
    return distance != null && radius != null && distance <= radius;
  }

  @override
  Widget build(BuildContext context) {
    final distance = _distance;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: ListTile(
        leading: Icon(clue.isOnMap ? Icons.place_outlined : Icons.record_voice_over_outlined),
        title: Text(clue.title),
        subtitle: Text(
          clue.isOnMap
              ? (distance == null
                  ? 'Em algum lugar do mapa'
                  : (_inRange ? 'Você chegou' : 'A ${formatDistance(distance)}'))
              : 'Alguém sabe disso — pergunte por aí',
        ),
        trailing: clue.isOnMap
            ? FilledButton(
                key: Key('investigate-${clue.id}'),
                onPressed: _inRange && enabled ? onInvestigate : null,
                child: const Text('Investigar'),
              )
            : null,
      ),
    );
  }
}
