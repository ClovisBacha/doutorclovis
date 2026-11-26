import { Platform } from "react-native";

/**
 * A PALETA "AMANHECER" (16/11/2026, o dono: "se quiser mudar a paleta de
 * cores [...] liberdade criativa máxima"). Antes era a do site — creme,
 * vinho e rosé —, que é, cor por cor, a paleta do Claude: daí a "cara de feito
 * no Claude". A nova sai do céu que o app já pinta atrás do bebê e da bolha
 * furta-cor: a tinta é ameixa-noite, a cor de agir é framboesa, o fundo é uma
 * névoa lilás, e a luz é de pêssego. Uma cor nova entra aqui, nunca solta numa
 * tela. Os contrastes (AA, 4,5:1) foram medidos: framboesa no branco 5,1;
 * apagado na névoa 5,4; tinta na névoa 15,6.
 */
export const cor = {
  fundo: "#fbf9fe",
  texto: "#231942",
  cartao: "#ffffff",
  primaria: "#cf2468",
  primariaEscura: "#a8164f",
  primariaSuave: "#f3a5c3",
  rosaMarca: "#ffe1ec",
  apagado: "#f4f0fa",
  textoApagado: "#6b6384",
  /** O texto de exemplo dentro de um campo vazio (não é valor: mais claro). */
  placeholder: "#958da9",
  destaque: "#ffe4ee",
  textoDestaque: "#7c1140",
  borda: "#e9e3f2",
  divisor: "#f1ecf7",
  branco: "#ffffff",
  /** Só para o QR da ficha: leitor de QR quer preto puro no branco. */
  preto: "#000000",
  // Famílias (mesmas do site): a cor diz de que assunto é a tela.
  chutes: "#2c6aa8",
  chutesFundo: "#e3eefa",
  contracoes: "#c2410c",
  contracoesFundo: "#ffedd5",
  saude: "#047857",
  saudeFundo: "#d1fae5",
  nutricao: "#4d7c0f",
  nutricaoFundo: "#ecfccb",
  agenda: "#5a3fc0",
  agendaFundo: "#ece7fb",
  jogo: "#6d28d9",
  jogoFundo: "#ede9fe",
  sementinha: "#15803d",
  // Gravidade clínica — só para o que a régua de sinais-clinicos devolve.
  urgente: "#b91c1c",
  urgenteFundo: "#fee2e2",
  urgenteBorda: "#fecaca",
  urgentePressionado: "#991b1b",
  // O SOS, nas cores do desenho aprovado do site (emergency-sheet.tsx):
  // o círculo vermelho vivo, o âmbar de "ninguém foi avisado", o rosa dos
  // detalhes e o verde do WhatsApp.
  sosTopo: "#fd1010",
  sosBase: "#e80709",
  sosHalo: "rgba(253,16,16,0.16)",
  sosAmbarTopo: "#f0a30a",
  sosAmbarBase: "#d98600",
  sosRosa: "#e11d48",
  sosRosaFundo: "#ffe4e6",
  sosRosaAro: "#fda4af",
  sosRosaLinha: "rgba(244,63,94,0.08)",
  sosRosaPonto: "#f43f5e",
  zapTopo: "#2da348",
  zapBase: "#259941",
  okPonto: "#059669",
  okClaro: "#ecfdf5",
  atencaoClaro: "#fffbeb",
  atencaoTexto: "#92400e",
  atencaoForte: "#78350f",
  aro: "rgba(0,0,0,0.06)",
  sosFicha: "#fcf4f1",
  atencao: "#b45309",
  atencaoFundo: "#fef3c7",
  ok: "#047857",
  okFundo: "#d1fae5",
  /* 18/11/2026 (a vistoria): os papéis que faltavam, para nenhuma tela pôr
     uma cor solta. */
  /** O texto corrido dentro de um cartão: um degrau abaixo da tinta. */
  textoCorpo: "#463d63",
  /** O trilho de uma barra de progresso ou de um anel vazio. */
  trilho: "#ece6f6",
  /** O chevron das linhas de lista (›). */
  chevron: "#c3bdd2",
  /** O véu atrás de uma folha que sobe. */
  veu: "rgba(35,25,66,0.32)",
  sementinhaFundo: "#e9f7ee",
  acertoFundo: "#e3f6e8",
  /** O "quase": a resposta errada, sem o vermelho de alarme. */
  quase: "#b45309",
  quaseFundo: "#fff4e0",
} as const;

/** O ouro do jogo (estrelas, troféu, a moeda): do brilho à sombra. */
export const ouro = { claro: "#ffe08a", medio: "#fbbf24", escuro: "#f0a51c" } as const;

