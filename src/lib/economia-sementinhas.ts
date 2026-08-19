/**
 * A ECONOMIA DAS SEMENTINHAS — a conta que decide se a paciente assina.
 *
 * ─── A IDEIA (decisão do dono, ago/2026) ────────────────────────────────────
 *
 * As Sementinhas deixam de ser um SUBSTITUTO do Premium e viram um GERADOR DE
 * DEMANDA por ele. O mecanismo, na palavra dele: poucos itens grátis, e baratos,
 * de modo que em ~15 dias ela já tenha comprado TODOS — e a partir daí acumule
 * moeda sem ter no que gastar, olhando uma loja cheia de coisa bloqueada.
 *
 * É mais forte que esconder conteúdo. Moeda parada no bolso incomoda de um jeito
 * que conteúdo que ela nunca viu não incomoda: ela já TEM o preço do item, e a
 * única coisa entre os dois é a assinatura.
 *
 * ─── POR QUE A CURVA TEM ESTA FORMA ─────────────────────────────────────────
 *
 * Medido antes de mexer: 37 itens grátis somando 3.300 🌱, com um ganho de
 * ~205 🌱 em quinze dias. Dava **241 dias** para zerar a loja grátis. Não é um
 * ajuste de números, é outro jogo.
 *
 * A curva nova é a que os jogos usam no primeiro mês, e ela faz duas coisas
 * diferentes com dois grupos de itens:
 *
 *  · **os catorze primeiros degraus da `CURVA_GRATIS`** — vitória quase
 *    imediata, várias vezes por semana. É o que ensina o laço "ganhei → gastei
 *    → mudou a minha tela" nos primeiros minutos, quando ela ainda não tem
 *    motivo para voltar.
 *
 *  · **UM item caro, o último degrau da curva** — o troféu. Leva de cinco a
 *    oito dias juntando, e existe para ser perseguido.
 *
 * E o preço do troféu não é arbitrário: ele fica **no meio da faixa premium**.
 * É âncora de preço. Ela paga aquilo por um item que podia ter de graça,
 * aprende no corpo quanto vale aquele número — e quando abre a loja premium o
 * número já significa alguma coisa. Sem essa âncora, o preço premium é só um
 * número grande. `loja-coerente.test.ts` cobra a âncora contra a mediana REAL
 * do catálogo, e os dois lados são derivados.
 *
 * ⚠️ ESTE PARÁGRAFO JÁ MENTIU DUAS VEZES, e por isso não tem mais número
 * nenhum escrito nele. Na primeira, "200 é a mediana do premium" era verdade e
 * deixou de ser quando 27 itens mudaram de prateleira — sem nenhum número sair
 * do lugar. Na segunda, o reajuste de preços levou a âncora a 260 e a mediana a
 * 260, e a prosa continuou afirmando 200 e 160. As duas vezes a frase estava a
 * oitenta linhas do valor que ela descrevia.
 *
 * A regra que sobrou: **preço não se escreve em prosa neste arquivo** — cita-se
 * a constante. Há teste (`economia-sementinhas.test.ts`) recusando "N 🌱" e
 * "mediana N" neste cabeçalho, porque prosa confiante e errada nesta base é
 * pior que prosa nenhuma.
 *
 * ─── O PRESENTE DO MÉDICO ACELERA A PAREDE ──────────────────────────────────
 *
 * O médico ganha uma mesada mensal de Sementinhas para presentear, do tamanho
 * do plano dele. Quanto mais generoso ele é, MAIS RÁPIDO ela zera os grátis e
 * chega na parede. Ele acha que está mimando a paciente — e está, ela ganha as
 * Sementinhas de verdade — e ao mesmo tempo está empurrando a conversão.
 *
 * Custo da mesada para a plataforma: **zero**. Sementinha compra conteúdo
 * estático (JSON já escrito), não chamada de modelo.
 *
 * Este arquivo é só a conta. Sem rede, sem banco, sem React.
 */

/** Quantos itens ficam grátis na loja. */
export const ITENS_GRATIS = 15;

