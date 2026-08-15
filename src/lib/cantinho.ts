/**
 * Meu Cantinho 🌱 — catálogo do "spend sink" das Sementinhas.
 *
 * Metáfora "cantinho que cresce" (jardim/ninho) — emocionalmente segura (ver
 * pesquisa): o berço é apenas UM item opcional, nunca o centro.
 *
 * Cada item tem um `type` que define ONDE aparece no Caminho:
 *  - fundo   → papel de parede (equipa 1)
 *  - ceu     → faixa do topo (sol/lua/estrelas...) — decoração acumulável,
 *              espalhada sozinha por `seedDecor` na faixa acima do 1º nó
 *  - planta  → laterais da trilha
 *  - objeto  → objetos aconchegantes ao longo do caminho
 *  - bicho   → criaturas que passeiam
 *  - luz     → luzinhas que acendem e apagam
 *  - agua    → coisas que boiam
 *  - especial→ peça de destaque, com halo
 *
 * `premium: true` → só quem assina o Premium compra (ainda paga com Sementinhas;
 * nunca dinheiro real por item = sem pay-to-win). Item comprado fica pra sempre.
 *
 * O PREÇO é a fonte da verdade no servidor: a compra valida o preço daqui.
 *
 * ─── ⚠️ O REAJUSTE DE AGO/2026, E O QUE ELE PROTEGE ─────────────────────────
 *
 * Pedido do dono, depois do estudo da loja de Sementinhas: "a pessoa comprando
 * dez mil sementinhas ela não conseguiria comprar tudo no jogo... senão ia
 * perder a graça".
 *
 * Medido antes: o catálogo custava 14.894 🌱 e o maior pacote entrega 15.000
 * (10.000 + 5.000 de bônus). Ou seja, UMA compra de R$ 99,90 valia 101% de
 * tudo — ela compraria uma vez e não sobraria mais nada para querer, que é o
 * fim do jogo e também o fim da segunda compra.
 *
 * O reajuste dobrou o preço dos itens ASPIRACIONAIS e não o da loja inteira:
 *
 *  · a régua é por FAIXA (quanto mais caro o item, maior o multiplicador) e
 *    ganha +20% se o tipo for `trilha`, `especial`, `fundo` ou `clima` — os
 *    quatro que mudam a tela inteira, e não um canto dela;
 *  · plantas, luzes, bichos, objetos, céu e águas subiram pouco: é a coleção
 *    do dia a dia, e ela precisa continuar cabendo no primeiro mês.
 *
 * ⚠️ **A LOJA GRÁTIS NÃO SE MOVEU.** Ela continua em 15 itens somando
 * exatamente 704 🌱 — a parede do 15º dia é a mecânica de conversão inteira, e
 * mexer nela seria outra decisão, não esta. O que mudou é o que existe DEPOIS
 * da parede. (A ÂNCORA dentro da curva subiu de 200 para 260, com os catorze
 * degraus abaixo descendo para compensar; ver `economia-sementinhas.ts`.)
 *
 * O resultado, travado por teste em `economia-sementinhas.test.ts`:
 *
 *     uma compra do maior pacote ....... 52% do catálogo
 *     nove meses jogando perfeito ...... 48%
 *     os dois juntos ................... ~100%
 *
 * Nenhum caminho sozinho fecha a coleção — e os três itens de troféu
 * (`TROFEUS_PARA`) continuam fora de qualquer um deles, porque dinheiro não
 * compra dia jogado.
 */

/**
 * `tema` é o único tipo que NÃO decora o Cantinho: veste o céu da home do app.
 * Vive aqui porque a loja, a carteira e a RPC de compra são as mesmas — o que
 * muda é só onde o item é aplicado.
 */
export type CantinhoType =
  | "fundo"
  | "ceu"
  | "planta"
  | "objeto"
  | "bicho"
  | "especial"
  | "tema"
  /** Pele das bolinhas do Caminho — três estados, ver `trilha-skins.ts`. */
  | "trilha"
  /**
   * Luzes — acendem e apagam devagar (`dcTwinkle`). Categoria nova, e ela só
   * existe porque TEM COMPORTAMENTO PRÓPRIO: um tipo que se comporta igual a
   * `objeto` seria só um rótulo a mais na loja.
   */
  | "luz"
  /** Águas — sobem e descem com um balanço curto (`dcRipple`). */
  | "agua"
  /**
   * No ar — o tipo NOVO (ago/2026), e o primeiro que não é adesivo.
   *
   * Todos os outros são uma figura POUSADA num ponto da trilha. Este é o AR do
   * cantinho: enquanto ela o tiver na trilha, pétalas caem, folhas giram,
   * bolhas sobem — sobre a tela inteira, sem lugar fixo. Ver
   * `src/lib/clima-do-cantinho.ts`.
   *
   * ⚠️ Ele nasceu da mesma régua que criou Luzes e Águas: **um tipo só existe
   * se tiver COMPORTAMENTO PRÓPRIO**. E resolveu de quebra o problema que
   * travava a ampliação — as categorias de adesivo estão saturadas de emoji
   * (não existe uma sexta "luz" reconhecível a 24px), enquanto o ar estava
   * inteiro vazio.
   */
  | "clima";

