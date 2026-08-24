/**
 * O BOLSO DA PACIENTE QUE ASSINA — e as torneiras que ele não pode abrir.
 *
 * ─── O QUE ESTÁ EM JOGO ─────────────────────────────────────────────────────
 *
 * Sementinha não custa dinheiro, então nenhum defeito aqui aparece na fatura.
 * O que ele quebra é a ECONOMIA: `economia-sementinhas.ts` calibra a loja
 * grátis para ser zerada por volta do 15º dia, e é essa parede — moeda no bolso
 * e nada grátis para comprar — que faz a assinatura acontecer.
 *
 * Moeda entrando de graça por fora derruba a parede em silêncio. Ninguém
 * reclama, nada dá erro, e a conversão some sem que exista um número mostrando
 * por quê. Por isso as travas daqui são de economia, não de segurança.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import {
  CUSTO_LOJA_GRATIS,
  MESADA_DA_ASSINANTE,
  PRESENTE_ENTRE_AMIGAS,
  PRESENTE_SUGERIDO,
  mesadaDoMedico,
} from "./economia-sementinhas";
import { ENTRADA_MENSAGENS } from "./planos-medico";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const fns = semComentarios("src/lib/mesada-paciente.functions.ts");
/* ⚠️ A TELA MUDOU DE ARQUIVO (ago/2026). Era `presentear-amigas.tsx`, um cartão
   dentro do Cantinho; hoje é a linha da amiga na aba Amigas, e o componente
   antigo foi APAGADO. Pedido do dono: "tem outro lugar que você também consegue
   dar sementinhas, mas a gente tem que tirar de onde está esse outro lugar. Vai
   ser agora somente nas amizades." */
const tela = semComentarios("src/components/amigas.tsx");
const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");

describe("1. o bolso não derruba a parede dos quinze dias", () => {
  test("uma amiga presenteada NÃO ganha a loja grátis inteira", () => {
    /* Se um presente pagasse os 704 🌱 da loja, a amiga pularia a caminhada e
       chegaria ao fim sem nunca ter sentido falta de nada — que é o oposto do
       que o desenho quer. */
    expect(PRESENTE_ENTRE_AMIGAS).toBeLessThan(CUSTO_LOJA_GRATIS);
  });

  test("nem o bolso INTEIRO, se ela desse tudo a uma só", () => {
    /* O servidor limita um presente por amiga por ciclo, mas a conta precisa
       fechar mesmo no pior arranjo imaginável. */
    expect(MESADA_DA_ASSINANTE).toBeLessThan(CUSTO_LOJA_GRATIS);
  });

  test("o bolso dá para poucas amigas, e isso é o desenho", () => {
    /* Três presentes. Um bolso que desse para vinte transformaria a assinante
       numa fonte de moeda para o app inteiro. */
    const quantas = Math.floor(MESADA_DA_ASSINANTE / PRESENTE_ENTRE_AMIGAS);
    expect(quantas).toBeGreaterThanOrEqual(2);
    expect(quantas).toBeLessThanOrEqual(4);
  });
});

describe("2. a hierarquia entre quem dá", () => {
  test("a assinante presenteia MENOS que o médico de entrada", () => {
    /**
     * Quem paga R$ 19,90 não pode distribuir mais que o profissional que
     * sustenta a conta dela. Se isso inverter, o presente do médico — que é o
     * argumento de venda do plano dele — vira o menor da tela.
     */
    expect(MESADA_DA_ASSINANTE).toBeLessThan(mesadaDoMedico(ENTRADA_MENSAGENS));
  });

  test("mas cada presente dela é MAIOR que o dele, e há razão", () => {
    /* Ele presenteia dezenas de pacientes; ela, duas ou três amigas. Um
       presente pequeno entre pessoas que se conhecem soa como não ter dado
       nada. */
    expect(PRESENTE_ENTRE_AMIGAS).toBeGreaterThan(PRESENTE_SUGERIDO);
  });
});

