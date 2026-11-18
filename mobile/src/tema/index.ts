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
  // A entrada (login/cadastro): o degradê do amanhecer, as bolhas que flutuam
  // atrás e o "vidro" das pílulas sobre o degradê.
  entradaPessego: "#ffe4d6",
  entradaLilas: "#e3d9fb",
  entradaVidro: "rgba(255,255,255,0.82)",
  apagado: "#f4f0fa",
  textoApagado: "#6b6384",
  destaque: "#ffe4ee",
  textoDestaque: "#7c1140",
  borda: "#e9e3f2",
  divisor: "#f1ecf7",
  branco: "#ffffff",
  /** Só para o QR da ficha: leitor de QR quer preto puro no branco. */
  preto: "#000000",
  // Famílias (mesmas do site): a cor diz de que assunto é a tela.
  chutes: "#0369a1",
  chutesFundo: "#e0f2fe",
  contracoes: "#c2410c",
  contracoesFundo: "#ffedd5",
  saude: "#047857",
  saudeFundo: "#d1fae5",
  nutricao: "#4d7c0f",
  nutricaoFundo: "#ecfccb",
  agenda: "#4338ca",
  agendaFundo: "#e0e7ff",
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
} as const;

/**
 * A LETRA (16/11/2026, pedido do dono: "está com muita cara de feito no
 * Claude [...] precisamos de efeito Apple"). A do sistema — SF Pro no iPhone —
 * no lugar da Nunito, um degrau mais leve que ela (o SF é mais encorpado).
 * Para voltar à Nunito, `LETRA_DO_SISTEMA = false`: a raiz volta a carregá-la.
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

export const fonte: Readonly<Record<"normal" | "media" | "forte" | "titulo", Letra>> =
  LETRA_DO_SISTEMA
    ? {
        normal: { fontFamily: "System", fontWeight: "400" },
        media: { fontFamily: "System", fontWeight: "500" },
        forte: { fontFamily: REDONDA, fontWeight: "600" },
        titulo: { fontFamily: REDONDA, fontWeight: "700" },
      }
    : {
        normal: { fontFamily: "Nunito_500Medium" },
        media: { fontFamily: "Nunito_600SemiBold" },
        forte: { fontFamily: "Nunito_700Bold" },
        titulo: { fontFamily: "Nunito_800ExtraBold" },
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

/** O canto contínuo do iPhone (a "squircle"), e não o arco de círculo. */
export const curva = { borderCurve: "continuous" } as const;

/** Alvo de toque mínimo (Apple HIG: 44 pt). */
export const ALVO_MINIMO = 44;

/**
 * A profundidade: três camadas, como a luz de um estúdio — o contato (junto
 * da borda), a chave (o corpo da sombra) e o ambiente (largo e fraco). Uma
 * sombra só, borrada, é o que denuncia o desenho genérico.
 */
export const sombra = {
  boxShadow:
    "0px 1px 1px rgba(35,25,66,0.04), 0px 4px 10px -2px rgba(35,25,66,0.06), 0px 18px 36px -12px rgba(35,25,66,0.16)",
} as const;

/** A sombra do que flutua (a barra, os botões soltos): mais alta e mais larga. */
export const sombraFlutuante = {
  boxShadow:
    "0px 2px 4px rgba(35,25,66,0.06), 0px 12px 32px -8px rgba(35,25,66,0.22), 0px 28px 56px -20px rgba(35,25,66,0.20)",
} as const;

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
  campo: "rgba(255,255,255,0.1)",
  campoBorda: "rgba(255,255,255,0.3)",
  campoFoco: "rgba(255,255,255,0.85)",
  placeholder: "rgba(255,255,255,0.58)",
} as const;