export type CantinhoItem = {
  id: string;
  name: string;
  emoji: string;
  price: number; // em Sementinhas
  type: CantinhoType;
  premium: boolean;
  /**
   * Saiu da LOJA, e só dela. Continua no catálogo, continua desenhando na
   * trilha de quem já o comprou, continua contando para a Coroa.
   *
   * ⚠️ É a única forma honesta de "tirar o item ruim": apagar a linha faria o
   * enfeite sumir do cantinho de quem o pagou, e `CANTINHO_BY_ID[id]` devolver
   * `undefined` — que é exatamente como um `DecorSprite` desaparece sem erro
   * nenhum. A mesma lição do `CANTINHO_COMPLETION_MIN`: o app não pode tirar
   * de volta o que já deu.
   *
   * Quem sai daqui sai por um motivo escrito na linha, sempre um destes dois:
   * o emoji é o MESMO de outro item (a paciente não tem como saber o que
   * comprou), ou o nome promete um comportamento que o código não tem.
   */
  aposentado?: true;
};

export const CANTINHO_CATEGORIES: { key: CantinhoType; label: string }[] = [
  /* Primeira da lista: é a categoria que muda a tela que ela mais olha. */
  { key: "trilha", label: "Bolinhas" },
  { key: "tema", label: "Céu do app" },
  { key: "fundo", label: "Cenários" },
  { key: "ceu", label: "Céu" },
  { key: "planta", label: "Plantas" },
  { key: "luz", label: "Luzes" },
  { key: "agua", label: "Águas" },
  { key: "clima", label: "No ar" },
  { key: "objeto", label: "Objetos" },
  { key: "bicho", label: "Bichinhos" },
  { key: "especial", label: "Especiais" },
];

