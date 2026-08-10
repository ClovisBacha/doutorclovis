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
 * Os originais somavam 5,5 MB. Convertidos para WebP (qualidade 0,86), somam
 * **112 KB** — menos que um sexto do conjunto antigo, porque são degradês
 * suaves e é justamente neles que o WebP ganha. A conversão foi feita pelo
 * canvas do próprio navegador; não há `cwebp` neste ambiente.
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
   * Porque duas artes invertem o brilho entre as pontas. Medido (luminância
   * média das faixas 0–12% e 74–100%):
   *
   *   amanhecer   topo 0,534   base 0,673   → claro nas duas
   *   dia         topo 0,637   base 0,738   → claro nas duas
   *   pôr do sol  topo 0,345   base 0,278   → ESCURO nas duas
   *   anoitecer   topo 0,087   base 0,189   → escuro nas duas
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
    corDeTopo: "#6f7dd1",
    corDeBaixo: "#a39adb",
  },
  {
    nome: "dia",
    src: diaSrc,
    dark: false,
    topoEscuro: false,
    astro: "sol",
    corDeTopo: "#3ba6ef",
    corDeBaixo: "#30a5bd",
  },
  {
    nome: "por-do-sol",
    src: porDoSolSrc,
    // A faixa laranja do meio engana: as duas PONTAS são violeta escuro.
    dark: true,
    topoEscuro: true,
    astro: "sol",
    corDeTopo: "#5c448e",
    corDeBaixo: "#423076",
  },
  {
    nome: "anoitecer",
    src: anoitecerSrc,
    dark: true,
    topoEscuro: true,
    astro: "lua",
    corDeTopo: "#081157",
    corDeBaixo: "#101b74",
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
 * A arte do momento, pronta para ser o fundo absoluto de um container
 * `relative overflow-hidden`.
 *
 * ─── POR QUE A ALTURA É A DA PRIMEIRA DOBRA, E NÃO `inset-0` ────────────────
 *
 * A arte tem a proporção de UMA TELA. O hero é mais alto — ele segue atrás da
 * segunda dobra. Com `inset-0` o `cover` ampliava a arte para cobrir os
 * ~1100px do hero: a lua saía cortada pela borda direita. Medido, não suposto.
 *
 * Presa à altura da primeira dobra, a arte fica no enquadramento para que foi
 * desenhada, e o `corDeBaixo` do container continua dali para baixo.
 */
export function CeuDoDia({ nome, className = "" }: { nome: NomeDoCeu; className?: string }) {
  const ceu = PORNOME.get(nome) ?? PORNOME.get("dia")!;
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 h-[calc(100svh+0.5rem+var(--safe-top))] ${className}`}
      aria-hidden
    >
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
