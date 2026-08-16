import 'package:flutter/material.dart';

import 'core/game_api_client.dart';
import 'core/location_service.dart';
import 'core/models.dart';
import 'features/map/map_screen.dart';

/// Endereço da API do jogo. Sobrescreva com:
/// `flutter run --dart-define=VESTIGIO_API=http://192.168.0.10:3000`
const apiBaseUrl = String.fromEnvironment(
  'VESTIGIO_API',
  defaultValue: 'http://10.0.2.2:3000', // localhost visto de dentro do emulador Android
);

void main() {
  runApp(const VestigioApp());
}

class VestigioApp extends StatelessWidget {
  const VestigioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vestígio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF8C6A3F), // barro, como o cântaro
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: CaseListScreen(
        api: GameApiClient(baseUrl: apiBaseUrl),
        location: const GeolocatorLocationService(),
      ),
    );
  }
}

/// Escolha do caso. É a primeira tela porque o jogo é uma coleção de casos, não um só.
class CaseListScreen extends StatefulWidget {
  final GameApiClient api;
  final LocationService location;

  const CaseListScreen({super.key, required this.api, required this.location});

  @override
  State<CaseListScreen> createState() => _CaseListScreenState();
}

class _CaseListScreenState extends State<CaseListScreen> {
  late Future<List<ModuleSummary>> _modules = widget.api.listModules();
  bool _starting = false;

  Future<void> _start(ModuleSummary module) async {
    setState(() => _starting = true);
    try {
      final view = await widget.api.startSession(module.id);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => MapScreen(api: widget.api, location: widget.location, initial: view),
      ));
    } on GameApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Vestígio')),
      body: FutureBuilder<List<ModuleSummary>>(
        future: _modules,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _Retry(
              message: 'Não foi possível falar com o servidor do jogo.\n$apiBaseUrl',
              onRetry: () => setState(() => _modules = widget.api.listModules()),
            );
          }

          final modules = snapshot.data ?? [];
          if (modules.isEmpty) {
            return const Center(child: Text('Nenhum caso disponível.'));
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: modules
                .map((module) => Card(
                      child: ListTile(
                        key: Key('module-${module.id}'),
                        title: Text(module.title),
                        subtitle: Text(module.synopsis ?? '${module.clueCount} pistas'),
                        trailing: const Icon(Icons.play_arrow),
                        onTap: _starting ? null : () => _start(module),
                      ),
                    ))
                .toList(),
          );
        },
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _Retry({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Tentar de novo')),
          ],
        ),
      ),
    );
  }
}