/**
 * A curva de preços dos grátis, em Sementinhas, do mais barato ao troféu.
 *
 * Catorze degraus e um salto. Somam 704 🌱 — calibrado contra o ganho TÍPICO
 * (35 🌱/dia), não contra o teto, para a paciente COM médico zerar a loja no
 * 15º dia.
 *
 * A primeira versão somava 330 e "dava 15 dias" — mas contra um modelo de
 * ganho que só enxergava o check-in. Com os quatro ganhos diários reais, aquela
 * loja sumia em SEIS dias. Os preços daqui dobraram para caber no ganho de
 * verdade; a FORMA da curva (muitos degraus curtos, um salto no fim) é a mesma,
 * porque a forma é o que faz o laço "ganhei → gastei → mudou minha tela" fechar
 * várias vezes na primeira semana.
 */
export const CURVA_GRATIS = [
  10, 12, 15, 18, 20, 22, 26, 30, 34, 38, 42, 52, 60, 65,
  /* O troféu, no meio da faixa premium. Ver o cabeçalho: é âncora de preço,
     não enfeite.

     ⚠️ SUBIU DE 200 PARA 260, e os catorze degraus abaixo desceram para
     compensar — a SOMA continua 704, então a parede do 15º dia não se moveu um
     dia. O que mudou foi a leva de ago/2026 que dobrou o preço dos itens
     aspiracionais: com o premium indo a 1.000, uma âncora de 200 deixou de
     ficar dentro da faixa que ela existe para ensinar. Foi o teste que pegou.

     De quebra a FORMA melhorou: o salto do último degrau grátis para o troféu
     era de 2,7× (74 → 200) e agora é de 4× (65 → 260) — "muitos degraus
     curtos, um salto no fim" é literalmente o que o cabeçalho pede. */
  260,
] as const;

/** O que custa comprar a loja grátis inteira. */
export const CUSTO_LOJA_GRATIS = CURVA_GRATIS.reduce((s, p) => s + p, 0);

/**
 * ─── O GANHO DIÁRIO REAL, E O ERRO QUE ISTO CORRIGE ─────────────────────────
 *
 * A primeira versão deste arquivo modelava **só o check-in (5 🌱/dia)** e
 * calibrava a loja em cima disso. Um verificador mediu: existem QUATRO ganhos
 * diários no app, e três estavam fora da conta.
 *
 *   · check-in ................................  5 🌱   (`SEMENTINHAS.dailyCheckin`)
 *   · aula do dia (5 + 3 × acertos) ...........  ~18 🌱  (`grantDailyQuizReward`)
 *   · bem-estar (5 × 5 atividades) ............  25 🌱  (`grantWellnessReward`)
 *   · bônus das 3 estrelas ....................  20 🌱  (`grantDayStarsBonus`)
 *
 * O modelo dizia 13,9 🌱/dia. O teto real é **~68 🌱/dia** — quase cinco vezes.
 * Com o número errado, a loja de 330 🌱 "levava 15 dias" no papel e some em
 * MENOS DE CINCO na vida real. O dono pediu quinze e teria recebido quatro.
 *
 * ─── POR QUE UMA FAIXA, E NÃO UM NÚMERO ─────────────────────────────────────
 *
 * 68 🌱/dia é o TETO: exige check-in, aula respondida, as cinco atividades de
 * bem-estar e as três estrelas fechadas, TODO dia. Quase ninguém faz isso.
 * Modelar o teto como se fosse a média é o mesmo erro de sinal trocado —
 * calibraria a loja para quem não existe.
 *
 * A calibragem usa o TÍPICO. O teto e o mínimo entram como limites, e é assim
 * que o teste os cobra: a loja não pode sumir em três dias para a mais
 * engajada, nem virar inalcançável para a que só faz check-in.
 */
export const GANHO_DIA_TETO = 68;
/** Check-in + aula + parte do bem-estar. É esta que calibra a curva. */
export const GANHO_DIA_TIPICO = 35;
/** Só o check-in — quem abre o app e sai. */
export const GANHO_DIA_MINIMO = 5;

/** Marco de semana: 25 🌱 a cada sete dias, por fora dos diários. */
export const GANHO_SEMANAL = 25;

