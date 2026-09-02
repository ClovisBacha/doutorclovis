import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TabSkeleton } from "@/components/tab-skeleton";
import { SilencioDoCuidado } from "@/components/silencio-do-cuidado";
import { CompartilharMomento } from "@/components/compartilhar-momento";
import { triggerAchievementsCheck } from "@/lib/checar-conquistas";
import { momentoDe } from "@/lib/momento";
import { guardarMomentoParaPublicar } from "@/lib/momento-para-publicar";
import { celebrateChime, celebrateHaptic, fireConfetti } from "@/lib/celebrate";
import { creditarSementinhas } from "@/lib/evento-sementinhas";
import { publicarConquistasAResgatar } from "@/lib/evento-conquistas";
import { ACHIEVEMENT_DEFS, checkAndAwardAchievements } from "@/lib/achievements.functions";
import { RARIDADES } from "@/lib/conquistas";
import { claimDailyAndGetWallet } from "@/lib/sementinhas.functions";
import type { Tab } from "@/routes/_authenticated/minha-conta";

/**
 * A ABA DAS CONQUISTAS — o quarto corte de `minha-conta.tsx`.
 *
 * ⚠️ **MOVE, byte a byte.** Ela era `export function` num arquivo de ROTA, e
 * isso tem custo medido: um export não-rota sai do pedaço daquela rota e entra
 * no da ÁRVORE DE ROTAS, que toda página do site carrega. Sair daqui paga a
 * dívida estrutural e encolhe o arquivo de uma vez.
 *
 * O cartão do Modo Cuidado e a checagem de conquistas saíram ANTES, para os
 * arquivos próprios — eram compartilhados, e enquanto morassem na rota esta aba
 * não tinha como se mudar.
 */