export const CANTINHO_ITEMS: CantinhoItem[] = [
  /* ── Peles do Caminho ──────────────────────────────────────────────
     Preço alto (280) porque ela troca a tela inteira do jogo, não um canto
     dela — e porque é o tipo de item que a paciente vê a cada dia da jornada,
     não uma vez. Não é premium: quem junta Sementinhas alcança.
     As oito têm arte (ago/2026). Três são alcançáveis sem assinatura. */
  {
    id: "trilha-jardim",
    name: "Bolinhas Jardim",
    emoji: "🌱",
    price: 10,
    type: "trilha",
    premium: false,
  },
  // ── Grátis (1) — cenário inicial, já vem com a paciente ─────────────
  // "Sem graça de propósito": um fundo liso que só troca de cor com as
  // semanas. Serve de ponto de partida pra dar gostinho de personalizar antes
  // do 1º item comprado (a Suculenta, 30). Preço 0 => sempre possuído.
  {
    id: "fundo-simples",
    name: "Fundo Suave",
    emoji: "🎨",
    price: 0,
    type: "fundo",
    premium: false,
  },

  // ── Céu do app ─────────────────────────────────────────────────────
  // O céu original do app, de antes da arte por momento do dia. Guardado
  // aqui para quem gostava dele: compra uma vez e troca quando quiser.
  {
    id: "tema-ceu-v1",
    name: "Céu Clássico",
    emoji: "🌅",
    price: 12,
    type: "tema",
    premium: false,
  },

  // ── Loja normal (10) — só Sementinhas ──────────────────────────────
  {
    id: "planta-suculenta",
    name: "Suculenta",
    emoji: "🌱",
    price: 15,
    type: "planta",
    premium: false,
  },
  {
    id: "objeto-cestinho",
    name: "Cestinho",
    emoji: "🧺",
    price: 18,
    type: "objeto",
    premium: false,
  },
  {
    id: "ceu-estrelinhas",
    name: "Estrelinhas",
    emoji: "✨",
    price: 20,
    type: "ceu",
    premium: false,
  },
  { id: "ceu-nuvem", name: "Nuvem fofa", emoji: "☁️", price: 60, type: "ceu", premium: false },
  {
    id: "planta-vaso",
    name: "Vaso de flores",
    emoji: "🪴",
    price: 60,
    type: "planta",
    premium: true,
  },
  {
    id: "bicho-borboleta",
    name: "Borboleta",
    emoji: "🦋",
    price: 65,
    type: "bicho",
    premium: false,
  },
  {
    id: "objeto-tapete",
    name: "Tapetinho fofo",
    emoji: "🧶",
    price: 70,
    type: "objeto",
    premium: true,
  },
  {
    id: "planta-girassol",
    name: "Girassol",
    emoji: "🌻",
    price: 80,
    type: "planta",
    premium: true,
  },
  {
    id: "objeto-luminaria",
    name: "Luminária",
    emoji: "🪔",
    price: 80,
    type: "objeto",
    premium: true,
  },
  {
    id: "fundo-amanhecer",
    name: "Campo ao amanhecer",
    emoji: "🌅",
    price: 26,
    type: "fundo",
    premium: false,
  },

  // ── Premium (20) — exige assinatura ────────────────────────────────
  { id: "bicho-coelho", name: "Coelhinho", emoji: "🐰", price: 270, type: "bicho", premium: true },
  { id: "bicho-gato", name: "Gatinho", emoji: "🐈", price: 310, type: "bicho", premium: true },
  {
    id: "bicho-passaro",
    name: "Passarinho cantante",
    emoji: "🐦",
    price: 310,
    type: "bicho",
    premium: true,
  },
  {
    /* APOSENTADO: 🎈 é o emoji do `ceu-balao-ar` (100 🌱). Dois tiles com o
       MESMO desenho, em prateleiras diferentes, e este custava o dobro. */
    id: "especial-balao",
    name: "Balão de ar",
    emoji: "🎈",
    price: 200,
    type: "especial",
    premium: true,
    aposentado: true,
  },
  {
    /* O emoji era 🪄 — uma VARINHA MÁGICA num item chamado Vaga-lumes. 🫙 é o
       pote, que é como se guarda vaga-lume desde sempre, e o brilho agora
       existe de verdade: este item emite a névoa de `clima-poeira` na trilha
       (ver `climaDeItem`). O nome parou de prometer o que o código não fazia. */
    id: "especial-vagalume",
    name: "Vaga-lumes no pote",
    emoji: "🫙",
    price: 500,
    type: "especial",
    premium: true,
  },
  {
    id: "objeto-mobile",
    name: "Móbile de estrelas",
    emoji: "🎐",
    price: 260,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-poltrona",
    name: "Poltrona de amamentação",
    emoji: "🪑",
    price: 340,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-berco",
    name: "Berço (opcional)",
    emoji: "🛏️",
    price: 480,
    type: "objeto",
    premium: true,
  },
  { id: "ceu-sol", name: "Sol radiante", emoji: "☀️", price: 180, type: "ceu", premium: true },
  { id: "ceu-arcoiris", name: "Arco-íris", emoji: "🌈", price: 260, type: "ceu", premium: true },
  { id: "ceu-lua", name: "Lua e estrelas", emoji: "🌙", price: 240, type: "ceu", premium: true },
  {
    id: "fundo-quartinho",
    name: "Quartinho aconchegante",
    emoji: "🧸",
    price: 500,
    type: "fundo",
    premium: true,
  },
  { id: "fundo-mar", name: "Ondas do mar", emoji: "🌊", price: 650, type: "fundo", premium: true },
  {
    id: "fundo-estrelas",
    name: "Chuva de estrelas",
    emoji: "🌠",
    price: 575,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-aurora",
    name: "Aurora boreal",
    emoji: "🌌",
    price: 675,
    type: "fundo",
    premium: true,
  },
  {
    /* APOSENTADO: 💧 é o emoji da `agua-poca` (45 🌱). Uma gota chamada
       "Cascata" por 300 🌱, ao lado da mesma gota por 45. */
    id: "especial-cascata",
    name: "Cascata",
    emoji: "💧",
    price: 300,
    type: "especial",
    premium: true,
    aposentado: true,
  },
  {
    /* CRESCE de verdade agora (`escalaDaArvore`): a semana gestacional manda
       no tamanho, de muda a copa. Era o segundo item mais caro do catálogo
       prometendo no NOME um comportamento que o código não tinha. */
    id: "especial-arvore",
    name: "Árvore que cresce",
    emoji: "🌳",
    price: 875,
    type: "especial",
    premium: true,
  },
  {
    /* CICLA de verdade agora (`faseDaLua`): o emoji acompanha a hora do
       relógio dela, 🌕 → 🌗 → 🌑 → 🌓. Mesmo caso da árvore, e este era o
       item mais caro da loja. */
    id: "especial-dianoite",
    name: "Ciclo dia/noite",
    emoji: "🌗",
    price: 1000,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-outono",
    name: "Outono",
    emoji: "🍂",
    price: 330,
    type: "especial",
    premium: true,
  },
  { id: "especial-natal", name: "Natal", emoji: "🎄", price: 370, type: "especial", premium: true },

  /* ══════════════════════════════════════════════════════════════════════
     AMPLIAÇÃO — ago/2026

     Regra que vale para tudo daqui pra baixo: item novo só entra se APARECE.
     A auditoria da loja encontrou cinco itens de `ceu` que não apareciam em
     lugar nenhum até a paciente descobrir sozinha o modo Arrumar — dinheiro
     em troca de nada. Antes de somar item, `seedDecor` passou a espalhar o
     céu na faixa do alto, e as duas categorias novas ganharam animação
     própria. Nada aqui é rótulo sem comportamento.
     ══════════════════════════════════════════════════════════════════════ */

  // ── Peles do Caminho (+7) ──────────────────────────────────────────────
  // A arte das sete existia como prompt em `docs/prompts-skins.md` e parou por
  // falta de créditos, não por decisão. Agora existe. É o item de maior
  // impacto do catálogo: troca a tela que a paciente abre todo dia, e conta o
  // progresso na FORMA (dorme · desperta · floresce).
  {
    id: "trilha-lotus",
    name: "Bolinhas Lótus",
    emoji: "🪷",
    price: 30,
    type: "trilha",
    premium: false,
  },
  {
    id: "trilha-origami",
    name: "Bolinhas Origami",
    emoji: "🐦‍⬛",
    price: 800,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-perolas",
    name: "Bolinhas Pérolas",
    emoji: "🦪",
    price: 850,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-constelacao",
    name: "Bolinhas Constelação",
    emoji: "✨",
    price: 900,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-cristais",
    name: "Bolinhas Cristais",
    emoji: "💎",
    price: 900,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-planetas",
    name: "Bolinhas Planetas",
    emoji: "🪐",
    price: 950,
    type: "trilha",
    premium: true,
  },
  {
    id: "trilha-coracao",
    name: "Bolinhas Coração",
    emoji: "💗",
    price: 1000,
    type: "trilha",
    premium: true,
  },

  // ── Luzes (+5) — categoria nova, animação `dcTwinkle` ──────────────────
  { id: "luz-vela", name: "Velinha", emoji: "🕯️", price: 34, type: "luz", premium: false },
  { id: "luz-lampiao", name: "Lampião", emoji: "🏮", price: 100, type: "luz", premium: true },
  { id: "luz-pisca", name: "Pisca-pisca", emoji: "🎇", price: 140, type: "luz", premium: true },
  { id: "luz-lanterna", name: "Lanterninha", emoji: "🔦", price: 160, type: "luz", premium: true },
  {
    /* APOSENTADO: 🌠 é o emoji do cenário `fundo-estrelas` (250 🌱), e a
       "cadente" não caía — ficava pendurada piscando como as outras luzes.
       Quem quer estrela que atravessa o céu tem `clima-poeira`, que atravessa
       mesmo. */
    id: "luz-estrela-cadente",
    name: "Estrela cadente",
    emoji: "🌠",
    price: 160,
    type: "luz",
    premium: true,
    aposentado: true,
  },

  // ── Águas (+5) — categoria nova, animação `dcRipple` ───────────────────
  { id: "agua-poca", name: "Pocinha", emoji: "💧", price: 38, type: "agua", premium: false },
  { id: "agua-fonte", name: "Fontinha", emoji: "⛲", price: 140, type: "agua", premium: true },
  { id: "agua-peixinho", name: "Peixinho", emoji: "🐠", price: 180, type: "agua", premium: true },
  { id: "agua-concha", name: "Conchinha", emoji: "🐚", price: 240, type: "agua", premium: true },
  { id: "agua-golfinho", name: "Golfinho", emoji: "🐬", price: 310, type: "agua", premium: true },

  // ── Céu (+4) — agora eles APARECEM sozinhos, na faixa do alto ──────────
  {
    id: "ceu-passarinhos",
    name: "Bando de passarinhos",
    emoji: "🕊️",
    price: 80,
    type: "ceu",
    premium: true,
  },
  { id: "ceu-pipa", name: "Pipa", emoji: "🪁", price: 120, type: "ceu", premium: true },
  { id: "ceu-balao-ar", name: "Balãozinho", emoji: "🎈", price: 150, type: "ceu", premium: true },
  { id: "ceu-cometa", name: "Cometa", emoji: "☄️", price: 270, type: "ceu", premium: true },

  // ── Plantas (+4) ───────────────────────────────────────────────────────
  { id: "planta-trevo", name: "Trevo", emoji: "🍀", price: 42, type: "planta", premium: false },
  { id: "planta-tulipa", name: "Tulipa", emoji: "🌷", price: 70, type: "planta", premium: true },
  {
    id: "planta-cerejeira",
    name: "Cerejeira",
    emoji: "🌸",
    price: 110,
    type: "planta",
    premium: true,
  },
  { id: "planta-bonsai", name: "Bonsai", emoji: "🎍", price: 140, type: "planta", premium: true },

  // ── Objetos (+4) ───────────────────────────────────────────────────────
  {
    id: "objeto-livrinho",
    name: "Livrinho de história",
    emoji: "📖",
    price: 52,
    type: "objeto",
    premium: false,
  },
  {
    id: "objeto-chaleira",
    name: "Chá quentinho",
    emoji: "🫖",
    price: 80,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-almofada",
    name: "Almofadinha",
    emoji: "🛋️",
    price: 100,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-caixinha",
    name: "Caixinha de música",
    emoji: "🎵",
    price: 160,
    type: "objeto",
    premium: true,
  },

  // ── Bichinhos (+4) ─────────────────────────────────────────────────────
  { id: "bicho-joaninha", name: "Joaninha", emoji: "🐞", price: 22, type: "bicho", premium: false },
  { id: "bicho-abelha", name: "Abelhinha", emoji: "🐝", price: 80, type: "bicho", premium: true },
  {
    id: "bicho-tartaruga",
    name: "Tartaruguinha",
    emoji: "🐢",
    price: 140,
    type: "bicho",
    premium: true,
  },
  { id: "bicho-raposa", name: "Raposinha", emoji: "🦊", price: 340, type: "bicho", premium: true },

  // ── Cenários (+4) — cada um tem gradiente em CANTINHO_FUNDO_BG ─────────
  {
    id: "fundo-bosque",
    name: "Bosque tranquilo",
    emoji: "🌲",
    price: 290,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-lavanda",
    name: "Campo de lavanda",
    emoji: "💜",
    price: 370,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-deserto",
    name: "Fim de tarde no deserto",
    emoji: "🏜️",
    price: 550,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-neve",
    name: "Manhã de neve",
    emoji: "❄️",
    price: 600,
    type: "fundo",
    premium: true,
  },

  // ── Especiais (+3) ─────────────────────────────────────────────────────
  /* Não-premium de propósito: era a única categoria sem NENHUM item pago
     alcançável sem assinatura, e isso deixava a Coroa fora do alcance de quem
     é do plano grátis — o defeito que esta ampliação veio corrigir. */
  {
    id: "especial-primavera",
    name: "Primavera",
    emoji: "🌺",
    price: 260,
    type: "especial",
    premium: false,
  },
  {
    /* CHOVE de verdade agora: este item emite a chuvinha de `clima` na trilha
       (ver `climaDeItem`). Vendia "Chuva mansa" por 200 🌱 e entregava uma
       nuvem parada. */
    id: "especial-chuva",
    name: "Chuva mansa",
    emoji: "🌧️",
    price: 410,
    type: "especial",
    premium: true,
  },
  {
    /* APOSENTADO: 🌈 é o emoji do `ceu-arcoiris` (150 🌱). "Duplo" não existe
       em emoji nenhum — os dois tiles eram o mesmo desenho, com 170 🌱 de
       diferença. */
    id: "especial-arcoiris-duplo",
    name: "Arco-íris duplo",
    emoji: "🌈",
    price: 320,
    type: "especial",
    premium: true,
    aposentado: true,
  },

  /* ══════════════════════════════════════════════════════════════════════
     AMPLIAÇÃO DE +50% — ago/2026 (74 → 111)

     Pedido do dono: "faça uma varredura completa dos itens, veja quais não
     fazem sentido, classifique os melhores e os piores, retire os piores,
     coloque mais 50% de itens, e veja se conseguimos criar outro tipo".

     Quatro regras que a leva inteira obedece, e cada uma nasceu de um defeito
     que a varredura encontrou nos 74:

      1. **Emoji só entra se for INÉDITO no catálogo E fora dos oito selos de
         conjunto.** Os 74 tinham sete emojis repetidos, e quatro deles eram o
         mesmo desenho vendido duas vezes por preços diferentes — os quatro
         `aposentado` desta rodada. O selo entra na conta porque
         `conjuntos.test.ts` reprova selo igual a emoji de item.

      2. **O nome não promete comportamento.** "Árvore que cresce" não crescia
         e "Ciclo dia/noite" não ciclava — os dois itens MAIS CAROS da loja.
         Nesta leva nada se chama pelo que faria; quem tem comportamento é o
         tipo `clima`, e ele tem de verdade.

      3. **Categoria publicada não ganha item de conjunto publicado.**
         `conjuntos.ts` proíbe: somar um quinto item ao "Fundo do mar" viraria
         o selo "4 de 4" de quem já fechou num "4 de 7". Os conjuntos novos
         (Beira do lago, Recife, Sem pressa, Madrugada, Chão de floresta,
         Cantinho de costura) são conjuntos NOVOS.

      4. ⚠️ **OS 37 SÃO PREMIUM, TODOS.** Escrevi a leva com sete itens sem
         assinatura ("toda categoria merece uma porta grátis") e o teste da
         economia reprovou na hora: `economia-sementinhas.ts` fixa a loja
         grátis em **15 itens somando 704 🌱**, calibrados contra o ganho
         típico (35 🌱/dia) para a paciente zerá-la por volta do 15º dia e
         então acumular moeda sem ter no que gastar — que é a decisão de
         monetização do dono, escrita lá com todas as letras. Meus sete
         somariam 410 🌱 e empurrariam a parede para o 30º dia: eu teria
         desfeito a mecânica inteira enquanto "melhorava a loja".
         Item novo entra na prateleira PAGA. Fica melhor até para o pedido
         original — mais coisa do outro lado do muro é mais motivo para
         assinar. A Coroa continua alcançável sem assinar: são dez categorias
         com item grátis e ela pede oito.

     ⚠️ Luzes ficou de fora, e é conclusão medida, não descuido: 🔥 é a chama
     da sequência, ⭐ é a estrela do dia e 💡 é o "Você sabia?" da aula — três
     ícones da própria interface. Pôr qualquer um à venda destruiria os dois
     sentidos na mesma tela. O que sobrava (🎆) é gêmeo do 🎇 que já existe.
     Cinco luzes boas valem mais que seis com uma inventada.
     ══════════════════════════════════════════════════════════════════════ */

  // ── Águas (+7) ─────────────────────────────────────────────────────────
  // Era a categoria com UMA porta grátis. Ganhou três, e ganhou água DOCE:
  // sapinho, patinho e cisne pedem lago, e o lago não existia.
  { id: "agua-sapinho", name: "Sapinho", emoji: "🐸", price: 80, type: "agua", premium: true },
  {
    id: "agua-caranguejo",
    name: "Caranguejinho",
    emoji: "🦀",
    price: 110,
    type: "agua",
    premium: true,
  },
  { id: "agua-patinho", name: "Patinho", emoji: "🦆", price: 150, type: "agua", premium: true },
  {
    /* Pedido nominal do dono. É o que dá CHÃO ao mar: sem recife, peixinho e
       golfinho boiam no vazio em vez de morar em algum lugar. */
    id: "agua-coral",
    name: "Recife de coral",
    emoji: "🪸",
    price: 220,
    type: "agua",
    premium: true,
  },
  { id: "agua-polvo", name: "Polvinho", emoji: "🐙", price: 270, type: "agua", premium: true },
  { id: "agua-cisne", name: "Cisne", emoji: "🦢", price: 320, type: "agua", premium: true },
  { id: "agua-foca", name: "Foquinha", emoji: "🦭", price: 400, type: "agua", premium: true },

  // ── Cenários (+3) — os três com gradiente em CANTINHO_FUNDO_BG ─────────
  {
    /* Água doce. Sem ele, cisne, patinho e sapinho boiam sobre as Ondas do
       mar, que são salgadas e azul-marinho. */
    id: "fundo-lago",
    name: "Beira do lago",
    emoji: "🏞️",
    price: 410,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-campo",
    name: "Campo dourado",
    emoji: "🌾",
    price: 390,
    type: "fundo",
    premium: true,
  },
  {
    id: "fundo-nuvens",
    name: "Entre as nuvens",
    emoji: "🌤️",
    price: 410,
    type: "fundo",
    premium: true,
  },

  // ── Plantas (+5) ───────────────────────────────────────────────────────
  // As sete de antes eram todas BAIXAS e todas flores ou folha pequena.
  // Entram altura (palmeira), chão (cogumelo) e cheiro (hortelã).
  { id: "planta-hortela", name: "Hortelã", emoji: "🌿", price: 50, type: "planta", premium: true },
  { id: "planta-cacto", name: "Cactinho", emoji: "🌵", price: 60, type: "planta", premium: true },
  {
    id: "planta-cogumelo",
    name: "Cogumelinho",
    emoji: "🍄",
    price: 100,
    type: "planta",
    premium: true,
  },
  { id: "planta-roseira", name: "Roseira", emoji: "🌹", price: 120, type: "planta", premium: true },
  {
    /* 110 e não 130: a categoria fechava em 90 (Bonsai), e o topo novo sobe um
       degrau, não dois. Preço fora da curva faz a prateleira inteira parecer
       cara. */
    id: "planta-palmeira",
    name: "Palmeirinha",
    emoji: "🌴",
    price: 160,
    type: "planta",
    premium: true,
  },

  // ── Bichinhos (+6) ─────────────────────────────────────────────────────
  { id: "bicho-caracol", name: "Caracol", emoji: "🐌", price: 60, type: "bicho", premium: true },
  {
    /* Fecha o par com a Borboleta que já existe — a única dupla do catálogo em
       que um item conta a história do outro. */
    id: "bicho-lagarta",
    name: "Lagartinha",
    emoji: "🐛",
    price: 100,
    type: "bicho",
    premium: true,
  },
  {
    id: "bicho-esquilo",
    name: "Esquilinho",
    emoji: "🐿️",
    price: 180,
    type: "bicho",
    premium: true,
  },
  { id: "bicho-ourico", name: "Ouriço", emoji: "🦔", price: 240, type: "bicho", premium: true },
  { id: "bicho-ovelha", name: "Ovelhinha", emoji: "🐑", price: 260, type: "bicho", premium: true },
  {
    /* O bicho que fica acordado com ela. Para quem abre o app às três da
       manhã, é o único item do cantinho que reconhece a madrugada — a mesma
       hora que o mascote da home já trata como caso à parte. */
    id: "bicho-coruja",
    name: "Corujinha",
    emoji: "🦉",
    price: 320,
    type: "bicho",
    premium: true,
  },

  // ── Objetos (+5) — a categoria tinha 2 portas grátis em 10 ──────────────
  {
    id: "objeto-novelo",
    name: "Novelo de linha",
    emoji: "🧵",
    price: 40,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-espelho",
    name: "Espelhinho",
    emoji: "🪞",
    price: 110,
    type: "objeto",
    premium: true,
  },
  {
    /* Os sons para dormir chegam nela sem acordar quem dorme do lado. */
    id: "objeto-fones",
    name: "Fones de dormir",
    emoji: "🎧",
    price: 130,
    type: "objeto",
    premium: true,
  },
  {
    id: "objeto-quadrinho",
    name: "Quadrinho",
    emoji: "🖼️",
    price: 140,
    type: "objeto",
    premium: true,
  },
  {
    /* Uma dentro da outra é literalmente a imagem da gestação — e é a única
       peça do catálogo que diz isso sem dizer nada sobre o parto. */
    id: "objeto-matrioska",
    name: "Matrioskas",
    emoji: "🪆",
    price: 220,
    type: "objeto",
    premium: true,
  },

  // ── Céu (+2) ───────────────────────────────────────────────────────────
  {
    id: "ceu-carpas",
    name: "Carpas ao vento",
    emoji: "🎏",
    price: 220,
    type: "ceu",
    premium: true,
  },
  {
    id: "ceu-fogos",
    name: "Fogos de artifício",
    emoji: "🎆",
    price: 290,
    type: "ceu",
    premium: true,
  },

  // ── Especiais (+3) ─────────────────────────────────────────────────────
  {
    /* ⛄ (U+26C4) e não ☃️: o primeiro já é emoji por padrão; o segundo depende
       do seletor de variação e sai preto e branco se alguém limpar o FE0F. */
    id: "especial-inverno",
    name: "Boneco de neve",
    emoji: "⛄",
    price: 390,
    type: "especial",
    premium: true,
  },
  {
    id: "especial-carrossel",
    name: "Carrossel",
    emoji: "🎠",
    price: 650,
    type: "especial",
    premium: true,
  },
  {
    /* O item mais caro precisa ser o que a amiga comenta ao visitar o
       Cantinho, e abrir a cauda é a única coisa do catálogo que é um
       espetáculo em vez de um enfeite. */
    id: "especial-pavao",
    name: "Pavão",
    emoji: "🦚",
    price: 850,
    type: "especial",
    premium: true,
  },

  // ── No ar (+6) — O TIPO NOVO ───────────────────────────────────────────
  /* Não é adesivo: é o AR da trilha. Enquanto o item estiver no cantinho, a
     tela inteira ganha o que ele traz — pétalas descendo, folhas girando,
     bolhas subindo. A régua (quantas partículas, por onde, em quanto tempo)
     mora em `src/lib/clima-do-cantinho.ts`, testada e sem JSX.

     ⚠️ Os seis são premium, como toda a leva — ver a regra 4 do cabeçalho da
     ampliação. A categoria fica FORA do alcance de quem não assina, e isso é
     de propósito: é a prateleira mais bonita da loja, e é a que dá vontade. */
  {
    id: "clima-petalas",
    name: "Chuva de pétalas",
    emoji: "💮",
    price: 160,
    type: "clima",
    premium: true,
  },
  {
    id: "clima-folhas",
    name: "Folhas caindo",
    emoji: "🍁",
    price: 200,
    type: "clima",
    premium: true,
  },
  {
    id: "clima-bolhas",
    name: "Bolhinhas de sabão",
    emoji: "🫧",
    price: 270,
    type: "clima",
    premium: true,
  },
  { id: "clima-peninhas", name: "Peninhas", emoji: "🪶", price: 290, type: "clima", premium: true },
  { id: "clima-neve", name: "Nevando", emoji: "🌨️", price: 350, type: "clima", premium: true },
  {
    id: "clima-poeira",
    name: "Poeirinha de estrelas",
    emoji: "💫",
    price: 410,
    type: "clima",
    premium: true,
  },

  // ── Troféu de coleção — NÃO se compra; desbloqueia sozinho.
  // O requisito está em CANTINHO_COMPLETION_REQUIRED, logo abaixo. ─────────
  {
    id: "especial-colecao",
    name: "Coroa da Coleção",
    emoji: "👑",
    price: 0,
    type: "especial",
    premium: false,
  },
];

