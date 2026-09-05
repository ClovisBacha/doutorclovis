/**
 * O CRONÔMETRO DE CONTRAÇÕES — e a tela clínica que ninguém conseguia olhar.
 *
 * Saiu de `minha-conta.tsx` (set/2026) por uma razão só: ela **não tinha
 * bancada**. Enquanto morava dentro do arquivo de ROTA não dava nem para
 * importá-la — exportar de uma rota põe o código no pedaço da árvore de rotas,
 * que TODA página do site carrega (`rotas-sem-export-solto`).
 *
 * E é a tela do app em que não olhar custa mais caro: é o cronômetro que a
 * paciente abre em trabalho de parto, e o banner de análise é o ÚNICO lugar
 * dela com "Ligar 192 (SAMU)". Um defeito aqui não aparece em teste — aparece
 * na noite em que ela precisa.
 *
 * ⚠️ O CORPO NÃO FOI TOCADO no move: cada linha é byte a byte a que estava em
 * produção, conferida por SHA-256. Um move que também "melhora" é uma
 * reescrita, e aí a mudança de comportamento se esconde num diff de 470 linhas.
 *
 * Bancada: `/preview-contracoes` — os estados que não se fabricam numa conta de
 * teste (a leitura instável que já silenciou o 192, o padrão de trabalho de
 * parto, a contração em curso).
 */
import { useEffect, useRef, useState } from "react";
import { History } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { hapticTap } from "@/lib/haptics";
import { hapticoDeAviso } from "@/lib/nativo";
import { sinalContracoesPrematuras } from "@/lib/sinais-clinicos";
import { tocarSomDeUI } from "@/lib/tocar-som-de-ui";

/* ---------- Contrações ---------- */

type Contraction = {
  id: string;
  started_at: string;
  ended_at: string | null;
  intensity: number;
};

const INTENSITY_LABEL = ["", "Leve", "Moderada", "Forte"];
const INTENSITY_COLOR = [
  "",
  "bg-secondary text-primary",
  "bg-primary/10 text-primary",
  "bg-rose-100 text-rose-700",
];

/**
 * ⚠️ `weeks` NÃO É DECORATIVO — ele era descartado, e isso custava caro.
 *
 * A função só olhava intervalo e duração médios. Uma paciente de 28 semanas com
 * contrações a cada 12 minutos lia "Padrão normal"; a cada 8, "Atenção — monitore
 * de perto". E `triage.ts` lista "Contrações regulares antes de 37 semanas" como
 * sintoma VERMELHO: a mesma paciente, respondendo a triagem, receberia "procure
 * atendimento agora". Duas telas do mesmo app dizendo coisas opostas sobre o
 * mesmo quadro — e a que ela abre com o cronômetro na mão era a que
 * tranquilizava.
 *
 * A régua nova mora em `sinais-clinicos.ts`, com as outras, porque CLAUDE.md é
 * explícito: nunca duplique um limite clínico fora daquele arquivo.
 */
