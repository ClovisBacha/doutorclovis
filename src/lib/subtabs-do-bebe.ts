/**
 * AS SUB-TELAS DA ABA BEBÊ, E QUAIS DELAS O LUTO TIRA.
 *
 * ⚠️ **A grade da aba Bebê não conhecia o Modo Cuidado.** `BEBE_SUBTABS` era
 * usada crua: no luto, a paciente continuava vendo **"Contagem"** (a contagem
 * regressiva para o parto), **"Nomes"** (a votação do nome do bebê) e
 * **"Enxoval"** — três telas cujo assunto inteiro é um bebê que vai chegar.
 *
 * O componente já RECEBIA `careMode` e o repassava para dentro de duas das
 * sub-telas; o que faltava era a própria grade olhar para ele. É a mesma forma
 * do portão do batimento no painel do acompanhante: a bandeira chegava, e o
 * lugar que decide o que MOSTRAR não a usava.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ **O ÁLBUM FICA, e essa é a decisão que não pode ser desfeita por
 * arrumação.** As fotos são a memória do que houve — escondê-las seria o app
 * apagar o bebê dela. É a mesma linha que manteve `exam_files` de pé quando o
 * envio de exames saiu do produto, e que faz `podeVerPost` devolver `true` para
 * a autora mesmo em luto.
 *
 * ⚠️ **E "SEMANA" TAMBÉM FICA — ela já se trata por dentro.** `BabyTab` recebe
 * `careMode` e ajusta o próprio conteúdo; tirá-la da grade seria gatear duas
 * vezes a mesma coisa, e a segunda régua é como as duas divergem no primeiro
 * conserto.
 */

/** As chaves que somem no Modo Cuidado. */
export const SUBTABS_FORA_DO_LUTO = ["contagem", "nome", "carta", "quartinho"] as const;

export type SubtabDoBebe = { key: string; label: string; [k: string]: unknown };

/**
 * A grade da aba Bebê, recortada pelo luto.
 *
 * ⚠️ Recebe a lista completa em vez de importá-la: `BEBE_SUBTABS` mora em
 * `minha-conta.tsx`, um arquivo de rota de vinte mil linhas que abre com
 * dezenas de imports — um teste desta régua morreria na primeira linha dele.
 * Mesma razão de `frases-do-mascote.ts` e `arte-do-bebe.ts`.
 */
export function subtabsDoBebe<T extends SubtabDoBebe>(todas: readonly T[], careMode: boolean): T[] {
  if (!careMode) return [...todas];
  return todas.filter((s) => !SUBTABS_FORA_DO_LUTO.includes(s.key as never));
}

/**
 * A sub-tela que deve abrir, dado o que foi pedido.
 *
 * ⚠️ **Existe porque o portão da GRADE não basta.** A sub-tela inicial vem de
 * fora (`initialSub`) — o toque no bebê da home pede `"semana"`, e o hub da
 * Saúde pede outras. Sem esta função, um `initialSub` de tela barrada abriria
 * exatamente a tela que o luto acabou de tirar da grade: o portão pareceria
 * funcionar (o ladrilho some) e não funcionaria (a tela abre).
 *
 * Devolve `null` quando o pedido não é permitido — e `null` é a GRADE, que é o
 * lugar certo para cair.
 */
export function subtabPermitida<T extends SubtabDoBebe>(
  todas: readonly T[],
  careMode: boolean,
  pedida: string | null | undefined,
): string | null {
  if (!pedida) return null;
  return subtabsDoBebe(todas, careMode).some((s) => s.key === pedida) ? pedida : null;
}
