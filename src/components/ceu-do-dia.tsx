/**
 * OS QUATRO CÉUS DA HOME — amanhecer, dia, pôr do sol e anoitecer.
 *
 * ─── DE DEZ ARTES PARA QUATRO ───────────────────────────────────────────────
 *
 * Eram dez `.webp` (700 KB) repartidos em dez faixas de hora. Pedido do dono
 * (ago/2026): "a gente vai remover o que está atualmente, que são várias
 * versões ali, porém que no final não ficou bom o suficiente... vai ficar
 * muito mais simples".
 *
 * ─── POR QUE VOLTOU A SER IMAGEM ────────────────────────────────────────────
 *
 * A primeira tentativa redesenhou as quatro cenas em SVG, porque não havia
 * como trazer os arquivos para cá: imagem anexada no chat não tem caminho em
 * disco. O SVG chegou perto da referência, mas perto não era o pedido — e
 * assim que os PNGs chegaram por link, eles entraram no lugar.
 *
 * ─── E POR QUE ELAS PASSARAM POR UM UPSCALE (ago/2026) ─────────────────────
 *
 * Os PNGs do Drive têm 853×1844. Um iPhone 15 Pro Max pede 1290×2790 (430 CSS
 * × densidade 3): a arte era AMPLIADA 1,62× pelo navegador, e o resultado era
 * o borrão que o dono viu.
 *
 * A conversão não era a culpada, e isso foi medido antes de mexer: o WebP
 * batia com o PNG a 44–47 dB de PSNR, ou seja, imperceptível. O arquivo é que
 * era menor que a tela.
 *
 * Então as quatro passaram pelo upscale do Higgsfield (4K → 1900×4096) e saem
 * daqui por REDUÇÃO para 1440 de largura. Ganho real medido no anoitecer, que
 * é o que tem detalhe fino: os fios de luz saíam borrados e agora saem
 * inteiros. No `dia`, que é degradê puro, não há diferença visível — e não
 * havia como haver: upscale não inventa detalhe onde não existe.
 *
 * O peso subiu de 112 KB para 400 KB somando as quatro, e só uma carrega por
 * vez. A proporção de saída é a do ORIGINAL (1844/853) e não a do upscale
 * (4096/1900): 0,3% de diferença bastaria para deslocar o enquadramento já
 * calibrado — foi assim que a lua saiu cortada da primeira vez.
 *
 * ⚠️ **O `dia` voltou a 853 de largura em ago/2026**, quando o dono trocou a
 * arte pela do Drive. Ela não passou por upscale: só as outras três têm 1440, e
 * ampliar aqui não inventa detalhe (o upscale que salvou o anoitecer foi feito
 * FORA e só depois reduzido). Num iPhone Pro (densidade 3) o navegador estica a
 * arte do dia em 1,38× — se ela parecer macia, o caminho é o mesmo de antes:
 * upscale externo e `node scripts/ceu-do-drive.mjs <arte> src/assets/ceu/dia.webp 1440`.
 *
 * ─── A REGRA QUE NÃO PODE SE PERDER ─────────────────────────────────────────
 *
 * `dark` e `topoEscuro` NÃO são gosto: saíram da luminância MEDIDA de cada
 * arte, faixa de cima e faixa de baixo separadas. Duas cenas invertem o brilho
 * entre as duas pontas, e é por isso que são dois campos e não um. Trocar uma
 * arte obriga a medir de novo — o texto do hero e a barra de status do iOS
 * dependem só disso.
 */

import amanhecerSrc from "@/assets/ceu/amanhecer.webp";
import diaSrc from "@/assets/ceu/dia.webp";
import porDoSolSrc from "@/assets/ceu/por-do-sol.webp";
import anoitecerSrc from "@/assets/ceu/anoitecer.webp";

/** As quatro cenas, na ordem do dia. */
export type NomeDoCeu = "amanhecer" | "dia" | "por-do-sol" | "anoitecer";

