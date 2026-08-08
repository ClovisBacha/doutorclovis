/**
 * Entitlements por plano — fonte única de verdade das capacidades de cada
 * plano de médico. Módulo isomórfico (sem imports server-only): serve tanto
 * para os gates no servidor quanto para mostrar/bloquear recursos na UI.
 *
 * Valores de plano gravados em `doctors.plan`:
 *   trial | free | starter | pro | clinica | elite | black
 * O card "Pro Equipe" da página de vendas corresponde ao plano `clinica`.
 * Plano desconhecido cai em `free` (o mais restritivo) — nunca libera demais.
 *
 * ─── NÃO HÁ MAIS TETO DE PACIENTES, EM NENHUM PLANO ────────────────────────
 *
 * `maxPatients` é `null` em todos. O eixo saiu do produto por decisão do dono, e
 * a medição confirmou que ele nunca protegeu nada que importasse: uma paciente
 * ativa custa R$ 0,024 por mês em banco, egresso e funções somados — menos que
 * UMA mensagem de IA (R$ 0,027). Ver `docs/custo-de-infraestrutura.md`.
 *
 * O campo continua existindo porque a tela lê e o contrato de Clínica pode um
 * dia precisar dele. O que não existe mais é um plano que o use.
 *
 * O que separa os planos hoje: a IA. Free não tem; os demais têm, e o quanto
 * vem da quantidade comprada.
 *
 * ─── O QUE SE VENDE HOJE É `mensagens` ──────────────────────────────────────
 * Os planos nomeados acima são LEGADO: continuam na tabela porque há médicos
 * gravados neles. A escada nova tem um eixo só — mensagens de IA por mês,
 * R$ 29,90 na entrada (150) até R$ 339,40 (2.500) — e vive em
 * `src/lib/planos-medico.ts`. Acima do topo, é contrato de Clínica.
 */
import { ENTRADA_MENSAGENS, precoDe } from "./planos-medico";

export type PlanKey =
  | "trial"
  | "free"
  | "mensagens"
  | "essencial"
  | "starter"
  | "pro"
  | "clinica"
  | "elite"
  | "black";

export type Entitlements = {
  /** Rótulo curto para UI. */
  label: string;
  /** Máximo de pacientes ativas por médico (null = ilimitado). */
  maxPatients: number | null;
  /** Máximo de cérebros/médicos na conta ou clínica (null = ilimitado). */
  maxBrains: number | null;
  /** Segundo Cérebro (IA) responde as pacientes no app. */
  aiApp: boolean;
  /** Agente de IA atende e agenda no WhatsApp. */
  aiWhatsapp: boolean;
  /* ─── `clinicalToolsAdvanced` e `dashboardAdvanced` SAÍRAM ────────────────
     Eram dois booleanos da tabela de capacidades, e uma varredura no
     repositório não achou UM consumidor fora deste arquivo. Nenhuma tela lia,
     nenhum gate checava: o Free "não tinha ferramentas clínicas avançadas" e
     usava todas elas.

     Uma bandeira que não bloqueia nada é pior que uma ausente — ela faz a
     tabela mentir sobre o próprio produto, e quem lê para decidir um plano
     decide errado. Se um dia essas ferramentas virarem diferencial de plano,
     o campo volta junto com o gate que o aplica, não antes. */
  /** Suporte prioritário. */
  prioritySupport: boolean;
  /** Vários médicos numa conta só (assentos de equipe). */
  teamSeats: boolean;
  /** Convites premium que o médico pode dar às pacientes por mês (0 = nenhum). */
  premiumInvitesPerMonth: number;
  /** Selo de verificação exibido às pacientes ("" = sem selo). */
  badge: "" | "Starter" | "Pro" | "Elite" | "Black";
  /** Gerente de conta dedicado. */
  dedicatedManager: boolean;
  /**
   * Respostas da IA que o médico tem por ciclo (`null` = ilimitado).
   *
   * ─── Por que MENSAGEM e não token ────────────────────────────────────────
   * Token é o que a plataforma paga; mensagem é o que o médico entende. Vender
   * em token seria vender numa unidade que ninguém sabe estimar — e um plano
   * que o comprador não consegue dimensionar não é um plano, é uma aposta.
   * A conversão vive na leitura de `ai_usage`, que grava as duas coisas: quem
   * consumiu e quantos tokens custou. É de lá que sai a margem real.
   *
   * ─── Por que o teto existe ───────────────────────────────────────────────
   * Sem ele, "pacientes ilimitadas" é uma promessa cujo custo é ilimitado
   * também. O teto não serve para limitar o médico — serve para o preço ser
   * verdadeiro.
   */
  aiRepliesPerCycle: number | null;
};

