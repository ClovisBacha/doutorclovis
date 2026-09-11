/**
 * PESO, PRESSÃO E GLICEMIA — a terceira tela clínica a sair de
 * `minha-conta.tsx`, e a mais consequente das três.
 *
 * ⚠️ É por esta tabela que os números que ela mede em casa chegam ao painel do
 * médico (`health_logs` é uma das onze fontes de `clinical_events`), e é o
 * único lugar do app da paciente com CONDUTA sobre a pressão: a
 * `vozDaPaciente` do último valor grave diz "repita em 5 minutos, sentada… e
 * ligue para o seu médico agora".
 *
 * E ela não era fotografável. Enquanto o bloco morava dentro do arquivo de
 * ROTA isso não tinha conserto: uma bancada precisaria importá-lo, e exportar
 * de um arquivo de rota põe o código no pedaço da árvore de rotas que TODA
 * página do site carrega (`rotas-sem-export-solto`).
 *
 * ⚠️ **É UM MOVE, e nada mais.** O corpo é byte a byte o que estava em
 * produção — conferido por SHA-256. A única mudança de assinatura é a prop
 * `bancada`, e ela injeta o DADO nos mesmos `useState` da produção.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/campo";
import { iomGain } from "@/lib/curva-de-ganho";
import { NaoConsegueLer } from "@/components/nao-consegui-ler";
import { supabase } from "@/integrations/supabase/client";
import { triggerAchievementsCheck } from "@/lib/checar-conquistas";
import { computeGestation } from "@/lib/gestacao";
import { sinalGlicemia, sinalPressao, validaRegistro, vozDaPaciente } from "@/lib/sinais-clinicos";
/* ⚠️ `import type` — o tipo é apagado na compilação, então isto NÃO cria
   dependência de tempo de execução com o arquivo de rota. Mesmo caminho de
   `silencio-do-cuidado.tsx` e `kicks-tab.tsx`. */
import type { Gest, Profile } from "@/routes/_authenticated/minha-conta";

/**
 * AS CORES DOS GRÁFICOS, E POR QUE ELAS SÃO CONSTANTES NOMEADAS.
 *
 * ⚠️ **A FAIXA DO IOM E O PESO DELA TINHAM A MESMA COR.** Os três elementos do
 * gráfico de ganho — o corredor preenchido, as duas linhas tracejadas e a
 * linha do peso dela — eram todos `var(--primary)`, e o texto do cartão
 * prometia, com todas as letras, **"Faixa recomendada em verde"**. A paciente
 * lia a legenda, procurava uma faixa verde e encontrava tudo rosa: duas
 * identidades ("o seu peso" e "a zona saudável") pintadas da mesma cor, com a
 * tela afirmando o contrário do que desenhava.
 *
 * Cor de LINHA é identidade — a régua que o prontuário já aplica. A faixa é
 * referência e fica verde (a família da própria aba Saúde); a série é dela e
 * fica no rosa da marca.
 *
 * ⚠️ **E OS NÚMEROS DE LIMITE ERAM ILEGÍVEIS.** Medido a 393px: `140`
 * (sistólica), `90` (diastólica), `95` e `140` (glicemia) saíam a **5,44px
 * reais** e o eixo do IOM a 6,22 — contra o piso de 13px que o app inteiro
 * aplicou em set/2026. Eles escaparam daquela varredura porque texto dentro de
 * `<svg>` não usa classe do Tailwind: o tamanho vem do atributo `font-size`,
 * em unidades do `viewBox`.
 *
 * ⚠️ Os tons `-400` ficavam para a LINHA (ela é um tracejado de referência, e
 * discreto está certo); quem precisa de contraste é o NÚMERO que a nomeia, e
 * ele passou para o `-700` da mesma família — a associação continua sendo o
 * matiz.
 */
const COR = {
  faixaIom: "#047857",
  sistolica: "#f87171",
  sistolicaTexto: "#b91c1c",
  diastolica: "#60a5fa",
  diastolicaTexto: "#1d4ed8",
  glicemiaOk: "#4ade80",
  glicemiaOkTexto: "#15803d",
  glicemiaAlta: "#fb923c",
  glicemiaAltaTexto: "#c2410c",
} as const;

/**
 * O tamanho do texto DENTRO dos gráficos, em unidades do `viewBox` de 400.
 *
 * ⚠️ Não é um número de estilo: a 393px de tela o SVG é desenhado com ~311px,
 * ou seja uma escala de ~0,78 — então 16 unidades viram ~12,4px reais, que é o
 * piso de leitura do app. Mexer na largura do `viewBox` sem mexer aqui faz o
 * rótulo voltar a encolher sem ninguém ver.
 */
const FONTE_DO_GRAFICO = 16;

/** A linha de `health_logs` que esta tela desenha. */
export type HealthLog = {
  id: string;
  log_date: string;
  weight_kg: number | null;
  systolic: number | null;
  diastolic: number | null;
  glucose_mg_dl: number | null;
  spo2: number | null;
  heart_rate_bpm: number | null;
  steps: number | null;
  sleep_hours: number | null;
  notes: string | null;
};

