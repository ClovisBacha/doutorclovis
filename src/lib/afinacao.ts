/**
 * A AFINAÇÃO DO APP — A = 432 Hz, e a verdade sobre isso.
 *
 * ─── O PEDIDO, E O QUE ELE OBRIGA A DIZER ───────────────────────────────────
 *
 * O dono pediu que a meditação fosse afinada em 432 Hz e que se fizesse "um
 * estudo profundo sobre os Hertz". O estudo foi feito, e ele tem duas metades
 * que não podem ser confundidas.
 *
 * **A metade que sustenta a decisão:** 432 é uma escolha estética legítima, e
 * escolher UMA afinação para o app inteiro é engenharia boa. Antes disto, o
 * pad tocava 173,4 · 174,6 · 260,1 · 261,9 Hz, a respiração do marco semanal
 * tocava 174 e 261, e o chime da conquista tocava um acorde de números soltos.
 * Três lugares, três sistemas, nenhum concordando com nenhum — e som que muda
 * de afinação entre telas soa como outro produto, exatamente como a voz.
 *
 * **A metade que este arquivo existe para BARRAR:** quase tudo que se lê sobre
 * 432 Hz é falso, e este é um app MÉDICO de gestação de ALTO RISCO. Uma frase
 * de "frequência de cura" ao lado de uma triagem de pré-eclâmpsia contamina a
 * triagem — a paciente não separa as duas, e tem razão em não separar: quem
 * afirma a primeira está dizendo com que rigor trata a segunda.
 *
 * ⚠️ **NENHUM TEXTO DA INTERFACE PODE AFIRMAR EFEITO DE SAÚDE DA AFINAÇÃO.**
 * Há teste cobrando isso (`afinacao.test.ts`), e ele varre o `src/` inteiro.
 *
 * ─── O QUE A PESQUISA ACHOU ─────────────────────────────────────────────────
 *
 * • **440 Hz** é o padrão ISO 16, de 1955, reafirmado em 1975. Antes dele a
 *   afinação variava por cidade e por década — não existe "afinação natural"
 *   que 440 tenha substituído.
 *
 * • **432 Hz** tem história real: o governo italiano decretou 432 em 1884, e
 *   Verdi apoiou. O argumento dele era de VOZ — afinação alta força o
 *   soprano —, nunca de física ou de cura. É um argumento de conforto, e
 *   continua sendo o melhor argumento que existe a favor.
 *
 * • **A diferença é de 31,77 cents** — cerca de um terço de semitom. É audível
 *   lado a lado e imperceptível isolada. Ninguém "sente" 432 sem comparação.
 *
 * • **"Ressonância de Schumann × 54 = 432"** é numerologia. A ressonância
 *   fundamental de Schumann é ~7,83 Hz, não 8; 7,83 × 54 = 422,8. O número
 *   redondo só aparece arredondando a medida primeiro e multiplicando depois,
 *   que é como se prova qualquer coisa.
 *
 * • **As "frequências Solfeggio"** (174, 285, 396, 417, 528, 639, 741, 852,
 *   963) NÃO vêm do canto medieval. Foram publicadas nos anos 1970 por Joseph
 *   Puleo, obtidas por redução numerológica de versículos do Livro dos
 *   Números. A alegação de que 528 Hz "repara o DNA" não tem um único estudo
 *   revisado por pares por trás. ⚠️ E `breath-audio.ts` toca 174 Hz até hoje —
 *   por coincidência de gosto, não por adesão a isso.
 *
 * • **Estudo existe, e é pequeno:** Calamassi & Pomponi, 2019, na revista
 *   *Explore*, cruzado e duplo-cego, n = 33, achou frequência cardíaca ~4,8
 *   bpm menor ouvindo 432 contra 440. É um piloto, com n de piloto, e o
 *   confundidor óbvio nunca foi controlado: gravação em 432 costuma ser também
 *   mais lenta e mais suave. **Um piloto não sustenta uma afirmação na tela de
 *   um app de saúde.**
 *
 * ─── ENTÃO POR QUE 432, SE A CIÊNCIA NÃO SUSTENTA? ──────────────────────────
 *
 * Porque a pergunta certa não é "432 cura?" (não) — é "que afinação usar?", e
 * essa pergunta PRECISA de resposta, porque hoje não há nenhuma. Entre 440 e
 * 432 há um argumento não-místico e mensurável: 432 é mais grave, o centroide
 * espectral desce junto, e som mais grave é percebido como mais escuro e menos
 * tenso. Numa tela cujo trabalho inteiro é baixar a ativação, isso basta.
 *
 * É uma escolha de TIMBRE, do mesmo tipo que escolher a voz da Isabella. Não
 * precisa de mais justificativa que essa, e não pode ter menos.
 *
 * ─── ⚠️ A GRADE DO LAÇO, QUE É ONDE ISTO ENCOSTA NO CÓDIGO ──────────────────
 *
 * `som-continuo.ts` renderiza um trecho de 30 s que toca em `<audio loop>`. O
 * último quadro encosta no primeiro, então **todo componente periódico precisa
 * fechar um número inteiro de voltas em 30 s** — ou seja, toda frequência tem
 * de ser múltipla de 1/30 Hz.
 *
 * A = 432 já é (432 × 30 = 12960, inteiro). Mas as outras notas não: em
 * temperamento igual, C4 = 256,8687… Hz, e 256,8687 × 30 = 7706,06 — quebrado.
 * Meia volta sobrando a cada 30 s é um clique a cada 30 s, a noite inteira.
 *
 * `noLaco()` arredonda para o múltiplo mais próximo de 1/30. O erro máximo em
 * hertz é fixo (meia divisão, 1/60 Hz) — mas em CENTS ele depende da altura,
 * porque cent é razão e não diferença:
 *
 *     erro ≈ 1200 · (1/60) / (f · ln2)  =  **28,85 / f  cents**
 *
 * ⚠️ Ou seja: o erro é pior no GRAVE, que é justamente onde estes sons vivem.
 * A primeira versão desta prosa afirmava "0,11 cents" citando 257 Hz — certo
 * para aquela nota e falso como afirmação geral; o teste pegou 0,53 cents numa
 * nota mais grave. Os números de verdade:
 *
 *     40 Hz → 0,72 cents ·  108 Hz → 0,27 ·  257 Hz → 0,11 ·  432 Hz → 0,07
 *
 * O limiar de discriminação humana fica perto de 5 cents, então até o pior
 * caso do registro mais grave que o app toca está sete vezes abaixo do
 * audível. A emenda fecha e ninguém ouve a diferença — mas por uma margem que
 * se estreita descendo, e é bom que esteja escrito.
 */

