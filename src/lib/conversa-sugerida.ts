/**
 * "VOCÊS ESTÃO NA MESMA FASE" — a sugestão de conversa.
 *
 * Pedido do dono, como diferencial: *por que elas conversariam aqui e não no
 * Instagram ou no WhatsApp?* Esta é a resposta que as outras duas redes não têm
 * como dar. No WhatsApp não existe forma de achar alguém que esteja na mesma
 * semana de gestação que você; no Instagram, existe uma hashtag e um oceano de
 * desconhecidas sem nada em comum além da palavra.
 *
 * ─── ⚠️ A FASE, NUNCA A SEMANA ──────────────────────────────────────────────
 *
 * A régua é `fase-parecida.ts`, a MESMA que o filtro do feed já usa — e o número
 * da semana **não sai desta função**, nem para ordenar. Duas razões, e a segunda
 * é a que importa:
 *
 * 1. Semana é dado clínico, e a chave `mostrar_semana` existe exatamente para a
 *    paciente decidir se ele aparece. Uma sugestão que dissesse "ela também está
 *    de 28 semanas" publicaria pela porta lateral o que a chave fecha na frente.
 * 2. Emparelhar por semana EXATA cria uma coorte fechada de poucas pessoas e
 *    torna a ausência informativa: quem some da lista da semana 31 sumiu por
 *    algum motivo, e numa base de alto risco esse motivo é adivinhável. A fase
 *    é grossa o bastante para que ninguém deduza nada.
 *
 * ─── ⚠️ E ELA NÃO É UM "PEOPLE YOU MAY KNOW" ────────────────────────────────
 *
 * Não entra elo em comum, não entra quem reagiu no post de quem, não entra
 * engajamento de espécie nenhuma — a mesma proibição que `sugestoes.ts` carrega,
 * e pela mesma razão: numa base de gestação de alto risco, o post que mais
 * engaja é o da emergência.
 */

import { faseDe, mesmaFase, type Fase } from "./fase-parecida";

/** Uma candidata, já reduzida ao que esta régua precisa saber. */
export type CandidataAConversa = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  /** A fase dela, já calculada pelo servidor. Ver `faseDaLinha`. */
  fase: Fase | null;
  /** Ela apareceu no app há quanto tempo (ISO), ou `null`. */
  ultimaVez: string | null;
};

/**
 * Quantas a tela mostra.
 *
 * ⚠️ **Três, e não dez.** Isto é uma sugestão dentro da caixa de entrada, não um
 * catálogo de pessoas: uma fileira longa transforma a lista de conversas dela
 * numa vitrine de desconhecidas, que é o oposto do que uma caixa de entrada é.
 */
export const SUGESTOES_DE_CONVERSA = 3;

/**
 * ⚠️ **QUANTAS PRECISAM EXISTIR PARA A FILEIRA APARECER.**
 *
 * Com UMA candidata, a sugestão deixa de ser "quem está na sua fase" e passa a
 * ser "esta pessoa aqui" — e, numa base pequena, ela vira identificação: se
 * amanhã aparecer outra, dá para inferir quando cada uma entrou na fase. Duas é
 * o mínimo que mantém a fileira sendo sobre a FASE, e não sobre uma pessoa.
 */
export const MINIMO_PARA_MOSTRAR = 2;

/**
 * A régua.
 *
 * ⚠️ **A ORDEM DAS EXCLUSÕES É A ORDEM DA SEGURANÇA, e cada uma existe por um
 * caso concreto:**
 *
 * - **eu mesma** — o app sugerindo que ela converse consigo;
 * - **bloqueio, nos dois sentidos** — a lista de sugestões seria a porta dos
 *   fundos do bloqueio, e a mais cruel: o app apresentando de volta quem ela
 *   afastou;
 * - **quem já tem conversa** — sugerir alguém que está três linhas abaixo, na
 *   própria tela, faz o app parecer que não sabe o que já aconteceu;
 * - **fase diferente ou desconhecida** — sem fase, a sugestão não tem assunto, e
 *   "alguém" não é motivo para escrever a uma estranha.
 *
 * O recorte de PERFIL PÚBLICO **não está aqui**: ele é do servidor, na consulta,
 * antes de qualquer coisa chegar a esta função — a mesma decisão de
 * `postsDaTag`. Filtrar visibilidade depois de ler é como um post vaza.
 */
