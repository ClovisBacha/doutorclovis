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
 * A GORDURA DO BEBÊ — a correção que veio de olhar o resultado
 *
 * A primeira leva saiu MAGRA demais para o termo. Corrigi trocando por
 * "maximum chubbiness — thick rolls of baby fat, soft double chin" — e corrigi
 * DEMAIS: apliquei isso inclusive na semana 33, que não é termo. O resultado
 * tinha corpo de bebê de uns quatro meses de vida. Errado por vinte semanas.
 *
 * A gordura fetal se acumula quase toda no 3º trimestre, e devagar:
 *
 *   28 sem  ~3%   ainda magrinho, pele fina
 *   33 sem  ~8%   enchendo, SEM dobras
 *   36 sem  ~12%  redondinho
 *   40 sem  ~15%  cheio — mas NÃO é o "bebê Michelin"
 *
 * O bebê rechonchudo com dobras e papada que todo mundo imagina é um bebê de
 * TRÊS A SEIS MESES DE VIDA, que engordou mamando. Recém-nascido de verdade é
 * mais enxuto que a imagem popular.
 *
 * E aqui isso não é preciosismo: a paciente olha esta imagem por uma semana e
 * depois vê o próprio filho nascer. Se a ilustração prometeu um bebê gordo e
 * nasce um recém-nascido normal, ela pode achar que há algo errado com o dela.
 * Num app de alto risco, plantar essa dúvida é o oposto do que o produto vende.
 *
 * A régua, por faixa:
 *
 *   21-27  MAGRO. Quase nada de gordura ainda — membros finos, sem dobra alguma
 *   28-32  membros enchendo, bochechas arredondando, SEM dobras
 *   33-36  redondinho, dobra LEVE em punho e coxa, sem papada
 *   37-42  cheio e macio, UMA dobrinha discreta — parando antes do exagero
 *
 * A faixa 21-27 entrou depois, e por um erro que só apareceu ao olhar as
 * âncoras juntas: a correção acima endureceu as semanas 28 a 42 ("still
 * slender", "NO fat rolls") e deixou as anteriores com palavras macias —
 * "plumping cheeks", "limbs filling out", "noticeably rounder". O modelo leu
 * isso ao pé da letra e desenhou a semana 26 MAIS GORDA que a 28. A curva
 * andava para trás no meio da série, e nenhuma medida pegava: cada imagem,
 * sozinha, estava aceitável.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * OS OLHOS
 *
 * Só a semana 26 tem os olhos abrindo — é o marco dela. Em todas as outras a
 * `pose` diz "eyes closed" com todas as letras, porque "curled peacefully" e
 * "deeply serene" NÃO bastaram: as semanas 33 e 40 saíram com o bebê acordado
 * encarando quem olha, o que além de repetir a 26 dá um ar de foto de estúdio
 * em vez de bebê dormindo dentro da mãe.
 *
 * E na 26 a instrução virou positiva ("as pálpebras acabaram de se separar,
 * uma fresta"). A redação anterior descrevia pelo que NÃO era ("never
 * staring") e o modelo entregou exatamente o olhar arregalado proibido —
 * negativa em prompt é pedido fraco.
 *
 * A referência visual é `baby-tardio.png`, a arte que já existia: gordinha o
 * suficiente para ser fofa, realista o suficiente para ser verdade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÂNCORAS
 *
 * 39 gerações independentes produzem 39 bebês diferentes — a criança trocaria
 * de rosto toda semana, o que numa tela aberta diariamente é pior que ter 5
 * imagens. Seis âncoras são geradas primeiro e com cuidado; da semana 12 em
 * diante, `ancoraDe` diz qual delas é a vizinha mais próxima.
 *
 * Antes da 12 não se encadeia — ver `PRIMEIRA_SEMANA_ENCADEADA`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ANEXAR A ÂNCORA COMO IMAGEM DE REFERÊNCIA NÃO FUNCIONA — MEDIDO, NÃO SUPOSTO
 *
 * A ideia original era mandar a âncora junto, como `medias[role=image]`. Doze
 * semanas foram geradas assim e o resultado foi o contrário do pretendido: a
 * referência carregou a POSE, não só a identidade. As semanas 10 a 16 saíram
 * como a MESMA imagem seis vezes — a 12 pedia "uma perna chutando para fora", a
 * 13 "queixo encaixado no peito", a 15 "rosto inclinado para a luz", a 16
 * "cabeça virada de lado", e nenhuma aconteceu. Semelhança medida entre
 * vizinhas: 0,904 · 0,977 · 0,953. O enquadramento também travou: folga de
 * exatamente 305px e ocupação de 68,x% em quase todas.
 *
 * Tentei consertar por texto, com um bloco explícito ("copie rosto, pele e
 * proporção; NÃO copie a pose; a pose TEM que sair visivelmente diferente").
 * Duas semanas foram regeradas com ele — 12 e 16 — e saíram idênticas às
 * anteriores. O bloco foi removido: código que não faz o que promete é pior que
 * código ausente, porque o próximo a ler acredita nele.
 *
 * A prova do contrário estava do lado: as SEIS âncoras foram geradas SEM
 * referência e cada uma acertou a sua pose — a 14 chupando o dedo, a 20
 * chutando, a 26 com a pálpebra entreaberta, a 33 e a 40 dormindo. Com imagem
 * anexada o modelo copia; sem ela, ele lê.
 *
 * Então a consistência vem do bloco de ESTILO, que é idêntico nas 39 — e ele
 * basta: as seis âncoras, geradas independentemente, parecem a mesma obra. A
 * âncora continua existindo como referência de APROVAÇÃO (é o que se olha para
 * decidir se a faixa está certa), não como entrada da geração.
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
    pose: "curled up tight into a small ball: both knees drawn right up against the chest and both arms wrapped around them, eyes closed",
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
    pose: "curled, eyes closed, face tilted slightly up as if toward a soft warm light",
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
    pose: "STRETCHED OUT, not curled: the body uncurled and long, one arm reaching up above the head, the other resting on the belly, eyes closed",
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
      "a slender fetus with fine delicate eyebrows now visible and clearly defined eyelids, a sweet little face — the body still thin and delicate: NO chubbiness, NO fat rolls, NO double chin",
    pose: "head tipped back so the forehead and the fine eyebrows catch the light from above, one open hand resting flat against the cheek, eyes closed",
  },
  {
    s: 22,
    visivel: false,
    marco: "Reconhece sons externos.",
    forma:
      "a slender fetus with a slightly fuller face, fine eyebrows, delicate ears — still thin and delicate: slim arms and legs, NO chubbiness, NO fat rolls, NO double chin",
    pose: "curled, head tilted as if listening, eyes closed",
  },
  {
    s: 23,
    visivel: false,
    marco: "Pode soluçar dentro do útero.",
    forma:
      "a slender fetus with softly filling cheeks, fine eyebrows, smooth skin with a faint creamy sheen — still thin and delicate: slim arms and legs, NO chubbiness, NO fat rolls, NO double chin",
    pose: "curled, one small fist near the chin, eyes closed",
  },
  {
    s: 24,
    visivel: false,
    marco: "Limite da viabilidade fetal.",
    forma:
      "a slender fetus with slightly rounder cheeks, fine eyebrows, delicate closed eyes — the limbs only just beginning to soften, still thin: NO chubbiness, NO fat rolls, NO double chin",
    pose: "curled, both fists tucked under the chin, eyes closed",
  },
  {
    s: 25,
    visivel: true,
    marco: "Cabelo começa a ganhar cor.",
    marcoEn: "the hair is starting to gain colour",
    forma:
      "a slender fetus with fine soft light-brown hair now visible on the head, softly rounded cheeks, delicate features — the body still thin: NO chubbiness, NO fat rolls, NO double chin",
    pose: "curled, head slightly forward so the hair reads clearly, eyes closed",
  },
  {
    s: 26,
    visivel: true,
    marco: "Olhos começam a abrir.",
    marcoEn: "the eyes are beginning to open",
    forma:
      "a SLENDER fetus with soft light-brown hair and softly rounded cheeks — the body still thin and delicate: slim arms and legs, NO chubbiness, NO fat rolls, NO double chin. The eyelids have JUST parted for the very first time: a narrow drowsy sliver of eye, lashes still low, most of the eye still hidden, the gaze unfocused and turned away, sinking back toward sleep",
    pose: "curled, face toward the viewer's left, eyelids barely parted and heavy with sleep",
  },
  {
    s: 27,
    visivel: false,
    marco: "Reconhece sua voz.",
    forma:
      "a slim fetus with soft LIGHT-BROWN hair, softly rounded cheeks and gently closed eyes again, the limbs only starting to fill out — still lean: NO chubbiness, NO fat rolls, NO double chin",
    pose: "curled, head turned as if toward a familiar sound, eyes closed",
  },

  // ── 3º TRIMESTRE — gordura e POSIÇÃO. A virada cefálica é o marco visível ──
  {
    s: 28,
    visivel: false,
    marco: "Sonha em REM. Início do 3º trimestre.",
    forma:
      "a well-formed baby, still slender, with a covering of fine LIGHT-BROWN HAIR clearly visible over the whole scalp, cheeks just beginning to round, slim arms and legs starting to fill out, smooth healthy skin — NO fat rolls, NO double chin",
    pose: "curled peacefully asleep, one hand near the cheek",
  },
  {
    s: 29,
    visivel: false,
    marco: "Músculos e pulmões amadurecem.",
    forma:
      "a baby with firmer limbs and gently rounding cheeks, a covering of fine LIGHT-BROWN HAIR clearly visible over the whole scalp, healthy but still slim — NO fat rolls, NO double chin",
    pose: "curled asleep with the eyes closed, arms drawn in, chest gently full",
  },
  {
    s: 30,
    visivel: false,
    marco: "Cérebro se desenvolve rapidamente.",
    forma:
      "a baby with a well-rounded head under a covering of fine LIGHT-BROWN HAIR clearly visible over the whole scalp, softly rounded cheeks and limbs — filling out, but still slim and NOT chubby",
    pose: "curled, one fist against the cheek, deeply asleep",
  },
  {
    s: 31,
    visivel: true,
    marco: "Pode girar a cabeça.",
    marcoEn: "it can turn its head",
    forma:
      "a healthy baby with a covering of fine LIGHT-BROWN HAIR clearly visible over the whole scalp, softly full cheeks and gently rounded limbs — NO deep fat rolls, NO double chin",
    pose: "curled, eyes closed, head clearly turned to the side, mid-movement",
  },
  {
    s: 32,
    visivel: true,
    marco: "Unhas dos pés se formam.",
    marcoEn: "the toenails are forming",
    forma:
      "a healthy rounding baby with a covering of fine LIGHT-BROWN HAIR clearly visible over the whole scalp, gently rounded limbs, and tiny toes with delicate soft nails — NO deep fat rolls, NO double chin",
    pose: "curled with the eyes closed and one little foot lifted and visible, toes readable",
  },
  {
    s: 33,
    visivel: false,
    marco: "Sistema imunológico em desenvolvimento.",
    forma:
      "a healthy, comfortably rounded baby with fine soft light-brown hair, full soft cheeks, and just the faintest single crease at the wrists and thighs — rounded but REALISTIC: NO deep fat rolls, NO double chin, NO exaggerated plumpness",
    pose: "curled tightly and peacefully, both hands near the face, fast asleep with the eyes fully closed",
  },
  {
    s: 34,
    visivel: false,
    marco: "Pulmões quase prontos.",
    forma:
      "a healthy baby with a fuller chest, soft LIGHT-BROWN hair, round soft cheeks and smooth skin — comfortably rounded, with only a faint crease at wrists and thighs, NO double chin",
    pose: "curled asleep with the eyes closed, chest full, one arm relaxed outward",
  },
  {
    s: 35,
    visivel: true,
    marco: "Posição cefálica se define.",
    marcoEn: "the head-down (cephalic) position is settling",
    forma:
      "a healthy, comfortably rounded baby with fine soft LIGHT-BROWN hair and full round cheeks — realistic newborn build, faint wrist and thigh creases only",
    pose: "UPSIDE DOWN IN THE FRAME: the head is at the BOTTOM of the picture and the feet at the TOP. The whole body is rotated 180 degrees — still seen in profile, still facing left, but inverted, so the crown of the head points at the bottom edge, curled and settled with the eyes closed — the cephalic position, unmistakable",
  },
  {
    s: 36,
    visivel: false,
    marco: "Considerado a termo precoce em breve.",
    forma:
      "a healthy rounded baby with full cheeks and softly filled limbs, soft light-brown hair, smooth skin — faint wrist and thigh creases only, NO double chin",
    pose: "UPSIDE DOWN IN THE FRAME: the head is at the BOTTOM of the picture and the feet at the TOP. The whole body is rotated 180 degrees — still seen in profile, still facing left, but inverted, so the crown of the head points at the bottom edge, curled compactly with the eyes closed, less room to move",
  },

  // ── TERMO — muda pouco, mas é onde ela mais olha ──────────────────────────
  {
    s: 37,
    visivel: true,
    marco: "Termo precoce — pulmões prontos.",
    marcoEn: "early term — the lungs are ready",
    forma:
      "a REAL full-term newborn: softly rounded and healthy, full cheeks, a single gentle crease at the wrists and thighs, sweet well-defined features, fine soft light-brown hair, smooth rosy skin — the build of an actual newborn, NOT the plump 4-month-old baby people picture: NO thick rolls, NO double chin",
    pose: "curled peacefully, fast asleep with the eyes closed, one fist near the cheek",
  },
  {
    s: 38,
    visivel: true,
    marco: "Encaixe pélvico em muitos casos.",
    marcoEn: "the head has engaged in the pelvis",
    forma:
      "a real full-term newborn with fine soft LIGHT-BROWN hair, full round cheeks and softly rounded limbs — realistic newborn build, faint wrist and thigh creases only",
    pose: "UPSIDE DOWN IN THE FRAME: the head is at the BOTTOM of the picture and the feet at the TOP. The whole body is rotated 180 degrees — still seen in profile, still facing left, but inverted, so the crown of the head points at the bottom edge, curled compactly with the eyes closed and drawn low toward the bottom edge — engaged in the pelvis",
  },
  {
    s: 39,
    visivel: false,
    marco: "Termo completo!",
    forma:
      "a real full-term newborn, rosy and healthy, soft light-brown hair, softly rounded arms and legs, full cheeks — realistic newborn build, faint creases only, NO double chin",
    pose: "curled peacefully, fast asleep with the eyes closed, both hands tucked near the chin, serene",
  },
  {
    s: 40,
    visivel: false,
    marco: "Pronto para chegar a qualquer momento — no tempo dele.",
    forma:
      "a REAL full-term newborn, ready to be born: softly rounded and healthy, full round cheeks, a rounded belly, a single gentle crease at the wrists and thighs, rosy healthy skin, fine soft light-brown hair — the build of an actual newborn, NOT the plump 4-month-old baby people picture: NO thick rolls, NO double chin",
    pose: "curled peacefully, one fist near the cheek, fast asleep with the eyes fully closed, deeply serene and content",
  },
  {
    s: 41,
    visivel: false,
    marco: "Termo tardio — acompanhamento mais de pertinho, tudo sob cuidado.",
    forma:
      "a real full-term newborn with slightly longer soft LIGHT-BROWN hair, softly rounded limbs, full cheeks, healthy rosy skin — realistic build, faint creases only",
    pose: "curled snugly, fast asleep with the eyes closed, both hands near the face, calm and safe",
  },
  {
    s: 42,
    visivel: false,
    marco: "Reta final — o bem-estar do bebê é acompanhado de perto pela sua equipe.",
    forma:
      "a real full-term newborn, longer soft LIGHT-BROWN hair, softly rounded limbs, full cheeks, serene and healthy — realistic newborn build, faint creases only",
    pose: "curled snugly, fast asleep with the eyes closed, one hand open near the cheek, utterly peaceful",
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
