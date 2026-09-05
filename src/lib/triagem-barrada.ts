/**
 * O RASTRO DA TRIAGEM CLÍNICA.
 *
 * ⚠️ **`triarTexto` recusava e NADA era registrado.**
 *
 * O post é barrado, a paciente vê o recado, e a tentativa desaparece. Numa base
 * onde 20,9% do conselho leigo em fóruns de gestação está errado e 5,5% é
 * potencialmente danoso, alguém tentando publicar conduta cinco vezes seguidas
 * é o sinal mais forte que esta aba consegue produzir — e ninguém o via.
 *
 * ⚠️ **ISTO NÃO É PUNIÇÃO, e o desenho tem de deixar isso claro.** A paciente
 * não é avisada, não perde nada, e a régua continua barrando exatamente como
 * antes. O que muda é que a plataforma passa a ver o padrão.
 *
 * ⚠️ **E A EMERGÊNCIA NÃO É O MESMO CASO.** Quem escreve "estou sangrando" não
 * está tentando dar conselho: está pedindo socorro no lugar errado. Registrar
 * as duas na mesma fila faria o administrador ler pedido de socorro como
 * infração — então a espécie viaja junto, e a fila separa.
 */

export type OndeBarrou = "post" | "story" | "comentario" | "bio" | "mensagem" | "pergunta";

/** Acima disto, a mesma pessoa repetindo vira um caso para olhar. */
export const REPETICOES_QUE_CHAMAM = 3;

/**
 * O trecho guardado.
 *
 * ⚠️ **SEM O TEXTO A LINHA NÃO DIZ NADA** — "tentou publicar conduta" não dá ao
 * administrador o que julgar. Mas o corte existe: um post inteiro na fila é
 * mais dado clínico de terceiro do que a moderação precisa.
 */
export const TRECHO_MAX = 300;

export function trechoParaFila(texto: string): string {
  const t = texto.trim().replace(/\s+/g, " ");
  return t.length <= TRECHO_MAX ? t : t.slice(0, TRECHO_MAX - 1) + "…";
}

export type BarradaNaFila = {
  quemId: string;
  quemNome: string | null;
  onde: OndeBarrou;
  desfecho: string;
  trecho: string;
  criadoEm: string;
};

/**
 * Agrupa por pessoa, para a fila mostrar PADRÃO e não eventos soltos.
 *
 * ⚠️ **Uma tentativa isolada não é caso.** Toda paciente um dia escreve uma
 * frase que a régua barra — foi para isso que a régua foi calibrada contra 40
 * frases reais. Uma fila de eventos soltos afogaria o administrador em ruído e
 * ensinaria a ignorá-la, que é como uma fila de moderação morre.
 *
 * ⚠️ **A EMERGÊNCIA NUNCA CONTA para a repetição.** Ela é pedido de socorro; se
 * entrasse na conta, a paciente que passou mal três vezes apareceria como
 * reincidente.
 */
export function agruparPorPessoa(linhas: readonly BarradaNaFila[]): {
  quemId: string;
  quemNome: string | null;
  tentativas: number;
  ultima: string;
  chamaAtencao: boolean;
  exemplos: BarradaNaFila[];
}[] {
  const por = new Map<string, BarradaNaFila[]>();
  for (const l of linhas) {
    if (l.desfecho === "emergencia") continue;
    const atual = por.get(l.quemId) ?? [];
    atual.push(l);
    por.set(l.quemId, atual);
  }
  return (
    [...por.entries()]
      .map(([quemId, ls]) => {
        const ord = [...ls].sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
        return {
          quemId,
          quemNome: ord[0]?.quemNome ?? null,
          tentativas: ord.length,
          ultima: ord[0]?.criadoEm ?? "",
          chamaAtencao: ord.length >= REPETICOES_QUE_CHAMAM,
          /* Três bastam para o administrador ver o padrão sem ler tudo. */
          exemplos: ord.slice(0, 3),
        };
      })
      /* Quem repete mais primeiro; empate pelo mais recente. */
      .sort((a, b) => b.tentativas - a.tentativas || Date.parse(b.ultima) - Date.parse(a.ultima))
  );
}
