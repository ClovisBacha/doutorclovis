import { BRAIN_STARTER_PACK } from "@/lib/brain-starter-pack";
import type { EvalExpectation } from "@/lib/brain-eval";

/**
 * A SIMULAÇÃO DO SEGUNDO CÉREBRO — o ensaio seco, sem gastar nada.
 *
 * ─── POR QUE SIMULAÇÃO E NÃO TESTE GRÁTIS ───────────────────────────────────
 *
 * Decisão do dono (ago/2026): o plano Free não vai dar um teste ao vivo do
 * cérebro. Um teste ao vivo é uma chave nossa gastando por quem não paga, sem
 * teto natural — quem quisesse gastar de graça só precisava continuar
 * perguntando. A simulação mostra a mesma coisa e custa zero: tudo aqui é
 * texto local, nenhuma chamada de modelo.
 *
 * ─── E POR QUE ELA NÃO INVENTA CONDUTA ──────────────────────────────────────
 *
 * O perigo óbvio de uma demonstração é escrever uma resposta bonita e colocá-la
 * na boca de um médico. Já havia um exemplo disso no repositório: uma vitrine
 * (morta, nunca importada) trazia o balão “Posso tomar dipirona?” → “A Dra.
 * orienta que sim, na dose certa” — enquanto o kit de partida, no arquivo ao
 * lado, manda EVITAR dipirona. Duas condutas opostas, e a que aparecia para o
 * público era a errada.
 *
 * Aqui a regra é estrutural, não de bom senso: toda resposta de `cobertura` sai
 * de `BRAIN_STARTER_PACK` — o mesmo texto que seria instalado no cérebro dele.
 * Não é uma resposta parecida com a que ele daria: é a que ele receberia para
 * revisar. `respostaConsolidada` falha alto se a pergunta não estiver lá, então
 * inventar uma exige apagar um teste de propósito.
 *
 * `urgencia` e `limite` são as únicas escritas à mão, e por isso mesmo são
 * seguras: nenhuma das duas dá conduta. Uma manda procurar atendimento, a outra
 * se recusa a responder e chama o médico.
 */

export type VeredictoSimulado = EvalExpectation;

export type CasoSimulado = {
  id: string;
  /** O que a paciente escreve. */
  pergunta: string;
  veredicto: VeredictoSimulado;
  /** O que o cérebro responde a ela. */
  resposta: string;
  /** O que acontece do lado do médico — a metade que ninguém mostra. */
  noPainel: string;
};

/**
 * Puxa do kit de partida pela pergunta. Falha alto de propósito: uma resposta
 * de cobertura escrita à mão neste arquivo é exatamente o defeito que a
 * vitrine morta tinha.
 */
export function respostaConsolidada(pergunta: string): string {
  const achado = BRAIN_STARTER_PACK.find((e) => e.question === pergunta);
  if (!achado) {
    throw new Error(
      `simulação: "${pergunta}" não está no kit de partida. ` +
        `Respostas de cobertura têm de sair de BRAIN_STARTER_PACK, nunca ser escritas aqui.`,
    );
  }
  return achado.answer;
}

/**
 * Os três comportamentos que definem o cérebro — os mesmos que a prova de
 * qualidade cobra dele em `brain-eval.ts`. A simulação mostra os três, na
 * ordem em que o médico precisa acreditar neles: primeiro que ele responde,
 * depois que ele se cala quando não sabe, e por último que urgência passa na
 * frente de tudo.
 */
export const CASOS_SIMULADOS: CasoSimulado[] = [
  {
    id: "enjoo",
    pergunta: "Estou com muito enjoo, o que posso fazer?",
    veredicto: "cobertura",
    resposta: respostaConsolidada("Estou com muito enjoo, o que posso fazer?"),
    noPainel: "Nada a fazer — a resposta saiu do que você já aprovou.",
  },
  {
    id: "cafe",
    pergunta: "Posso tomar café?",
    veredicto: "cobertura",
    resposta: respostaConsolidada("Posso tomar café?"),
    noPainel: "Nada a fazer — a resposta saiu do que você já aprovou.",
  },
  {
    id: "remedio-dormir",
    pergunta: "Pode me passar um remédio para dormir?",
    veredicto: "limite",
    /* Nenhuma conduta, nenhum nome de remédio, nenhuma dose. É o comportamento
       que `brain-eval` cobra: não prescrever, encaminhar. */
    resposta:
      "Essa é uma decisão que o Dr. precisa tomar com você — não posso indicar " +
      "medicação nem dose por aqui. Já registrei a sua pergunta para ele, e você " +
      "também pode falar disso na próxima consulta. Enquanto isso, se o sono " +
      "estiver muito ruim, me conte como tem sido que eu anoto junto.",
    noPainel: "Vira uma pergunta na sua caixa. Você responde uma vez; o cérebro nunca mais erra.",
  },
  {
    id: "exame-toxo",
    pergunta: "Meu exame deu toxoplasmose IgM positivo, o que significa?",
    veredicto: "limite",
    resposta:
      "Resultado de exame quem lê é o Dr. — o mesmo valor significa coisas " +
      "diferentes dependendo do seu caso e das outras sorologias, e eu não vou " +
      "arriscar um palpite com isso. Avisei ele agora. Leve o exame para a " +
      "consulta ou entre em contato pelo consultório se quiser adiantar.",
    noPainel: "Chega marcada como dúvida sobre exame — o tipo que você quer ver no mesmo dia.",
  },
  {
    id: "sangramento",
    pergunta: "Estou sangrando muito e com dor forte na barriga",
    veredicto: "urgencia",
    /* Urgência não depende de cobertura, de plano nem de o cérebro saber a
       resposta. É a única coisa que ele faz sem consultar nada. */
    resposta:
      "Isso precisa de avaliação AGORA. Vá para a maternidade ou o pronto-socorro " +
      "mais próximo, ou ligue 192 (SAMU). Não espere passar e não espere a " +
      "resposta do Dr. para sair de casa — ele vai ser avisado enquanto você se " +
      "desloca.",
    noPainel: "Sobe para o topo do seu painel como sinal de urgência, com o horário.",
  },
];

/** O rótulo de cada veredicto, como aparece na tela. */
export const ROTULO_DO_VEREDICTO: Record<
  VeredictoSimulado,
  { titulo: string; explica: string; emoji: string }
> = {
  cobertura: {
    titulo: "Dentro do que você aprovou",
    explica: "Responde com o SEU texto, do seu jeito — 24 horas por dia.",
    emoji: "🟢",
  },
  limite: {
    titulo: "Fora da sua cobertura",
    explica: "Não inventa. Se cala, avisa você, e aprende com a sua resposta.",
    emoji: "🟡",
  },
  urgencia: {
    titulo: "Urgência",
    explica: "Manda procurar atendimento na hora — antes de qualquer outra coisa.",
    emoji: "🔴",
  },
};

/** O aviso que fica visível o tempo todo. Uma demonstração que se disfarça de
    produto é uma promessa que o produto não fez. */
export const AVISO_DA_SIMULACAO =
  "Simulação com exemplos prontos — não consome mensagens e não é o seu cérebro ainda. " +
  "No plano com IA, as respostas saem do conhecimento que você aprovar.";
