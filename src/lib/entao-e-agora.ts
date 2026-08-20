/**
 * "ENTÃO E AGORA" — duas fotos da mesma barriga, com as duas semanas.
 *
 * Pedido do dono (ideia 2). É o formato número um de conteúdo de gestação em
 * qualquer rede — e este app é o único lugar que **sabe as duas semanas**, sem
 * ela digitar nada.
 *
 * ─── AS TRÊS DECISÕES ──────────────────────────────────────────────────────
 *
 * ⚠️ **1. O CARIMBO É DERIVADO NA LEITURA, NUNCA GUARDADO.** O banco guarda só
 * qual post é o "então"; as duas semanas saem da régua no instante em que
 * alguém abre o feed. É a MESMA decisão do carimbo do story, e pela mesma
 * razão: texto guardado sobrevive à decisão dela — uma paciente que desliga
 * `mostrar_semana` (ou entra em Modo Cuidado) depois de publicar teria a semana
 * pendurada numa coluna que o app não sabe mais apagar.
 *
 * ⚠️ **2. A CHAVE `mostrar_semana` MANDA NOS DOIS CARIMBOS.** Desligada, a
 * comparação continua existindo e simplesmente não mostra número nenhum. Fazer
 * a metade "antiga" escapar da chave (com o argumento de que é passado) seria
 * publicar a semana dela pela porta dos fundos — e o passado dela é tão dela
 * quanto o presente.
 *
 * ⚠️ **3. A FOTO ANTIGA NÃO É REENVIADA.** O post novo aponta para o MESMO
 * arquivo do post antigo, no balde. Reenviar duplicaria uma foto de 300 KB por
 * comparação publicada — e, pior, criaria uma segunda cópia que a exclusão de
 * conta teria de aprender a varrer.
 */

/**
 * A distância mínima entre as duas fotos, em dias.
 *
 * ⚠️ **Vinte e oito, e não "qualquer post anterior".** Comparar a barriga de
 * hoje com a de anteontem não mostra nada — e um recurso que rende uma imagem
 * sem diferença ensina que ele não vale a pena na primeira tentativa. Quatro
 * semanas é o menor intervalo em que a barriga muda de forma visível.
 */
export const DIAS_MINIMOS = 28;

export type CandidatoAoEntao = {
  id: string;
  criadoEm: string;
  imagemUrl: string | null;
};

/**
 * Quais publicações dela servem como "então".
 *
 * Precisa ter FOTO (é uma comparação visual) e ser velha o bastante.
 */
export function candidatosAoEntao(posts: CandidatoAoEntao[], agora: Date): CandidatoAoEntao[] {
  const teto = agora.getTime() - DIAS_MINIMOS * 86_400_000;
  return posts
    .filter((p) => {
      if (!p.imagemUrl) return false;
      const t = Date.parse(p.criadoEm);
      return Number.isFinite(t) && t <= teto;
    })
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
}

export type CarimboDaComparacao = { antes: string; agora: string };

/**
 * Os dois rótulos, ou `null`.
 *
 * ⚠️ **`null` quando a chave está desligada, quando falta uma das semanas, ou
 * quando as duas são iguais.** A última condição não é detalhe: "28s → 28s" faz
 * a comparação parecer quebrada, e acontece de verdade em quem publica duas
 * vezes na mesma semana gestacional depois de um intervalo longo de calendário
 * (DUM corrigida, por exemplo).
 */
export function carimboDaComparacao(opts: {
  semanaAntes: number | null;
  semanaAgora: number | null;
  mostrarSemana: boolean;
}): CarimboDaComparacao | null {
  if (!opts.mostrarSemana) return null;
  if (opts.semanaAntes == null || opts.semanaAgora == null) return null;
  if (opts.semanaAntes === opts.semanaAgora) return null;
  return { antes: `${opts.semanaAntes}s`, agora: `${opts.semanaAgora}s` };
}

/**
 * A legenda que o compositor oferece, já pronta.
 *
 * ⚠️ **É SUGESTÃO, e cai no campo como rascunho** — a mesma decisão da legenda
 * da IA e da transcrição do diário. E ela não usa superlativo: "que barrigão!"
 * é um comentário que só a dona pode fazer sobre o próprio corpo.
 */
export function legendaSugerida(c: CarimboDaComparacao | null): string {
  if (!c) return "Então e agora 💛";
  return `${c.antes} e ${c.agora} 💛`;
}

/* ══════════════════════════════════════════════════════════════════════════
   O LEMBRETE — porque um recurso escondido no compositor não acontece
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Quantos dias entre um lembrete e o próximo.
 *
 * ⚠️ **E o carimbo é escrito quando ele APARECE, nunca só quando ela dispensa.**
 * Ignorar é a resposta mais comum a qualquer cartão — e, contado só pela
 * dispensa, o lembrete voltaria em toda abertura da aba para quem simplesmente
 * rolou por cima dele. Um lembrete que não sabe que já foi dado é um anúncio.
 */
export const DIAS_ENTRE_LEMBRETES = 7;

/** A chave carrega o ID DA CONTA — o aparelho é compartilhado. */
export function chaveDoLembrete(euId: string): string {
  return `dc-rede-entao-lembrete-${euId}`;
}

/**
 * Vale lembrar agora? Devolve a foto "então", ou `null`.
 *
 * ⚠️ **Nunca em Modo Cuidado**, e o portão mora AQUI — nenhuma tela precisa
 * lembrar disso. "Que tal comparar com a foto de quatro semanas atrás?" para
 * quem acabou de perder a gestação é exatamente o que o Modo Cuidado existe
 * para impedir, e é pior que a maioria dos cartões porque a foto antiga é da
 * barriga dela.
 *
 * ⚠️ **A candidata é a MAIS ANTIGA que serve**, e não a mais recente das
 * antigas: a graça do formato é a distância, e `candidatosAoEntao` já devolve
 * em ordem decrescente de data — então a última da lista é a que mostra mais
 * mudança.
 */
export function lembreteDoEntao(opts: {
  candidatos: CandidatoAoEntao[];
  /** ISO do último lembrete MOSTRADO, ou `null`. */
  ultimoEm: string | null;
  agora: Date;
  emCuidado: boolean;
}): CandidatoAoEntao | null {
  if (opts.emCuidado) return null;

  const comFoto = opts.candidatos.filter((c) => !!c.imagemUrl);
  if (comFoto.length === 0) return null;

  if (opts.ultimoEm) {
    const t = Date.parse(opts.ultimoEm);
    /* ⚠️ Carimbo ilegível NÃO libera o lembrete: errar para o lado de não
       incomodar é gratuito, e para o outro não. Mesma direção de `lembretes.ts`
       quando a leitura das respostas falha. */
    if (!Number.isFinite(t)) return null;
    const dias = (opts.agora.getTime() - t) / 86_400_000;
    /* Carimbo do futuro (relógio dessincronizado) também segura o lembrete. */
    if (dias < DIAS_ENTRE_LEMBRETES) return null;
  }

  return comFoto[comFoto.length - 1];
}
