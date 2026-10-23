import { babyForWeek, retaFinalMensagem } from "@/lib/gestacao";

/**
 * O BEBÊ DA SEMANA COMO O APP O DIZ — a tabela do site (`babyForWeek`,
 * congelada), com catorze semanas trocadas.
 *
 * ⚠️ 21/10/2026, decisão do dono: o app é rede social + gamificação, e não
 * conselho médico. Quatro descrições falavam como prontuário ("Risco de
 * aborto diminui muito", "Limite da viabilidade fetal", acompanhamento da
 * equipe) — e iam parar no cartão do bebê, na tela da semana, na festa do
 * marco e na notificação da semana nova. Viram um fato do bebê.
 *
 * A da semana 20 ("Você já pode sentir os movimentos!") saiu na revisão das
 * aulas do 2º trimestre: ela marca um prazo para as mexidinhas, e quem ainda
 * não sente nada na 20 lê ali um sinal. Movimento é encanto, nunca régua — o
 * que preocupa mora no SOS. Fica o fato que a tabela não explicava: o salto de
 * 15,3 para 25,6 cm é a medida passando a ser da cabeça aos pés.
 *
 * A da semana 28 ("Sonha em REM") afirma o que ninguém sabe — e a aula da
 * semana 25 ensina justamente isso: os olhinhos correm debaixo das pálpebras,
 * mas se o bebê sonha, ninguém pode dizer. Fica o fato da semana: os olhos,
 * que começaram a abrir na 26, já abrem e fecham.
 *
 * Da 34 à 40, preparando as aulas do 3º trimestre: a tabela falava a língua do
 * prontuário ("Pulmões quase prontos", "Posição cefálica se define", "termo
 * precoce", "Encaixe pélvico", "Termo completo!") e, na 40, chamava o bebê de
 * "dele". Viram um fato do bebê, como as quatro da fase 1. A da 32 ("Unhas dos
 * pés se formam") dava como estreia o que vem de semanas — o mesmo engano do
 * soluço apresentado como novidade da 23.
 *
 * A troca casa pelo TEXTO do site, e não pela semana: `babyForWeek` prende a
 * semana entre 4 e 42, então a 43 devolve o texto da 42 — e a troca vale para
 * ela também. A catraca do teste confere que o texto do site ainda é o trocado.
 */
export const DESCRICAO_NO_APP: Readonly<Record<number, { site: string; app: string }>> = {
  12: {
    site: "Reflexos surgem. Risco de aborto diminui muito.",
    app: "Reflexos surgem: os dedinhos já abrem e fecham.",
  },
  20: {
    site: "Você já pode sentir os movimentos!",
    app: "Metade do caminho — e agora medido da cabeça aos pés.",
  },
  24: {
    site: "Limite da viabilidade fetal.",
    app: "Está ganhando peso e ficando mais forte a cada dia.",
  },
  28: {
    site: "Sonha em REM. Início do 3º trimestre.",
    app: "Início do 3º trimestre: os olhinhos já abrem e fecham.",
  },
  32: {
    site: "Unhas dos pés se formam.",
    app: "As unhas dos pés já estão formadinhas.",
  },
  34: {
    site: "Pulmões quase prontos.",
    app: "Os rins vão completando seus filtrinhos.",
  },
  35: {
    site: "Posição cefálica se define.",
    app: "A pele fica mais madura e resistente.",
  },
  36: {
    site: "Considerado a termo precoce em breve.",
    app: "A cartilagem das orelhinhas fica mais firme.",
  },
  37: {
    site: "Termo precoce — pulmões prontos.",
    app: "A cabeça já é cerca de um quarto do corpinho.",
  },
  38: {
    site: "Encaixe pélvico em muitos casos.",
    app: "As bochechas ficam redondinhas.",
  },
  39: {
    site: "Termo completo!",
    app: "A penugem do corpinho quase toda já caiu.",
  },
  40: {
    site: "Pronto para chegar a qualquer momento — no tempo dele.",
    app: "No tempo do bebê, o encontro de vocês se aproxima.",
  },
  41: {
    site: "Termo tardio — acompanhamento mais de pertinho, tudo sob cuidado.",
    app: "Aproveitando os últimos dias de colinho aí dentro.",
  },
  42: {
    site: "Reta final — o bem-estar do bebê é acompanhado de perto pela sua equipe.",
    app: "Reta final — o encontro de vocês está pertinho.",
  },
};

export function bebeDaSemana(semana: number) {
  const b = babyForWeek(semana);
  const troca = Object.values(DESCRICAO_NO_APP).find((t) => t.site === b.desc);
  return troca ? { ...b, desc: troca.app } : b;
}

/**
 * A mensagem da reta final (40 a 42+ semanas) sem exame nem conduta: a do
 * site citava cardiotocografia, avaliação do líquido e a indução. Fica a parte
 * que acolhe; a das 40 semanas já era só isso e segue igual.
 */
export function retaFinalNoApp(semanas: number) {
  const r = retaFinalMensagem(semanas);
  if (!r || semanas < 41) return r;
  if (semanas < 42)
    return {
      ...r,
      corpo:
        "É super comum, principalmente na primeira gestação, o bebê chegar depois das 40 semanas — nada de errado com você. Você e seu bebê estão sendo bem cuidados.",
    };
  return {
    ...r,
    corpo:
      "Falta pouquíssimo para vocês se encontrarem — e isso não é sinal de problema. Seu corpo está no tempo dele.",
  };
}