export type Ceu = {
  nome: NomeDoCeu;
  /** A arte. 853×1844 (proporção 0,463 — quase a do iPhone, então `cover`
      recorta pouco). */
  src: string;
  /**
   * O PÉ da cena é escuro? Manda no número da semana, no rótulo "semanas" e
   * nos cartões da segunda dobra.
   */
  dark: boolean;
  /**
   * O TOPO da cena é escuro? Manda na barra de status do iOS, no vidro do
   * botão de menu e da pílula do clima, e no nome do bebê.
   *
   * ─── POR QUE DOIS BOOLEANOS E NÃO UM ────────────────────────────────────
   *
   * Porque duas artes invertem o brilho entre as pontas. Medido de novo depois
   * do upscale (luminância RELATIVA da WCAG, faixas 0–12% e 74–100%):
   *
   *   amanhecer   topo 0,255   base 0,412   → claro nas duas
   *   dia         topo 0,399   base 0,523   → claro nas duas
   *   pôr do sol  topo 0,106   base 0,069   → ESCURO nas duas
   *   anoitecer   topo 0,013   base 0,041   → escuro nas duas
   *
   * Os números são MENORES que os da versão anterior deste comentário porque
   * mudou a régua, não a arte: aquela era média simples dos canais, esta é a
   * luminância relativa da WCAG, que é corrigida por gama. A ordem — que é o
   * que decide claro/escuro — não mudou, e `scripts/contraste-hero.mjs` passa
   * nos quatro céus.
   *
   * Com um booleano só, o nome do bebê no pôr do sol saía em texto escuro
   * sobre violeta escuro: 3,43:1 contra o mínimo de 4,5 que este app cobra.
   */
  topoEscuro: boolean;
  /**
   * Que astro está na arte — é ele que a pílula do clima mostra.
   *
   * Segue a ARTE e não o relógio: no amanhecer a lua ainda está no céu, e um
   * sol no badge contradiria o desenho logo atrás dele.
   */
  astro: "lua" | "sol";
  /**
   * A cor CHAPADA do primeiro pixel da arte.
   *
   * O iOS em modo standalone não pinta o conteúdo da página fora da área
   * segura — pinta o fundo do DOCUMENTO. Sem esta cor sobra uma faixa creme
   * atrás do relógio do sistema. Amostrada da imagem, não estimada.
   */
  corDeTopo: string;
  /**
   * A cor CHAPADA do último pixel da arte.
   *
   * A arte cobre a PRIMEIRA DOBRA; o hero continua atrás da segunda (progresso,
   * saudação, médico), e é esta cor que segue dali para baixo.
   */
  corDeBaixo: string;
};

const CEUS: Ceu[] = [
  {
    nome: "amanhecer",
    src: amanhecerSrc,
    dark: false,
    topoEscuro: false,
    astro: "lua",
    corDeTopo: "#7983dd",
    corDeBaixo: "#a99fdd",
  },
  {
    nome: "dia",
    src: diaSrc,
    /* ─── A ARTE DO DIA MUDOU, E COM ELA OS QUATRO CAMPOS (ago/2026) ────────
       Pedido do dono, com o arquivo do Drive na mão ("Referência Imagem Fundo
       Dia"): azul saturado, sol em raios no alto à direita e dunas azuis no pé,
       no lugar do degradê lavado que estava aqui.

       Os quatro campos foram MEDIDOS de novo por `scripts/ceu-do-drive.mjs`, e
       o dia virou a TERCEIRA cena a inverter o brilho entre as pontas: topo
       0,118 (escuro) e base 0,524 (a mais clara das quatro). Herdar o
       `topoEscuro: false` da arte antiga poria o nome do bebê em índigo sobre
       azul-cobalto — é exatamente o defeito que fez estes serem dois booleanos
       e não um. */
    dark: false,
    topoEscuro: true,
    astro: "sol",
    corDeTopo: "#0244e4",
    corDeBaixo: "#0272e4",
  },
  {
    nome: "por-do-sol",
    src: porDoSolSrc,
    // A faixa laranja do meio engana: as duas PONTAS são violeta escuro.
    dark: true,
    topoEscuro: true,
    astro: "sol",
    corDeTopo: "#5e4697",
    corDeBaixo: "#403077",
  },
  {
    nome: "anoitecer",
    src: anoitecerSrc,
    dark: true,
    topoEscuro: true,
    astro: "lua",
    corDeTopo: "#081159",
    corDeBaixo: "#0f1872",
  },
];

const PORNOME = new Map(CEUS.map((c) => [c.nome, c]));

/**
 * QUE CÉU MOSTRAR, pelo relógio.
 *
 * O plano B de quando não se sabe onde a paciente está — a versão ancorada no
 * nascer e no pôr do sol de verdade mora em `ceuPeloSol`, logo abaixo.
 *
 * As faixas são fechadas à esquerda e abertas à direita (`>= de`, `< ate`), e
 * o anoitecer é o que dá a volta na meia-noite: das 19h às 5h.
 */
export function ceuPelaHora(hora: number): Ceu {
  const h = Math.max(0, Math.min(23, Math.floor(hora)));
  if (h >= 5 && h < 9) return PORNOME.get("amanhecer")!;
  if (h >= 9 && h < 16) return PORNOME.get("dia")!;
  if (h >= 16 && h < 19) return PORNOME.get("por-do-sol")!;
  return PORNOME.get("anoitecer")!;
}

