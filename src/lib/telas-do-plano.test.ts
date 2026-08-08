/**
 * AS TELAS QUE VENDEM O PLANO E DÃO A MESADA.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * Duas telas nasceram nesta rodada — o seletor da escada e o cartão da mesada —
 * e as duas substituíram telas que estavam ERRADAS, não ausentes:
 *
 *   · o painel vendia cinco planos nomeados, com teto de PACIENTES, mandando
 *     nomes de plano que o checkout novo não conhece;
 *   · e oferecia convites de Premium, que dão a assinatura inteira de graça e
 *     não funcionam dentro do iOS nem do Android.
 *
 * O risco de uma substituição é sempre o mesmo: a tela nova entra e um pedaço
 * da velha fica. É isso que se cobra aqui.
 *
 * O outro risco é o de sempre nesta base: DUAS TABELAS DE PREÇO. O seletor
 * mostra o preço antes do Stripe existir na conversa, então ele precisa
 * perguntar à mesma função que o checkout usa — nunca multiplicar por conta.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  BONUS_VINCULO_MEDICO,
  CLASSES_DE_PRESENTE,
  CUSTO_LOJA_GRATIS,
  PRESENTE_ENTRE_AMIGAS,
  PRESENTE_SUGERIDO,
  TETO_BLOCO_DE_BOAS_VINDAS,
  diasParaZerarLoja,
} from "./economia-sementinhas";
import {
  DEGRAUS,
  DEGRAUS_DESTAQUE,
  ENTRADA_MENSAGENS,
  TETO_AUTOATENDIMENTO,
  centavosPorMensagem,
  precoDe,
} from "./planos-medico";
import { MINUTOS_PADRAO, tempoPoupado } from "./tempo-poupado";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const seletor = semComentarios("src/components/escada-mensagens.tsx");
const mesada = semComentarios("src/components/mesada-do-medico.tsx");
const painel = semComentarios("src/routes/_authenticated/painel.tsx");
const vendas = semComentarios("src/routes/medicos.tsx");

describe("1. o seletor NÃO tem uma segunda tabela de preços", () => {
  test("pergunta à escada em vez de multiplicar", () => {
    for (const fn of [
      "precoDe(",
      "centavosPorMensagem(",
      "descontoVsEntrada(",
      "gestantesAtendidas(",
    ]) {
      expect(seletor).toContain(fn);
    }
  });

  test("nenhum preço de mensagem escrito à mão", () => {
    /* A asserção que descreve o defeito: um `n * 0.15` aqui é a segunda tabela,
       e é assim que a tela e a fatura divergem. Esta base já viu quatro vezes. */
    expect(seletor).not.toMatch(/\*\s*0[.,]\d{2}\b/);
    expect(seletor).not.toMatch(/\b(?:29[.,]90|174[.,]40|339[.,]40)\b/);
  });

  test("a faixa do slider é a da escada, não literais", () => {
    expect(seletor).toContain("min={ENTRADA_MENSAGENS}");
    expect(seletor).toContain("max={TETO_AUTOATENDIMENTO}");
  });
});