/** O troféu que coroa a coleção completa (concedido, nunca comprado). */
export const CANTINHO_COMPLETIONIST_ID = "especial-colecao";

/**
 * A Coroa pede UM item pago de CADA categoria — não o catálogo inteiro.
 *
 * Pedia todos os itens pagos. Com 32 itens isso já eram 5.350 🌱, uns 76 dias
 * de jogo perfeito; com os 40 novos passaria de 15.000, mais dias do que dura
 * uma gestação. Meta que não cabe na jornada da paciente não é meta, é enfeite
 * inalcançável — e ela ficava sinalizada por uma linha de 9px no último tile
 * de uma grade de 34.
 *
 * "Um de cada" também diz uma coisa melhor: você passeou pelo cantinho
 * inteiro. E escala sozinho — categoria nova entra na conta sem ninguém
 * lembrar de mexer aqui.
 *
 * Ninguém perde nada na troca: quem tinha a coleção antiga completa
 * necessariamente tem um de cada categoria, então continua com a coroa.
 *
 * Fica de fora o que tem preço 0 (grátis desde o primeiro acesso, exigir não
 * pediria esforço) e a própria coroa.
 */
export const CANTINHO_COMPLETION_CATEGORIES: CantinhoType[] = [
  ...new Set(
    CANTINHO_ITEMS.filter((i) => i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID).map(
      (i) => i.type,
    ),
  ),
];

