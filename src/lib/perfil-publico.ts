/**
 * O PERFIL PÚBLICO — o que uma pessoa SEM CONTA pode ver.
 *
 * ─── POR QUE ISTO EXISTE ────────────────────────────────────────────────────
 *
 * `verPerfil` exige sessão (`accessToken: z.string().min(10)`), e é a régua
 * certa para o app. Só que ela deixa a criadora sem NADA para pôr na bio do
 * Instagram dela: o perfil que ela abriu para o mundo só é visível para quem já
 * é paciente daqui — ou seja, para quem não precisa ser convertido.
 *
 * ─── A RÉGUA, E ELA É CURTA DE PROPÓSITO ───────────────────────────────────
 *
 * ⚠️ **`perfil_publico` é o portão, e ele nasce FALSO.** Não há caso em que uma
 * página sem login mostre um perfil fechado — nem para quem tem o código. É a
 * diferença entre esta tela e `quemConvidou`: lá o que sai é primeiro nome e
 * foto, aqui sai a bio inteira, o selo e as publicações.
 *
 * ⚠️ **Modo Cuidado responde EXATAMENTE como código inexistente.** Nenhum
 * motivo, nenhuma distinção — quem abriu o link da bio de uma criadora que
 * acabou de perder a gestação não pode descobrir isso por eliminação.
 *
 * ⚠️ **SÓ A CAMADA `publico`.** Um visitante sem conta não segue ninguém e não
 * é amiga de ninguém; as camadas `seguidores` e `amigas` não têm como valer
 * aqui, e listá-las seria a porta dos fundos das duas.
 *
 * ⚠️ **NENHUM CONTADOR.** Não existe contador público de seguidores neste app
 * (`NUMEROS_PUBLICOS`), e uma página aberta ao mundo é o último lugar onde ele
 * poderia nascer: a lista de quem acompanha uma gestante de alto risco é o
 * círculo social dela.
 */

/** O que a página pública recebe. Note o que NÃO está aqui. */
export type PerfilPublico = {
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  /** "28 semanas", ou `null` — a régua é a MESMA de `semanaPublica`. */
  seloSemana: string | null;
  seloBebe: string | null;
  /** Só imagem e legenda: um visitante sem conta não tem estado nenhum. */
  posts: PostPublico[];
  /** O código dela, para o convite no pé. */
  codigoDeConvite: string | null;
};

export type PostPublico = {
  id: string;
  imagemUrl: string | null;
  texto: string | null;
  criadoEm: string;
};

/**
 * Vale abrir esta página?
 *
 * ⚠️ **Um `false` só, para três motivos diferentes** — perfil fechado, Modo
 * Cuidado e código inexistente devolvem a mesma coisa. Ver o cabeçalho.
 */
export function podeAbrirPerfilPublico(f: {
  existe: boolean;
  perfilPublico: boolean;
  emCuidado: boolean;
}): boolean {
  return f.existe && f.perfilPublico && !f.emCuidado;
}

/**
 * Quantas publicações a página mostra.
 *
 * ⚠️ **Doze, e sem "carregar mais".** Esta página é uma VITRINE, não o feed: o
 * que ela precisa provar em dez segundos é que existe gente de verdade ali
 * dentro. Rolagem infinita numa página sem login convida a consumir o perfil
 * inteiro sem nunca criar conta — que é o oposto do que ela existe para fazer.
 */
export const POSTS_NA_VITRINE = 12;

/* ⚠️ O texto do convite NÃO mora aqui: ele é o mesmo das outras três páginas
   públicas, em `convite-do-app.ts`, com a variante `perfil`. Duas cópias do
   convite divergiriam no primeiro ajuste — e o rodapé é a única coisa desta
   página que precisa soar igual em todo lugar. */
