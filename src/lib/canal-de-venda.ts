/**
 * Quem compra o quê, e ONDE. A regra mora aqui e em nenhum outro lugar.
 *
 * ─── A divisão ──────────────────────────────────────────────────────────
 *
 *   PACIENTE  →  dentro do APP (iOS/Android), pela loja
 *   MÉDICO    →  no SITE, pelo Stripe
 *   CONSULTA  →  onde ela estiver — é serviço do mundo real
 *
 * A paciente usa só o app. O médico usa o app também, mas **não assina nele**:
 * o plano dele é B2B e se contrata no site. Isso não é preferência de produto,
 * é o que as lojas exigem — conteúdo digital consumido dentro do app passa
 * pela caixa registradora delas (Apple 3.1.1, Play Billing), e abrir o Stripe
 * ali dentro reprova na revisão.
 *
 * A **consulta particular é a exceção que vale dinheiro**: consulta é serviço
 * prestado no mundo real, não conteúdo digital, e as duas lojas isentam isso.
 * Ela continua em PIX/Mercado Pago mesmo dentro do app, sem comissão.
 *
 * ─── Por que um arquivo só ──────────────────────────────────────────────
 *
 * Esta regra estava espalhada por seis telas, cada uma com o seu `ehNativo()`
 * e o seu texto escrito à mão. Seis cópias de uma regra é uma regra que vai
 * divergir — e já divergiu uma vez: as quatro portas da paciente foram
 * fechadas num dia e as duas do médico ficaram abertas, porque naquele momento
 * eu tinha entendido que o app era só da paciente.
 *
 * ─── O que muda quando o IAP existir ────────────────────────────────────
 *
 * Uma linha: `IAP_ATIVO` vira `true`. As telas param de dizer "ainda não dá"
 * e passam a chamar a compra da loja. Nada mais neste arquivo muda, e nenhuma
 * outra tela precisa ser tocada.
 */

/** O que se vende. */
export type Produto =
  /** Assinatura Premium da paciente (aulas + prateleira do Cantinho). */
  | "premium_paciente"
  /** Pacote de Sementinhas — moeda virtual consumível. */
  | "sementinhas"
  /** Plano do médico (starter/pro/elite/black). */
  | "plano_medico"
  /** Consulta particular — serviço do mundo real. */
  | "consulta";

/** Onde a compra acontece. */
export type Canal =
  /** Dentro do app nativo, pela loja da Apple/Google. */
  | "app"
  /** No site, no navegador, pelo Stripe. */
  | "site"
  /** Tanto faz — não é conteúdo digital, nenhuma loja reivindica. */
  | "qualquer";

export const CANAL_DE: Record<Produto, Canal> = {
  premium_paciente: "app",
  sementinhas: "app",
  plano_medico: "site",
  consulta: "qualquer",
};

/**
 * O In-App Purchase já está implementado e aprovado?
 *
 * `false` hoje: não há Capacitor instalado, não há projeto iOS/Android, não há
 * produto cadastrado em loja nenhuma. Enquanto for `false`, as compras da
 * paciente ficam indisponíveis **e a tela diz isso em português** — em vez de
 * cair no Stripe por trás, que é o que reprovaria o app.
 *
 * Virar isto para `true` sem os produtos cadastrados quebra a compra da
 * paciente. Ver `docs/plano-iap.md`.
 */
export const IAP_ATIVO = false;

export type Veredito =
  | { pode: true }
  | {
      pode: false;
      /** Por que não — para log e teste, não para a tela. */
      motivo: "canal_errado" | "iap_indisponivel";
      /** O texto que a paciente ou o médico lê. */
      texto: string;
    };

/**
 * Esta compra pode acontecer neste canal?
 *
 * `estaNoApp` vem de `ehNativo()` no cliente. No servidor não se pergunta:
 * um checkout do Stripe **é** o canal "site" por definição, então lá se passa
 * `"site"` direto — e é isso que torna a regra impossível de burlar por
 * requisição forjada.
 */
export function podeComprar(produto: Produto, canal: Canal): Veredito {
  const esperado = CANAL_DE[produto];
  if (esperado === "qualquer") return { pode: true };

  if (canal !== esperado) {
    return {
      pode: false,
      motivo: "canal_errado",
      texto:
        esperado === "site"
          ? "Os planos são contratados no site, no navegador — não pelo aplicativo. Entre em obstetrica.com.br com esta mesma conta."
          : "Esta compra acontece dentro do aplicativo, pela loja da Apple ou do Google.",
    };
  }

  /* Canal certo, mas a loja ainda não está ligada. É o estado de hoje para a
     paciente, e a mensagem precisa dizer que a culpa não é dela — nem sugerir
     um caminho alternativo que a loja proibiria. */
  if (esperado === "app" && !IAP_ATIVO) {
    return {
      pode: false,
      motivo: "iap_indisponivel",
      texto:
        "A compra pelo aplicativo ainda está sendo preparada. Assim que estiver pronta, ela aparece aqui — e o que você já ganhou jogando continua seu.",
    };
  }

  return { pode: true };
}

/** Atalho para o cliente, que sabe se está no app mas não pensa em "canal". */
export function podeComprarAqui(produto: Produto, estaNoApp: boolean): Veredito {
  return podeComprar(produto, estaNoApp ? "app" : "site");
}
