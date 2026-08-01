/**
 * Identidade visual dos carrosséis — puxada do `src/styles.css`, não inventada.
 *
 * As cores do site estão em oklch. Converto para sRGB aqui em vez de anotar o
 * hex à mão porque, no dia em que a paleta do app mudar, o carrossel muda junto
 * — e ninguém precisa lembrar de dois lugares.
 */

/** oklch → sRGB. Fórmula do Björn Ottosson (oklab), sem dependência. */
function oklchParaHex(L, C, hGraus) {
  const h = (hGraus * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const canal = (v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, g)) * 255);
  };

  return "#" + lin.map((v) => canal(v).toString(16).padStart(2, "0")).join("");
}

/** Os mesmos valores que estão no `:root` do site. */
export const COR = {
  fundo: oklchParaHex(0.989, 0.009, 52), //  creme pêssego
  cartao: oklchParaHex(0.997, 0.004, 52), //  quase branco, quente
  tinta: oklchParaHex(0.22, 0.035, 22), //   marrom-vinho escuro
  tintaSuave: oklchParaHex(0.48, 0.028, 28),
  primaria: oklchParaHex(0.57, 0.1, 22),
  primariaSuave: oklchParaHex(0.75, 0.07, 22),
  secundaria: oklchParaHex(0.96, 0.022, 38),
  acento: oklchParaHex(0.94, 0.038, 26),
  borda: oklchParaHex(0.9, 0.02, 40),
};

/**
 * Os dois formatos de tela.
 *
 * O Instagram mostra o carrossel em 4:5 e corta o resto; o TikTok preenche em
 * 9:16. Renderizar os dois custa um segundo a mais e evita que a peça apareça
 * com tarja preta numa das duas redes — que é onde a maioria das marcas
 * escorrega.
 */
export const TELAS = {
  instagram: { largura: 1080, altura: 1350, nome: "ig" },
  tiktok: { largura: 1080, altura: 1920, nome: "tt" },
};

/**
 * Os sete pilares já existem no app (`D % 7` em `gestacao-path.tsx`). Reusar a
 * mesma divisão faz o calendário editorial nascer equilibrado sem ninguém
 * decidir nada: a semana de posts cobre exatamente o que a semana de jornada
 * cobre.
 */
export const PILARES = [
  { chave: "bebe", rotulo: "O bebê", emoji: "👶" },
  { chave: "corpo", rotulo: "Seu corpo", emoji: "🫀" },
  { chave: "nutricao", rotulo: "Nutrição", emoji: "🥗" },
  { chave: "sinais", rotulo: "Sinais", emoji: "⚠️" },
  { chave: "exames", rotulo: "Exames", emoji: "🔬" },
  { chave: "vinculo", rotulo: "Vínculo", emoji: "💗" },
  { chave: "revisao", rotulo: "Revisão", emoji: "✅" },
];

export const pilarDoDia = (D) => PILARES[D % 7];