/**
 * A LETRA (16/11/2026, pedido do dono: "está com muita cara de feito no
 * Claude [...] precisamos de efeito Apple"). A do sistema — SF Pro no iPhone —
 * no lugar da Nunito, um degrau mais leve que ela (o SF é mais encorpado).
 * A Nunito saiu do pacote em 18/11/2026: voltar a ela pede reinstalar
 * `@expo-google-fonts/nunito` e carregá-la na raiz, além de
 * `LETRA_DO_SISTEMA = false`.
 *
 * Use espalhando no estilo (`...fonte.forte`): a letra do sistema precisa do
 * `fontWeight` junto, e a Nunito traz o peso no nome.
 */
export const LETRA_DO_SISTEMA = true;

type Letra = {
  readonly fontFamily: string;
  readonly fontWeight?: "400" | "500" | "600" | "700" | "800";
};

/** O número de vitrine (a semana atrás do bebê, o contador): a arredondada, pesada. */
export const fonteDoNumero: Letra = LETRA_DO_SISTEMA
  ? {
      fontFamily:
        Platform.OS === "web" ? "ui-rounded, system-ui, -apple-system, sans-serif" : "ui-rounded",
      fontWeight: "800",
    }
  : { fontFamily: "Nunito_800ExtraBold" };

/**
 * A letra de TÍTULO, número e botão é a ARREDONDADA do sistema (SF Pro
 * Rounded, a do Fitness e dos Lembretes): o calor que a Nunito tinha, com o
 * acabamento da Apple. O texto corrido fica na SF Pro. Na web (a bancada) o
 * Chrome não tem a arredondada, e cai na do sistema.
 */
const REDONDA =
  Platform.OS === "web" ? "ui-rounded, system-ui, -apple-system, sans-serif" : "ui-rounded";

/**
 * A SERIFADA do sistema (New York, a dos Livros e do Diário da Apple), só nos
 * TÍTULOS GRANDES (18/11/2026, o dono: "essas fontes [...] ainda parecem IA").
 * A arredondada em tudo — título, botão, rótulo — é a cara de app gerado; a
 * serifada dá voz de revista aos títulos, e a SF Pro fica no que se lê e se
 * toca. Na web (a bancada), Georgia no lugar.
 */
const SERIFADA = Platform.OS === "web" ? "ui-serif, 'New York', Georgia, serif" : "ui-serif";

export const fonte: Readonly<Record<"normal" | "media" | "forte" | "titulo" | "display", Letra>> =
  LETRA_DO_SISTEMA
    ? {
        normal: { fontFamily: "System", fontWeight: "400" },
        media: { fontFamily: "System", fontWeight: "500" },
        /* Botão, rótulo, ficha: a SF Pro firme (como nos Ajustes e no Fitness). */
        forte: { fontFamily: "System", fontWeight: "600" },
        /* A arredondada fica com o JOGO: números, placar, etiquetas do jogo. */
        titulo: { fontFamily: REDONDA, fontWeight: "700" },
        /* Títulos grandes (22 pt ou mais): a serifada. */
        display: { fontFamily: SERIFADA, fontWeight: "600" },
      }
    : {
        normal: { fontFamily: "Nunito_500Medium" },
        media: { fontFamily: "Nunito_600SemiBold" },
        forte: { fontFamily: "Nunito_700Bold" },
        titulo: { fontFamily: "Nunito_800ExtraBold" },
        display: { fontFamily: "Nunito_800ExtraBold" },
      };

/**
 * O DEGRADÊ DO AMANHECER: do coral ao rosa e ao violeta, como o céu às seis
 * da manhã. Só em momentos de vitrine (o anel da gestação, o número da semana,
 * um brilho) — nunca atrás de texto pequeno: o coral não segura contraste.
 */
export const amanhecer = ["#ff9a6c", "#f4478f", "#8f5cf7"] as const;

/** O aperto das letras grandes, como nos títulos da Apple (SF Pro Display). */
export const aperto = { titulo: -0.6, subtitulo: -0.3 } as const;

export const espaco = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const raio = { sm: 12, md: 18, lg: 26, pilula: 999 } as const;

/**
 * A ESCALA DA LETRA (18/11/2026) — a do iOS no tamanho padrão. Um tamanho
 * novo entra aqui, e não solto numa tela: é a falta de escala (16, 19, 21, 23…
 * um em cada tela) que dá a cara de coisa gerada.
 *
 * - `grande` e `titulo1`/`titulo2`: na serifada (`fonte.display`).
 * - `titulo3` e `manchete`: SF Pro firme (`fonte.forte`).
 * - `corpo`, `chamada`, `legenda`, `nota`: SF Pro (`fonte.normal`/`media`).
 */
