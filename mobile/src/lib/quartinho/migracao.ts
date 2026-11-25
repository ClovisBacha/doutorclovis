/**
 * A MIGRAÇÃO DA LOJINHA PARA O QUARTINHO (24/11/2026) — sem tela, testada pelo
 * bun.
 *
 * O dono: "a trilha customizada não vai mais existir [...] todos os itens que
 * têm na nossa trilha, você deve tentar passar para o quartinho. O que não
 * der, a gente vai excluir do nosso jogo [...] os itens de fato comprados têm
 * que ser ali na aba do quartinho".
 *
 * Cada item do catálogo (`src/lib/cantinho.ts`, o do site, que não muda) tem
 * UM destino aqui, e a catraca `migracao.test.ts` cobra que nenhum fique sem:
 *
 * - `no-quarto`: já é um item do quartinho, com arte e lugar (`ITENS`, em
 *   `quarto.ts`), no quarto ou na cozinha (desde 25/11/2026), e se compra ali
 *   mesmo.
 * - `no-ar`: vira o AR do quarto (pétalas, bolhas, peninhas caindo), desenhado
 *   por código: não precisa de arte (`AR_DO_QUARTO`).
 * - `vem-para-o-quarto`: cabe num quarto de bebê e vai entrar quando a arte
 *   dele existir, no estilo da cartela do quarto (a receita está em
 *   `docs/proposta-quartinho-e-itens.md`). Até lá não se vende — o ícone 3D
 *   da lojinha (144 px, outro estilo) destoaria no quarto pintado.
 * - `fora`: não cabe num quarto (os cenários e as bolinhas da trilha, a
 *   fontinha, os fogos): sai do jogo. Quem já comprou continua dona no
 *   servidor; o app só não o mostra.
 */
import { CANTINHO_ITEMS } from "@/lib/cantinho";
import type { Apoio, Categoria, IdDoItem, REGUA_DA_LUZ } from "./quarto";

export type IdDoAr = "petalas" | "bolhas" | "peninhas" | "folhas" | "neve" | "poeira";

export type Proposta = {
  /** O nome dele no quarto (o da lojinha pode mudar: "Cogumelinho" vira abajur). */
  nome: string;
  categoria: Categoria;
  apoio: Apoio;
  /** O degrau da régua da luz, ou `null` (não emite luz). */
  luz: keyof typeof REGUA_DA_LUZ | null;
  /** Onde ele mora no quarto, em palavras, para a arte e o lugar. */
  onde: string;
};

export type Destino =
  | { tipo: "no-quarto"; item: IdDoItem }
  | { tipo: "no-ar"; ar: IdDoAr }
  | { tipo: "vem-para-o-quarto"; proposta: Proposta }
  | { tipo: "fora"; motivo: string };

const quarto = (item: IdDoItem): Destino => ({ tipo: "no-quarto", item });
const ar = (a: IdDoAr): Destino => ({ tipo: "no-ar", ar: a });
const vem = (
  nome: string,
  categoria: Categoria,
  apoio: Apoio,
  onde: string,
  luz: Proposta["luz"] = null,
): Destino => ({ tipo: "vem-para-o-quarto", proposta: { nome, categoria, apoio, luz, onde } });
const fora = (motivo: string): Destino => ({ tipo: "fora", motivo });

const CENARIO = "era o fundo da trilha, que agora é o céu da hora";
const BOLINHAS = "era a pele das bolinhas da trilha, que não se personaliza mais";