/**
 * FREE — a plataforma de gestão inteira, sem a IA.
 *
 * ─── O QUE MUDOU, E POR QUE ESTAVA ERRADO ANTES ─────────────────────────────
 *
 * Ele tinha teto de 5 PACIENTES e duas bandeiras desligadas
 * (`clinicalToolsAdvanced`, `dashboardAdvanced`). As três saíram, por razões
 * diferentes:
 *
 *  · **O teto de 5 pacientes** existia como limite de negócio numa época em que
 *    o plano se vendia por número de gestantes. Esse eixo saiu do produto. E o
 *    que ele passou a fazer, na prática, era outra coisa: era a única coisa que
 *    limitava o vazamento do chat, que chamava o modelo mesmo sem plano. Esse
 *    vazamento foi fechado no `chat.ts` — sem plano, sem chamada de modelo — e
 *    com ele fechado o teto perdeu a função. Cinco pacientes também tornavam o
 *    Free inútil como plataforma de gestão, que é justamente o que ele precisa
 *    ser para atrair quem depois assina.
 *
 *  · **As duas bandeiras avançadas não bloqueavam nada.** Uma varredura no
 *    repositório não achou UM consumidor fora deste arquivo: elas eram
 *    decorativas, e uma tabela de capacidades que mente sobre o próprio produto
 *    é pior que uma incompleta. Ligadas, dizem a verdade.
 *
 * ─── E O CUSTO DISSO? MEDIDO ────────────────────────────────────────────────
 *
 * R$ 0,024 por paciente ativa por mês — banco, egresso e funções somados; menos
 * que UMA mensagem de IA. Um médico no Free com 20 pacientes custa R$ 0,47 por
 * mês; com 100, R$ 2,36. A conta inteira está em
 * `docs/custo-de-infraestrutura.md`.
 *
 * Free não é o problema de custo. A IA é — e a IA fica atrás do plano.
 */
const FREE: Entitlements = {
  label: "Free",
  /* Sem teto: o eixo "número de pacientes" saiu do produto inteiro. */
  maxPatients: null,
  maxBrains: 1,
  /* A ÚNICA coisa que o Free não tem, e a única que custa dinheiro. */
  aiApp: false,
  aiWhatsapp: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "",
  dedicatedManager: false,
  /* Sem IA no plano: o teto é zero, não `null` — `null` quer dizer ilimitado. */
  aiRepliesPerCycle: 0,
};

