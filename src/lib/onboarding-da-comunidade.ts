/**
 * O PRIMEIRO MINUTO NA COMUNIDADE
 * ═══════════════════════════════
 *
 * A aba cresceu muito: feed, stories, Explorar, direct, caixinha, comentários,
 * enquete. Uma paciente nova abre e encontra uma tela cheia de ícones e um feed
 * quase vazio — e as duas coisas que ela MAIS precisa saber antes de publicar
 * qualquer coisa não estão escritas em lugar nenhum da tela.
 *
 * ⚠️ **ISTO NÃO É UM PASSEIO PELOS ÍCONES.** Um tutorial que aponta para cada
 * botão ensina onde as coisas estão, e onde as coisas estão se descobre tocando.
 * O que NÃO se descobre tocando é o que os cartões abaixo dizem: que o perfil
 * dela já nasce fechado (então publicar não é publicar para o mundo), que cada
 * publicação escolhe o seu público, e que **conduta clínica não se pede nem se
 * dá aqui**. Esta última é a razão de a aba não ter comentário livre de
 * conselho, e é o único texto do app que explica isso para quem chega.
 *
 * ⚠️ **O TEXTO MORA AQUI, e não no JSX.** É o que o dono relê e corrige, e
 * texto enterrado num componente de dez mil linhas é texto que ninguém revisa —
 * a mesma razão de `frases-do-mascote.ts`, `tutorial-do-mascote.ts` e
 * `cartas-do-bebe.ts`.
 */

export type CartaoDaComunidade = {
  /** Nunca muda: entra na chave de "já vi" de nada, mas ancora o teste. */
  id: string;
  emoji: string;
  titulo: string;
  texto: string;
};

/**
 * ⚠️ **QUATRO, e a terceira é a que justifica a tela.**
 *
 * As outras três podem ser descobertas com paciência; "aqui não se pede
 * conduta" não pode — e a paciente que descobre isso tarde já escreveu a
 * pergunta que não devia, ou já leu a resposta de uma leiga como se fosse
 * orientação.
 */
export const CARTOES_DA_COMUNIDADE: readonly CartaoDaComunidade[] = [
  {
    id: "fechado",
    emoji: "🔒",
    titulo: "Seu perfil começa fechado",
    texto:
      "Ninguém vê o que você publica até você abrir o perfil ou aceitar quem pediu para te acompanhar. Você decide, e pode mudar quando quiser.",
  },
  {
    id: "camada",
    emoji: "👀",
    titulo: "Cada publicação escolhe quem vê",
    texto:
      "Na hora de publicar você diz se aquilo é para todo mundo, para quem te acompanha, ou só para as suas amigas. Uma foto do ultrassom e um desabafo de terça não precisam ter o mesmo público.",
  },
  {
    id: "clinico",
    emoji: "💛",
    titulo: "Aqui a gente troca experiência",
    texto:
      "Conduta é com o seu obstetra. Se algo no seu corpo te preocupa, fale com ele — e se for urgente, use o SOS na barra de baixo. Ele avisa o seu médico e o seu contato de uma vez.",
  },
  {
    /* ⚠️ Este cartão existe porque catorze funções da aba (publicar,
       mensagens, busca, caixinha, salvos, o hub de Chá de bebê, Amigas e
       Acompanhante…) viviam atrás de um gesto que nada anunciava — tocar de
       novo no ícone da barra. Os quatro cartões falavam só de privacidade.
       Estudo de navegação, set/2026. */
    id: "onde",
    emoji: "🧭",
    titulo: "Onde ficam as coisas",
    texto:
      "A primeira bolinha da fileira, com o ⊞, abre o chá de bebê, as amigas, o álbum e o acompanhante. E tocar de novo no ícone da Comunidade, na barra de baixo, mostra os atalhos: publicar, mensagens, buscar.",
  },
  {
    id: "comecar",
    emoji: "✨",
    titulo: "Pode começar devagar",
    texto:
      "Dá para ficar só lendo o tempo que você quiser. Quando tiver vontade, o ＋ publica uma foto, e a lupa encontra alguém que você já conhece.",
  },
] as const;

