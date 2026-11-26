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

**A compra ali mesmo (24/11/2026)**: tocar num item que ela não tem abre a
folha de compra de vidro lilás, com o preço e a conta (quanto fica, quanto
falta); comprar põe o item no quarto na hora. A venda segue a MESMA regra da
vitrine da lojinha (`vendaNoQuarto`): o Premium só pela loja por fase, quando
a fase dela chega, e pelo preço do banco. O que ainda não abriu mostra "Em
breve" com cadeado, e a Bolha diz quando abre. Antes, o berço (3º trimestre)
aparecia com preço e mandava à lojinha, onde nem estava.

**O Arrumar da trilha fica, por enquanto**: só 9 dos ~90 enfeites da lojinha
têm arte de quarto; tirar o Arrumar deixaria os outros sem lugar. Ele sai
quando o quarto tiver onde pôr o que ela comprou.

**O que falta para lançar**: mais itens (um lote de ~16 por 2 créditos,
na mesma cartela); a retrospectiva com as memórias; a Bolha vestida (ideia 2).

## A cozinha, o quarto de frente e o quarto limpo (24/11/2026)

O dono mandou duas referências (uma cozinha e o quarto decorado) e pediu:

> "Essa é a imagem do novo cômodo cozinha que deve estar quando a pessoa
> arrastar pro lado direito [...] a imagem está melhor no sentido de dar mais
> profundidade e estar centralizado [...] a opção de você esconder os
> elementos de baixo [...] deixando a imagem mais clean [...] a imagem do
> quarto onde você deve pegar esse como exemplo para também exatamente fazer
> essa profundidade que faltou"

**Feito: o quarto limpo.** O olhinho, à esquerda acima da bandeja, esconde a
bandeja, o desfazer, o dado e o cartão da missão; tocar de novo os traz (no
fio nativo, e sem movimento com "reduzir movimento"). O chão que sobra embaixo
da pintura tem agora a cor da última faixa dela já com a luz, medida no
simulador: antes, com a bandeja escondida, aparecia uma faixa lisa mais clara.

**O que a referência tem e o nosso quarto não**: a câmera DE FRENTE (um ponto
de fuga): a parede do fundo no centro, as duas paredes do lado, o teto com os
dois spots e o chão fundo, com a janela na parede da esquerda. A nossa pintura
olha de um CANTO (só a parede da esquerda e a do fundo), por isso parece rasa
e torta. Não se conserta por código: é outra pintura.

**A arte que falta (orçada em 24/11/2026, uma tentativa de cada)**:

| Peça                                                      | Modelo                  | Créditos |
| --------------------------------------------------------- | ----------------------- | -------- |
| O quarto de frente, vazio, de dia (editando a referência) | Nano Banana Pro, 2K     | 2        |
| O mesmo quarto, a noite pintada                           | Nano Banana Pro, 2K     | 2        |
| A cozinha vazia, de dia (editando a referência)           | Nano Banana Pro, 2K     | 2        |
| A cozinha, a noite pintada                                | Nano Banana Pro, 2K     | 2        |
| A cartela dos itens da cozinha (16, fundo transparente)   | GPT Image 2.6, 2K, alta | 2        |
| **Total**                                                 |                         | **10**   |

Com refação, até ~16. O saldo em 24/11/2026 era **2,47** (em 23/11, 36,97; o
gasto não foi do app). Gerar mais alta que 9:16, se o modelo deixar: o iPhone
é mais comprido que 9:16, e a pintura precisa cobrir a tela inteira para o
quarto limpo não ter chão liso embaixo.

**A cozinha, no código (quando a arte chegar)**:

- Os cômodos lado a lado, numa rolagem que pagina: o quarto primeiro e a
  cozinha à DIREITA dele (o dedo arrasta para a esquerda para chegar a ela,
  como em toda página do iPhone). A bandeja mostra as abas do cômodo que está
  na tela (a cozinha: Móveis, Decoração, Utensílios, Plantas, Tapetes).
- A pintura é a estrutura (armários, pia, fogão, geladeira, janela); o que se
  decora são os soltos da referência: o vaso grande, as prateleiras de potes, o
  relógio, a planta pendurada, a cafeteira, o vaso de margaridas, o pote de
  colheres, a panela e o tapete xadrez.