/**
 * Essencial — o primeiro degrau pago.
 *
 * ─── O buraco que ele preenche ──────────────────────────────────────────
 *
 * Entre o Free (5 pacientes, SEM IA nenhuma) e o Starter (50 pacientes, R$149)
 * não havia nada. O obstetra que está começando não tinha como experimentar o
 * Segundo Cérebro sem saltar direto para o plano de R$149 — e é justamente ele
 * quem traz as primeiras pacientes para a plataforma.
 *
 * ─── SÃO DOIS LIMITES, e este texto dizia que era um ───────────────────
 *
 * O parágrafo aqui defendia limitar por PACIENTE e não por uso da IA — e
 * argumentava que racionar "ensinaria o médico que a IA é escassa". Vinte e seis
 * linhas abaixo, o código raciona: `aiRepliesPerCycle: 500`.
 *
 * O comentário descrevia uma versão do plano que não existe mais, e ficou. Numa
 * base em que a prosa é longa e confiante, isso é pior que não ter comentário:
 * quem lê acredita.
 *
 * O que vale hoje: **15 pacientes E 500 respostas de IA por ciclo**, e os dois
 * fazem trabalho diferente.
 *
 * `maxPatients` é o limite de NEGÓCIO — ele define para quantas gestantes este
 * preço faz sentido, é aplicado em todo lugar e custa zero para checar. O
 * upgrade acontece SOZINHO: quem gosta chega a 15 pacientes em poucas semanas e
 * sobe sem se sentir punido.
 *
 * `aiRepliesPerCycle` é o limite de CUSTO — ele existe porque cada resposta é
 * uma chamada de modelo que a plataforma paga, e 500 delas a R$ 49,90 dão
 * cerca de R$ 0,10 por resposta. Sem esse teto, uma única gestante muito
 * conversadora tornaria o plano deficitário sozinha.
 *
 * A preocupação do texto antigo continua válida e virou desenho: quando as 500
 * acabam, a IA NÃO some para a paciente — ela continua respondendo com
 * informação obstétrica consolidada, sem a voz do médico, com prazo e caminho
 * até ele. O médico nunca descobre o limite pelo silêncio dela.
 *
 * ─── E por que ele NÃO tem as ferramentas avançadas ─────────────────────
 *
 * É a segunda razão de o Starter existir — sem isso, a única diferença entre os
 * dois seria o número de pacientes, e aí a conta por paciente favorece tanto o
 * Starter (R$2,98 contra R$3,33) que o Essencial não venderia.
 *
 * A tensão é real e vale estar escrita: este é um app de alto risco, e biometria
 * fetal, EPDS, DMG e pré-eclâmpsia são o que um obstetra de alto risco usa. A
 * aposta é que o Essencial é para quem está começando NA PLATAFORMA, e que é o
 * primeiro caso de alto risco que empurra para o Starter — que é exatamente o
 * momento em que subir faz sentido para ele.
 */
const ESSENCIAL: Entitlements = {
  label: "Essencial",
  maxPatients: null,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "",
  dedicatedManager: false,
  /* 500 respostas ≈ R$ 0,10 por resposta no preço de R$ 49,90. */
  aiRepliesPerCycle: 500,
};

const STARTER: Entitlements = {
  label: "Starter",
  maxPatients: null,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: false,
  prioritySupport: false,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "Starter",
  dedicatedManager: false,
  aiRepliesPerCycle: 1_500,
};

const PRO: Entitlements = {
  label: "Pro",
  maxPatients: null,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: true,
  prioritySupport: true,
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "Pro",
  dedicatedManager: false,
  aiRepliesPerCycle: 4_000,
};

// Elite = Pro + equipe + 25 convites premium/mês + selo "Elite".
const ELITE: Entitlements = {
  ...PRO,
  label: "Reconhecido",
  maxPatients: null,
  maxBrains: 5,
  teamSeats: true,
  premiumInvitesPerMonth: 25,
  badge: "Elite",
  aiRepliesPerCycle: 10_000,
};

// Black = o plano mais alto: tudo do Elite + 250 convites premium/mês, gerente
// de conta dedicado e selo "Black" exclusivo. Topo absoluto da busca.
const BLACK: Entitlements = {
  ...ELITE,
  label: "Black",
  maxPatients: null,
  maxBrains: 20,
  premiumInvitesPerMonth: 250,
  badge: "Black",
  dedicatedManager: true,
  aiRepliesPerCycle: 30_000,
};

