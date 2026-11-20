/**
 * O PLANO COMPLETO — a lista de uma vez só (20/11/2026, o dono: "uma venda
 * vitalícia [...] supondo que por ano é 99 [...] vitalício seria tipo 249").
 *
 * Aqui mora o que é GRÁTIS e o que é do PLANO COMPLETO. Para mudar, mude a
 * linha (`doPlano`), e só ela: o portão das telas, o convite e a tela de venda
 * leem desta lista. Funções puras, sem React nem StoreKit (o fuso dos testes é
 * America/Sao_Paulo, mas nada aqui depende de hora).
 *
 * Os produtos são da Apple (StoreKit). O Bundle ID continua
 * `br.com.obstetrica.app`; os três IDs abaixo são os que o dono cria no App
 * Store Connect.
 */

/** O plano que ela escolhe na tela de venda. */
export type Plano = "anual" | "mensal" | "vitalicio";

/** A ordem dos cartões na tela (o anual primeiro, escolhido). */
export const PLANOS: readonly Plano[] = ["anual", "mensal", "vitalicio"];

/**
 * Os IDs no App Store Connect. Anual e mensal são assinaturas que se renovam
 * sozinhas, no grupo "Plano Mãe Esperta"; o vitalício é um não consumível
 * (pagamento único).
 */
export const PRODUTOS: Readonly<Record<Plano, string>> = {
  anual: "br.com.obstetrica.app.plano.anual",
  mensal: "br.com.obstetrica.app.plano.mensal",
  vitalicio: "br.com.obstetrica.app.plano.vitalicio",
};

/** O nome do grupo de assinaturas no App Store Connect. */
export const GRUPO_DE_ASSINATURAS = "Plano Mãe Esperta";

/** A página de assinaturas da conta da Apple (cancelar, trocar de plano). */
export const GERENCIAR_ASSINATURAS = "https://apps.apple.com/account/subscriptions";

export const ASSINATURAS: readonly string[] = [PRODUTOS.anual, PRODUTOS.mensal];

export function ehAssinatura(plano: Plano): boolean {
  return plano !== "vitalicio";
}

export function planoDoProduto(id: string): Plano | null {
  for (const p of PLANOS) if (PRODUTOS[p] === id) return p;
  return null;
}

/* ── O que é grátis e o que é do plano completo ───────────────────────── */

type Recurso_ = {
  /** O nome para quem lê o código (e o relatório). */
  nome: string;
  /** Do plano completo (true) ou grátis (false). */
  doPlano: boolean;
  /**
   * Existe no app hoje. O que ainda não existe NÃO aparece na tela de venda
   * (a Apple, 3.1.2, e o CDC: vender só o que se entrega).
   */
  existe: boolean;
};

/**
 * A LISTA. Grátis: o coração do app (a semana do bebê, a Bolha, a aula de
 * hoje, a trilha, as amigas, o perfil) — o que traz de volta todo dia. Do
 * plano completo: os cuidados que vão além da aula (respirar, os sons da
 * noite, mexer, ler para o bebê, "Para vocês dois").
 *
 * ⚠️ Nunca entra aqui, nem como plano: o 192, os Termos, a Privacidade, a
 * cópia dos dados e excluir a conta. E no Modo Cuidado (luto) TUDO abre,
 * sem venda nenhuma (`decidirPortao`).
 */
export const RECURSOS = {
  semana: {
    nome: "A semana do bebê: o céu, o tamanho, a data provável",
    doPlano: false,
    existe: true,
  },
  bolha: { nome: "A Bolha e a conversa dela", doPlano: false, existe: true },
  aulaDeHoje: { nome: "A aula de hoje", doPlano: false, existe: true },
  trilha: { nome: "A trilha do dia", doPlano: false, existe: true },
  amigas: { nome: "As Amigas e a dupla", doPlano: false, existe: true },
  perfil: { nome: "O Perfil", doPlano: false, existe: true },
  /* Guardar uma coisa boa: não estava em nenhuma das duas listas do pedido.
     Fica grátis — é escrever uma linha, e é o "escrever" do Modo Cuidado. */
  gratidao: { nome: "Guardar uma coisa boa (gratidão)", doPlano: false, existe: true },
  meditar: { nome: "As pausas para respirar e meditar", doPlano: true, existe: true },
  sons: { nome: "Os sons e as histórias da noite", doPlano: true, existe: true },
  mexer: { nome: "Mexer o corpo", doPlano: true, existe: true },
  ler: { nome: "As leituras em voz alta para o bebê", doPlano: true, existe: true },
  casal: { nome: "Para vocês dois", doPlano: true, existe: true },
  /* Rever ou recuperar a aula de um dia que passou: o app ainda NÃO abre
     aula de dia passado para ninguém (`app/jornada/aula.tsx`: "só a aula de
     HOJE abre"). Fica na lista, do plano, e fora da tela de venda até
     existir. */
  reverAulas: {
    nome: "Rever ou recuperar as aulas dos dias que passaram",
    doPlano: true,
    existe: false,
  },
} as const satisfies Record<string, Recurso_>;

export type Recurso = keyof typeof RECURSOS;

export function ehDoPlano(recurso: Recurso): boolean {
  return RECURSOS[recurso].doPlano;
}

/* ── O portão ─────────────────────────────────────────────────────────── */

export type DecisaoDoPortao = "liberado" | "convite" | "esperando";

