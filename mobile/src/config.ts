/**
 * Configuração pública do app. Nada aqui é segredo: a URL e a chave
 * "publishable" do Supabase já vão para o navegador em todo deploy do site
 * (estão preenchidas no .env.example versionado). A segurança dos dados é a
 * RLS do banco e o token de cada paciente — nunca esconder a chave anon.
 */
export const SITE = process.env.EXPO_PUBLIC_SITE_URL ?? "https://www.obstetrica.com.br";

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://zqmqbnwvrmeabnmaaxfr.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_j8bs67itJ-3Ud_K2mTTrHA_MvT4CAlu";

/** Telefones de emergência — valem em qualquer cidade e sem internet. */
export const SAMU = "192";
export const BOMBEIROS = "193";
export const CVV = "188";

/**
 * O contato publicado do app — a Apple exige um, à vista, em app com conteúdo
 * de usuárias (diretriz 1.2). É o e-mail do consultório (`DOCTOR.email` em
 * src/lib/doctor.config.ts, que o app não importa: ele usa `import.meta`);
 * `contato.test.ts` confere que os dois são o mesmo.
 */
export const CONTATO_EMAIL = "contato@drclovisbacha.com.br";

/**
 * A IA NO APP — DESLIGADA (decisão do dono, 15/10/2026: "não será o foco").
 *
 * Desliga a nutricionista com IA (a rota /nutricao, o botão na Saúde e o
 * atalho no Início), a reescrita da triagem pela IA (a orientação local, que
 * já dava o nível, continua) e o cartão da permissão de IA no Perfil. Para
 * uma primeira publicação, é o recurso de maior risco na revisão da Apple
 * (app de saúde com IA aconselhando gestante, diretriz 1.4.1).
 *
 * O código fica todo no lugar. Para religar: `true` aqui, e devolver a
 * menção ao prato da nutricionista nos textos de permissão da câmera e das
 * fotos no app.json (a Apple confere se o texto bate com o que o app faz).
 * `ia-desligada.test.ts` cobra as duas coisas juntas.
 */
export const IA_NO_APP = false;