/**
 * ⚠️ **O PREFIXO `dc-path-` NÃO É DECORAÇÃO — é o que faz o "já vi" VIAJAR.**
 *
 * Chaves com esse prefixo sobem no `journey_state`, então trocar de aparelho não
 * refaz o tutorial. Com uma chave comum de `localStorage`, a paciente que usa o
 * celular e o computador veria os quatro cartões de novo em cada um — e um
 * tutorial que reaparece ensina que os avisos deste app não valem leitura.
 */
export const CHAVE_ONBOARDING_COMUNIDADE = "dc-path-comunidade-vista";

/**
 * Ela deve ver o tutorial agora?
 *
 * ⚠️ **NUNCA EM MODO CUIDADO** — quem perdeu a gestação não abre o app para um
 * passeio guiado por uma rede social de gestantes. E o portão é conferido AQUI,
 * e não em cada ponto de uso: é a mesma lição de `humorDaJornada`, onde uma
 * segunda régua fazia carinha festiva aparecer para quem estava de luto.
 *
 * ⚠️ **E "não sei" NÃO abre o tutorial.** Enquanto o perfil não chegou do
 * servidor (`careMode` indefinido), a resposta é `false`: abrir e descobrir o
 * luto meio segundo depois mostraria os quatro cartões para exatamente quem eles
 * não podem alcançar. Falha fechada, como o resto da aba.
 */
export function deveVerOnboarding(entrada: {
  jaViu: boolean;
  careMode: boolean | undefined;
}): boolean {
  if (entrada.jaViu) return false;
  if (entrada.careMode !== false) return false;
  return true;
}

/**
 * ⚠️ **O PASSO NÃO PODE MORAR SÓ NO COMPONENTE, e a razão é a mesma do
 * tutorial do mascote — onde o dono viu o defeito.**
 *
 * O véu para em `z-38` e a barra de baixo continua clicável de propósito
 * (prender a paciente em quatro telas para poder usar uma aba que ela acabou de
 * abrir é a definição de tutorial ruim). Mas tocar num item da barra troca a
 * aba, `RedeNoApp` é desmontado, e com o índice num `useState` lá dentro voltar
 * à Comunidade recomeçava do primeiro cartão.
 *
 * ⚠️ **E a chave é `localStorage` COMUM, nunca `dc-path-`.** O "já vi" precisa
 * viajar entre aparelhos; o passo, não — ele é transitório e morre em minutos.
 * Subir um índice de tutorial no `journey_state` seria empurrar lixo para a
 * nuvem a cada toque em "Continuar".
 */
export function chaveDoPassoDaComunidade(uid: string | null): string {
  return `dc-comunidade-passo:${uid ?? "anon"}`;
}

/**
 * Prende o passo na faixa válida.
 *
 * ⚠️ **É FUNÇÃO PRÓPRIA porque `lerPassoDaComunidade` toca `window`**, e num
 * teste de Node ela sai por `typeof window === "undefined"` antes de chegar à
 * conta — a mutação que APAGAVA o `clamp` passava verde. Régua pura em `lib/`,
 * de novo, e pela mesma razão de sempre.
 *
 * Trata storage adulterado, `"abc"`, e um cartão removido depois de ela guardar
 * o passo.
 */
export function passoValido(cru: unknown): number {
  const n = Number(cru);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(CARTOES_DA_COMUNIDADE.length - 1, Math.floor(n)));
}

/** Lê o passo guardado, já preso na faixa válida. */
export function lerPassoDaComunidade(uid: string | null): number {
  if (typeof window === "undefined") return 0;
  try {
    return passoValido(localStorage.getItem(chaveDoPassoDaComunidade(uid)));
  } catch {
    return 0;
  }
}

/** O próximo passo, ou `null` quando acabou. Puro, para o teste alcançar. */
export function passoSeguinte(passo: number): number | null {
  const proximo = passo + 1;
  return proximo < CARTOES_DA_COMUNIDADE.length ? proximo : null;
}
