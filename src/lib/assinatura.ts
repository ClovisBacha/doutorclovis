/**
 * DE ONDE VEIO A ASSINATURA — a régua pura, longe do JSX.
 *
 * ⚠️ ELA MORA AQUI, E NÃO NO COMPONENTE, e isso custou uma volta.
 *
 * `origemDaAssinatura` nasceu dentro de `assinatura-tab.tsx`. O teste a
 * importava de lá — e importar do componente puxa `sonner`, que toca
 * `document` ao carregar. O `bun test` inteiro caiu com
 * `document.getElementsByTagName is not a function`, derrubando NOVE testes de
 * outros arquivos junto.
 *
 * É o mesmo defeito que `buscar-paciente.ts` documenta (o `mesada-do-medico.tsx`
 * importa `sonner`) e que fez `frases-do-mascote.ts` e `gratidao.ts` nascerem
 * em `lib/`. A regra do repositório é constante: **régua pura em `lib/`,
 * componente só desenha.**
 */

/**
 * Os três caminhos possíveis, e cada um leva a um lugar diferente:
 *
 * · `loja` — Apple/Google. **É o caminho da paciente**, e o padrão.
 * · `stripe` — portal do Stripe. Do MÉDICO, no site.
 * · `presente` — o médico deu um ano; não há nada a gerenciar.
 */
export type OrigemDaAssinatura = "loja" | "stripe" | "presente";

/**
 * ⚠️ ESTE CLASSIFICADOR SUBSTITUIU UM BOOLEANO QUE ERRAVA DE DOIS JEITOS.
 *
 * A primeira versão perguntava só "é Stripe?" e tratava vazio como SIM:
 *
 * 1. **O PADRÃO ESTAVA INVERTIDO PARA A PACIENTE.**
 *    `CANAL_DE.premium_paciente` é `"app"`: o Premium dela se compra na loja da
 *    Apple/Google, e o Stripe é do médico, no site. A tela que usa isto vive no
 *    app da paciente — então "não sei a origem" tem de significar LOJA.
 *
 * 2. **FALTAVA UM TERCEIRO CASO QUE JÁ EXISTE EM PRODUÇÃO.** O webhook grava
 *    `source: "convite"` para a paciente que ganhou um ano de Premium pelo
 *    convite do médico (`plan: "convite_medico_1ano"`). Ela não paga nada e não
 *    tem o que gerenciar — e o botão do portal devolvia `sem_assinatura` para
 *    ela, um erro numa tela que deveria explicar um presente.
 */
export function origemDaAssinatura(source: string | null | undefined): OrigemDaAssinatura {
  const s = (source ?? "").trim().toLowerCase();
  if (s === "convite") return "presente";
  /* ⚠️ Só EXPLÍCITO vira Stripe. Ver o item 1 acima: o vazio pertence à loja. */
  if (s === "stripe" || s === "site") return "stripe";
  return "loja";
}

/**
 * O endereço OFICIAL de assinaturas de cada loja.
 *
 * ⚠️ LINK, E NÃO INSTRUÇÃO ESCRITA. A primeira versão da tela dizia "use
 * Ajustes → Apple ID → Assinaturas" em texto — e mandar alguém navegar quatro
 * níveis de menu do sistema, de cabeça, é o atrito que faz a paciente pedir
 * estorno no cartão em vez de cancelar.
 *
 * ⚠️ E É `https://`, NUNCA `itms-apps://`. O esquema nativo não existe no
 * navegador nem no Android — num app instalado como PWA, um link `itms-apps`
 * simplesmente não faz nada, sem erro nenhum. O `https` da Apple redireciona
 * para a tela nativa no iPhone e continua sendo página útil em qualquer lugar.
 */
export const ASSINATURAS_DA_LOJA = {
  apple: "https://apps.apple.com/account/subscriptions",
  google: "https://play.google.com/store/account/subscriptions",
} as const;

/** A loja pela qual ela assinou — decide para onde o botão aponta. */
export function lojaDaAssinatura(source: string | null | undefined): "apple" | "google" {
  return (source ?? "").toLowerCase().includes("google") ? "google" : "apple";
}

