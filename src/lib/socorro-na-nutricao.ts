import { BANDEIRA_VERMELHA, PRESSAO_EM_NUMEROS } from "./pergunta-clinica";

/**
 * ⚠️ O CAMINHO DE SOCORRO DENTRO DA CONVERSA DA NUTRICIONISTA.
 *
 * ─── POR QUE ISTO PRECISOU EXISTIR ──────────────────────────────────────────
 *
 * A aba de Nutrição tem um **campo de texto livre num app de gestação de alto
 * risco**, e ela não tinha caminho determinístico nenhum. Toda a segurança
 * dela morava em UMA linha do prompt de sistema ("quando a paciente mencionar
 * sintomas preocupantes … sempre oriente procurar o médico") — ou seja: a
 * decisão de mandar alguém procurar socorro estava **delegada a um modelo**, e
 * este projeto já decidiu que segurança não se delega a modelo.
 *
 * As outras seis portas de texto do app (post, story, comentário, caixinha,
 * direct, bio) passam por `triarTexto` desde ago/2026. A conversa que fala de
 * VÔMITO, de PRESSÃO e de PESO — as três coisas que mais aparecem numa
 * pré-eclâmpsia e numa hiperêmese — era a que não passava por nada.
 *
 * ─── A RÉGUA É SÓ A BANDEIRA, NUNCA `triarTexto` INTEIRO ─────────────────────
 *
 * ⚠️ Medido em 50 perguntas reais de nutrição: **`triarTexto` devolve `clinica`
 * em 10 delas** — "quantos cafés posso tomar por dia?", "estou com azia toda
 * noite", "posso tomar chá preto?", "minha glicemia deu 118, o que eu como?".
 * É o comportamento CERTO dele (a caixinha pública não pode virar consultório)
 * e seria desastroso aqui: uma em cada cinco perguntas de comida deixaria de
 * chegar à nutricionista, e a paciente aprenderia em três dias que a aba não
 * responde. Na MESMA bateria, `BANDEIRA_VERMELHA + PRESSAO_EM_NUMEROS`
 * acusaram **zero** — e as 14 bandeiras de verdade, todas.
 *
 * ─── AS QUATRO DECISÕES QUE FAZEM ISTO SER SEGURO ───────────────────────────
 *
 * 1. ⚠️ **RODA NO APARELHO, ANTES DE ENVIAR.** Funciona sem rede (que é
 *    exatamente quando ela pode estar num pronto-socorro), não gasta cota, não
 *    espera função fria, e não depende de o servidor responder. O caminho de
 *    socorro não pode ser o único do app que precisa de 4G.
 * 2. ⚠️ **A MENSAGEM NÃO VAI PARA O MODELO.** Não é censura: é que a resposta a
 *    "estou vendo pontinhos" não é uma sugestão de cardápio, e um modelo
 *    respondendo "vamos ver o que você comeu hoje" ao lado de um sinal de
 *    pré-eclâmpsia é o pior desfecho possível desta tela. O app responde ele
 *    mesmo, sempre igual.
 * 3. ⚠️ **NUNCA GATEADO POR MODO CUIDADO, e nunca pelo Premium.** Socorro não é
 *    conteúdo: quem perdeu a gestação continua podendo passar mal (hemorragia,
 *    infecção, pré-eclâmpsia de pós-parto), e quem não assina também. É a mesma
 *    lição de `socorro-nao-e-gateado`: o Modo Cuidado faz o app parar de FALAR
 *    DO BEBÊ, nunca de socorrer.
 * 4. ⚠️ **NÃO PROMETE QUE ALGUÉM VAI VER.** Ele dá o caminho — a Central de
 *    Emergência (que avisa médico e contato com localização) e o 192 — e diz
 *    para não esperar resposta pela conversa. Prometer leitura aqui seria a
 *    mesma mentira que "a gente vai olhar" foi na denúncia.
 */

/** A pergunta pede socorro? Só a bandeira vermelha e a pressão em números. */
export function pedeSocorro(texto: string): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  /* ⚠️ As duas são `"i"` e não `"g"` — `.test()` aqui não guarda `lastIndex`.
     Com `g`, chamadas alternadas devolveriam `false` de uma em duas. */
  return BANDEIRA_VERMELHA.test(t) || PRESSAO_EM_NUMEROS.test(t);
}

/**
 * A resposta do app — a MESMA sempre, e escrita aqui e não no JSX.
 *
 * ⚠️ Ela não diagnostica e não tranquiliza. Diz o que fazer, em que ordem, e
 * que a conversa não é o canal. "Provavelmente não é nada" é a frase que este
 * app não escreve nunca.
 */
export const RESPOSTA_DO_SOCORRO =
  "Isso que você escreveu não é assunto de cardápio — é de atendimento, agora.\n\n" +
  "Use o botão vermelho abaixo: ele avisa o seu médico e o seu contato de " +
  "emergência de uma vez, com a sua localização, sem você precisar escrever nada. " +
  "Se preferir, ligue 192 (SAMU).\n\n" +
  "Não espere resposta por aqui — esta conversa é sobre alimentação, e eu não " +
  "consigo te socorrer.";

/** O título do cartão que a tela desenha junto da resposta. */
export const TITULO_DO_SOCORRO = "Procure atendimento agora";
