/**
 * AS CONQUISTAS — a raridade não pode virar gosto, e a economia não pode virar
 * renda.
 *
 * Dois riscos moram aqui, e nenhum dos dois aparece olhando a tela:
 *
 *  1. RARIDADE ARBITRÁRIA. "Achei que essa é épica" não sobrevive à segunda
 *     pessoa que mexe no arquivo. O sintoma é a paciente ver duas conquistas de
 *     esforço parecido com molduras diferentes — e concluir, com razão, que o
 *     sistema é aleatório.
 *
 *  2. INFLAÇÃO. Cada conquista paga Sementinhas, e Sementinha compra item da
 *     loja. Vinte épicas acrescentadas de uma vez transformam a loja em
 *     brinde — e ninguém percebe até a paciente zerar tudo na primeira semana.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CONQUISTAS,
  RARIDADES,
  RARIDADES_EM_ORDEM,
  ATIVIDADES_DO_DIA,
  aulasRespondidas,
  conquistaPorChave,
  contarPorRaridade,
  diasDistintos,
  ehPosParto,
  maiorSequencia,
  orcamentoDasConquistas,
  sementinhasDaRaridade,
  vezesQueFez,
} from "./conquistas";
import { CUSTO_LOJA_GRATIS } from "./economia-sementinhas";

describe("o catálogo é coerente", () => {
  test("as chaves são únicas", () => {
    const ks = CONQUISTAS.map((c) => c.key);
    expect(new Set(ks).size).toBe(ks.length);
  });

  test("nenhum título ou descrição vazio", () => {
    for (const c of CONQUISTAS) {
      expect(c.title.length).toBeGreaterThan(2);
      expect(c.description.length).toBeGreaterThan(5);
      expect(c.emoji.length).toBeGreaterThan(0);
    }
  });

  test("cobre o app de hoje, e não só o de um ano atrás", () => {
    /* O buraco que este redesenho fechou: o app ganhou meditação, gratidão,
       cartas pro bebê, exercício por queixa e dias fechados, e NENHUM deles
       tinha conquista. Dava para meditar trinta dias seguidos sem a aba de
       conquistas saber que você existia. */
    const chaves = CONQUISTAS.map((c) => c.key).join(" ");
    for (const assunto of ["medita", "gratidao", "carta", "exercicio", "trofeu", "sequencia"]) {
      expect(chaves).toContain(assunto);
    }
  });

  test("são pelo menos 34", () => {
    expect(CONQUISTAS.length).toBeGreaterThanOrEqual(34);
  });

  test("`ehPosParto` só é verdade para as marcadas", () => {
    for (const c of CONQUISTAS) {
      expect(ehPosParto(c.key)).toBe(!!c.posParto);
    }
    expect(ehPosParto("chave-que-nao-existe")).toBe(false);
  });

  test("conquistaPorChave acha o que existe e não inventa o que não existe", () => {
    expect(conquistaPorChave("medita_10")?.raridade).toBe("raro");
    expect(conquistaPorChave("nao-existe")).toBeUndefined();
  });
});

