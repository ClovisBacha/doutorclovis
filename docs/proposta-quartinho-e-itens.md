# Proposta — o quartinho do bebê, a Bolha que se veste e os itens

> **PROPOSTA PARA O DONO DECIDIR, NÃO UMA COISA FEITA.** Escrita em 23/11/2026.
> O dono gostou da ideia 2 (vestir a Bolha), pediu para pensar num quartinho
> do bebê que se decora com os itens e quis saber o custo no Higgsfield. As
> outras ideias ficam guardadas aqui, melhoradas, para depois ("depois
> trabalharemos nas outras ideias, guarde elas e melhore elas").

## A primeira versão do quartinho (feita em 23/11/2026, sem commit)

O dono mandou dois mockups ("Seu quarto, do seu jeito!") e as ideias que pediu
ao ChatGPT, e liberou 5 créditos: "vamos fazer ficar o mais próximo dessas
imagens". Feito pela skill `/tela` (arte separada de dado, comparado lado a
lado no simulador):

- **A arte (4 créditos dos 5)**: o quarto VAZIO no estilo do mockup (Nano
  Banana Pro, 2K, editando o próprio mockup) e uma cartela com 16 itens de
  fundo transparente (GPT Image 2.6, 2K), recortados por código. Ficam em
  `mobile/assets/quartinho/` (716 KB). A noite sai por código: o mesmo quarto
  sob um azul que multiplica, e só o vidro da janela trocado pelo céu com
  estrelas (`janela-noite.webp`).
- **A tela** (`mobile/src/app/quartinho.tsx`, regras em
  `mobile/src/lib/quartinho/quarto.ts`, 13 testes): abre ao tocar na Bolha do
  céu; voltar, a Bolha falando, o saldo de sementinhas, o presente com a missão
  de hoje, o quarto com os itens nos lugares fixos e a bandeja (Móveis,
  Decoração, Brinquedos, Tapetes, Plantas) com "Salvar meu quarto".
- **A posse é de verdade**: nove itens SÃO itens da lojinha (o berço é o
  `objeto-berco`, a poltrona o `objeto-poltrona`…): ela põe se comprou; se não,
  o cartão mostra o preço da lojinha e leva até ela. Os outros sete são
  presentes da Bolha: três de saída e quatro que as missões dão.
- **As missões** (uma por dia, na ordem): escolher o primeiro ursinho, decorar
  a parede do berço, montar o cantinho de leitura, escolher o tapete, pendurar
  o móbile. Cumprida, a Bolha comemora e dá um item.
- **As memórias**: "Salvar meu quarto" guarda como o quarto estava naquele dia
  (uma por dia) — o começo da retrospectiva do nascimento.
- O quarto grava em `dc-path-quartinho` (o blob da jornada, que já sobe para o
  servidor). Modo Cuidado não abre o quarto.

