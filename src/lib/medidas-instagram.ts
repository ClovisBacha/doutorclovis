/**
 * AS MEDIDAS DO MODELO INSTAGRAM — num lugar só, com a origem de cada uma.
 *
 * Pedido do dono: "vamos copiar exatamente o modelo do Instagram, as dimensões
 * da bolinha dos stories, as dimensões de tudo".
 *
 * ─── ⚠️ O QUE ESTES NÚMEROS SÃO, E O QUE NÃO SÃO ───────────────────────────
 *
 * São as **proporções de conteúdo publicadas** (grade 3:4, avatar 1:1, story
 * 9:16, três colunas) mais as medidas de interface que a documentação de
 * design descreve. **Não** saíram de um decompilador nem de uma régua sobre um
 * print do app — eu não tenho o app do Instagram para medir, e dizer que saíram
 * seria mentir sobre a precisão.
 *
 * A consequência prática: a ESTRUTURA e as PROPORÇÕES batem; um pixel ou outro
 * de padding pode diferir. Se o dono quiser o encaixe fino, o caminho é ele
 * mandar um print e a gente comparar com `scripts/comparar-com-referencia.mjs`,
 * que é para isso que a bancada existe.
 *
 * ─── ⚠️ E POR QUE OS NÚMEROS MORAM AQUI ────────────────────────────────────
 *
 * Espalhados pelo JSX, viram `w-[86px]` em quatro arquivos e divergem no
 * primeiro ajuste — e uma grade cujo gap difere entre a tela do perfil e a
 * bancada é uma grade que ninguém consegue conferir. Aqui eles são um valor,
 * com o motivo ao lado, e o teste cobra as relações que precisam se sustentar.
 */

/* ══════════════════════════════════════════════════════════════════════════
   PROPORÇÕES DE CONTEÚDO — as publicadas pelo próprio Instagram
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A grade do perfil. Era 1:1 (quadrado) e virou **3:4 (retrato)** na mudança
 * de 2025 — 1080×1350. Quem construir quadrado hoje faz um Instagram de 2024.
 */
export const RAZAO_DA_GRADE = 3 / 4;

/** O post do feed: 1080×1350, a mesma 4:5 de sempre. */
export const RAZAO_DO_POST = 4 / 5;

/** Story e reels: 1080×1920. */
export const RAZAO_DO_STORY = 9 / 16;

/** Foto de perfil: quadrada, mínimo 320×320, exibida em círculo. */
export const LADO_MINIMO_DO_AVATAR = 320;

/* ══════════════════════════════════════════════════════════════════════════
   INTERFACE
   ══════════════════════════════════════════════════════════════════════════ */

/** Três colunas no celular. Quatro a seis no computador. */
export const COLUNAS_DA_GRADE = 3;

/**
 * O vão entre as células.
 *
 * ⚠️ Dois pixels, e não zero: colado, o olho lê a grade como UMA imagem
 * recortada em vez de nove fotos. E não mais que isso — a grade do Instagram é
 * densa de propósito, porque o que ela vende é a soma, não cada foto.
 */
export const VAO_DA_GRADE = 2;

/** O avatar grande, no alto do perfil. */
export const AVATAR_DO_PERFIL = 86;

/**
 * A bolinha do story, na fileira horizontal.
 *
 * O anel fica FORA dela: 64 de foto + 2 de vão + 2 de anel = 72 de caixa. Sem
 * o vão, o anel encosta na foto e lê como borda da imagem, não como anel.
 */
export const FOTO_DO_STORY = 64;
export const VAO_DO_ANEL = 2;
export const ESPESSURA_DO_ANEL = 2;

/** O diâmetro total da bolinha com anel — o que ocupa lugar na fileira. */
export const CAIXA_DO_STORY = FOTO_DO_STORY + 2 * (VAO_DO_ANEL + ESPESSURA_DO_ANEL);

/** O avatar pequeno, no cabeçalho de cada post do feed. */
export const AVATAR_DO_POST = 32;

/** A barra de cima e a fileira de abas do perfil. */
export const ALTURA_DA_BARRA = 44;
export const ALTURA_DAS_ABAS = 44;

/* ══════════════════════════════════════════════════════════════════════════
   O ANEL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **O anel usa a paleta DESTE app, não o degradê do Instagram.**
 *
 * O degradê laranja-rosa-roxo é a marca deles — é a coisa mais reconhecível da
 * interface, e é exatamente o que não se copia. Um app de gestação com o anel
 * do Instagram lê como imitação, não como referência.
 *
 * O que se copia é a ESTRUTURA (bolinha com anel, anel aceso = tem coisa nova,
 * anel apagado = já vi), que é convenção de interface e funciona porque todo
 * mundo já sabe ler.
 */
export const ANEL_NOVO = ["#F0A6C0", "#C0356A"] as const;
/** Já visto: cinza, sem degradê. */
export const ANEL_VISTO = "#D8D0D4";

/* ══════════════════════════════════════════════════════════════════════════
   AS ABAS DO PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ **DUAS abas, não quatro.**
 *
 * O Instagram tem quatro (posts, reels, marcações, e a nova aba única de 2026)
 * porque tem quatro TIPOS de conteúdo. Este app tem um: foto com legenda. Três
 * abas vazias ao lado de uma cheia não copiam o Instagram — copiam a aparência
 * dele e entregam a sensação de um app pela metade.
 *
 * A segunda aba é a do BEBÊ, e é a que o Instagram não tem: os marcos da
 * gestação dela. É o único lugar da tela em que fazer diferente é melhor.
 */
export const ABAS_DO_PERFIL = [
  { chave: "grade", rotulo: "Publicações" },
  { chave: "bebe", rotulo: "Do bebê" },
] as const;

export type AbaDoPerfil = (typeof ABAS_DO_PERFIL)[number]["chave"];

/**
 * Os números do cabeçalho do perfil.
 *
 * ⚠️ **`seguidores` e `seguindo` só aparecem no PRÓPRIO perfil.** O Instagram
 * mostra para todo mundo; aqui não, e a razão está pesquisada: um placar
 * público de audiência num app de gestação de alto risco mede popularidade num
 * momento em que a pessoa já está sendo medida clinicamente, e dá número
 * objetivo a uma comparação que sem número seria só sensação.
 *
 * `publicacoes` aparece sempre — é sobre o que ela fez, não sobre quantas
 * pessoas a acham interessante.
 *
 * É a ÚNICA divergência deliberada do modelo. Reverter é trocar este `false`
 * por `true`, e o teste que a protege diz por que não.
 */
export const NUMEROS_PUBLICOS = {
  publicacoes: true,
  seguidores: false,
  seguindo: false,
} as const;