// Clínica = plano personalizado (orçamento por contrato). Sem tetos rígidos:
// pacientes e médicos são acordados no fechamento, então null/null (a conta é
// provisionada pela nossa equipe já com o combinado).
const CLINICA: Entitlements = {
  /* ─── HERDA DE BLACK, NÃO DE PRO ─────────────────────────────────────────
   * A escada não era monotônica: `Clínica` fica ACIMA de `Elite` no
   * `PLAN_RANK` e herdava de `PRO` — ou seja, entregava `premiumInvitesPerMonth: 0`
   * e o selo "Pro" enquanto o Elite, abaixo dela, dá 25 convites e o selo
   * "Elite". Subir de plano rebaixava o médico em dois eixos.
   * Era também a causa da exceção "só sobe quem está abaixo do Elite" no
   * assento de clínica: a exceção existia para contornar a escada quebrada. */
  ...BLACK,
  label: "Clínica",
  maxPatients: null,
  maxBrains: null,
  teamSeats: true,
  prioritySupport: true,
  dedicatedManager: true,
  /* Contrato sob medida: o teto é combinado, não tabelado. */
  aiRepliesPerCycle: null,
};

// Trial = experimenta o Pro por 14 dias (mesmas capacidades do Pro), mas SEM
// selo — quem está só testando não exibe "Pro verificado" às pacientes.
/* O trial herda as CAPACIDADES do Pro, mas não o teto dele: são coisas
   diferentes. Capacidade é o que ele pode experimentar; teto é quanto a
   plataforma paga para que ele experimente. Médico novo não entra mais em
   trial — isto vale só para quem já estava dentro quando a porta fechou. */
const TRIAL: Entitlements = { ...PRO, label: "Trial", badge: "", aiRepliesPerCycle: 500 };

/**
 * MENSAGENS — o plano que está no ar, e o único que ainda se vende.
 *
 * ─── ELE NÃO É UM DEGRAU DA ESCADA ACIMA; ELE A SUBSTITUI ───────────────────
 *
 * Essencial/Starter/Pro/Elite/Black vendiam DOIS eixos ao mesmo tempo: número
 * de pacientes e capacidades. Os dois foram retirados por decisão de produto —
 * "não vai ter mais número de pacientes" — e o que sobrou foi um eixo só:
 * quantas mensagens de IA o médico compra por mês.
 *
 * Por isso `maxPatients: null`. Não é generosidade de plano caro: é que o teto
 * de pacientes deixou de existir como produto. Os planos nomeados continuam na
 * tabela porque há médicos gravados neles, e um plano que some da tabela vira
 * `free` em silêncio — o defeito que o comentário do webhook descreve.
 *
 * ─── `aiRepliesPerCycle` AQUI É PISO, NÃO ENTREGA ───────────────────────────
 *
 * O que ele realmente recebe é `doctors.ai_messages_per_cycle`, escrito pelo
 * webhook a partir de `subscription.items.data[0].quantity`, e aplicado por
 * `comMensagensCompradas` (`entitlements.server.ts`) nos dois pontos de entrada.
 *
 * O valor aqui é o que vale quando a coluna não pode ser lida — migration ainda
 * não aplicada, falha de rede. Ser a ENTRADA da escada (150) e não zero é
 * deliberado: quem pagou fica com o degrau mínimo, nunca sem IA nenhuma. E ser
 * a entrada, e não o topo, mantém a direção que esta base já escolheu — errar
 * concedendo de MENOS, que o médico reclama e a gente conserta.
 */
const MENSAGENS: Entitlements = {
  label: "Obstetrícia",
  maxPatients: null,
  maxBrains: 1,
  aiApp: true,
  aiWhatsapp: true,
  prioritySupport: true,
  /* Equipe e gerente dedicado são o que separa este plano do contrato de
     Clínica — sem isso, Clínica não teria o que vender. */
  teamSeats: false,
  premiumInvitesPerMonth: 0,
  badge: "Pro",
  dedicatedManager: false,
  aiRepliesPerCycle: ENTRADA_MENSAGENS,
};

