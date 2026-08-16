import 'package:flutter/material.dart';

import '../../core/game_api_client.dart';
import '../../core/models.dart';

class _Line {
  final bool fromPlayer;
  final String text;

  const _Line({required this.fromPlayer, required this.text});
}

/// O interrogatório: conversa livre com um personagem.
class ChatScreen extends StatefulWidget {
  final GameApiClient api;
  final String sessionId;
  final Character character;
  final void Function(SessionView) onStateChanged;

  const ChatScreen({
    super.key,
    required this.api,
    required this.sessionId,
    required this.character,
    required this.onStateChanged,
  });

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _controller = TextEditingController();
  final _lines = <_Line>[];
  bool _waiting = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _waiting) return;

    setState(() {
      _lines.add(_Line(fromPlayer: true, text: text));
      _controller.clear();
      _waiting = true;
      _error = null;
    });

    try {
      final result = await widget.api.chat(widget.sessionId, widget.character.id, text);
      if (!mounted) return;

      setState(() {
        _lines.add(_Line(fromPlayer: false, text: result.reply));
        _waiting = false;
      });
      widget.onStateChanged(result.view);

      // Uma pista arrancada em conversa merece destaque: é o momento em que o
      // interrogatório virou progresso.
      if (result.revealedClues.isNotEmpty && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Você anotou algo novo no caderno.')),
        );
      }
    } on GameApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _waiting = false;
        _error = e.status == 503
            ? 'Este personagem está sem voz: nenhum provedor de IA configurado no servidor.'
            : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.character.name)),
      body: Column(
        children: [
          if (_error != null)
            MaterialBanner(
              content: Text(_error!),
              actions: [
                TextButton(
                  onPressed: () => setState(() => _error = null),
                  child: const Text('Entendi'),
                )
              ],
            ),
          Expanded(
            child: _lines.isEmpty
                ? const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text(
                        'Faça uma pergunta.\nEle responde ao que você perguntar — mas só sabe o que sabe.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : ListView.builder(
                    key: const Key('chat-lines'),
                    padding: const EdgeInsets.all(16),
                    itemCount: _lines.length,
                    itemBuilder: (context, index) {
                      final line = _lines[index];
                      return Align(
                        alignment:
                            line.fromPlayer ? Alignment.centerRight : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: line.fromPlayer
                                ? Theme.of(context).colorScheme.primaryContainer
                                : Theme.of(context).colorScheme.surfaceContainerHighest,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(line.text),
                        ),
                      );
                    },
                  ),
          ),
          if (_waiting) const LinearProgressIndicator(),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('chat-input'),
                    controller: _controller,
                    enabled: !_waiting,
                    decoration: const InputDecoration(
                      hintText: 'Pergunte alguma coisa…',
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  key: const Key('chat-send'),
                  onPressed: _waiting ? null : _send,
                  icon: const Icon(Icons.send),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