export function HealthTab({
  gest,
  profile,
  onNavigate,
  careMode,
  bancada,
}: {
  gest: Gest;
  profile: Profile | null;
  /* A sub-tela viaja junto — é ela que abre a linha do tempo direto, e não a
     grade. `goToTab` já aceita os dois argumentos. */
  onNavigate: (tab: string, sub?: string) => void;
  /**
   * ⚠️ **A CURVA DE GANHO SAI NO MODO CUIDADO, E O RESTO DA TELA FICA.**
   *
   * Esta era a única tela clínica do hub da Saúde que não recebia o portão —
   * as quatro vizinhas (Registros, Nutrição, Bem-estar, Pós-parto) já
   * recebiam. O que ela desenhava para quem acabou de perder a gestação era a
   * "Curva de ganho de peso (IOM 2009)": o corredor projetado até a 40ª
   * semana, ou seja, o desenho de uma gestação que vai continuar.
   *
   * ⚠️ **Peso, ganho, pressão, glicemia, os dois gráficos, o formulário e a
   * lista FICAM INTEIROS** — é o corpo dela, e hipertensão de puerpério
   * existe. O Modo Cuidado faz o app parar de FALAR DO BEBÊ, nunca de medir a
   * paciente. É a mesma linha que o Portal Pós-parto traça ao manter a EPDS e
   * o retorno e tirar as três telas que falam do bebê.
   *
   * ⚠️ E o CONVITE para configurar altura e peso pré-gestacional sai junto: ele
   * existe só para destravar a curva, e oferecer o caminho para um gráfico que
   * não vai aparecer é pior que não oferecer nada.
   */
  careMode?: boolean;
  /**
   * ⚠️ A bancada injeta o DADO nos MESMOS `useState` da produção, nunca um
   * desenho à parte — e com a mesma FORMA das props, porque uma bancada que
   * passa props diferentes mede um app que não existe.
   */
  bancada?: { logs?: HealthLog[]; instavel?: boolean };
}) {
  const [logs, setLogs] = useState<HealthLog[]>(bancada?.logs ?? []);
  /** A leitura FALHOU — não é o mesmo que ela nunca ter registrado. */
  const [instavel, setInstavel] = useState(bancada?.instavel ?? false);
  /* Booleano, e nunca o objeto: um literal remontado a cada render faria os
     efeitos re-rodarem em toda pintura. */
  const ehBancada = !!bancada;
  /**
   * Qual linha do histórico está aberta para correção.
   *
   * ⚠️ **O QUE HAVIA AQUI ERA UM `×` DE 8×18 PIXELS QUE APAGAVA NA HORA.**
   * Medido a 393px: o alvo do glifo, sem caixa nenhuma, num botão que apaga
   * peso, pressão ou glicemia do prontuário — sem passo nenhum entre o toque e
   * o sumiço. As duas abas irmãs (chutes e contrações) resolveram isto em
   * set/2026 com o padrão que está aqui: a linha ABRE, e o apagar mora dentro
   * dela, com 44px e com o texto dizendo o que apagar.
   *
   * ⚠️ E o conserto NÃO é esticar o `×` com `after:-inset`: medido no chá de
   * bebê, um alvo maior que a folga entre as linhas encavala a caixa da linha
   * de baixo e o toque apaga o ITEM ERRADO. Aqui a folga entre centros é de
   * 62px — o `-inset` até caberia —, mas o padrão da casa resolve também a
   * ausência de confirmação, que é a metade mais cara do defeito.
   */
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    weight_kg: "",
    systolic: "",
    diastolic: "",
    glucose_mg_dl: "",
    spo2: "",
    heart_rate_bpm: "",
    steps: "",
    sleep_hours: "",
    notes: "",
  });
  /* `showWearable` saiu junto com o bloco que ele abria. Os campos do
     formulário (`form.spo2` e companhia) continuam no estado e no `payload`:
     o INSERT segue aceitando as colunas, e um registro antigo aberto para
     correção não perde os valores por passar por aqui. */

  /**
   * ⚠️ "NÃO CONSEGUI LER" TINHA A CARA DE "VOCÊ NUNCA REGISTROU NADA" — e esta
   * é a OITAVA tela da mesma classe, na mais clínica do app.
   *
   * O PostgREST resolve com `{ data: null, error }` numa falha e NÃO lança, e
   * `data ?? []` transformava isso na tela de quem acabou de instalar o app:
   * "Último peso —", "Ganho total —", "Última PA —", "Glicemia —", os TRÊS
   * gráficos somem (`length < 2 → return null`) e a lista afirma "Você ainda
   * não registrou nada." sobre meses de medição.
   *
   * ⚠️ E o pior caso não é a abertura: é o RE-READ. `add()` e `remove()`
   * terminam chamando `load()`. Ela mede 158/98 às onze da noite, registra, o
   * formulário limpa — e a tela que ela estava lendo vira quatro traços com os
   * gráficos sumindo. A leitura razoável é "não gravou" ou "o app apagou tudo",
   * e as duas levam a registrar de novo: `health_logs` não tem chave única por
   * dia, então a duplicata entra em `clinical_events` e o médico vê duas.
   *
   * ⚠️ Some-se a isso que o cartão da PA é o único lugar desta tela com
   * conduta (`vozDaPaciente` do último valor grave: "Repita em 5 minutos,
   * sentada… ligue para o seu médico agora"). Com a lista vazia, some.
   */
  async function load() {
    const { data, error } = await (supabase as any)
      .from("health_logs")
      .select("*")
      .order("log_date", { ascending: false })
      .limit(60);
    if (error) {
      /* ⚠️ NÃO zera a lista. Se havia registros na tela, eles continuam ali —
         o defeito era justamente apagá-los sobre uma falha de rede. */
      setInstavel(true);
      return;
    }
    setInstavel(false);
    setLogs(data ?? []);
  }
  useEffect(() => {
    if (ehBancada) return;
    load();
  }, [ehBancada]);

  async function add() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    if (
      !form.weight_kg &&
      !form.systolic &&
      !form.diastolic &&
      !form.glucose_mg_dl &&
      !form.spo2 &&
      !form.heart_rate_bpm &&
      !form.steps &&
      !form.sleep_hours &&
      !form.notes
    ) {
      toast.error("Preencha ao menos um campo para registrar.");
      return;
    }
    /* VALIDAÇÃO ANTES DE GRAVAR — e agora o banco também recusa.

       Marcar o número impossível na LEITURA conserta a tela; não conserta o
       prontuário. E com os CHECKs aplicados, sem esta checagem aqui o insert
       volta erro e a paciente lê "Erro ao salvar. Tente novamente." — conselho
       errado, porque repetir o mesmo número falha para sempre. */
    const erroFaixa = validaRegistro({
      weight_kg: form.weight_kg,
      systolic: form.systolic,
      diastolic: form.diastolic,
      glucose_mg_dl: form.glucose_mg_dl,
      spo2: form.spo2,
      heart_rate_bpm: form.heart_rate_bpm,
      steps: form.steps,
      sleep_hours: form.sleep_hours,
    });
    if (erroFaixa) {
      toast.error(erroFaixa);
      return;
    }

    // Envia apenas os campos preenchidos (colunas extras podem não existir
    // no banco ainda sem as migrations pendentes) e a data local do navegador.
    const payload: Record<string, unknown> = {
      user_id: u.user.id,
      log_date: new Date().toLocaleDateString("en-CA"),
    };
    if (form.weight_kg !== "") payload.weight_kg = Number(String(form.weight_kg).replace(",", "."));
    if (form.systolic !== "") payload.systolic = Number(String(form.systolic).replace(",", "."));
    if (form.diastolic !== "") payload.diastolic = Number(String(form.diastolic).replace(",", "."));
    if (form.glucose_mg_dl !== "")
      payload.glucose_mg_dl = Number(String(form.glucose_mg_dl).replace(",", "."));
    if (form.spo2 !== "") payload.spo2 = Number(String(form.spo2).replace(",", "."));
    if (form.heart_rate_bpm !== "")
      payload.heart_rate_bpm = Number(String(form.heart_rate_bpm).replace(",", "."));
    if (form.steps !== "") payload.steps = Number(String(form.steps).replace(",", "."));
    if (form.sleep_hours !== "")
      payload.sleep_hours = Number(String(form.sleep_hours).replace(",", "."));
    if (form.notes) payload.notes = form.notes;
    const { error } = await (supabase as any).from("health_logs").insert(payload);
    if (error) {
      /* ⚠️ O DEPLOY CHEGA ANTES DO SQL. Nessa janela o app já aceita o número
         (os tetos de plausibilidade saíram) e o banco ainda o recusa pelo CHECK
         antigo — 23514. "Tente novamente" é conselho errado aqui: o número dela
         está certo, e repetir falha para sempre. */
      const codigo = (error as { code?: string }).code;
      toast.error(
        codigo === "23514"
          ? "O número está certo, mas o banco do app ainda não aceita esse valor. Já estamos ajustando — anote e mostre ao seu médico na consulta."
          : "Erro ao salvar o registro. Tente novamente.",
      );
      return;
    }
    triggerAchievementsCheck();
    setForm({
      weight_kg: "",
      systolic: "",
      diastolic: "",
      glucose_mg_dl: "",
      spo2: "",
      heart_rate_bpm: "",
      steps: "",
      sleep_hours: "",
      notes: "",
    });
    load();
  }
  async function remove(id: string) {
    const { error } = await (supabase as any).from("health_logs").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir o registro. Tente novamente.");
      return;
    }
    /* Fecha a linha só depois de o banco confirmar: fechar antes diria "pronto"
       sobre uma exclusão que não aconteceu. */
    setAbertoId(null);
    load();
  }

  const last = logs[0];
  const allWeightLogs = logs.filter((l) => l.weight_kg != null).reverse();
  const weights = allWeightLogs.slice(-12);

  // Stats
  const firstWeight = allWeightLogs[0]?.weight_kg ? Number(allWeightLogs[0].weight_kg) : null;
  const lastWeight = allWeightLogs[allWeightLogs.length - 1]?.weight_kg
    ? Number(allWeightLogs[allWeightLogs.length - 1].weight_kg)
    : null;

  /* A MESMA RÉGUA DO PAINEL DO MÉDICO.

     Aqui havia uma cópia inline dos cortes. Os números batiam por sorte, mas as
     GUARDAS não existiam: "0/0" saía como "PA normal" em verde (e o número ao
     lado saía como "—", porque aquele teste é truthy — o mesmo card afirmava
     duas coisas incompatíveis), e pressão de pulso zero também passava. Uma
     régua só, duas vozes: a gravidade vem de `sinalPressao`, o texto de ação
     vem de `vozDaPaciente`. */
  const lastBp = logs.find((l) => l.systolic != null && l.diastolic != null);
  const bpSinal = sinalPressao(lastBp?.systolic, lastBp?.diastolic);
  const bpVoz = vozDaPaciente(bpSinal);
  const bpStatus = bpSinal
    ? {
        label: bpSinal.gravidade === "normal" ? "PA normal" : bpSinal.nota,
        color:
          bpSinal.gravidade === "grave"
            ? "rose"
            : bpSinal.gravidade === "atencao"
              ? "amber"
              : "emerald",
        orientacao: bpVoz?.orientacao ?? null,
      }
    : null;

  // IOM weight curve — Feature #9
  const prePregW = profile?.pre_pregnancy_weight_kg
    ? Number(profile.pre_pregnancy_weight_kg)
    : null;
  const heightM = profile?.height_cm ? profile.height_cm / 100 : null;
  const bmi = prePregW && heightM ? prePregW / (heightM * heightM) : null;

  /**
   * ⚠️ **"GANHO TOTAL" NÃO ERA O GANHO TOTAL.**
   *
   * Ele era o último peso menos o PRIMEIRO DA LISTA — e a lista é cortada em
   * sessenta registros. Duas coisas erradas de uma vez:
   *
   *   · **A base estava errada.** O ganho da gestação se conta a partir do
   *     peso PRÉ-GESTACIONAL, que está no perfil e que esta mesma tela já lê
   *     para desenhar a curva do IOM vinte linhas abaixo. Medido na bancada:
   *     com 62 kg de partida e 69,2 hoje, o cartão dizia **+2,7 kg** onde o
   *     ganho é **+7,2** — quatro quilos e meio a menos, no número que decide
   *     se ela está dentro do corredor de ganho.
   *   · **E a base DESLIZAVA.** Passados sessenta registros o primeiro da
   *     janela vai embora, e o "ganho total" ENCOLHE sozinho, sem ela ter
   *     feito nada.
   *
   * ⚠️ E quando não há peso pré-gestacional o cartão NÃO chuta: ele muda o
   * RÓTULO para "Ganho desde o 1º registro", que é o que aquele número
   * realmente é. Trocar a palavra é mais honesto que trocar a conta.
   */
  const baseDoGanho = prePregW ?? firstWeight;
  const ganhoDesdeOInicio = prePregW != null;
  const totalGain =
    baseDoGanho != null && lastWeight != null ? (lastWeight - baseDoGanho).toFixed(1) : null;

  // Map each weight log to gestational week at that date
  type WeightPoint = { week: number; weight: number };
  const weightByWeek: WeightPoint[] = [];
  if (bmi != null && prePregW != null) {
    allWeightLogs.forEach((l) => {
      const g = computeGestation({
        lmp: profile?.lmp_date,
        referenceDate: profile?.reference_date,
        referenceWeeks: profile?.reference_weeks,
        referenceDays: profile?.reference_days,
        today: new Date(l.log_date + "T00:00:00"),
      });
      if (g && g.weeks >= 0 && g.weeks <= 42 && l.weight_kg) {
        weightByWeek.push({ week: g.weeks, weight: Number(l.weight_kg) });
      }
    });
  }

  // Build SVG IOM chart
  const showIomChart = !careMode && bmi != null && prePregW != null && weightByWeek.length > 0;
  const iomChartW = 400,
    iomChartH = 180;
  let iomMinY: number, iomMaxY: number;
  if (showIomChart) {
    const corridor = [0, 10, 20, 30, 40].map((w) => {
      const g = iomGain(w, bmi!);
      return { min: prePregW! + g.min, max: prePregW! + g.max };
    });
    const allY = [...corridor.flatMap((c) => [c.min, c.max]), ...weightByWeek.map((p) => p.weight)];
    iomMinY = Math.min(...allY) - 1;
    iomMaxY = Math.max(...allY) + 1;
  } else {
    iomMinY = 50;
    iomMaxY = 90;
  }
  const yRange = Math.max(iomMaxY - iomMinY, 1);

  function toSvgX(week: number) {
    return (week / 42) * iomChartW;
  }
  function toSvgY(w: number) {
    /* ⚠️ A folga de baixo é a FAIXA DO EIXO, e ela cresceu junto com a fonte:
       com 10 unidades o rótulo de 16 passava por cima da curva. */
    return iomChartH - ((w - iomMinY) / yRange) * (iomChartH - 34) - 24;
  }

  const bandMinPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).min)}`,
  ).join(" ");
  const bandMaxPts = Array.from(
    { length: 43 },
    (_, i) => `${toSvgX(i)},${toSvgY(prePregW! + iomGain(i, bmi!).max)}`,
  ).join(" ");
  const bandPolygon =
    bandMinPts +
    " " +
    Array.from(
      { length: 43 },
      (_, i) => `${toSvgX(42 - i)},${toSvgY(prePregW! + iomGain(42 - i, bmi!).max)}`,
    ).join(" ");
  const actualPts = weightByWeek.map((p) => `${toSvgX(p.week)},${toSvgY(p.weight)}`).join(" ");

  const bmiLabel =
    bmi == null
      ? null
      : bmi < 18.5
        ? "abaixo do peso"
        : bmi < 25
          ? "peso normal"
          : bmi < 30
            ? "sobrepeso"
            : "obesidade";

  /* ⚠️ A ORDEM É O CONSERTO: a falha vem ANTES do vazio. Trocadas, quem
     registra há meses lê quatro traços e "Você ainda não registrou nada." */
  if (instavel && logs.length === 0)
    return (
      <NaoConsegueLer
        oQue="os seus registros"
        sossego="Tudo o que você anotou continua salvo, e o seu médico continua vendo."
        aoTentar={() => void load()}
      />
    );

  return (
    <div className="space-y-6">
      {/*
        ⚠️ A FAIXA DO CASO QUE MAIS ENGANA: a leitura falhou E havia dados na
        tela. `load()` não zera mais a lista, então o que ela vê são os últimos
        números que deram certo — e isso é honesto até o instante em que ela
        SALVA um registro novo, porque o re-read falha e o número novo não
        aparece. Sem esta linha, a conclusão razoável é "não gravou", e ela
        registra de novo: `health_logs` não tem chave única por dia, e a
        duplicata vai para o prontuário que o médico lê.
      */}
      {instavel && logs.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-semibold text-amber-900">Não consegui atualizar agora</p>
          <p className="mt-1 text-amber-900/80">
            Estes são os últimos números que consegui ler. Se você acabou de anotar algo, ele foi
            salvo — só ainda não apareceu aqui. Não registre de novo.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="press mt-3 h-11 rounded-full border border-amber-300 bg-white px-4 font-semibold text-amber-900"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
        <div className="press glass-card glass-emerald rounded-3xl p-5">
          <p className="font-serif text-[15px] font-semibold text-emerald-800">⚖️ Último peso</p>
          <p className="mt-2 font-serif text-3xl">
            {last?.weight_kg ? `${last.weight_kg} kg` : "—"}
          </p>
        </div>
        <div className="press glass-card glass-teal rounded-3xl p-5">
          <p className="font-serif text-[15px] font-semibold text-teal-800">
            📈 {ganhoDesdeOInicio ? "Ganho total" : "Ganho desde o 1º registro"}
          </p>
          <p className="mt-2 font-serif text-3xl">
            {totalGain != null ? `${Number(totalGain) > 0 ? "+" : ""}${totalGain} kg` : "—"}
          </p>
        </div>
        <div
          className={`press rounded-3xl p-5 ${bpStatus?.color === "rose" ? "glass-card glass-rose" : bpStatus?.color === "amber" ? "glass-card glass-amber" : "glass-card glass-blue"}`}
        >
          <p
            className={`font-serif text-[15px] font-semibold ${bpStatus?.color === "rose" ? "text-rose-700" : bpStatus?.color === "amber" ? "text-amber-800" : "text-blue-800"}`}
          >
            🩺 Última PA
          </p>
          <p className="mt-2 font-serif text-3xl">
            {lastBp?.systolic != null && lastBp?.diastolic != null
              ? `${lastBp.systolic}/${lastBp.diastolic}`
              : "—"}
          </p>
          {bpStatus && (
            <p
              className={`mt-1 text-xs font-medium ${bpStatus.color === "rose" ? "text-rose-800" : bpStatus.color === "amber" ? "text-amber-900" : "text-emerald-800"}`}
            >
              {bpStatus.label}
            </p>
          )}
          {/* A etiqueta sozinha é meia informação. "PA muito elevada" sem o que
              fazer produz susto às 23h; com a próxima ação, produz conduta. */}
          {bpStatus?.orientacao && (
            <p className="mt-1 text-xs leading-snug text-muted-foreground">{bpStatus.orientacao}</p>
          )}
        </div>
        {(() => {
          const lastGlucose = logs.find((l) => l.glucose_mg_dl != null);
          const gv = lastGlucose?.glucose_mg_dl;
          /* A escala antiga só olhava para CIMA: 35 mg/dL — neuroglicopenia —
             saía rotulado "Normal", em verde, enquanto o painel do médico dizia
             "Glicemia muito baixa". Não era falta de alerta, era o alerta
             invertido, e para uma gestante em insulina isso é a diferença entre
             comer agora e desmaiar. Mesma função do painel. */
          const gSinal = sinalGlicemia(gv);
          const gVoz = vozDaPaciente(gSinal, "glicemia");
          const gColor =
            gSinal == null
              ? null
              : gSinal.gravidade === "grave"
                ? "rose"
                : gSinal.gravidade === "atencao"
                  ? "amber"
                  : "emerald";
          const gLabel =
            gSinal == null ? null : gSinal.gravidade === "normal" ? "Normal" : gSinal.nota;
          return (
            <div
              className={`press rounded-3xl p-5 ${gColor === "rose" ? "glass-card glass-rose" : gColor === "amber" ? "glass-card glass-amber" : "glass-card glass-sky"}`}
            >
              <p
                className={`font-serif text-[15px] font-semibold ${gColor === "rose" ? "text-rose-700" : gColor === "amber" ? "text-amber-800" : "text-sky-800"}`}
              >
                🍬 Glicemia
              </p>
              <p className="mt-2 font-serif text-3xl">{gv != null ? `${gv} mg/dL` : "—"}</p>
              {gLabel && (
                <p
                  className={`mt-1 text-xs font-medium ${gColor === "rose" ? "text-rose-800" : gColor === "amber" ? "text-amber-900" : "text-emerald-800"}`}
                >
                  {gLabel}
                </p>
              )}
              {gVoz?.orientacao && (
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{gVoz.orientacao}</p>
              )}
            </div>
          );
        })()}
        {/* ─── O CARTÃO DE SpO₂ / FC SAIU (ago/2026) ────────────────────────
            Ele mostrava o que a paciente tinha DIGITADO À MÃO, copiando do
            Apple Health. Saiu junto com o formulário que o alimentava, e a
            razão é a mesma: SpO₂, frequência, passos e sono não mudam conduta
            obstétrica. Era o pior formato possível de recurso — trabalho dela,
            decisão de ninguém —, ocupando um dos cinco lugares mais visíveis
            da tela mais clínica do app.

            Os valores JÁ REGISTRADOS não sumiram: as colunas continuam em
            `health_logs`, aparecem na lista de correção mais abaixo e seguem
            para o `clinical_events` que o médico lê. Parar de pedir é uma
            decisão; apagar o que ela já mandou seria outra. */}
      </div>

      {/* IOM weight corridor chart — Feature #9 */}
      {showIomChart ? (
        <div className="rounded-3xl card-material p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-serif text-[15px] font-semibold text-primary">
                Curva de ganho de peso (IOM 2009)
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                IMC pré-gestacional: {bmi!.toFixed(1)} ({bmiLabel}) · Faixa recomendada em verde
              </p>
            </div>
          </div>
          <svg viewBox={`0 0 ${iomChartW} ${iomChartH}`} className="mt-3 h-44 w-full">
            {/* Corridor band */}
            <polygon points={bandPolygon} fill={COR.faixaIom} fillOpacity="0.12" />
            {/* Min line */}
            <polyline
              points={bandMinPts}
              fill="none"
              stroke={COR.faixaIom}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.55"
            />
            {/* Max line */}
            <polyline
              points={bandMaxPts}
              fill="none"
              stroke={COR.faixaIom}
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.55"
            />
            {/* Actual weight line */}
            {weightByWeek.length > 1 && (
              <polyline
                points={actualPts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            )}
            {/* Data points */}
            {weightByWeek.map((p, i) => (
              <circle
                key={i}
                cx={toSvgX(p.week)}
                cy={toSvgY(p.weight)}
                r="4"
                fill="var(--primary)"
              />
            ))}
            {/* X-axis labels */}
            {/* ⚠️ DE DEZ EM DEZ, e não `[0,10,20,28,36,40]`: com a fonte
                legível (era 5,4px) os rótulos 36 e 40 encostavam um no outro —
                a lista antiga só cabia porque ninguém conseguia lê-la. */}
            {[0, 10, 20, 30, 40].map((w) => (
              <text
                key={w}
                /* ⚠️ **O "0s" SAÍA PELA BORDA.** Com `textAnchor="middle"` e
                   `toSvgX(0) === 0`, metade do rótulo fica fora do `viewBox` —
                   medido: `left: -3`, e na foto sobrava só o "s". O piso e o
                   teto são meia largura do rótulo. */
                x={Math.min(Math.max(toSvgX(w), 14), iomChartW - 14)}
                y={iomChartH - 2}
                fontSize={FONTE_DO_GRAFICO}
                fill="var(--muted-foreground)"
                textAnchor="middle"
              >
                {w}s
              </text>
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted-foreground">
            Linha sólida = seu peso · Faixa = zona saudável para seu IMC. Configure altura e peso
            pré-gestacional em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>
            .
          </p>
        </div>
      ) : (
        !careMode &&
        prePregW == null && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
            Configure sua <strong>altura</strong> e <strong>peso pré-gestacional</strong> em{" "}
            <button
              type="button"
              onClick={() => onNavigate("Perfil")}
              className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
            >
              Perfil
            </button>{" "}
            para ver a curva de ganho de peso recomendada pelo IOM.
          </div>
        )
      )}

      {/* Gráfico histórico de PA */}
      {(() => {
        const bpHistory = logs
          .filter((l) => l.systolic != null && l.diastolic != null)
          .reverse()
          .slice(-15);
        if (bpHistory.length < 2) return null;
        const W = 400,
          H = 140;
        const allY = bpHistory.flatMap((l) => [l.systolic!, l.diastolic!]);
        const minY = Math.min(...allY, 50) - 5;
        const maxY = Math.max(...allY, 160) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (bpHistory.length - 1)) * (W - 20);
        const systPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.systolic!)}`).join(" ");
        const diasPts = bpHistory.map((l, i) => `${sx(i)},${sy(l.diastolic!)}`).join(" ");
        return (
          <div className="rounded-3xl card-material p-6">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Histórico de pressão arterial
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Linha vermelha = sistólica · Linha azul = diastólica · Limite em tracejado
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-36 w-full">
              {/* threshold 140 sistólica */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke={COR.sistolica}
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(140) - 5} fontSize={FONTE_DO_GRAFICO} fill={COR.sistolicaTexto}>
                140
              </text>
              {/* threshold 90 diastólica */}
              <line
                x1="10"
                y1={sy(90)}
                x2={W - 10}
                y2={sy(90)}
                stroke={COR.diastolica}
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.6"
              />
              <text x="12" y={sy(90) - 5} fontSize={FONTE_DO_GRAFICO} fill={COR.diastolicaTexto}>
                90
              </text>
              <polyline
                points={systPts}
                fill="none"
                stroke={COR.sistolica}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <polyline
                points={diasPts}
                fill="none"
                stroke={COR.diastolica}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {bpHistory.map((l, i) => (
                <g key={i}>
                  <circle cx={sx(i)} cy={sy(l.systolic!)} r="3.5" fill={COR.sistolica} />
                  <circle cx={sx(i)} cy={sy(l.diastolic!)} r="3.5" fill={COR.diastolica} />
                </g>
              ))}
            </svg>
          </div>
        );
      })()}

      {/* Gráfico histórico de glicemia */}
      {(() => {
        const glHistory = logs
          .filter((l) => l.glucose_mg_dl != null)
          .reverse()
          .slice(-15);
        if (glHistory.length < 2) return null;
        const W = 400,
          H = 130;
        const allY = glHistory.map((l) => l.glucose_mg_dl!);
        const minY = Math.min(...allY, 70) - 5;
        const maxY = Math.max(...allY, 180) + 5;
        const sy = (v: number) => H - 10 - ((v - minY) / (maxY - minY)) * (H - 20);
        const sx = (i: number) => 10 + (i / (glHistory.length - 1)) * (W - 20);
        const pts = glHistory.map((l, i) => `${sx(i)},${sy(l.glucose_mg_dl!)}`).join(" ");
        return (
          <div className="rounded-3xl card-material p-6">
            <p className="font-serif text-[15px] font-semibold text-primary">
              Histórico de glicemia
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Referência em jejum: &lt; 95 mg/dL · Pós-prandial: &lt; 140 mg/dL
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-32 w-full">
              {/* zona verde < 95 */}
              <rect
                x="10"
                y={sy(95)}
                width={W - 20}
                height={sy(minY) - sy(95)}
                fill={COR.glicemiaOk}
                opacity="0.08"
              />
              <line
                x1="10"
                y1={sy(95)}
                x2={W - 10}
                y2={sy(95)}
                stroke={COR.glicemiaOk}
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(95) - 5} fontSize={FONTE_DO_GRAFICO} fill={COR.glicemiaOkTexto}>
                95
              </text>
              {/* threshold 140 */}
              <line
                x1="10"
                y1={sy(140)}
                x2={W - 10}
                y2={sy(140)}
                stroke={COR.glicemiaAlta}
                strokeWidth="1"
                strokeDasharray="4 3"
                opacity="0.7"
              />
              <text x="12" y={sy(140) - 5} fontSize={FONTE_DO_GRAFICO} fill={COR.glicemiaAltaTexto}>
                140
              </text>
              <polyline
                points={pts}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {glHistory.map((l, i) => (
                <circle
                  key={i}
                  cx={sx(i)}
                  cy={sy(l.glucose_mg_dl!)}
                  r="3.5"
                  fill={(() => {
                    /* Terceira cópia da escala, agora removida: os pontos do
                       gráfico pintavam de verde exatamente os mesmos valores
                       baixos que o card. */
                    const g = sinalGlicemia(l.glucose_mg_dl)?.gravidade;
                    return g === "grave"
                      ? COR.sistolica
                      : g === "atencao"
                        ? COR.glicemiaAlta
                        : "var(--primary)";
                  })()}
                />
              ))}
            </svg>
          </div>
        );
      })()}

      {/* ─── O WEARABLE SAIU INTEIRO (ago/2026) ────────────────────────────
          Aqui moravam duas coisas: quatro cartões de SpO₂ / FC / Passos / Sono
          e um guia ensinando a ABRIR o Apple Health, LER os números e DIGITAR
          cada um deles aqui.

          Nenhum dos quatro muda conduta obstétrica. O que este bloco pedia era
          trabalho manual e diário da paciente para produzir um dado que nenhuma
          decisão do médico consulta — e o guia deixava isso explícito ao
          admitir que "a integração automática requer aplicativo nativo".

          Não confundir com a pressão e a glicemia, que ficam: aquelas são
          aferições que ELA faz com aparelho próprio e que entram na régua
          clínica. A diferença não é o esforço, é quem lê o resultado.

          As colunas continuam em `health_logs` e o que já foi registrado
          aparece na lista de correção — parar de pedir é uma decisão; apagar o
          que ela já mandou seria outra. */}

      {/* New log form */}
      <div className="rounded-3xl card-material p-6">
        <p className="font-serif text-lg">Novo registro</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          <Field
            label="Peso (kg)"
            type="number"
            value={form.weight_kg}
            onChange={(v) => setForm({ ...form, weight_kg: v })}
          />
          <Field
            label="Sistólica"
            type="number"
            value={form.systolic}
            onChange={(v) => setForm({ ...form, systolic: v })}
          />
          <Field
            label="Diastólica"
            type="number"
            value={form.diastolic}
            onChange={(v) => setForm({ ...form, diastolic: v })}
          />
          <Field
            label="Glicemia (mg/dL)"
            type="number"
            value={form.glucose_mg_dl}
            onChange={(v) => setForm({ ...form, glucose_mg_dl: v })}
          />
          <Field
            label="Notas"
            value={form.notes}
            onChange={(v) => setForm({ ...form, notes: v })}
          />
        </div>
        {/* Os quatro campos de wearable ficavam aqui, atrás de um botão que os
            revelava. Ver a nota acima — e note que o rótulo dele não aparece
            nem em comentário: `hub-da-saude.test.ts` procura a string no
            arquivo inteiro, e citá-la aqui reprovaria o teste que existe para
            impedir o bloco de voltar. */}
        <button
          onClick={add}
          className="mt-4 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
        >
          Adicionar
        </button>
      </div>

      {/* ─── A LISTA VIROU "CORRIGIR", E ISSO É O QUE ELA SEMPRE FOI ───────
          Ela era a TERCEIRA cópia dos mesmos números na mesma tela: cinco
          cartões dizem "como estou", os gráficos dizem "para onde isso vai", e
          a lista repetia tudo mais uma vez, crua.

          Mas apagá-la seria tirar uma capacidade, não uma repetição: é o único
          lugar com o × que apaga um registro. Quem digitou 1200 em vez de 120
          precisa dele — e num app cujo painel do médico pinta a gravidade
          desses números, um valor errado que não se pode apagar vira alarme
          falso no consultório.

          Então ela recolhe. Fechada não ocupa tela; aberta é o que a paciente
          procura quando quer arrumar alguma coisa — e o rótulo passa a dizer
          isso, em vez de fingir ser um resumo. */}
      {/* ⚠️ A PORTA DA LINHA DO TEMPO, e ela faltava dos DOIS lados.
          A linha do tempo lê cinco fontes, e TRÊS delas moram noutras abas —
          peso, pressão e glicemia são registrados AQUI. Nenhuma dessas abas
          tinha link para ela, e é por isso que ela é a função que ninguém sabe
          que existe. */}
      <button
        type="button"
        onClick={() => onNavigate("Meu dia a dia", "timeline")}
        className="press min-h-11 w-full rounded-2xl card-material px-5 py-3 text-left text-sm font-medium"
      >
        🕘 Ver a minha linha do tempo
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          tudo o que eu já registrei, em ordem
        </span>
      </button>

      <details className="rounded-2xl card-material">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium">
          ✏️ Ver e corrigir meus registros
          {logs.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({logs.length})
            </span>
          )}
        </summary>
        <div className="space-y-2 px-3 pb-3">
          {logs.length === 0 && (
            <p className="px-2 pb-1 text-sm text-muted-foreground">
              Você ainda não registrou nada.
            </p>
          )}
          {logs.map((l) => {
            const aberta = abertoId === l.id;
            return (
              <div key={l.id} className="rounded-xl border border-border bg-card">
                {/* ⚠️ A LINHA INTEIRA É O ALVO, e tocar ABRE — nunca apaga. É o
                  mesmo desenho das duas abas irmãs, e ele resolve as duas
                  metades do defeito de uma vez: o alvo minúsculo e o apagar
                  sem passo nenhum entre o dedo e o dado clínico. */}
                <button
                  type="button"
                  onClick={() => setAbertoId(aberta ? null : l.id)}
                  aria-expanded={aberta}
                  className="press flex w-full items-start justify-between gap-1 p-4 text-left text-sm"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(l.log_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex flex-1 flex-wrap gap-x-3 gap-y-0.5 px-3 text-xs">
                    {l.weight_kg && <span>⚖️ {l.weight_kg} kg</span>}
                    {l.systolic && l.diastolic && (
                      <span>
                        💓 {l.systolic}/{l.diastolic}
                      </span>
                    )}
                    {l.glucose_mg_dl && <span>🩸 {l.glucose_mg_dl} mg/dL</span>}
                    {/* Os quatro de wearable continuam aqui de propósito: o app
                    parou de PEDIR, mas quem já registrou tem de conseguir ver
                    (e apagar) o que mandou. */}
                    {l.spo2 && <span>🫁 {l.spo2}% SpO₂</span>}
                    {l.heart_rate_bpm && <span>❤️ {l.heart_rate_bpm}bpm</span>}
                    {l.steps && <span>🚶 {l.steps} passos</span>}
                    {l.sleep_hours && <span>🌙 {l.sleep_hours}h sono</span>}
                    {l.notes && <span className="text-muted-foreground">{l.notes}</span>}
                  </span>
                  <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
                    {aberta ? "▴" : "▾"}
                  </span>
                </button>
                {aberta && (
                  <div className="border-t border-border px-4 pb-4 pt-3">
                    <button
                      type="button"
                      onClick={() => void remove(l.id)}
                      className="press inline-flex min-h-11 items-center rounded-full border border-rose-300 px-4 text-xs font-semibold text-rose-800"
                    >
                      Apagar este registro
                    </button>
                    {/* ⚠️ O TEXTO DIZ O QUE NÃO APAGAR. Sem ele, o botão que
                      existe para tirar um número digitado errado tira também a
                      pressão alta que ela mediu de verdade — e é justamente
                      essa que o painel do médico pinta. */}
                    <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
                      Apague só o que não aconteceu — um número digitado errado, por exemplo. O que
                      você mediu de verdade é o que o seu médico lê.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

/* ---------- Perguntas para o médico ---------- */
