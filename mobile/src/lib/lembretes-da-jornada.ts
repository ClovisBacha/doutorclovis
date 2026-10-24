import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { gravarJson, lerJson } from "~/lib/armazem";
import { carregarAulaDoDia } from "~/lib/jornada/aulas-do-app";
import { tituloCurtoDaAula } from "~/lib/jornada/aula";
import {
  DIAS_AGENDADOS,
  lembretesDaJornada,
  lerPreferencia,
  type ContextoDoLembrete,
  type PreferenciaDosLembretes,
} from "~/lib/jornada/lembrete-da-jornada";
import { notificacoesPermitidas } from "~/lib/notificacoes";

/**
 * Os lembretes da jornada no iPhone (`~/lib/jornada/lembrete-da-jornada` é a
 * régua): a preferência mora no aparelho, por conta (`dc-…:<uid>`, apagada ao
 * sair), e as notificações são agendadas dia a dia — refeitas a cada abertura
 * da tela Hoje e a cada cuidado marcado (o de hoje some quando o dia fecha).
 * Tocar no aviso abre a tela Hoje.
 */

const chave = (uid: string) => `dc-lembretes-jornada:${uid}`;
const PREFIXO = "dc-jornada-";

export type PreferenciaGuardada = PreferenciaDosLembretes & { dispensado: boolean };

export async function lerLembretesDaJornada(uid: string): Promise<PreferenciaGuardada> {
  return lerPreferencia(await lerJson<unknown>(chave(uid), null));
}

/**
 * Muda a preferência e refaz a agenda. Ligar qualquer aviso pede a permissão
 * (é o momento em que ela faz sentido); recusada, nada é ligado e a tela diz
 * como ativar nos Ajustes.
 */
export async function definirLembretesDaJornada(
  uid: string,
  mudanca: Partial<PreferenciaGuardada>,
  contexto: ContextoDoLembrete | null,
): Promise<"ok" | "sem-permissao"> {
  const atual = await lerLembretesDaJornada(uid);
  const nova: PreferenciaGuardada = { ...atual, ...mudanca };
  const liga = (!!nova.hora && !atual.hora) || (nova.semanaNova && !atual.semanaNova);
  if (liga && Platform.OS !== "web" && !(await notificacoesPermitidas(true)))
    return "sem-permissao";
  await gravarJson(chave(uid), nova);
  if (contexto) await agendar(nova, contexto);
  else if (!nova.hora && !nova.semanaNova) await cancelarLembretesDaJornada();
  return "ok";
}

/** Refaz a agenda com o estado de agora (a chama, o que já foi feito hoje). */
export async function reagendarLembretesDaJornada(uid: string, contexto: ContextoDoLembrete) {
  if (Platform.OS === "web") return;
  await agendar(await lerLembretesDaJornada(uid), contexto);
}

/** Sair da conta, ou o Modo Cuidado que acabou de ligar: nenhum aviso antigo fica tocando. */
export async function cancelarLembretesDaJornada() {
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

/**
 * O assunto das aulas dos dias agendados (gestação), para o aviso dizer do
 * que é a aula de amanhã. O banco de aulas é baixado uma vez por sessão;
 * se falhar, o aviso fala do desafio do dia.
 */
async function comAulas(c: ContextoDoLembrete): Promise<ContextoDoLembrete> {
  if (c.modo !== "gestacao" || c.D == null) return c;
  const assuntos: Record<number, string> = {};
  await Promise.all(
    Array.from({ length: DIAS_AGENDADOS }, (_, i) => c.D! + i).map(async (D) => {
      const q = await carregarAulaDoDia(D);
      if (q) assuntos[D] = tituloCurtoDaAula(q.teach);
    }),
  );
  return { ...c, aula: (D) => assuntos[D] ?? null };
}

async function agendar(pref: PreferenciaDosLembretes, contexto: ContextoDoLembrete) {
  if (Platform.OS === "web") return;
  await cancelarLembretesDaJornada();
  if (!pref.hora && !pref.semanaNova) return;
  if (!(await notificacoesPermitidas(false))) return;
  const ctx = await comAulas(contexto);
  try {
    for (const l of lembretesDaJornada(pref, ctx)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIXO}${l.id}`,
        content: { title: l.titulo, body: l.corpo, data: { rota: "/jornada" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: l.quando },
      });
    }
  } catch {
    /* sem agenda: a preferência continua guardada e a próxima abertura tenta de novo */
  }
}
