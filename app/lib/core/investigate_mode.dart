/// Como a investigação pode ser apresentada.
enum InvestigateMode {
  /// Vestígio sobre a imagem da câmera, no rumo real da âncora.
  augmented,

  /// A mesma informação em texto: rumo em graus, ponto cardeal e a descrição.
  textual,
}

/// O que o aparelho oferece e o que o jogador escolheu.
class InvestigateCapabilities {
  final bool hasCompass;
  final bool hasCamera;

  /// `true` quando o jogador pediu explicitamente o modo textual.
  final bool playerPrefersText;

  const InvestigateCapabilities({
    required this.hasCompass,
    required this.hasCamera,
    this.playerPrefersText = false,
  });
}

/// Decide o modo da investigação.
///
/// É uma função pura de propósito: a decisão é a parte que dá para provar, e o widget de câmera
/// — que este ambiente não consegue exercitar — fica fino em volta dela.
///
/// A regra que importa (`NFR-07`): **o modo textual não é degradação, é caminho equivalente.**
/// Sem bússola não há como ancorar nada no mundo; sem câmera não há sobre o que desenhar; e um
/// jogador que prefere ler tem o mesmo direito de jogar. Nos três casos, o texto entrega a mesma
/// pista — nunca uma versão pobre dela.
InvestigateMode resolveInvestigateMode(InvestigateCapabilities capabilities) {
  if (capabilities.playerPrefersText) return InvestigateMode.textual;
  if (!capabilities.hasCompass) return InvestigateMode.textual;
  if (!capabilities.hasCamera) return InvestigateMode.textual;
  return InvestigateMode.augmented;
}

/// Por que a câmera não está sendo usada — para a tela poder dizer, em vez de só mostrar texto.
String? textModeReason(InvestigateCapabilities capabilities) {
  if (capabilities.playerPrefersText) return null; // foi escolha; não precisa justificativa
  if (!capabilities.hasCompass) {
    return 'Este aparelho não tem bússola, então o vestígio não pode ser ancorado na imagem.';
  }
  if (!capabilities.hasCamera) {
    return 'Sem acesso à câmera. A pista está aqui do mesmo jeito.';
  }
  return null;
}
