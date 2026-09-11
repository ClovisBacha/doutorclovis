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
  ultimaContagem,
} from "@/lib/serie-de-chutes";
import { FORCA_PADRAO, NIVEIS_DE_FORCA, nivelDeForca } from "@/lib/forca-do-movimento";
import {
  comSessao,
  ehLocal,
  gravarFilaDeChutes,
  lerFilaDeChutes,
  mesclar,
  novoIdLocal,
  semSessao,
  type SessaoPendente,
} from "@/lib/fila-de-chutes";
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
 * ⚠️ O CATÁLOGO MORA EM `src/lib/forca-do-movimento.ts`, e não aqui: quem lê
 * este dado são DOIS — ela, no histórico logo abaixo, e o MÉDICO, no
 * prontuário, por `clinical_events`. Duas tabelas de rótulo divergiriam no
 * primeiro ajuste, e a divergência apareceria como o painel chamando de outra
 * coisa o que ela marcou.
 */

/**
 * Quantas noites a lista desenha. A JANELA da consulta continua sendo de 90
 * dias — ela alimenta o gráfico e a faixa pessoal —, e este número é só o que
 * cabe numa tela sem virar rolagem.
 */
const LINHAS_NO_HISTORICO = 10;

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
    /** Contagens salvas no aparelho que ainda não subiram. */
    pendentes?: SessaoPendente[];
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
  /**
   * ⚠️ **AS CONTAGENS QUE AINDA NÃO SUBIRAM.** Elas já estão salvas no
   * aparelho e aparecem na lista como qualquer outra — a diferença é que o
   * médico ainda não as vê. Ver `fila-de-chutes.ts`.
   */
  const [pendentes, setPendentes] = useState<SessaoPendente[]>(bancada?.pendentes ?? []);
  /* Como sempre é o padrão: é o caso comum, e um padrão vazio obrigaria a
     escolher algo para poder encerrar. */
  const [forca, setForca] = useState<number>(FORCA_PADRAO);
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
      .select("id, started_at, ended_at, kick_count, strength")
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

  /* ⚠️ **A FILA É LIDA ASSIM QUE A CONTA RESOLVE, E TENTA SUBIR.** Sem isto o
     pacote ficaria no aparelho esperando a próxima contagem para ser reparado —
     e quem não conta todo dia só descobriria dias depois, se descobrisse.

     ⚠️ E o ouvinte de `online` é o que fecha o caso do elevador e do
     estacionamento: a rede volta sozinha, sem ninguém tocar em nada. */
  useEffect(() => {
    if (ehBancada || !uid) return;
    const fila = lerFilaDeChutes(uid, Date.now());
    setPendentes(fila);
    void sincronizar(fila);
    const aoVoltar = () => void sincronizar(lerFilaDeChutes(uid, Date.now()));
    window.addEventListener("online", aoVoltar);
    return () => window.removeEventListener("online", aoVoltar);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [ehBancada, uid]);

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
    /* ⚠️ A força volta junto — e o pacote sem ela (versão anterior) NÃO
       reescreve o padrão: `?? forca` mantém o que a tela já tem. */
    setForca((f) => guardada.forca ?? f);
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
    guardarSessao(uid, { startedAt, count: 0, forca });
  }

  async function tap() {
    if (!active) return;
    hapticKick(); // vínculo tátil: o bebê "chuta de volta"
    const next = count + 1;
    setCount(next);
    guardarSessao(uid, { startedAt: active.startedAt, count: next, forca });
    if (next >= 10) {
      await stop(next);
    }
  }

  /**
   * ⚠️ **A CONTAGEM É SALVA NO APARELHO, E SÓ DEPOIS SOBE.**
   *
   * Antes esta função era o único ponto de falha de até DUAS HORAS de contagem:
   * `insert` direto, e sem rede saía `toast.error` com a contagem presa na tela
   * esperando um dedo. E o que ela faz depois de duas horas deitada de lado é
   * fechar o app — com a sessão guardada vencendo em quatro horas, a noite em
   * que o bebê se mexeu pouco simplesmente sumia.
   *
   * Agora ela nunca falha do lado dela: o pacote entra na fila local no
   * instante do encerramento e a subida acontece quando der (agora, ou quando a
   * rede voltar). É o mesmo desenho da aba irmã — ver `fila-de-chutes.ts`.
   */
  async function stop(finalCount = count) {
    if (!active) return;
    const agora = Date.now();
    /* ⚠️ **SEM `uid` A FILA NÃO PERSISTE**, e a contagem sumiria em silêncio —
       o defeito que esta fila veio consertar, entrando pela porta dos fundos.
       O efeito de montagem já o resolve do DISCO, então este caminho é raro;
       ele existe para o caso em que ela encerra antes disso. `getSession` lê o
       disco — `getUser` iria à rede, no fim de duas horas de contagem. */
    let conta = uid;
    if (!conta && !ehBancada) {
      const { data: sess } = await supabase.auth.getSession();
      conta = sess.session?.user?.id ?? null;
      if (conta) setUid(conta);
    }
    const pacote: SessaoPendente = {
      id: novoIdLocal(agora),
      /* ⚠️ `started_at` é o instante em que ela TOCOU em iniciar, e não o de
         agora: a duração é o que dá sentido a "10 em 2 horas". */
      started_at: active.startedAt,
      ended_at: new Date(agora).toISOString(),
      kick_count: finalCount,
      strength: forca,
      tentativas: 0,
    };
    const fila = comSessao(pendentes, pacote, agora);
    setPendentes(fila);
    gravarFilaDeChutes(conta ?? "", fila);

    /* ⚠️ **O texto diz o RESULTADO, nunca "parabéns".** Isto é medida clínica,
       não conquista: uma contagem que parou em quatro movimentos também é
       salva, e festejá-la seria o app comemorando o que ela veio relatar. O
       tempo aparece só quando os dez fecharam, porque é só aí que ele quer
       dizer alguma coisa (é o eixo do gráfico).

       ⚠️ E a duração sai de `active.startedAt` — o mesmo instante que vai para
       a linha —, nunca de `startRef`: ele é zero numa sessão restaurada antes
       do efeito e na bancada, e `Date.now() - 0` são décadas. */
    const minutos = Math.max(1, Math.round((agora - new Date(active.startedAt).getTime()) / 60000));
    toast.success(
      finalCount >= 10 ? `10 movimentos em ${minutos} min. Contagem salva.` : "Contagem salva.",
    );
    setActive(null);
    setCount(0);
    guardarSessao(conta, null);
    triggerAchievementsCheck();
    await sincronizar(fila);
  }

  /**
   * Sobe o que está na fila, uma de cada vez.
   *
   * ⚠️ **A PARTIR DA SEGUNDA TENTATIVA ELA CONFERE ANTES DE INSERIR.**
   * `kick_sessions` não tem chave única: um `insert` que deu certo com a
   * resposta perdida no caminho viraria uma SEGUNDA linha no mesmo instante — e
   * duas contagens idênticas no prontuário fazem o médico ler duas noites onde
   * houve uma. A chave natural é o `started_at`.
   *
   * ⚠️ E falha ao CONFERIR não insere: na dúvida, a contagem espera. Uma
   * duplicata é dado clínico falso; um atraso é só um atraso.
   */
  async function sincronizar(lista: readonly SessaoPendente[]) {
    if (ehBancada || !uid || !lista.length) return;
    let fila = [...lista];
    let subiuAlguma = false;
    for (const pacote of lista) {
      if (pacote.tentativas > 0) {
        const { data: jaLa, error: erroConfere } = await (supabase as any)
          .from("kick_sessions")
          .select("id")
          .eq("user_id", uid)
          .eq("started_at", pacote.started_at)
          .limit(1);
        if (erroConfere) continue;
        if (jaLa && jaLa.length) {
          fila = semSessao(fila, pacote.id);
          subiuAlguma = true;
          continue;
        }
      }
      const linha = {
        user_id: uid,
        started_at: pacote.started_at,
        ended_at: pacote.ended_at,
        kick_count: pacote.kick_count,
      };
      /* ⚠️ DEGRAU DE RECUO, e ele não é opcional: `strength` nasce num
         `APLICAR_*.sql` que o dono roda À MÃO, e o deploy chega ANTES — é o
         estado normal desta produção. Sem o degrau, GRAVAR A CONTAGEM pararia
         de funcionar para todo mundo por causa de uma coluna que ninguém pediu.

         ⚠️ E o código é `PGRST204`, nunca `42703`: num INSERT quem recusa é o
         PostgREST, pelo schema cache, e o pedido nem chega ao Postgres. */
      let { error } = await (supabase as any)
        .from("kick_sessions")
        .insert({ ...linha, strength: pacote.strength });
      if ((error as { code?: string } | null)?.code === "PGRST204") {
        ({ error } = await (supabase as any).from("kick_sessions").insert(linha));
      }
      if (error) {
        fila = comSessao(fila, { ...pacote, tentativas: pacote.tentativas + 1 }, Date.now());
        break;
      }
      fila = semSessao(fila, pacote.id);
      subiuAlguma = true;
    }
    setPendentes(fila);
    gravarFilaDeChutes(uid, fila);
    if (subiuAlguma) await load();
  }

  /** Qual linha do histórico está aberta para correção. `null` = nenhuma. */
  const [corrigindo, setCorrigindo] = useState<string | null>(null);

  /**
   * ⚠️ **CORRIGIR A FORÇA DEPOIS — o caminho que não existia.**
   *
   * A força é marcada DURANTE a contagem, e é o eixo com razão de chance 2,53
   * para desfecho ruim (Heazell 2017). Errar o chip é o caso normal: ela está
   * deitada no escuro, com o telefone na mão, prestando atenção no bebê e não
   * na tela. E o número vai para o prontuário — uma noite marcada "mais fraco"
   * por engano vira, do lado do médico, uma noite pior do que foi; e o
   * contrário some com o sinal que a contagem existia para dar.
   */
  async function corrigirForca(id: string, valor: number) {
    /* Pintura otimista: ela precisa VER que pegou. O recuo abaixo desfaz se o
       servidor recusar. */
    const antes = history;
    setHistory((hs) => hs.map((h) => (h.id === id ? { ...h, strength: valor } : h)));
    /* ⚠️ **A PENDENTE É CORRIGIDA NO APARELHO.** Ela ainda não existe no banco:
       um `update` por id local não casaria linha nenhuma, devolveria
       `error: null` (o PostgREST responde 204 a um update que não casa nada) e
       a tela diria "corrigido" sobre coisa nenhuma — e o que subiria depois
       seria o valor velho. */
    if (ehLocal(id)) {
      if (uid) {
        const agora = Date.now();
        const daFila = lerFilaDeChutes(uid, agora).find((x) => x.id === id);
        if (daFila) {
          const fila = comSessao(
            lerFilaDeChutes(uid, agora),
            { ...daFila, strength: valor },
            agora,
          );
          gravarFilaDeChutes(uid, fila);
          setPendentes(fila);
        }
      }
      setCorrigindo(null);
      return;
    }
    const { error } = await (supabase as any)
      .from("kick_sessions")
      .update({ strength: valor })
      .eq("id", id);
    if (error) {
      /* ⚠️ **DESFAZ, e nunca "salvo" sobre o que não salvou.** É a régua que os
         marcos do bebê pagaram: `{ ok: false }` chega numa resposta 200 normal,
         então um `try/catch` não pega — é preciso LER o valor.

         ⚠️ E o recuo do `PGRST204` NÃO existe aqui de propósito: sem a coluna
         no banco não há o que corrigir, e o chip nem é desenhado. */
      setHistory(antes);
      toast.error("Não consegui corrigir agora. Tente de novo.");
      return;
    }
    setCorrigindo(null);
  }

  /**
   * ⚠️ **APAGAR UMA CONTAGEM — e o caso que torna isto clínico, não conforto.**
   *
   * Ela toca em "Iniciar sessão" e esquece; o telefone dorme; a sessão é
   * encerrada com dois movimentos em duas horas. Essa linha é indistinguível,
   * para o app, de uma noite em que o bebê de fato se mexeu pouco: ela sai
   * âmbar na lista, entra em `clinical_events` com gravidade e aparece no
   * rascunho de achados como "⚠️ Movimentos" — ou seja, vira um ALARME FALSO na
   * fila do consultório, sobre uma contagem que nunca aconteceu.
   *
   * Até aqui o único caminho para desfazer isso era não existir. A aba Saúde
   * tem o × por linha desde ago/2026, com a razão escrita: valor errado que não
   * se pode apagar vira alarme falso no consultório.
   */
  async function apagarContagem(id: string) {
    /* A que ainda não subiu sai só da fila — não há linha no banco para
       apagar, e um `delete` por id local não casaria nada. */
    if (ehLocal(id)) {
      if (uid) {
        const fila = semSessao(lerFilaDeChutes(uid, Date.now()), id);
        gravarFilaDeChutes(uid, fila);
        setPendentes(fila);
      } else {
        setPendentes((ps) => semSessao(ps, id));
      }
      setCorrigindo(null);
      return;
    }
    const { error } = await (supabase as any).from("kick_sessions").delete().eq("id", id);
    if (error) {
      toast.error("Não consegui apagar esta contagem. Tente de novo.");
      return;
    }
    setHistory((hs) => hs.filter((h) => h.id !== id));
    setCorrigindo(null);
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
  /**
   * ⚠️ **A LISTA QUE A TELA LÊ É A MESCLADA — o servidor mais o que ainda não
   * subiu.** Sem isto a contagem que ela acabou de encerrar sem rede
   * simplesmente não apareceria: o `load()` volta sem ela, e a tela diria
   * "Nenhuma sessão registrada ainda" um segundo depois de a paciente ter
   * contado por duas horas. É o pior desfecho possível desta tela, e ele seria
   * a fila funcionando por dentro e mentindo por fora.
   *
   * ⚠️ E a mesclagem desempata por `started_at`: entre o `insert` dar certo e o
   * `load()` responder, a mesma contagem existe nos dois lugares.
   */
  const todas = mesclar(history, pendentes) as KickSession[];
  const serie = serieDeChutes(todas);
  const faixa = faixaPessoal(serie);
  const leitura = leituraDeHoje(serie, faixa);
  /* ⚠️ **"A última" NÃO é o último ponto da série.** A série descarta de
     propósito toda contagem que não chegou a dez, e um cartão rotulado "A
     última" apresentando um dia anterior é reasseguramento sobre o dia errado
     — na tela que mede um dos nove sintomas VERMELHOS. A régua está em
     `serie-de-chutes.ts`, com o caso medido. */
  const ultima = ultimaContagem(todas);
  /* A consulta já vem decrescente (`order("started_at", { ascending: false })`),
     então as primeiras são as últimas noites. */
  const historicoVisivel = todas.slice(0, LINHAS_NO_HISTORICO);

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

      {/* ⚠️ **SEM EMOJI E SEM TÍTULO AQUI — os dois são o assunto dito duas
          vezes.** Toda montagem desta aba na produção passa por `RegistrosHub`,
          que desenha `VoltarDaGrade` logo acima com a peça 3D dos Chutes no
          pratinho e o rótulo "Chutes". O 👶🦵 era a mesma coisa em emoji, dois
          centímetros abaixo da arte — e emoji tem cor própria em cada sistema,
          que é a razão pela qual o telefone e o calendário desta base foram
          desenhados. */}
      <div className="glass-card glass-sky rounded-3xl p-8 text-center">
        {/* ⚠️ O texto passou a descrever o MÉTODO com melhor base — o
            count-to-ten vespertino de Moore & Piacquadio, que é o que ACOG,
            SOGC e PSANZ adotaram: mede-se o TEMPO até dez movimentos, deitada
            de lado, no começo da noite (o pico de atividade fica entre 21h e
            22h). Para a maioria isso leva cerca de vinte minutos. */}
        {/* ⚠️ **O MÉTODO SAI DA FRENTE DURANTE A CONTAGEM.** Medido a 393px:
            este bloco são ~150px de texto ACIMA do contador, e em produção ele
            ainda tem o cabeçalho da grade (`VoltarDaGrade`) por cima. Com a
            sessão em curso isso empurra o cartão vermelho — o que carrega o 192
            — para a borda da dobra, e é o único momento em que ela não precisa
            ler como se conta: ela já está contando.

            Fora da sessão ele FICA, e em primeiro lugar: é o que ensina o
            método, e é a razão pela qual a contagem vale alguma coisa. É a
            mesma decisão que a aba irmã tomou com o aviso de uso. */}
        {!active && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {isMonitoringPhase
                ? `Conte quanto tempo ${label} leva para fazer 10 movimentos. Deitada de lado, no começo da noite — para a maioria são uns 20 minutos. Passadas 2 horas sem 10, ligue para o seu médico.`
                : `A contagem começa por volta da semana ${SEMANA_DE_OBSERVAR}.`}
            </p>
            {/* Soluços são involuntários e não contam — é o que o protocolo diz,
                e é a dúvida mais comum de quem começa a contar. */}
            {isMonitoringPhase && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                Valem chutes, socos, rolamentos e cutucadas. Soluços não contam.
              </p>
            )}
          </>
        )}
        {/* ⚠️ **A TELA SE CONTRADIZIA, e o custo era um alarme falso que ela
            dava a si mesma.** Fotografado em `?estado=vazio&w=12`: a frase
            "A contagem começa por volta da semana 26" e, dois centímetros
            abaixo, o convite azul "Iniciar sessão" — o botão mais destacado da
            tela desmentindo o texto acima dele.

            E o dano não é de coerência: antes da 26ª o bebê se mexe e ela não
            sente. Uma contagem que "falha" na semana 16 produz medo puro, e
            `sinalMovimentosReduzidos` CALA de propósito com a semana conhecida
            abaixo de 28 — ou seja, o app deixaria ela contar dois movimentos em
            duas horas e concluir sozinha o que ele decidiu não afirmar.

            ⚠️ **A CAPACIDADE NÃO FOI APAGADA — ela deixou de ser CONVIDADA.**
            Quem já sente e quer contar continua tendo o caminho, agora com a
            verdade dita ao lado. É a mesma linha que separa "não está aqui
            agora" de "não existe mais". */}
        {!active ? (
          isMonitoringPhase ? (
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
              <p className="text-[13px] leading-snug text-muted-foreground">
                Antes da semana {SEMANA_DE_OBSERVAR} é normal não chegar a 10 — o bebê se mexe
                muito, e o que ainda não dá para confiar é no que você sente.
              </p>
              <button
                onClick={start}
                className="press mt-2 min-h-11 rounded-full border border-sky-300 px-6 text-sm font-medium text-sky-900"
              >
                Contar mesmo assim
              </button>
            </div>
          )
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
            {/* ⚠️ **UM TOQUE A MAIS NÃO TINHA DESFAZER, E ELE ERRA PARA O LADO
                DE TRANQUILIZAR.** Este é um contador de TOQUE: o dedo escorrega,
                o telefone registra dois, ela conta um espreguiçar longo como
                dois movimentos. E o efeito não é neutro — a contagem inflada
                FECHA OS DEZ MAIS CEDO, então a tela responde "10 movimentos em
                8 min" sobre uma noite em que ele se mexeu menos. O erro empurra
                exatamente na direção que esta tela existe para não empurrar.

                ⚠️ **E ele fica LONGE do círculo, com alvo próprio.** Um desfazer
                encostado no botão que ela está tocando dezenas de vezes seria
                acertado sem querer — e aí o conserto vira o defeito. O rótulo
                diz o que aconteceu ("contei um a mais"), e não uma operação
                aritmética: ninguém em pé, no escuro, procura um "−1". */}
            {count > 0 && (
              <button
                type="button"
                onClick={() => {
                  const anterior = count - 1;
                  setCount(anterior);
                  guardarSessao(uid, { startedAt: active.startedAt, count: anterior, forca });
                }}
                className="press mt-1 inline-flex min-h-11 items-center px-3 text-[13px] text-muted-foreground underline underline-offset-4 hover:text-sky-900"
              >
                Contei um a mais — tirar 1
              </button>
            )}
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
                fechar. "Como sempre" já vem marcado, que é o caso comum.

                ⚠️ **E ELA SAI DE CENA QUANDO O ALARME ACENDE — achado da FOTO,
                não de asserção nenhuma.** Fotografado em `?estado=alerta`:
                logo abaixo de "Ligue para o seu médico agora ou procure a
                maternidade" a tela oferecia três chips perguntando "Como estão
                os movimentos?". A ação daquele minuto é LIGAR; um formulário
                embaixo da instrução compete com ela e sugere que ainda há algo
                a preencher antes. O valor já escolhido continua valendo e vai
                para a linha no encerramento — o que some é o pedido, não o
                dado. */}
            {!movimentosReduzidos && (
              <div className="mt-4">
                <p className="text-[13px] text-muted-foreground">Como estão os movimentos?</p>
                <div className="mt-2 flex justify-center gap-2">
                  {NIVEIS_DE_FORCA.map((f) => (
                    <button
                      key={f.valor}
                      type="button"
                      onClick={() => {
                        setForca(f.valor);
                        /* ⚠️ Gravar aqui, e não só no toque seguinte no bebê: ela
                         pode marcar "Mais fraco" e ir DIRETO ao botão de falar
                         com o médico — que é o caminho que desmonta a aba. Sem
                         esta linha, exatamente a paciente que mais importa
                         voltaria com o chip trocado. */
                        guardarSessao(uid, { startedAt: active.startedAt, count, forca: f.valor });
                      }}
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
                    Movimento mais fraco que o normal é motivo de falar com o seu médico hoje.
                  </p>
                )}
              </div>
            )}

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
            de verdade. O 192 continua exclusivo do cartão vermelho.

            ⚠️ **E ELA SOME QUANDO O CARTÃO VERMELHO ESTÁ NA TELA.** Fotografado
            em `?estado=alerta`: "Falar com o meu médico" aparecia DUAS VEZES,
            com o mesmo rótulo e o mesmo destino, a poucos centímetros um do
            outro. Dois botões idênticos não somam caminho — eles fazem quem
            está em pânico parar para decidir qual é qual, e ensinam que o app
            repete as coisas. Fora do alarme ela continua o tempo todo, que é a
            razão de ela existir. */}
        {!movimentosReduzidos && (
          <div className="mt-5 border-t border-sky-200/70 pt-4 text-left">
            {/* ⚠️ **"do normal DELE" — o app não tem campo de gênero, e o nome
              não diz o gênero de ninguém.** Quarta aparição desta família nesta
              base (o bolão, o agradecimento do chá, o título da lista de
              presentes), e a primeira dentro de um caminho de socorro: a frase
              que ela lê no minuto em que decide se liga para o médico não pode
              trazer um erro sobre o próprio bebê. A saída é a mesma de sempre —
              construção impessoal, que é verdadeira para todo mundo. */}
            <p className="text-[13px] leading-snug text-muted-foreground">
              Sentiu {label} diferente do normal — se mexendo menos, mais fraco, ou um dia diferente
              de todos? Não espere por esta contagem.
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.("Consultas")}
              className="press mt-2 inline-flex h-11 items-center rounded-full bg-sky-700 px-4 text-sm font-semibold text-white"
            >
              Falar com o meu médico
            </button>
          </div>
        )}
      </div>

      {/* ⚠️ O GRÁFICO É DE TEMPO ATÉ 10 MOVIMENTOS, e a linha esperada é PLANA.
          A razão inteira — e as fontes — estão em `serie-de-chutes.ts`. */}
      {serie.length >= 2 && (
        <div className="rounded-3xl card-material p-5">
          <GraficoClinico
            titulo="Tempo até 10 movimentos"
            /* ⚠️ A identidade é a DA TELA: a aba inteira é azul-céu, e o
               gráfico entrava nela com a linha índigo do prontuário. */
            paleta="chutes"
            /* ⚠️ O cartão já está desenhado logo acima (`card-material`): sem
               isto a figura desenhava a MOLDURA DELA por dentro — duas bordas
               concêntricas, com a de dentro sendo o cartão de contorno que o
               app da paciente já tinha tirado de todo o resto. */
            moldura="nenhuma"
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
      {todas.length > 0 && (
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
                {/* ⚠️ A que não fechou dez mostra os MOVIMENTOS, e não um
                    tempo: ela não tem tempo até dez, e herdar o de outro dia
                    era o defeito. A unidade ao lado é o que separa os dois. */}
                {ultima?.estado === "completa"
                  ? Math.round(ultima.minutos)
                  : ultima?.estado === "incompleta"
                    ? ultima.movimentos
                    : "—"}
                {ultima?.estado === "completa" && (
                  <span className="ml-1 text-sm font-normal">min</span>
                )}
                {ultima?.estado === "incompleta" && (
                  <span className="ml-1 text-sm font-normal">mov</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-sky-800">Contagens</p>
              <p className="mt-1 font-serif text-2xl tabular-nums">{todas.length}</p>
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
            {/* ⚠️ A leitura da série SÓ é dita quando a última contagem real é
                a mesma que fechou o último ponto. Quando ela não chegou a dez,
                o que a paciente precisa ler é isso — e nunca um "ficou dentro
                do normal" sobre um dia anterior. */}
            {ultima?.estado === "incompleta"
              ? `A última contagem parou em ${ultima.movimentos} ${ultima.movimentos === 1 ? "movimento" : "movimentos"} e não chegou a 10, então ela não entra nessa conta.`
              : ultima?.estado !== "completa"
                ? ""
                : leitura === "acima"
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
          {instavel && todas.length === 0 && (
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
          {instavel && todas.length > 0 && (
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
          {!instavel && todas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma sessão registrada ainda.</p>
          )}
          {/* ⚠️ **A LISTA DESENHAVA ATÉ 120 LINHAS, e o comentário do `load()`
              logo acima promete "as dez últimas".** A janela de 90 dias existe
              para o GRÁFICO ter série; a lista é para ela reconhecer as
              últimas noites. Medido a 393px: doze linhas já são ~1.300px de
              rolagem, e quem conta todo dia chega a três meses de linhas
              idênticas entre a fita de estatísticas e o fim da tela.

              ⚠️ E o que fica de fora é DITO. Cortar em silêncio faria a
              paciente que conta há dois meses achar que o app esqueceu — e
              esta é a tela em que "sumiu" é a leitura mais cara possível. */}
          {historicoVisivel.map((s) => {
            const dur = s.ended_at
              ? Math.round(
                  (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
                )
              : 0;
            /* ⚠️ **A RÉGUA É A ÚNICA, e ela vai SEM SEMANA de propósito.** O
               limite não pode ser reescrito aqui — o CLAUDE.md proíbe limite
               clínico fora de `sinais-clinicos.ts` —, e passar `weeks` seria
               pior que não passar: `weeks` é a semana de HOJE, e uma contagem
               de dois meses atrás foi feita noutra. A própria régua declara
               que os dois limites (dez movimentos, duas horas) não dependem da
               semana; ela só decide quando a contagem COMEÇA, que é uma
               pergunta sobre a sessão em curso e não sobre uma noite passada. */
            const naoChegouEmDuasHoras = !!sinalMovimentosReduzidos({
              semanas: null,
              movimentos: s.kick_count,
              minutos: dur,
            });
            /* ⚠️ A FORÇA É LIDA PELO CATÁLOGO, e não por dois `if` de
               número solto: o nível do meio não tem chip de propósito, e um
               `=== 1 || === 3` escrito aqui é a régua duplicada — o dia em que
               alguém acrescentar um nível, este chip some sem erro nenhum. */
            const forcaDaNoite = nivelDeForca(s.strength);
            const aberta = corrigindo === s.id;
            /* ⚠️ A pendente é a que ainda não subiu: ela já está SALVA (no
               aparelho), e o que falta é o médico ver. Dizer "não salvou" aqui
               seria mentir; não dizer nada faria a paciente concluir que o
               consultório já recebeu. */
            const pendente = ehLocal(s.id);
            return (
              <div key={s.id} className="rounded-xl card-material">
                {/* ⚠️ **A LINHA INTEIRA É O ALVO, e não um × de canto.** Medido
                    no chá de bebê: um × com `-my-2` encavala a caixa com a da
                    linha de baixo, e o toque dez pixels abaixo do centro apaga o
                    ITEM ERRADO. Numa lista que apaga dado clínico isso é
                    inaceitável — e aqui a linha apagada é uma noite inteira de
                    contagem. */}
                <button
                  type="button"
                  onClick={() => setCorrigindo(aberta ? null : s.id)}
                  aria-expanded={aberta}
                  className="press flex w-full items-center gap-2 p-3 text-left text-sm"
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
                  ) : naoChegouEmDuasHoras ? (
                    /* ⚠️ **A NOITE DO ALARME PARECIA UMA NOITE QUALQUER.** Uma
                       contagem que ela encerrou aos oito minutos com quatro
                       movimentos e a que passou DUAS HORAS com quatro saíam com
                       o mesmo chip azul-pálido — e a segunda é literalmente o
                       caso que faz esta tela existir. É a linha que ela mostra
                       ao médico, e a que ela procura quando quer saber se já
                       aconteceu antes. */
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {s.kick_count} em 2h
                    </span>
                  ) : (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">
                      {s.kick_count}
                    </span>
                  )}
                  {/* ⚠️ A FORÇA É LIDA AQUI, e isto não é enfeite: sem um
                      leitor, a coluna seria escrita e nunca vista — a corrente
                      quebrada que este repositório já pagou meia dúzia de
                      vezes. É o eixo com aOR 2,53 para desfecho ruim, e é
                      comparando com as outras noites que ela percebe a
                      MUDANÇA. */}
                  {forcaDaNoite?.chip && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        forcaDaNoite.valor === 1
                          ? "bg-amber-100 text-amber-900"
                          : "bg-sky-100 text-sky-900"
                      }`}
                    >
                      {forcaDaNoite.chip}
                    </span>
                  )}
                  {/* O minuto é o dado da série — ele vem por último e alinhado
                      à direita, que é onde o olho já procura o número. */}
                  <span className="ml-auto tabular-nums font-medium">{dur} min</span>
                </button>
                {pendente && (
                  <p className="px-3 pb-2 text-[13px] text-muted-foreground">
                    Salva no seu celular — vai para o seu médico quando a internet voltar.
                  </p>
                )}
                {aberta && (
                  <div className="border-t border-border px-3 pb-3 pt-3">
                    {/* ⚠️ **A FORÇA É O QUE SE CORRIGE, e não a contagem.** O
                        número de movimentos é a MEDIDA — reescrevê-lo depois
                        seria o app deixando a paciente reescrever o fato que
                        ela veio registrar. O que se erra de verdade é o chip,
                        marcado no escuro com o telefone na mão; e para o toque a
                        mais durante a contagem existe o desfazer, lá em cima. */}
                    <p className="text-[13px] text-muted-foreground">Como estavam os movimentos?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {NIVEIS_DE_FORCA.map((n) => (
                        <button
                          key={n.valor}
                          type="button"
                          onClick={() => void corrigirForca(s.id, n.valor)}
                          className={`press min-h-11 rounded-full border px-3 text-xs font-medium ${
                            s.strength === n.valor
                              ? "border-sky-700 bg-sky-700 text-white"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          {n.rotulo}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void apagarContagem(s.id)}
                      className="press mt-3 inline-flex min-h-11 items-center rounded-full border border-rose-300 px-4 text-xs font-semibold text-rose-800"
                    >
                      Apagar esta contagem
                    </button>
                    <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
                      Apague só o que não aconteceu — uma sessão que você abriu sem querer, por
                      exemplo. Uma noite em que {label} se mexeu pouco é justamente o que o seu
                      médico precisa ver.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {todas.length > historicoVisivel.length && (
            <p className="pt-1 text-[13px] text-muted-foreground">
              Mostrando as {LINHAS_NO_HISTORICO} últimas. As outras{" "}
              {todas.length - historicoVisivel.length} dos últimos 90 dias continuam salvas e entram
              nas contas acima.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