/**
 * O PORTÃO de uma atividade:
 * - chave desligada → liberado (nada muda para quem usa o app);
 * - Modo Cuidado (ou ainda não se sabe) → liberado: quem está de luto nunca
 *   recebe venda;
 * - recurso grátis → liberado;
 * - ainda não se sabe se ela tem o plano → esperando (um instante, sem piscar
 *   o convite para quem assina);
 * - tem o plano → liberado; não tem → o convite.
 */
export function decidirPortao(o: {
  chaveLigada: boolean;
  emCuidado: boolean;
  recurso: Recurso;
  conhecido: boolean;
  temPlano: boolean;
}): DecisaoDoPortao {
  if (!o.chaveLigada) return "liberado";
  if (o.emCuidado) return "liberado";
  if (!ehDoPlano(o.recurso)) return "liberado";
  if (!o.conhecido) return "esperando";
  return o.temPlano ? "liberado" : "convite";
}

/* ── O direito (ela TEM o plano completo?) ────────────────────────────── */

/** Uma compra como o StoreKit a devolve, só com o que importa aqui. */
export type CompraNoAparelho = {
  produto: string;
  /** Quando a assinatura vence (ms). Nulo: o StoreKit não disse. */
  expiraEm?: number | null;
  /** A Apple devolveu o dinheiro (ou revogou): não vale mais. */
  revogadaEm?: number | null;
};

/**
 * Tem o plano completo: uma assinatura nossa ainda valendo, ou o vitalício
 * comprado — e nenhum dos dois revogado. As compras vêm de
 * `getAvailablePurchases` com só as ativas, então a assinatura sem data de
 * vencimento conta como valendo.
 */
export function temPlanoCompleto(compras: readonly CompraNoAparelho[], agora: number): boolean {
  return compras.some((c) => {
    if (c.revogadaEm != null && c.revogadaEm > 0) return false;
    if (c.produto === PRODUTOS.vitalicio) return true;
    if (!ASSINATURAS.includes(c.produto)) return false;
    return c.expiraEm == null || c.expiraEm > agora;
  });
}

/* ── A navegação da tela de venda ─────────────────────────────────────── */

/** De onde ela veio: o funil antes do cadastro, um portão, o Perfil. */
export type Origem = "plano" | "portao" | "perfil";

export function origemValida(o: unknown): Origem | null {
  return o === "plano" || o === "portao" || o === "perfil" ? o : null;
}

/**
 * O `depois` que a tela aceita: uma rota DO APP ("/ritual", "/jornada"),
 * nunca um endereço de fora ("//site", "https://"). Inválido vale nada (e a
 * tela volta para trás).
 */
export function destinoDepois(depois: unknown): string | null {
  if (typeof depois !== "string") return null;
  const d = depois.trim();
  if (!d.startsWith("/") || d.startsWith("//") || d.includes("://") || d.includes("\\"))
    return null;
  return d;
}

/* ── O que a tela diz ─────────────────────────────────────────────────── */

/**
 * "Helena" ou "o bebê". Sem artigo antes do nome ("para você e Helena"):
 * "da Helena"/"do Pedro" diria o gênero do bebê, e o app nunca diz.
 */
export function paraOBebe(nomeDoBebe: string | null | undefined): string {
  const n = (nomeDoBebe ?? "").trim();
  return n ? n : "o bebê";
}

/** O título da tela de venda. */
export function tituloDaVenda(nomeDoBebe: string | null | undefined): string {
  return `Libere o plano completo para você e ${paraOBebe(nomeDoBebe)}`;
}

/** O apoio do título: bem-estar, sem promessa de efeito. */
export function subtituloDaVenda(nomeDela: string | null | undefined): string {
  const corpo = "mais momentos de calma e de vínculo, todos os dias, com a Bolha ao seu lado.";
  const n = (nomeDela ?? "").trim();
  return n ? `${n}, ${corpo}` : `${corpo.charAt(0).toUpperCase()}${corpo.slice(1)}`;
}

/** O que a tela de venda lista em "O que o plano completo traz" (só o que existe). */
export function itensDoPlano(nomeDoBebe: string | null | undefined): string[] {
  const bebe = paraOBebe(nomeDoBebe);
  const texto: Partial<Record<Recurso, string>> = {
    meditar: "Respirar e meditar com a Bolha",
    sons: "Sons e histórias para a hora de dormir",
    mexer: "Mexer o corpo, no seu ritmo",
    ler: `Leituras em voz alta para ${bebe}`,
    casal: "Para vocês dois, com quem acompanha você",
    reverAulas: "Rever as aulas dos dias que passaram",
  };
  return (Object.keys(RECURSOS) as Recurso[])
    .filter((r) => RECURSOS[r].doPlano && RECURSOS[r].existe && texto[r])
    .map((r) => texto[r]!);
}

/** O convite do portão: o título por atividade. */
export function tituloDoConvite(recurso: Recurso, nomeDoBebe: string | null | undefined): string {
  switch (recurso) {
    case "meditar":
      return "As pausas para respirar são do plano completo";
    case "sons":
      return "Os sons da noite são do plano completo";
    case "mexer":
      return "Mexer o corpo é do plano completo";
    case "ler":
      return `As leituras para ${paraOBebe(nomeDoBebe)} são do plano completo`;
    case "casal":
      return "O momento Para vocês dois é do plano completo";
    case "reverAulas":
      return "Rever as aulas que passaram é do plano completo";
    default:
      return "Isto é do plano completo";
  }
}

/** O apoio do convite: o que continua aberto, para ela não se sentir trancada fora. */
export const TEXTO_DO_CONVITE =
  "A aula de hoje, a trilha, a conversa com a Bolha e as amigas continuam abertas para você.";
