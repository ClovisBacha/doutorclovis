---
name: tela
description: Construir ou refazer uma tela a partir de uma imagem de referência do dono. Use SEMPRE que houver uma referência visual (print, arte do Drive, mockup) — inclusive quando o pedido parecer simples. Garante que o resultado seja comparado com a referência antes de ser entregue.
---

# Construir uma tela a partir da referência

Esta skill existe por causa de um episódio concreto. O dono mandou quatro
imagens — duas do app, duas da referência que ele desenhou — e escreveu:

> "as duas abas estão completamente diferentes e desconexas com o que eu te
> pedi. Uma tem cara que foi feita aqui no Cloud Code, a outra tem cara que
> realmente é de profissional."

Ele estava certo, e a causa **não foi falta de capacidade**. Foram quatro erros
de processo, e os quatro são evitáveis. Esta skill é o processo.

---

## ⚠️ Os quatro erros que criaram o problema

**1. Reconstruí a ARTE em código.** Onde a referência tinha um jardim pintado,
eu escrevi um `linear-gradient` de onze paradas amostradas. Onde tinha uma bolha
de olhos de coração desenhada, usei a bolha `feliz` que já existia. Onde tinha
corações com volume e sombra, pus emoji 💗.

Gradiente não vira pintura e emoji não vira ícone. A distância entre as duas
telas não era layout — era arte, e a arte estava no arquivo dele o tempo todo.

**2. Troquei dado que faltava por genérico, em silêncio.** A referência mostrava
foto e status de cada amiga. O app não tinha nenhum dos dois, então pus a mesma
bolha para todas e nenhum status — sem avisar. O resultado foi "uma lista em que
todo mundo é igual". O certo era dizer: *"a referência pede dois dados que não
existem; quer que eu os crie ou desenho sem eles?"*

**3. Nunca pus as duas imagens lado a lado.** Eu olhava o código, achava
parecido e entregava. A documentação do Claude Code chama isto de
**trust-then-verify gap**: *"If you can't verify it, don't ship it."*

**4. Acrescentei o que ninguém pediu.** Uma caixa de aviso âmbar que ocupava um
quarto da primeira dobra e não estava na referência.

---

## O processo

### Passo 1 — Separar ARTE de DADO antes de escrever uma linha

Faça a tabela, por escrito, para a tela inteira:

| o que é                                       | como entra                                    |
| --------------------------------------------- | --------------------------------------------- |
| **arte que nunca muda** (fundo, personagem, título pintado, selo, ícones ilustrados) | UMA imagem, colada como o ilustrador compôs   |
| **dado** (nome, preço, contador, saldo, hora)  | código, sempre                                |
| **controle** (botão, campo, aba)               | código, sempre — com alvo de 44px             |

⚠️ **Um recorte só, e não cinco.** Extrair bolha + corações + balão em arquivos
separados para o CSS recompor responde à pergunta errada: nada ali é dado. Um
recorte só preserva as distâncias, as sobreposições e as sombras que o
ilustrador fez.

⚠️ **A linha divisória é onde mora a verdade.** Preço pintado numa imagem vira
mentira no dia em que ele mudar. Por isso o herói é colagem e a lista é código.

⚠️ **O texto que virou pixel vira `alt`**, palavra por palavra.

⚠️ **Colagem falha para vidro.** Uma bolha de vidro tem o fundo VISTO ATRAVÉS
dela; recortá-la à parte faz a inundação por cor atravessar o contorno e comer o
miolo. Solução: colar o herói INTEIRO, com fundo e tudo.

### Passo 2 — Dizer em voz alta o que a referência pede e o app não tem

Antes de codar, liste:

- **dados que não existem** (uma foto, um status, um contador) — pergunte se
  cria ou se desenha sem;
- **estados que o produto recusa** — a referência das Amigas mostrava três
  cartões de dupla, e o banco garante UMA dupla ativa por pessoa. Colar três
  seria desenhar um estado impossível. **Fidelidade que contradiz o produto não
  é fidelidade** — diga isso e siga.

Nunca substitua em silêncio. O silêncio é o erro, não a substituição.

