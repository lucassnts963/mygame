import 'package:flutter/material.dart';

import '../../core/game_api_client.dart';
import '../../core/models.dart';
import '../outcome/outcome_screen.dart';

/// A dedução final. Uma por caso — e a tela diz isso antes, não depois.
class AccusationScreen extends StatefulWidget {
  final GameApiClient api;
  final String sessionId;
  final List<Character> characters;

  const AccusationScreen({
    super.key,
    required this.api,
    required this.sessionId,
    required this.characters,
  });

  @override
  State<AccusationScreen> createState() => _AccusationScreenState();
}

class _AccusationScreenState extends State<AccusationScreen> {
  String? _selected;
  bool _sending = false;
  String? _outcome;
  bool _solved = false;

  Future<void> _accuse() async {
    final culprit = _selected;
    if (culprit == null || _sending) return;

    // Uma acusação é irreversível. Confirmar não é burocracia: é o peso da decisão.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Acusar?'),
        content: const Text(
          'Você só pode acusar uma vez neste caso. Tem certeza de que reuniu o que prova?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Ainda não'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Acusar'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _sending = true);
    try {
      final result = await widget.api.accuse(widget.sessionId, culprit);
      if (!mounted) return;

      // O desfecho é a tela, não uma frase nesta. Acertando ou errando, a partida acabou e o
      // jogador vai ler o que aconteceu — inclusive quem errou (decisão desta rodada).
      final outcome = result.view?.outcome;
      if (outcome != null) {
        await Navigator.of(context).pushReplacement(MaterialPageRoute(
          builder: (_) => OutcomeScreen(
            caseTitle: result.view!.caseTitle,
            outcome: outcome,
          ),
        ));
        return;
      }

      // Sem desfecho no corpo, a acusação não terminou o caso — é recusa por regra (já acusou,
      // personagem desconhecido). Aí sim a mensagem fica aqui.
      setState(() {
        _sending = false;
        _solved = !result.refused;
        _outcome = result.refused
            ? result.playerMessage
            : 'Caso encerrado. Você reuniu o que provava.';
      });
    } on GameApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _outcome = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Acusação')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Quem foi? Você tem uma única acusação — e acertar sem provar não resolve o caso.',
            ),
            const SizedBox(height: 16),
            Expanded(
              child: RadioGroup<String>(
                groupValue: _selected,
                // Depois do veredito a escolha congela: a acusação é uma só, e trocar o nome
                // na tela depois de acusar seria mentir sobre o que aconteceu.
                onChanged: (value) {
                  if (_outcome != null) return;
                  setState(() => _selected = value);
                },
                child: ListView(
                  children: widget.characters
                      .map((character) => RadioListTile<String>(
                            key: Key('accuse-${character.id}'),
                            value: character.id,
                            title: Text(character.name),
                          ))
                      .toList(),
                ),
              ),
            ),
            if (_outcome != null)
              Card(
                key: const Key('accusation-outcome'),
                color: _solved
                    ? Theme.of(context).colorScheme.primaryContainer
                    : Theme.of(context).colorScheme.errorContainer,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(_outcome!),
                ),
              ),
            const SizedBox(height: 12),
            FilledButton(
              key: const Key('accuse-button'),
              onPressed: _selected == null || _sending || _outcome != null ? null : _accuse,
              child: const Text('Acusar'),
            ),
          ],
        ),
      ),
    );
  }
}