describe("1c. o preço por mensagem NUNCA mostra menos do que a fatura cobra", () => {
  /**
   * Achado de um verificador adversarial. A tela imprimia o unitário em reais
   * com DUAS casas e `Math.round`:
   *
   *  · degraus vizinhos colidiam — 300 e 500 mostravam os dois "R$ 0,19";
   *    1.750 e 2.000, os dois "R$ 0,15". Arrastar mudava o total e deixava
   *    parado justamente o número que mostra o desconto acontecendo;
   *  · e em 21 das 48 posições ele mostrava MENOS do que a fatura implica. Em
   *    2.100 mensagens: "R$ 0,14" × 2.100 = R$ 294,00 contra R$ 303,40 cobrados.
   *
   * É a mesma propaganda enganosa que `descontoVsEntrada` evita com `floor` —
   * aqui o sentido seguro é o oposto, porque o número é PREÇO e não desconto.
   */
  const mostrado = (centavos: number) => Math.ceil(centavos * 100) / 100;

  test("nenhuma das 48 posições do slider subestima", () => {
    for (let n = ENTRADA_MENSAGENS; n <= TETO_AUTOATENDIMENTO; n += 50) {
      expect(mostrado(centavosPorMensagem(n))).toBeGreaterThanOrEqual(centavosPorMensagem(n));
    }
  });

  test("e o total implícito pelo unitário nunca fica abaixo da fatura", () => {
    /* A conta que a paciente do médico — ou ele — faria de cabeça. */
    for (let n = ENTRADA_MENSAGENS; n <= TETO_AUTOATENDIMENTO; n += 50) {
      expect(mostrado(centavosPorMensagem(n)) * n).toBeGreaterThanOrEqual(precoDe(n));
    }
  });

  test("os DEZ degraus mostram números diferentes entre si", () => {
    /* Um unitário parado enquanto o total sobe faz o desconto parecer
       inexistente. Nos degraus — que é o que a tabela e os cartões mostram —
       nenhum pode repetir. */
    const vistos = new Set(DEGRAUS.map((d) => mostrado(centavosPorMensagem(d))));
    expect(vistos.size).toBe(DEGRAUS.length);
  });

  test("e o slider quase nunca fica parado ao ser arrastado", () => {
    /* Com uma casa decimal, as 220 posições colapsavam em 74 valores. Com duas,
       quase toda posição tem o seu. */
    const posicoes: number[] = [];
    for (let n = ENTRADA_MENSAGENS; n <= TETO_AUTOATENDIMENTO; n += 50) {
      posicoes.push(mostrado(centavosPorMensagem(n)));
    }
    const distintos = new Set(posicoes).size;
    expect(distintos / posicoes.length).toBeGreaterThan(0.85);
  });

  test("a tela usa `ceil`, não `round`", () => {
    expect(seletor).toContain("Math.ceil(centavos * 100) / 100");
    expect(seletor).not.toContain("Math.round(dados.porMensagem");
  });
});

describe("2. o seletor é operável sem mouse", () => {
  /**
   * A barra bonita é desenho; o controle é um `input type=range`. Trocá-lo por
   * divs com `onPointerMove` daria a mesma imagem e tiraria teclado e leitor de
   * tela de quem depende deles — numa tela que decide uma compra.
   */
  test("o controle é um range nativo", () => {
    expect(seletor).toContain('type="range"');
    expect(seletor).toContain("aria-label=");
  });

  test("e anuncia o valor em palavras, não só o número", () => {
    /* Sem `aria-valuetext`, o leitor de tela lê "1000" e a pessoa não sabe se
       são reais ou mensagens — nem quanto vai pagar. */
    expect(seletor).toContain("aria-valuetext=");
  });

  test("o foco é visível em TODOS os navegadores", () => {
    /* O `focus:outline-none` removia o contorno nativo e o anel de substituição
       existia só no polegar do WebKit — no Firefox a barra recebia foco sem
       nenhum sinal na tela, numa tela que decide uma compra. */
    expect(seletor).not.toContain("focus:outline-none");
    expect(seletor).toContain("focus-visible:outline-2");
  });

  test("o número que rola não parte de um valor vencido", () => {
    /* O cleanup gravava `mostrado` — a variável capturada no render em que o
       efeito nasceu, não o valor que a animação alcançou. Arrastar rápido dava
       um solavanco de número andando para os dois lados. */
    expect(seletor).toContain("anterior.current = agoraMostrado");
    const i = seletor.indexOf("return () => {");
    expect(seletor.slice(i, i + 400)).not.toContain("anterior.current = mostrado");
  });

  test("respeita quem pediu menos movimento", () => {
    expect(seletor).toContain("useReducedMotion");
    /* E não só no enfeite: o número que rola precisa virar troca instantânea. */
    const i = seletor.indexOf("function NumeroQueRola");
    expect(seletor.slice(i, i + 500)).toContain("if (reduce)");
  });
});

describe("3. o painel deixou de vender o que não existe", () => {
  test("os cinco cartões nomeados saíram", () => {
    /* A asserção que descreve o defeito: eles mandavam `plan: "starter"` etc.,
       e o `priceIdFor` do plano novo não conhece esses nomes. */
    expect(painel).not.toContain("const PlanBtn = (");
    for (const morto of [
      'planKey="starter"',
      'planKey="pro"',
      'planKey="elite"',
      'planKey="black"',
    ]) {
      expect(painel).not.toContain(morto);
    }
  });

  test("e o alternador Mensal/Anual também", () => {
    /* A escada tem um Price MENSAL só. O botão "Anual · 2 meses grátis" mandava
       `..._annual`, o `priceIdFor` devolvia `null` e o médico clicava sem que
       nada acontecesse — um botão que não faz nada é pior que um botão ausente. */
    expect(painel).not.toContain("Anual · 2 meses grátis");
    expect(painel).not.toContain('setCycle("annual")');
  });

  test("o checkout do painel manda MENSAGENS, não nome de plano", () => {
    const i = painel.indexOf("async function checkout(");
    expect(i).toBeGreaterThan(-1);
    const corpo = painel.slice(i, i + 1400);
    expect(corpo).toContain("mensagens");
    expect(corpo).toContain('plan: "mensagens"');
  });

  test("e o seletor é o MESMO componente do site", () => {
    /* Duas telas para a mesma compra é o começo de duas contas para o mesmo
       preço. O tema muda; a conta, não. */
    expect(painel).toContain("EscadaDeMensagens");
    expect(vendas).toContain("EscadaDeMensagens");
    expect(painel).toContain('tema="claro"');
  });
});