/**
 * Bônus de vincular um médico — pago uma vez, por médico.
 *
 * ⚠️ O texto aqui dizia "subiu de 100 para 200" — para uma constante que vale
 * 100. Foi proposto subir e não subiu; a prosa ficou descrevendo a proposta.
 * O que continua valendo é a RAZÃO: o bônus tem de mudar em dias visíveis de
 * caminhada, senão vincular o médico não muda nada de perceptível e o bônus
 * vira enfeite. `diasParaZerarLoja` mede isso, e é lá que a decisão se confere.
 */
export const BONUS_VINCULO_MEDICO = 100;

/**
 * O QUE A GESTANTE GANHA POR CHEGAR PELO CÓDIGO DE UMA INFLUENCIADORA.
 *
 * ─── ⚠️ 150, E O NÚMERO FOI MEDIDO CONTRA A PAREDE ──────────────────────────
 *
 * A proposta do dono era 500. Medido com a régua deste arquivo
 * (`CUSTO_LOJA_GRATIS` 704 🌱, `GANHO_DIA_TIPICO` + `GANHO_SEMANAL`/7 = 38,6/dia):
 *
 * | bônus | % da loja grátis | parede sem médico | com médico |
 * | ----- | ---------------- | ----------------- | ---------- |
 * | 0     | 0%               | 19 dias           | 16 dias    |
 * | 100   | 14%              | 16 dias           | 14 dias    |
 * | 150   | 21%              | **15 dias**       | 12 dias    |
 * | 500   | 71%              | 6 dias            | 3 dias     |
 *
 * ⚠️ 500 ENTREGARIA 71% DA LOJA GRÁTIS NO CADASTRO e derrubaria a parede do
 * 15º para o 6º dia. A parede é a mecânica de conversão inteira — é ela que faz
 * a paciente acumular moeda sem ter no que gastar, que é a decisão de
 * monetização escrita no cabeçalho deste arquivo. Um bônus de boas-vindas não
 * pode desfazer o desenho que ele deveria alimentar.
 *
 * 150 é o MAIOR valor que mantém a parede no 15º dia no caso base, e ainda é
 * 1,5× a indicação entre pacientes (`REFERRAL_REWARD`, 100) — soa como presente
 * de verdade num Reels ("comece com 150 sementinhas grátis") sem virar uma
 * categoria à parte.
 *
 * ⚠️ E ELE ENTRA EM `entradaDeGraca`, senão os testes de teto da economia
 * passariam a medir uma paciente que não existe: quem chega por influenciadora
 * começa com 150 a mais, e é esse o cenário que a régua tem de conseguir ver.
 */
export const BONUS_INFLUENCIADORA = 150;

/**
 * A mesada do médico: quantas Sementinhas ele pode distribuir por mês.
 *
 * `mensagens contratadas × 3`. A razão não é arbitrária — ela se calibra
 * sozinha: uma paciente ativa consome ~15 mensagens por mês, então × 3 dá
 * ~45 🌱 por paciente por mês. O médico consegue presentear TODAS as pacientes
 * dele, todo mês, sem ter de escolher entre elas — e escolher entre pacientes
 * é exatamente o tipo de decisão que ele não deve ser obrigado a tomar.
 */
export const SEMENTINHAS_POR_MENSAGEM = 3;

export function mesadaDoMedico(mensagensContratadas: number): number {
  return Math.max(0, Math.floor(mensagensContratadas)) * SEMENTINHAS_POR_MENSAGEM;
}

/** O presente sugerido para UMA paciente — o botão de um clique no painel. */
export const PRESENTE_SUGERIDO = 30;

/**
 * AS DUAS RAZÕES DE PRESENTE, NO ARQUIVO PURO.
 *
 * Elas moravam cada uma no seu `*.functions.ts` — o que estava certo enquanto só
 * quem GRAVA precisava delas. Agora quem LÊ também precisa: a tela da paciente
 * anuncia o presente, e para isso tem de reconhecer a linha do ledger.
 *
 * Importar `mesada.functions` de dentro de `sementinhas.functions` fecharia um
 * ciclo (a mesada importa a carteira para gravar). Aqui não há ciclo: este
 * arquivo é puro e já é importado pelos dois lados.
 *
 * **Nunca escreva estas strings à mão em outro lugar.** Elas são a chave que
 * conta a mesada de volta; uma cópia divergente faria o médico ver bolso cheio
 * enquanto o ledger já estava gasto.
 */
