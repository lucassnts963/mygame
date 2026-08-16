import 'package:flutter/material.dart';

import '../../core/models.dart';

/// O caderno do detetive: o que foi descoberto, e o que cada descoberta abriu.
class NotebookView extends StatelessWidget {
  final List<NotebookEntry> entries;

  const NotebookView({super.key, required this.entries});

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const Center(
        key: Key('notebook-empty'),
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text(
            'Seu caderno está vazio.\nEncontre a primeira pista no mapa.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    return ListView.separated(
      key: const Key('notebook-list'),
      padding: const EdgeInsets.all(16),
      itemCount: entries.length,
      separatorBuilder: (_, _) => const Divider(height: 24),
      itemBuilder: (context, index) {
        final entry = entries[index];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(radius: 14, child: Text('${index + 1}')),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    entry.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            if (entry.unlockedCharacters.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 40, top: 8),
                child: Text(
                  'Abriu conversa com: ${entry.unlockedCharacters.join(', ')}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            if (entry.unlockedClues.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(left: 40, top: 4),
                child: Text(
                  'Levou a: ${entry.unlockedClues.join(', ')}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
          ],
        );
      },
    );
  }
}
