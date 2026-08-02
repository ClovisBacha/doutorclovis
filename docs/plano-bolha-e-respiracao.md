# Plano — a bolha viva e a respiração que se sente

Dois assuntos que parecem separados e são o mesmo: **o app pede que a paciente
OLHE quando deveria pedir que ela SINTA.**

---

## Estado (2 de agosto)

| #                                                  | estado    | onde                              |
| -------------------------------------------------- | --------- | --------------------------------- |
| Vibração derivada da duração da fase               | **feito** | `breath-audio.ts` + 32 testes     |
| Meditação para de instruir por cima da voz         | **feito** | `minha-conta.tsx`                 |
| A bolha conduz a respiração (infla/segura/esvazia) | **feito** | `bolha.tsx` + `gestacao-path.tsx` |
| Ociosidade que não se repete (dois períodos)       | **feito** | `styles.css`                      |
| `dormindo` e `comemorando` saem do código morto    | **feito** | respiração e meditação            |
| Unificar as 4 respirações num componente só        | aberto    | —                                 |
| Trocar `speechSynthesis` pela Isabella embarcada   | aberto    | depende de gerar os áudios        |
| `preocupada` — **decisão de produto, ver abaixo**  | parado    | —                                 |
| Piscar / micro-animação por sprite                 | aberto    | precisa de arte nova              |

### `preocupada` está parada de propósito

É a única das quatro artes que continua sem aparecer, e não é esquecimento. Ela
só faria sentido quando a sequência morre — ou seja, mostrar uma carinha
**preocupada para quem faltou**. Numa gestação de alto risco isso é cobrança
para quem já tem cobrança demais, e o próprio `bolha.tsx` anota que ela "nunca
como cobrança de quem está em dia".

Antes de ligar, alguém precisa decidir se o app quer isso. Minha opinião: não —
e se quiser, que seja saudade ("senti sua falta"), não decepção.

---

## Parte 0 — O estado de hoje, medido

### A bolha aparece em UM lugar

```
src/components/gestacao-path.tsx:6404   <Bolha tamanho={44} .../>
```

É só isso. Um único ponto, com 44 pixels, na linha de saudação do Caminho.

As quatro artes existem e somam 47 KB:

| arte               | peso    | quando aparece                          |
| ------------------ | ------- | --------------------------------------- |
| `feliz.webp`       | 10,8 KB | padrão                                  |
| `comemorando.webp` | 13,4 KB | dia fechado (6 meias-tarefas)           |
| `dormindo.webp`    | 11,1 KB | (nunca — nenhum caminho de código leva) |
| `preocupada.webp`  | 12,1 KB | (nunca — a sequência morta não chega)   |

**Metade do personagem nunca foi vista por ninguém.** `humorDaJornada` recebe
apenas `{comemorando, diaFeito}` no único ponto de uso, então "dormindo" e
"preocupada" são código morto na prática.

O tipo `mascot` existe na trilha (`gestacao-path.tsx:862`) e é descartado de
propósito em `:2418` — a sua regra, e ela continua valendo.

### A respiração existe em QUATRO lugares diferentes

| onde                                    | ritmo | voz               | vibra?  |
| --------------------------------------- | ----- | ----------------- | ------- |
| `gestacao-path.tsx:3492` BreathingBlock | 4-4-6 | áudio sintetizado | **sim** |
| `gestacao-path.tsx:5318`                | 4-4-6 | áudio sintetizado | **sim** |
| `minha-conta.tsx:2108`                  | 4-4-6 | áudio sintetizado | não     |
| `minha-conta.tsx:10404` **Meditações**  | 4-4-6 | `speechSynthesis` | **não** |

Quatro implementações da mesma coisa, com quatro comportamentos.

---

## Parte 1 — A confusão da meditação (o que você sentiu)

Você descreveu certo, e o defeito é maior do que parecia.

**1. O círculo aparece o tempo inteiro, sem relação com o texto.**