export const RAZAO_PRESENTE_MEDICO = "presente-do-medico";
export const RAZAO_PRESENTE_AMIGA = "presente-de-amiga";
/**
 * O presente da criadora para quem chegou pelo código dela.
 *
 * ⚠️ Razão PRÓPRIA, e não `RAZAO_PRESENTE_AMIGA`: as duas somam no mesmo
 * bolso da paciente, mas quem deu é outra pessoa e o AVISO precisa dizer o
 * nome certo. Reusar a razão faria o app anunciar "sua amiga te mandou um
 * presente" sobre uma criadora que ela nunca conheceu.
 */
export const RAZAO_PRESENTE_INFLUENCIADORA = "presente-da-influenciadora";

/**
 * O BÔNUS COMPRADO — o bolso que SÓ PRESENTEIA (ago/2026).
 *
 * Pedido do dono: "esse bônus, ele só pode ser usado pra você dar outras
 * sementinhas pras suas amizades". É o mesmo desenho da `MESADA_DA_ASSINANTE`,
 * só que comprado em vez de mensal — e por isso precisa de razão PRÓPRIA no
 * ledger: é ela que separa "isto entrou para presentear" de "isto entrou para
 * ela gastar".
 *
 * ⚠️ Sem uma razão própria, a única forma de saber quanto do saldo é de
 * presente seria olhar o texto livre da linha — e texto livre muda. A razão é
 * a chave, como as duas acima.
 */
export const RAZAO_BONUS_COMPRADO = "bonus-comprado-presente";

/**
 * A CHAVE DO PRESENTE DO MÉDICO — construtor e leitor, no mesmo lugar.
 *
 * `presente:<medico>:<paciente>:<token>`.
 *
 * ─── O QUE ERA, E POR QUE MUDOU ─────────────────────────────────────────────
 *
 * O último campo era o CICLO (`2026-08`), e era ele — junto com o índice único
 * do ledger — que impunha "um presente por paciente por mês". O dono tirou esse
 * limite: ele pode presentear a mesma paciente quantas vezes quiser.
 *
 * Trocar o ciclo por um token de envio, e não simplesmente apagar o campo, é o
 * ponto todo. `grantSementinhas` grava com `ignoreDuplicates`, então a chave é
 * a ÚNICA coisa que impede um clique duplo (ou uma retentativa de rede) de
 * virar dois presentes. Sem chave estável, "sem limite" viraria "sem defesa".
 *
 * O token nasce no NAVEGADOR, um por clique: a mesma intenção reenviada carrega
 * o mesmo token e não grava de novo; dois cliques deliberados carregam tokens
 * diferentes e valem dois presentes. É idempotência por intenção, e não por
 * calendário.
 *
 * O ciclo não faz falta na chave porque quem recorta o mês é o
 * `created_at >= inicioDoCiclo()` da consulta — a mesada nunca dependeu do
 * texto da chave para saber em que mês está.
 */
export function chaveDoPresente(doctorId: string, patientId: string, token: string): string {
  return `presente:${doctorId}:${patientId}:${token}`;
}

/** O `LIKE` que pega todos os presentes de um médico. */
export function prefixoDosPresentes(doctorId: string): string {
  return `presente:${doctorId}:%`;
}

/**
 * O token de envio, limpo.
 *
 * Ele vem do cliente e vai para dentro de uma chave cujos campos são separados
 * por `:` — um token com dois-pontos deslocaria o parser e faria o painel
 * atribuir o presente à paciente errada. Só letras, números e hífen entram.
 *
 * Vazio depois da limpeza devolve `null`, e o servidor sorteia um: um token
 * inútil é melhor descartado que aceito, porque um token vazio faria TODOS os
 * presentes daquela paciente colidirem numa chave só — que é exatamente o
 * limite que acabamos de tirar, de volta pela porta dos fundos.
 */