- A posse: os itens da lojinha que cabem numa cozinha mudam de "vem para o
  quarto" para ela (o bule de chá, a hortelã, a suculenta, o trevo, o
  cactinho, as tulipas, o girassol). Os que só a cozinha tem chegam como
  presente da Bolha e das missões, como os sete do quarto que não são da
  lojinha: o catálogo do servidor não muda.
- O quarto grava os postos da cozinha ao lado dos do quarto
  (`dc-path-quartinho`), e os lugares de todos os itens do quarto são refeitos
  para a câmera de frente.

## A cozinha e o quarto de frente, feitos (25/11/2026)

O dono recarregou o Higgsfield e pediu de noite: "faça o que você tem que
fazer com os créditos, com a implementação da cozinha [...] deixar também a
imagem mais centralizada [...] tá tampando um pouco o que tem em cima".

**O que mudou na tela**:

- O quarto é a pintura NOVA, de frente (feita da referência dele, vazia), e a
  cozinha fica à direita: arrastar leva até ela, e o seletor "Quarto ·
  Cozinha", na linha do olhinho, também. O seletor não está nos mockups: sem
  ele ninguém descobre a cozinha.
- A pintura COBRE a tela (a altura dela é a da tela), em vez de ficar presa à
  largura: a parede do fundo cai no meio, entre o alto (a fala da Bolha) e a
  bandeja, e não sobra chão liso embaixo. É o "mais centralizada".
- A bandeja mostra as abas do cômodo da tela (a cozinha: Utensílios,
  Decoração, Plantas, Tapetes; o "No ar" vale nos dois), o dado decora só ele,
  e a Bolha diz onde ela chegou.