### Passo 3 — Construir, sem acrescentar

Só o que está na referência mais o que o produto exige. Um aviso, uma dica, um
selo a mais é uma decisão de produto que ninguém tomou.

### Passo 4 — ⚠️ COMPARAR. Este passo não é opcional.

```bash
bun run dev --host 127.0.0.1 --port 8080 > /tmp/dev.log 2>&1 &
sleep 12 && grep -E "Local:|Port .* is in use" /tmp/dev.log   # ⚠️ CONFIRA A PORTA

node scripts/comparar-com-referencia.mjs <referencia.png> "<url-da-bancada>" \
  /tmp/lado-a-lado.png --seletor="<o elemento da tela>" --recorte=<y0>,<y1>
```

⚠️ **CONFIRA A PORTA ANTES DE COMPARAR — não a suponha.** O Vite responde
`Port 8080 is in use, trying another one...` e sobe em 8081 sem falhar.
Aconteceu na sessão em que esta skill nasceu. Apontar para 8080 nesse caso dá um
de dois desfechos, e o segundo é o perigoso:

1. conexão recusada — chato, mas visível;
2. **um servidor ANTIGO ainda vivo naquela porta** — e aí o relatório sai
   inteiro, confiante e descrevendo código que você não escreveu. É a mesma
   família de defeito que esta skill existe para impedir: uma verificação que
   mente é pior que nenhuma.

- `--seletor` fotografa só o componente. Sem ele a bancada traz cabeçalho e
  rodapé do site, e todo número vira ruído.
- `--recorte` apara a barra de status e a navbar do mockup do dono.
- A **área segura é injetada por padrão** (59px). O Chromium devolve zero em
  `env(safe-area-inset-*)`, e foi por isso que os controles da Loja passaram
  meses embaixo do relógio do iOS sem ninguém ver.

**Depois de rodar, ABRA a imagem lado a lado e leia-a.** Os números (altura,
paleta, tinta por faixa) apontam para onde olhar; eles não substituem o olho.

### Passo 5 — Listar as diferenças, uma a uma

Escreva a lista antes de consertar. Para cada item, uma das três:

1. **é defeito meu** → conserta;
2. **é dado que não existe** → volta ao passo 2;
3. **é diferença deliberada** → escreve a razão no código, com ⚠️.

### Passo 6 — Repetir

Duas ou três voltas costumam bastar. Se depois de três a tela ainda não
converge, o problema não é ajuste fino — é uma decisão de estrutura, e ela deve
ir para o dono.

### Passo 7 — Entregar com a prova

Mostre a comparação. Nunca "ficou igual" — mostre a foto e diga o que
continua diferente e por quê.

---

## Se a referência veio do Drive

```bash
# baixar (o read_file_content devolve só OCR; é o download que traz pixels)
# depois: extrair a arte com um script dedicado, medindo em vez de estimar
node scripts/loja-heroi-do-drive.mjs <referencia.png> <pasta-destino>
node scripts/pacotes-para-webp.mjs <pasta> <nome-sem-extensao>   # PSNR ≥ 41 dB
```

⚠️ **Nunca reduzir a arte** e **sempre imprimir o PSNR**. "Não perca a
qualidade" é medido, não afirmado.

⚠️ **Recortar os controles PINTADOS para fora da arte.** Desenhar o botão de
verdade "por cima" do pintado parece funcionar e não funciona: medido, sobrava
uma meia-lua branca embaixo. Casar dois retângulos em toda largura de tela é
frágil; recortar resolve de uma vez.

---

## Régua rápida — o que reprova a tela

- [ ] Reconstruí em CSS algo que era arte na referência?
- [ ] Substituí algum dado por genérico sem dizer?
- [ ] Acrescentei alguma coisa que não está na referência?
- [ ] Rodei `comparar-com-referencia.mjs` e OLHEI a imagem?
- [ ] Medi com a área segura injetada?
- [ ] O nome mais longo da lista trunca em 375px?
- [ ] Todo texto passa 4,5:1 de contraste (14px em negrito NÃO é texto grande)?
- [ ] Todo alvo de toque tem 44px?