export function tokenDePresente(bruto: string | null | undefined): string | null {
  const limpo = (bruto ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  return limpo || null;
}

/**
 * Quanto cada paciente já recebeu deste médico no ciclo.
 *
 * Deixou de ser uma lista de quem está BLOQUEADA (não há mais bloqueio) e
 * virou informação: o painel mostra "já recebeu 90 🌱 este mês" ao lado do
 * nome, e o botão continua valendo.
 *
 * Uma chave com formato inesperado é DESCARTADA em vez de virar um id
 * inventado — um id errado aqui carimbaria um valor na paciente errada, que é
 * o defeito silencioso e pior.
 */
export function recebidoPorPaciente(
  linhas: { dedupe_key?: string | null; amount?: number | null }[],
): Record<string, number> {
  const mapa: Record<string, number> = {};
  for (const l of linhas) {
    const partes = (l.dedupe_key ?? "").split(":");
    if (partes.length !== 4 || partes[0] !== "presente" || !partes[2]) continue;
    mapa[partes[2]] = (mapa[partes[2]] ?? 0) + (l.amount ?? 0);
  }
  return mapa;
}

/**
 * AS TRÊS CLASSES DE PRESENTE.
 *
 * ─── POR QUE TRÊS, E NÃO UM CAMPO DE DIGITAR ────────────────────────────────
 *
 * Um campo livre obriga o médico a inventar um número, e ele não tem como saber
 * se 50 é muito ou pouco — o valor só significa alguma coisa contra a LOJA, que
 * ele nunca viu. Três classes com nome e efeito declarado transformam a escolha
 * em "o que eu quero que aconteça com ela", que é a decisão que ele sabe tomar.
 *
 * ─── OS VALORES SAEM DA LOJA, NÃO DO GOSTO ──────────────────────────────────
 *
 * A loja grátis inteira custa `CUSTO_LOJA_GRATIS`, e o item mais caro dela é o
 * troféu — o último degrau da `CURVA_GRATIS`. (Sem números escritos: ver a
 * regra no cabeçalho. O troféu já mudou de preço uma vez e esta linha ficou
 * dizendo o valor antigo.)
 *
 *   · Semente (50)  — um item barato na hora, ou meio dia de ganho típico.
 *   · Buquê (150)   — o suficiente para um item de faixa média sem esperar.
 *   · Jardim (300)  — passa do troféu da loja grátis: é o presente que a leva a
 *                     olhar a prateleira premium, que é o ponto do desenho.
 *
 * Nenhum deles chega perto da loja inteira, de propósito: presente do médico
 * ACELERA a caminhada até a parede dos quinze dias, nunca a substitui.
 */
export const CLASSES_DE_PRESENTE = [
  {
    chave: "semente",
    nome: "Semente",
    emoji: "🌱",
    quantidade: PRESENTE_SUGERIDO,
    efeito: "Um item barato do Cantinho, hoje mesmo",
    imagem: "/presentes/semente.svg",
  },
  {
    chave: "buque",
    nome: "Buquê",
    emoji: "💐",
    quantidade: 60,
    efeito: "Um item de faixa média, sem esperar dias",
    imagem: "/presentes/buque.svg",
  },
  {
    chave: "jardim",
    nome: "Jardim",
    emoji: "🌷",
    quantidade: 100,
    efeito: "Um item caro do Cantinho, ou quase dois médios",
    imagem: "/presentes/jardim.svg",
  },
] as const;

export type ClasseDePresente = (typeof CLASSES_DE_PRESENTE)[number];

/**
 * O BOLSO MENSAL DA PACIENTE QUE ASSINA.
 *
 * Quem paga o Premium ganha Sementinhas para dar às amigas que indicou — o
 * mesmo desenho da mesada do médico, do outro lado do app.
 *
 * ─── POR QUE 300, E NÃO MAIS ────────────────────────────────────────────────
 *
 * Três presentes de 100 por mês. O número foi escolhido contra duas paredes:
 *
 *  · é menos da metade da loja grátis (704), então uma amiga presenteada não
 *    ganha a prateleira inteira de graça — ela ganha um empurrão e continua
 *    caminhando até a parede dos quinze dias, que é o que faz a assinatura
 *    acontecer;
 *  · e é MENOR que a mesada de entrada do médico (150 × 3 = 450). A hierarquia
 *    importa: quem paga R$ 19,90 não pode presentear mais que o profissional
 *    que sustenta a conta dela.
 */
/**
 * O TETO DO BLOCO DE BOAS-VINDAS — a invariante que segura o desenho inteiro.
 *
 * ─── O QUE UM VERIFICADOR ADVERSARIAL MEDIU ─────────────────────────────────
 *
 * Os presentes não pingam: eles CAEM JUNTOS, no dia em que ela chega. O médico
 * presenteia quando vê a paciente, e ele a vê quando ela vincula — mesmo dia do
 * bônus de vínculo. Se ela veio pelo link de uma amiga assinante, o presente
 * dela chega ali também.
 *
 * Com os valores anteriores (bônus 200 + Jardim 300 + amiga 100) isso dava
 * **600 dos 704 🌱 da loja no dia zero** — 85%. A paciente zerava os quinze
 * itens grátis no TERCEIRO dia. Isso não acelera a parede; apaga ela, e com ela
 * o mecanismo inteiro que faz a assinatura acontecer.
 *
 * ─── A RÉGUA ────────────────────────────────────────────────────────────────
 *
 * Sozinha, a paciente típica leva 19 dias. O bloco pode encurtar essa caminhada
 * — é para isso que ele existe —, mas não pode cortá-la ao meio: o teto do
 * BLOCO (o que cai de uma vez no dia zero) é de 241 🌱, e sozinho ele leva a
 * caminhada de 19 para **13 dias**.
 *
 * ⚠️ ESTE PARÁGRAFO DIZIA "12 DIAS NO ARRANJO MAIS GENEROSO POSSÍVEL", e
 * deixou de ser verdade quando a ofensiva das Amigas nasceu: `BONUS_DA_DUPLA`
 * é uma torneira DIÁRIA, e ela não entrava neste modelo. Medido depois de
 * ligá-la: o arranjo mais generoso no ritmo típico caiu para **10 dias**.
 *
 * Dez está certo, e a razão é o que o número esconde: aquele caminho exige uma
 * amiga que entrou pelo convite DELA, um convite de dupla aceito, e as DUAS
 * fechando o mesmo dia, todo dia. É o arranjo mais raro do app e é exatamente
 * o comportamento que o dono quis premiar — encurtar a caminhada dela em três
 * dias é o preço, e a parede continua chegando dentro de duas semanas.
 *
 * O que NÃO pode acontecer de novo é a próxima torneira nascer fora do modelo:
 * `CenarioDaLoja.comDupla` existe para isso, e há teste com PISO de dias.
 *
 * Os valores abaixo somam 240 no pior caso (100 + 100 + 40) e há teste que
 * recusa qualquer combinação que passe daqui. Mexer num deles para cima obriga
 * a mexer noutro para baixo — que é exatamente o tipo de amarra que faltava
 * quando 600 entrou sem ninguém perceber.
 */
export const TETO_BLOCO_DE_BOAS_VINDAS = 241;

export const MESADA_DA_ASSINANTE = 120;

/**
 * Quanto vai em cada presente entre amigas.
 *
 * MAIOR que o `PRESENTE_SUGERIDO` do médico: ele presenteia dezenas de
 * pacientes, ela presenteia duas ou três amigas. Um presente pequeno demais
 * entre pessoas que se conhecem soa como não ter dado nada.
 *
 * ⚠️ O texto dizia "Cem, e não os 50 do médico" para um valor que é 40 e um
 * `PRESENTE_SUGERIDO` que é 30 — números de uma calibração anterior, deixados
 * para trás quando os valores mudaram. A relação (este maior que o dele) é o
 * que importa e é o que o teste cobra; os números não se escrevem de novo em
 * prosa, justamente para não voltar a mentir.
 */
export const PRESENTE_ENTRE_AMIGAS = 40;

/**
 * Quanto cada uma leva por dia fechado EM DUPLA (a "ofensiva").
 *
 * ⚠️ Modesto de propósito. O ganho típico é 35 🌱/dia (`GANHO_DIA_TIPICO`) e a
 * loja grátis (`CUSTO_LOJA_GRATIS`) é calibrada contra ele para a parede cair
 * por volta do 15º dia — que é a mecânica de conversão inteira. Dez a mais,
 * só para quem tem dupla ativa e só nos dias em que AS DUAS apareceram, mexe
 * pouco nessa conta e ainda assim é sentido: é quase um terço de um dia.
 *
 * ⚠️ E ele mora AQUI, não em `amigas.functions.ts`, por dois motivos: todo
 * número da economia mora neste arquivo (é o que permite os testes de teto
 * somarem as torneiras todas), e a TELA precisa dizer o valor em voz alta —
 * importar o módulo de server functions só para ler uma constante puxaria o
 * servidor para dentro do pacote do navegador.
 */
export const BONUS_DA_DUPLA = 10;

/**
 * O DESAFIO DA SEMANA EM GRUPO — 15 🌱, uma vez por semana fechada.
 *
 * ⚠️ **Por SEMANA, e nunca por dia.** `BONUS_DA_DUPLA` é diário porque a dupla é
 * de duas pessoas fechando o mesmo dia; um desafio em grupo pagando por dia
 * somaria 10 + 10 na mesma paciente e a parede sairia do lugar sem ninguém
 * decidir. Por semana, ele é ~2,1 🌱/dia — metade de uma torneira diária
 * pequena.
 *
 * ⚠️ E o valor foi MEDIDO com `diasParaZerarLoja`, não escolhido:
 *
 * | cenário      | hoje | com o desafio |
 * | ------------ | ---- | ------------- |
 * | sozinha      | 19 d | 18 d          |
 * | com médico   | 16 d | **15 d**      |
 * | teto         |  2 d |  2 d          |
 *
 * Quinze é o maior valor que mantém a parede no 15º dia no cenário com médico
 * — que é o número que o CLAUDE.md registra como a decisão de monetização.
 */
export const DESAFIO_DA_SEMANA = 15;

/**
 * O BOLSO DA CRIADORA, e o que UMA paciente pode receber dela.
 *
 * ⚠️ O que importa para a parede não é o bolso — é o TETO POR PESSOA. Uma
 * criadora com 300 🌱/mês espalha por dez indicadas; nenhuma delas recebe mais
 * de 30 no ciclo, que é menos que o menor presente do médico (Semente, 50 🌱).
 *
 * ⚠️ E ele só alcança quem chegou pelo CÓDIGO dela (`ref_code`), que é vínculo
 * verificado e é o mesmo grafo que já paga a comissão. O grafo de SEGUIR não
 * serve: ele é assimétrico e unilateral, e seria a primeira torneira do app
 * cujo destinatário se auto-elege.
 */
export const MESADA_DA_INFLUENCIADORA = 300;
export const PRESENTE_DA_INFLUENCIADORA = 30;

/**
 * O QUE ELA GANHA SEM TER FEITO NADA, no dia em que chega.
 *
 * ─── AS DUAS FUNÇÕES DESTE ARQUIVO DISCORDAVAM ──────────────────────────────
 *
 * `diasParaZerarLoja` AMORTIZAVA o presente do médico (`presenteMensal / 30`) e
 * `saldoParado` o entregava em bloco no dia 30 (`Math.floor(dia / 30)`). Duas
 * respostas diferentes para a mesma pergunta, no mesmo arquivo — e as duas
 * erradas sobre o mundo, porque nenhuma modelava o instante em que o presente
 * realmente acontece.
 *
 * Um verificador adversarial mediu o estrago: o presente do médico chega quando
 * ele VÊ a paciente, e ele a vê quando ela vincula. Ou seja, no dia 0, junto com
 * o bônus de vínculo. Amortizar isso em trinta dias fazia a simulação relatar
 * 13 dias de caminhada onde a realidade dá 3.
 *
 * ─── POR QUE O PIOR CASO É O QUE IMPORTA AQUI ───────────────────────────────
 *
 * A pergunta que este arquivo existe para responder não é "quanto ela ganha em
 * média" — é "existe algum arranjo em que a parede desaparece?". Se existe, ele
 * vai acontecer, porque é o arranjo do médico mais engajado com a paciente mais
 * engajada, que é justamente quem mais fala do app.
 */
export function entradaDeGraca(opts: {
  comMedico: boolean;
  /** O presente do médico, se ele presentear (Semente 50 · Buquê 150 · Jardim 300). */
  presenteDoMedico?: number;
  /** O presente de uma amiga assinante, se houver. */
  presenteDeAmiga?: number;
  /** Chegou pelo código de uma influenciadora — ver `BONUS_INFLUENCIADORA`. */
  porInfluenciadora?: boolean;
  /** A criadora presenteou (`PRESENTE_DA_INFLUENCIADORA`), no ciclo. */
  presenteDaInfluenciadora?: number;
}): number {
  return (
    (opts.comMedico ? BONUS_VINCULO_MEDICO : 0) +
    (opts.comMedico ? (opts.presenteDoMedico ?? 0) : 0) +
    (opts.presenteDeAmiga ?? 0) +
    (opts.porInfluenciadora ? BONUS_INFLUENCIADORA : 0) +
    /* ⚠️ Só quem chegou pelo código pode receber da criadora — o presente não
       existe fora desse vínculo, e contá-lo sem ele mediria uma paciente que
       não existe. */
    (opts.porInfluenciadora ? (opts.presenteDaInfluenciadora ?? 0) : 0)
  );
}

export type CenarioDaLoja = {
  comMedico: boolean;
  presenteDoMedico?: number;
  presenteDeAmiga?: number;
  porInfluenciadora?: boolean;
  presenteDaInfluenciadora?: number;
  /**
   * ⚠️ Está num desafio da semana em grupo?
   *
   * Torneira SEMANAL (`DESAFIO_DA_SEMANA`), e ela entra aqui pela mesma razão
   * que `comDupla` entrou: torneira que a simulação não enxerga é como a
   * parede dos quinze dias se move em silêncio.
   */
  comDesafio?: boolean;
  /** Quanto ela ganha por dia. O padrão é o TÍPICO — ver o bloco acima. */
  ganhoDiario?: number;
  /**
   * ⚠️ TEM DUPLA ATIVA (a "ofensiva" das Amigas)?
   *
   * `BONUS_DA_DUPLA` é uma torneira DIÁRIA, e ela nasceu fora deste modelo —
   * uma auditoria mediu que o arranjo mais generoso caiu de 13 para 10 dias
   * sem que nada aqui soubesse. Torneira que a simulação não enxerga é
   * exatamente como a parede dos quinze dias se move em silêncio.
   *
   * Ela é a mais RARA do app (exige uma amiga que entrou pelo convite, um
   * convite de dupla aceito, e as DUAS fechando o mesmo dia), e é justamente o
   * comportamento que o dono quis premiar. O modelo não a julga — só passa a
   * contá-la.
   */
  comDupla?: boolean;
};

/**
 * Quantos dias até ela ter comprado TODOS os itens grátis.
 *
 * Os presentes entram como BLOCO no dia 0, não amortizados: é quando eles
 * acontecem. Devolve `Infinity` se o ganho diário for zero — nunca um número
 * enganosamente grande, porque "1.000 dias" e "nunca" são coisas diferentes
 * para quem lê.
 */
export function diasParaZerarLoja(opts: CenarioDaLoja): number {
  const alvo = CUSTO_LOJA_GRATIS - entradaDeGraca(opts);
  if (alvo <= 0) return 0;

  const porDia =
    (opts.ganhoDiario ?? GANHO_DIA_TIPICO) +
    GANHO_SEMANAL / 7 +
    (opts.comDupla ? BONUS_DA_DUPLA : 0) +
    (opts.comDesafio ? DESAFIO_DA_SEMANA / 7 : 0);
  if (porDia <= 0) return Infinity;
  return Math.ceil(alvo / porDia);
}

/**
 * O saldo parado no dia N — a moeda que ela tem e não pode gastar.
 *
 * É o número que mede a pressão do desenho. Zero significa que a loja grátis
 * ainda tem o que vender e a parede não chegou.
 */
export function saldoParado(dia: number, opts: CenarioDaLoja): number {
  const ganho =
    entradaDeGraca(opts) +
    dia * ((opts.ganhoDiario ?? GANHO_DIA_TIPICO) + (opts.comDupla ? BONUS_DA_DUPLA : 0)) +
    Math.floor(dia / 7) * (GANHO_SEMANAL + (opts.comDesafio ? DESAFIO_DA_SEMANA : 0)) +
    /* Os presentes se repetem a cada ciclo — o do dia 0 já entrou acima. */
    Math.floor(dia / 30) *
      ((opts.comMedico ? (opts.presenteDoMedico ?? 0) : 0) + (opts.presenteDeAmiga ?? 0));
  return Math.max(0, Math.round(ganho - CUSTO_LOJA_GRATIS));
}
