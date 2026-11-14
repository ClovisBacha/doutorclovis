/**
 * OS CONVITES PREMIUM DO MÉDICO — a tela que faltava.
 *
 * ⚠️ **O APP DA PACIENTE PEDIA UM CÓDIGO QUE NINGUÉM CONSEGUIA GERAR.**
 *
 * Três telas dela — a oferta Premium, o Caminho e a Jornada do bebê — dizem
 * "Digite o código do seu médico" e prometem um ano de Premium. `generateInviteCode`
 * e `getMyInviteInfo` estavam escritas, testadas e com a cota mensal inteira
 * resolvida no servidor — e **com zero chamadores no app**. O médico não tinha
 * onde gerar.
 *
 * O desfecho é o pior possível para os dois lados: ela pede o código, ele
 * procura no painel e não acha, e a conclusão razoável dela é que ele não quis
 * dar. Um recurso que existe inteiro no servidor e não tem porta é
 * indistinguível de um recurso que não existe — é a mesma família das sete
 * funções da rede social que viveram meses sem chamador.
 *
 * ⚠️ **Ela mora em PACIENTES, junto da mesada.** Dar um ano de Premium é uma
 * ação sobre uma paciente, e é ali que ele já está olhando a lista delas — a
 * mesma razão que moveu `MesadaDoMedico` de "Meu Perfil" para cá.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { InviteInfo } from "@/lib/invites.functions";

type Estado = "carregando" | "pronto" | "falhou";

export function ConvitesDoMedico({
  tokenFn,
  bancada,
}: {
  tokenFn: () => Promise<string>;
  /**
   * ⚠️ Só a BANCADA. Ela injeta o DADO nos mesmos estados da produção — nunca
   * o desenho —, e o guarda dos efeitos é o booleano derivado, não o objeto:
   * um literal remontado a cada render faria o efeito re-rodar em toda pintura.
   */
  bancada?: { info: InviteInfo | null; estado: Estado };
}) {
  const ehBancada = !!bancada;
  const [info, setInfo] = useState<InviteInfo | null>(bancada?.info ?? null);
  const [estado, setEstado] = useState<Estado>(bancada?.estado ?? "carregando");
  const [gerando, setGerando] = useState(false);
  /** Os códigos gerados NESTA sessão — é o que ele vai copiar agora. */
  const [novos, setNovos] = useState<string[]>([]);

  async function carregar() {
    setEstado("carregando");
    try {
      const accessToken = await tokenFn();
      if (!accessToken) {
        setEstado("falhou");
        return;
      }
      const { getMyInviteInfo } = await import("@/lib/invites.functions");
      const r = await getMyInviteInfo({ data: { accessToken } });
      /* ⚠️ `ok: false` chega numa resposta 200 NORMAL — um `try/catch` em volta
         não pega. Sem ler, a tela mostraria "0 de 0" e ele concluiria que o
         plano dele não dá convites. */
      if (!r.ok) {
        setEstado("falhou");
        return;
      }
      setInfo(r);
      setEstado("pronto");
    } catch {
      setEstado("falhou");
    }
  }

  useEffect(() => {
    if (ehBancada) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehBancada]);

  async function gerar() {
    setGerando(true);
    try {
      const accessToken = await tokenFn();
      if (!accessToken) {
        toast.error("Sua sessão expirou — entre de novo.");
        return;
      }
      const { generateInviteCode } = await import("@/lib/invites.functions");
      const r = await generateInviteCode({ data: { accessToken } });
      if (!r.ok) {
        /* ⚠️ Cada motivo tem texto próprio, e `cota_ilegivel` é o que mais
           importa: ele NÃO quer dizer "acabou". Dizer "cota esgotada" sobre uma
           contagem que falhou faria o médico parar de tentar num mês em que ele
           ainda tem convites. */
        const recado: Record<string, string> = {
          sem_convites: "O seu plano ainda não inclui convites Premium.",
          cota_esgotada: "Você já usou todos os convites deste mês.",
          cota_ilegivel: "Não consegui conferir quantos você já usou — tente de novo.",
          falha_geracao: "Não consegui gerar o código agora — tente de novo.",
          sem_perfil: "Não consegui identificar o seu perfil.",
        };
        toast.error(recado[r.error] ?? "Não consegui gerar o código agora.");
        return;
      }
      setNovos((v) => [r.code, ...v]);
      /* Vem do próprio retorno: uma segunda ida ao servidor podia discordar
         dela mesma numa corrida entre dois aparelhos. */
      setInfo((i) => (i ? { ...i, used: r.used, remaining: r.remaining } : i));
      toast.success("Código gerado — copie e mande para ela 💛");
    } catch {
      toast.error("Não consegui gerar o código agora — tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  async function copiar(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      /* Alguns navegadores recusam a área de transferência fora de contexto
         seguro. O código continua à vista para ele digitar. */
      toast("Copie o código acima");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Convites Premium
      </p>
      <h3 className="mt-1 font-serif text-lg text-foreground">Um ano de Premium para ela</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Gere um código e mande para a sua paciente. Ela digita no app dela e ganha um ano de
        Premium, sem pagar nada.
      </p>

      {estado === "carregando" && <div className="skeleton mt-4 h-16 rounded-xl" />}

      {estado === "falhou" && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:bg-amber-500/10">
          <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200">
            Não consegui carregar seus convites agora
          </p>
          <button
            type="button"
            onClick={() => void carregar()}
            className="mt-2 min-h-[44px] rounded-full border border-amber-400 px-4 text-sm font-medium text-amber-900 dark:text-amber-100"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {estado === "pronto" && info && !info.eligible && (
        <p className="mt-4 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
          O seu plano ainda não inclui convites Premium.
        </p>
      )}

      {estado === "pronto" && info && info.eligible && (
        <>
          {/* ⚠️ A contagem ilegível NÃO vira "0 usados · 25 restantes": um painel
              que afirma isso sobre uma leitura que falhou faz o médico contar
              com convites que talvez não tenha. */}
          <p className="mt-4 text-sm text-muted-foreground">
            {info.usedIlegivel ? (
              <span className="text-amber-700 dark:text-amber-300">
                Não consegui conferir quantos você já usou este mês — o limite do seu plano é{" "}
                {info.limit}.
              </span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{info.remaining}</span> de{" "}
                {info.limit} convites disponíveis neste mês.
              </>
            )}
          </p>

          {/* ⚠️ **O BOTÃO DESLIGA QUANDO A COTA ACABOU, e essa decisão é o
              oposto da do presente entre amigas — de propósito.**

              Lá a tela NÃO desabilita pela contagem, porque o servidor não tem
              limite nenhum: desabilitar seria "o limite de volta, agora só na
              tela, que é o pior lugar — o servidor aceitaria e a tela
              recusaria". Aqui o servidor RECUSA (`cota_esgotada`), então um
              botão aceso promete uma ação que não acontece.

              ⚠️ E ele NÃO desliga quando a contagem é ILEGÍVEL: aí ninguém sabe
              se acabou, e tirar o botão seria tirar dele uma capacidade que
              talvez tenha. Na dúvida, deixa tentar — quem decide é o servidor. */}
          <button
            type="button"
            onClick={() => void gerar()}
            disabled={gerando || (!info.usedIlegivel && info.remaining <= 0)}
            className="press mt-3 min-h-[44px] w-full rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {gerando
              ? "Gerando…"
              : !info.usedIlegivel && info.remaining <= 0
                ? "Sem convites neste mês"
                : "Gerar um código"}
          </button>
          {!info.usedIlegivel && info.remaining <= 0 && (
            /* O rótulo diz que acabou; esta linha diz quando volta. Sem ela, o
               botão apagado lê como recurso retirado. */
            <p className="mt-2 text-center text-[12px] text-muted-foreground">
              Sua cota renova no primeiro dia do mês que vem.
            </p>
          )}

          {novos.length > 0 && (
            <div className="mt-4 space-y-2">
              {novos.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 dark:bg-emerald-500/10"
                >
                  <span className="font-mono text-base font-bold tracking-widest text-emerald-800 dark:text-emerald-200">
                    {c}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copiar(c)}
                    className="min-h-[44px] shrink-0 rounded-full border border-emerald-400 px-3 text-sm font-medium text-emerald-800 dark:text-emerald-200"
                  >
                    Copiar
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ⚠️ O limite ético, como em toda tela que fala de Premium: o cuidado
          dela não depende disto, e o médico precisa poder dizer isso a ela. */}
      <p className="mt-4 text-[12px] leading-snug text-muted-foreground/80">
        O Premium é do jogo e dos enfeites. Nada do cuidado dela — registros, SOS, conversa com
        você, lembretes — depende dele.
      </p>
    </div>
  );
}