describe("4. os cartões da página de vendas saem da escada", () => {
  test("os preços são derivados, não digitados", () => {
    expect(vendas).toContain("monthly: reais(precoDe(");
    expect(vendas).toContain("DEGRAUS_DESTAQUE");
  });

  test("e batem com a escada nos três degraus", () => {
    /* Se um dia alguém digitar um número aqui, é este teste que percebe. */
    const [entrada, meio, topo] = DEGRAUS_DESTAQUE;
    expect(precoDe(entrada)).toBe(2_990);
    expect(precoDe(meio)).toBe(18_711);
    expect(precoDe(topo)).toBe(99_900);
    expect(topo).toBe(TETO_AUTOATENDIMENTO);
  });

  test("cada cartão pago carrega a própria quantidade para o cadastro", () => {
    /* Sem isto os três botões caem no mesmo cadastro sem número, e o degrau
       que a pessoa escolheu se perde entre a vitrine e o checkout. */
    expect(vendas).toContain("/medicos/cadastro?mensagens=");
  });
});

describe("4b. a quantidade escolhida no site NÃO se perde no caminho", () => {
  /**
   * O seletor manda `/medicos/cadastro?mensagens=1500`. Um parâmetro de URL que
   * ninguém lê é exatamente a promessa morta que este projeto passou a noite
   * removendo — e esta eu criei sozinho, ao ligar o botão antes de existir quem
   * o escutasse.
   *
   * Entre a escolha e a compra há um cadastro, um e-mail de confirmação e às
   * vezes um desvio pelo Google. Por isso o número espera no `localStorage`, e
   * não no estado da rota.
   */
  const cadastro = semComentarios("src/routes/medicos_.cadastro.tsx");

  test("o cadastro LÊ o parâmetro e guarda", () => {
    expect(cadastro).toContain('new URLSearchParams(window.location.search).get("mensagens")');
    expect(cadastro).toContain("localStorage.setItem(MENSAGENS_ESCOLHIDAS");
  });

  test("e o seletor abre nela", () => {
    expect(seletor).toContain("localStorage.getItem(MENSAGENS_ESCOLHIDAS)");
  });

  test("mas a leitura é num efeito, NUNCA no primeiro render", () => {
    /* A `/medicos` é renderizada no servidor. Ler `localStorage` no
       inicializador do estado monta uma árvore diferente da que veio de lá —
       hidratação divergente, que no pior caso remonta a seção inteira. */
    const i = seletor.indexOf("const [mensagens, setMensagens]");
    expect(seletor.slice(i, i + 120)).toContain("useState(PADRAO_MENSAGENS)");
    expect(seletor).toContain("setMensagens(Math.round(n / PASSO) * PASSO)");
  });

  test("a chave é uma constante compartilhada, não uma string solta", () => {
    /* Duas strings iguais em dois arquivos divergem por uma letra, um dia, e
       ninguém descobre: o número simplesmente para de chegar. */
    expect(cadastro).toContain("MENSAGENS_ESCOLHIDAS");
    expect(seletor).toContain("MENSAGENS_ESCOLHIDAS");
  });

  test("e o valor guardado é conferido contra a escada ao ser lido", () => {
    /* `localStorage` é do navegador dele e qualquer um edita. Um 99.999 ali
       abriria a barra fora da faixa e mandaria ao checkout uma quantidade que o
       servidor recusa — o botão levaria a um erro. */
    expect(seletor).toContain("n >= ENTRADA_MENSAGENS && n <= TETO_AUTOATENDIMENTO");
  });
});