```js
// minha-conta.tsx:10440 — dentro de speak()
window.speechSynthesis.speak(utter);
setPlaying(true);
startBreathing(); // ← incondicional
```

`startBreathing()` roda um ciclo fixo 4-4-6 do começo ao fim da meditação. Não
importa o que a voz esteja dizendo.

**2. A primeira frase de TODOS os roteiros manda fechar os olhos.**

> "Encontre uma posição confortável... **Feche os olhos suavemente.**"

E aí a tela mostra "Inspire… / Segure… / Expire…" por dez minutos. O app pede
duas coisas opostas ao mesmo tempo.

**3. Pior: o círculo e a voz contam ritmos DIFERENTES.**

O roteiro diz:

> "Inspire contando até quatro... e expire contando até **seis**"

E em outro:

> "inspire pelo nariz enquanto conta 1... 2... 3... 4... Segure suavemente:
> 1... 2... 3... 4... Expire pela boca: 1... 2... 3... 4... 5... **6**"

Enquanto isso o círculo roda 4-4-6 num relógio próprio, que começou quando o
play foi apertado e nunca se alinha com a fala. Quem tentar seguir os dois
recebe instruções contraditórias — e o exercício de acalmar vira exercício de
decidir em quem obedecer.

**4. A aba de Meditações ainda usa a voz robótica.**

```js
const utter = new SpeechSynthesisUtterance(med.script); // :10430
```

É o `speechSynthesis` do navegador — a mesma voz que o CLAUDE.md já declarou de
saída ("no Android padrão é justamente a robótica"). A decisão de agosto foi
Isabella no motor ElevenLabs, com os áudios embarcados. A aba de Meditações não
recebeu essa decisão.

### O conserto

**Regra:** durante fala guiada, a tela não instrui. Ela só confirma.

1. **Tirar o círculo do modo narrado.** Enquanto a voz guia, a tela mostra o
   mínimo: título, tempo decorrido, e a bolha respirando devagar — sem palavra,
   sem contagem, sem nada para acompanhar. Quem fechou os olhos não perde nada.
2. **Separar os dois modos.** "Meditação guiada" (voz manda, tela cala) e
   "Respiração" (tela e vibração mandam, sem voz). Hoje estão fundidos.
3. **Marcar o ritmo DENTRO do roteiro.** Se o texto vai contar até quatro, o
   ritmo tem que sair do próprio texto, não de um `setTimeout` paralelo. Isso
   quer dizer marcações de tempo por faixa de áudio — o que só é possível
   depois de embarcar os MP3 da Isabella, porque `speechSynthesis` não avisa
   onde está.
4. **Substituir a voz** pela Isabella gravada, igual à meditação e à respiração
   que já foram decididas.

---

## Parte 2 — A vibração que conduz (o Apple Respirar)

Você descreveu exatamente o certo: **a vibração cresce e a pessoa acompanha sem
olhar.** É o que torna possível fechar os olhos.

### Metade já existe

`src/lib/breath-audio.ts:91` já tem o padrão crescente:

```js
if (phase === "in") navigator.vibrate([40, 120, 60, 120, 80, 120, 100, 120, 120]);
else if (phase === "hold") navigator.vibrate(25);
else navigator.vibrate([140, 200, 80]);
```

Pulsos de 40ms → 60 → 80 → 100 → 120: é o crescendo do Apple. Está certo em
espírito.

### Dois defeitos medidos

**1. O crescendo acaba antes da fase.** A soma daquele padrão é **880 ms**,
dentro de uma inspiração de **4000 ms**. A paciente sente a subida por menos de
um segundo e depois fica três segundos no escuro, justo quando mais precisa da
referência. O padrão precisa ser gerado a partir da duração da fase, não escrito
à mão.