/**
 * Um id representativo por categoria — usado só pelo contador "X de Y" da
 * tela. O requisito de verdade é por CATEGORIA (ver a função abaixo).
 *
 * ⚠️ Ignora o que está `aposentado`: um representante que não está mais à
 * venda apontaria a paciente para um tile que a loja não mostra.
 */
export const CANTINHO_COMPLETION_REQUIRED: string[] = CANTINHO_COMPLETION_CATEGORIES.map(
  (t) =>
    CANTINHO_ITEMS.find(
      (i) => i.type === t && i.price > 0 && !i.aposentado && i.id !== CANTINHO_COMPLETIONIST_ID,
    )!.id,
);

/**
 * O que a LOJA mostra — tudo menos o que foi aposentado.
 *
 * ⚠️ `CANTINHO_ITEMS` continua sendo a lista inteira, e é ela que a trilha, o
 * `CANTINHO_BY_ID` e a Coroa leem: o item aposentado some da vitrine e de
 * lugar nenhum mais. Quem o comprou continua com ele desenhado no cantinho,
 * contando categoria para a Coroa, exatamente como antes.
 */
export const CANTINHO_LOJA: CantinhoItem[] = CANTINHO_ITEMS.filter((i) => !i.aposentado);

/**
 * Quantas categorias a Coroa exige.
 *
 * É um PISO fixo (8), não `CANTINHO_COMPLETION_CATEGORIES.length`, e a
 * diferença é a coisa mais importante deste arquivo:
 *
 * O app não pode tirar de volta um troféu que já deu. Se o requisito fosse
 * "todas as categorias", cada categoria nova revogaria a Coroa de quem já a
 * tinha — e Luzes e Águas nasceram nesta mesma ampliação, então a paciente
 * que fechou a coleção antiga abriria o app amanhã sem a coroa que conquistou
 * ontem. Nenhuma explicação conserta isso.
 *
 * Oito era o número de categorias quando a Coroa foi desenhada. Continua
 * pedindo passeio pelo cantinho inteiro (hoje são dez), e sobe só se um dia
 * alguém decidir, de propósito, que deve subir.
 */