export const escala = {
  grande: { fontSize: 34, lineHeight: 41 },
  titulo1: { fontSize: 28, lineHeight: 34 },
  titulo2: { fontSize: 22, lineHeight: 28 },
  titulo3: { fontSize: 20, lineHeight: 25 },
  manchete: { fontSize: 17, lineHeight: 22 },
  corpo: { fontSize: 17, lineHeight: 24 },
  chamada: { fontSize: 16, lineHeight: 21 },
  legenda: { fontSize: 15, lineHeight: 20 },
  nota: { fontSize: 13, lineHeight: 18 },
} as const;

/** O canto por PAPEL: o mesmo papel, o mesmo canto, em todo o app. */
export const canto = {
  icone: 10,
  campo: 14,
  /** Um bloco dentro de um painel ou cartão. */
  dentro: 20,
  cartao: 26,
  painel: 34,
  pilula: 999,
} as const;

/** A margem da tela (16, a do iOS) e a de um momento de foco (24). */
export const margem = { tela: 16, foco: 24 } as const;

/** O canto contínuo do iPhone (a "squircle"), e não o arco de círculo. */
export const curva = { borderCurve: "continuous" } as const;

/** Alvo de toque mínimo (Apple HIG: 44 pt). */
export const ALVO_MINIMO = 44;

/**
 * A profundidade: duas camadas, como a luz de um estúdio — a chave (o corpo
 * da sombra, junto da borda) e o ambiente (largo e fraco). Uma sombra só,
 * borrada, é o que denuncia o desenho genérico.
 *
 * ⚠️ DESEMPENHO (24/11/2026): no iOS cada camada de `boxShadow` é uma passada
 * fora da tela, refeita a cada quadro em que algo se mexe por perto (a
 * rolagem, a inclinação). Eram três; a de contato (1 px, 4%) quase não se via
 * e custava um terço. Não acrescente uma terceira.
 */
export const sombra = {
  boxShadow: "0px 4px 10px -2px rgba(35,25,66,0.08), 0px 18px 36px -12px rgba(35,25,66,0.16)",
} as const;

/** A sombra do que flutua (a barra, os botões soltos): mais alta e mais larga. */
export const sombraFlutuante = {
  boxShadow: "0px 12px 32px -8px rgba(35,25,66,0.24), 0px 28px 56px -20px rgba(35,25,66,0.20)",
} as const;

/** As sombras por papel (todas em `boxShadow`, desenhadas uma vez). */
export const sombras = {
  cartao: sombra,
  painel: { boxShadow: "0px 20px 44px -20px rgba(20,12,60,0.5)" },
  flutuante: sombraFlutuante,
} as const;

/** O brilho colorido embaixo de um botão cheio ou de uma ficha de destaque. */
export function brilhoDe(corHex: string, alfa = 0.55): { boxShadow: string } {
  const h = corHex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return { boxShadow: `0px 10px 22px -10px rgba(${r},${g},${b},${alfa})` };
}

/**
 * O VIDRO e a LUZ. O vidro de verdade (Liquid Glass, iOS 26) mora em
 * `componentes/vidro.tsx`; estas são as cores da reserva (web e iOS antigo) e
 * do fundo de luz que fica atrás de tudo (`componentes/luz.tsx`).
 */
export const vidro = {
  /** A reserva sem desfoque (iOS antes do 26): quase opaca, para ler bem. */
  reserva: "rgba(255,255,255,0.94)",
  /** A reserva na web, que desfoca de verdade (`backdropFilter`). */
  reservaWeb: "rgba(255,255,255,0.62)",
  /** O fio de luz na borda do vidro. */
  borda: "rgba(255,255,255,0.85)",
  /** A lente sob a aba escolhida: uma gota clara, erguida (a seleção do iOS 26). */
  lente: "rgba(255,255,255,0.82)",
  lenteSombra: "0px 2px 10px -3px rgba(35,25,66,0.22)",
} as const;

export const luz = {
  base: "#fbf9fe",
  pessego: "#ffdccb",
  lilas: "#dcd2fb",
  rose: "#ffd3e2",
  /** O cartão: branco, com um tico do fundo passando. */
  cartao: "rgba(255,255,255,0.86)",
} as const;

/**
 * A FLOR DO RESPIRO (23/11/2026, o dono: "uma outra arte mais 3D, com
 * movimentos, assim como a Apple faz"): as seis pétalas da tela de respirar
 * são bolhas de sabão furta-cor, como a Bolha — o tom do corpo e o brilho da
 * borda de cada uma. Elas se somam (`mixBlendMode: "screen"`) sobre a noite.
 * Enfeite: nenhum texto em cima delas.
 */
export const florDoRespiro = {
  petalas: [
    { tom: "#ff7eb6", brilho: "#ffd3e7" },
    { tom: "#b49bff", brilho: "#e7deff" },
    { tom: "#7fb6ff", brilho: "#d8e9ff" },
    { tom: "#74dcca", brilho: "#d6faf3" },
    { tom: "#ffbd85", brilho: "#ffe9d4" },
    { tom: "#ff9bd0", brilho: "#ffe1f1" },
  ],
  /** O halo atrás da flor, que acende quando ela inspira. */
  halo: "#a98bff",
} as const;

