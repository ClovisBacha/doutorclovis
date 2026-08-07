# Dois filmes, quatro prompts — Obstétrica

Mesmo formato do `roteiro-comercial.md`. O que muda: **clipes de 30s** em vez de
8s, e **dois temas diferentes** em vez de um arco só.

- **Filme A — "A madrugada que ele não perdeu"** · 1:30 · 3 clipes de 30s ·
  **fala com o MÉDICO**, que é quem paga.
- **Filme B — "Três da manhã"** · 0:30 · 1 clipe · **fala com a PACIENTE**.

---

## Antes de tudo: o que muda ao ir de 8s para 30s

Trinta segundos num único plano gerado é **quatro vezes** a janela em que estes
modelos foram treinados a manter um rosto. O que quebra, em ordem de
probabilidade: as mãos, depois o rosto, depois a continuidade da luz.

As três defesas estão escritas em todos os prompts abaixo:

1. **O rosto sai de cena antes da metade.** Em todos os clipes, a partir de
   ~0:12 a cabeça está fora de quadro, de costas, ou fora de foco. O modelo não
   pode errar um rosto que não está mostrando.
2. **Uma ação contínua só, sem beat novo depois de 0:20.** Os últimos dez
   segundos são sempre um estado que já começou — nunca uma virada.
3. **Sem mãos em primeiro plano depois de 0:15.** Mão é o que quebra primeiro.

Se mesmo assim derreter, o plano B está no fim deste arquivo: cada 30s vira
4 × 8s encadeados pelo último quadro, que é exatamente como o
`roteiro-comercial.md` já funciona.

---

## As regras que atravessam os dois filmes

1. **A luz do consultório é fria e de cima. A luz de casa é âmbar e de baixo.**
   Nunca se misturam no mesmo quadro. É o que separa o mundo dele do mundo dela.
2. **A tela do celular nunca é legível.** Nenhum texto, em nenhum quadro — é a
   regra que o `prompts-video.md` já tinha, e aqui ela é ainda mais importante
   porque o produto é texto. O que se vê é o BRILHO da tela no rosto, nunca o
   conteúdo.
3. **A câmera nunca corta dentro de um clipe.**
4. **Sem música em nenhum prompt.** A trilha entra na edição — pedir música ao
   modelo estraga o som ambiente, que é o que dá realidade.

---

# FILME A — "A madrugada que ele não perdeu"

**Para quem:** o obstetra. **O que vende:** ele responde uma vez; a resposta
dele continua respondendo.

**O arco:** ele perde a noite → ele ensina, uma vez só → a noite volta pra ele.

---

## CLIPE A1 · O PESO (0:00 – 0:30)

**Entra:** abertura do filme. O gancho está em 0:00 — chegamos com o celular já
aceso no escuro.
**Sai para:** corte seco para a luz do dia do clipe A2.