describe("⚠️ a raridade tem régua, não gosto", () => {
  test("as três existem, com critério escrito", () => {
    expect(RARIDADES_EM_ORDEM).toEqual(["epico", "raro", "comum"]);
    for (const r of RARIDADES_EM_ORDEM) {
      expect(RARIDADES[r].criterio.length).toBeGreaterThan(30);
    }
  });

  test("as cores são as que o dono pediu: cinza, azul, dourado", () => {
    expect(RARIDADES.comum.anel).toContain("slate");
    expect(RARIDADES.raro.anel).toContain("sky");
    expect(RARIDADES.epico.anel).toContain("amber");
  });

  test("mais difícil paga mais — sempre, sem empate", () => {
    /* O pedido literal: "maior nível de dificuldade, mais sementes". Um empate
       aqui apagaria a diferença que a cor promete. */
    expect(RARIDADES.comum.sementinhas).toBeLessThan(RARIDADES.raro.sementinhas);
    expect(RARIDADES.raro.sementinhas).toBeLessThan(RARIDADES.epico.sementinhas);
  });

  test("⚠️ 'primeira vez' nunca é épica, e 'todos/30' nunca é comum", () => {
    /* A régua aplicada ao catálogo. Uma conquista de estreia que virasse épica
       pagaria 120 🌱 por abrir o app uma vez — e a paciente aprenderia que o
       dourado não quer dizer nada. */
    for (const c of CONQUISTAS) {
      const estreia =
        /^(first_|medita_1$|gratidao_1$|carta_1$|exercicio_1$|trofeu_1$|cantinho_1$)/.test(c.key);
      if (estreia) expect(c.raridade).toBe("comum");
    }
  });

  test("⚠️ o topo de cada escada é épico, e só o topo", () => {
    /* ─── ESTE TESTE JÁ ESTEVE ERRADO DUAS VEZES ────────────────────────────
       1ª versão: `_complete$` — pegava `profile_complete` junto e exigia que
          "preencher o perfil" fosse épica.
       2ª versão: `_(30|50)$` — passou a reprovar `aula_50` no dia em que a
          escada da aula ganhou um degrau acima dele (`course_complete`, 100).

       As duas falhavam pelo mesmo motivo: adivinhar dificuldade pelo NOME da
       chave. A régua de verdade é sobre a ESCADA — o degrau mais alto de cada
       assunto é o épico, e nenhum degrau abaixo dele pode ser. Escrever as
       escadas à mão custa cinco linhas e para de mentir quando um degrau
       novo entra. */
    const ESCADAS: Record<string, string[]> = {
      aula: ["first_course", "course_5", "aula_10", "aula_50", "course_complete"],
      meditacao: ["medita_1", "medita_10", "medita_30"],
      gratidao: ["gratidao_1", "gratidao_10", "gratidao_50"],
      carta: ["carta_1", "carta_10", "carta_30"],
      exercicio: ["exercicio_1", "exercicio_10", "exercicio_30"],
      trofeu: ["trofeu_1", "trofeu_10", "trofeu_30"],
      sequencia: ["sequencia_7", "sequencia_30"],
      cantinho: ["cantinho_1", "cantinho_10"],
    };
    /* ⚠️ A CHAVE ENTRA NO VALOR COMPARADO, e não numa mensagem de erro: o
       `expect` daqui (`src/types/bun-test.d.ts`) recebe UM argumento só, e sem
       isso um degrau errado falharia dizendo apenas `"raro" !== "epico"` — sem
       dizer QUAL dos 39. Comparar `"aula_50=raro"` com `"aula_50=epico"` diz
       tudo na primeira linha do erro. */
    for (const [assunto, degraus] of Object.entries(ESCADAS)) {
      for (const k of degraus) {
        expect(conquistaPorChave(k) ? k : `${assunto}: ${k} NÃO EXISTE`).toBe(k);
      }
      const topo = degraus[degraus.length - 1];
      const abaixo = degraus.slice(0, -1);
      /* O topo é épico — exceto nas escadas curtas (2 degraus), onde o topo
         ainda é repetição sustentada e não marco de meses. */
      if (degraus.length >= 3) {
        expect(`${topo}=${conquistaPorChave(topo)!.raridade}`).toBe(`${topo}=epico`);
      }
      for (const k of abaixo) {
        expect(`${k}=${conquistaPorChave(k)!.raridade}`).not.toBe(`${k}=epico`);
      }
    }
  });

  test("existe conquista das três raridades — nenhuma prateleira vazia", () => {
    const n = contarPorRaridade(CONQUISTAS);
    expect(n.comum).toBeGreaterThan(0);
    expect(n.raro).toBeGreaterThan(0);
    expect(n.epico).toBeGreaterThan(0);
  });

  test("épico é o mais raro dos três — senão a palavra não quer dizer nada", () => {
    const n = contarPorRaridade(CONQUISTAS);
    expect(n.epico).toBeLessThan(n.comum);
    expect(n.epico).toBeLessThanOrEqual(n.raro);
  });
});