/**
 * O VÉU DA ENTRADA (17/11/2026, o dono: "esse fundo branco aí no cadastro do
 * e-mail [...] não gosto disso"). A entrada não tem mais folha branca: escreve
 * direto sobre o céu da hora, com um véu de ameixa-noite que escurece o pé da
 * tela (ou a tela inteira, nos formulários). Sobre o véu o texto é branco; os
 * campos são de vidro escuro. As cores com texto estão na catraca de contraste
 * (`vidro-e-luz.test.ts`), medidas contra o fundo do véu.
 */
export const veu = {
  /** O fundo do véu (a cor cheia do pé da tela). */
  fundoDoVeu: "#140d33",
  /** O véu como cor com transparência, para o degradê. */
  tinta: (alfa: number) => `rgba(20,13,51,${alfa})`,
  /** O texto de apoio sobre o véu. */
  textoNoVeu: "#ddd6f7",
  /** O link sobre o véu (um rosa claro da framboesa). */
  linkNoVeu: "#ffc6da",
  /** O erro sobre o véu (o vermelho do app não se lê no escuro). */
  erroNoVeu: "#ffbfcf",
  /**
   * O destaque sobre o véu: a luz de pêssego do amanhecer (20/11/2026, o funil
   * "Montar o meu plano"): o número que importa, o nome dela, o ícone de uma
   * opção. Nunca para agir (agir é a framboesa).
   */
  destaqueNoVeu: "#ffc9a8",
  /**
   * A SUPERFÍCIE sobre o véu (21/11/2026, "mais clean, de outro nível"): uma
   * só, discreta, para tudo o que agrupa conteúdo no funil — no lugar dos
   * blocos brancos, que cortavam o céu. Escolhida, ela acende um pouco.
   */
  superficie: "rgba(255,255,255,0.07)",
  /**
   * O VIDRO DA CONVERSA (23/11/2026, o dono: "o chat da Bolha deve ficar mais
   * clean [...] esse fundo branco ficou ruim no chat"): a conversa com a Bolha
   * é o funil continuando, um vidro de ameixa-noite solto sobre o céu, com o
   * texto branco. A 62% ele segura 4,5:1 com o branco até sobre um céu
   * branco (`vidro-e-luz.test.ts` mede).
   */
  vidroDaConversa: "rgba(28,20,66,0.62)",
  vidroDaConversaBorda: "rgba(255,255,255,0.2)",
  superficieBorda: "rgba(255,255,255,0.11)",
  superficieAcesa: "rgba(255,255,255,0.16)",
  campo: "rgba(255,255,255,0.1)",
  campoBorda: "rgba(255,255,255,0.3)",
  campoFoco: "rgba(255,255,255,0.85)",
  placeholder: "rgba(255,255,255,0.58)",
} as const;

/**
 * A FOLHA DE BAIXO NO VIDRO DA NOITE (25/11/2026, o dono: a folha do foguinho
 * "com o fundo ainda branco, em vez daquele fundo liquid glass que a gente tá
 * trabalhando"). Toda folha que sobe de baixo (`Folha`, em
 * `componentes/jornada/pecas.tsx`) é o vidro da conversa da Bolha: o Liquid
 * Glass escuro do sistema com a ameixa-noite por cima (sem o vidro do
 * sistema, a ameixa quase opaca), texto branco. Dentro dela, o `T` já escreve
 * claro (`TintaClara`, em `base.tsx`); o texto escrito à mão usa estas cores.
 */
export const folha = {
  /** A ameixa por cima do vidro do sistema: a da conversa, um pouco mais cheia
      (sobre uma tela clara, como a da aula, a de 62% ficava cinza). */
  sobreOVidro: "rgba(34,22,84,0.74)",
  /** Sem o vidro do sistema (iOS antigo, web): quase opaca, para ler. */
  semVidro: "rgba(30,21,70,0.96)",
  borda: "rgba(255,255,255,0.18)",
  texto: "#ffffff",
  apagado: "#ddd6f7",
  /** O que agrupa conteúdo dentro da folha (no lugar do cartão branco). */
  superficie: "rgba(255,255,255,0.08)",
  superficieBorda: "rgba(255,255,255,0.12)",
  alca: "rgba(255,255,255,0.38)",
  /** O fundo do X e das pílulas apagadas. */
  apagadoFundo: "rgba(255,255,255,0.14)",
  /** O destaque (o pêssego do amanhecer) e o violeta do jogo, claros. */
  destaque: "#ffc9a8",
  jogo: "#c9b8ff",
  sementinha: "#b6f0a8",
} as const;
