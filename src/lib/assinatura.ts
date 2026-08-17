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
