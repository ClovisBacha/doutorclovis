/**
 * ESPECIFICAÇÃO DAS 39 ILUSTRAÇÕES DO BEBÊ — semanas 4 a 42.
 *
 * Fonte única e versionada dos prompts. Existe para que gerar de novo (por
 * erro, por mudança de estilo, por troca de modelo) seja repetir um comando —
 * e não redescobrir 39 decisões de cabeça.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE 39 E NÃO 42
 *
 * `WEEK_MIN = 4` e `WEEK_MAX = 42` em `src/lib/gestacao.ts`, e `BABY_BY_WEEK`
 * tem exatamente essas 39 semanas, sem buracos. Antes da 4 não há embrião para
 * desenhar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE ONDE VEM A MUDANÇA VISÍVEL
 *
 * O marco de cada semana sai de `BABY_BY_WEEK[n].desc` — a mesma frase que o
 * app já mostra para a paciente. Mas metade dos marcos é INTERNA ("órgãos
 * vitais começam a funcionar", "sistema imunológico em desenvolvimento") e não
 * tem como aparecer por fora. Fingir que aparece seria inventar anatomia, e a
 * credibilidade do produto é o ativo do consultório.
 *
 * Então cada semana declara `visivel`:
 *
 *   true  → o marco É desenhável (dedos se separam, olhos abrem, cefálica).
 *           O prompt mostra o marco.
 *   false → o marco é interno. A diferença daquela semana vem da progressão
 *           gradual (proporção cabeça/corpo, gordura, opacidade da pele,
 *           lanugo) e da POSE, que varia de propósito para a semana não
 *           parecer parada.
 *
 * O TAMANHO não entra na imagem: `BabyIllustration` já escala continuamente por
 * semana. A imagem carrega FORMA; o código carrega tamanho. Por isso todas as
 * 39 são normalizadas para a mesma fração de tinta na caixa (ver
 * `normalizar.mjs`) — sem isso o bebê salta de tamanho ao trocar de arquivo,
 * que é o defeito que a arte atual tem hoje (72% a 89% de ocupação).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÂNCORAS
 *
 * 39 gerações independentes produzem 39 bebês diferentes — a criança trocaria
 * de rosto toda semana, o que numa tela aberta diariamente é pior que ter 5
 * imagens. Seis âncoras são geradas primeiro e com cuidado; da semana 12 em
 * diante, cada semana usa a âncora mais próxima como imagem de referência, e a
 * deriva fica contida em blocos de ~6 semanas em vez de acumular por 39.
 *
 * Antes da 12 não se encadeia — ver `PRIMEIRA_SEMANA_ENCADEADA`.
 */

/**
 * Âncoras: geradas e aprovadas primeiro.
 *
 * Cinco delas (14, 20, 26, 33, 40) são referência de identidade das vizinhas. A
 * de número 8 não referencia ninguém: ela existe para APROVAR O ESTILO do
 * primeiro trimestre antes de gerar as semanas 4 a 11, que rodam sem
 * referência. É a única do lote cujo papel é decidir, não amarrar.
 */
export const ANCORAS = [8, 14, 20, 26, 33, 40];

/**
 * O bloco de estilo — idêntico em TODAS as 39.
 *
 * É o que garante que as 39 pareçam a mesma obra. Três exigências que vieram de
 * teste, não de teoria:
 *
 *  · FUNDO CINZA NEUTRO, não verde. A primeira prova foi feita em chroma verde
 *    e deixou franja esverdeada no cabelo depois do recorte.
 *  · PELE CLARA DE BASE. `BabyIllustration` escurece a pele por filtro SVG de
 *    gamma (os 5 tons de `BABY_TONES`). O filtro só escurece — partir de uma
 *    pele já escura quebraria os quatro tons mais claros.
 *  · VOLTADO PARA A ESQUERDA, cordão para a esquerda. É a orientação das cinco
 *    imagens atuais; misturar orientação faria o bebê "virar" entre semanas.
 */