describe("3. as quatro travas do servidor", () => {
  test("só quem é amiga MESMO — pelos dois grafos, e por uma régua só", () => {
    /**
     * A conferência era `.eq("referred_by", uid)` escrita aqui dentro: quem EU
     * indiquei, e mais ninguém. Ela divergiu duas vezes da régua que o resto da
     * aba usa:
     *
     *  · o 🎁 aparecia para quem me TROUXE (grafo nos dois sentidos) e o
     *    servidor recusava com "vocês precisam estar conectadas" — falso;
     *  · e com o convite entre contas existentes, metade das amigas viraria
     *    amiga de segunda classe: na lista, impossível de presentear.
     *
     * Hoje é `saoAmigasParaPresente`, a MESMA régua do perfil, do Cantinho e da
     * dupla — que conhece os dois grafos e já recusa quem encerrou a amizade.
     */
    expect(fns).toContain("saoAmigasParaPresente(data.accessToken, data.amigaId)");
    expect(fns).toContain('error: "nao_indicada"');
    /* E a régua NÃO é reescrita aqui. */
    expect(fns).not.toContain('.eq("referred_by", uid)');
  });

  test("nunca a si mesma — seria uma torneira mensal", () => {
    /* Sem isto, o bolso do Premium vira saldo próprio todo mês, e a assinatura
       passa a se pagar em moeda. */
    expect(fns).toContain("data.amigaId === uid");
    expect(fns).toContain('error: "voce_mesma"');
  });

  test("o teto é conferido ANTES da escrita", () => {
    const i = fns.indexOf("export const presentearAmiga");
    const corpo = fns.slice(i);
    const checa = corpo.indexOf("mesada_esgotada");
    const grava = corpo.indexOf("grantSementinhas");
    expect(checa).toBeGreaterThan(-1);
    expect(checa).toBeLessThan(grava);
  });

  test("uma amiga por ciclo, com a chave carregando o mês", () => {
    expect(fns).toContain("`amiga:${uid}:${data.amigaId}:${ciclo}`");
  });

  test("e o livro-caixa NÃO é apagado para desfazer nada", () => {
    /* A migration diz, por escrito, "o saldo NUNCA zera, nada é deletado". A
       mesada do médico já tentou reverter com `.delete()` e o verificador
       mostrou que numa corrida isso apaga o presente ANTERIOR, já gasto. */
    expect(fns).not.toContain(".delete()");
  });
});

describe("4. o bolso só existe para quem assina", () => {
  test("sem Premium, não há bolso", () => {
    expect(fns).toContain('.select("quiz_premium")');
    expect(fns).toContain("SEM_BOLSO");
    expect(fns).toContain('error: "sem_premium"');
  });

  test("falha de leitura tira o bolso, nunca dá", () => {
    /* Errar para o lado de não presentear é chato; errar para o outro entrega
       o benefício do Premium a quem não assinou. */
    const i = fns.indexOf("export async function lerMesadaDaAmiga");
    const corpo = fns.slice(i, i + 900);
    expect(corpo).toContain("if (profErr || !prof?.quiz_premium) return SEM_BOLSO;");
  });

  test("e a leitura do gasto falhando zera o restante, não o enche", () => {
    const i = fns.indexOf("export async function lerMesadaDaAmiga");
    const corpo = fns.slice(i, i + 1600);
    expect(corpo).toContain("restante: 0");
  });
});

describe("5. Modo Cuidado vale para os dois lados", () => {
  test("quem RECEBE é conferido", () => {
    /* Presentear com moedinhas de decoração quem acabou de perder a gestação é
       o oposto do cuidado. */
    expect(fns).toContain("isCareModeActive(supabaseAdmin as never, data.amigaId)");
    expect(fns).toContain('error: "modo_cuidado"');
  });

  test("e a condição SAI quando é verdade, não o contrário", () => {
    /* A mutação mais grave que já passou verde nesta base foi inverter uma
       condição destas: o app pagava Sementinhas SÓ para quem tinha perdido o
       bebê. */
    expect(fns).not.toContain("!(await isCareModeActive");
  });
});