```
STYLE: 8K photorealistic, anamorphic 2.39:1, intimate character-drama grade,
creamy highlight roll-off, fine 35mm grain. Original invented character, not
based on any real or public figure. A man in his forties, tired, unshaven,
light-brown skin, dark hair with grey at the temples.

LIGHTING: the ONLY light source is a phone screen lying face-up on a bedside
table at camera-LEFT, cold blue-white, lighting the room from BELOW. Everything
beyond one metre falls to near-black. No lamp, no window light, no moonlight.

COLOR: 60:30:10 — near-black bedroom 60% / cold blue screen-glow on skin and
white sheet 30% / the warm brown of a wooden bedside table, barely lit, 10%.

CAMERA: anamorphic cine optics, 40mm, shallow depth. ONE extremely slow push-in
that never stops and never cuts. 180° shutter, real motion blur.

OPTICS: opens wide 48° on the dark room, easing to MCU 32° by the end.

ACTING: he is asleep and the light wakes him. He does not sit up. He turns his
head, looks at the glow, and closes his eyes again — and the closing is the
performance: it is not peace, it is a man deciding not to look. Then the glow
brightens again, and again, and his eyes open and stay open at the ceiling.

PHYSICS: real breath under the sheet. The phone glow PULSES — brighter for two
seconds, dimming, brighter again — each pulse a message arriving. The pulses
get closer together across the shot. No sound from the phone.

FIRST FRAME: a dark bedroom seen from the foot of the bed. A man asleep on his
side, face lit from below-left by a phone lying on the bedside table. The rest
of the frame is black.

ACTION — ONE CONTINUOUS SHOT, 30 seconds, no cuts:
0:00-0:05  Held. He sleeps. The phone glow pulses once, softly, on his cheek.
0:05-0:10  It pulses again, brighter. He turns his head toward it without
           opening his eyes.
0:10-0:14  His eyes open, look at the glow, and close again. He does not reach
           for it. The camera keeps pushing in.
0:14-0:20  He rolls onto his back, away from the phone, face now UP and half
           out of focus. The glow keeps pulsing across his jaw and the ceiling.
0:20-0:26  The pulses come faster. His open eyes reflect the blue. He does not
           move at all.
0:26-0:30  The pulsing settles into one continuous glow, steady, and holds. He
           is completely still, awake, staring up. Nothing else happens.

LAST FRAME: his face in three-quarter profile from below, eyes open, lit only
by the steady blue glow, the ceiling dark above him. THIS EXACT FRAME must be
clean and held for the final 0.6s.

AUDIO (NO MUSIC): a bedroom at night — a distant road, a refrigerator hum
through a wall, his breathing. The phone makes NO sound at all: it only lights.
That silence is the point.

POSITIVE LOCKS: SAME man throughout. The phone is the ONLY light in the frame.
Light comes from BELOW-LEFT at all times. The camera NEVER cuts, NEVER stops,
NEVER pulls back. His hands stay under the sheet and out of frame for the whole
shot.

NEGATIVE: no music, no dialogue, no readable text or icons on the phone screen,
no notification sounds, no lamp, no window, no warm light of any kind, no other
person in the bed, no hands visible, no camera shake, no stutter, no strobing.
```

**O que faz este plano funcionar:** o celular **nunca toca**. Um celular que
apita é irritação; um celular que só acende é dever. E ele não atende — a
performance inteira é a decisão de não olhar, que é a coisa que todo obstetra
reconhece e ninguém filma.

**Por que as mãos ficam sob o lençol:** é um plano de 30s e mão é o que derrete
primeiro. Tirar a mão de cena não é economia, é a única maneira de o plano
sobreviver inteiro.

---

## CLIPE A2 · A VEZ ÚNICA (0:30 – 1:00)

**Entra:** corte seco. A pancada de luz depois do escuro é metade do efeito.
**Sai para:** dissolve lento para o escuro do clipe A3.