/**
 * A referência. Mexer aqui reafina o app inteiro — é esse o ponto de existir
 * um lugar só.
 */
export const A4_HZ = 432;

/** O padrão ISO, aqui só para a conta da diferença ser feita e não afirmada. */
export const A4_ISO_HZ = 440;

/**
 * O comprimento do laço de `som-continuo.ts`, em segundos.
 *
 * ⚠️ Está DUPLICADO de propósito, e o teste cobra que os dois batam. Importar
 * `som-continuo` daqui criaria ciclo (ele já importa a afinação), e um número
 * mágico solto seria pior que os dois: quem mudasse o laço lá quebraria a
 * emenda de tudo que é afinado aqui, sem erro nenhum.
 */
export const LACO_SEGS = 30;

/**
 * Arredonda para a grade do laço — múltiplos de 1/LACO_SEGS Hz.
 *
 * ⚠️ Toda frequência que entrar num som contínuo TEM de passar por aqui. Uma
 * frequência "bonita" fora da grade quebra a emenda, e o defeito aparece como
 * um estalo a cada 30 s no ouvido de quem está dormindo — nunca como erro.
 */
export function noLaco(hz: number): number {
  return Math.round(hz * LACO_SEGS) / LACO_SEGS;
}

/** Diferença entre duas frequências, em cents. */
export function cents(de: number, para: number): number {
  return 1200 * Math.log2(para / de);
}

/**
 * As doze classes de altura, em semitons a partir de LÁ.
 *
 * Nomes em português porque é o que o resto do projeto fala, e porque
 * `SI` e `B` significam notas diferentes conforme o país — ambiguidade que num
 * arquivo de afinação custaria caro.
 */
const SEMITONS: Record<string, number> = {
  do: -9,
  "do#": -8,
  re: -7,
  "re#": -6,
  mi: -5,
  fa: -4,
  "fa#": -3,
  sol: -2,
  "sol#": -1,
  la: 0,
  "la#": 1,
  si: 2,
};

export type Nota = keyof typeof SEMITONS;

/**
 * Frequência de uma nota, em temperamento igual sobre `A4_HZ`.
 *
 * A oitava segue a convenção científica: `la` na oitava 4 é a referência.
 * `nota("la", 4)` devolve exatamente 432.
 *
 * ⚠️ NÃO passa por `noLaco` sozinha — quem precisa da grade pede. Música
 * generativa e sinos não vivem dentro do laço de 30 s e não devem ser
 * arredondados à toa.
 */