describe("4c. a página de vendas conta a verdade sobre o Free", () => {
  /**
   * O Free deixou de ser "o teste com 5 pacientes" e virou a plataforma de
   * gestão inteira. Uma página que ainda o descreve como básico afasta
   * exatamente quem ele existe para atrair.
   */
  test("o cartão do Free diz PACIENTES ILIMITADAS", () => {
    const i = vendas.indexOf('key: "free"');
    const cartao = vendas.slice(i, vendas.indexOf("cta:", i));
    expect(cartao).toContain("ILIMITADAS");
  });

  test("e não se vende como 'básico'", () => {
    const i = vendas.indexOf('key: "free"');
    const cartao = vendas.slice(i, vendas.indexOf("cta:", i));
    expect(cartao).not.toContain("básica");
    expect(cartao).not.toContain("Até 5 pacientes");
  });

  test("nenhum cartão pago vende ferramentas clínicas como diferencial", () => {
    /* Elas estão no Free também — e um diferencial que todos têm é uma
       promessa que o comprador confere e descobre falsa. */
    expect(vendas).not.toContain("Ferramentas clínicas avançadas (biometria");
  });

  test("o FAQ não cita degraus nem preços que não existem mais", () => {
    for (const morto of ["até 2.500", "R$ 0,12 no topo", "Free até 5"]) {
      expect(vendas).not.toContain(morto);
    }
  });
});

describe("5. a mesada tem tela — e a tela conta a mesma história do servidor", () => {
  /**
   * `getMesada` e `presentearPaciente` estavam escritas, testadas e sem NENHUM
   * chamador. Mesada sem botão é coluna gravada e nunca lida.
   */
  test("o cartão chama as duas funções", () => {
    expect(mesada).toContain("getMesada");
    expect(mesada).toContain("presentearPaciente");
    expect(painel).toContain("<MesadaDoMedico");
  });

  test("o cartão de convites premium SAIU", () => {
    /* Ele dava a assinatura inteira de graça, e não funcionava nos apps. */
    expect(painel).not.toContain("function DoctorInviteCard(");
    expect(painel).not.toContain("<DoctorInviteCard");
  });

  test("cada recusa do servidor tem frase própria na tela", () => {
    /* "Não foi possível" faz o médico tentar de novo contra uma parede que não
       vai ceder — e três dessas recusas são estados normais, não erros. */
    for (const motivo of ["ja_presenteada", "mesada_esgotada", "modo_cuidado", "sem_vinculo"]) {
      expect(mesada).toContain(motivo);
    }
  });

  test("Modo Cuidado aparece como explicação, não como falha", () => {
    expect(mesada).toContain("Modo Cuidado");
  });

  test("o cartão some para quem não tem bolso", () => {
    /* Médico no Free não tem o que dar, e mostrar "0 de 0" só ensina que existe
       algo que ele não pode usar. */
    expect(mesada).toContain("mesada.total <= 0) return null");
  });
});

describe("6. as três classes de presente são calibradas contra a LOJA", () => {
  test("são três, em ordem crescente", () => {
    expect(CLASSES_DE_PRESENTE).toHaveLength(3);
    for (let i = 1; i < CLASSES_DE_PRESENTE.length; i++) {
      expect(CLASSES_DE_PRESENTE[i].quantidade).toBeGreaterThan(
        CLASSES_DE_PRESENTE[i - 1].quantidade,
      );
    }
  });

  test("a menor é o presente sugerido", () => {
    expect(CLASSES_DE_PRESENTE[0].quantidade).toBe(PRESENTE_SUGERIDO);
  });

  test("nenhuma delas paga a loja grátis inteira", () => {
    /**
     * O desenho inteiro depende disto. O presente do médico ACELERA a caminhada
     * até a parede dos quinze dias — o momento em que ela tem moeda sobrando e
     * nada grátis para comprar. Um presente que pagasse a loja toda de uma vez
     * derrubaria a parede em vez de aproximá-la.
     */
    for (const c of CLASSES_DE_PRESENTE) {
      expect(c.quantidade).toBeLessThan(CUSTO_LOJA_GRATIS);
    }
  });

  test("e a maior cabe no TETO do bloco de boas-vindas", () => {
    /**
     * A régua mudou, e a antiga estava errada.
     *
     * Eu tinha calibrado o Jardim para "passar do troféu de 200 🌱 da loja
     * grátis" — raciocínio meu, não seu. Um verificador adversarial mostrou o
     * custo: bônus 200 + Jardim 300 + presente de amiga 100 caem JUNTOS no dia
     * em que ela chega, e isso entregava 600 dos 704 🌱 da loja. Ela zerava os
     * quinze itens no terceiro dia.
     *
     * A régua certa não é o troféu — é o bloco somado. Ver
     * `TETO_BLOCO_DE_BOAS_VINDAS`.
     */
    const maior = Math.max(...CLASSES_DE_PRESENTE.map((c) => c.quantidade));
    const bloco = BONUS_VINCULO_MEDICO + maior + PRESENTE_ENTRE_AMIGAS;
    expect(bloco).toBeLessThanOrEqual(TETO_BLOCO_DE_BOAS_VINDAS);
  });

  test("o arranjo MAIS generoso ainda deixa doze dias de caminhada", () => {
    /* É a invariante escrita em números, e é ela que impede um valor subir
       sozinho: mexer num obriga a mexer noutro. */
    const maior = Math.max(...CLASSES_DE_PRESENTE.map((c) => c.quantidade));
    const dias = diasParaZerarLoja({
      comMedico: true,
      presenteDoMedico: maior,
      presenteDeAmiga: PRESENTE_ENTRE_AMIGAS,
    });
    expect(dias).toBeGreaterThanOrEqual(12);
  });

  test("toda classe tem nome, emoji e efeito declarado", () => {
    /* Um número solto obriga o médico a adivinhar o que 150 significa contra
       uma loja que ele nunca viu. */
    for (const c of CLASSES_DE_PRESENTE) {
      expect(c.nome.length).toBeGreaterThan(2);
      expect(c.emoji.length).toBeGreaterThan(0);
      expect(c.efeito.length).toBeGreaterThan(10);
    }
  });
});

