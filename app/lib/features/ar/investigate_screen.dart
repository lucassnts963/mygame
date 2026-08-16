import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_compass/flutter_compass.dart';

import '../../core/ar_projection.dart';
import '../../core/geo.dart';
import '../../core/models.dart';

/// A investigação em AR: o vestígio desenhado sobre a câmera, no rumo real da âncora.
///
/// **A AR nunca é o único caminho** (NFR-07). Aparelho sem bússola, permissão de câmera negada,
/// ou simples preferência do jogador levam ao modo textual, que entrega exatamente a mesma
/// pista. Acessibilidade aqui não é enfeite: sem isso, quem não pode usar a câmera não joga.
class InvestigateScreen extends StatefulWidget {
  final Clue clue;
  final LatLng position;
  final Future<String?> Function() onCollect;

  const InvestigateScreen({
    super.key,
    required this.clue,
    required this.position,
    required this.onCollect,
  });

  @override
  State<InvestigateScreen> createState() => _InvestigateScreenState();
}

class _InvestigateScreenState extends State<InvestigateScreen> {
  StreamSubscription<CompassEvent>? _compass;
  double? _heading;
  bool _textMode = false;
  bool _collecting = false;

  @override
  void initState() {
    super.initState();
    final events = FlutterCompass.events;
    if (events == null) {
      // Sem bússola não há como ancorar nada no mundo — o modo textual não é degradação,
      // é o caminho correto para este aparelho.
      _textMode = true;
    } else {
      _compass = events.listen((event) {
        if (mounted) setState(() => _heading = event.heading);
      });
    }
  }

  @override
  void dispose() {
    _compass?.cancel();
    super.dispose();
  }

  double get _bearing => bearingDegrees(widget.position, widget.clue.anchor!);

  Future<void> _collect() async {
    setState(() => _collecting = true);
    final refusal = await widget.onCollect();
    if (!mounted) return;

    if (refusal == null) {
      Navigator.of(context).pop(true);
      return;
    }
    setState(() => _collecting = false);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(refusal)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.clue.title),
        actions: [
          IconButton(
            key: const Key('toggle-text-mode'),
            tooltip: _textMode ? 'Ver pela câmera' : 'Ler em texto',
            icon: Icon(_textMode ? Icons.camera_alt_outlined : Icons.notes_outlined),
            onPressed: () => setState(() => _textMode = !_textMode),
          ),
        ],
      ),
      body: _textMode || _heading == null ? _buildTextMode() : _buildArMode(),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton.icon(
          key: const Key('collect-button'),
          onPressed: _collecting ? null : _collect,
          icon: const Icon(Icons.add_to_photos_outlined),
          label: const Text('Anotar no caderno'),
        ),
      ),
    );
  }

  /// Modo textual: a mesma informação, sem depender de câmera nem de bússola.
  Widget _buildTextMode() {
    final distance = distanceMeters(widget.position, widget.clue.anchor!);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(widget.clue.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 16),
          Text('Está a ${formatDistance(distance)} de você, '
              'no rumo ${_bearing.round()}° (${_compassPoint(_bearing)}).'),
          const SizedBox(height: 24),
          const Text(
            'Olhe em volta. Quando encontrar, anote no caderno.',
            style: TextStyle(fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildArMode() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final x = projectToScreen(
          bearing: _bearing,
          heading: _heading!,
          screenWidth: constraints.maxWidth,
        );

        return Stack(
          children: [
            // A pré-visualização da câmera entra aqui em aparelho real; no MVP o fundo é
            // neutro para a tela funcionar mesmo sem permissão de câmera.
            Container(color: Colors.black87),
            if (x != null)
              Positioned(
                left: x - 40,
                top: constraints.maxHeight / 2 - 40,
                child: _VestigeMarker(clue: widget.clue),
              )
            else
              Align(
                alignment: turnHint(bearing: _bearing, heading: _heading!) == TurnHint.right
                    ? Alignment.centerRight
                    : Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Icon(
                    turnHint(bearing: _bearing, heading: _heading!) == TurnHint.right
                        ? Icons.arrow_forward_ios
                        : Icons.arrow_back_ios,
                    size: 48,
                    color: Colors.white70,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }

  String _compassPoint(double bearing) {
    const points = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
    return points[((bearing + 22.5) % 360 ~/ 45)];
  }
}

class _VestigeMarker extends StatelessWidget {
  final Clue clue;

  const _VestigeMarker({required this.clue});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Icon(Icons.brightness_7, size: 80, color: Colors.amberAccent),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          color: Colors.black54,
          child: Text(clue.title, style: const TextStyle(color: Colors.white)),
        ),
      ],
    );
  }
}
