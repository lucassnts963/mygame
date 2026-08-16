import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;

import '../../core/game_api_client.dart';
import '../../core/geo.dart';
import '../../core/location_service.dart';
import '../../core/models.dart';
import '../accusation/accusation_screen.dart';
import '../ar/investigate_screen.dart';
import '../chat/chat_screen.dart';
import '../notebook/notebook_view.dart';
import 'clue_card.dart';

/// A tela principal: mapa, lista de pistas, caderno e personagens.
class MapScreen extends StatefulWidget {
  final GameApiClient api;
  final LocationService location;
  final SessionView initial;

  const MapScreen({
    super.key,
    required this.api,
    required this.location,
    required this.initial,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  late SessionView _view = widget.initial;
  StreamSubscription<LatLng>? _positions;
  LatLng? _position;
  bool _locationDenied = false;
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _startLocation();
  }

  @override
  void dispose() {
    _positions?.cancel();
    super.dispose();
  }

  Future<void> _startLocation() async {
    final granted = await widget.location.ensurePermission();
    if (!mounted) return;
    if (!granted) {
      setState(() => _locationDenied = true);
      return;
    }
    _positions = widget.location.positions().listen((position) {
      if (mounted) setState(() => _position = position);
    });
  }

  Future<void> _investigate(Clue clue) async {
    final position = _position;
    if (position == null) return;

    final collected = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => InvestigateScreen(
          clue: clue,
          position: position,
          onCollect: () async {
            final result = await widget.api.collectClue(_view.id, clue.id, position);
            if (result.refused) return result.playerMessage;
            if (result.view != null) setState(() => _view = result.view!);
            return null;
          },
        ),
      ),
    );

    if (collected == true && mounted) setState(() => _tab = 1);
  }

  Future<void> _refresh() async {
    try {
      final view = await widget.api.getSession(_view.id, position: _position);
      if (mounted) setState(() => _view = view);
    } on GameApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_view.caseTitle),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh),
            onPressed: _refresh,
          ),
          IconButton(
            key: const Key('open-accusation'),
            tooltip: 'Acusar',
            icon: const Icon(Icons.gavel_outlined),
            onPressed: _view.isFinished
                ? null
                : () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AccusationScreen(
                        api: widget.api,
                        sessionId: _view.id,
                        characters: _view.characters,
                      ),
                    )).then((_) => _refresh()),
          ),
        ],
      ),
      body: [_buildMapTab(), _buildNotebookTab(), _buildPeopleTab()][_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.map_outlined), label: 'Mapa'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: 'Caderno'),
          NavigationDestination(icon: Icon(Icons.people_outline), label: 'Pessoas'),
        ],
      ),
    );
  }

  Widget _buildMapTab() {
    final anchored = _view.visibleClues.where((c) => c.isOnMap).toList();
    final center = _position ?? anchored.firstOrNull?.anchor;

    return Column(
      children: [
        if (_locationDenied)
          const MaterialBanner(
            content: Text(
              'Sem permissão de localização, as pistas do mapa ficam fora de alcance. '
              'Você ainda pode conversar com as pessoas do caso.',
            ),
            actions: [SizedBox.shrink()],
          ),
        Expanded(
          flex: 3,
          child: center == null
              ? const Center(child: Text('Procurando sua posição…'))
              : FlutterMap(
                  options: MapOptions(
                    initialCenter: ll.LatLng(center.lat, center.lng),
                    initialZoom: 16,
                  ),
                  children: [
                    // OpenStreetMap: sem chave de API, o que mantém o jogo jogável por
                    // qualquer pessoa que clone o repositório.
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'dev.elucas.vestigio',
                    ),
                    CircleLayer(
                      circles: [
                        for (final clue in anchored)
                          CircleMarker(
                            point: ll.LatLng(clue.anchor!.lat, clue.anchor!.lng),
                            radius: clue.radiusMeters ?? 25,
                            useRadiusInMeter: true,
                            color: Colors.amber.withValues(alpha: 0.2),
                            borderColor: Colors.amber,
                            borderStrokeWidth: 2,
                          ),
                      ],
                    ),
                    MarkerLayer(
                      markers: [
                        for (final clue in anchored)
                          Marker(
                            point: ll.LatLng(clue.anchor!.lat, clue.anchor!.lng),
                            child: const Icon(Icons.place, color: Colors.amber, size: 36),
                          ),
                        if (_position != null)
                          Marker(
                            point: ll.LatLng(_position!.lat, _position!.lng),
                            child: const Icon(Icons.my_location, color: Colors.blueAccent),
                          ),
                      ],
                    ),
                  ],
                ),
        ),
        Expanded(
          flex: 2,
          child: _view.visibleClues.isEmpty
              ? const Center(child: Text('Nada de novo por aqui. Fale com as pessoas.'))
              : ListView(
                  children: _view.visibleClues
                      .map((clue) => ClueCard(
                            clue: clue,
                            position: _position,
                            onInvestigate: () => _investigate(clue),
                          ))
                      .toList(),
                ),
        ),
      ],
    );
  }

  Widget _buildNotebookTab() => NotebookView(entries: _view.notebook);

  Widget _buildPeopleTab() {
    if (_view.characters.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Ninguém quer falar com você ainda.\nEncontre uma pista primeiro.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView(
      children: _view.characters
          .map((character) => ListTile(
                key: Key('character-${character.id}'),
                leading: const CircleAvatar(child: Icon(Icons.person_outline)),
                title: Text(character.name),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => ChatScreen(
                    api: widget.api,
                    sessionId: _view.id,
                    character: character,
                    onStateChanged: (view) => setState(() => _view = view),
                  ),
                )),
              ))
          .toList(),
    );
  }
}
