/**
 * O TUTORIAL DO PRIMEIRO ACESSO — o bebê bolha apresentando o app.
 *
 * Pedido do dono: no primeiro acesso ele demonstra, num tutorial breve, os
 * cinco elementos da barra de baixo, explicando de maneira simples o que cada
 * um faz e para que serve.
 *
 * ─── AS REGRAS DE ESCRITA, E POR QUE ELAS SÃO ESTAS ────────────────────────
 *
 * Quem lê isto é uma gestante de alto risco no primeiro minuto de uso. Cada
 * frase passou por quatro filtros:
 *
 *  1. **Diz o que FAZ, não o que É.** "Central de emergência" não ensina nada.
 *     "Um toque avisa o seu médico com a sua localização" ensina.
 *  2. **Duas linhas, no máximo.** O balão é um balão. Quem quer manual não
 *     está no primeiro acesso de um app de gravidez.
 *  3. **Nenhuma promessa que o app não cumpre.** Cada afirmação aqui foi
 *     conferida contra o código: o SOS avisa mesmo médico e contato com
 *     localização; a Saúde vai mesmo para o prontuário; o chat responde mesmo
 *     pelo cérebro do médico.
 *  4. **Sem susto no SOS.** É o único cartão em que clareza vence simpatia —
 *     e mesmo ali a frase não descreve emergências, só o que o botão faz.
 *
 * ─── `{nome}` ──────────────────────────────────────────────────────────────
 *
 * Só a abertura e o fecho usam. No meio, chamar pelo nome a cada cartão soa
 * como vendedor. Sem nome no perfil, o trecho simplesmente sai — ver
 * `comNome`.
 */

export type PassoDoTutorial = {
  /** Id estável: é a chave do "já vi este passo" e a do teste. */
  id: string;
  /**
   * Qual item da barra de baixo este passo ilumina.
   *
   * `null` na abertura e no fecho: eles falam do app inteiro, e acender um
   * ícone ali faria a paciente procurar significado onde não há.
   */
  destaca: "sos" | "saude" | "home" | "jogo" | "chat" | null;
  titulo: string;
  corpo: string;
};

/**
 * A ordem é a da BARRA, da esquerda para a direita: SOS · Saúde · Bebê · Jogo
 * · Chat. Ensinar numa ordem diferente da que o dedo encontra obrigaria a
 * paciente a traduzir o tutorial para a tela.
 *
 * A única exceção é o SOS vir primeiro, e ele já é o primeiro da barra: é o
 * que ela precisa saber ANTES de precisar.
 */
export const PASSOS_DO_TUTORIAL: PassoDoTutorial[] = [
  {
    id: "abertura",
    destaca: null,
    titulo: "Oi{nome}! Eu sou a sua bolha 💛",
    corpo: "Em meio minuto eu te mostro onde fica cada coisa. Depois é só me tocar aqui em cima.",
  },
  {
    id: "sos",
    destaca: "sos",
    titulo: "Se algo assustar, é aqui",
    corpo:
      "Um toque avisa o seu médico e a pessoa que você escolheu, com a sua localização. Você não precisa escrever nada.",
  },
  {
    id: "saude",
    destaca: "saude",
    titulo: "Onde ficam os seus números",
    corpo:
      "Peso, pressão e glicemia. Aqui também dá para contar os chutes e cronometrar contrações — e o seu médico vê tudo.",
  },
  {
    id: "home",
    destaca: "home",
    titulo: "Esta é a nossa casa",
    corpo:
      "O seu bebê cresce aqui, semana a semana. É a tela que abre quando você entra — e eu fico neste cantinho.",
  },
  {
    id: "jogo",
    destaca: "jogo",
    titulo: "Um pouquinho por dia",
    corpo:
      "Uma aula rápida, uma meditação, um movimento leve. Cinco minutos que rendem o dia — e rendem Sementinhas.",
  },
  {
    id: "chat",
    destaca: "chat",
    titulo: "Dúvida às três da manhã?",
    corpo:
      "Pergunte aqui. Eu respondo com o que o seu médico ensinou ao app — e o que for para ele mesmo, você manda com um toque.",
  },
  {
    id: "fecho",
    destaca: null,
    titulo: "Pronto{nome} 💛",
    corpo:
      "Vou ficar neste canto: aviso quando chegar recado do seu médico e faço companhia no resto. Até já!",
  },
];

/**
 * Troca `{nome}` pelo primeiro nome dela — ou some com o trecho.
 *
 * A vírgula vive DENTRO da substituição (`, Ana`), e não no texto: escrita
 * fora, "Oi, {nome}!" viraria "Oi, !" para quem não preencheu o perfil. É o
 * tipo de defeito que só aparece na conta de quem pulou o cadastro, que é
 * justamente quem mais vê o tutorial.
 */
export function comNome(texto: string, nome?: string | null): string {
  const limpo = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return texto.replaceAll("{nome}", limpo ? `, ${limpo}` : "");
}

/** Chave do "já vi o tutorial", por usuário. Local: é preferência de aparelho. */
export function chaveDoTutorial(uid: string | null): string {
  return `dc-tutorial-bolha:${uid ?? "anon"}`;
}
