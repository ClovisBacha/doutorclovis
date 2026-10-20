import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { textoDoLembrete } from "@/lib/lembrete-de-meditacao";
import { sequenciaAteODia } from "@/lib/sequencia";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ymdLocal } from "~/lib/gestacao";
import { notificacoesPermitidas } from "~/lib/notificacoes";
import { horaValida, proximosLembretes } from "~/lib/jornada/lembrete";

/**
 * O "Lembrar todo dia" da Meditação, como notificação LOCAL (ver
 * `~/lib/jornada/lembrete`): a hora escolhida mora no aparelho, por conta
 * (`dc-…:<uid>`, apagada ao sair), e as notificações são agendadas dia a dia.
 * O texto é o do push do site (`textoDoLembrete`): a sequência de dias, quando
 * ela existe, só na de hoje — nas dos dias seguintes o app não sabe se ela vai
 * manter a sequência, e um "5 dias seguidos" falso é pior que nenhum.
 */

const chave = (uid: string) => `dc-lembrete-meditacao:${uid}`;
const PREFIXO = "dc-med-lembrete-";

export async function lerLembreteDaMeditacao(uid: string): Promise<string | null> {
  const s = await lerJson<{ hora?: unknown }>(chave(uid), {});
  return horaValida(s.hora) ? s.hora : null;
}

/**
 * Liga (com a hora) ou desliga (`null`). `"sem-permissao"` quando o iPhone
 * recusou as notificações — a tela diz como ligar nos Ajustes, e a escolha não
 * é guardada (um interruptor que não avisa nada é pior que nenhum).
 */
export async function definirLembreteDaMeditacao(
  uid: string,
  hora: string | null,
  dias: readonly string[],
): Promise<"ok" | "sem-permissao"> {
  if (Platform.OS === "web") return "ok";
  if (hora) {
    if (!(await notificacoesPermitidas(true))) return "sem-permissao";
    await gravarJson(chave(uid), { hora });
  } else {
    await apagar(chave(uid));
  }
  await agendar(hora, dias);
  return "ok";
}

/** Refaz a agenda: ao abrir a Meditação e quando ela medita (hoje fica quieto). */
export async function reagendarLembreteDaMeditacao(uid: string, dias: readonly string[]) {
  if (Platform.OS === "web") return;
  await agendar(await lerLembreteDaMeditacao(uid), dias);
}

/** Sair da conta: nenhum lembrete fica tocando para quem saiu. */
export async function cancelarLembretesDaMeditacao() {
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

async function agendar(hora: string | null, dias: readonly string[]) {
  await cancelarLembretesDaMeditacao();
  if (!hora || !(await notificacoesPermitidas(false))) return;
  const hoje = ymdLocal();
  const quandos = proximosLembretes({ hora, agora: new Date(), meditouHoje: dias.includes(hoje) });
  try {
    for (const quando of quandos) {
      const ehHoje = ymdLocal(quando) === hoje;
      const { title, body } = textoDoLembrete(ehHoje ? sequenciaAteODia(dias, hoje) : 0);
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXO}${quando.getTime()}`,
        content: { title, body, data: { rota: "/jornada/meditar" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: quando },
      });
    }
  } catch {
    /* sem agenda: a escolha continua guardada e a próxima abertura tenta de novo */
  }
}
