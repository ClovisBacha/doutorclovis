/**
 * Saudação pela hora e rótulo do humor — as duas peças PURAS que viviam soltas
 * dentro de `minha-conta.tsx` e eram usadas dos DOIS lados do corte da aba
 * Bebê: `dayGreeting` é definida no meio do bloco que saiu e chamada fora dele;
 * `MOOD_LABEL` é definida fora e lida dentro. Deixá-las lá obrigaria o
 * componente novo a importar de um arquivo de ROTA — que é o que
 * `rotas-sem-export-solto` proíbe, porque um export não-rota entra no pedaço da
 * árvore de rotas e toda página do site passa a carregá-lo.
 *
 * ⚠️ `dayGreeting` lê o RELÓGIO (`new Date().getHours()`), então um teste sobre
 * ela dependeria da hora do contêiner. Ela veio VERBATIM — mudar a assinatura
 * para receber a hora, como `periodoDaHora` faz em `frases-do-mascote.ts`,
 * seria uma melhoria, e melhoria não se mistura com mudança de casa: o diff
 * deixaria de ser conferível por hash.
 *
 * ⚠️ E MUDAR DE CASA DEIXOU UM TESTE VERMELHO SOBRE CÓDIGO CERTO:
 * `meditacao.test.ts` procurava `const MOOD_LABEL` DENTRO de `minha-conta.tsx`
 * para provar que os cinco emojis do fechamento da meditação têm rótulo. A
 * garantia não mudou — só o arquivo. Travar ONDE uma constante mora é a mesma
 * armadilha de travar COMO ela é escrita, e é a décima quarta vez que isso
 * acontece aqui. O teste passou a IMPORTAR esta tabela e conferir a chave, o
 * que é estritamente mais forte que casar texto.
 */

export function dayGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export const MOOD_LABEL: Record<string, string> = {
  "🥰": "Muito bem",
  "😊": "Bem",
  "😌": "Tranquila",
  "💛": "Conectada",
  "🙏": "Gratidão",
  "😴": "Cansada",
  "🥱": "Com sono",
  "😐": "Igual",
  "🤢": "Mal-estar",
  "😟": "Ansiosa",
  "😢": "Triste",
  "😰": "Ansiosa",
};
