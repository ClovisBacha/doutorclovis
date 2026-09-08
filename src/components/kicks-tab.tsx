/**
 * O CONTADOR DE MOVIMENTOS — a segunda tela clínica a sair de
 * `minha-conta.tsx`.
 *
 * ⚠️ **ELA MEDE UM DOS NOVE SINTOMAS VERMELHOS de `triage.ts`** (redução de
 * movimentos fetais), e era a única das cinco telas que o coração abre sem
 * NENHUMA bancada: para olhar qualquer estado dela — a sessão em curso, o
 * cronômetro passando de duas horas, o aviso de socorro, a leitura que falhou
 * — era preciso uma conta de verdade e um dedo tocando por duas horas.
 *
 * É por isso que quase todo conserto que a `ContracoesTab` recebeu nunca
 * chegou aqui. E enquanto o bloco morava dentro do arquivo de rota, isso não
 * tinha conserto: uma bancada precisaria importá-lo, e exportar de um arquivo
 * de ROTA põe o código no pedaço da árvore de rotas que TODA página do site
 * carrega (`rotas-sem-export-solto`).
 *
 * ⚠️ **É UM MOVE, e nada mais.** O corpo é byte a byte o que estava em
 * produção — conferido por SHA-256. A única mudança de assinatura é a prop
 * `bancada`, e ela injeta o DADO nos mesmos `useState` da produção, nunca um
 * desenho à parte.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { NaoConsegueLer } from "@/components/nao-consegui-ler";
import { SilencioDoCuidado } from "@/components/silencio-do-cuidado";
import { supabase } from "@/integrations/supabase/client";
import { triggerAchievementsCheck } from "@/lib/checar-conquistas";
import { hapticKick } from "@/lib/haptics";
import { diaCurto, horaCurta } from "@/lib/hora-do-registro";
import { relogioDeSessao } from "@/lib/relogio-de-sessao";
import { GraficoClinico } from "@/components/grafico-clinico";
import {
  faixaPessoal,
  FRASE_DA_LINHA_PLANA,
  leituraDeHoje,
  serieDeChutes,
} from "@/lib/serie-de-chutes";
import { guardarSessao, lerSessao } from "@/lib/sessao-guardada";
import { sinalMovimentosReduzidos } from "@/lib/sinais-clinicos";
import { manterTelaAcesa } from "@/lib/tela-acesa";
/* ⚠️ `import type` — o tipo é apagado na compilação, então isto NÃO cria
   dependência de tempo de execução com o arquivo de rota. É o mesmo caminho
   que `silencio-do-cuidado.tsx` já usa, com a razão escrita lá: o lugar certo
   de `Tab` é `lib/`, e movê-lo toca dezenas de referências. */
import type { Tab } from "@/routes/_authenticated/minha-conta";

/** A linha de `kick_sessions` que esta tela desenha. */
export type KickSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  kick_count: number;
  /** 1 mais fraco · 2 como sempre · 3 mais forte. `null` antes de set/2026. */
  strength?: number | null;
};

/**
 * ⚠️ **A FORÇA É O OUTRO EIXO, e ele pesa quase o mesmo que a frequência.**
 * Heazell 2017 (caso-controle internacional), razões de chance ajustadas para
 * natimortalidade: redução de FREQUÊNCIA aOR 2,97; redução de FORÇA aOR 2,53.
 * O contador media a primeira e ignorava a segunda.
 *
 * ⚠️ TRÊS níveis, e não a escala de 1 a 5 do Count the Kicks: a tela irmã já
 * usa três, e duas escalas no mesmo hub ensinam a decodificar.
 */
const FORCAS = [
  { valor: 1, rotulo: "Mais fraco" },
  { valor: 2, rotulo: "Como sempre" },
  { valor: 3, rotulo: "Mais forte" },
] as const;

