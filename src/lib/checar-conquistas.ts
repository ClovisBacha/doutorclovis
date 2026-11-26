import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ACHIEVEMENT_DEFS, checkAndAwardAchievements } from "@/lib/achievements.functions";
import { publicarConquistasAResgatar } from "@/lib/evento-conquistas";

/**
 * A CHECAGEM DE CONQUISTAS — chamada por seis telas.
 *
 * ⚠️ **MOVE de `minha-conta.tsx`, byte a byte.** Ele sai porque é chamado de
 * toda parte, e enquanto morasse num arquivo de ROTA nenhuma das abas que o
 * usam poderia sair de lá.
 *
 * ⚠️ **`jaCelebradas` É ESTADO DE MÓDULO, e continua sendo.** Ela é a trava que
 * impede o laço documentado no CLAUDE.md: o ouvinte de `dc-sementinhas` agenda
 * a checagem, e a checagem dispara o mesmo evento. A trava é LOCAL e não
 * depende do banco — sem chave nova não há crédito, sem crédito não há evento,
 * sem evento não há laço. Mudar de módulo não muda isso: continua havendo
 * exatamente uma instância. **Nunca a transforme em estado de componente.**
 */
const TOASTS_DE_CONQUISTA = 3;

const jaCelebradas = new Set<string>();

export function triggerAchievementsCheck() {
  supabase.auth
    .getSession()
    .then(({ data: s }) =>
      s.session?.access_token
        ? checkAndAwardAchievements({ data: { accessToken: s.session.access_token } })
        : null,
    )
    .then((res) => {
      if (!res || !res.ok) return;
      if (res.careMode) return; // Modo Cuidado: sem comemorações.

      /* O emblema da fita. `resgatadas === null` é "não consegui ler" e vira
         `null` aqui também — nunca 0, que afirmaria que não há nada, nem o
         total, que prometeria moeda. Ver `evento-conquistas.ts`. */
      publicarConquistasAResgatar(
        res.resgatadas == null
          ? null
          : res.unlocked.filter((u) => !res.resgatadas!.includes(u.achievement_key)).length,
      );

      const novas = (res.newlyAwarded ?? []).filter((k) => !jaCelebradas.has(k));
      if (novas.length === 0) return;
      for (const k of novas) jaCelebradas.add(k);

      /* ⚠️ O AVISO PRECISA DIZER QUE HÁ PRÊMIO, E ONDE PEGAR.
         Ele dizia só "Nova conquista desbloqueada: X!" — texto de quando o
         prêmio caía sozinho. Com o resgate no toque, quem não abrir
         Recompensas → Conquistas fica com as Sementinhas paradas e SEM SABER
         que estão lá. No Duolingo, que é a referência do dono, o que produz a
         visita é justamente o aviso de que tem algo a pegar. */
      for (const key of novas.slice(0, TOASTS_DE_CONQUISTA)) {
        const def = ACHIEVEMENT_DEFS.find((d) => d.key === key);
        if (def) {
          toast(`${def.emoji} ${def.title}! Toque nela em Conquistas para pegar suas Sementinhas.`);
        }
      }
      const resto = novas.length - TOASTS_DE_CONQUISTA;
      if (resto > 0) {
        toast(
          `🏅 E mais ${resto} ${resto === 1 ? "conquista" : "conquistas"} — as Sementinhas esperam o seu toque em Conquistas.`,
        );
      }

      /* ⚠️ NÃO CREDITA MAIS AQUI. O prêmio da conquista deixou de ser
         automático e passou a depender do toque dela na aba Conquistas
         (`resgatarConquista`). Creditar neste ponto mostraria o saldo subir por
         um prêmio que o servidor ainda não pagou — e ela chegaria à aba com o
         botão de resgate ainda pedindo o mesmo número, sem entender qual dos
         dois está certo.

         O toast fica: "desbloqueou" continua sendo notícia, e agora ele é
         também o convite para ir buscar. */
    })
    .catch(() => {});
}
