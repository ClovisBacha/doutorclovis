/**
 * A PERMISSÃO DE IA — a régua pura (sem AsyncStorage, sem React Native).
 *
 * Diretriz 5.1.2(i) da App Store: antes de mandar dado pessoal a uma IA de
 * terceiros, o app precisa DIZER o que vai, para quem vai, e pedir licença.
 * Sem isso o app é reprovado — e, mais do que a loja, é o que a paciente tem
 * direito de saber antes de mandar a foto da cozinha dela para o Google.
 *
 * ⚠️ O aceite tem VERSÃO. Se um dia o que vai mudar (outra IA, outro dado), a
 * versão sobe e TODA paciente vê a folha de novo: um "sim" dado para o
 * Gemini não vale para um provedor que ela nunca viu nomeado.
 *
 * ⚠️ E ele é por uid: aparelho compartilhado não herda o "sim" de outra conta.
 */

export const VERSAO_DA_PERMISSAO = 1;

export type RegistroDaPermissao = { versao: number; em: string };

/** A chave no armazém. Começa com "dc-" para sair junto no "sair da conta". */
export function chaveDaPermissao(uid: string): string {
  return `dc-ia-permissao:${uid}`;
}

/** O que se grava quando ela toca "Permitir". */
export function registroDaPermissao(agora: Date = new Date()): RegistroDaPermissao {
  return { versao: VERSAO_DA_PERMISSAO, em: agora.toISOString() };
}

/**
 * O que está guardado ainda vale? Só um registro inteiro, da versão ATUAL e
 * com data legível. Qualquer outra coisa — lixo, versão antiga, versão futura
 * (app rebaixado) — é "não perguntamos ainda", e a folha aparece.
 */
export function permissaoVale(bruto: unknown): boolean {
  if (!bruto || typeof bruto !== "object") return false;
  const r = bruto as Partial<RegistroDaPermissao>;
  if (r.versao !== VERSAO_DA_PERMISSAO) return false;
  if (typeof r.em !== "string" || !r.em) return false;
  return Number.isFinite(Date.parse(r.em));
}

/**
 * O TEXTO DA FOLHA. Mora aqui, e não no JSX, para o dono reler e corrigir num
 * lugar só — e para o teste conferir que ele nomeia o que a loja exige.
 *
 * ⚠️ Ele precisa bater com o que o servidor REALMENTE manda ao modelo
 * (`nutricao-contexto.server.ts` no site): perfil (semana ou data do parto,
 * alergias, medicações, preferências), registros de saúde (peso, pressão,
 * glicemia), humor e sintomas anotados nos últimos dias. Prometer menos do que
 * vai é a falha que a diretriz existe para impedir.
 */
export const FOLHA_DA_PERMISSAO = {
  titulo: "Antes de conversar com a nutricionista",
  intro:
    "A nutricionista deste app é uma inteligência artificial. Para responder, ela usa o Gemini, a IA do Google.",
  vaiTitulo: "O que vai para o Google",
  vai: [
    "O que você escrever na conversa.",
    "A foto do prato ou do rótulo, quando você mandar uma.",
    "Algumas informações do seu perfil e dos seus registros: semana da gestação (ou data do parto), alergias, medicações, preferências de comida, e peso, pressão, glicemia, humor e sintomas que você anotou nos últimos dias.",
  ],
  garantias: [
    "Serve só para gerar a resposta. Nada disso é usado para publicidade.",
    "A foto não fica guardada: nem no app, nem no nosso servidor.",
    "A IA pode errar e não substitui consulta nem atendimento. Se você estiver passando mal, ligue 192.",
  ],
  /* ⚠️ Aponta para o lugar que EXISTE com certeza (o alto da tela da
     Nutrição). Se o Perfil também ganhar o cartão, ótimo; a frase continua
     verdadeira. */
  rodape: "Dá para retirar quando quiser: toque em “Permissão de IA”, no alto da tela da Nutrição.",
  permitir: "Permitir",
  agoraNao: "Agora não",
} as const;
