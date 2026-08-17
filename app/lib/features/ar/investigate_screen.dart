import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_compass/flutter_compass.dart';

import '../../core/ar_projection.dart';
import '../../core/geo.dart';
import '../../core/investigate_mode.dart';
import '../../core/models.dart';
import '../notebook/clue_reveal_card.dart';

/// A investigação: o vestígio desenhado sobre a câmera, no rumo real da âncora.
///
/// **A AR nunca é o único caminho** (`NFR-07`). Sem bússola, sem câmera ou por escolha do
/// jogador, a tela cai no modo textual — que entrega **a mesma pista**, não uma versão pobre
/// dela. Em qualquer um dos modos, o texto do vestígio aparece **antes** de anotar: é lendo que
/// o detetive decide que aquilo importa.
class InvestigateScreen extends StatefulWidget {
  final Clue clue;
  final LatLng position;
  final Future<String?> Function() onCollect;

  /// Injetável para teste; em produção descobre as câmeras do aparelho.
  final Future<List<CameraDescription>> Function()? camerasProvider;

  const InvestigateScreen({
    super.key,
    required this.clue,
    required this.position,
    required this.onCollect,
    this.camerasProvider,
  });

  @override
  State<InvestigateScreen> createState() => _InvestigateScreenState();
}

class _InvestigateScreenState extends State<InvestigateScreen> with WidgetsBindingObserver {
  StreamSubscription<CompassEvent>? _compass;
  CameraController? _camera;
  double? _heading;
  bool _hasCompass = true;
  bool _hasCamera = false;
  bool _playerPrefersText = false;
  bool _collecting = false;

  InvestigateCapabilities get _capabilities => InvestigateCapabilities(
        hasCompass: _hasCompass && _heading != null,
        hasCamera: _hasCamera,
        playerPrefersText: _playerPrefersText,
      );

  InvestigateMode get _mode => resolveInvestigateMode(_capabilities);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startCompass();
    unawaited(_startCamera());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _compass?.cancel();
    // Câmera esquecida aberta é o vazamento que não dá erro: só aparece como bateria sumindo.
    _camera?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final camera = _camera;
    if (camera == null || !camera.value.isInitialized) return;

    if (state == AppLifecycleState.inactive) {
      camera.dispose();
      _camera = null;
    } else if (state == AppLifecycleState.resumed) {
      unawaited(_startCamera());
    }
  }

  void _startCompass() {
    final events = FlutterCompass.events;
    if (events == null) {
      setState(() => _hasCompass = false);
      return;
    }
    _compass = events.listen((event) {
      if (mounted) setState(() => _heading = event.heading);
    });
  }

  Future<void> _startCamera() async {
    try {
      final cameras = await (widget.camerasProvider ?? availableCameras)();
      if (cameras.isEmpty) {
        if (mounted) setState(() => _hasCamera = false);
        return;
      }

      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      // Resolução média de propósito: o fundo é cenário, não conteúdo. Alta resolução aqui
      // só gastaria bateria e memória para desenhar um marcador por cima.
      final controller = CameraController(back, ResolutionPreset.medium, enableAudio: false);
      await controller.initialize();

      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _camera = controller;
        _hasCamera = true;
      });
    } catch (_) {
      // Permissão negada, câmera ocupada, aparelho sem hardware — o caminho é o mesmo:
      // modo textual com a razão na tela, nunca um retângulo preto sem explicação.
      if (mounted) setState(() => _hasCamera = false);
    }
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
    final augmented = _mode == InvestigateMode.augmented;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.clue.title),
        actions: [
          IconButton(
            key: const Key('toggle-text-mode'),
            tooltip: _playerPrefersText ? 'Ver pela câmera' : 'Ler em texto',
            icon: Icon(_playerPrefersText ? Icons.camera_alt_outlined : Icons.notes_outlined),
            onPressed: () => setState(() => _playerPrefersText = !_playerPrefersText),
          ),
        ],
      ),
      body: augmented ? _buildAugmented() : _buildTextual(),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton.icon(
            key: const Key('collect-button'),
            onPressed: _collecting ? null : _collect,
            icon: const Icon(Icons.add_to_photos_outlined),
            label: const Text('Anotar no caderno'),
          ),
        ),
      ),
    );
  }

  /// Modo textual: a mesma informação, sem depender de câmera nem de bússola.
  Widget _buildTextual() {
    final distance = distanceMeters(widget.position, widget.clue.anchor!);
    final reason = textModeReason(_capabilities);

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        if (reason != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Text(reason, style: Theme.of(context).textTheme.bodySmall),
          ),
        Text(
          'Está a ${formatDistance(distance)} de você'
          '${_heading != null ? ', no rumo ${_bearing.round()}° (${_compassPoint(_bearing)})' : ''}.',
        ),
        const SizedBox(height: 20),
        ClueRevealCard(title: widget.clue.title, description: widget.clue.description),
        const SizedBox(height: 16),
        const Text(
          'Olhe em volta. Quando encontrar, anote no caderno.',
          style: TextStyle(fontStyle: FontStyle.italic),
        ),
      ],
    );
  }

  Widget _buildAugmented() {
    final camera = _camera!;

    return Stack(
      fit: StackFit.expand,
      children: [
        // A imagem do mundo, que é o que faz isto ser realidade aumentada e não um desenho.
        FittedBox(
          fit: BoxFit.cover,
          child: SizedBox(
            width: camera.value.previewSize?.height ?? MediaQuery.of(context).size.width,
            height: camera.value.previewSize?.width ?? MediaQuery.of(context).size.height,
            child: CameraPreview(camera),
          ),
        ),
        LayoutBuilder(
          builder: (context, constraints) {
            final x = projectToScreen(
              bearing: _bearing,
              heading: _heading!,
              screenWidth: constraints.maxWidth,
            );

            if (x == null) {
              final hint = turnHint(bearing: _bearing, heading: _heading!);
              return Align(
                alignment: hint == TurnHint.right ? Alignment.centerRight : Alignment.centerLeft,
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Icon(
                    hint == TurnHint.right ? Icons.arrow_forward_ios : Icons.arrow_back_ios,
                    size: 48,
                    color: Colors.white,
                    shadows: const [Shadow(blurRadius: 8)],
                  ),
                ),
              );
            }

            return Stack(
              children: [
                Positioned(
                  left: (x - 40).clamp(0.0, constraints.maxWidth - 80),
                  top: constraints.maxHeight * 0.28,
                  child: const Icon(
                    Icons.brightness_7,
                    size: 72,
                    color: Colors.amberAccent,
                    shadows: [Shadow(blurRadius: 12)],
                  ),
                ),
                // O texto fica ancorado embaixo, e não junto do marcador: seguindo o marcador
                // ele sairia da tela justamente quando o jogador virasse para ler.
                Positioned(
                  left: 12,
                  right: 12,
                  bottom: 12,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: constraints.maxHeight * 0.4),
                    child: SingleChildScrollView(
                      child: ClueRevealCard(
                        title: widget.clue.title,
                        description: widget.clue.description,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  String _compassPoint(double bearing) {
    const points = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
    return points[((bearing + 22.5) % 360 ~/ 45)];
  }
}