```
STYLE: 8K photorealistic, anamorphic 2.39:1, intimate character-drama grade,
creamy highlight roll-off, fine 35mm grain. SAME man as the previous shot —
same face, same grey at the temples — now shaved, in a white coat, awake.

LIGHTING: cool, even, overhead clinical daylight plus a large soft window at
camera-LEFT. Flat, honest, no shadows on the face. The exact opposite of the
previous shot: light from ABOVE, and plenty of it.

COLOR: 60:30:10 — cool white and pale grey (coat, wall, desk) 60% /
light-brown skin and dark hair 30% / one small deep-green plant on the desk 10%.
NOTHING blue-black. This is the brightest shot in the film.

CAMERA: anamorphic cine optics, 50mm, shallow depth. ONE slow arc from behind
his shoulder around to a three-quarter front, continuous, never cutting, never
stopping. 180° shutter.

OPTICS: opens OTS 35° over his left shoulder, easing to MS 40°.

ACTING: he is typing, and this is the ONLY shot in the film where he is calm.
He types a few lines, stops, reads them back, and makes one small correction —
that correction is the performance: it is a man being careful about a sentence.
Then he sits back, and it is finished. No triumph, no smile. Just finished.

PHYSICS: real weight shift in the chair. Steam rising from a mug on the desk,
continuous throughout. Dust in the window light.

FIRST FRAME: over his left shoulder, a doctor in a white coat seated at a
clean desk in a bright consulting room, hands on a laptop keyboard, a window
throwing soft light from the LEFT. The laptop screen is angled AWAY from camera
and is not legible.

ACTION — ONE CONTINUOUS SHOT, 30 seconds, no cuts:
0:00-0:06  Over the shoulder. He types steadily. The camera begins its arc.
0:06-0:12  He stops typing. Holds. Reads. The camera keeps arcing; his face
           begins to come into frame in profile.
0:12-0:18  He leans in and changes one thing — a small, deliberate correction.
           The camera continues around; he is now three-quarter, soft focus.
0:18-0:24  He sits back slowly. His hands leave the keyboard and rest in his
           lap, OUT of frame. The camera keeps arcing.
0:24-0:30  He looks at the screen a moment longer, then simply breathes out and
           looks away toward the window. He holds there, still, looking at the
           light. The camera settles and stops.

LAST FRAME: the doctor in three-quarter, sitting back, looking toward the
window at camera-left, the laptop soft and unreadable in the foreground. Still
and clean, held for the final 0.6s.

AUDIO (NO MUSIC): a quiet consulting room in the day — keys under his fingers,
a clock, muffled voices far down a corridor, one chair creak as he sits back.

POSITIVE LOCKS: SAME man as clipe A1, same face. Window ALWAYS at camera-LEFT.
Light comes from ABOVE and from the window — never from below, never blue.
The laptop screen is NEVER legible and NEVER faces camera. His hands leave
frame at 0:18 and do not return. The camera never cuts.

NEGATIVE: no music, no dialogue, no readable text or UI on any screen, no
phone, no other people in the room, no warm amber light, no camera shake, no
stutter, no strobing, no hands in frame after 0:18.
```

**O que este plano vende, sem dizer:** ele faz aquilo **uma vez**. A correção
pequena aos 0:12 é o produto inteiro — não é um médico usando um computador, é
um médico escolhendo uma frase que vai ser dita muitas vezes no lugar dele.

**Por que o arco de câmera:** o plano começa nas mãos dele e termina no rosto
dele olhando para longe. É a mesma viagem que o produto faz: do que ele digita
para o que aquilo vira.

---

## CLIPE A3 · A DEVOLUÇÃO (1:00 – 1:30)

**Entra:** dissolve lento vindo da janela clara do A2 para o escuro. A dissolve
é o único lugar do filme onde os dois mundos se tocam.
**Sai para:** cartela final, montada na edição.

