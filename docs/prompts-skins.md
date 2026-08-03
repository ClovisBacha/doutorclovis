# Peles das bolinhas — FEITO (ago/2026)

> As sete foram geradas e estão no app: Constelação, Pérolas, Cristais,
> Planetas, Lótus, Coração e Origami, somadas ao Jardim que já existia.
> Os prompts ficam aqui como registro do que gerou cada arte — se alguma
> precisar ser refeita, é este o texto. As duas que você pediu para não fazer
> continuam de fora.

## Registro original

O **Jardim** já está no app. As outras sete pararam por falta de créditos no
workspace de geração, não por decisão de projeto.

## Como cada uma vira código

Uma folha por pele, os **três estados lado a lado em fundo branco**. É de
propósito: gerar os três separados faz a arte derivar de estilo entre eles, e
o ponto da pele é ser o _mesmo objeto_ evoluindo.

```bash
# 1. salve a folha em scratchpad/skins/<nome>.png
# 2. fatia em terços, recorta o fundo e grava três .webp de 192px
node skin.mjs <nome>
# 3. copie para src/assets/skins/ e acrescente a entrada em trilha-skins.ts
# 4. acrescente o item em CANTINHO_ITEMS com type: "trilha"
```

O passo 4 é o que faz a pele aparecer na loja. Sem ele ela existe no código e
não existe para a paciente — que é o estado em que estas sete ficam até a arte
chegar. Melhor faltar na loja do que aparecer lá sem imagem.

## O bloco que vale para todas

Cole no fim de cada prompt:

```
Style: soft 3D render, pastel palette, gentle studio lighting, cute mobile game
asset, high detail, clean edges, plain pure white background, generous white
space between the three objects, all three the same size and same lighting.
No text, no numbers, no labels, no ground shadow, no reflections.
```

O fundo branco não é estética: o recorte é feito por preenchimento a partir da
borda, e ele depende de o fundo ser claro e contínuo. Fundo com textura ou
sombra forte no chão sobra na imagem final.

---

### 2. Constelação

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a faint constellation of five pale grey stars joined by thin dim
lines, dormant, barely glowing. CENTRE: the same five-star constellation now
glowing soft violet, luminous stars at each vertex, glowing lines, tiny
sparkles. RIGHT: a larger denser constellation, many bright white and violet
stars and glowing lines, strong violet nebula glow, drifting sparkles.
```

### 3. Pérolas

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a plain matte white pearl, dull, no shine. CENTRE: the same pearl
now glossy and pink, glowing softly from within. RIGHT: the pink glowing pearl
resting inside an open seashell with a golden rim, soft sparkles around it.
```

### 4. Cristais

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a single colourless quartz crystal, pale and dull. CENTRE: the
same crystal now violet and translucent, glowing from inside. RIGHT: a cluster
of violet crystals of different heights growing together, strong inner glow,
sparkles rising around them.
```

### 5. Planetas

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a small grey cratered moon, matte and cold. CENTRE: a purple
planet with a soft ring around it, gently glowing. RIGHT: a larger iridescent
planet with a bright golden ring and two tiny moons orbiting it, sparkles.
```

### 7. Flor de Lótus

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a closed pale pink lotus bud resting on two green lily pads.
CENTRE: the same lotus half open, petals pink and fresh. RIGHT: the lotus fully
bloomed, wide open pink petals with a golden centre, soft magical glow and
sparkles on the lily pads.
```

### 8. Coração

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a matte pearl-white heart, dull and quiet. CENTRE: the same heart
now glossy pink and translucent, glowing softly. RIGHT: a faceted pink gemstone
heart set in a golden frame, brilliant cut, sparkles around it.
```

### 10. Origami

```
Three separate 3D rendered game icons side by side, each centred in its own
third. LEFT: a small white folded paper crane, plain paper, no colour. CENTRE:
the same paper crane folded in pink paper, crisp folds. RIGHT: the same crane
folded in golden metallic paper, shimmering, tiny sparkles around it.
```

---

## As duas que você pediu para não fazer

**6. Bolha Amniótica** e **9. Pingentes** ficaram de fora a seu pedido. A da
bolha, aliás, teria um problema próprio: ela é quase o mesmo desenho da bolha
do bebê que já existe na home e no cartão da aula, e a paciente veria a mesma
imagem em três lugares diferentes querendo dizer três coisas diferentes.

## Por que a pele tem três estados

Não é enfeite: é o que faz a trilha ser lida na FORMA e não só na cor. A
semente dorme no dia que ainda não chegou, o broto acorda no dia de hoje e a
flor abre no dia cumprido. O progresso vira desenho — e por isso o preço é
alto (280) comparado a um vaso de 45: ela troca a tela inteira do jogo, e é a
tela que a paciente abre todo dia.
