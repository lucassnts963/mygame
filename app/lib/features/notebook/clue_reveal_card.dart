import 'package:flutter/material.dart';

/// O cartão que mostra uma pista por inteiro: título e o texto do vestígio.
///
/// Um só widget para os três lugares onde a pista precisa ser lida — investigando, no caderno e
/// quando um personagem a entrega em conversa. Sem isso, o texto apareceria diferente em cada
/// tela, ou pior: apareceria em uma e faltaria nas outras, que foi o estado até agora.
class ClueRevealCard extends StatelessWidget {
  final String title;
  final String? description;
  final IconData icon;

  const ClueRevealCard({
    super.key,
    required this.title,
    this.description,
    this.icon = Icons.travel_explore_outlined,
  });

  @override
  Widget build(BuildContext context) {
    final text = description?.trim();

    return Card(
      key: const Key('clue-reveal-card'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(icon, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title, style: Theme.of(context).textTheme.titleMedium),
                ),
              ],
            ),
            // Sem descrição, nem espaçamento nem caixa vazia: um vão em branco parece defeito.
            if (text != null && text.isNotEmpty) ...[
              const SizedBox(height: 12),
              Text(text, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}