**Refeito no mesmo dia** (o dono: "degradês meio Liquid Glass [...] mais
profundidade [...] bastante ênfase na iluminação"): o vidro lilás em tudo o que
flutua, a noite pintada (o quinto crédito), as sombras dos itens, o sol e o
luar por cima deles, a luminária acesa, as estrelinhas piscando e os botões
"Desfazer" e "Decorar aleatoriamente". Ver o diário, "o quartinho refeito".

**Diferenças deliberadas dos mockups**: sementinha no lugar de "estrelinhas" e
sem o "+" de comprar moeda (sementinha só se ganha); sem girar, zoom nem
arrastar (lugares fixos); a missão dá item, não moeda (quem paga é o servidor
do site, que não muda); a planta pendurada, o elefante, os cubinhos com letras
e o quadro "Sonhe alto" não vieram (são arte de um próximo lote).

**O que falta para lançar**: comprar o item ali mesmo (hoje leva à lojinha);
decidir se o Arrumar da trilha sai; mais itens (um lote de ~16 por 2 créditos,
na mesma cartela); a retrospectiva com as memórias; a Bolha vestida (ideia 2).

## Como criar um item novo do quartinho (a receita)

Todo item novo entra em `mobile/src/lib/quartinho/quarto.ts`, na lista `ITENS`,
com a ficha inteira. O teste `quarto.test.ts` reprova o item que vier sem ela.

1. **A arte**: fundo transparente, no estilo da cartela (a mesma câmera, de
   frente e um pouco de cima), em `mobile/assets/quartinho/<id>.webp`, e a
   linha dela no mapa `ARTE` de `app/quartinho.tsx`.
2. **O lugar** (`lugar`): o centro, a linha da base, a largura e a camada, em
   frações do quarto.
3. **O apoio** (`APOIO`): `chao`, `parede`, `tapete` ou `movel`. Decide a
   sombra.
4. **A posse**: `lojinha` (o item da lojinha que ele é), `missao` (a missão que
   o dá) ou nada (presente de saída).
5. **A LUZ** (`luz`), obrigatória — o dono, em 23/11/2026: "cada um deve ter
   seu brilho proporcional à realidade". Escolha um degrau da `REGUA_DA_LUZ`,
   nunca um número solto:

   | Degrau           | Potência | Para quê                                         |
   | ---------------- | -------- | ------------------------------------------------ |
   | `lampada`        | 1        | abajur, luminária: ilumina o quarto e o chão     |
   | `luzNoturna`     | 0,5      | estrela-abajur, luz de tomada, lua de mesa       |
   | `luzinhas`       | 0,35     | varal de luzinhas, pisca-pisca, vela de LED      |
   | `brilhaNoEscuro` | 0,2      | plástico que brilha no escuro (móbile, adesivos) |
   | `tintaQueBrilha` | 0,1      | detalhe pintado com tinta fosforescente          |
   | `null`           | —        | não emite luz: almofada, pelúcia, móvel, espelho |

   A ficha diz ainda a cor (`tom`), de onde a luz sai na arte (`de`) e se ela
   cai no chão (`chao`, só de `luzNoturna` para cima). A tela desenha o resto
   sozinha (`LuzDoItem`): o tamanho do clarão sai da potência, e à noite o item
   escurece menos quanto mais luz tem. A luz só aparece à noite.

Hoje acendem: a luminária (`lampada`), o móbile (`brilhaNoEscuro`) e o quadro
da lua (`tintaQueBrilha`).

Nas palavras dele: "será que não conseguiríamos criar também o quartinho do
bebê, onde a pessoa, quando clica no bebê bolha, abre um quartinho que ela
consegue decorar com os itens".

Antes disso, no mesmo dia, sobre o fundo da trilha: "essa ideia de customizar o
fundo do game gostei, mas nem tanto [...] deixar isso em uma aba mais de arte
[...] e o fundo hoje iríamos deixar com o fundo já existente". O quartinho
responde às duas coisas: os itens ganham uma casa, e a trilha volta a ser só o
céu.

## O que já existe e se aproveita

- **A lojinha** (`Meu Cantinho`, `componentes/recompensas/cantinho.tsx`): 111
  itens no catálogo do site (`src/lib/cantinho.ts`), comprados com sementinhas
  e abertos por fase da gestação (`lib/jornada/loja-por-fase.ts`). A compra já
  mora no servidor; o que ela comprou fica para sempre.
- **As artes dos itens**: 90 ícones em 3D (`src/assets/cantinho/`), no mesmo
  estilo macio das artes do app — mas de **144 px**. Servem para a vitrine da
  lojinha; num quarto de tela inteira ficariam borrados. O quarto pede as
  mesmas peças redesenhadas maiores (1024 px, fundo transparente), na mesma
  câmera da cena.
- **Hoje os itens decoram a trilha** (`componentes/caminho/enfeites.tsx`, o
  modo Arrumar, `dc-path-decor` no blob da jornada), e o cenário cobre o céu.
- **A Bolha** tem oito expressões com a MESMA esfera (diâmetro 663 numa tela
  de 960, `mobile/scripts/bolha-do-drive.mjs`). É isso que permite um acessório
  desenhado uma vez servir em todas.

## A ideia 2 na prática: a Bolha que se veste

1. **Onde compra**: na lojinha entra a seção "Para a Bolha". O preço é em
   sementinhas (de 200 a 600), e alguns acessórios só se conquistam (ver "Itens
   de marco", abaixo). No quartinho, o armário da Bolha abre a mesma seção.
2. **Como veste**: tocar na Bolha dentro do quartinho mostra "Vestir". Há dois
   lugares: cabeça (laço, gorro de lã, chapéu de sol, coroa de flores, tiara
   de estrelas, boina, fone de ouvido) e pescoço (lacinho, cachecol curto).
   Ela experimenta antes de comprar, e a Bolha dá um pulinho: "Ficou lindo?".
   Tirar é um toque.
3. **Onde aparece**: em todo lugar onde a Bolha aparece — o céu da aba do
   Bebê, a conversa, a aula, a trilha e os cartões de compartilhar. O cartão
   vira propaganda: as amigas veem a Bolha DELA.
4. **Bom senso**:
   - nas expressões que já têm um acessório próprio (o capelo da aula, a faixa
     do Mexer, o chapéu de festa), vale o da expressão;
   - no Modo Cuidado não há Bolha, então não há acessório.
5. **Sazonais**: o gorro no inverno (junho e julho), a coroa de flores na
   primavera e o gorrinho no Natal. Eles voltam todo ano, para não virar
   ansiedade de "perdi".
6. **Como se faz**: cada acessório é uma camada transparente desenhada uma
   vez e encaixada sobre a esfera da Bolha. Uma tabela guarda o ponto de
   encaixe de cada expressão (a apaixonada e a estudiosa estão 62 e 22 px mais
   abaixo desde 23/11/2026). O acessório anda junto com a flutuação e a
   inclinação, sem custo extra.

**Primeiro lote sugerido (10)**: laço, gorro de lã, chapéu de sol, coroa de
flores, tiara de estrelas, boina, fone de ouvido (para os sons da noite),
lacinho no pescoço, cachecol curto e gorrinho de Natal.

## O quartinho do bebê

**A porta.** Tocar na Bolha do céu abre o quartinho: a câmera entra na bolha,
numa transição curta (e sem transição com "reduzir movimento"). Hoje esse
toque rola até a conversa; a conversa continua sendo o primeiro painel logo
abaixo. Na primeira vez, a Bolha apresenta: "Este é o quartinho que a gente
vai arrumar juntas até o bebê chegar."

**A cena.** Um quarto em 3D, vertical (9:16), no estilo das artes do app
(pastel, luz macia), visto de frente e um pouco de cima, como uma casa de
bonecas aberta. Os lugares são fixos — o quarto fica sempre bonito, sem
arrastar à mão:

| Lugar           | O que vai ali (os tipos do catálogo)                                          |
| --------------- | ----------------------------------------------------------------------------- |
| Janela          | o céu da hora de verdade e a vista escolhida (os "fundos": mar, campo, neve…) |
| Teto            | móbile, varal de luzinhas, lua de pendurar (objetos, luzes, céu)              |
| Parede esquerda | quadrinhos, espelho, o mural das lembranças                                   |
| Parede direita  | prateleira e o armário da Bolha                                               |
| Prateleira      | pelúcias (os "bichos" viram bichinhos de pelúcia), caixinhas, matrioska       |
| Chão            | tapete                                                                        |
| Canto esquerdo  | berço (opcional) ou poltrona de amamentar                                     |
| Canto direito   | plantas e luminária                                                           |

**Arrumar.**

- Tocar num lugar abre a bandeja: o que ela tem para ali e o que falta, com o
  preço.
- Um toque põe o item, outro toque troca e segurar tira.
- A Bolha reage em cada mudança ("Ficou lindo!").

**Vida.**

- A janela muda com a hora: o céu de dia e o de noite, os mesmos do app.
- À noite a luminária acende e a Bolha dorme no berço ou na poltrona (a
  expressão dormindo, que já existe).
- O clima que ela comprou (bolhas de sabão subindo, pétalas, neve) é desenhado
  por código, sem arte nova.

**Compartilhar.** "Foto do quartinho", em 9:16, com a assinatura do app, para
os Stories.

**O que muda no que existe.**

- A lojinha continua sendo onde se compra.
- O Arrumar da trilha sai: a trilha volta a ser o céu e as bolinhas.
- Os enfeites que ela já tem passam para o quartinho, sem perder nenhuma
  compra.

**Pós-parto.** O quartinho continua, agora "o quarto da Helena" (o nome do
bebê), e as fases do pós-parto abrem itens novos.

**Cuidados.**

- **Modo Cuidado** (perda): o quartinho não abre e a Bolha não aparece — a
  regra de sempre, "as telas param de falar do bebê".
- **O berço é opcional**, nunca o centro. É a lição da pesquisa do site, que
  escolheu "cantinho" por isso.
- **Quarto de brincadeira**: nada de preço de produto real nem "o que comprar
  para o quarto". O app não vende enxoval.
- **Os dados**: o quarto arrumado grava no blob da jornada (como o
  `dc-path-decor`), e nada do que ela sente entra nele.

**A ordem do desenvolvimento.**

1. A cena com os lugares, a bandeja e a gravação.
2. A passagem dos enfeites da trilha para o quarto.
3. Os acessórios.
4. A foto para compartilhar.

São alguns dias de trabalho, sem contar a arte.

## Os custos no Higgsfield (medidos em 23/11/2026)

Medidos com `get_cost` (ele só orça, não gera nada). O preço é **por
tentativa**: a primeira raramente sai certa, então a estimativa conta as
tentativas.

| O quê                                                          | Modelo                           | Créditos por tentativa |
| -------------------------------------------------------------- | -------------------------------- | ---------------------- |
| Item ou acessório, fundo transparente, 1024 px, qualidade alta | GPT Image 2.6                    | 1,25                   |
| O mesmo, qualidade média                                       | GPT Image 2.6                    | 1                      |
| A cena do quarto, 2K, vertical                                 | GPT Image 2.6 ou Nano Banana Pro | 2                      |
| (Para comparar) um laço de vídeo da Bolha, em out/2026         | —                                | ~28                    |

**A Bolha no quarto não precisa de vídeo**: é a arte de hoje, animada por
código. O papel de parede também pode ser por código (uma cor ou estampa sobre
a máscara da parede).

| Etapa                                                                          | Conta                          | Créditos |
| ------------------------------------------------------------------------------ | ------------------------------ | -------- |
| Acessórios, primeiro lote (10)                                                 | 10 × ~3 tentativas × 1,25      | ~38      |
| A cena do quarto (dia; a noite sai da do dia)                                  | ~9 tentativas × 2              | ~18      |
| Fase 1 dos itens (38: objetos, pelúcias, plantas, luzes)                       | 38 × ~1,5 × 1,25               | ~71      |
| **Fase 1 inteira**                                                             |                                | **~127** |
| Fase 2 (céu, especiais e brinquedos de água: ~24 itens; e 11 vistas da janela) | 24 × 1,5 × 1,25 + 11 × 1,5 × 2 | ~78      |

- **Saldo**: em 23/11/2026 a conta tinha **41,97 créditos** (plano Plus). A
  fase 1 pede uns 90 a mais.
- **Valor em reais**: depende do pacote de créditos. A tabela do Higgsfield
  abre pela própria ferramenta quando o dono quiser.
- **Geração ilimitada**: os dois modelos aceitam as janelas de geração
  ilimitada de alguns planos; hoje a conta não tem nenhuma. Com uma janela
  dessas, a arte sairia sem gastar créditos.
- **Regra**: cada lote é orçado antes (`get_cost`) e só gera com o OK do dono.

## As outras ideias, guardadas e melhoradas

Melhoradas no mesmo sentido: cada uma passa a ter LUGAR no quartinho, que vira
a casa de tudo o que ela ganha.

### 1. A lembrança da noite (era "o postal da Bolha")

Quando ela fecha o dia (os cinco cuidados), a Bolha "sai para passear" à
noite. De manhã, chega uma lembrança, que vai para o **mural do quartinho**: um
cartão com o assunto da semana (a fruta do tamanho do bebê, por exemplo: "fui
ver uma couve-flor de perto") e uma frase gentil.

- Sete lembranças fecham o mural da semana.
- É o motivo para abrir o app de manhã (as aventuras do app Finch fazem isso).
- Sem conduta e sem número inventado.
- A arte pode ser por código (o céu da hora, a fruta da semana e o texto), com
  custo zero. Uma ilustração por semana custaria uns 120 créditos.

### 2. A vitrine da semana

Na lojinha, três itens do quartinho que trocam toda segunda; um deles combina
com a semana do bebê.

- Ela VÊ o que vem depois ("na segunda que vem: o móbile de nuvens").
- Todo item volta numa rodada seguinte: novidade sem medo de perder.
  Escassez falsa gera ansiedade, e o app é de tranquilidade.
- Dá destino às sementinhas.

### 3. O presente para a amiga

No quartinho, "mandar um presente": ela escolhe um item e um bilhete entre
frases prontas. Não há texto livre: a Comunidade está desligada e não há
moderação. O presente aparece no quartinho da amiga, com laço e "de Marina".

- No máximo um por dia.
- É a parte social que o dono quer: as Amigas, sem ranking e sem
  comparação.
- A economia precisa de uma régua para ninguém fabricar sementinhas trocando
  presentes. O servidor decide quem pode mandar e paga.

### 4. Os itens de marco (não se compram)

São peças que só se CONQUISTAM:

- o primeiro quadrinho, na primeira semana com os cinco cuidados;
- a bandeirola "metade do caminho", na semana 20;
- a luminária de lua cheia, nos 100 dias de chama;
- a plaquinha com o nome, na chegada do bebê.

Eles ficam nas paredes com um selo de "conquistado". É o orgulho que dinheiro
não compra (o mesmo princípio dos itens de troféu do site). Somam com os
acessórios conquistados.

### 5. A galeria vira a foto do quartinho e o papel de parede

A "aba de arte" que o dono imaginou é o próprio quartinho. Tudo o que ela
ganha mora nele. A foto do quartinho e as lembranças viram papel de parede do
iPhone (9:16, o formato do cartão da semana). Assim, a tela de bloqueio dela
mostra o app.

## O que vale para todas

- **Bem-estar, não conduta**:
  - nenhuma frase de saúde vira orientação;
  - o dia a dia não lembra de emergência (decisão de 23/11/2026);
  - nenhum número é inventado (CDC, art. 37; Apple 2.3.1).
- **Sementinhas são só ganhas**, nunca vendidas avulsas no app. Item vendido
  por dinheiro passa pela compra da Apple (`lib/assinatura/loja.ts`).
  Recompensa surpresa paga com dinheiro exigiria mostrar as chances (Apple
  3.1.1); por isso nada aqui é sorteio pago.
- **Modo Cuidado**: nada do bebê, nada da Bolha.
- **Arte**: sai das originais e de prompts guardados, nunca retocada à mão
  (`mobile/scripts/bolha-do-drive.mjs`). Cada lote é orçado antes e gera só
  com o OK do dono.