export const ESTILO = `Soft 3D-rendered digital illustration for a friendly, warm pregnancy app —
the look of a lovingly rendered, glossy 3D character, NOT a medical model and NOT an anatomy textbook.

RENDER: polished glossy finish with soft specular highlights on the forehead, cheeks, shoulder and
belly; smooth subsurface scattering; rounded, soft, huggable forms; sweet gentle face. Soft diffuse
studio light from the upper left plus a warm rim light. No harsh shadows, no veins, no blood, no
membranes, no wrinkles, no texture detail on the skin.

COLOR — this matters: WARM ROSY PEACH skin with healthy pink undertones, softly saturated and
luminous. NOT pale, NOT grey, NOT desaturated, NOT washed out, NOT waxy. The grey background must
NOT tint or desaturate the baby: the baby stays warm and rosy against it.

Skin must stay LIGHT in value (a neutral light base that is digitally re-toned darker later) while
still being warm and saturated in hue.

ORIENTATION: the baby faces LEFT. The umbilical cord is SHORT and COMPACT — it curves close to the
body and ends in a soft rounded tip; it is NOT long, NOT trailing, and does NOT loop across the frame.

BACKGROUND: a perfectly flat, uniform, NEUTRAL MID-GREY (#9a9a9a) filling the frame edge to edge —
no floor, no cast shadow, no gradient, no vignette, no props, no text, no border.

COMPOSITION: a SMALL subject in a LARGE empty frame. The baby and its short cord together occupy only
about 55% of the frame, floating centered with a very wide band of empty grey on every side. Wide
empty margins are REQUIRED — nothing may come near any edge. Square 1:1.`;

/**
 * As 39 semanas.
 *
 * `marco` é a frase de `BABY_BY_WEEK[n].desc`, copiada — não parafraseada, para
 * que a imagem e o texto que a paciente lê embaixo dela digam a mesma coisa.
 * `forma` descreve o corpo naquela semana. `pose` é o diferenciador quando o
 * marco é interno.
 */