/**
 * O CÉU SEGUINDO O SOL DE VERDADE.
 *
 * O relógio sozinho mente. Às 19h de julho, no Brasil, o sol se pôs há mais de
 * uma hora e está escuro — mas a tabela de horas fixas mostraria o pôr do sol
 * alaranjado. Em dezembro, no mesmo 19h, ainda é dia claro. Uma das duas está
 * sempre errada, e a distância cresce quanto mais longe do equador.
 *
 * As janelas de amanhecer e pôr do sol são MINUTOS FIXOS em volta do evento
 * (a passagem do sol pelo horizonte dura mais ou menos o mesmo em qualquer
 * estação, fora dos polos). O que fica entre elas é dia; o resto é anoitecer.
 *
 * Sem nascer/pôr conhecidos, ou com um dia degenerado (sol da meia-noite,
 * noite polar, resposta estranha da API), volta para o relógio: ele erra
 * menos que uma conta em cima de dado ruim.
 */
export function ceuPeloSol(agora: Date, sunrise: Date | null, sunset: Date | null): Ceu {
  if (!sunrise || !sunset) return ceuPelaHora(agora.getHours());
  const SR = sunrise.getTime();
  const SS = sunset.getTime();
  const t = agora.getTime();
  const dia = SS - SR;
  if (!(dia > 0) || dia > 22 * 3_600_000) return ceuPelaHora(agora.getHours());

  const min = 60_000;
  /* Amanhecer: de 50 min antes do nascer a 70 min depois. O céu já está
     rosado antes de o disco aparecer, e continua dourado um tempo depois. */
  if (t >= SR - 50 * min && t < SR + 70 * min) return PORNOME.get("amanhecer")!;
  /* Pôr do sol: de 80 min antes até 30 min depois — a "golden hour" inteira
     mais o crepúsculo civil, que é quando o céu fica laranja de verdade. */
  if (t >= SS - 80 * min && t < SS + 30 * min) return PORNOME.get("por-do-sol")!;
  if (t >= SR && t < SS) return PORNOME.get("dia")!;
  return PORNOME.get("anoitecer")!;
}

/**
 * A PROPORÇÃO DAS QUATRO ARTES — 853 × 1844.
 *
 * O hero usa este número para nascer do TAMANHO DA IMAGEM, em vez de esticar a
 * imagem até o tamanho do hero. Fica exportado porque quem precisa dele é o
 * container, não o `<img>`: a régua tem de morar num lugar só.
 */
export const PROPORCAO_DO_CEU = "853 / 1844";

/**
 * A arte do momento, pronta para ser o fundo absoluto de um container
 * `relative overflow-hidden` que JÁ TENHA a proporção da arte
 * (`aspect-[853/1844]`, ver `PROPORCAO_DO_CEU`).
 *
 * ─── QUEM MANDA NO TAMANHO É A IMAGEM, E NÃO A TELA (ago/2026) ──────────────
 *
 * Pedido do dono, sobre a arte nova do dia: "sem expandir a imagem, somente
 * colocar no fundo, ela já está no tamanho exato que quero".
 *
 * Antes esta camada tinha altura própria (`100svh + safe-top`) e o `cover`
 * ampliava a arte para caber nela — na primeira versão isso cortou a lua pela
 * borda direita, e continuava sendo ampliação mesmo depois de acertada a
 * altura, porque `svh` não tem a proporção da arte: num aparelho mais quadrado
 * o `cover` recorta as pontas, num mais comprido ele estica.
 *
 * Agora o container é que tem a proporção da arte, e o `object-cover` aqui vira
 * uma identidade — mapeia 1:1, sem recorte e sem zoom. O que sobra da tela fica
 * ABAIXO da imagem, no fundo claro da página, que é onde o resto da home passou
 * a morar.
 *
 * Não há mais `dc-sky-breathe` nesta camada, e a razão é a mesma frase: aquele
 * respiro era um zoom de 4% a 7,5%, ou seja, recorte lento da arte que o dono
 * disse já estar no tamanho certo. A vida da cena continua em `CeuEfeitos`, que
 * anima o que está POR CIMA da arte sem mexer no enquadramento dela.
 */
export function CeuDoDia({ nome, className = "" }: { nome: NomeDoCeu; className?: string }) {
  const ceu = PORNOME.get(nome) ?? PORNOME.get("dia")!;
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden>
      {/* `fetchPriority="high"`: é o primeiro pixel que a paciente vê, e sem
          isso ele disputa a fila com o resto da página. */}
      <img
        src={ceu.src}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}
