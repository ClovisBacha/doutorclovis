import { babyForWeek, retaFinalMensagem } from "@/lib/gestacao";

/**
 * O BEBÊ DA SEMANA COMO O APP O DIZ — a tabela do site (`babyForWeek`,
 * congelada), com cinco semanas trocadas.
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