export const SEMANAS = [
  // ── 1º TRIMESTRE — a transformação mais dramática da gestação ──────────────
  // Toda semana é outro ser. É aqui que "muda toda semana" se sustenta sozinho.
  {
    s: 4,
    visivel: true,
    marco: "Implantação no útero. Tubo neural começa a se formar.",
    marcoEn: "the embryo has just implanted; the neural groove is forming along its back",
    forma:
      "a minuscule, endearing curved embryo, little more than a smooth comma-shaped bud with a faint groove along its back, no limbs yet, no face yet, softly glowing and translucent",
    pose: "gently curled, seen in profile",
  },
  {
    s: 5,
    visivel: true,
    marco: "Coração começa a bater.",
    marcoEn: "the heart has just begun to beat",
    forma:
      "a tiny curved embryo, comma-shaped, with a barely-there rounded head end and a soft swelling where the heart is forming, no limbs yet, translucent and delicate",
    pose: "curled in profile, the heart area catching a soft warm glow",
  },
  {
    s: 6,
    visivel: true,
    marco: "Brotos de braços e pernas aparecem.",
    marcoEn: "tiny arm and leg buds are appearing",
    forma:
      "a small curled embryo with a large rounded head, one big dark gentle eye spot, and four tiny soft nubs where the arms and legs are budding",
    pose: "curled in profile, tail-like lower end still visible",
  },
  {
    s: 7,
    visivel: true,
    marco: "Rosto começa a se formar.",
    marcoEn: "the face is beginning to form",
    forma:
      "a curled embryo with a proportionally large rounded head, a soft dark eye spot, the faintest suggestion of a nose and mouth beginning, small paddle-like limb buds",
    pose: "curled in profile",
  },
  {
    s: 8,
    visivel: true,
    marco: "Dedinhos das mãos começam a se separar.",
    marcoEn: "the fingers are beginning to separate",
    forma:
      "a curled embryo-to-fetus with a large rounded head, closed gentle eyes, a soft little face, and small paddle hands where individual fingers are just beginning to separate",
    pose: "curled, one tiny hand lifted near the face so the separating fingers read clearly",
  },
  {
    s: 9,
    visivel: true,
    marco: "Já se chama feto. Movimentos pequenos.",
    marcoEn: "it is now called a fetus and makes small movements",
    forma:
      "a small fetus, no longer embryo-like: rounded head, sweet closed eyes, a recognisable little face, distinct arms and legs with tiny fingers and toes",
    pose: "curled, limbs relaxed, one arm drifting as if moving gently",
  },
  {
    s: 10,
    visivel: false,
    marco: "Órgãos vitais começam a funcionar.",
    forma:
      "a small fetus with a large head relative to the body, closed peaceful eyes, softly translucent pink skin, slender arms and legs",
    pose: "curled with both hands drawn near the chest",
  },
  {
    s: 11,
    visivel: true,
    marco: "Unhas começam a crescer.",
    marcoEn: "soft fingernails are beginning to grow",
    forma:
      "a small fetus, head still large, closed peaceful eyes, slender limbs, tiny fingers with the faintest suggestion of soft nails",
    pose: "curled, one hand open and visible near the face",
  },
  {
    s: 12,
    visivel: false,
    marco: "Reflexos surgem. Risco de aborto diminui muito.",
    forma:
      "a small fetus with rounder cheeks beginning, closed peaceful eyes, softly translucent skin, arms and legs clearly formed",
    pose: "curled, one leg gently kicking outward",
  },
  {
    s: 13,
    visivel: false,
    marco: "Cordas vocais se formam.",
    forma:
      "a small fetus, head large but body lengthening, closed peaceful eyes, soft rounding cheeks, translucent pink skin",
    pose: "curled, chin gently tucked toward the chest",
  },

  // ── 2º TRIMESTRE — proporção, pele, cabelo. Muda de verdade, mais devagar ──
  {
    s: 14,
    visivel: true,
    marco: "Pode chupar o dedinho.",
    marcoEn: "it can suck its thumb",
    forma:
      "a fetus with a softer, rounder face, closed peaceful eyes, smooth translucent skin, arms and legs well formed and slender",
    pose: "curled with the thumb gently at the mouth — sucking the thumb, clearly readable",
  },
  {
    s: 15,
    visivel: true,
    marco: "Pode sentir a luz através das pálpebras.",
    marcoEn: "it can sense light through its eyelids",
    forma:
      "a fetus with delicate closed eyelids that read clearly, a soft rounded face, smooth translucent skin",
    pose: "curled, face tilted slightly up as if toward a soft warm light",
  },
  {
    s: 16,
    visivel: true,
    marco: "Movimentos coordenados de cabeça.",
    marcoEn: "coordinated head movements",
    forma:
      "a fetus with a more balanced head-to-body proportion, closed peaceful eyes, smooth skin, limbs relaxed",
    pose: "curled, head turned gently to the side",
  },
  {
    s: 17,
    visivel: false,
    marco: "Esqueleto começa a endurecer.",
    forma:
      "a fetus with slightly firmer, more defined limbs and a gently rounded body, closed peaceful eyes",
    pose: "curled, arms crossed loosely over the chest",
  },
  {
    s: 18,
    visivel: true,
    marco: "Audição se desenvolvendo.",
    marcoEn: "hearing is developing — the ears are formed",
    forma:
      "a fetus with small delicate ears now clearly formed and visible, closed peaceful eyes, smooth skin",
    pose: "curled in profile so one little ear reads clearly",
  },
  {
    s: 19,
    visivel: true,
    marco: "Vernix caseoso cobre a pele.",
    marcoEn: "vernix caseosa now covers the skin",
    forma:
      "a fetus whose skin carries a very soft, subtle creamy-white sheen — a gentle waxy bloom, tasteful and clean, never messy",
    pose: "curled, both hands near the face",
  },
  {
    s: 20,
    visivel: true,
    marco: "Você já pode sentir os movimentos!",
    marcoEn: "the mother can now feel the movements",
    forma:
      "a fetus with visibly better proportions, gently rounding limbs, closed peaceful eyes, a sweet calm face",
    pose: "mid-movement: one leg extended in a gentle kick, one arm reaching, alive and playful",
  },
  {
    s: 21,
    visivel: true,
    marco: "Sobrancelhas e pálpebras formadas.",
    marcoEn: "eyebrows and eyelids are fully formed",
    forma:
      "a fetus with fine delicate eyebrows now visible and clearly defined eyelids, a sweet rounded face",
    pose: "curled, face turned toward the viewer's left, eyebrows readable",
  },
  {
    s: 22,
    visivel: false,
    marco: "Reconhece sons externos.",
    forma:
      "a fetus with a slightly fuller face, fine eyebrows, delicate ears, gently rounding body",
    pose: "curled, head tilted as if listening",
  },
  {
    s: 23,
    visivel: false,
    marco: "Pode soluçar dentro do útero.",
    forma:
      "a fetus with softly filling cheeks, fine eyebrows, smooth skin with a faint creamy sheen",
    pose: "curled, one small fist near the chin",
  },
  {
    s: 24,
    visivel: false,
    marco: "Limite da viabilidade fetal.",
    forma:
      "a fetus with noticeably rounder cheeks and softening limbs, fine eyebrows, delicate closed eyes",
    pose: "curled, both fists tucked under the chin",
  },
  {
    s: 25,
    visivel: true,
    marco: "Cabelo começa a ganhar cor.",
    marcoEn: "the hair is starting to gain colour",
    forma:
      "a fetus with fine soft light-brown hair now visible on the head, rounded cheeks, delicate features",
    pose: "curled, head slightly forward so the hair reads clearly",
  },
  {
    s: 26,
    visivel: true,
    marco: "Olhos começam a abrir.",
    marcoEn: "the eyes are beginning to open",
    forma:
      "a fetus with soft light-brown hair, plumping cheeks, and eyes GENTLY OPENING — a soft, sleepy, tender half-open gaze, never staring, never startling",
    pose: "curled, face toward the viewer's left, eyes softly open",
  },
  {
    s: 27,
    visivel: false,
    marco: "Reconhece sua voz.",
    forma: "a fetus with soft hair, round cheeks, gently closed eyes again, limbs filling out",
    pose: "curled, head turned as if toward a familiar sound",
  },

  // ── 3º TRIMESTRE — gordura e POSIÇÃO. A virada cefálica é o marco visível ──
  {
    s: 28,
    visivel: false,
    marco: "Sonha em REM. Início do 3º trimestre.",
    forma:
      "a well-formed baby with soft hair, round cheeks, plumping arms and legs, smooth healthy skin",
    pose: "curled peacefully asleep, one hand near the cheek",
  },
  {
    s: 29,
    visivel: false,
    marco: "Músculos e pulmões amadurecem.",
    forma: "a baby with firmer, fuller limbs, soft hair, round cheeks, healthy plump body",
    pose: "curled, arms drawn in, chest gently full",
  },
  {
    s: 30,
    visivel: false,
    marco: "Cérebro se desenvolve rapidamente.",
    forma: "a baby with a well-rounded head, soft light-brown hair, chubby cheeks and limbs",
    pose: "curled, one fist against the cheek, deeply asleep",
  },
  {
    s: 31,
    visivel: true,
    marco: "Pode girar a cabeça.",
    marcoEn: "it can turn its head",
    forma: "a chubby healthy baby with soft hair, full cheeks, rounded limbs",
    pose: "curled, head clearly turned to the side, mid-movement",
  },
  {
    s: 32,
    visivel: true,
    marco: "Unhas dos pés se formam.",
    marcoEn: "the toenails are forming",
    forma:
      "a chubby baby with soft hair, plump rounded limbs, and tiny toes with delicate soft nails",
    pose: "curled with one little foot lifted and visible, toes readable",
  },
  {
    s: 33,
    visivel: false,
    marco: "Sistema imunológico em desenvolvimento.",
    forma:
      "a VERY chubby, round, healthy baby with deep rolls of baby fat on the arms, legs and wrists, full puffy cheeks, a soft double chin, a round full belly, and fine soft light-brown hair",
    pose: "curled tightly and peacefully, both hands near the face",
  },
  {
    s: 34,
    visivel: false,
    marco: "Pulmões quase prontos.",
    forma: "a plump healthy baby, fuller chest, soft hair, round cheeks, smooth skin",
    pose: "curled, chest full, one arm relaxed outward",
  },
  {
    s: 35,
    visivel: true,
    marco: "Posição cefálica se define.",
    marcoEn: "the head-down (cephalic) position is settling",
    forma: "a plump full-term-looking baby with soft hair and round cheeks",
    pose: "HEAD-DOWN: the baby is oriented head-downward in the frame, curled, settled — the cephalic position, clearly readable",
  },
  {
    s: 36,
    visivel: false,
    marco: "Considerado a termo precoce em breve.",
    forma: "a plump baby with fuller cheeks and limbs, soft light-brown hair, smooth healthy skin",
    pose: "head-down, curled compactly, less room to move",
  },

  // ── TERMO — muda pouco, mas é onde ela mais olha ──────────────────────────
  {
    s: 37,
    visivel: true,
    marco: "Termo precoce — pulmões prontos.",
    marcoEn: "early term — the lungs are ready",
    forma:
      "a full-term newborn: very chubby and round, thick baby-fat rolls on arms and thighs, full puffy cheeks, soft double chin, well-defined sweet features, fine soft light-brown hair, smooth rosy peachy skin",
    pose: "curled peacefully, one fist near the cheek",
  },
  {
    s: 38,
    visivel: true,
    marco: "Encaixe pélvico em muitos casos.",
    marcoEn: "the head has engaged in the pelvis",
    forma: "a full-term chubby newborn with soft hair, full round cheeks and plump limbs",
    pose: "head-down and settled low, curled compactly — engaged in the pelvis",
  },
  {
    s: 39,
    visivel: false,
    marco: "Termo completo!",
    forma:
      "a full-term chubby newborn, rosy and healthy, soft light-brown hair, very plump rounded arms and legs, full cheeks",
    pose: "curled peacefully, both hands tucked near the chin, serene",
  },
  {
    s: 40,
    visivel: false,
    marco: "Pronto para chegar a qualquer momento — no tempo dele.",
    forma:
      "a FULL-TERM newborn at maximum chubbiness — noticeably rounder and plumper than earlier weeks: thick rolls of baby fat on arms, thighs and wrists, very full puffy cheeks, a soft double chin, a round belly, rosy healthy skin, fine soft light-brown hair, ready to be born",
    pose: "curled peacefully, one fist near the cheek, deeply serene and content",
  },
  {
    s: 41,
    visivel: false,
    marco: "Termo tardio — acompanhamento mais de pertinho, tudo sob cuidado.",
    forma:
      "a full-term chubby newborn with slightly longer soft hair, very plump limbs, full cheeks, healthy rosy skin",
    pose: "curled snugly, both hands near the face, calm and safe",
  },
  {
    s: 42,
    visivel: false,
    marco: "Reta final — o bem-estar do bebê é acompanhado de perto pela sua equipe.",
    forma:
      "a full-term chubby newborn, longer soft hair, very plump rounded limbs, full cheeks, serene and healthy",
    pose: "curled snugly, one hand open near the cheek, utterly peaceful",
  },
];

