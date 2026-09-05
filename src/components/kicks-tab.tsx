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
};

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
  const [active, setActive] = useState<KickSession | null>(
    bancada?.ativa
      ? ({ id: "bancada", started_at: "", ended_at: null, kick_count: 0 } as KickSession)
      : null,
  );
  const [count, setCount] = useState(bancada?.ativa?.count ?? 0);
  const [history, setHistory] = useState<KickSession[]>(bancada?.history ?? []);
  /** A leitura FALHOU — não é o mesmo que ela nunca ter contado chutes. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  const startRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState((bancada?.ativa?.minutos ?? 0) * 60000);
  /* Booleano, e nunca o objeto: um literal remontado a cada render faria os
     efeitos re-rodarem em toda pintura. */
  const ehBancada = !!bancada;

  const label = babyName ?? "o bebê";
  const isMonitoringPhase = weeks != null && weeks >= 28;

  /* ⚠️ Mesma classe da HealthTab, na tela que MEDE um sintoma vermelho:
     `data ?? []` fazia uma falha de rede afirmar "Nenhuma sessão registrada
     ainda" para quem conta chutes há semanas — e é a comparação com as
     sessões anteriores que diz se o bebê está se mexendo menos que o normal
     dele. Sem histórico, a tela não responde a pergunta que ela veio fazer. */
  async function load() {
    const { data, error } = await (supabase as any)
      .from("kick_sessions")
      .select("*")
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10);
    if (error) {
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setHistory(data ?? []);
  }
  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  useEffect(() => {
    /* ⚠️ Na bancada o cronômetro fica CRAVADO: sem isto ele partiria de
       `Date.now() - 0` e mostraria décadas — e o estado que esta bancada existe
       para provar é justamente "duas horas com quatro movimentos". */
    if (!active || ehBancada) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active, ehBancada]);

  async function start() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await (supabase as any)
      .from("kick_sessions")
      .insert({ user_id: u.user.id, kick_count: 0 })
      .select()
      .single();
    if (error) {
      toast.error("Não foi possível iniciar a sessão. Tente novamente.");
      return;
    }
    setActive(data);
    setCount(0);
    startRef.current = Date.now();
    setElapsed(0);
  }

  async function tap() {
    if (!active) return;
    hapticKick(); // vínculo tátil: o bebê "chuta de volta"
    const next = count + 1;
    setCount(next);
    if (next >= 10) {
      await stop(next);
    }
  }

  async function stop(finalCount = count) {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("kick_sessions")
      .update({ ended_at: new Date().toISOString(), kick_count: finalCount })
      .eq("id", active.id);
    if (error) {
      toast.error("Não foi possível salvar a sessão. Tente novamente.");
      return;
    }
    setActive(null);
    setCount(0);
    load();
    triggerAchievementsCheck();
  }

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  /**
   * ⚠️ **"125:00" NÃO É UM RELÓGIO.** O formato era `mm:ss` cravado, então a
   * sessão que passa de uma hora — que é o caso NORMAL desta tela, cujo prazo
   * é de DUAS horas — saía como "125:00". Quem lê mm:ss lê aquilo como cento e
   * vinte e cinco minutos só depois de pensar; a leitura imediata é de um
   * relógio quebrado.
   *
   * Passada a hora, ele vira `h:mm:ss`. Foi a FOTO da bancada que mostrou —
   * nenhuma asserção chegava perto disso.
   */
  const horas = Math.floor(mins / 60);
  const relogio =
    horas > 0
      ? `${horas}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

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

  // Stats from history
  const completeSessions = history.filter((s) => s.kick_count >= 10);
  const avgMins =
    completeSessions.length > 0
      ? Math.round(
          completeSessions.reduce((acc, s) => {
            const dur = s.ended_at
              ? (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000
              : 0;
            return acc + dur;
          }, 0) / completeSessions.length,
        )
      : null;

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
        <div className="glass-card glass-violet rounded-2xl p-4 text-sm text-violet-800">
          <span className="mr-1.5">{weeks < 20 ? "🌱" : "🤗"}</span>
          {weeks < 20
            ? `Semana ${weeks} — os movimentos começam a ser sentidos entre as semanas 18 e 25. Continue o pré-natal normalmente.`
            : `Semana ${weeks} — você já pode perceber os movimentos de ${label}! A contagem formal de chutes começa na semana 28.`}
        </div>
      )}

      <div className="glass-card glass-violet rounded-3xl p-8 text-center">
        <p className="text-4xl mb-3">👶🦵</p>
        <p className="font-serif text-xl text-violet-700">Contador de chutes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isMonitoringPhase
            ? `A partir da semana 28, conte 10 movimentos de ${label}. O ideal é sentir 10 em até 2 horas.`
            : "A contagem de movimentos é recomendada a partir da 28ª semana de gestação."}
        </p>
        {!active ? (
          <button
            onClick={start}
            className="mt-6 rounded-full px-8 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 active:scale-95 hover:opacity-90"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 80%, white), var(--primary) 70%)",
            }}
          >
            Iniciar sessão
          </button>
        ) : (
          <div className="mt-6">
            <button
              onClick={tap}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
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
            <button
              onClick={() => stop()}
              className="mt-3 text-xs text-muted-foreground hover:text-destructive"
            >
              Encerrar sessão
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl card-material p-5 text-center">
            {/* ⚠️ "Sessões registradas" afirmava o TOTAL sobre uma consulta com
                `.limit(10)`: quem contou trinta vezes lia "10" e concluía que
                o app perdeu vinte. Os três cartões descrevem a mesma janela. */}
            <p className="font-serif text-[15px] font-semibold text-primary">
              Sessões (últimas 10)
            </p>
            <p className="mt-2 font-serif text-3xl">{history.length}</p>
          </div>
          <div className="rounded-2xl card-material p-5 text-center">
            <p className="font-serif text-[15px] font-semibold text-primary">Sessões completas</p>
            <p className="mt-2 font-serif text-3xl">{completeSessions.length}</p>
          </div>
          <div className="rounded-2xl card-material p-5 text-center">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Tempo médio (10 chutes)
            </p>
            <p className="mt-2 font-serif text-3xl">{avgMins != null ? `${avgMins} min` : "—"}</p>
          </div>
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
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-sm"
              >
                <span>
                  {new Date(s.started_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {s.kick_count >= 10 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      ✓ completo
                    </span>
                  )}
                  {s.kick_count} chutes · {dur} min
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------- Checklist ---------- */