```
STYLE: 8K photorealistic, anamorphic 2.39:1, intimate character-drama grade,
creamy highlight roll-off, fine 35mm grain. SAME man, SAME bedroom as clipe A1.

LIGHTING: the same phone on the same bedside table at camera-LEFT — but now it
is DARK. The only light in the frame is a thin warm amber line from a hallway
door left ajar at camera-RIGHT, low and soft. Warm, not blue. From the SIDE,
not from below.

COLOR: 60:30:10 — near-black bedroom 60% / warm amber spill on the sheet and
his shoulder 30% / the cold dead-grey rectangle of the sleeping phone 10%.

CAMERA: anamorphic cine optics, 40mm, shallow depth. ONE extremely slow pull-
BACK — the exact reverse of clipe A1 — never stopping, never cutting.

OPTICS: opens MCU 32°, easing out to wide 48°, ending on the same framing that
clipe A1 opened with.

ACTING: he is asleep, and he stays asleep for the entire thirty seconds. That
is the whole performance and it must not be broken. No stirring, no turning, no
eye movement. The only change across the shot is his breathing getting slower
and deeper.

PHYSICS: real slow breath under the sheet, deepening across the shot. The
amber line on the wall widens by a few centimetres around 0:20, as if a door
somewhere moved, then settles. The phone screen NEVER lights. Not once.

FIRST FRAME: the same dark bedroom, same angle as clipe A1's last frame. The
man asleep on his back, face relaxed, a thin warm amber line falling across the
sheet from the RIGHT. The phone on the bedside table is dark.

ACTION — ONE CONTINUOUS SHOT, 30 seconds, no cuts:
0:00-0:08  Held on his sleeping face. Deep, slow breathing. The camera begins
           to pull back. Nothing happens. Nothing is supposed to happen.
0:08-0:15  The pull-back reveals the bedside table and the DARK phone beside
           him. It does not light. His face drifts gently out of sharp focus as
           the frame widens.
0:15-0:22  Wider. The amber line from the hallway widens slightly and settles.
           His breathing deepens. He does not move.
0:22-0:30  The camera reaches the same wide framing that opened the film, and
           stops. The room is quiet, warm at the edges, and the phone stays
           dark for the full final eight seconds.

LAST FRAME: the wide bedroom — man asleep, phone dark, thin amber line across
the sheet. IDENTICAL framing to the first frame of clipe A1, but warm instead
of blue. Still and clean, held for the final 1s.

AUDIO (NO MUSIC): the same bedroom, the same distant road, the same
refrigerator hum — deliberately identical to clipe A1. Only his breathing is
different: slower, deeper. No phone sound, no notification, nothing.

POSITIVE LOCKS: SAME man, SAME bedroom, SAME camera position as clipe A1. The
phone NEVER lights — not one frame. He NEVER wakes. Light comes from the RIGHT
and is WARM. No blue anywhere in the frame. The camera never cuts and never
pushes in.

NEGATIVE: no music, no dialogue, no phone glow, no notification, no blue light,
no waking, no movement of the man beyond breathing, no hands visible, no other
person, no camera shake, no stutter, no strobing.
```

**O plano inteiro é uma ausência.** Trinta segundos em que nada acontece, e a
única coisa que o espectador registra é que **o celular não acendeu**. Só
funciona porque o clipe A1 passou trinta segundos ensinando o que aquele brilho
significa. Um filme sem o A1 não tem A3.

**A rima:** o A3 termina exatamente no enquadramento em que o A1 começou —
mesma câmera, mesma cama, luz trocada de azul para âmbar. É a única coisa que
diz "algo mudou" sem uma palavra.

---

# FILME B — "Três da manhã"

**Para quem:** a paciente. **O que vende:** a resposta chega, e é a voz do
médico dela. Tema diferente do Filme A de propósito — o A é sobre quem dorme, o
B é sobre quem acorda.

---

## CLIPE B1 · ÚNICO (0:00 – 0:30)

**Entra:** o filme inteiro é este plano.
**Sai para:** cartela final, montada na edição.