describe("as horas do slider saem da mesma régua do painel", () => {
  /**
   * Pedido do dono (ago/2026): junto dos centavos, o slider mostra quanto TEMPO
   * volta para o médico — e sobe gradualmente, do mesmo jeito que o desconto.
   *
   * O risco não é a feature: é a conta. `tempo-poupado.ts` já decide isso no
   * painel, com regras que custaram discussão — mediana e não média,
   * arredondamento sempre para baixo, e a recusa deliberada de converter horas
   * em "dias de consultório" (consulta é a renda dele; dizer que economizou
   * seis dias de consultório é dizer que faturou menos).
   *
   * Escrever `mensagens * 3` na tela do slider recriaria tudo isso do zero,
   * errado, e num lugar onde o número é uma PROMESSA de venda. Estas asserções
   * cobram que a tela chame a régua em vez de reinventá-la.
   */
  const slider = readFileSync("src/components/escada-mensagens.tsx", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  test("a tela chama `tempoPoupado`, não multiplica por conta própria", () => {
    expect(slider).toContain("tempoPoupado(mensagens, MINUTOS_PADRAO)");
    /* Nenhum "× 3 minutos" disfarçado, e nenhum minuto digitado: o 3 tem de
       vir de `MINUTOS_PADRAO`. (Não dá para cobrar "/ 60" aqui — a classe
       `text-white/60` do Tailwind casa com qualquer regex de divisão.) */
    expect(slider).not.toMatch(/mensagens\s*\*\s*\d+/);
    expect(slider).not.toMatch(/\b3 min por resposta/);
  });

  test("e sobe junto com a escada — nunca desce quando ele arrasta para cima", () => {
    /* "Gradual" é o pedido; monotônico é o que torna o pedido verificável. */
    const minutos = DEGRAUS.map((d) => d * MINUTOS_PADRAO);
    for (let i = 1; i < minutos.length; i++) {
      expect(minutos[i]).toBeGreaterThan(minutos[i - 1]);
    }
  });

  test("no topo da escada, a promessa é grande — e é a conta conservadora", () => {
    /**
     * 11.100 mensagens a 3 min dão 555 horas. É um número enorme, e é
     * exatamente por isso que ele não pode sair de um palpite: `MINUTOS_PADRAO`
     * é o piso do módulo, o mesmo que o painel usa para quem ainda não tem
     * resposta escrita para medir.
     */
    expect(tempoPoupado(TETO_AUTOATENDIMENTO, MINUTOS_PADRAO)).toBe("555 horas");
    expect(tempoPoupado(ENTRADA_MENSAGENS, MINUTOS_PADRAO)).toBe("7h30");
  });

  test("o selo que não respondia ao slider saiu", () => {
    /* "Teto de pacientes: nenhum" era o único dos três que mostrava a mesma
       coisa em qualquer posição — e a frase já aparece acima, no resumo. */
    expect(slider).not.toContain("Teto de pacientes");
    expect(slider).toContain("pacientes ilimitadas");
  });
});