describe("6. a tela existe, e há UMA porta só", () => {
  test("a porta está montada na aba das Amigas", () => {
    /* `getMesada`/`presentearPaciente` do médico ficaram semanas sem chamador
       nenhum. Função sem botão é coluna gravada e nunca lida. */
    expect(tela).toContain("presentearAmiga");
    expect(tela).toContain("getMesadaDaAmiga");
  });

  test("⚠️ e ela é a ÚNICA — o Cantinho não presenteia mais ninguém", () => {
    /**
     * Pedido do dono, com todas as letras: "eu sei que tem outro lugar que
     * você também consegue dar sementinhas, mas a gente tem que tirar de onde
     * está esse outro lugar. Vai ser agora somente nas amizades."
     *
     * Duas portas para a mesma ação não é redundância inofensiva: a segunda
     * vivia dentro do Cantinho — a aba de COMPRAR enfeite para si —, então a
     * paciente encontrava a mecânica de presentear no lugar em que ela não
     * está pensando em amiga nenhuma. E o `presenteadas` de uma tela não sabia
     * do da outra: dar por uma e voltar pela outra mostrava o botão de novo,
     * para o servidor recusar.
     *
     * Este teste é o que impede a segunda porta de renascer em qualquer tela
     * que não seja a das Amigas.
     */
    expect(conta).not.toContain("PresentearAmigas");
    expect(conta).not.toContain("presentearAmiga");

    /* Varre o `src/` inteiro em vez de conferir só `minha-conta`: a porta que
       saiu pode renascer em qualquer tela, e o pedido foi "somente nas
       amizades", não "somente fora do Cantinho". */
    /* ⚠️ Comparação EXATA, nunca `endsWith("amigas.tsx")`. O caminho do arquivo
       que foi apagado é `components/presentear-amigas.tsx` — que termina em
       "amigas.tsx". Com o sufixo, a varredura era cega justamente para o nome
       da porta que ela existe para impedir de renascer. Provado: de
       ["components/amigas.tsx", "components/presentear-amigas.tsx",
        "components/minhas-amigas.tsx", "routes/amigas.tsx"] o filtro por
       sufixo deixava passar UMA. */
    const outras = readdirSync("src", { recursive: true, encoding: "utf8" })
      .filter((p) => p.endsWith(".tsx") && p !== "components/amigas.tsx")
      .filter((p) => semComentarios(`src/${p}`).includes("presentearAmiga"));
    expect(outras).toEqual([]);
  });

  test("⚠️ AS DUAS portas somem para quem não assina — não só a da lista", () => {
    /**
     * Um botão cinza com cadeado ensina que existe algo que ela não pode ter,
     * e a assinatura já tem vitrine própria — os itens do Cantinho.
     *
     * ⚠️ E são DUAS entradas: a linha da amiga e o botão dentro do perfil dela.
     * A versão anterior deste teste chamava-se "o botão some inteiro para quem
     * não assina" e provava só `mesada?.assinante && (` — enquanto o teste
     * vizinho afirmava, com `toBe(2)`, que existem duas. Ele sabia das duas e
     * cobrava uma: o botão verde de largura inteira do perfil não tinha portão
     * nenhum, e quem não assina o via e levava "o bolso é do Premium" do
     * servidor.
     */
    expect(tela).toContain("mesada?.assinante && a.possoPresentear && (");
    expect(tela).toContain("assinante && perfil.possoPresentear && (");
  });

  test("⚠️ e nenhuma das duas aparece em quem ela NÃO pode presentear", () => {
    /**
     * A lista é o grafo de indicação nos DOIS sentidos, mas `presentearAmiga`
     * só aceita quem ELA indicou (`.eq("referred_by", uid)`). Sem este portão,
     * a assinante que ENTROU pelo convite de alguém via o 🎁 na linha de quem a
     * trouxe, tocava, e recebia "Vocês precisam estar conectadas pelo convite"
     * — uma frase falsa, porque estão, só que pelo lado oposto. Atinge toda
     * paciente que chegou por indicação, que é o caminho que a aba promove.
     */
    const usos = [...tela.matchAll(/possoPresentear/g)];
    expect(usos.length).toBeGreaterThanOrEqual(2);
  });

  test("⚠️ «já presenteada» vem do LEDGER, não da memória da tela", () => {
    /**
     * A primeira versão guardava isso num `Set` do componente. Trocar de aba
     * desmonta `AmigasTab` e o `Set` zerava: os 🎁 voltavam ao normal para o
     * servidor recusar com `ja_presenteada` — exatamente o defeito que motivou
     * tirar a porta antiga do Cantinho, sobrevivendo dentro da porta nova.
     *
     * O `Set` continua existindo, e está certo: ele faz o ✓ aparecer no mesmo
     * instante do toque. O que não pode é ser a ÚNICA fonte.
     */
    expect(tela).toContain("a.jaPresenteada || presenteadas.has(a.id)");
    const servidor = semComentarios("src/lib/amigas.functions.ts");
    expect(servidor).toContain("presenteadasNoCiclo");
    expect(servidor).toContain("jaPresenteada:");
  });

  test("a recusa por Modo Cuidado NÃO conta nada sobre a amiga", () => {
    /**
     * ─── UMA MUTAÇÃO SOBREVIVEU AQUI, E ERA A PIOR DA NOITE ────────────────
     *
     * A frase era: "{nome} está passando por um momento delicado — o app não
     * envia presentes agora."
     *
     * Modo Cuidado é perda gestacional. Aquilo contava a UMA usuária a perda de
     * OUTRA, numa tela de presente, sem que ninguém tivesse escolhido contar —
     * e a amiga que lesse aquilo saberia exatamente o que aconteceu.
     *
     * Do lado do MÉDICO a frase explícita continua, e está certa: ele é o
     * obstetra dela, a informação é clínica e é dele por dever de ofício. Entre
     * amigas, não.
     *
     * O servidor precisa recusar; a tela não precisa explicar.
     */
    /* ⚠️ São DUAS entradas para presentear dentro da aba — a linha da amiga na
       lista e o botão dentro do perfil dela. As duas escrevem o próprio
       ternário de recusa, então as duas precisam ser conferidas: cobrar só a
       primeira deixaria a frase perigosa nascer livre na segunda. */
    const pontos = [...tela.matchAll(/r\.error === "modo_cuidado"/g)].map((m) => m.index!);
    expect(pontos.length).toBe(2);

    for (const i of pontos) {
      /* A janela do ramo, até o ternário seguinte. */
      const ramo = tela.slice(i, tela.indexOf('r.error === "nao_indicada"', i));

      /* Só o TEXTO que ela lê — a condição do ramo contém a palavra "cuidado"
         por construção, e cobrar isso seria o teste batendo no próprio andaime
         em vez de na frase. */
      const frase = (ramo.match(/"([^"]{15,})"/) ?? ["", ""])[1].toLowerCase();
      expect(frase.length).toBeGreaterThan(15);
      expect(ramo).not.toContain("amiga.nome");
      expect(ramo).not.toContain("perfil?.nome");
      for (const palavra of ["delicado", "momento", "perda", "luto", "gesta"]) {
        expect(frase).not.toContain(palavra);
      }
    }
  });

  test("mas o MÉDICO continua vendo o motivo — é informação clínica dele", () => {
    const painel = semComentarios("src/components/mesada-do-medico.tsx");
    expect(painel).toContain("Modo Cuidado");
  });

  test("cada recusa tem frase própria", () => {
    for (const motivo of ["ja_presenteada", "mesada_esgotada", "modo_cuidado", "nao_indicada"]) {
      expect(tela).toContain(motivo);
    }
  });

  test("o valor do presente vem da fonte única, não digitado", () => {
    expect(tela).toContain("PRESENTE_ENTRE_AMIGAS");
    expect(tela).not.toMatch(/\b100 Sementinhas\b/);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ QUEM GRAVA E QUEM LÊ TÊM DE CONCORDAR

   `presenteadasNoCiclo` (que decide se o 🎁 aparece) filtrava
   `.eq("user_id", eu)`. Mas a linha do presente é gravada com o `user_id` de
   quem RECEBE — `grantSementinhas(db, data.amigaId, …)`. Nenhuma linha casava:
   a função voltava sempre vazia, `jaPresenteada` era sempre `false`, e o 🎁
   reabilitava a cada visita para o servidor recusar com "você já presenteou
   Fulana neste mês".

   Era o defeito que a função foi escrita para consertar, reintroduzido pelo
   lado de dentro — e nenhum teste pegou, porque todos olhavam a EXISTÊNCIA da
   função, não a concordância entre os dois lados.

   A irmã `lerMesadaDaAmiga` sempre leu certo (não filtra `user_id`), então os
   dois leitores do mesmo dado discordavam entre si.
   ══════════════════════════════════════════════════════════════════════════ */
describe("7. o presente: quem grava e quem lê olham a mesma linha", () => {
  const amigasFns = semComentarios("src/lib/amigas.functions.ts");

  test("a linha é gravada na conta de QUEM RECEBE", () => {
    expect(fns).toContain("grantSementinhas(typedDb(supabaseAdmin as never), data.amigaId, [");
  });

  test("⚠️ e o leitor do 🎁 NÃO filtra por quem dá", () => {
    const i = amigasFns.indexOf("async function presenteadasNoCiclo");
    const corpo = amigasFns.slice(i, amigasFns.indexOf("\n}", i + 10));
    expect(corpo).toContain('.like("dedupe_key", `${prefixo}%`)');
    expect(corpo).not.toContain('.eq("user_id", eu)');
  });

  test("o recorte é o PREFIXO, que já carrega o id de quem deu", () => {
    /* `amiga:<eu>:<amiga>:<ciclo>` — sem o prefixo, a função leria os
       presentes que TODO MUNDO deu, e o 🎁 sumiria para uma amiga que outra
       pessoa presenteou. */
    expect(amigasFns).toContain("const prefixo = `amiga:${eu}:`;");
  });

  test("e o outro leitor do mesmo dado concorda", () => {
    /* `lerMesadaDaAmiga` soma o GASTO do ciclo e sempre leu certo. Se um dia
       alguém "consertar" um dos dois isolado, eles divergem de novo. */
    const i = fns.indexOf("export async function lerMesadaDaAmiga");
    const corpo = fns.slice(i, i + 1200);
    expect(corpo).toContain('.like("dedupe_key", `amiga:${uid}:%`)');
    expect(corpo).not.toContain('.eq("user_id", uid)');
  });
});