export const CANTINHO_COMPLETION_MIN = 8;

/** Quantas categorias já têm ao menos um item pago comprado. */
export function cantinhoCategoriasCompletas(ownedIds: Iterable<string>): number {
  const owned = ownedIds instanceof Set ? ownedIds : new Set(ownedIds);
  return CANTINHO_COMPLETION_CATEGORIES.filter((t) =>
    CANTINHO_ITEMS.some(
      (i) => i.type === t && i.price > 0 && i.id !== CANTINHO_COMPLETIONIST_ID && owned.has(i.id),
    ),
  ).length;
}

/** True quando a paciente tem item pago em pelo menos 8 categorias. */
export function isCantinhoCollectionComplete(ownedIds: Iterable<string>): boolean {
  return cantinhoCategoriasCompletas(ownedIds) >= CANTINHO_COMPLETION_MIN;
}

export const CANTINHO_BY_ID: Record<string, CantinhoItem> = Object.fromEntries(
  CANTINHO_ITEMS.map((i) => [i.id, i]),
);

/** Gradiente de fundo (papel de parede) por item `fundo`, aplicado no Caminho. */
export const CANTINHO_FUNDO_BG: Record<string, string> = {
  "fundo-amanhecer": "linear-gradient(180deg,#fde7c8 0%,#fbcfa0 40%,#f6e6cf 100%)",
  "fundo-quartinho": "linear-gradient(180deg,#f3e8ff 0%,#fde2e4 55%,#fff 100%)",
  "fundo-mar": "linear-gradient(180deg,#cdeffd 0%,#8fd3f4 55%,#e6f7ff 100%)",
  "fundo-estrelas": "linear-gradient(180deg,#1e2a5a 0%,#39306b 55%,#5b4b8a 100%)",
  "fundo-aurora": "linear-gradient(180deg,#0b2f3a 0%,#12664f 45%,#1f8a6b 80%,#0b2f3a 100%)",
  "fundo-bosque": "linear-gradient(180deg,#e8f3e6 0%,#bcd9b6 45%,#8fbf94 100%)",
  "fundo-lavanda": "linear-gradient(180deg,#f3eefc 0%,#d9c9f2 45%,#b9a3e3 100%)",
  "fundo-deserto": "linear-gradient(180deg,#ffd9a0 0%,#f2a765 45%,#c9714a 100%)",
  "fundo-neve": "linear-gradient(180deg,#eef5fb 0%,#d6e6f3 50%,#c2d6e8 100%)",
  /* Água DOCE — verde-água, para não virar um segundo `fundo-mar` (azul). */
  "fundo-lago": "linear-gradient(180deg,#eaf4ee 0%,#a8d5c6 45%,#6fa8a0 100%)",
  "fundo-campo": "linear-gradient(180deg,#fdf6df 0%,#f0dfa4 45%,#d9b96a 100%)",
  "fundo-nuvens": "linear-gradient(180deg,#dff0fd 0%,#f4fbff 45%,#cfe6f7 100%)",
};