describe("⚠️ a economia não vira renda", () => {
  const total = orcamentoDasConquistas(CONQUISTAS);

  test("desbloquear tudo paga menos que três lojas grátis", () => {
    /* A loja grátis custa 704 🌱 e some por volta do 15º dia. As conquistas
       levam MESES para completar — se elas sozinhas pagassem várias lojas, o
       jogo teria uma segunda moeda infinita e a primeira perderia o sentido.
       O número exato importa menos que o teto: ele existe para avisar no dia
       em que alguém acrescentar vinte épicas de uma vez. */
    expect(total).toBeLessThan(CUSTO_LOJA_GRATIS * 3);
  });

  test("mas paga o suficiente para valer a pena", () => {
    expect(total).toBeGreaterThan(CUSTO_LOJA_GRATIS);
  });

  test("o valor por raridade bate com a tabela", () => {
    expect(sementinhasDaRaridade("comum")).toBe(RARIDADES.comum.sementinhas);
    expect(sementinhasDaRaridade("epico")).toBe(RARIDADES.epico.sementinhas);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   A LEITURA DO LEDGER
   ══════════════════════════════════════════════════════════════════════════ */

const CICLO = "2026-03-07";
const OUTRO = "2025-01-01";

function chave(ativ: string, ciclo: string, dia: number) {
  return `wellness:${ativ}:${ciclo}:${dia}`;
}

describe("vezesQueFez", () => {
  test("conta os dias em que a atividade aconteceu", () => {
    const ks = [chave("meditation", CICLO, 10), chave("meditation", CICLO, 11)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(2);
  });

  test("a mesma atividade no mesmo dia conta UMA vez", () => {
    const ks = [chave("meditation", CICLO, 10), chave("meditation", CICLO, 10)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(1);
  });

  test("não mistura atividades", () => {
    const ks = [chave("meditation", CICLO, 10), chave("bonding", CICLO, 10)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(1);
    expect(vezesQueFez(ks, "bonding", CICLO)).toBe(1);
    expect(vezesQueFez(ks, "movement", CICLO)).toBe(0);
  });

  test("⚠️ NÃO conta a gestação anterior", () => {
    /* Sem o recorte por ciclo, a segunda gestação nasceria com as conquistas
       da primeira já dadas — e a jornada nova começaria sem nada a conquistar. */
    const ks = [chave("meditation", OUTRO, 10), chave("meditation", OUTRO, 11)];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(0);
  });

  test("lixo no ledger não conta", () => {
    const ks = [null, undefined, "", "wellness:", "outra-coisa:1:2:3", "wellness:meditation:c"];
    expect(vezesQueFez(ks, "meditation", CICLO)).toBe(0);
  });

  test("gasto na loja (dedupe_key nulo) não vira conquista", () => {
    expect(vezesQueFez([null, null, null], "meditation", CICLO)).toBe(0);
  });
});

describe("⚠️ diasDistintos — 'repetição sustentada' que se faz numa tarde", () => {
  test("dez registros no mesmo dia contam UM dia", () => {
    /* O defeito exato que isto conserta: `health_7_days` e `journal_10` são
       de raridade `raro` ("hábito custa semanas") e contavam LINHAS. Dava
       para fechá-las salvando dez vezes seguidas numa tarde. */
    const mesmaTarde = Array.from({ length: 10 }, (_, i) => `2026-03-07T1${i % 10}:00:00-03:00`);
    expect(diasDistintos(mesmaTarde)).toBe(1);
  });

  test("dias diferentes contam separado", () => {
    expect(diasDistintos(["2026-03-07T10:00:00-03:00", "2026-03-08T10:00:00-03:00"])).toBe(2);
  });

  test("⚠️ o dia é o de São Paulo, não o UTC", () => {
    /* 22h de Brasília é 01h do dia seguinte em UTC. Contando por UTC, dois
       registros da MESMA noite virariam dois dias — e a conquista de sete
       dias sairia em quatro noites. */
    const noite = "2026-03-07T22:00:00-03:00";
    const maisTarde = "2026-03-07T23:30:00-03:00";
    expect(diasDistintos([noite, maisTarde])).toBe(1);
  });

  test("nulo, vazio e data inválida não contam", () => {
    expect(diasDistintos([null, undefined, "", "nao-e-data"])).toBe(0);
  });

  test("lista vazia é zero", () => {
    expect(diasDistintos([])).toBe(0);
  });
});

describe("⚠️ as conquistas da Escola do Bebê apontam pra aula do dia", () => {
  test("as três chaves continuam existindo", () => {
    /* Elas liam `course_progress`, e o nó que abriria a Escola não é mais
       emitido pela trilha — eram três conquistas impossíveis, uma épica.
       As CHAVES ficam: apagá-las tiraria a medalha de quem já a tivesse, e o
       app não pode tirar de volta o que deu. */
    for (const k of ["first_course", "course_5", "course_complete"]) {
      expect(conquistaPorChave(k) ? k : `${k} sumiu`).toBe(k);
    }
  });

  test("e o texto delas não promete mais a Escola", () => {
    /* Descrição que fala de "módulos da Escola do Bebê" seria a mesma mentira
       com outra fonte de dados. */
    for (const k of ["first_course", "course_5", "course_complete"]) {
      const d = conquistaPorChave(k)!.description.toLowerCase();
      expect(d).not.toContain("módulo");
      expect(d).not.toContain("escola do bebê");
    }
  });

  test("a escada da aula tem UM épico só", () => {
    /* 1 · 5 · 10 · 50 · 100. Dois dourados na mesma escada fariam o dourado
       valer metade. */
    const escada = ["first_course", "course_5", "aula_10", "aula_50", "course_complete"];
    const epicos = escada.filter((k) => conquistaPorChave(k)?.raridade === "epico");
    expect(epicos).toEqual(["course_complete"]);
  });
});

describe("aulasRespondidas", () => {
  test("conta as do ciclo, sem repetir dia", () => {
    const ks = [`dailyquiz:${CICLO}:20`, `dailyquiz:${CICLO}:20`, `dailyquiz:${CICLO}:21`];
    expect(aulasRespondidas(ks, CICLO)).toBe(2);
  });

  test("ignora outro ciclo e outros prefixos", () => {
    const ks = [`dailyquiz:${OUTRO}:20`, chave("meditation", CICLO, 20)];
    expect(aulasRespondidas(ks, CICLO)).toBe(0);
  });
});

describe("maiorSequencia", () => {
  test("dias seguidos contam", () => {
    const ks = [10, 11, 12].map((d) => chave("meditation", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(3);
  });

  test("um buraco corta a sequência, e a MAIOR vence", () => {
    const ks = [10, 11, 20, 21, 22, 23].map((d) => chave("bonding", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(4);
  });

  test("atividades diferentes no mesmo dia não inflam", () => {
    const ks = [chave("meditation", CICLO, 5), chave("bonding", CICLO, 5)];
    expect(maiorSequencia(ks, CICLO)).toBe(1);
  });

  test("⚠️ é a MAIOR já feita, não a atual", () => {
    /* Conquista é marco: "você já conseguiu sete dias seguidos" é um fato que
       aconteceu. Tirá-la porque a sequência quebrou seria transformar
       conquista em cobrança — e este app não faz isso. A chama do Caminho
       continua mostrando a sequência atual; são perguntas diferentes. */
    const ks = [1, 2, 3, 4, 5, 6, 7, /* buraco */ 40].map((d) => chave("gratitude", CICLO, d));
    expect(maiorSequencia(ks, CICLO)).toBe(7);
  });

  test("sem nada, zero", () => {
    expect(maiorSequencia([], CICLO)).toBe(0);
  });

  test("atividade desconhecida não conta", () => {
    /* Se amanhã alguém gravar `wellness:banho:...`, o dia não passa a valer
       sequência por engano. */
    expect(maiorSequencia([chave("banho", CICLO, 5)], CICLO)).toBe(0);
  });

  test("as quatro atividades conhecidas são as do Caminho", () => {
    expect([...ATIVIDADES_DO_DIA].sort()).toEqual(
      ["bonding", "gratitude", "meditation", "movement"].sort(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   ⚠️ A CONQUISTA NÃO PAGA SOZINHA — ela espera o toque

   Pedido do dono, ago/2026: "a pessoa só vai pegar as sementinhas quando ela
   clicar em cima daquela conquista. Hoje é o que o Duolingo faz".

   O desbloqueio (linha em `patient_achievements`) e o pagamento (linha
   `achievement:<chave>` no ledger) eram a MESMA operação. Separá-los é o que
   transforma o prêmio num gesto dela — e é o gesto que faz abrir a aba, que é
   onde as outras 38 conquistas estão à vista.

   Estes testes leem a FONTE porque a régua mora nas server functions, e
   importá-las num teste puxaria o cliente do Supabase junto.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("⚠️ desbloquear e pagar são operações separadas", () => {
  const servidor = readFileSync("src/lib/achievements.functions.ts", "utf8");
  /* ⚠️ A ABA MUDOU DE CASA em set/2026 (`minha-conta.tsx` → componente
     próprio), e a garantia não mudou uma linha: o move foi verbatim,
     conferido por hash. Este teste seguia o ARQUIVO; segue a aba agora. */
  const tela = readFileSync("src/components/conquistas-tab.tsx", "utf8");

  /**
   * ⚠️ O CORPO DE `resgatarConquista`, e não "daqui até o fim do arquivo".
   *
   * A primeira versão destes testes fatiava `servidor.slice(indexOf(...))` sem
   * fim — a fatia ia até a última linha, então a PRÓXIMA função acrescentada
   * ao arquivo passaria a satisfazer os `toContain` sozinha. Um teste que
   * aprova pelo vizinho não testa nada.
   */
  const corpoDoResgate = (() => {
    const i = servidor.indexOf("export const resgatarConquista");
    const fim = servidor.indexOf("\nexport ", i + 10);
    return servidor.slice(i, fim === -1 ? servidor.length : fim);
  })();

  test("a checagem automática não monta mais prêmio de conquista", () => {
    /* Era `toAward.map(... dedupeKey: \`achievement:${key}\` ...)` alimentando
       `grants`. Se voltar, a conquista paga sozinha de novo e o botão de
       resgate vira decoração sobre um prêmio já dado. */
    expect(servidor).not.toMatch(/grants[^=]*=\s*toAward\.map/);
    expect(servidor).toContain(
      "const grants: { amount: number; reason: string; dedupeKey: string }[] = []",
    );
  });

  test("o resgate confere o DESBLOQUEIO antes de pagar", () => {
    /* Sem isto, qualquer chave no corpo do pedido viraria Sementinhas — o
       mesmo defeito que `contatoDaPaciente` teve no painel. */
    expect(corpoDoResgate).toContain('.from("patient_achievements")');
    expect(corpoDoResgate).toContain('.eq("achievement_key", data.key)');
    expect(corpoDoResgate).toContain("Essa conquista ainda não é sua");
  });

  test("⚠️ o resgate é idempotente — e a DEDUPE é conferida antes de gravar", () => {
    /**
     * Devolver erro no repetido faria ela tocar de novo achando que não
     * funcionou.
     *
     * ⚠️ E não basta a palavra "repetido" aparecer: uma mutação que APAGAVA a
     * conferência (`if (paga) return ...`) passava verde, porque o teste antigo
     * só procurava o texto `"repetido: true"` em algum lugar da função. Agora
     * a ORDEM é cobrada — conferir antes de pagar —, que é o que impede o
     * pagamento duplo.
     */
    expect(corpoDoResgate).toContain("repetido: true");
    const confere = corpoDoResgate.indexOf("if (paga) return");
    const paga = corpoDoResgate.indexOf("grantSementinhas(");
    expect(confere).toBeGreaterThan(-1);
    expect(paga).toBeGreaterThan(-1);
    expect(confere).toBeLessThan(paga);
  });

  test("⚠️ e o Modo Cuidado é conferido no resgate — SAINDO quando é verdade", () => {
    /**
     * ⚠️ A MUTAÇÃO MAIS GRAVE QUE JÁ PASSOU VERDE NESTA BASE foi inverter uma
     * condição destas: o app pagando Sementinhas SÓ para quem tinha perdido o
     * bebê. Este teste dizia cobrir exatamente essa pergunta e provava só que a
     * string `isCareModeActive` existia na função — a versão negada
     * (`if (!(await isCareModeActive(...)))`) passava.
     */
    expect(corpoDoResgate).toContain("if (await isCareModeActive(supabaseAdmin, uid)) {");
    expect(corpoDoResgate).not.toContain("!(await isCareModeActive");
  });

  test("⚠️ e nenhuma outra função voltou a montar prêmio de conquista", () => {
    /**
     * A regex de `grants = toAward.map` é estreita de propósito e uma mutação
     * escapou por ela: um `grants.push({ dedupeKey: \`achievement:...\` })` em
     * qualquer ponto do arquivo repõe o pagamento automático com outra forma.
     * O que importa é que o PREFIXO só seja escrito por quem resgata.
     */
    const foraDoResgate = servidor.replace(corpoDoResgate, "");
    expect(foraDoResgate).not.toContain("PREFIXO_CONQUISTA}${");
    expect(foraDoResgate).not.toMatch(/dedupeKey:\s*`achievement:/);
  });

  test("⚠️ falha ao LER o que já foi pago não vira «tudo por resgatar»", () => {
    /**
     * `chavesResgatadas` descartava o `error` e devolvia `[]`. Uma falha dessa
     * consulta fazia as 39 conquistas voltarem a pulsar "Resgatar +120 🌱": ela
     * tocava, o servidor respondia certíssimo (`repetido`), e o cartão virava
     * uma data — o app prometendo moeda e não entregando.
     *
     * É a direção insegura da mesma régua que `contarTrofeus` ("falha ao contar
     * RECUSA") e o lembrete de pré-consulta ("falha ao ler trata como já
     * respondeu") já aplicam: na dúvida, não prometer.
     */
    expect(servidor).toContain("if (error || !data) return null;");
    expect(tela).toContain("setSemSaberPagas(res.resgatadas == null)");
    expect(tela).toContain("isUnlocked && !semSaberPagas && !resgatadas.has(def.key)");
  });

  test("⚠️ a trava de duplo toque é por CARTÃO, não da grade inteira", () => {
    /* Era `if (resgatandoKey) return`: enquanto um cartão ia ao servidor, tocar
       em outro sumia em silêncio. Quem sai do Modo Cuidado, ou quem acumulou
       vários, encontra justamente uma grade com muitos pendentes. */
    expect(tela).toContain("if (resgatando.has(key)) return;");
  });

  test("⚠️ o caminho REPETIDO diz alguma coisa", () => {
    /* Todo o retorno visível vivia dentro de `if (r.granted > 0)`, então no
       repetido ela tocava um botão que prometia `+40 🌱` e a tela respondia com
       silêncio — que lê como app quebrado, não como "isso já era seu".
       Acontece de verdade com dois aparelhos abertos ao mesmo tempo. */
    expect(tela).toContain("if (r.repetido) toast(");
  });

  test("a tela não credita mais no ato do desbloqueio", () => {
    /* `triggerAchievementsCheck` creditava `sementinhasDaRaridade` de cada
       chave nova. Com o pagamento no toque, isso mostraria o saldo subindo por
       um prêmio que o servidor ainda não pagou — e ela chegaria à aba com o
       botão pedindo o mesmo número. */
    const trecho = tela.slice(
      tela.indexOf("function triggerAchievementsCheck"),
      tela.indexOf("function MinhaContaPage"),
    );
    expect(trecho).not.toContain("creditarSementinhas(ganho)");
    expect(trecho).not.toContain("sementinhasDaRaridade");
  });

  test("e o cartão pendente é alcançável pelo teclado", () => {
    /* Ele virou alvo de toque; num `div` sem `role`/`tabIndex` o teclado e o
       VoiceOver não chegam nele. */
    expect(tela).toContain('role={aResgatar ? "button" : undefined}');
    expect(tela).toContain("tabIndex={aResgatar ? 0 : undefined}");
  });
});