- 16 itens na cozinha: 7 da lojinha (o bule, a hortelã, a suculenta, o trevo,
  o cactinho, as tulipas e o girassol, que esperavam arte no quarto), 7
  presentes de saída (a prateleira de potes, a planta pendurada, a cafeteira,
  as margaridas, o pote de colheres, a panela e a planta grande) e 2 de missão
  (o relógio, na "Arrume a bancada da cozinha", e o tapete xadrez, na "Ponha
  uma planta na cozinha"). As missões da cozinha vêm depois das cinco do
  quarto.
- Os lugares de todos os itens do quarto foram refeitos para a câmera de
  frente (o berço contra a parede do fundo, a cômoda com o coelhinho em cima,
  a poltrona e a planta à esquerda, o tapete no meio do chão).

**A arte (o que custou, 25/11/2026, saldo de 52,47)**:

| Peça                                        | Como saiu                                                            | Créditos |
| ------------------------------------------- | -------------------------------------------------------------------- | -------- |
| O quarto de frente, vazio, de dia           | Nano Banana Pro, editando a referência do quarto                     | 2        |
| O quarto de noite                           | Nano Banana Pro, editando o de dia (sai alinhado)                    | 2        |
| A cozinha, três tentativas                  | a geladeira sempre cortada na borda, por mais que o texto pedisse    | 6        |
| O outpaint da cozinha                       | devolveu a MESMA imagem (ignorou o tamanho)                          | 2        |
| A cozinha que valeu                         | a v1 encolhida a 78% numa moldura cinza, e o modelo pintou a moldura | 2        |
| A cozinha de noite (com a luzinha da coifa) | Nano Banana Pro, editando a de dia                                   | 2        |
| A cartela dos 16 itens da cozinha           | GPT Image 2.6, 2K, alta, fundo transparente                          | 2        |
| O ícone novo: quatro propostas e o recorte  | Nano Banana Pro (2 × 2) e o removedor de fundo                       | 9        |
| **Total** (o saldo foi de 52,47 a 25,47)    |                                                                      | **27**   |

⚠️ **Para AFASTAR a câmera de uma pintura, não peça no texto e não use o
outpaint**: encolha a imagem (`sips -z`), ponha numa moldura de cor lisa
(`sips -p ... --padColor D9D9D9`) e peça ao Nano Banana para pintar só a
moldura, mantendo o miolo. Foi o único jeito que funcionou.

**A receita da prévia** (como os lugares foram compostos): um HTML com a
pintura em "cover" numa tela de 402 × 874 e cada item na fração dele, com a
faixa do alto e a bandeja desenhadas por cima, fotografado pelo Chrome do
Playwright. Os números saem da prévia e vão para `ITENS`; o simulador confere
no fim.

**O que falta**: as estrelinhas da parede piscam no quarto (tiradas da pintura
da noite nova); a cozinha não tem nada que pisque além dos vaga-lumes. Os
itens "vem para o quarto" que sobraram (57 − 7) continuam esperando a arte
deles.

## A migração da lojinha para o quartinho (24/11/2026)

O dono: "a trilha customizada não vai mais existir [...] o fundo será baseado
no clima do dia [...] todos os itens que têm na nossa trilha, você deve tentar
passar para o quartinho. O que não der, a gente vai excluir do nosso jogo [...]
os itens de fato comprados têm que ser ali na aba do quartinho".

**O que mudou no app**

- A trilha sobe pelo céu da hora, sem enfeites, Arrumar, cenário, ar nem pele
  das bolinhas. As sementinhas do placar levam ao quartinho (ou às conquistas,
  quando há conquista para resgatar).
- As Recompensas ficaram com a porta do quartinho, as conquistas e o "Ganhe
  mais". O "Meu Cantinho" saiu.
- O quartinho é a loja: ela compra ali mesmo. O perfil da amiga mostra a luz e
  a Bolha (a cena do Cantinho dela saiu).
- O "No ar" da lojinha virou o AR do quarto, desenhado por código (pétalas,
  bolhinhas, peninhas, folhas, neve, poeira de estrelas), em rajadas.

**O destino de cada um dos 111 itens** mora em
`mobile/src/lib/quartinho/migracao.ts` (a catraca `migracao.test.ts` cobra
que nenhum fique sem): 9 já estão no quarto, 6 viraram o ar, 57 vêm para o
quarto quando tiverem arte, e 39 saem do jogo. Quem já comprou um item que
saiu continua dona no servidor; o app só não o mostra.

**Os 57 que vêm para o quarto** (cada um já com o nome no quarto, a
categoria, o apoio e a ficha de luz):

- **plantas** (11): Suculenta (era Suculenta); Girassol (era Girassol); Trevo (era Trevo); Tulipas (era Tulipa); Cerejeira (era Cerejeira); Bonsai (era Bonsai); Flores na janela (era Primavera); Hortelã (era Hortelã); Cactinho (era Cactinho); Roseira (era Roseira); Palmeirinha (era Palmeirinha).
- **decoracao** (21): Estrelinhas no teto (era Estrelinhas, luz brilhaNoEscuro); Nuvem na parede (era Nuvem fofa); Borboletas (era Borboleta); Pote de vaga-lumes (era Vaga-lumes no pote, luz luzinhas); Quadro do sol (era Sol radiante); Luminária de lua (era Lua e estrelas, luz luzNoturna); Velinhas de LED (era Velinha, luz luzinhas); Lampião (era Lampião, luz luzNoturna); Varal de luzinhas (era Pisca-pisca, luz luzinhas); Lanterninha (era Lanterninha, luz luzNoturna); Passarinhos na parede (era Bando de passarinhos); Pipa (era Pipa); Balãozinho (era Balãozinho); Estrela cadente (era Cometa, luz tintaQueBrilha); Bule de chá (era Chá quentinho); Almofada (era Almofadinha); Chuva na janela (era Chuva mansa); Abajur de cogumelo (era Cogumelinho, luz luzNoturna); Cesta de tricô (era Novelo de linha); Espelho (era Espelhinho); Caixinha de som (era Fones de dormir).
- **brinquedos** (25): Gatinho (era Gatinho); Passarinho (era Passarinho cantante); Arco-íris de madeira (era Arco-íris); Peixinho (era Peixinho); Golfinho (era Golfinho); Livrinhos (era Livrinho de história); Caixinha de música (era Caixinha de música); Joaninha (era Joaninha); Abelhinha (era Abelhinha); Tartaruguinha (era Tartaruguinha); Raposinha (era Raposinha); Sapinho (era Sapinho); Caranguejinho (era Caranguejinho); Patinho (era Patinho); Polvinho (era Polvinho); Cisne (era Cisne); Foquinha (era Foquinha); Caracol (era Caracol); Lagartinha (era Lagartinha); Esquilinho (era Esquilinho); Ouriço (era Ouriço); Ovelhinha (era Ovelhinha); Corujinha (era Corujinha); Matrioskas (era Matrioskas); Carrossel (era Carrossel).

**Os 39 que saem do jogo, e por quê:**

- era a pele das bolinhas da trilha, que não se personaliza mais: Bolinhas Jardim, Bolinhas Lótus, Bolinhas Origami, Bolinhas Pérolas, Bolinhas Constelação, Bolinhas Cristais, Bolinhas Planetas, Bolinhas Coração.
- era o fundo da trilha, que agora é o céu da hora: Fundo Suave, Campo ao amanhecer, Quartinho aconchegante, Ondas do mar, Chuva de estrelas, Aurora boreal, Bosque tranquilo, Campo de lavanda, Fim de tarde no deserto, Manhã de neve, Beira do lago, Campo dourado, Entre as nuvens.
- trocava o céu do site; no app não tinha efeito: Céu Clássico.
- já estava fora de circulação: Balão de ar, Cascata, Estrela cadente, Arco-íris duplo.
- a árvore que cresce era da trilha: Árvore que cresce.
- o quarto já tem o dia e a noite de verdade: Ciclo dia/noite.
- era uma estação da trilha: Outono, Natal, Boneco de neve.
- uma poça não cabe num quarto: Pocinha.
- uma fonte não cabe num quarto: Fontinha.
- ficaria solta, sem lugar no quarto: Conchinha.
- um recife não cabe num quarto: Recife de coral.
- as carpas ao vento são do céu aberto: Carpas ao vento.
- fogos de artifício não combinam com o quarto do bebê: Fogos de artifício.
- um pavão não cabe num quarto: Pavão.
- a Coroa era da coleção da lojinha da trilha: Coroa da Coleção.

**A arte que falta (orçamento de 24/11/2026, sem gerar nada):** uma cartela
4×4 em 2k custa 2 créditos (`gpt_image_2_6` ou `nano_banana_pro`, medido por
`estimate_image_cost`). Os 57 cabem em 4 cartelas: **cerca de 8 créditos**, até
12 com uma refação por cartela (saldo: 36,97). Depois da arte, cada item entra
pela receita abaixo: o lugar, o apoio e a luz já estão na ficha do
`migracao.ts`.

⚠️ Com 57 itens a mais, o quarto precisa de VAGAS (um lugar por tipo: o chão
perto do tapete, a prateleira, o peitoril, a parede de cima, a cômoda), em vez
de um lugar fixo por item: pôr um item numa vaga ocupada troca o que estava
lá. É a próxima decisão de desenho, junto com a arte.

## Como criar um item novo do quartinho (a receita)

Todo item novo entra em `mobile/src/lib/quartinho/quarto.ts`, na lista `ITENS`,
com a ficha inteira. O teste `quarto.test.ts` reprova o item que vier sem ela.

1. **A arte**: fundo transparente, no estilo da cartela (a mesma câmera, de
   frente e um pouco de cima), em `mobile/assets/quartinho/<id>.webp`, e a
   linha dela no mapa `ARTE` de `app/quartinho.tsx`.
2. **O lugar** (`lugar`): o centro, a linha da base, a largura e a camada, em
   frações da pintura do cômodo dele (`comodo`). A pintura cobre a tela e
   perde 8,8% de cada lado num iPhone comprido: o item fica entre `x` 0,085 e
   0,915, com a base até 0,70 (a linha dos botões começa em 0,665). Componha numa PRÉVIA da tela com a
   bandeja por cima (a receita está em "A cozinha, feita", abaixo), nunca de
   cabeça.
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

## As coisas que se tocam, feitas (26/11/2026, sem crédito)

As duas luzes do teto de cada cômodo acendem e apagam; a geladeira e o forno
abrem; a cortina fecha e abre. Nada disso é arte nova (`lib/quartinho/coisas.ts`
e `componentes/quartinho/coisas.tsx`):

- a **porta** é o pedaço da pintura girando na dobradiça (`transformOrigin` +
  `perspective`), com o miolo desenhado por código atrás dela;
- a **cortina** é o tecido liso da pintura, esticado num quadrilátero (o do
  quarto segue a perspectiva da parede); a luz da janela pintada no chão some
  sob um remendo do próprio chão;
- a **luz** é o ponto, o cone em quatro camadas e a poça, somados (`screen`).

Para uma coisa nova: medir na pintura em tamanho real (recorte com `sips`),
pôr as frações em `COISAS`, e compor numa foto do simulador com
`&coisas=<cômodo>:<id>` na bancada. Ideias que ficaram para depois: a coifa que
acende, a torneira que pinga, o abajur do quarto que já é item (a luz dele vem
da `REGUA_DA_LUZ`).