export function sugerirConversas(v: {
  euId: string;
  minhaFase: Fase | null;
  candidatas: CandidataAConversa[];
  /**
   * ⚠️ **A ASSINATURA É `{ has }`, e NÃO `ReadonlySet<string>` — de propósito.**
   *
   * O conjunto de bloqueio do app é `ConjuntoDeBloqueio`, um embrulho que FALHA
   * FECHADO: quando a leitura degrada, ele responde `true` para todo mundo, e
   * ninguém é sugerido. Exigir um `Set` de verdade aqui obrigaria o servidor a
   * converter — e a conversão perderia exatamente essa propriedade, porque um
   * `Set` construído a partir de uma lista vazia responde `false` para todos.
   * Aceitar qualquer coisa com `.has` é o que deixa a versão segura passar
   * intacta.
   */
  /**
   * ⚠️ **NÃO É SÓ O BLOQUEIO — é "quem não pode ser sugerida".** O nome mudou
   * junto com o sentido, de propósito: com `bloqueadas`, quem lesse a chamada
   * concluiria que só o bloqueio recorta, e foi assim que a SILENCIADA
   * continuava sendo oferecida aqui depois de o feed e os stories já a terem
   * tirado. Silenciar é preferência de FEED — mas a fileira de conversa é uma
   * porta para o feed, e insistir com quem ela pediu para não ouvir é o
   * contrário do que a palavra promete.
   */
  foraDaSugestao: { has(id: string): boolean };
  /** Com quem eu JÁ tenho conversa (aceita, pedida, de qualquer estado). */
  jaConverso: { has(id: string): boolean };
  limite?: number;
}): CandidataAConversa[] {
  /* ⚠️ **ATALHO, NÃO TRAVA — e a mutação provou.** Apagar esta linha não muda
     resultado nenhum: `mesmaFase(null, x)` já é falso para todo `x`, inclusive
     para `null` (há teste em `fase-parecida.test.ts`), então a filtragem abaixo
     esvaziaria a lista sozinha. Fica porque poupa a varredura e declara a
     intenção — mas quem PROTEGE a paciente sem fase é `mesmaFase`, e é lá que
     mora o risco se alguém um dia "simplificar" aquela função para devolver
     `true` quando os dois lados são nulos. */
  if (!v.minhaFase) return [];

  const vivas = v.candidatas.filter(
    (c) =>
      c.id !== v.euId &&
      !v.foraDaSugestao.has(c.id) &&
      !v.jaConverso.has(c.id) &&
      mesmaFase(v.minhaFase, c.fase),
  );

  /* ⚠️ **A ORDEM É POR QUEM APARECEU POR ÚLTIMO, nunca por audiência.** Ordenar
     por seguidores transformaria a fileira num ranking de popularidade — a
     coisa que este app decidiu não ter (ver `NUMEROS_PUBLICOS`). E "esteve aqui
     recentemente" é o único sinal que responde à pergunta real: se eu escrever,
     alguém lê? */
  const ordenadas = [...vivas].sort((x, y) => {
    const a = x.ultimaVez ? new Date(x.ultimaVez).getTime() : 0;
    const b = y.ultimaVez ? new Date(y.ultimaVez).getTime() : 0;
    if (b !== a) return b - a;
    /* ⚠️ Desempate ESTÁVEL. Sem ele, duas candidatas sem `last_seen_at` trocam
       de lugar entre duas aberturas e a fileira parece um sorteio. */
    return x.id < y.id ? -1 : 1;
  });

  if (ordenadas.length < MINIMO_PARA_MOSTRAR) return [];
  return ordenadas.slice(0, v.limite ?? SUGESTOES_DE_CONVERSA);
}

/**
 * O texto que a tela mostra.
 *
 * ⚠️ **NÃO DIZ A SEMANA, NÃO DIZ O NÚMERO DE PESSOAS E NÃO PROMETE AMIZADE.**
 * "3 grávidas de 28 semanas perto de você" seria as três coisas erradas de uma
 * vez: publica o dado clínico, expõe o tamanho da coorte e promete um encontro
 * que o app não tem como garantir.
 */
export const TITULO_DA_SUGESTAO = "Estão na mesma fase que você";
export const EXPLICACAO_DA_SUGESTAO =
  "Só aparece quem deixou o perfil aberto. A semana de ninguém é mostrada aqui.";

/**
 * A primeira mensagem, oferecida pronta.
 *
 * ⚠️ **É RASCUNHO, e o app NUNCA manda sozinho** — cai no campo para ela
 * conferir e mudar, como o agradecimento do chá de bebê e a transcrição do
 * diário. Escrever para uma estranha é o degrau que faz a maioria desistir, e
 * oferecer a primeira linha é o que derruba esse degrau; mandar por ela seria
 * pôr o nome dela numa frase que ela não escolheu.
 *
 * ⚠️ **E NÃO CITA GESTAÇÃO NENHUMA.** "Vi que você também está de 28 semanas" é
 * o texto óbvio e é o que a régua inteira existe para não deixar sair.
 */
export const RASCUNHO_DA_PRIMEIRA = "Oi! Vi que a gente está numa fase parecida 💛";

export { faseDe };
