import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { lembretesDaAgenda, type Compromisso } from "~/lib/agenda/agenda";
import { notificacoesPermitidas } from "~/lib/notificacoes";

/**
 * Os lembretes da agenda como notificações LOCAIS: a véspera às 19h e duas
 * horas antes (`lembretesDaAgenda`). A agenda inteira é reagendada a cada
 * mudança e a cada abertura da aba Hoje — inclusive quando o pull trouxe uma
 * consulta marcada noutro aparelho. Tocar no lembrete abre a agenda.
 */

const PREFIXO = "dc-agenda-";

/** "sem-permissao" quando o iPhone recusou: a tela diz como ligar nos Ajustes. */
export async function reagendarAgenda(
  lista: readonly Compromisso[],
  pedirPermissao = false,
): Promise<"ok" | "sem-permissao"> {
  if (Platform.OS === "web") return "ok";
  await cancelarLembretesDaAgenda();
  const lembretes = lembretesDaAgenda(lista, new Date());
  if (!lembretes.length) return "ok";
  if (!(await notificacoesPermitidas(pedirPermissao))) return "sem-permissao";
  try {
    for (const l of lembretes) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXO}${l.id}`,
        content: { title: l.titulo, body: l.corpo, data: { rota: "/agenda" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: l.quando },
      });
    }
  } catch {
    /* a agenda continua guardada; a próxima abertura tenta de novo */
  }
  return "ok";
}

/** As notificações estão ligadas? (Para a tela avisar sem pedir.) */
export async function lembretesLigados(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  return notificacoesPermitidas(false);
}

/** Sair da conta: nenhum lembrete fica tocando para quem saiu. */
export async function cancelarLembretesDaAgenda() {
  if (Platform.OS === "web") return;
  try {
    const todas = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      todas
        .filter((n) => n.identifier.startsWith(PREFIXO))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    /* melhor esforço */
  }
}
