import 'package:flutter/material.dart';

import '../../core/models.dart';
import '../notebook/clue_reveal_card.dart';

/// A tela de fim de caso.
///
/// É o momento em que o mistério paga o que prometeu. O jogador andou pela cidade, interrogou e
/// deduziu — aqui ele fica sabendo o que aconteceu, **acertando ou errando**. A acusação é uma só
/// e o caso acabou de qualquer forma; guardar a resposta de quem errou seria deixá-lo fechar o app
/// sem desfecho nenhum.
class OutcomeScreen extends StatelessWidget {
  final String caseTitle;
  final CaseOutcome outcome;

  const OutcomeScreen({super.key, required this.caseTitle, required this.outcome});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final epilogue = outcome.epilogue?.trim();

    return Scaffold(
      appBar: AppBar(title: Text(caseTitle)),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _Headline(outcome: outcome),
          const SizedBox(height: 24),

          // O epílogo é o coração da tela: o texto que o autor escreveu para este instante.
          if (epilogue != null && epilogue.isNotEmpty) ...[
            Card(
              key: const Key('outcome-epilogue'),
              color: colors.surfaceContainerHighest,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  epilogue,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],

          _Section(
            title: 'O que você reuniu',
            count: outcome.foundClues.length,
            children: [
              for (final entry in outcome.foundClues)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ClueRevealCard(
                    title: entry.title,
                    description: entry.description,
                    icon: Icons.check_circle_outline,
                  ),
                ),
            ],
          ),

          // O beat que faz querer o próximo caso. Vem com o texto porque a partida acabou:
          // não há nada aqui que o jogador ainda pudesse conquistar.
          if (outcome.missedClues.isNotEmpty)
            _Section(
              key: const Key('outcome-missed-clues'),
              title: 'O que ficou para trás',
              count: outcome.missedClues.length,
              children: [
                for (final clue in outcome.missedClues)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: ClueRevealCard(
                      title: clue.title,
                      description: clue.description,
                      icon: Icons.location_off_outlined,
                    ),
                  ),
              ],
            ),

          if (outcome.missedCharacters.isNotEmpty)
            _Section(
              key: const Key('outcome-missed-characters'),
              title: 'Com quem você nunca falou',
              count: outcome.missedCharacters.length,
              children: [
                for (final character in outcome.missedCharacters)
                  ListTile(
                    dense: true,
                    leading: const Icon(Icons.person_off_outlined),
                    title: Text(character.name),
                  ),
              ],
            ),

          const SizedBox(height: 32),
          Text(
            'O caderno e as conversas continuam abertos. Você pode reler tudo quando quiser.',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// A manchete, com a cor e o ícone da sensação de cada veredito.
class _Headline extends StatelessWidget {
  final CaseOutcome outcome;

  const _Headline({required this.outcome});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    final (icon, color) = switch (outcome.verdict) {
      OutcomeVerdict.solved => (Icons.verified_outlined, colors.primary),
      OutcomeVerdict.unsupported => (Icons.balance_outlined, colors.tertiary),
      OutcomeVerdict.wrong => (Icons.error_outline, colors.error),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 48, color: color),
        const SizedBox(height: 12),
        Text(
          outcome.headline,
          key: const Key('outcome-headline'),
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: color),
        ),
        // Quem errou precisa saber quem era; quem acertou merece a confirmação.
        if (outcome.verdict != OutcomeVerdict.solved) ...[
          const SizedBox(height: 8),
          Text(
            'Você apontou ${outcome.accused}. Era ${outcome.culprit}.',
            key: const Key('outcome-who'),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ],
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final int count;
  final List<Widget> children;

  const _Section({
    super.key,
    required this.title,
    required this.count,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Text(
            '$title · $count',
            style: Theme.of(context).textTheme.titleSmall,
          ),
        ),
        ...children,
        const SizedBox(height: 20),
      ],
    );
  }
}
