# Prompts de vídeo — Obstétrica

Prompts para gerar no Gemini (Veo). Cada um vem em **inglês** (o Veo obedece
melhor) com a explicação do uso em português.

---

## Antes de tudo: as cinco regras que valem para todos

Cole este bloco **no fim** de qualquer prompt. Elas existem porque são
exatamente onde o vídeo gerado costuma quebrar quando vira interface:

```
Vertical 9:16, 1080x1920. No text, no letters, no numbers anywhere in the
frame except what already exists in the attached logo image. Keep the attached
logo exactly as provided — do not redraw, re-letter, restyle or re-colour it.
Static camera, no camera shake, no zoom-in on the camera itself. The first
frame and the last frame must both be clean and hold still for at least 0.4s.
Soft, even lighting. No people, no hands, no faces.
```

**Por que cada uma:**

- **Sem texto** — vídeo de IA erra letra. O único texto permitido é o da sua
  logo, que vem da imagem anexada e não pode ser redesenhada.
- **Câmera parada** — se a câmera se mexe, o vídeo não encosta na interface;
  fica um vídeo _dentro_ do app em vez de ser o app.
- **Primeiro e último quadro limpos e parados** — é o que me deixa congelar o
  fim e emendar na tela real sem salto. Sem isso, a abertura termina com um
  pulo.
- **Sem gente** — o app é sobre o bebê dela, não sobre uma modelo.

---

## 1. Abertura do app (o principal)

**Onde entra:** os primeiros ~2,5s ao abrir o app, antes da home.

```
A soft pastel sky, lavender at the top fading to warm peach at the bottom,
with slow drifting clouds. From the centre, a delicate glow blooms outward
like a breath. The attached logo materialises in the centre of the frame,
emerging from the glow as if the light itself condensed into it: first a soft
diffused shape, then settling into perfect focus. A few tiny sparkles drift
upward around it and fade. The logo then holds perfectly still, centred and
fully sharp, for the final 1.5 seconds while the glow behind it settles.
Dreamy, calm, premium, unhurried. Duration 4 seconds.
```

**O detalhe que faz funcionar:** a logo **nasce da luz** em vez de deslizar
para dentro. Movimento de entrada (slide, bounce) parece anúncio; luz que se
condensa parece o app acordando.

**O que eu preciso de volta:** um MP4 onde o **último segundo esteja parado**.
Eu corto ali, congelo o quadro final e faço a transição para a home. Se o
vídeo terminar em movimento, a emenda pula.

### Mais dois conceitos para a abertura

Gere os três e escolha — custa o mesmo e você compara com os olhos em vez de
imaginar. Os três terminam parados, que é a única exigência inegociável.

**B · A bolha que revela** — amarra a abertura ao símbolo do app (o bebê na
bolha aparece em todas as telas):

```
A single translucent iridescent bubble floats up slowly from the bottom of a
soft pastel sky, lavender fading to peach. As it reaches the centre of the
frame it stops, and its surface catches the light: the attached logo appears
inside the bubble as a reflection settling into focus. The bubble holds
perfectly still, centred, with the logo sharp inside it, for the final 1.5
seconds. Tiny sparkles drift slowly around it. Dreamy, calm, premium.
Duration 4 seconds.
```

**C · O nascer do dia** — amarra a abertura ao céu que muda com a hora, que é
a ideia central do app:

```
A dark starry pastel night sky. A warm glow rises slowly from the bottom of
the frame, like a sunrise, and as the light climbs it washes the sky from deep
lavender through pink into soft peach. When the light reaches the centre, the
attached logo emerges from within the glow, settling into sharp focus. The
logo then holds perfectly still, centred, for the final 1.5 seconds while the
sky settles into a calm dawn. No sun disc, no horizon line. Duration 5 seconds.
```

**Qual eu escolheria:** a **C**. A logo nascendo do amanhecer diz numa imagem o
que o app inteiro faz — o céu dela acompanha o dia real. A **A** é a mais
segura e a **B** é a mais bonita, mas nenhuma das duas _conta_ nada.

---

## 2. A estrela do dia (celebração)

**Onde entra:** quando ela completa as 6 atividades e fecha as 3 estrelas.

