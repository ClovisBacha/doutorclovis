# A noite da gamificação — 3 de agosto de 2026

Varredura completa da aba da paciente, pedida com o app já em produção e com
o lançamento para a comunidade como objetivo. Este arquivo é o registro do que
foi encontrado, do que foi consertado e — principalmente — **do que não foi**.

## O que motivou

> "Tem muitas coisas que foram muitos erros fake, eu não estou totalmente
> satisfeito. Eu acho que pode ter ainda mais erros dentro da nossa plataforma."

Estava certo. Quatro auditorias independentes (loja, jogos, conteúdo diário,
pagamentos) encontraram mais do que polimento faltando.

---

## Os três achados que não eram de produto

### 1. Doppler fetal doméstico à venda, com o selo do médico

A loja curada vendia um "Monitor Doppler Fetal", com o texto _"ouça o coração
do seu bebê em casa entre as consultas"_, badge OFERTA, exibido sob o
cabeçalho **"Por que seu médico recomenda"**, num app de gestação de **alto
risco**.

É o aparelho classicamente associado à falsa tranquilização: a mãe percebe
menos movimento, encosta o sonar, escuta um batimento — que pode ser o dela ou
a placenta — e deixa de procurar o pronto-socorro. Redução de movimento fetal
se avalia com cardiotocografia, hoje, no serviço.

**Removido.** O motivo ficou escrito no lugar dele, para não voltar.

### 2. Preços inventados ao lado do selo do médico

Os quinze produtos tinham `price`, `originalPrice` e `discount` escritos à mão,
mais "Envio grátis" fixo em todos. Mas o link vai para uma **busca** da Amazon
(`/s?k=...`), não para um produto: a paciente lia "R$ 18,00 · 25% OFF" e caía
numa lista com preços completamente outros. E a linha _"comprar pelo link apoia
o portal"_ era falsa — nenhum link tem tag de afiliado.

**Os três campos saíram do tipo, não só da tela**, para a ficção não voltar por
descuido.

### 3. A loja não se calava no Modo Cuidado

Uma paciente que perdeu o bebê abria "Recompensas" e via o saldo em destaque e
um **"Berço (opcional) — 250 🌱"**. Conquistas mostrava "Bebê chegou! 🔒",
Chutes oferecia "conte 10 movimentos de {nome}", Sons dizia "o bebê pode
reconhecê-los após o nascimento".

O app já tinha a regra e o transporte (`isCareModeActive`); faltava aplicá-la.
**Cinco superfícies fechadas.** A resposta não é uma versão suavizada da tela:
é silêncio, com uma porta de saída.

---

## O quiz dava para gabaritar sem ler a aula

Em **todas** as 294 perguntas "marque todas", a alternativa 0 era correta.
Cem por cento. Na escolha única de três, a certa caía no índice 0 em 42,3% (o
acaso é 33,3%).

Quem percebesse "marco sempre a primeira" gabaritava todo dia sem abrir a aula.
O portão premium protegia o **acesso** ao conteúdo; não protegia o aprendizado.

1039 perguntas embaralhadas com PRNG determinístico semeado pelo próprio
enunciado — mesma entrada, mesma saída, diff revisável. Duas invariantes travam
a operação: o conjunto de alternativas tem de ser idêntico, e as corretas têm
de continuar as mesmas **por texto**, nunca por índice.

Resultado: 42,3% → **32,2%** na escolha única. Em "marque todas", 74,5% contra
73,6% de acaso esperado (o acaso aqui é K/N, não 50%).

`bun run audit:conteudo` agora reprova se o vício voltar.

### O que embaralhar NÃO conserta — e continua aberto

Dois vazamentos, ambos como **aviso** na auditoria, porque consertar exige
escrever alternativa clínica e isso é trabalho do médico, não de script:

- **99,3% dos "marque todas" têm exatamente UMA errada.** Marcar todas menos
  uma acerta quase sempre. Faltam segundos distratores.
- **A certa é a alternativa mais longa em 79,6% das escolhas únicas**, contra
  33% de acaso. Distrator curto entrega a resposta.

### Dois consertos clínicos

- **D102** cai em 14s4d e mandava _"correr para agendar, a janela está
  fechando"_. A janela da TN é 11s0d–13s6d: naquele dia ela **já fechou**.
  Instrução acionável errada servida no dia exato em que não vale mais.
- **Ácido fólico** aparecia em 13 dias e em nenhum deles a exceção do **alto
  risco** — que é o público desta clínica. Nenhum gabarito mudou (400 mcg segue
  certo para risco habitual); entrou a ressalva de que tubo neural prévio,
  anticonvulsivante, diabetes, obesidade ou bariátrica pedem dose bem maior.

### O que a amostragem clínica encontrou e eu NÃO consertei

O conteúdo é de gestação de **risco habitual**, não de alto risco. Em 294 dias:

| tema                                          | dias  |
| --------------------------------------------- | ----- |
| AAS / aspirina — profilaxia de pré-eclâmpsia  | **0** |
| colo curto / progesterona vaginal / cerclagem | **0** |
| corticoide antenatal                          | **0** |
| restrição de crescimento / Doppler            | **0** |
| trombofilia / heparina                        | **0** |
| Rh negativo / imunoglobulina anti-D           | **0** |
| colestase gestacional                         | **0** |