function analyzeContractions(
  list: Contraction[],
  weeks: number | null,
): {
  status: "normal" | "atencao" | "alerta" | "urgente";
  label: string;
  detail: string;
} {
  if (list.length < 2)
    return {
      status: "normal",
      label: "Monitorando",
      detail: "Registre mais contrações para análise do padrão.",
    };

  const completed = list.filter((c) => c.ended_at != null);
  if (completed.length < 2)
    return { status: "normal", label: "Monitorando", detail: "Continue registrando." };

  // Average duration (seconds)
  const avgDur =
    completed.reduce((sum, c) => {
      const dur = (new Date(c.ended_at!).getTime() - new Date(c.started_at).getTime()) / 1000;
      return sum + dur;
    }, 0) / completed.length;

  // Average interval between contractions (minutes)
  const sorted = [...list].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
  );
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const interval =
      (new Date(sorted[i].started_at).getTime() - new Date(sorted[i - 1].started_at).getTime()) /
      60000;
    intervals.push(interval);
  }
  const avgInterval = intervals.reduce((s, x) => s + x, 0) / intervals.length;

  /* ─── PREMATURIDADE VEM ANTES DE TUDO ────────────────────────────────────
     Antes das 37 semanas, contração regular é sinal vermelho independentemente
     de quão "leve" o padrão parece — e é justamente o padrão leve que a régua
     de trabalho de parto classificaria como normal. Por isso este teste vem
     PRIMEIRO: ele não pode ser alcançado só depois de a paciente passar pelos
     cortes de parto ativo. */
  const prematuro = sinalContracoesPrematuras({ semanas: weeks, intervaloMin: avgInterval });
  if (prematuro)
    return {
      status: "urgente",
      label: "⚠️ Ligue para o seu médico agora",
      detail: `${prematuro.nota} Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.`,
    };

  if (avgInterval <= 3 && avgDur >= 60)
    return {
      status: "urgente",
      label: "⚠️ Vá para a maternidade agora",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — trabalho de parto avançado.`,
    };
  if (avgInterval <= 5 && avgDur >= 45)
    return {
      status: "alerta",
      label: "Trabalho de parto ativo",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — ligue para o consultório.`,
    };
  if (avgInterval <= 10 && avgDur >= 30)
    return {
      status: "atencao",
      label: "Atenção — padrão irregular",
      detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s — monitore de perto.`,
    };
  return {
    status: "normal",
    label: "Padrão normal",
    detail: `Contrações a cada ${avgInterval.toFixed(0)} min por ${avgDur.toFixed(0)}s.`,
  };
}

export function ContracoesTab({
  weeks,
  bancada,
}: {
  weeks: number | null;
  /**
   * Só a `/preview-contracoes`. ⚠️ Injeta o DADO nos MESMOS `useState` da
   * produção, nunca um desenho à parte — é a lição que este repositório já
   * pagou duas vezes (a bancada que passava props num formato diferente mediu
   * um app que não existe; a que cravava só o número mostrava um estado que o
   * app nunca produz).
   *
   * Sem ela, a única coisa fotografável desta tela seria a lista vazia: sem
   * sessão a leitura falha, e os estados que importam — o padrão de trabalho
   * de parto, a contração em curso, a leitura instável que já silenciou o
   * botão do 192 — não se fabricam numa conta de teste.
   */
  bancada?: { contractions: Contraction[]; instavel?: boolean };
}) {
  /* `weeks` é lido de verdade agora — ver `analyzeContractions`. */
  const [contractions, setContractions] = useState<Contraction[]>(bancada?.contractions ?? []);
  const [active, setActive] = useState<Contraction | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [intensity, setIntensity] = useState(2);
  const startRef = useRef<number>(0);
  /* ⚠️ A LEITURA FALHANDO SUPRIMIA O BOTÃO DO 192.
     `data ?? []` transformava erro de rede em "ela não cronometrou nada", e o
     banner de análise — que é o que mostra "Ligar 192 (SAMU)" no caso urgente
     — vive atrás de `analysisWindow.length >= 2`. Com a lista vazia ele
     simplesmente não renderiza: o alerta de emergência era silenciado por uma
     falha de rede, em trabalho de parto.
     E a contração ABERTA não era retomada: o cronômetro voltava para "Iniciar"
     com uma contração em curso no banco. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  /* Booleano, e nunca o objeto: um literal remontado a cada render faria os
     efeitos re-rodarem em toda pintura. */
  const ehBancada = !!bancada;

  async function load() {
    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setContractions(data);
    // Resume active contraction if exists (no ended_at)
    const open = (data as Contraction[]).find((c) => !c.ended_at);
    if (open) {
      setActive(open);
      startRef.current = new Date(open.started_at).getTime();
    }
  }

  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  /* A contração ABERTA da bancada precisa da mesma âncora que `load()` põe:
     sem ela o cronômetro contaria a partir do zero absoluto. */
  useEffect(() => {
    if (!ehBancada) return;
    const aberta = (bancada?.contractions ?? []).find((c) => !c.ended_at);
    if (aberta) {
      setActive(aberta);
      startRef.current = new Date(aberta.started_at).getTime();
    }
  }, [ehBancada, bancada]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(t);
  }, [active]);

  async function startContraction() {
    /* ⚠️ O INSTANTE É O DO DEDO, e isto era um defeito de MEDIDA CLÍNICA.
       `ended_at` sempre foi carimbado aqui (`new Date()` dentro do `update`),
       e `started_at` caía no `DEFAULT now()` do banco — ou seja, no relógio do
       SERVIDOR, depois de `getUser()` e do insert. As duas pontas mediam em
       lugares diferentes: toda contração era gravada mais CURTA do que foi, e
       o INTERVALO entre elas — que é o dado que decide ir para a maternidade —
       saía deslocado pela latência. Num 4G ruim de hospital isso é segundos.
       Carimbar aqui põe as duas pontas no mesmo relógio: o dela. */
    const agora = Date.now();

    /* ⚠️ E O DEDO RECEBE RESPOSTA ANTES DE QUALQUER `await`. Ela está
       cronometrando DOR, de olhos fechados — é o caso de mão ocupada que o
       tique do FIM já documenta três linhas abaixo. O começo não tinha
       nenhum. */
    hapticTap();

    /* `getSession` lê o disco; `getUser` ia à rede. Uma ida a menos entre o
       toque e o cronômetro, no minuto em que ela menos pode esperar. */
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return;
    const { data, error } = await (supabase as any)
      .from("contraction_logs")
      .insert({ user_id: uid, intensity, started_at: new Date(agora).toISOString() })
      .select()
      .single();
    if (error) {
      /* ⚠️ O erro também é sentido: ela pode não estar olhando a tela. */
      hapticoDeAviso("erro");
      toast.error("Não foi possível registrar a contração. Tente novamente.");
      return;
    }
    setActive(data);
    startRef.current = agora;
    setElapsed(Math.max(0, Math.round((Date.now() - agora) / 1000)));
    load();
  }

  async function stopContraction() {
    if (!active) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      hapticoDeAviso("erro");
      toast.error("Não foi possível salvar a contração. Tente novamente.");
      return;
    }
    setActive(null);
    setElapsed(0);
    /**
     * ⚠️ O TIQUE DO FIM DA CONTRAÇÃO, e ele é o caso de mão ocupada.
     *
     * Ela está cronometrando DOR: olhar a tela para confirmar que o toque
     * pegou é exatamente o que ela menos consegue fazer nesse minuto. Um tique
     * de cinquenta milissegundos diz "marquei" sem pedir os olhos.
     *
     * ⚠️ A espécie existia declarada, justificada e SEM NENHUM CHAMADOR — a
     * mesma família de `proximoDesbloqueio` e `escadaDeTrofeus`. Uma revisão
     * adversarial a achou.
     *
     * `emSessao` porque o cronômetro É uma sessão que ela abriu: o toque que
     * marca o fim é dela, mas o portão de gesto é generoso demais para
     * depender de milissegundos aqui.
     */
    /* ⚠️ Sem `careMode` aqui: este componente não o recebe, e o cronômetro de
       contrações é justamente uma tela que continua valendo no Modo Cuidado —
       quem perdeu a gestação pode estar em trabalho de parto. `podeSoar` já
       barra o resto; este som é sobre o corpo dela, não sobre o bebê. */
    tocarSomDeUI("intervalo", { emSessao: true });
    load();
  }

  /* ⚠️ A confirmação vive na TELA — ver `ApagarConversas`, que carrega a razão
     inteira: no app instalado o `window.confirm` abre com o nome do domínio, e
     a decisão do dono é confirmação em mensagem separada. */
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false);

  async function clearSession() {
    setConfirmandoLimpar(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await (supabase as any)
      .from("contraction_logs")
      .delete()
      .eq("user_id", u.user.id);
    if (error) {
      toast.error("Não foi possível limpar o histórico. Tente novamente.");
      return;
    }
    setActive(null);
    load();
  }

  const elapsedSecs = Math.floor(elapsed / 1000);
  const elapsedMins = Math.floor(elapsedSecs / 60);
  const recentContractions = contractions.slice(0, 10);
  // Análise/banner consideram apenas contrações das últimas 2 horas,
  // para não manter alertas urgentes presos com dados antigos.
  const ANALYSIS_WINDOW_MS = 2 * 3600000;
  const analysisWindow = contractions
    .filter((c) => Date.now() - new Date(c.started_at).getTime() < ANALYSIS_WINDOW_MS)
    .slice(0, 10);
  const analysis = analyzeContractions(analysisWindow, weeks);

  const statusStyle: Record<string, string> = {
    normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
    atencao: "border-primary/20 bg-primary/6 text-foreground",
    alerta: "border-rose-200 bg-rose-50 text-rose-800",
    urgente: "border-rose-400 bg-rose-100 text-rose-900",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 text-sm text-foreground">
        Use este diário se sentir contrações regulares.{" "}
        <strong>Em dúvida, ligue para o consultório.</strong> Em emergência, ligue{" "}
        <strong>192 (SAMU)</strong>.
      </div>

      {/* ⚠️ O AVISO QUE SUBSTITUI O SILÊNCIO.
          Sem ele, a falha de leitura apagava o banner de análise — inclusive o
          caso `urgente`, que é o único lugar desta tela com o botão do SAMU. O
          app não pode INVENTAR uma análise que não tem; o que ele pode, e
          deve, é dizer que não conseguiu ler E dar o caminho que a análise
          daria. Errar para o lado de mandar ligar é o único lado seguro aqui. */}
      {instavel && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
          <p className="font-semibold">Não consegui carregar suas contrações agora</p>
          <p className="mt-0.5 text-sm">
            Isso é a nossa conexão — o que você já cronometrou continua salvo.{" "}
            <strong>
              Se as contrações estão regulares e fortes, não espere o app: ligue para o seu médico
              ou para o 192.
            </strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => void load()}
              className="min-h-11 rounded-full border border-rose-300 px-5 py-2 text-sm font-medium"
            >
              Tentar de novo
            </button>
            <a
              href="tel:192"
              className="inline-flex min-h-11 items-center rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          </div>
        </div>
      )}

      {/* Analysis banner */}
      {!instavel && analysisWindow.length >= 2 && (
        <div className={`rounded-2xl border p-4 ${statusStyle[analysis.status]}`}>
          <p className="font-semibold">{analysis.label}</p>
          <p className="mt-0.5 text-sm">{analysis.detail}</p>
          {analysis.status === "urgente" && (
            <a
              href="tel:192"
              className="mt-3 inline-block rounded-full bg-rose-600 px-5 py-2 text-sm font-medium text-white"
            >
              Ligar 192 (SAMU)
            </a>
          )}
        </div>
      )}

      {/* Main button */}
      <div className="rounded-3xl card-material p-8 text-center">
        <p className="font-serif text-[15px] font-semibold text-primary">
          Cronômetro de contrações
        </p>

        {/* Intensity selector */}
        {!active && (
          <div className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <button
                key={i}
                onClick={() => setIntensity(i)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  intensity === i
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {INTENSITY_LABEL[i]}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {active ? (
            <div>
              <button
                onClick={stopContraction}
                className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-white shadow-xl transition-transform duration-300 active:scale-95"
                style={{
                  background: "radial-gradient(circle at 30% 25%, #fb7185, #e11d48 70%)",
                }}
              >
                <div>
                  <div className="font-serif text-4xl">
                    {String(elapsedMins).padStart(2, "0")}:
                    {String(elapsedSecs % 60).padStart(2, "0")}
                  </div>
                  <div className="text-xs uppercase tracking-widest opacity-80 mt-1">
                    Toque p/ parar
                  </div>
                </div>
              </button>
              <p className="mt-3 text-sm font-medium text-rose-600 animate-pulse">
                Contração ativa…
              </p>
            </div>
          ) : (
            <button
              onClick={startContraction}
              className="liquid-pulse mx-auto flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform duration-300 active:scale-95 hover:scale-[1.03]"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, color-mix(in oklch, var(--primary) 78%, white), var(--primary) 70%)",
              }}
            >
              <div>
                <div className="text-lg font-medium">Iniciar</div>
                <div className="text-xs uppercase tracking-widest opacity-80 mt-1">contração</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* History table */}
      {recentContractions.length > 0 && (
        <div className="rounded-3xl card-material p-6">
          <div className="flex items-center justify-between">
            <p className="font-serif text-[15px] font-semibold text-muted-foreground">
              Últimas contrações
            </p>
            <button
              onClick={() => setConfirmandoLimpar(true)}
              className="press min-h-11 px-1 text-xs text-muted-foreground hover:text-destructive"
            >
              Limpar sessão
            </button>
          </div>
          {confirmandoLimpar && (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3">
              <p className="text-[13px] leading-snug text-rose-900">
                Apagar todo o histórico de contrações? Isto não tem volta.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={clearSession}
                  className="press min-h-11 flex-1 rounded-full bg-rose-600 px-4 text-sm font-semibold text-white"
                >
                  Sim, apagar
                </button>
                <button
                  onClick={() => setConfirmandoLimpar(false)}
                  className="press min-h-11 flex-1 rounded-full border border-border px-4 text-sm font-medium"
                >
                  Não
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 space-y-2">
            {recentContractions.map((c, idx) => {
              const dur = c.ended_at
                ? Math.round(
                    (new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000,
                  )
                : null;
              const interval =
                idx < recentContractions.length - 1
                  ? Math.round(
                      (new Date(c.started_at).getTime() -
                        new Date(recentContractions[idx + 1].started_at).getTime()) /
                        60000,
                    )
                  : null;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border p-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.started_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${INTENSITY_COLOR[c.intensity] ?? ""}`}
                  >
                    {INTENSITY_LABEL[c.intensity] ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {dur != null ? `${dur}s` : "ativa"}
                    {interval != null && ` · intervalo ${interval}min`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