/**
 * Tons "sem graça" do Fundo Suave (grátis). Trocam com a semana pra dar a
 * sensação de que "às vezes muda de cor", sem competir com os cenários pagos.
 */
const FUNDO_SIMPLES_TONS = [
  "linear-gradient(180deg,#f6f7fb 0%,#eef1f7 100%)",
  "linear-gradient(180deg,#f4f8f5 0%,#e8f1ec 100%)",
  "linear-gradient(180deg,#fbf6f4 0%,#f3e9e5 100%)",
  "linear-gradient(180deg,#f5f4fb 0%,#ebe9f5 100%)",
  "linear-gradient(180deg,#f8f6f1 0%,#efeadf 100%)",
  "linear-gradient(180deg,#f2f8fb 0%,#e4eff5 100%)",
];

/* ══════════════════════════════════════════════════════════════════════════
   OS DOIS ITENS MAIS CAROS DA LOJA PASSARAM A FAZER O QUE O NOME DIZ

   "Árvore que cresce" (350 🌱) não crescia e "Ciclo dia/noite" (400 🌱) não
   ciclava: eram um 🌳 e um 🌗 parados como qualquer adesivo. A varredura de
   ago/2026 achou os dois, e eles eram o 1º e o 2º item mais caros do catálogo.

   Consertar valia mais que aposentar. Aposentar tiraria da loja duas peças
   boas; isto entrega o que a paciente leu antes de pagar — e as duas funções
   são puras, então o teste cobra o comportamento sem abrir navegador.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O quanto a Árvore que cresce está crescida, como MULTIPLICADOR do tamanho
 * que a paciente escolheu no modo Arrumar.
 *
 * ⚠️ Multiplicador, e não um tamanho absoluto: ela pode ter posto a árvore
 * grande ou pequena de propósito, e um valor absoluto apagaria essa escolha
 * toda vez que a semana virasse. Aqui o que ela escolheu continua valendo — o
 * que muda é a proporção dentro da própria escolha.
 *
 * Vai de 0,70 (muda) a 1,30 (copa) entre a 4ª e a 40ª semana. Sem semana
 * conhecida devolve 1: a árvore fica do tamanho que ela pôs, que é o mesmo
 * comportamento de qualquer outro item — nunca uma muda, que faria parecer
 * que o item quebrou.
 */