/** O destino de cada item do catálogo, pelo id da lojinha. */
export const DESTINO: Readonly<Record<string, Destino>> = {
  /* ── Os que já estão no quarto ── */
  "objeto-berco": quarto("berco"),
  "objeto-mobile": quarto("mobile"),
  "objeto-poltrona": quarto("poltrona"),
  "objeto-luminaria": quarto("luminaria"),
  "objeto-tapete": quarto("tapete"),
  "objeto-cestinho": quarto("cesto"),
  "objeto-quadrinho": quarto("quadro-urso"),
  "planta-vaso": quarto("planta"),
  "bicho-coelho": quarto("coelhinho"),

  /* ── Os que foram para a cozinha (25/11/2026): o bule no fogão, os vasinhos
     no peitoril da janela, as tulipas e o girassol na bancada ── */
  "objeto-chaleira": quarto("bule"),
  "planta-suculenta": quarto("suculenta"),
  "planta-trevo": quarto("trevo"),
  "planta-hortela": quarto("hortela"),
  "planta-cacto": quarto("cactinho"),
  "planta-tulipa": quarto("tulipas"),
  "planta-girassol": quarto("girassol"),

  /* ── O ar do quarto (por código, sem arte) ── */
  "clima-petalas": ar("petalas"),
  "clima-bolhas": ar("bolhas"),
  "clima-peninhas": ar("peninhas"),
  "clima-folhas": ar("folhas"),
  "clima-neve": ar("neve"),
  "clima-poeira": ar("poeira"),

  /* ── Objetos que vêm para o quarto ── */
  "objeto-novelo": vem("Cesta de tricô", "decoracao", "chao", "no chão, ao lado da poltrona"),
  "objeto-livrinho": vem("Livrinhos", "brinquedos", "chao", "uma pilha no chão, perto da poltrona"),
  "objeto-almofada": vem("Almofada", "decoracao", "chao", "no chão, perto do tapete"),
  "objeto-espelho": vem("Espelho", "decoracao", "parede", "na parede, acima da cômoda"),
  "objeto-fones": vem("Caixinha de som", "decoracao", "movel", "em cima da cômoda"),
  "objeto-matrioska": vem("Matrioskas", "brinquedos", "movel", "em cima da cômoda"),
  "objeto-caixinha": vem("Caixinha de música", "brinquedos", "movel", "em cima da cômoda"),

  /* ── As plantas: em vasos ── */
  "planta-cerejeira": vem("Cerejeira", "plantas", "chao", "num vaso grande, no canto"),
  "planta-bonsai": vem("Bonsai", "plantas", "movel", "na prateleira"),
  "planta-roseira": vem("Roseira", "plantas", "chao", "num vaso, no canto"),
  "planta-palmeira": vem("Palmeirinha", "plantas", "chao", "num vaso grande, no canto"),
  "planta-cogumelo": vem(
    "Abajur de cogumelo",
    "decoracao",
    "chao",
    "no chão, ao lado do berço",
    "luzNoturna",
  ),

  /* ── Os bichinhos viram pelúcias ── */
  "bicho-borboleta": vem("Borboletas", "decoracao", "parede", "voando na parede"),
  "bicho-gato": vem("Gatinho", "brinquedos", "chao", "no chão"),
  "bicho-passaro": vem("Passarinho", "brinquedos", "movel", "na prateleira"),
  "bicho-joaninha": vem("Joaninha", "brinquedos", "chao", "no tapete"),
  "bicho-abelha": vem("Abelhinha", "brinquedos", "chao", "no tapete"),
  "bicho-tartaruga": vem("Tartaruguinha", "brinquedos", "chao", "no tapete"),
  "bicho-raposa": vem("Raposinha", "brinquedos", "chao", "no chão"),
  "bicho-caracol": vem("Caracol", "brinquedos", "chao", "no tapete"),
  "bicho-lagarta": vem("Lagartinha", "brinquedos", "chao", "no tapete"),
  "bicho-esquilo": vem("Esquilinho", "brinquedos", "chao", "no chão"),
  "bicho-ourico": vem("Ouriço", "brinquedos", "chao", "no tapete"),
  "bicho-ovelha": vem("Ovelhinha", "brinquedos", "chao", "no chão"),
  "bicho-coruja": vem("Corujinha", "brinquedos", "movel", "na prateleira"),
  "agua-polvo": vem("Polvinho", "brinquedos", "chao", "no tapete"),
  "agua-golfinho": vem("Golfinho", "brinquedos", "chao", "no chão"),
  "agua-sapinho": vem("Sapinho", "brinquedos", "chao", "no tapete"),
  "agua-caranguejo": vem("Caranguejinho", "brinquedos", "chao", "no tapete"),
  "agua-patinho": vem("Patinho", "brinquedos", "chao", "no tapete"),
  "agua-peixinho": vem("Peixinho", "brinquedos", "chao", "no tapete"),
  "agua-cisne": vem("Cisne", "brinquedos", "chao", "no chão"),
  "agua-foca": vem("Foquinha", "brinquedos", "chao", "no chão"),

  /* ── O céu vira parede, teto e brinquedo ── */
  "ceu-estrelinhas": vem(
    "Estrelinhas no teto",
    "decoracao",
    "parede",
    "coladas no alto da parede",
    "brilhaNoEscuro",
  ),
  "ceu-nuvem": vem("Nuvem na parede", "decoracao", "parede", "na parede, acima do berço"),
  "ceu-sol": vem("Quadro do sol", "decoracao", "parede", "na parede"),
  "ceu-lua": vem("Luminária de lua", "decoracao", "parede", "na parede", "luzNoturna"),
  "ceu-arcoiris": vem("Arco-íris de madeira", "brinquedos", "chao", "no tapete"),
  "ceu-passarinhos": vem("Passarinhos na parede", "decoracao", "parede", "voando na parede"),
  "ceu-pipa": vem("Pipa", "decoracao", "parede", "pendurada na parede"),
  "ceu-balao-ar": vem("Balãozinho", "decoracao", "parede", "pendurado no alto"),
  "ceu-cometa": vem("Estrela cadente", "decoracao", "parede", "na parede", "tintaQueBrilha"),

  /* ── As luzes ── */
  "luz-vela": vem("Velinhas de LED", "decoracao", "movel", "em cima da cômoda", "luzinhas"),
  "luz-lampiao": vem("Lampião", "decoracao", "movel", "na prateleira", "luzNoturna"),
  "luz-pisca": vem("Varal de luzinhas", "decoracao", "parede", "no alto da parede", "luzinhas"),
  "luz-lanterna": vem("Lanterninha", "decoracao", "chao", "no chão", "luzNoturna"),

  /* ── Os especiais que cabem num quarto ── */
  "especial-vagalume": vem("Pote de vaga-lumes", "decoracao", "movel", "na prateleira", "luzinhas"),
  "especial-carrossel": vem("Carrossel", "brinquedos", "movel", "em cima da cômoda"),
  "especial-primavera": vem("Flores na janela", "plantas", "movel", "no peitoril da janela"),
  "especial-chuva": vem("Chuva na janela", "decoracao", "parede", "lá fora, na janela"),

  /* ── O que sai do jogo ── */
  "fundo-simples": fora(CENARIO),
  "fundo-amanhecer": fora(CENARIO),
  "fundo-quartinho": fora(CENARIO),
  "fundo-mar": fora(CENARIO),
  "fundo-estrelas": fora(CENARIO),
  "fundo-aurora": fora(CENARIO),
  "fundo-bosque": fora(CENARIO),
  "fundo-lavanda": fora(CENARIO),
  "fundo-deserto": fora(CENARIO),
  "fundo-neve": fora(CENARIO),
  "fundo-lago": fora(CENARIO),
  "fundo-campo": fora(CENARIO),
  "fundo-nuvens": fora(CENARIO),
  "trilha-jardim": fora(BOLINHAS),
  "trilha-lotus": fora(BOLINHAS),
  "trilha-origami": fora(BOLINHAS),
  "trilha-perolas": fora(BOLINHAS),
  "trilha-constelacao": fora(BOLINHAS),
  "trilha-cristais": fora(BOLINHAS),
  "trilha-planetas": fora(BOLINHAS),
  "trilha-coracao": fora(BOLINHAS),
  "tema-ceu-v1": fora("trocava o céu do site; no app não tinha efeito"),
  "agua-poca": fora("uma poça não cabe num quarto"),
  "agua-fonte": fora("uma fonte não cabe num quarto"),
  "agua-coral": fora("um recife não cabe num quarto"),
  "agua-concha": fora("ficaria solta, sem lugar no quarto"),
  "ceu-carpas": fora("as carpas ao vento são do céu aberto"),
  "ceu-fogos": fora("fogos de artifício não combinam com o quarto do bebê"),
  "especial-colecao": fora("a Coroa era da coleção da lojinha da trilha"),
  "especial-balao": fora("já estava fora de circulação"),
  "especial-cascata": fora("já estava fora de circulação"),
  "especial-arcoiris-duplo": fora("já estava fora de circulação"),
  "luz-estrela-cadente": fora("já estava fora de circulação"),
  "especial-arvore": fora("a árvore que cresce era da trilha"),
  "especial-dianoite": fora("o quarto já tem o dia e a noite de verdade"),
  "especial-outono": fora("era uma estação da trilha"),
  "especial-natal": fora("era uma estação da trilha"),
  "especial-inverno": fora("era uma estação da trilha"),
  "especial-pavao": fora("um pavão não cabe num quarto"),
};

/** Os itens do catálogo, com o destino de cada um (a catraca usa). */
export const ITENS_DO_CATALOGO = CANTINHO_ITEMS.map((i) => i.id);

/** O ar do quarto que vem de um item da lojinha. */
export const AR_DO_QUARTO: Readonly<Record<IdDoAr, { lojinha: string; nome: string }>> = {
  petalas: { lojinha: "clima-petalas", nome: "Pétalas" },
  bolhas: { lojinha: "clima-bolhas", nome: "Bolhinhas" },
  peninhas: { lojinha: "clima-peninhas", nome: "Peninhas" },
  folhas: { lojinha: "clima-folhas", nome: "Folhinhas" },
  neve: { lojinha: "clima-neve", nome: "Neve" },
  poeira: { lojinha: "clima-poeira", nome: "Poeira de estrelas" },
};

/** Quantos itens em cada destino (para o relatório e a catraca). */
export function contarDestinos(): Record<Destino["tipo"], number> {
  const c = { "no-quarto": 0, "no-ar": 0, "vem-para-o-quarto": 0, fora: 0 };
  for (const id of ITENS_DO_CATALOGO) {
    const d = DESTINO[id];
    if (d) c[d.tipo] += 1;
  }
  return c;
}