export const PLAN_ENTITLEMENTS: Record<PlanKey, Entitlements> = {
  trial: TRIAL,
  free: FREE,
  mensagens: MENSAGENS,
  essencial: ESSENCIAL,
  starter: STARTER,
  pro: PRO,
  clinica: CLINICA,
  elite: ELITE,
  black: BLACK,
};

/**
 * A equipe da instalação (ADMIN_EMAILS) tem acesso total — é a conta dona
 * da plataforma (ex.: o médico fundador + secretária), nunca um assinante limitado.
 */
export const OWNER_ENTITLEMENTS: Entitlements = {
  ...BLACK,
  label: "Instalação",
  maxPatients: null,
  maxBrains: null,
};

/** Ordem de prioridade dos planos (maior = melhor) — usado no ranking da busca. */
/**
 * Preço mensal de lista de cada plano do médico, em reais (jul/2026).
 *
 * Mora aqui, e não no módulo de servidor onde nasceu, porque o PAINEL precisa
 * dele: a prova de valor compara o tempo economizado com o que ele paga, e essa
 * comparação acontece na tela. Preço em dois arquivos é a divergência clássica —
 * um sobe, o outro fica, e a tela passa a mentir sobre a própria cobrança.
 *
 * Clínica é "sob consulta": zero aqui significa "não dá para comparar", e as
 * telas tratam zero como "não mostrar", nunca como "de graça".
 */
export const PLAN_PRICE: Record<string, number> = {
  trial: 0,
  free: 0,
  /* A ENTRADA da escada, e só ela. O que o médico paga de verdade depende de
     quantas mensagens comprou — quem sabe disso é `mensalidadeCentavos`, que
     recebe a quantidade. Este número é o piso, usado quando a quantidade não é
     conhecida (por exemplo, um médico cuja coluna ainda não foi preenchida). */
  mensagens: 29.9,
  /* R$102 existe só como âncora riscada na tela de vendas — o preço COBRADO é
     este. Ancorar em 102 e cobrar 102 colocaria o plano a 31% do Starter, perto
     demais para abrir um segmento: por paciente sairia R$6,80 contra R$2,98 do
     Starter, e quem faz a conta sobe. A um terço do Starter, é outro público. */
  essencial: 49.9,
  starter: 149,
  pro: 297,
  clinica: 0,
  elite: 597,
  black: 1499,
};

/**
 * Mensalidade do plano em CENTAVOS.
 *
 * Normaliza igual a `normalizePlan` — e isso não é preciosismo: enquanto esta
 * função indexava o dicionário cru, um `doctors.plan` gravado como `"Pro"` ou
 * `" pro"` dava entitlements de Pro e mensalidade ZERO, e a prova de valor
 * sumia da tela de um assinante pagante. Duas normalizações diferentes para a
 * mesma coluna, a vinte linhas de distância.
 */
export function mensalidadeCentavos(
  plan: string,
  /**
   * `doctors.ai_messages_per_cycle` — quantas mensagens ele comprou.
   *
   * ─── POR QUE ESTE PARÂMETRO PRECISOU EXISTIR ────────────────────────────
   * `PLAN_PRICE` é uma tabela de plano→preço, e o plano `mensagens` não tem UM
   * preço: tem uma escada de R$ 29,90 a R$ 339,40. Sem a quantidade, os dois
   * lugares que usam esta função passariam a mentir na mesma direção — o painel
   * diria "sua mensalidade é R$ 29,90" a quem paga R$ 339,40, e o MRR do
   * fundador contaria um décimo do que entra.
   */
  mensagensCompradas?: number | null,
): number {
  const p = (plan ?? "")
    .trim()
    .toLowerCase()
    .replace(/_annual$/, "");
  const chave = /^(enterprise|equipe|clinic)$/.test(p) ? "clinica" : p;
  if (chave === "mensagens" && typeof mensagensCompradas === "number") {
    /* `precoDe` já trava nas duas pontas da escada; um valor fora dela não vira
       preço absurdo, vira a ponta mais próxima. */
    return precoDe(mensagensCompradas);
  }
  return (PLAN_PRICE[chave] ?? 0) * 100;
}

