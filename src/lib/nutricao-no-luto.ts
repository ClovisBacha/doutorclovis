/**
 * AS REGRAS DO MODO CUIDADO NA NUTRIÇÃO — UMA LISTA, DOIS PROMPTS.
 *
 * ⚠️ ELAS NASCERAM AQUI PORQUE A FOTO NÃO AS TINHA. `/api/nutrition` trocava
 * o prompt inteiro no luto (`careMode ? NUTRICAO_EM_LUTO : NUTRITION_SYSTEM`)
 * desde o primeiro dia; `/api/prato` recebia `careMode`, passava-o para o
 * portão do Premium e para o bloco da paciente — e NUNCA para o prompt.
 * `promptDaFoto(assunto)` não tinha sequer o parâmetro.
 *
 * O que `careMode` fazia na foto era só OMITIR semana, trimestre e ganho do
 * bloco de contexto (`nutricao-perfil.ts`). **Omissão não é instrução:** o
 * modelo continuava recebendo "você é a nutricionista deste app" — de um app
 * de gestação — e uma linha falando de "grávida" e de amamentação, sem uma
 * palavra proibindo falar do bebê. E a câmera FICA em Modo Cuidado, por
 * decisão registrada na tela: a paciente em luto fotografa o prato e a
 * resposta podia voltar falando da gestação dela.
 *
 * ⚠️ E É UMA LISTA SÓ, nunca duas cópias: duas divergem no primeiro conserto,
 * e a divergência apareceria como a conversa protegida e a foto não — que é
 * exatamente o estado que este arquivo veio fechar.
 */

/** A moldura: o FATO, dito ao modelo antes de qualquer regra. */
export const ABERTURA_DO_LUTO = "ESTA PACIENTE ESTÁ EM LUTO: a gestação dela terminou em perda.";

/**
 * ⚠️ A TERCEIRA REGRA NÃO É ENFEITE. Sem ela, as duas proibições acima leem
 * como "não fale nada" e a nutricionista fica muda justamente para quem
 * precisa se recuperar — alimentação continua sendo assunto legítimo depois
 * de uma perda, e o que sai é a moldura de gestação em curso.
 */
export const REGRAS_NO_LUTO = [
  "- NUNCA fale em semanas, trimestre, evolução do bebê, amamentação do bebê, enxoval ou preparo para o parto. Nada disso existe para ela agora.",
  "- Não pergunte como está a gestação e não parabenize.",
  "- Alimentação continua sendo assunto legítimo e importante: recuperação depois da perda, anemia e reposição de ferro, apetite que sumiu ou aumentou, leite que desceu, hidratação, e — se ELA trouxer — preparo do corpo para uma gestação futura.",
] as const;
