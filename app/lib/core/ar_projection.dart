import 'geo.dart';

/// Para que lado o jogador precisa girar para ver o vestígio.
enum TurnHint { left, right, ahead }

/// Campo de visão horizontal típico de uma câmera traseira de celular, em graus.
const defaultFieldOfView = 60.0;

/// Onde desenhar o vestígio sobre a imagem da câmera — ou `null` se ele está fora de vista.
///
/// Esta é a AR do MVP inteira, e ela cabe numa regra de três (ADR-005): sabendo o rumo da âncora
/// e para onde o aparelho aponta, a diferença angular diz a que fração do campo de visão o
/// vestígio corresponde, e daí a posição na tela.
///
/// Devolver `null` fora do campo de visão é deliberado: grudar o vestígio na borda mentiria
/// sobre onde ele está. Quem chama mostra uma seta ([turnHint]) em vez disso — a diferença
/// entre "a pista sumiu" e "vire à direita".
double? projectToScreen({
  required double bearing,
  required double heading,
  required double screenWidth,
  double fieldOfView = defaultFieldOfView,
}) {
  final delta = relativeBearing(bearing, heading);
  final halfFov = fieldOfView / 2;
  if (delta.abs() > halfFov) return null;

  return screenWidth / 2 + (delta / halfFov) * (screenWidth / 2);
}

/// Para que lado girar quando o vestígio está fora do campo de visão.
TurnHint turnHint({
  required double bearing,
  required double heading,
  double fieldOfView = defaultFieldOfView,
}) {
  final delta = relativeBearing(bearing, heading);
  if (delta.abs() <= fieldOfView / 2) return TurnHint.ahead;
  return delta > 0 ? TurnHint.right : TurnHint.left;
}