A profilaxia com AAS a partir de 12–16 semanas é a intervenção mais
estabelecida do pré-natal de alto risco e não é mencionada uma vez. **Isto é
autoria clínica, não conserto de código** — precisa do Dr. Clóvis.

---

## O iPhone não sentia o app

Existe uma ponte nativa bem escrita (`src/lib/nativo.ts`) que traduz padrão de
vibração em impactos do Haptics do iOS. **Só a respiração a usava.** As outras
cinco chamavam `navigator.vibrate` direto — e o Safari nunca implementou a
Vibration API.

A pior era `celebrate.ts`: a comemoração é o momento de recompensa do jogo
inteiro, e era muda em todo iOS. Junto foram o microtoque, o "chute de volta"
do contador de chutes, as viradas de movimento e o lub-dub do batimento — numa
tela cujo único propósito é **sentir** o coração do bebê.

Achei também um defeito dentro da própria ponte: pulso de duração **zero**
virava impacto, então o Android sentia um toque e o iPhone sentiria dois.

---

## O que foi entregue

|                        |                                             |
| ---------------------- | ------------------------------------------- |
| Itens do Cantinho      | 34 → **74** (40 novos, 10 categorias)       |
| Peles do Caminho       | 1 → **8** (7 artes geradas, 10,5 créditos)  |
| Categorias novas       | **Luzes** e **Águas**, com animação própria |
| Pacotes de Sementinhas | 4 (1.000 a 10.000 / R$ 39,90 a R$ 249,00)   |
| Testes                 | 239 → **266**                               |

### A escala dos pacotes

```
 1.000  R$  39,90   25,1 por real
 2.000  R$  69,90   28,6 por real   +14%
 5.000  R$ 139,90   35,7 por real   +43%
10.000  R$ 249,00   40,2 por real   +60%
```

Sempre melhora ao subir, e há teste para isso: pacote maior que rendesse menos
por real puniria quem confiou. O maior **não** compra o catálogo inteiro
(11.700) — pacote que zera o jogo mata o jogo.

### O limite que sustenta a venda

**A Sementinha compra enfeite, nunca cuidado.** Nenhuma aula, exame, alerta ou
conduta clínica pode passar a depender dela. Está escrito na tela da paciente e
no cabeçalho de `sementinhas.functions.ts`. No dia em que isso mudar, o app terá
começado a cobrar por saúde — que é outro negócio.

### A Coroa da Coleção

Exigia todos os itens pagos: com os 40 novos passaria de 11.700 🌱, mais dias do
que dura uma gestação. Virou "um item pago em pelo menos **8** categorias" —
~960 🌱, umas duas semanas.

O piso é 8 **fixo**, não "todas as categorias", de propósito: Luzes e Águas
nasceram nesta mesma ampliação, e com "todas" quem fechou a coleção ontem
abriria o app hoje **sem** a coroa. O app não pode tirar de volta um troféu que
já deu. Há um teste só para isso.

---

## O que fica pendente

### Precisa do Dr. Clóvis

1. **Conteúdo de alto risco** (AAS, colo curto, corticoide, CIUR, Rh, trombofilia,
   colestase) — a lacuna mais séria do app hoje.
2. **Segundos distratores** nos "marque todas", e distratores mais longos nas
   escolhas únicas.
3. **Protocolo do GBS**: 11 dias cravam 35–37 semanas; o ACOG revisou para
   36s0d–37s6d, a FEBRASGO mantém 35–37. É decisão de protocolo.

### Precisa de decisão de produto

4. **As duas meditações.** A que a paciente alcança pela navegação de Saúde é a
   pior das duas — voz do sistema, sem persistência, sem fim. Unificar com a do
   Caminho é refatoração de verdade.
5. **Áudio em segundo plano** nos Sons para o Bebê: sair do app corta o som.
   Precisa de plugin nativo.
6. **Gravar a leitura da carta** para o bebê ouvir depois de nascer. É a única
   coisa do app que a mãe vai querer daqui a dez anos.

### Precisa de infraestrutura

7. **In-App Purchase.** As quatro portas de pagamento da paciente estão fechadas
   no app nativo, com o motivo explicado em português — mas fechadas. Vender
   pelo app exige produto na App Store Connect e no Play Console, e validação de
   recibo no servidor.
8. **O Capacitor não está instalado.** Existe `capacitor.config.ts` e a casca,
   não há `ios/` nem `android/`. A ponte de `nativo.ts` tem teste unitário, mas
   nunca rodou contra um runtime real.

---

## Nota metodológica

Nada foi executado em aparelho — não há celular, emulador nem conta de
desenvolvedor neste ambiente. As auditorias são leitura de código com medição
(contagens, estatística do gabarito, luminância das artes). Onde a conclusão
depende de rodar, está dito que depende.

Toda trava nova foi validada **quebrando de propósito** o defeito que ela
protege: o viés do gabarito, o pulso de duração zero, a âncora dos testes da
Bolha e a Coroa que não pode ser revogada.