export const ARVORE_MIN = 0.7;
export const ARVORE_MAX = 1.3;

export function escalaDaArvore(week: number | null | undefined): number {
  if (!Number.isFinite(week as number)) return 1;
  const w = Math.min(40, Math.max(4, week as number));
  const t = (w - 4) / 36;
  return ARVORE_MIN + t * (ARVORE_MAX - ARVORE_MIN);
}

/**
 * A face do Ciclo dia/noite na hora dela.
 *
 * ⚠️ Recebe a HORA LOCAL já extraída (0–23) e não um `Date`, para o teste não
 * depender do fuso do contêiner — o mesmo erro de três horas que a agenda já
 * pagou aqui. Quem chama passa `new Date().getHours()`, que é local por
 * definição.
 *
 * ⚠️ NENHUMA das quatro faces é o emoji de um item à venda, e o teste cobra
 * isso. Um quadro da animação com o desenho de outro tile faria a paciente ler
 * o Ciclo como o item que ela não comprou. Foi por essa régua que a face da
 * noite deixou de ser 🌙 (é a `ceu-lua`, 140 🌱) e a do meio-dia deixou de ser
 * ☀️ (é o `ceu-sol`, 120 🌱).
 */
export function faseDoDiaNoite(hora: number): string {
  const h = Number.isFinite(hora) ? ((Math.floor(hora) % 24) + 24) % 24 : 0;
  if (h >= 5 && h < 11) return "🌄";
  if (h >= 11 && h < 17) return "🌞";
  if (h >= 17 && h < 21) return "🌆";
  return "🌃";
}

/**
 * Fundo aplicado no Caminho para um item `fundo`. O Fundo Suave (grátis) troca
 * de tom pela semana; os demais usam o gradiente fixo do catálogo. `week` é a
 * semana gestacional (opcional). Devolve null quando não há cenário.
 */
export function fundoBgFor(id: string | null | undefined, week?: number | null): string | null {
  if (!id) return null;
  if (id === "fundo-simples") {
    const w = Number.isFinite(week) ? Math.max(0, Math.floor(week as number)) : 0;
    return FUNDO_SIMPLES_TONS[w % FUNDO_SIMPLES_TONS.length];
  }
  return CANTINHO_FUNDO_BG[id] ?? null;
}