export function nota(n: Nota, oitava: number): number {
  const semitom = SEMITONS[n];
  if (semitom === undefined) throw new Error("nota desconhecida: " + n);
  /* Oitava 4 é a da referência; cada oitava vale 12 semitons. */
  const n12 = semitom + (oitava - 4) * 12;
  return A4_HZ * Math.pow(2, n12 / 12);
}

/** A mesma nota, já encaixada na grade do laço de 30 s. */
export function notaNoLaco(n: Nota, oitava: number): number {
  return noLaco(nota(n, oitava));
}

/**
 * ⚠️ AS ESCALAS SÃO ESCOLHA CLÍNICA, NÃO MUSICAL.
 *
 * Numa geração aleatória, a escala é a única coisa entre o sorteio e o ouvido
 * da paciente — não há revisão humana no meio. O que decide se uma escala é
 * segura NÃO é ela ser bonita: é quais intervalos ela deixa acontecer quando
 * duas notas caem JUNTAS.
 *
 * ⚠️ E aqui a primeira versão deste arquivo afirmava uma bobagem: que dórico e
 * lídio não teriam "segunda menor entre graus vizinhos". Toda escala diatônica
 * tem — é exatamente isso que a faz diatônica. O teste pegou. A propriedade
 * que importa é outra, e é por par, não por vizinhança:
 *
 * • **pentatônica menor** [0,3,5,7,10] — nenhum PAR de notas dela forma
 *   segunda menor nem trítono. É a única escala em que qualquer sobreposição
 *   soa consonante, e por isso a única segura para vozes que entram e saem sem
 *   ninguém conferindo. É o padrão de tudo que toca sozinho.
 *
 * • **dórico** [0,2,3,5,7,9,10] — menor com a sexta maior, que tira o peso do
 *   menor natural: melancólico sem ser fúnebre. ⚠️ Tem trítono entre o 2º e o
 *   6º grau (3 e 9). Serve para MELODIA (uma nota por vez); numa camada de
 *   sobreposição livre, esse par pode cair junto.
 *
 * • **lídio** [0,2,4,6,7,9,11] — maior com a quarta aumentada, aberto e
 *   flutuante. ⚠️ O trítono é contra a PRÓPRIA TÔNICA, que é a nota que um
 *   drone sustenta o tempo todo. É a mais arriscada das três, e por isso nunca
 *   é o padrão.
 *
 * Os números são semitons a partir da tônica.
 */
export const ESCALAS = {
  pentatonicaMenor: [0, 3, 5, 7, 10],
  dorico: [0, 2, 3, 5, 7, 9, 10],
  lidio: [0, 2, 4, 6, 7, 9, 11],
} as const;

/**
 * As escalas em que QUALQUER par de graus soa consonante.
 *
 * ⚠️ Só estas podem alimentar camada de sobreposição livre (pad, drone, vozes
 * que entram sozinhas). O motor de música cobra isto em tempo de execução —
 * uma escala nova que entre aqui sem passar por `semDissonancia` traz de volta
 * o trítono acidental que a lista existe para impedir.
 */
export const SEGURAS_PARA_SOBREPOR = ["pentatonicaMenor"] as const;

/**
 * Verdadeiro quando nenhum par de graus da escala forma segunda menor (1),
 * trítono (6) ou sétima maior (11) — os três intervalos que soam como tensão
 * sem preparo.
 */
export function semDissonancia(graus: readonly number[]): boolean {
  for (const a of graus) {
    for (const b of graus) {
      const i = Math.abs(a - b) % 12;
      if (i === 1 || i === 6 || i === 11) return false;
    }
  }
  return true;
}

export type Escala = keyof typeof ESCALAS;

/**
 * A escala EM HERTZ, a partir de uma tônica, cobrindo `oitavas` oitavas.
 *
 * `aoLaco` encaixa cada frequência na grade de 30 s — ligue para qualquer som
 * que vá entrar em `som-continuo.ts`, desligue para música e sinos.
 */
export function grausEmHz(escala: Escala, tonicaHz: number, oitavas = 2, aoLaco = false): number[] {
  const out: number[] = [];
  for (let o = 0; o < oitavas; o++) {
    for (const s of ESCALAS[escala]) {
      const f = tonicaHz * Math.pow(2, (s + o * 12) / 12);
      out.push(aoLaco ? noLaco(f) : f);
    }
  }
  return out;
}