export function ConquistasTab({
  careMode = false,
  onNavigate,
  bancada,
}: {
  careMode?: boolean;
  onNavigate?: (t: Tab) => void;
  /**
   * ⚠️ SÓ A BANCADA (`/preview-conquistas`).
   *
   * A tela busca do servidor e concede na hora — conferir a moldura de
   * raridade numa conta de verdade exigiria desbloquear uma épica, que leva
   * meses. Foi por telas assim serem impossíveis de olhar que a aba passou
   * tanto tempo com dezoito conquistas de um app que já tinha o dobro.
   */
  bancada?: { desbloqueadas: string[]; resgatadas?: string[] };
}) {
  const [unlocked, setUnlocked] = useState<{ achievement_key: string; unlocked_at: string }[]>(
    bancada
      ? bancada.desbloqueadas.map((k) => ({
          achievement_key: k,
          unlocked_at: "2026-08-01T12:00:00.000Z",
        }))
      : [],
  );
  const [loading, setLoading] = useState(!bancada);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [saldo, setSaldo] = useState<number | null>(bancada ? 125 : null);
  /* Quais já foram PAGAS. Desbloqueada e fora deste conjunto = tem prêmio
     esperando o toque dela. Ver `resgatarConquista` no servidor. */
  const [resgatadas, setResgatadas] = useState<Set<string>>(new Set(bancada?.resgatadas ?? []));
  /**
   * ⚠️ NÃO CONSEGUI LER quais já foram pagas.
   *
   * `resgatadas` vazio quer dizer "nenhuma ainda"; isto aqui quer dizer "não
   * sei". Com o vazio, uma falha de leitura faria as 39 conquistas voltarem a
   * pulsar "Resgatar +120 🌱" de uma vez — ela toca, o servidor responde
   * certíssimo que já pagou, e o cartão vira uma data sem nada acontecer. O app
   * prometendo moeda e não entregando é a forma mais rápida de ensinar que os
   * avisos daqui não valem leitura. Na dúvida, não prometer.
   */
  const [semSaberPagas, setSemSaberPagas] = useState(false);
  /**
   * ⚠️ Um CONJUNTO, não uma chave só.
   *
   * Era `resgatandoKey: string | null` com `if (resgatandoKey) return`, que é
   * uma trava GLOBAL: enquanto um cartão estava indo ao servidor, tocar em
   * outro era descartado em silêncio. Quem sai do Modo Cuidado, ou quem
   * acumulou vários, encontra justamente uma grade com muitos pendentes — e
   * toque que some sem sinal lê como app travado.
   */
  const [resgatando, setResgatando] = useState<Set<string>>(new Set());

  /**
   * O TOQUE QUE PAGA.
   *
   * ⚠️ O saldo sobe pelo MESMO caminho de todo ganho do app
   * (`creditarSementinhas`), e não por um `setSaldo` local: a barra do topo do
   * Caminho ouve esse evento, e um segundo caminho faria os dois números
   * discordarem — que é exatamente o defeito que o evento veio consertar.
   *
   * ⚠️ E a chave entra em `resgatadas` mesmo quando o servidor responde
   * `repetido` (a linha já existia): o objetivo do estado é "não há mais
   * prêmio aqui", e isso é verdade nos dois casos.
   *
   * ⚠️ O CAMINHO REPETIDO PRECISA DIZER ALGO. Todo o retorno visível (confete,
   * som, toast) vivia dentro de `if (r.granted > 0)`, então no repetido ela
   * tocava um botão que prometia `+40 🌱` e a tela respondia com silêncio — e
   * silêncio depois de um toque lê como app quebrado, não como "isso já era
   * seu". Acontece de verdade com dois aparelhos abertos ao mesmo tempo.
   * Sem festa: não é conquista nova, é um esclarecimento.
   */
  /**
   * A conquista que ela ACABOU de resgatar, para a folha de comemoração.
   *
   * ⚠️ **Só o instante do resgate, nunca o estado da grade.** Com o estado, a
   * folha abriria por cima da aba toda vez que ela viesse olhar as conquistas
   * que já tem — é a mesma distinção que faz os sprites do Caminho nascerem da
   * TRANSIÇÃO e não do contador.
   */
  const [conquistada, setConquistada] = useState<{ titulo: string; emoji: string } | null>(null);

  async function resgatar(key: string) {
    /* Por CHAVE, nunca global: a trava protege este cartão de um toque duplo,
       e não a grade inteira de ser usada. */
    if (resgatando.has(key)) return;
    setResgatando((v) => new Set(v).add(key));
    try {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) return;
      const { resgatarConquista } = await import("@/lib/achievements.functions");
      const r = await resgatarConquista({ data: { accessToken: token, key } });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setResgatadas((antes) => {
        const depois = new Set(antes).add(key);
        /* O emblema desce no MESMO instante do toque. Esperar a próxima
           checagem faria o número ficar prometendo o que ela acabou de pegar. */
        publicarConquistasAResgatar(
          Math.max(0, unlocked.filter((u) => !depois.has(u.achievement_key)).length),
        );
        return depois;
      });
      if (r.granted > 0) {
        creditarSementinhas(r.granted);
        setSaldo((v) => (v == null ? v : v + r.granted));
        fireConfetti(1);
        celebrateChime(1, careMode);
        celebrateHaptic(1);
        toast.success(`+${r.granted} 🌱`);
        /* ⚠️ O título e o emoji saem do CATÁLOGO (`conquistas.ts`), nunca de um
           texto digitado aqui: são os mesmos que o cartão da grade desenha, e
           duas cópias divergiriam no primeiro ajuste de nome. */
        const def = ACHIEVEMENT_DEFS.find((a) => a.key === key);
        if (def) setConquistada({ titulo: def.title, emoji: def.emoji });
        return;
      }
      if (r.repetido) toast("Essas Sementinhas já são suas 💛");
    } catch {
      toast.error("Não consegui resgatar agora.");
    } finally {
      setResgatando((v) => {
        const n = new Set(v);
        n.delete(key);
        return n;
      });
    }
  }

  useEffect(() => {
    if (bancada) return;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!s.session?.access_token) {
        setLoading(false);
        return;
      }
      const token = s.session.access_token;
      const res = await checkAndAwardAchievements({ data: { accessToken: token } });
      if (res.ok) {
        setUnlocked(res.unlocked);
        /* `null` = o servidor não conseguiu ler o ledger. Ver `semSaberPagas`:
           tratar como lista vazia poria prêmio em toda conquista da grade. */
        setSemSaberPagas(res.resgatadas == null);
        setResgatadas(new Set(res.resgatadas ?? []));
        /* A aba tem a leitura mais fresca — republica para o emblema da fita
           não ficar contando o que ela já pegou noutro aparelho. */
        publicarConquistasAResgatar(
          res.resgatadas == null
            ? null
            : res.unlocked.filter((u) => !res.resgatadas!.includes(u.achievement_key)).length,
        );
        /* Quais conquistas ainda NÃO foram comemoradas para esta paciente.
           Antes a régua era "desbloqueada nos últimos 30 segundos", calculada
           ao montar esta aba, e ela errava dos dois lados:
             · a conquista concedida em outro ponto do app (o
               `triggerAchievementsCheck`, que só mostra um toast) já tinha
               mais de 30s quando ela chegava aqui — a badge simplesmente
               aparecia colorida, sem festa nenhuma;
             · e sair e voltar dentro dos 30s disparava o confete de novo,
               quantas vezes ela quisesse.
           Agora a memória é de QUAIS, não de QUANDO: cada conquista comemora
           uma vez, no dia em que ela vier ver — mesmo que tenha sido dada há
           uma semana. */
        const JA = "dc-conquistas-comemoradas";
        let comemoradas: string[] = [];
        try {
          comemoradas = JSON.parse(localStorage.getItem(JA) ?? "[]");
          if (!Array.isArray(comemoradas)) comemoradas = [];
        } catch {
          comemoradas = [];
        }
        const todas = res.unlocked.map((a) => a.achievement_key);
        // Modo Cuidado: não acende o banner nem comemora — respeita o luto.
        const novas = res.careMode ? [] : todas.filter((k) => !comemoradas.includes(k));
        setNewBadges(novas);
        if (novas.length > 0) {
          /* A festa cresce com quantas vieram de uma vez. Antes eram sempre os
             mesmos confetes: desbloquear uma e desbloquear seis davam
             exatamente a mesma comemoração. */
          const nivel = Math.min(5, novas.length) as 1 | 2 | 3 | 4 | 5;
          fireConfetti(nivel);
          celebrateChime(nivel, careMode);
          celebrateHaptic(nivel);
        }
        /* Grava SEMPRE (inclusive em Modo Cuidado): quem sai do Modo Cuidado
           não deve levar de uma vez o confete de tudo que acumulou durante o
           luto. */
        try {
          localStorage.setItem(JA, JSON.stringify(todas));
        } catch {
          /* armazenamento bloqueado: no pior caso comemora de novo */
        }
      }
      // Concede o check-in do dia (idempotente) e lê o saldo já com conquistas
      // e marcos contabilizados acima.
      try {
        const w = await claimDailyAndGetWallet({ data: { accessToken: token } });
        if (w.ok) setSaldo(w.careMode ? null : w.balance);
      } catch {
        /* saldo é secundário: falha não quebra a aba */
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;
  if (loading) return <TabSkeleton />;

  const unlockedKeys = new Set(unlocked.map((u) => u.achievement_key));
  const unlockedCount = ACHIEVEMENT_DEFS.filter((d) => unlockedKeys.has(d.key)).length;
  const totalCount = ACHIEVEMENT_DEFS.length;
  const pct = Math.round((unlockedCount / totalCount) * 100);

  /* Cinco das dezoito só acontecem depois do parto. O contador dizia "3 de 18"
     e o anel nunca chegava perto de 100% — a gestante tem teto real de 13, e
     nada na tela dizia isso. Parecia falha dela em conquistas que ainda nem
     eram possíveis. Agora a linha embaixo do anel explica o teto. */
  const posPartoTotal = ACHIEVEMENT_DEFS.filter((d) => d.posParto).length;
  const posPartoFeitas = ACHIEVEMENT_DEFS.filter(
    (d) => d.posParto && unlockedKeys.has(d.key),
  ).length;
  const aindaNaoNasceu = posPartoFeitas === 0;

  const categories = [
    { key: "bebe", label: "Bebê", emoji: "👶" },
    { key: "saude", label: "Saúde", emoji: "❤️" },
    { key: "diario", label: "Diário", emoji: "📝" },
    { key: "educacao", label: "Educação", emoji: "🎓" },
    { key: "familia", label: "Família", emoji: "👨‍👩‍👧" },
  ] as const;

  return (
    <div className="space-y-8">
      {saldo != null && (
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-lime-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif text-[15px] font-semibold text-emerald-700">
                Suas Sementinhas
              </p>
              <p className="mt-1 flex items-baseline gap-1.5 font-serif text-3xl text-emerald-900">
                <span className="tabular-nums">{saldo}</span>
                <span className="text-2xl">🌱</span>
              </p>
              <p className="mt-0.5 text-xs text-emerald-700/80">
                Você ganha cuidando de você, aprendendo e avançando na jornada.
              </p>
            </div>
            <div className="text-4xl">🌱</div>
          </div>
          {/* Dizia "Em breve você vai poder usar suas Sementinhas para montar o
              seu Cantinho" — sobre uma tela que já existe, pronta, na pílula ao
              lado desta. O app anunciava como futuro o que estava a um toque. */}
          <p className="mt-3 rounded-2xl bg-white/60 px-3 py-2 text-[11px] text-emerald-800/80">
            Gaste no <strong>Meu Cantinho</strong>, aqui do lado — plantinhas, bichinhos e cenários
            pro seu Caminho. 💛
          </p>
        </div>
      )}

      <div className="rounded-3xl card-material p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-[15px] font-semibold text-primary">Suas conquistas</p>
            <p className="mt-1 font-serif text-2xl">
              {unlockedCount} de {totalCount}
            </p>
            <p className="text-sm text-muted-foreground">badges desbloqueadas</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary/20 text-base font-bold text-primary">
            {pct}%
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {aindaNaoNasceu && posPartoTotal > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {posPartoTotal} destas só acontecem depois que o bebê nascer — na gestação, o caminho
            completo são {totalCount - posPartoTotal}.
          </p>
        )}
      </div>

      {newBadges.length > 0 && (
        <div className="rounded-3xl border border-primary/25 bg-primary/8 p-5 text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="font-semibold text-foreground">
            {newBadges.length === 1
              ? "Nova conquista desbloqueada!"
              : `${newBadges.length} novas conquistas!`}
          </p>
        </div>
      )}

      {categories.map((cat) => {
        const defs = ACHIEVEMENT_DEFS.filter((d) => d.category === cat.key);
        return (
          <div key={cat.key}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <span>{cat.emoji}</span> {cat.label}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {defs.map((def) => {
                const isUnlocked = unlockedKeys.has(def.key);
                const unlockedAt = unlocked.find((u) => u.achievement_key === def.key)?.unlocked_at;
                const isNew = newBadges.includes(def.key);
                const rar = RARIDADES[def.raridade];
                /* ⚠️ Desbloqueada e AINDA NÃO RESGATADA: o cartão vira botão.
                   Ver `resgatarConquista` — o prêmio deixou de cair sozinho e
                   passou a depender do toque dela, como no Duolingo. */
                /* ⚠️ `!semSaberPagas`: sem saber quais já foram pagas, NENHUMA
                   vira botão. Ver o estado — a alternativa é a grade inteira
                   prometendo moeda que o servidor (com razão) não vai dar. */
                const aResgatar = isUnlocked && !semSaberPagas && !resgatadas.has(def.key);
                const emVoo = resgatando.has(def.key);
                return (
                  <div
                    key={def.key}
                    role={aResgatar ? "button" : undefined}
                    tabIndex={aResgatar ? 0 : undefined}
                    aria-label={
                      aResgatar
                        ? `Resgatar ${rar.sementinhas} Sementinhas de ${def.title}`
                        : undefined
                    }
                    onClick={aResgatar ? () => resgatar(def.key) : undefined}
                    onKeyDown={
                      aResgatar
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              resgatar(def.key);
                            }
                          }
                        : undefined
                    }
                    className={`rounded-2xl border p-4 text-center transition-all ${
                      aResgatar
                        ? /* Pulsa e convida. É o único estado da grade que pede
                             uma ação, e ele tem de se separar do resto à
                             distância de um olhar. */
                          "press cursor-pointer ring-2 ring-emerald-400 ring-offset-2 animate-pulse-slow "
                        : ""
                    }${
                      /* ⚠️ O ANEL DE RARIDADE SÓ PINTA O QUE ELA JÁ TEM.
                         Bloqueada continua cinza-neutra e apagada, de
                         propósito: um anel dourado numa conquista que ela
                         ainda não alcançou vira vitrine do que falta, e a
                         aba inteira passaria a medir ausência. A raridade é
                         informação sobre o que ela CONQUISTOU. O rótulo
                         abaixo continua dizendo qual é, sempre — quem quiser
                         saber o que vale a pena perseguir consegue ler. */
                      isUnlocked ? rar.anel : "border-border bg-secondary/20 opacity-50"
                    } ${isNew ? "shadow-md" : ""}`}
                  >
                    <div className={`text-3xl mb-2 ${!isUnlocked && "grayscale"}`}>{def.emoji}</div>
                    <p className="text-xs font-semibold">{def.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-tight">
                      {def.description}
                    </p>
                    <p
                      className={`mt-1.5 text-[10px] font-bold uppercase tracking-wide ${
                        isUnlocked ? rar.texto : "text-muted-foreground/60"
                      }`}
                    >
                      {rar.label} · {rar.sementinhas} 🌱
                    </p>
                    {aResgatar ? (
                      /* A data sai daqui de propósito: enquanto há prêmio a
                         pegar, a única coisa que o cartão precisa dizer é o
                         que fazer. A data volta assim que ela resgata. */
                      /* ⚠️ `emerald-700` e não `emerald-500`. Medido em pixel:
                         branco sobre o 500 dá **2,54:1**, e 11px em negrito não
                         é "texto grande" pela WCAG (o corte é 18,66px) — o
                         mínimo é 4,5. Era o CTA central desta mudança inteira,
                         e o mesmo defeito que a Loja de Sementinhas teve com o
                         preço a 2,64:1: consertado numa tela e não na irmã. O
                         700 dá 5,48:1 e continua verde. */
                      <p className="mt-1.5 rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white">
                        {emVoo ? "Resgatando…" : `Resgatar +${rar.sementinhas} 🌱`}
                      </p>
                    ) : isUnlocked && unlockedAt ? (
                      <p className="mt-1 text-xs text-primary">
                        {new Date(unlockedAt).toLocaleDateString("pt-BR")}
                      </p>
                    ) : null}
                    {!isUnlocked && (
                      <p className="mt-1 text-xs text-muted-foreground">🔒 bloqueada</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── ⚠️ A CONQUISTA VIRA CARTÃO — no instante do resgate ────────────
          Pedido do dono: "se a pessoa fez ali cinco exercícios e ganhou lá
          cinco estrelas, isso na página do jogo tem que depois refletir também
          essa mensagem pra ela compartilhar ali na comunidade".

          ⚠️ **Nasce do RESGATE, nunca do estado da grade.** Com o estado, a
          folha abriria por cima da aba toda vez que ela viesse olhar as
          conquistas que já tem — é a mesma distinção que faz os sprites do
          Caminho nascerem da TRANSIÇÃO e não do contador.

          ⚠️ **E o portão de Modo Cuidado é o de `momentoDe`**, que devolve
          `null` e faz o componente não desenhar botão nenhum. Um `if` aqui
          seria a segunda régua que `humorDaJornada` proíbe. */}
      {conquistada && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-6"
          onClick={() => setConquistada(null)}
        >
          <div
            className="w-full max-w-xs rounded-3xl bg-card p-6 text-center shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-5xl">{conquistada.emoji}</p>
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-primary">
              Conquista desbloqueada
            </p>
            <p className="mt-1 font-serif text-xl leading-tight">{conquistada.titulo}</p>
            <div className="mt-4">
              <CompartilharMomento
                momento={momentoDe({
                  especie: "conquista",
                  rotulo: conquistada.titulo,
                  emoji: conquistada.emoji,
                  emCuidado: !!careMode,
                })}
                /* ⚠️ `undefined` quando não há para onde navegar — e é o que
                   faz `CompartilharMomento` ESCONDER o botão em vez de oferecer
                   um que não leva a lugar nenhum. */
                aoPublicarNaComunidade={
                  onNavigate
                    ? (m) => {
                        guardarMomentoParaPublicar(m);
                        setConquistada(null);
                        onNavigate("Feed");
                      }
                    : undefined
                }
              />
            </div>
            <button
              onClick={() => setConquistada(null)}
              className="press mt-3 w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