```
STYLE: 8K photorealistic, anamorphic 2.39:1, intimate character-drama grade,
creamy highlight roll-off, fine 35mm grain. Original invented character, not
based on any real or public figure. A pregnant woman in her early thirties,
light-brown skin, dark hair loose, no makeup, visibly about seven months.

LIGHTING: begins with the ONLY light being a phone screen held low, cold
blue-white, lighting her face from BELOW. Around 0:16 a second source enters:
a warm amber bedside lamp at camera-RIGHT, low and soft, and it becomes
dominant by 0:24. The shot travels from cold-from-below to warm-from-the-side.

COLOR: 60:30:10 shifting across the shot — opens near-black 60% / cold blue on
skin 30% / dark green of a plant 10%; CLOSES warm brown and amber 60% /
soft-lit skin 30% / the now-dim phone 10%.

CAMERA: anamorphic cine optics, 50mm, shallow depth. ONE very slow push-in that
never stops and never cuts. 180° shutter, real motion blur.

OPTICS: opens MS 40° — she is small in a dark room — easing to CU 24° on her
face and shoulder by the end.

SKIN: pore-level realism — fine peach-fuzz along the jaw, real catch-lights in
the eyes, the slight puffiness of someone recently asleep, no makeup sheen.

ACTING: three states, and no more. She wakes with worry already on her face —
we do not see what woke her. She looks down at the phone and types, and her
jaw is tight. Then she stops, and reads, and the tightness leaves her face
slowly — not a smile, just a face letting go. She puts the phone down screen-
first and closes her eyes. The whole performance is a jaw unclenching.

PHYSICS: real breath. One hand rests on the underside of her belly for the
whole shot and never moves — it is the only constant in the frame. Her hair
falls forward as she looks down.

FIRST FRAME: a dark bedroom. A pregnant woman sitting up against the headboard,
half-lit from BELOW by a phone in her lap, one hand resting under her belly,
worry already on her face. Everything else is black.

ACTION — ONE CONTINUOUS SHOT, 30 seconds, no cuts:
0:00-0:06  She is awake and worried. She looks down at the phone in her lap.
           Blue light from below. The camera begins its push-in.
0:06-0:12  She types — we see only the movement of her shoulder and the change
           in her face, never the screen. Her jaw is tight. She stops.
0:12-0:16  She waits. This is the longest beat in the film and it must not be
           cut short. Nothing happens. She breathes once.
0:16-0:22  The blue light on her face STEADIES — the answer has arrived. She
           reads. Her jaw releases. A warm amber lamp light begins to rise from
           camera-RIGHT.
0:22-0:27  She lowers the phone slowly, screen-down, onto the bed. Her face is
           now lit warm from the side. Her hand is still under her belly.
0:27-0:30  She closes her eyes and lets her head rest back against the
           headboard. Completely still. The amber light holds.

LAST FRAME: her face in three-quarter, eyes closed, head back, lit warm from
camera-right, one hand still resting under her belly, the phone dark and
face-down beside her. Still and clean, held for the final 1s.

AUDIO (NO MUSIC): a bedroom at night — rain on a window, a building humming,
her one held breath at 0:14 and the long release at 0:18. No phone sounds, no
typing clicks, no notification.

POSITIVE LOCKS: SAME woman throughout. Her hand NEVER leaves her belly. The
phone screen is NEVER legible and NEVER faces camera. Light travels from
BELOW-blue to RIGHT-amber and never back. The camera NEVER cuts, NEVER stops,
NEVER pulls back.

NEGATIVE: no music, no dialogue, no readable text or UI on the phone, no
notification sound, no typing sound, no other person, no baby, no ultrasound
imagery, no second hand in frame, no camera shake, no stutter, no strobing.
```

**Por que a espera aos 0:12–0:16 é o plano inteiro:** quatro segundos de nada é
muito tempo num filme de trinta. É de propósito — sem a espera, a resposta não
custou nada, e o que não custa não alivia. É o mesmo defeito que o
`roteiro-comercial.md` nomeou no plano 4 e dividiu em dois.

**A mão que não sai da barriga:** é a única coisa imóvel em trinta segundos de
luz mudando. Dá ao modelo uma âncora e ao espectador um lugar para descansar o
olho.

---

## Se derreter: o plano B

Se qualquer clipe de 30s vier com o rosto trocando ou as mãos derretendo,
**não insista no prompt** — o problema é a duração, não a redação.

Cada 30s vira **4 gerações de 8s encadeadas pelo último quadro**, exatamente
como o `roteiro-comercial.md` já faz. Os cortes de tempo (`0:00-0:06`,
`0:06-0:12`…) nos prompts acima já estão escritos em blocos que dividem bem:

| Clipe | Corta em                     |
| ----- | ---------------------------- |
| A1    | 0:00 / 0:10 / 0:20 / 0:26    |
| A2    | 0:00 / 0:06 / 0:18 / 0:24    |
| A3    | 0:00 / 0:08 / 0:15 / 0:22    |
| B1    | 0:00 / 0:06 / 0:16 / 0:22    |

O custo é gerar 16 clipes em vez de 4. O ganho é que o rosto não tem chance de
mudar, porque cada geração começa do último quadro da anterior.

---

## O que me mandar de volta

1. Os MP4 aprovados, na ordem.
2. Se o rosto trocar entre A1 e A3, me avise — o filme A depende de ser
   **o mesmo homem**, e essa é a única coisa que a edição não conserta.
3. A cartela final não é gerada: é montada na edição, como no
   `roteiro-comercial.md`.
