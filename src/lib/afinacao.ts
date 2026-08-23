/**
 * A AFINAÇÃO DO APP — A = 432 Hz, e a verdade sobre isso.
 *
 * ─── O PEDIDO, E O QUE ELE OBRIGA A DIZER ───────────────────────────────────
 *
 * O dono pediu que a meditação fosse afinada em 432 Hz e que se fizesse "um
 * estudo profundo sobre os Hertz". O estudo foi feito — em fontes primárias,
 * não em resumos de internet — e tem duas metades que não podem ser
 * confundidas.
 *
 * **A metade que sustenta a decisão:** escolher UMA afinação para o app
 * inteiro é engenharia boa, e o valor escolhido é arbitrário. Antes disto o
 * pad tocava 173,4 · 174,6 · 260,1 · 261,9 Hz, a respiração do marco semanal
 * tocava 174 e 261, e o chime da conquista tocava um acorde de números soltos:
 * três lugares, três sistemas, nenhum concordando com nenhum. Som que muda de
 * afinação entre telas soa como outro produto, exatamente como a voz.
 *
 * **A metade que este arquivo existe para BARRAR:** quase tudo que se lê sobre
 * 432 Hz é falso, e este é um app MÉDICO de gestação de ALTO RISCO. Uma frase
 * de "frequência de cura" ao lado de uma triagem de pré-eclâmpsia contamina a
 * triagem — a paciente que descobrir que o "528 Hz repara o DNA" é mentira tem
 * motivo RACIONAL para duvidar do aviso de pré-eclâmpsia na tela ao lado.
 *
 * ⚠️ **NENHUM TEXTO DA INTERFACE PODE AFIRMAR EFEITO DE SAÚDE DA AFINAÇÃO.**
 * Há catraca varrendo o `src/` inteiro (`afinacao.test.ts`).
 *
 * ─── O QUE A PESQUISA ACHOU, COM AS FONTES ──────────────────────────────────
 *
 * • **440 Hz é de 1834**, não do Terceiro Reich. Scheibler mede com o tonômetro
 *   e o congresso de Stuttgart recomenda A=440 naquele ano; os EUA adotam em
 *   1926/1936; a conferência de 1939 foi da BBC, com atas públicas; ISO R16 em
 *   1955, ISO 16 em 1975. "Os nazistas impuseram o 440" é FALSO por um século
 *   de distância. (O 440 venceu o 439 por uma razão prosaica: 439 é primo e
 *   ruim de dividir em eletrônica; 440 = 8 × 55.)
 *
 * • ⚠️ **VERDI QUERIA 435, NÃO 432** — e esta é a correção que mais dói no
 *   folclore. A carta dele de 1884 diz: "se a comissão acredita, por exigências
 *   matemáticas, que devemos reduzir as 435 vibrações do diapasão francês para
 *   432, a diferença é tão pequena, QUASE IMPERCEPTÍVEL AO OUVIDO, que me
 *   associo de bom grado." Ele pediu o padrão francês e aceitou o 432 como
 *   arredondamento de conveniência. São 12,0 cents. E o argumento dele era
 *   mecânico: o diapasão vinha subindo e machucava cantores de ópera.
 *
 * • **"Schumann 8 Hz × 54 = 432" se autodestrói.** A fundamental de Schumann é
 *   7,83 Hz, não 8 — e 7,83 × 54 = 422,8. Mas o golpe é outro: aceitando o 8
 *   arredondado, **8 × 55 = 440**. Os DOIS são múltiplos inteiros exatos de
 *   8 Hz. Não há nada ali que distinga o 432. (E 54 não é potência de 2, então
 *   também não é relação de oitava: as oitavas de 8 Hz são 16 · 32 · 64 · 128 ·
 *   256 · 512, e 432 não está entre elas.)
 *
 * • ⚠️ **"A=432 e C=256" são INCOMPATÍVEIS** no temperamento igual, que é o
 *   que qualquer sintetizador usa — inclusive este arquivo. C=256 implica
 *   A=430,54; A=432 implica C=256,87. Os dois só valem juntos num sistema
 *   pitagórico que ninguém aplica. Quem repete os dois no mesmo parágrafo não
 *   fez a conta.
 *
 * • **As "frequências Solfeggio"** (174, 285, 396, 417, 528, 639, 741, 852,
 *   963) foram inventadas por Joseph Puleo nos anos 1970 e publicadas por
 *   Leonard Horowitz em 1999. O critério é numerológico: todas reduzem a 3, 6
 *   ou 9. Não vêm de Guido d'Arezzo — o solfejo dele é RELATIVO (ensina
 *   intervalos), e além disso não havia como medir frequência absoluta antes
 *   de 1834. E 528 Hz não é dó em afinação nenhuma: dó5 dá 513,74 em A=432
 *   (o 528 fica 47,4 cents acima) e 523,25 em A=440.
 *   ⚠️ `breath-audio.ts` toca 174 Hz até hoje — por coincidência de gosto, e
 *   não por adesão a isso.
 *
 * • **O estudo-âncora é um piloto, e só.** Calamassi & Pomponi, 2019, *Explore*
 *   15(4):283–290 — n = 33, cruzado, 20 min. Frequência cardíaca −4,79 bpm com
 *   **p = 0,05 exato**, num desenho com 12+ desfechos e sem correção para
 *   comparações múltiplas; pressão não deu significativa. Três dos quatro
 *   estudos italianos "positivos" são do mesmo primeiro autor, e **não existe
 *   replicação independente**. Há resultados nulos e invertidos na literatura.
 *   (A vertente 528 Hz é pior: o trabalho mais citado saiu numa revista da
 *   OMICS, editora condenada pela FTC em 2019 a US$ 50,1 milhões por alegar
 *   revisão por pares que não fazia.)
 *
 * • **E o achado mais decisivo é de percepção, não de fisiologia.** Van Hedger
 *   & Bongiovanni, *Music & Science* 2023: ouvintes acertam a afinação
 *   absoluta acima do acaso em notas isoladas e acordes, mas caem ao NÍVEL DO
 *   ACASO quando o estímulo tem pistas de altura relativa — ou seja, quando é
 *   música de verdade. Ninguém identifica a afinação ouvindo música.
 *
 * ─── ⚠️ ENTÃO A RAZÃO É OUTRA, E EU TINHA ESCRITO A ERRADA ──────────────────
 *
 * A primeira versão desta prosa justificava o 432 assim: "mais grave, o
 * centroide espectral desce junto, e som mais grave é percebido como mais
 * escuro e menos tenso". A primeira metade é verdade (Ilie & Thompson 2006:
 * altura mais grave em música associa-se a maior valência) e **a aplicação é
 * falsa**: aquelas manipulações são de SEMITONS A OITAVAS, e aqui a diferença
 * é de 0,32 de semitom. Transpor 1,82% baixa o centroide 1,82%, muito abaixo
 * de qualquer mudança de timbre percebida.
 *
 * A razão que sobra é de ENGENHARIA, e ela basta:
 *
 *     Uma referência só, para drone, sinos, música e interface não brigarem
 *     entre si. O valor é convenção estética entre quem faz áudio de
 *     relaxamento, e não custa nada. É gosto, não é remédio.
 *
 * • **E o que move fisiologia de verdade** (Bernardi, Porta & Sleight, *Heart*
 *   2006;92:445–452) é ANDAMENTO, dinâmica e SILÊNCIO — a pausa derruba
 *   frequência cardíaca, pressão e ventilação ABAIXO do basal. Um compasso
 *   lento e uma pausa bem colocada fazem, medidamente, mais do que 32 cents
 *   jamais farão. É por isso que o desenho da sessão importa mais que a
 *   afinação dela, e é onde o esforço deve ir.
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