/* ══════════════════════════════════════════════════════════════════════════
   O SELO DE ASSINANTE NA COMUNIDADE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O SELO QUE APARECE AO LADO DO NOME DE QUEM ASSINA.
 *
 * Pedido do dono: "o selo que pode se ganhar deve estar atrelado a pessoa
 * pagando o premium".
 *
 * ─── ⚠️ ELE NÃO É O SELO DO CONSULTÓRIO ─────────────────────────────────────
 *
 * São duas marcas diferentes e não podem parecer a mesma: a oficial identifica
 * a CLÍNICA (uma conta só, coluna própria, escrita revogada do navegador); esta
 * identifica uma assinante. Forma e cor distintas — senão a paciente lê "conta
 * oficial" onde está escrito "assinante", e o selo institucional deixa de valer
 * alguma coisa.
 *
 * ─── ⚠️ E ELE NUNCA É UMA COLUNA ────────────────────────────────────────────
 *
 * `patient_profiles` é escrita direto do navegador em vários pontos do app, e a
 * policy de LINHA não distingue COLUNA. Uma coluna `tem_selo` cairia no mesmo
 * buraco que `conta_oficial` teve: qualquer paciente se daria o selo com um
 * `UPDATE`. Aqui ele é DERIVADO da assinatura, no servidor, a cada leitura.
 *
 * Derivar tem um segundo ganho: o selo **some sozinho** quando a assinatura
 * acaba. Uma coluna carimbada ficaria mentindo por meses, e ninguém repara num
 * selo a mais.
 */
export const SELO_PREMIUM = "Assinante";

/** O que a linha de `subscriptions` precisa dizer para o selo existir. */
export type FatosDaAssinante = {
  /** `status` da linha — `active`, `trialing`, `canceled`, … */
  status: string | null | undefined;
  /** Até quando o período pago vale. */
  ateQuando: string | null | undefined;
  /** `source` da linha — o que separa quem paga de quem ganhou. */
  origem: string | null | undefined;
};

/**
 * Os status que significam "está pagando agora".
 *
 * ⚠️ `trialing` ENTRA. Quem está no teste de uma assinatura recorrente já deu o
 * cartão e vai ser cobrada; tirá-la do selo por sete dias e devolvê-lo depois
 * seria o app piscando um símbolo social na cara dela.
 *
 * ⚠️ E `canceled` NÃO entra, mesmo dentro do período pago. Aqui o selo difere
 * do ACESSO de propósito: `AssinaturaTab` já ensina que "tem acesso" ≠ "está
 * pagando", e este selo é sobre a segunda coisa. Quem cancelou continua com
 * tudo que pagou até o fim do período — só não carrega mais a marca de
 * assinante ativa.
 */
const STATUS_PAGANDO = new Set(["active", "trialing"]);

/**
 * Ela carrega o selo?
 *
 * ⚠️ **O PRESENTE DO MÉDICO CONTA**, e esta é a única decisão de produto aqui.
 * A paciente que ganhou um ano de Premium pelo convite do obstetra
 * (`source: "convite"`) não paga nada — mas é assinante ativa, e distinguir
 * criaria uma segunda classe DENTRO do Premium, visível para todo mundo, sobre
 * um presente que o médico deu a ela. Numa comunidade de gestação de alto risco
 * isso é pior que o ganho.
 *
 * Se um dia a decisão for o contrário, é uma linha: recusar `"presente"` aqui.
 *
 * ⚠️ **Sem linha nenhuma NÃO tem selo** — e é o caso da maioria. `null` e
 * `undefined` caem no mesmo lugar, sem exceção de conveniência.
 */
export function temSeloPremium(
  f: FatosDaAssinante | null | undefined,
  agora = Date.now(),
): boolean {
  if (!f) return false;
  if (!STATUS_PAGANDO.has((f.status ?? "").trim().toLowerCase())) return false;
  /* Sem data de fim, a assinatura é corrente e válida — é o que a loja grava
     enquanto a renovação está em dia. */
  if (!f.ateQuando) return true;
  const fim = new Date(f.ateQuando).getTime();
  /* ⚠️ Data ilegível NÃO tira o selo: o estrago de tirar por engano recai sobre
     quem está pagando, e um selo a mais por um dia não custa nada. É a mesma
     direção de `planoVigente`. */
  if (!Number.isFinite(fim)) return true;
  return fim >= agora;
}