```
A single golden star, soft and rounded like a 3D toy, appears small in the
centre of a transparent-looking pale lavender background. It pulses once,
gently, then bursts into a slow shower of tiny golden and pink sparkles that
drift outward and fall softly downward before fading. Warm, celebratory but
calm — a quiet reward, not fireworks. The background stays a flat, even pale
lavender throughout so it can be composited. Duration 3 seconds.
```

**Por que fundo liso:** eu recorto esse lilás e sobreponho na tela. Fundo com
textura não recorta.

---

## 3. O bebê respirando (fundo vivo da home)

**Onde entra:** substituindo a bolha estática da home — o bebê "respirando"
num laço infinito.

```
A translucent iridescent soap bubble floating in the centre of a soft pastel
sky. The bubble breathes: it expands almost imperceptibly and contracts, one
slow cycle, while pearlescent lavender, pink and gold reflections drift across
its surface. Tiny sparkles orbit slowly around it. The motion is extremely
subtle — barely perceptible, meditative. The final frame must match the first
frame exactly so the clip loops seamlessly. Duration 6 seconds, one single
breath cycle.
```

**Crítico:** "final frame must match the first frame exactly". Sem isso o laço
dá um solavanco a cada 6 segundos — e num elemento que fica na tela o tempo
todo, isso irrita em minutos.

---

## 4. A passagem do dia (o céu correndo)

**Onde entra:** uma vez, na primeira vez que ela vê o Caminho — mostra que o
céu do app acompanha o dia real dela.

```
A time-lapse of a pastel sky seen from above the clouds, cycling through one
full day: deep starry night with a crescent moon, then cold blue pre-dawn,
then a warm pink sunrise, then bright clear blue midday, then golden hour with
clouds lit orange, then a deep red sunset, then back to night. The clouds
drift slowly and continuously; the colour transitions are smooth and
continuous, never cutting. Extremely soft and dreamy, no sun disc harshness,
no horizon line, no landscape. The last frame returns to the same night sky as
the first frame. Duration 8 seconds.
```

---

## 5. Carregando (o laço curto)

**Onde entra:** enquanto uma tela carrega, no lugar de um spinner.

```
Three small soft pastel orbs — one lavender, one pink, one pale blue —
floating in a horizontal row on a flat, even pale cream background. They rise
and fall gently in sequence, like a slow wave passing through them, one
complete wave from left to right. The motion is smooth and unhurried. The
final frame is identical to the first frame so the clip loops seamlessly.
Duration 2 seconds.
```

---

## 6. O presente do dia (a recompensa abrindo)

**Onde entra:** ao completar o dia, no cartão "Recompensa do dia".

```
A soft matte white gift box with a lavender satin ribbon, floating on a flat
even pale lavender background. The ribbon slowly unties itself and the lid
lifts and floats away, releasing a soft golden glow and a slow drift of tiny
sparkles rising upward from inside the open box. Gentle, magical, unhurried.
The box stays centred and still — only the ribbon, lid and sparkles move.
Duration 3 seconds.
```

---

## Como anexar a logo

Anexe a imagem **junto** com o prompt e acrescente esta linha:

```
Use the attached image as the exact logo. Reproduce it pixel-faithfully — same
proportions, same colours, same letterforms. Do not stylise it.
```

Vale só para o **prompt 1** (a abertura). Nos outros a logo não aparece — e é
melhor assim: logo repetida em toda animação cansa.

---

## O que me mandar de volta

Para cada vídeo aprovado, me diga:

1. **O arquivo** (MP4 ou WebM).
2. **Onde ele deve entrar** — abertura, celebração, fundo, etc.
3. Se for **laço**, me avise: eu verifico quadro a quadro se a emenda salta
   antes de colocar no app. Já peguei esse defeito nas estrelas do céu, que
   piscavam 26 vezes por minuto sem ninguém perceber olhando print.

**Sobre peso:** a abertura pode ter alguns segundos sem problema (roda uma vez).
Os laços de fundo eu converto para WebM e comprimo — se passar de ~400 KB eu te
aviso, porque aí custa mais do que entrega, e a mesma coisa em CSS sai de graça.

**Sobre movimento:** tudo que eu colocar respeita `prefers-reduced-motion` —
quem liga essa preferência no aparelho vê o quadro parado em vez do vídeo. Não
é opcional: é a preferência de quem tem enxaqueca ou labirintite, e uma boa
parte das suas pacientes tem.
