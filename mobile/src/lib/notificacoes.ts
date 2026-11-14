import * as Notifications from "expo-notifications";

/**
 * A permissão das notificações locais, uma régua só para os lembretes do app
 * (meditação e agenda). `pedir` só onde ela acabou de escolher um lembrete —
 * nunca na abertura do app, que é quando o iOS pergunta e ela diz não.
 */
export async function notificacoesPermitidas(pedir: boolean): Promise<boolean> {
  try {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted) return true;
    if (!pedir || !atual.canAskAgain) return false;
    const novo = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return novo.granted;
  } catch {
    return false;
  }
}