**2. Não é chamado onde mais importa.** `vibratePhase` só aparece em
`gestacao-path.tsx:3550` e `:4647`. A aba de Meditações — a única em que a
paciente vai realmente fechar os olhos — não vibra.

### O limite que eu não posso contornar, e você precisa saber

**O iPhone não vibra pela web.** O Safari nunca implementou a Vibration API —
não é bug nosso, não tem alternativa, não tem polyfill. `navigator.vibrate` não
existe lá.

Isso significa:

- **Android, no navegador:** funciona hoje.
- **iPhone, no navegador:** zero vibração, faça o que fizer.
- **iPhone, app nativo:** funciona (Core Haptics), e é o único caminho.

O app da Apple que você citou como referência é justamente nativo. Reproduzir
aquilo no iPhone exige o app nativo — que já está no seu backlog pelo mesmo
motivo (a localização do SOS).

**Consequência de projeto:** a vibração é um **reforço**, nunca o único
condutor. Quem não vibra precisa de um segundo canal que funcione de olhos
fechados — e esse canal é o **som**. Um tom que sobe na inspiração e desce na
expiração conduz sem tela e funciona nos dois sistemas. O `createBreathAudio`
já existe; falta ele virar o guia principal em vez de enfeite.

### Ordem de ataque

| #   | o quê                                                            | onde                  |
| --- | ---------------------------------------------------------------- | --------------------- |
| 1   | Padrão de vibração derivado da duração da fase, não fixo         | `breath-audio.ts`     |
| 2   | Unificar as 4 respirações num componente só                      | novo `respiracao.tsx` |
| 3   | Modo "olhos fechados": som + vibração conduzem, tela só confirma | idem                  |
| 4   | Ligar a vibração na aba de Meditações                            | `minha-conta.tsx`     |
| 5   | Trocar `speechSynthesis` pela Isabella embarcada                 | `minha-conta.tsx`     |

O passo 1 é barato e melhora hoje no Android. O passo 5 depende de gerar os
áudios — o mesmo caminho já decidido para a meditação.

---

## Parte 3 — A bolha "3D interativa"

Preciso corrigir uma premissa antes de planejar, porque ela muda o plano inteiro.

### O Duolingo não é 3D

O Duo é **vetor chapado**, animado com esqueleto (Rive). O Candy Crush usa 3D
**pré-renderizado e achatado em sprite** — a Tiffi é uma imagem, não um modelo.
Nenhum dos dois roda motor 3D no celular, porque motor 3D come bateria e trava
aparelho fraco, e o público de nenhum dos dois toleraria isso.

A sensação de "muito bem feito" que a gente atribui a 3D vem de outra coisa, e o
`bolha.tsx` já anota quais são:

1. **volume assado na arte** — luz sempre do mesmo lado
2. **mola no toque** — afunda e volta ultrapassando o repouso
3. **peso** — a sombra encolhe e clareia ao subir, espalha ao descer

As três já estão implementadas.

### Então o gargalo não é a técnica

**É que ela aparece em um lugar só, com 44 pixels.** Trocar CSS por WebGL numa
figura de 44px que a paciente vê uma vez por sessão não muda nada — gasta
bateria e peso de bundle para produzir o mesmo 44px.

**Antes de qualquer 3D, a bolha precisa existir.** Ordem que eu proponho:

| #   | o quê                                                        | custo                    |
| --- | ------------------------------------------------------------ | ------------------------ |
| 1   | Ligar os dois humores mortos (`dormindo`, `preocupada`)      | ~20 linhas               |
| 2   | Ela conduz a respiração — infla e esvazia junto              | reaproveita o componente |
| 3   | Ela reage ao toque em mais telas (topo da home, fim de quiz) | posicionamento           |
| 4   | Mais humores gerados no Higgsfield, mesmo estilo             | ~2 créditos cada         |
| 5   | Micro-animação de verdade — piscar, respirar, olhar          | ver abaixo               |

### Se depois disso ainda quiser movimento de personagem