export function KicksTab({
  weeks,
  babyName,
  careMode = false,
  onNavigate,
  bancada,
}: {
  weeks: number | null;
  babyName: string | null;
  careMode?: boolean;
  onNavigate?: (t: Tab) => void;
  /**
   * ⚠️ A bancada injeta o DADO nos MESMOS `useState` da produção, nunca um
   * desenho à parte — é a lição do `?streak=41` da folha da chama, que cravava
   * o NÚMERO e deixava o resto vir de uma jornada vazia. E a FORMA das props
   * é a mesma, porque uma bancada que passa props diferentes mede um app que
   * não existe (isso já produziu uma medição de desempenho falsa aqui).
   */
  bancada?: {
    history?: KickSession[];
    instavel?: boolean;
    /** Uma sessão em curso, com quantos movimentos e há quantos minutos. */
    ativa?: { count: number; minutos: number };
  };
}) {
  /* ⚠️ A sessão em curso é LOCAL — ela só vira linha no banco quando termina.
     Ver o comentário de `start()`. */
  const [active, setActive] = useState<{ startedAt: string } | null>(
    bancada?.ativa ? { startedAt: "2026-09-05T20:00:00-03:00" } : null,
  );
  const [count, setCount] = useState(bancada?.ativa?.count ?? 0);
  const [history, setHistory] = useState<KickSession[]>(bancada?.history ?? []);
  /** A leitura FALHOU — não é o mesmo que ela nunca ter contado chutes. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  /* Como sempre é o padrão: é o caso comum, e um padrão vazio obrigaria a
     escolher algo para poder encerrar. */
  const [forca, setForca] = useState(2);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState((bancada?.ativa?.minutos ?? 0) * 60000);
  /* Booleano, e nunca o objeto: um literal remontado a cada render faria os
     efeitos re-rodarem em toda pintura. */
  const ehBancada = !!bancada;

  const label = babyName ?? "o bebê";
  /**
   * ⚠️ **26 SEMANAS, e não 28 — e as duas datas coexistem de propósito.**
   *
   * O SOGC trocou a régua em 2023 (Guideline 441, que SUBSTITUI a de 2007):
   * "all pregnant individuals should be advised to regularly monitor fetal
   * movements from 26 weeks gestation... regardless of the technique used".
   * Ou seja, OBSERVAR começa em 26 — e a obrigação que ficou é a de PERCEBER
   * mudança e apresentar-se, não a de contar todo dia.
   *
   * O PISO NUMÉRICO continua em 28, onde ele nasceu (ACOG/PSANZ: dez
   * movimentos em até duas horas). É `sinais-clinicos.ts` quem o guarda; esta
   * constante só decide quando a TELA passa a falar de contagem.
   */
  const SEMANA_DE_OBSERVAR = 26;
  const isMonitoringPhase = weeks == null || weeks >= SEMANA_DE_OBSERVAR;

  /* ⚠️ Mesma classe da HealthTab, na tela que MEDE um sintoma vermelho:
     `data ?? []` fazia uma falha de rede afirmar "Nenhuma sessão registrada
     ainda" para quem conta chutes há semanas — e é a comparação com as
     sessões anteriores que diz se o bebê está se mexendo menos que o normal
     dele. Sem histórico, a tela não responde a pergunta que ela veio fazer. */
  /* ⚠️ JANELA DE TEMPO, e não `.limit(10)`: o gráfico precisa da série, e a
     lista precisa das dez últimas — mas de UMA leitura só. Duas consultas
     dariam dois estados de erro, e a tela mostraria gráfico sem lista (ou o
     contrário) sem ninguém saber qual das duas falhou. */
  async function load() {
    const desde = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data, error } = await (supabase as any)
      .from("kick_sessions")
      /* Só o que a tela lê: `select("*")` trazia `user_id` e `created_at`. */
      .select("id, started_at, ended_at, kick_count")
      .not("ended_at", "is", null)
      .gte("started_at", desde)
      .order("started_at", { ascending: false })
      .limit(120);
    if (error) {
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setHistory(data ?? []);
  }
  /* O id da conta, resolvido uma vez: ele é a chave da sessão guardada, e sem
     ele a contagem de uma paciente reapareceria na tela da seguinte num
     aparelho compartilhado. `getSession` lê o DISCO — `getUser` iria à rede. */
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (ehBancada) return;
    void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user?.id ?? null));
  }, [ehBancada]);

  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  /* ⚠️ A SESSÃO EM CURSO É RESTAURADA. Trocar de sub-tela desmonta esta aba
     (`<Fade key={sub}>`), e o pior caminho era o do SOCORRO: o botão do cartão
     vermelho troca de aba, ou seja, o único caminho de contato DESTRUÍA a
     contagem que produziu o alarme. Ver `sessao-guardada.ts`. */
  useEffect(() => {
    if (ehBancada || !uid || active) return;
    const guardada = lerSessao(uid, Date.now());
    if (!guardada) return;
    setActive({ startedAt: guardada.startedAt });
    setCount(guardada.count);
    startRef.current = new Date(guardada.startedAt).getTime();
    setElapsed(Date.now() - new Date(guardada.startedAt).getTime());
  }, [ehBancada, uid, active]);

  useEffect(() => {
    /* ⚠️ Na bancada o cronômetro fica CRAVADO: sem isto ele partiria de
       `Date.now() - 0` e mostraria décadas — e o estado que esta bancada existe
       para provar é justamente "duas horas com quatro movimentos". */
    if (!active || ehBancada) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active, ehBancada]);

  /* ─── A SESSÃO SÓ VIRA LINHA QUANDO ELA ENCERRA ───────────────────────────
     ⚠️ Antes, tocar em "Iniciar sessão" INSERIA na hora uma linha com
     `kick_count: 0` e `ended_at` nulo. Quem abria a tela e desistia — fechou o
     app, o telefone dormiu, trocou de aba — deixava essa linha para sempre.

     Ela não aparece no histórico DELA (a lista filtra por `ended_at`), mas
     `clinical_events` une `kick_sessions` sem filtro nenhum: no prontuário e
     no "o que mudou desde a última consulta" o médico lia
     **"Movimentos — 0 movimentos"**, uma afirmação clínica que nunca
     aconteceu. Ela não sentiu zero; ela nem começou a contar.

     ⚠️ **E O CONSERTO NÃO PODE SER "só gravar se houver chute".** Zero
     movimentos em duas horas é exatamente o alarme que esta tela existe para
     dar — é um dos nove sintomas vermelhos. O que separa os dois casos não é a
     contagem, é o ENCERRAMENTO: quem encerra registrou, mesmo que em zero;
     quem abandonou não registrou nada.

     O relógio passa a viver só no aparelho até `stop()`. A sessão em curso
     continua não sobrevivendo ao fechamento do app — isso já era assim, porque
     `count` sempre foi estado do React. */
  function start() {
    const startedAt = new Date().toISOString();
    setActive({ startedAt });
    setCount(0);
    startRef.current = Date.now();
    setElapsed(0);
    guardarSessao(uid, { startedAt, count: 0 });
  }

  async function tap() {
    if (!active) return;
    hapticKick(); // vínculo tátil: o bebê "chuta de volta"
    const next = count + 1;
    setCount(next);
    guardarSessao(uid, { startedAt: active.startedAt, count: next });
    if (next >= 10) {
      await stop(next);
    }
  }

  async function stop(finalCount = count) {
    if (!active) return;
    /* ⚠️ `getSession` lê o DISCO; `getUser` ia à REDE — no caminho que grava
       DUAS HORAS de contagem. Num 4G de hospital a paciente recebia "não foi
       possível salvar" e perdia tudo por uma ida que não precisava existir. É
       a mesma troca que o cronômetro de contrações já tinha feito. */
    const { data: sess } = await supabase.auth.getSession();
    const usuario = sess.session?.user?.id ?? uid;
    if (!usuario) {
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      return;
    }
    /* ⚠️ `started_at` vai EXPLÍCITO, e não pelo `DEFAULT now()` do banco: a
       sessão começou quando ela tocou em "Iniciar", não quando ela encerrou —
       e a duração é o que dá sentido a "10 em 2 horas". */
    const linha = {
      user_id: usuario,
      started_at: active.startedAt,
      ended_at: new Date().toISOString(),
      kick_count: finalCount,
    };
    /* ⚠️ DEGRAU DE RECUO, e ele não é opcional: `strength` nasce num
       `APLICAR_*.sql` que o dono roda À MÃO, e o deploy chega ANTES — é o
       estado normal desta produção. Sem o degrau, GRAVAR A SESSÃO pararia de
       funcionar para todo mundo por causa de uma coluna que ninguém pediu.

       ⚠️ E o código é `PGRST204`, nunca `42703`: num INSERT quem recusa é o
       PostgREST, pelo schema cache, e o pedido nem chega ao Postgres. Escrever
       o outro já custou três recursos silenciosos nesta base. */
    let { error } = await (supabase as any)
      .from("kick_sessions")
      .insert({ ...linha, strength: forca });
    if ((error as { code?: string } | null)?.code === "PGRST204") {
      ({ error } = await (supabase as any).from("kick_sessions").insert(linha));
    }
    if (error) {
      /* ⚠️ NÃO limpa a tela: a contagem dela continua à mostra para ela poder
         tentar de novo. Zerar aqui perderia duas horas de contagem. */
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      return;
    }
    setActive(null);
    setCount(0);
    guardarSessao(uid, null);
    load();
    triggerAchievementsCheck();
  }

  /* ⚠️ O relógio mora em `lib/` e as DUAS telas de cronômetro leem a mesma
     função. A razão inteira — "125:00 não é um relógio", e o "3502:18" que a
     tela irmã mostrava — está escrita lá. */
  const relogio = relogioDeSessao(elapsed);

  /**
   * ⚠️ **A TELA ANUNCIAVA A RÉGUA E NÃO A APLICAVA.** Ela escreve "o ideal é
   * sentir 10 em até 2 horas", conta até dez, e quando as duas horas passavam
   * com quatro movimentos o cronômetro seguia correndo: "4 / 10 chutes" e
   * "02:15:00", sem uma palavra sobre o que isso quer dizer nem sobre o que
   * fazer. Redução de movimentos fetais é um dos NOVE sintomas VERMELHOS de
   * `triage.ts`, e esta era a única tela que mede um deles sem régua e sem
   * caminho para socorro — a irmã dela, o cronômetro de contrações, tem o
   * botão do 192 desde sempre.
   *
   * A régua mora em `sinais-clinicos.ts`, junto das outras, e não aqui: o
   * CLAUDE.md proíbe duplicar limite clínico fora dela.
   */
  const movimentosReduzidos = active
    ? sinalMovimentosReduzidos({ semanas: weeks, movimentos: count, minutos: elapsed / 60000 })
    : null;

  /* ─── AS TRÊS ESTATÍSTICAS QUE A SÉRIE DEVE RESUMIR ──────────────────────
     E as que ela NÃO deve. Winje 2011 aplicou os limiares publicados à
     população inteira: o de Moore (menos de 10 em 2 h) tem sensibilidade de 5%
     para desfecho subótimo; o de Kuwata dispara em 41% das gestações NORMAIS.
     O que sobra com base é o desvio em relação ao normal DELA — daí a faixa
     pessoal, a leitura de hoje contra ela, e o tamanho da janela. Média
     aritmética, percentil populacional, tendência extrapolada e "score" ficam
     de fora de propósito. */
  const serie = serieDeChutes(history);
  const faixa = faixaPessoal(serie);
  const leitura = leituraDeHoje(serie, faixa);
  const ultimo = serie.length ? serie[serie.length - 1] : null;

  /* Modo Cuidado: a aba inteira se cala. Ela oferecia "conte 10
     movimentos de {nome do bebê}" — o convite mais doloroso possível para
     quem acabou de perder a gestação. */
  /* Tela acesa durante a contagem. É a atividade mais longa do app — a
     paciente pode ficar até duas horas esperando o bebê se mexer, sem tocar no
     aparelho, e é justamente por não tocar que a tela apaga. */
  useEffect(() => {
    if (!active) return;
    return manterTelaAcesa();
  }, [active]);

  if (careMode) return <SilencioDoCuidado onNavigate={onNavigate} />;
  return (
    <div className="space-y-6">
      {/* Context banner */}
      {weeks != null && !isMonitoringPhase && (
        <div className="glass-card glass-sky rounded-2xl p-4 text-sm text-sky-900">
          <span className="mr-1.5">{weeks < 20 ? "🌱" : "🤗"}</span>
          {weeks < 20
            ? `Semana ${weeks} — os movimentos começam a ser sentidos entre as semanas 18 e 25. Continue o pré-natal normalmente.`
            : `Semana ${weeks} — você já pode perceber os movimentos de ${label}! A contagem começa por volta da semana ${SEMANA_DE_OBSERVAR}.`}
        </div>
      )}

      <div className="glass-card glass-sky rounded-3xl p-8 text-center">
        <p className="text-4xl mb-3">👶🦵</p>
        <p className="font-serif text-xl text-sky-800">Contador de chutes</p>
        {/* ⚠️ O texto passou a descrever o MÉTODO com melhor base — o
            count-to-ten vespertino de Moore & Piacquadio, que é o que ACOG,
            SOGC e PSANZ adotaram: mede-se o TEMPO até dez movimentos, deitada
            de lado, no começo da noite (o pico de atividade fica entre 21h e
            22h). Para a maioria isso leva cerca de vinte minutos. */}
        <p className="mt-2 text-sm text-muted-foreground">
          {isMonitoringPhase
            ? `Conte quanto tempo ${label} leva para fazer 10 movimentos. Deitada de lado, no começo da noite — para a maioria são uns 20 minutos. Passadas 2 horas sem 10, ligue para o seu médico.`
            : `A contagem começa por volta da semana ${SEMANA_DE_OBSERVAR}.`}
        </p>
        {/* Soluços são involuntários e não contam — é o que o protocolo diz, e
            é a dúvida mais comum de quem começa a contar. */}
        {isMonitoringPhase && (
          <p className="mt-1 text-[13px] text-muted-foreground">
            Valem chutes, socos, rolamentos e cutucadas. Soluços não contam.
          </p>
        )}
        {!active ? (
          <button
            onClick={start}
            className="press mt-6 min-h-11 rounded-full px-8 text-sm font-semibold text-white shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
            style={{
              /* ⚠️ Medido no pixel: branco sobre `#0369a1` dá 5,7:1 e sobre
                 `#075985`, 7,3 — os dois passam. A versão anterior era o
                 gradiente rosa do app com `text-primary-foreground`, e media
                 3,19:1 no ponto claro: o rótulo do botão que abre a tela era
                 dos textos menos legíveis dela. */
              background: "radial-gradient(circle at 30% 30%, #0369a1, #075985 70%)",
            }}
          >
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                /* ⚠️ O número da contagem é o texto MAIOR desta tela e era o
                   menos legível: medido, "4" dava 1,60:1 e "/ 10 chutes",
                   1,87 — as duas reprovando. O azul fundo resolve os dois. */
                background: "radial-gradient(circle at 30% 25%, #0369a1, #075985 70%)",
              }}
            >
              <div>
                <div key={count} className="pop-in font-serif text-5xl">
                  {count}
                </div>
                <div className="text-xs uppercase tracking-widest opacity-80">/ 10 chutes</div>
              </div>
            </button>
            <p className="mt-4 text-sm text-muted-foreground">⏱ {relogio}</p>
            {/* ⚠️ O caminho de socorro, no formato que o cronômetro de
                contrações já usa: a frase da régua e DOIS toques — o médico
                dela e o 192. Nada aqui depende de a sessão ser encerrada:
                encerrar é a última coisa que ela deve estar pensando agora. */}
            {movimentosReduzidos && (
              <div className="mt-4 rounded-2xl border border-rose-400 bg-rose-100 p-4 text-left text-rose-900">
                {/* ⚠️ O título diz o FATO e o corpo diz o que fazer. Antes os
                    dois diziam "Ligue para o seu médico agora" — a mesma frase
                    duas vezes, uma em cima da outra, e a repetição rouba o
                    lugar da informação que ela ainda não tem. */}
                <p className="font-semibold">⚠️ Menos movimentos que o esperado</p>
                <p className="mt-0.5 text-sm">{movimentosReduzidos.nota}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href="tel:192"
                    className="press inline-flex h-11 items-center rounded-full bg-rose-600 px-4 font-semibold text-white"
                  >
                    Ligar 192 (SAMU)
                  </a>
                  <button
                    type="button"
                    onClick={() => onNavigate?.("Consultas")}
                    className="press inline-flex h-11 items-center rounded-full border border-rose-300 bg-white px-4 font-semibold text-rose-900"
                  >
                    Falar com o meu médico
                  </button>
                </div>
              </div>
            )}
            {/* ⚠️ A FORÇA, escolhida DURANTE a sessão e não depois: perguntar
                no fim seria um passo a mais no momento em que ela quer só
                fechar. "Como sempre" já vem marcado, que é o caso comum. */}
            <div className="mt-4">
              <p className="text-[13px] text-muted-foreground">Como estão os movimentos?</p>
              <div className="mt-2 flex justify-center gap-2">
                {FORCAS.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => setForca(f.valor)}
                    className={`press min-h-11 rounded-full border px-3 text-xs font-medium transition-colors ${
                      forca === f.valor
                        ? "border-sky-700 bg-sky-700 text-white"
                        : "border-border text-muted-foreground hover:border-sky-400"
                    }`}
                  >
                    {f.rotulo}
                  </button>
                ))}
              </div>
              {/* ⚠️ "Mais fraco" NÃO vira alarme vermelho automático — seria um
                  limiar clínico novo inventado aqui, e a régua deste app mora
                  em `sinais-clinicos.ts`. O que ele faz é dizer a verdade e
                  oferecer o caminho que já está logo abaixo. */}
              {forca === 1 && (
                <p className="mt-2 text-[13px] leading-snug text-sky-900">
                  Movimento mais fraco que o normal dele é motivo de falar com o seu médico hoje.
                </p>
              )}
            </div>

            <button
              onClick={() => stop()}
              className="press mt-3 min-h-11 px-3 text-xs text-muted-foreground hover:text-destructive"
            >
              Encerrar sessão
            </button>
          </div>
        )}

        {/* ⚠️ **O CAMINHO DE SOCORRO FICA NA TELA INTEIRA, e não só quando a
            régua dispara.** Ele nascia dentro do cartão vermelho — ou seja,
            depois de duas horas E abaixo de dez. Quem sente o bebê diferente
            no minuto quinze não tinha caminho nenhum.

            E a diretriz é explícita sobre isto, palavra por palavra (PSANZ,
            Rec. 3): "subjective maternal concern about DFM overrides any
            definition of DFM based on numbers of fetal movements". A
            percepção dela ganha do número — então o botão não pode depender do
            número.

            ⚠️ É uma linha discreta, e não um segundo cartão vermelho: dois
            blocos de alarme na mesma tela apagam a hierarquia do que dispara
            de verdade. O 192 continua exclusivo do cartão vermelho. */}
        <div className="mt-5 border-t border-sky-200/70 pt-4 text-left">
          <p className="text-[13px] leading-snug text-muted-foreground">
            Sentiu {label} diferente do normal dele — se mexendo menos, mais fraco, ou um dia
            diferente de todos? Não espere por esta contagem.
          </p>
          <button
            type="button"
            onClick={() => onNavigate?.("Consultas")}
            className="press mt-2 inline-flex h-11 items-center rounded-full bg-sky-700 px-4 text-sm font-semibold text-white"
          >
            Falar com o meu médico
          </button>
        </div>
      </div>

      {/* ⚠️ O GRÁFICO É DE TEMPO ATÉ 10 MOVIMENTOS, e a linha esperada é PLANA.
          A razão inteira — e as fontes — estão em `serie-de-chutes.ts`. */}
      {serie.length >= 2 && (
        <div className="rounded-3xl card-material p-5">
          <GraficoClinico
            titulo="Tempo até 10 movimentos"
            series={[
              {
                rotulo: "Tempo até 10",
                unidade: "min",
                pontos: serie.map((p) => ({ em: p.em, valor: p.valor })),
                /* ⚠️ A faixa de referência é O NORMAL DELA, nunca um corte
                   populacional — e ela só existe a partir de cinco sessões. */
                referencia: faixa ? { de: faixa.de, ate: faixa.ate } : null,
              },
            ]}
          />
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            {FRASE_DA_LINHA_PLANA}
          </p>
        </div>
      )}

      {/* ⚠️ AS TRÊS ESTATÍSTICAS NUMA FITA SÓ, e não em três cartões
          empilhados: no celular os três viravam 330px de rolagem para três
          números, e eles contam UMA história — o seu normal, a última, e sobre
          quantas contagens isso foi medido. */}
      {history.length > 0 && (
        <div className="rounded-3xl card-material p-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[13px] font-medium text-sky-800">O seu normal</p>
              <p className="mt-1 font-serif text-2xl tabular-nums">
                {faixa ? `${Math.round(faixa.de)}–${Math.round(faixa.ate)}` : "—"}
                {faixa && <span className="ml-1 text-sm font-normal">min</span>}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-sky-800">A última</p>
              <p className="mt-1 font-serif text-2xl tabular-nums">
                {ultimo ? Math.round(ultimo.valor) : "—"}
                {ultimo && <span className="ml-1 text-sm font-normal">min</span>}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-sky-800">Contagens</p>
              <p className="mt-1 font-serif text-2xl tabular-nums">{history.length}</p>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
            {/* ⚠️ MEDIANA, e não média — uma sessão de duas horas arrasta a
                média e some com o sinal. E a faixa só existe a partir de cinco
                contagens: com duas, o app compararia a segunda com a primeira e
                chamaria ruído de tendência. */}
            {faixa
              ? `Mediana de ${Math.round(faixa.mediana)} min em ${faixa.sessoes} contagens, nos últimos 90 dias.`
              : "Preciso de umas 5 contagens completas para saber qual é o seu normal."}{" "}
            {leitura === "acima"
              ? "A última ficou acima dele."
              : leitura === "abaixo"
                ? "A última ficou abaixo dele."
                : leitura === "dentro"
                  ? "A última ficou dentro dele."
                  : ""}
          </p>
        </div>
      )}

      <div>
        <p className="mb-3 font-serif text-[15px] font-semibold text-muted-foreground">Histórico</p>
        <div className="space-y-2">
          {/* ⚠️ A falha vem ANTES do vazio. "Nenhuma sessão registrada ainda"
              sobre uma leitura que falhou apaga a única referência que esta
              tela tem: é a comparação com as sessões anteriores que responde
              "ele está se mexendo menos que o normal DELE?". */}
          {/* ⚠️ O COMPONENTE ÚNICO, e a frase de sossego é CLÍNICA — é para isso
              que ela é prop. A carteirinha já carrega "ligue 192" na dela;
              aqui o que não pode faltar é dizer que a decisão de procurar
              atendimento NÃO depende desta tela voltar. */}
          {instavel && history.length === 0 && (
            <NaoConsegueLer
              oQue="o seu histórico de chutes"
              sossego="As suas contagens continuam salvas. E se você está sentindo o bebê se mexer menos que o normal dele, não espere por esta tela: fale com o seu médico ou procure atendimento."
              aoTentar={() => void load()}
            />
          )}
          {/* ⚠️ A RECARGA QUE FALHA COM HISTÓRICO EM MÃOS não pode ser muda: o
              `NaoConsegueLer` só nasce com a lista VAZIA, então uma falha no
              `load()` do fim de `stop()` não mudava nada na tela — e a leitura
              óbvia é "a sessão que eu acabei de salvar não salvou". Ela grava
              de novo, e o prontuário fica com duas linhas de duas horas.
              ⚠️ A confirmação de que gravou vem do INSERT, nunca do sucesso da
              recarga — é por isso que o texto diz que a contagem foi salva. */}
          {instavel && history.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-[13px] text-sky-900">
              Não consegui atualizar a lista agora — a sua contagem foi salva.{" "}
              <button
                type="button"
                onClick={() => void load()}
                className="press underline underline-offset-2"
              >
                Tentar de novo
              </button>
            </div>
          )}
          {!instavel && history.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
          )}
          {history.map((s) => {
            const dur = s.ended_at
              ? Math.round(
                  (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                )
              : 0;
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-xl card-material p-3 text-sm"
              >
                {/* ⚠️ Dia e hora CURTOS, sem o ano: a lista é de 90 dias, e a
                    data cheia quebrava a linha em três no celular — medido a
                    393px, com umas linhas de uma altura e outras de três. */}
                <span className="tabular-nums text-muted-foreground">
                  {diaCurto(s.started_at)} · {horaCurta(s.started_at)}
                </span>
                {s.kick_count >= 10 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                    ✓ 10
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">
                    {s.kick_count}
                  </span>
                )}
                {/* O minuto é o dado da série — ele vem por último e alinhado à
                    direita, que é onde o olho já procura o número. */}
                <span className="ml-auto tabular-nums font-medium">{dur} min</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