export const PLAN_RANK: Record<PlanKey, number> = {
  free: 0,
  trial: 1,
  /* ─── `mensagens` FICA ACIMA DOS NOMEADOS, E ABAIXO DE BLACK/CLÍNICA ───────
   *
   * O rank ordena a busca que a PACIENTE vê. `mensagens` é o único plano que
   * ainda se vende, então ele precisa passar à frente dos legados que ninguém
   * mais assina. Não passa à frente de Black nem de Clínica porque esses dois
   * são contratos ativos de valor maior, e rebaixá-los seria punir quem paga
   * mais por uma mudança de tabela que não foi escolha deles.
   *
   * O teste de pares (`escada-de-planos.test.ts`) NÃO compara este plano com os
   * nomeados, e o motivo está escrito lá: os eixos são outros. Comparar 150
   * mensagens de piso com as 10.000 do Elite compara o número errado — a
   * entrega dele vem da coluna, não desta tabela. */
  mensagens: 6,
  essencial: 2,
  starter: 3,
  pro: 4,
  elite: 5,
  black: 7, // o mais caro da TABELA
  /* ─── `clinica` VOLTA AO TOPO, e a razão da demoção deixou de existir ─────
   *
   * Ela tinha sido movida para BAIXO do Black com este argumento: "o preço dela
   * é sob consulta e o Black custa R$ 1.499 — e o assento de clínica é
   * concedido AUTOMATICAMENTE a qualquer membro de uma clínica ativa; um
   * assento de valor indefinido passava na frente de quem paga o plano mais
   * caro da tabela, na busca que a paciente vê".
   *
   * O argumento estava certo, e atacava o sintoma. O problema real era o
   * assento: `planRowFor` escrevia `plan = "clinica"` fixo para qualquer membro
   * de clínica ativa — ou seja, IA ilimitada e pacientes ilimitadas, de graça.
   * Agora o assento herda o plano do DONO da clínica, com o vencimento dele
   * junto. Ninguém mais ganha `clinica` sem que alguém tenha contratado.
   *
   * Com isso, manter `clinica` abaixo do Black passou a produzir o defeito que
   * a demoção queria evitar, invertido: o de cima (Black) entrega 500 pacientes
   * e 30.000 respostas, e o de baixo (Clínica) entrega ilimitado nos dois. Um
   * teste de pares — `escada-de-planos.test.ts` — encontrou isso.
   */
  clinica: 8,
};

/** Normaliza um valor livre de `doctors.plan` para uma PlanKey conhecida. */
export function normalizePlan(plan: string | null | undefined): PlanKey {
  const p = (plan ?? "").trim().toLowerCase();
  if (
    p === "trial" ||
    p === "free" ||
    p === "mensagens" ||
    p === "essencial" ||
    p === "starter" ||
    p === "pro" ||
    p === "clinica" ||
    p === "elite" ||
    p === "black"
  ) {
    return p;
  }
  // Aliases da página de vendas / legado → plano de clínica.
  if (p === "enterprise" || p === "equipe" || p === "clinic") return "clinica";
  return "free";
}

/** Entitlements de um valor de plano (aceita valores livres/legados). */
export function entitlementsFor(plan: string | null | undefined): Entitlements {
  return PLAN_ENTITLEMENTS[normalizePlan(plan)];
}

/** Selo do médico (para as pacientes) a partir do valor de plano. */
export function badgeForPlan(
  plan: string | null | undefined,
): "" | "Starter" | "Pro" | "Elite" | "Black" {
  return entitlementsFor(plan).badge;
}