Três caminhos reais, do mais barato ao mais caro:

**(a) Folha de sprites.** Gerar 4–8 quadros por animação no Higgsfield e trocar
com `steps()` em CSS. Zero dependência nova, funciona em qualquer aparelho, cada
quadro ~12 KB. É literalmente a técnica do Candy Crush.

**(b) Rive.** A técnica real do Duolingo: esqueleto vetorial, interpolação
suave, reage a estado. Custa **~100 KB de runtime** e exige montar o rig num
editor externo. É o único caminho que dá "personagem vivo" de verdade.

**(c) 3D verdadeiro.** O Higgsfield tem `generate_3d` (imagem → malha GLB).
Renderizar exigiria three.js — **~600 KB** — mais custo de bateria. Para uma
figura de 44px numa tela que a gestante abre deitada na cama, é o pior negócio
dos três.

**Minha recomendação:** (a). E só considerar (b) depois que os passos 1 a 4
estiverem no ar e a bolha for algo que a paciente encontra várias vezes por dia.
Personagem vive de presença, não de polígono.

---

## Parte 4 — O próximo passo concreto: ela pisca

O que foi feito até aqui deu **presença** e **compasso**. O que ainda falta para
ela cruzar de "adesivo bem feito" para "bicho" é uma coisa só, e é a mesma coisa
que o Duo faz o tempo todo: **piscar**.

Piscar é o sinal mais barato de vida que existe. É involuntário, acontece a cada
poucos segundos, e a ausência dele é o que faz um rosto parado parecer morto —
manequim, não personagem.

### Por que ainda não foi feito

Precisa de **arte nova**: a bolha é um WebP por humor, sem camadas. Não dá para
fechar os olhos dela por CSS — o que dá para fazer (achatar o corpo) lê como
pulinho, não como piscada.

### O que exatamente pedir ao Higgsfield

Um quadro por humor, idêntico ao existente **exceto pelos olhos fechados**:

| arquivo                     | base          | mudança            | custo |
| --------------------------- | ------------- | ------------------ | ----- |
| `feliz-piscando.webp`       | `feliz`       | olhos em traço `‿` | 2 cr  |
| `comemorando-piscando.webp` | `comemorando` | olhos em traço     | 2 cr  |
| `preocupada-piscando.webp`  | `preocupada`  | olhos em traço     | 2 cr  |

`dormindo` não precisa: os olhos já estão fechados.

**A exigência que decide se presta:** o quadro tem que ser a MESMA imagem com
outra boca de olho. Qualquer deriva de forma, cor ou posição vira um salto ao
alternar — e alternar é o ponto. Por isso é geração com a arte atual anexada
como referência, e a conferência é sobrepor os dois e olhar o que se mexeu além
dos olhos.

Vale registrar o risco: **a referência anexada copia demais** — foi o que
aconteceu com as ilustrações do bebê, onde a âncora carregou a pose junto com a
identidade. Aqui isso é bom (queremos cópia quase total), mas o defeito espelhado
é o modelo copiar TAMBÉM os olhos abertos e não fechar nada. Se acontecer, o
caminho é editar por `nano_banana` com instrução de edição em vez de geração.

### Como tocar

```
0s ─────────── 4,7s ─┬─ 120ms fechado ─┬─────────── 9,4s ─┬─ …
                     └ troca o src ────┘
```

Um intervalo de ~4,7 s (não múltiplo de 3,6 s nem de 8,3 s, pelo mesmo motivo do
resto) troca o `src` por 120 ms e volta. Sem CSS de sprite, sem `steps()`, sem
dependência: é `useState` e um `setTimeout`.

Peso: +36 KB no total, e só a imagem do humor em cena baixa.

**Depois disso eu pararia.** Uma bolha que respira no compasso, flutua sem
repetir, afunda no toque e pisca sozinha já entrega tudo que "3D" queria
significar — e nada disso custa bateria ou bundle.
