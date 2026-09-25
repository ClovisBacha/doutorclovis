/**
 * O GRUPO DO DIRECT — e por que ele é apertado.
 *
 * ⚠️ **Num app de gestação de alto risco, um grupo aberto é onde o conselho de
 * leiga se multiplica.** De 1.098 respostas com conselho analisadas em fóruns de
 * gestação, 20,9% estavam erradas e 5,5% eram potencialmente danosas — e o grupo
 * não se autocorrige (5,2% de retificação). Esse número é o que fechou os
 * comentários deste app; o grupo entra com as travas que aquela decisão implica.
 *
 * As quatro travas, e cada uma responde a um jeito concreto de dar errado:
 *
 * 1. **Só a criadora convida**, e só de dentro do grafo dela. Sem isso, uma
 *    pessoa entra e traz outras cinco que ninguém conhece — e a conversa deixa
 *    de ser entre quem se escolheu.
 * 2. **Teto de oito.** Acima disso ninguém lê tudo, e o que sobra é quem fala
 *    mais alto.
 * 3. **Quem entra vê a partir de quando entrou.** O que veio antes pode ser um
 *    susto, um resultado ou uma perda — e quem escreveu escolheu contar para
 *    quem estava lá naquele momento.
 * 4. **A criadora saindo ENCERRA.** Um grupo sem dona é um grupo sem ninguém
 *    responsável por quem entra.
 */

/**
 * ⚠️ **OITO, contando a criadora.**
 *
 * Não é um número redondo escolhido no ar: é o ponto em que uma conversa deixa
 * de caber numa tela e em que ninguém mais lê tudo. Acima dele, o grupo vira
 * um feed — e feed já existe nesta aba, com régua de visibilidade própria.
 */
export const MEMBROS_DO_GRUPO_MAX = 8;

/** O nome é curto porque vive numa linha de lista, ao lado do avatar. */
export const NOME_DO_GRUPO_MAX = 40;

export type MembroDoGrupo = {
  id: string;
  nome: string;
  avatarUrl: string | null;
  souEu: boolean;
  ehCriadora: boolean;
};

/**
 * ⚠️ **QUEM PODE SER CONVIDADA: só quem já está no grafo dela.**
 *
 * É a MESMA régua de marcar alguém num post (`marcadasPermitidas`) e de mandar
 * uma publicação numa conversa: nada de busca por nome, nada de uuid solto no
 * corpo do pedido. Num app onde a base é de gestantes de alto risco, uma lista
 * navegável de pessoas é o dado que menos pode vazar.
 *
 * ⚠️ **E o bloqueio vale nos DOIS sentidos.** Convidar quem me bloqueou poria as
 * duas na mesma conversa pela porta dos fundos — e o bloqueio é a única defesa
 * que não depende de eu estar olhando.
 */
export function podeConvidarParaGrupo(v: {
  euId: string;
  criadoraId: string;
  alvoId: string;
  sigoAtivo: boolean;
  somosAmigas: boolean;
  bloqueio: boolean;
  emCuidado: boolean;
  jaSaoMembros: number;
}): boolean {
  if (v.euId !== v.criadoraId) return false;
  if (v.alvoId === v.euId) return false;
  if (v.bloqueio) return false;
  if (v.emCuidado) return false;
  if (!v.sigoAtivo && !v.somosAmigas) return false;
  return v.jaSaoMembros < MEMBROS_DO_GRUPO_MAX;
}

/**
 * ⚠️ **O QUE EU VEJO DO GRUPO começa em `entrouEm`, e nunca antes.**
 *
 * Esta é a régua que separa "entrar num grupo" de "ler a conversa dos outros".
 * Sem ela, convidar alguém entregaria de uma vez tudo o que foi dito — inclusive
 * o que foi dito ANTES de ela existir para o grupo, por pessoas que não sabiam
 * que ela leria.
 *
 * ⚠️ **E quem saiu para de ver a partir de `saiuEm`.** O histórico do período em
 * que ela estava continua dela; o que veio depois, não.
 */
export function mensagemVisivelNoGrupo(v: {
  criadaEm: string;
  entrouEm: string;
  saiuEm: string | null;
}): boolean {
  const t = Date.parse(v.criadaEm);
  if (Number.isNaN(t)) return false;
  const entrou = Date.parse(v.entrouEm);
  if (Number.isNaN(entrou) || t < entrou) return false;
  if (!v.saiuEm) return true;
  const saiu = Date.parse(v.saiuEm);
  return Number.isNaN(saiu) ? true : t <= saiu;
}

/**
 * O nome que a lista mostra.
 *
 * ⚠️ **Grupo sem nome NÃO vira "Grupo".** Ele vira a lista de quem está dentro —
 * é o que o WhatsApp faz, e é o que responde a pergunta que ela tem ao olhar a
 * lista: "com quem eu falo aqui?". "Grupo" não responde nada.
 */
export function nomeDoGrupo(nome: string | null, membros: readonly { nome: string }[]): string {
  const t = (nome ?? "").trim();
  if (t) return t;
  const outros = membros.map((m) => m.nome.trim()).filter(Boolean);
  if (outros.length === 0) return "Grupo";
  if (outros.length <= 2) return outros.join(" e ");
  return `${outros.slice(0, 2).join(", ")} e mais ${outros.length - 2}`;
}
