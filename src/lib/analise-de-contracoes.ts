/**
 * A RÉGUA DO CRONÔMETRO DE CONTRAÇÕES — pura, e por isso testável.
 *
 * ⚠️ **ELA MORAVA DENTRO DO COMPONENTE, e é a decisão de emergência mais
 * consequente do app da paciente:** é ela que decide se a tela mostra
 * "⚠️ Ligue para o seu médico agora" com o botão do 192. Enterrada num `.tsx`
 * que importa `sonner`, `supabase` e cinco ícones, a única forma de exercitá-la
 * era ler o FONTE e procurar palavras — e foi assim que os dois defeitos
 * abaixo sobreviveram a uma catraca que existia justamente para guardá-la.
 *
 * É a mesma lição de `assinatura.ts`, `buscar-paciente.ts`, `frases-do-mascote.ts`
 * e `gratidao.ts`: **régua pura em `lib/`, componente só desenha.**
 */
import { sinalContracoesPrematuras } from "@/lib/sinais-clinicos";

/**
 * O que o analisador precisa de uma contração. `ContracoesTab` tem um tipo
 * mais rico (id, intensity); aqui só entram os dois instantes, e é isso que
 * torna esta régua testável sem montar tela nenhuma.
 */
export type ContracaoParaAnalise = {
  started_at: string;
  ended_at: string | null;
};

export function analyzeContractions(
  list: ContracaoParaAnalise[],
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

  /* Intervalo entre o INÍCIO de uma contração e o da seguinte, em minutos.
     Sai de `list` e não de `completed`: para saber de quanto em quanto tempo
     elas vêm, basta o `started_at` — a contração em curso conta. */
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

  /**
   * ⚠️ **A MEDIANA, AO LADO DA MÉDIA — porque a média APAGA o alerta.**
   *
   * "Regular" quer dizer que o intervalo TÍPICO é curto, não que a soma
   * dividida pelo número é curta. O caso real: ela começa a cronometrar em
   * dúvida, tem um vão longo, e só depois as contrações ficam regulares —
   * intervalos [30, 5, 5, 5] dão média 11,25 e a régua (`iv <= 10`) NÃO
   * dispara, com três contrações de cinco em cinco minutos às 32 semanas. O
   * vão antigo, que é o que ela veio conferir se acabou, é justamente o que
   * segura o alerta.
   *
   * ⚠️ E o critério é o MENOR dos dois, nunca a troca de um pelo outro: assim
   * ele só pode ALARGAR o alerta, nunca estreitá-lo. Existe o caso inverso —
   * [1, 12, 12] tem média 8,3 e mediana 12 —, e antes das 37 semanas errar
   * para o lado de mandar ligar é o único lado seguro. Trocar a média pela
   * mediana teria SILENCIADO esse caso.
   */
  const ordenados = [...intervals].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const medianaIntervalo =
    ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
  const intervaloParaPrematuridade = Math.min(avgInterval, medianaIntervalo);

  /* ─── PREMATURIDADE VEM ANTES DE TUDO ────────────────────────────────────
     Antes das 37 semanas, contração regular é sinal vermelho independentemente
     de quão "leve" o padrão parece — e é justamente o padrão leve que a régua
     de trabalho de parto classificaria como normal. Por isso este teste vem
     PRIMEIRO: ele não pode ser alcançado só depois de a paciente passar pelos
     cortes de parto ativo.

     ⚠️ **E ELE VEM ANTES DO CORTE DE `completed` TAMBÉM.** A régua precisa de
     DUAS coisas — semanas e intervalo — e de nenhuma duração; ficava barrada
     por `completed.length < 2`, que exige duas contrações TERMINADAS. O caso
     que isso apagava é exatamente o do trabalho de parto prematuro: a primeira
     acabou, a segunda está EM CURSO, o intervalo entre os dois inícios já é
     conhecido, e a tela respondia "Monitorando · Continue registrando". */
  const prematuro = sinalContracoesPrematuras({
    semanas: weeks,
    intervaloMin: intervaloParaPrematuridade,
  });
  if (prematuro)
    return {
      status: "urgente",
      label: "⚠️ Ligue para o seu médico agora",
      detail: `${prematuro.nota} Contrações a cada ${intervaloParaPrematuridade.toFixed(0)} min.`,
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