/**
 * A partir de qual semana faz sentido encadear numa âncora.
 *
 * Antes da 12 NÃO se encadeia, e isso veio de pensar no que a âncora preserva:
 * ela carrega ROSTO e PROPORÇÃO. Nas semanas 4 a 11 não há rosto — é um broto
 * curvo que vira embrião —, e a forma muda tanto de uma semana para a outra que
 * dar a semana 8 como referência da 4 empurraria o modelo a "desenvolver" o
 * embrião cedo demais: a paciente de 4 semanas veria dedinhos que ainda não
 * existem.
 *
 * Nessa faixa a consistência vem do bloco de ESTILO, que já é idêntico em todas
 * — e é só disso que essas semanas precisam.
 */
export const PRIMEIRA_SEMANA_ENCADEADA = 12;

/**
 * A âncora que a semana usa como referência de identidade.
 * `null` = gera sem referência (ver `PRIMEIRA_SEMANA_ENCADEADA`).
 */
export function ancoraDe(semana) {
  if (semana < PRIMEIRA_SEMANA_ENCADEADA) return null;
  return ANCORAS.filter((a) => a >= PRIMEIRA_SEMANA_ENCADEADA).reduce((a, b) =>
    Math.abs(b - semana) < Math.abs(a - semana) ? b : a,
  );
}

/** O prompt final de uma semana. */
export function promptDa(semana) {
  const e = SEMANAS.find((x) => x.s === semana);
  if (!e) throw new Error(`semana ${semana} fora de 4..42`);
  return `${ESTILO}

Subject: ${e.forma}.
Pose: ${e.pose}.
Developmental week: ${e.s} of pregnancy${e.visivel ? ` — the visible milestone this week: ${e.marcoEn}` : ""}.

The baby must be endearing and friendly — a mother will look at this every day for a week.`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const alvo = Number(process.argv[2]);
  if (alvo) {
    console.log(promptDa(alvo));
  } else {
    const vis = SEMANAS.filter((e) => e.visivel).length;
    console.log(
      `${SEMANAS.length} semanas · ${vis} com marco visível · ${SEMANAS.length - vis} por progressão/pose`,
    );
    console.log(`âncoras: ${ANCORAS.join(", ")}`);
    for (const e of SEMANAS) {
      const a = ancoraDe(e.s);
      console.log(
        `${String(e.s).padStart(2)} ${e.visivel ? "◆" : "·"} ${a ? `ancora ${String(a).padStart(2)}` : "sem ref. "} | ${e.marco}`,
      );
    }
  }
}
