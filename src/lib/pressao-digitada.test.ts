/**
 * "12 POR 8" DERRUBAVA A TRIAGEM INTEIRA.
 *
 * ⚠️ É como se fala pressão no Brasil — ninguém diz "cento e vinte por
 * oitenta". A triagem tem dois campos opcionais, e o validador do servidor
 * exige os pisos clínicos (`systolic >= 50`, `diastolic >= 30`), que existem
 * porque uma sistólica de 12 mmHg é incompatível com a vida. Ela digitava 12 e
 * 8, o `zod` LANÇAVA, e o `catch` de fora respondia "Não foi possível avaliar
 * os sintomas".
 *
 * ⚠️ **E o custo não era o número perdido — era a TRIAGEM perdida.** Ela podia
 * ter marcado "sangramento" e "dor de cabeça forte que não passa", dois dos
 * nove sintomas VERMELHOS, e receber uma tela de erro genérica no lugar da
 * orientação. Um campo OPCIONAL mal preenchido não pode destruir o que não
 * depende dele.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { lerPressaoDigitada } from "@/lib/pressao-digitada";

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

describe("a escala falada é entendida, e dita em voz alta", () => {
  test('"12" e "8" viram 120/80, marcados como interpretados', () => {
    expect(lerPressaoDigitada("12", "8")).toEqual({
      systolic: 120,
      diastolic: 80,
      interpretada: true,
    });
  });

  test('"12,5" e "8,5" também — a vírgula é a de cá', () => {
    expect(lerPressaoDigitada("12,5", "8,5")).toEqual({
      systolic: 125,
      diastolic: 85,
      interpretada: true,
    });
  });

  test('"12/8" e "12 por 8" no PRIMEIRO campo, com o segundo vazio', () => {
    /* Numa caixa estreita ao lado de uma barra, escrever a fração toda é o erro
       mais natural do mundo — e `Number("12/8")` é NaN, a mesma tela de erro. */
    for (const escrito of ["12/8", "12 por 8", "12x8", "120/80"]) {
      const r = lerPressaoDigitada(escrito, "");
      expect(r).not.toBeNull();
      expect(r!.systolic).toBe(120);
      expect(r!.diastolic).toBe(80);
    }
  });

  test("uma leitura já em mmHg passa intacta, e NÃO é marcada", () => {
    expect(lerPressaoDigitada("165", "105")).toEqual({
      systolic: 165,
      diastolic: 105,
      interpretada: false,
    });
    expect(lerPressaoDigitada(" 90 ", " 60 ")).toEqual({
      systolic: 90,
      diastolic: 60,
      interpretada: false,
    });
  });

  test("⚠️ a conversão exige os DOIS na escala falada", () => {
    /* "120 por 8" é erro de digitação, e multiplicar só a diastólica
       inventaria uma leitura que ela não deu. */
    expect(lerPressaoDigitada("120", "8")).toBeNull();
    expect(lerPressaoDigitada("12", "90")).toBeNull();
  });

  test("o que não dá para entender vira null — e null NÃO é erro", () => {
    for (const [a, b] of [
      ["", ""],
      ["12", ""],
      ["", "8"],
      ["abc", "8"],
      ["300", "5"],
      ["1e3", "80"],
    ]) {
      expect(lerPressaoDigitada(a, b)).toBeNull();
    }
  });

  test("um valor sozinho nunca vira pressão", () => {
    /* `sinalPressao` precisa do PAR: chamá-lo com uma diastólica inventada já
       custou "diferença implausível" sobre uma pressão normal nesta base. */
    expect(lerPressaoDigitada("120", "")).toBeNull();
  });
});

describe("⚠️ e a tela usa isso, sem nunca reescrever o dado em silêncio", () => {
  function corpo() {
    const i = CONTA.indexOf("function AlertsTab(");
    expect(i).toBeGreaterThan(-1);
    const j = CONTA.indexOf("\nfunction ", i + 1);
    expect(j).toBeGreaterThan(i);
    return CONTA.slice(i, j);
  }

  test("a triagem manda o que a régua leu, e não `Number(sys)`", () => {
    const c = corpo();
    expect(c).toContain("lerPressaoDigitada(sys, dia)");
    expect(c).toMatch(/systolic: pressao\?\.systolic \?\? null/);
    expect(c).toMatch(/diastolic: pressao\?\.diastolic \?\? null/);
    /* ⚠️ O caminho antigo não pode voltar por nenhuma das duas chamadas — o
       envio e o registro no histórico. */
    expect(c).not.toMatch(/systolic: sys \? Number\(sys\)/);
    expect(c).not.toMatch(/diastolic: dia \? Number\(dia\)/);
  });

  test("⚠️ ela MOSTRA o que entendeu quando converte", () => {
    /* Multiplicar o número dela por dez sem dizer seria o app reescrevendo um
       dado clínico por conta própria. */
    const c = corpo();
    expect(c).toContain("pressao?.interpretada");
    expect(c).toContain("Entendi");
  });

  test("⚠️ e quando não entende, DIZ que segue pelos sintomas", () => {
    /* O defeito era justamente recusar tudo lá na frente, com um erro genérico
       que culpa a paciente. */
    const c = corpo();
    expect(c).toMatch(/!pressao &&/);
    expect(c).toContain("vou avaliar pelos sintomas");
  });
});

describe("⚠️ e uma falha de rede não pode apagar a orientação", () => {
  /*
    `assessSymptoms` é servidor por dois motivos: escrever a explicação com IA e
    gravar a triagem para o médico. Mas o NÍVEL nunca veio da IA — vem de
    `assessLevel`, que é regra pura e já está no pacote do navegador (esta tela
    importa `RED_SYMPTOMS` do mesmo arquivo). E o texto do caso sem IA é
    `LEVEL_FALLBACK`, também puro.

    ⚠️ Ou seja: sem rede o app tinha, na mão, exatamente a mesma resposta que
    daria com o servidor de pé sem chave de IA — e respondia "Não foi possível
    avaliar os sintomas" a quem marcou sangramento.
  */
  function corpo() {
    const i = CONTA.indexOf("function AlertsTab(");
    expect(i).toBeGreaterThan(-1);
    return CONTA.slice(i, CONTA.indexOf("\nfunction ", i + 1));
  }

  test("o catch RESPONDE, e responde pela régua compartilhada", () => {
    const c = corpo();
    const i = c.lastIndexOf("} catch {");
    expect(i).toBeGreaterThan(-1);
    const ramo = c.slice(i, c.indexOf("} finally {", i));
    /* ⚠️ A CORRENTE, e não a presença: `void assessLevel(...)` ao lado de um
       `local` fabricado deixa as duas strings no arquivo e o `setResult`
       desenhando outra coisa. O que se cobra é que o valor DESENHADO venha da
       régua. */
    expect(ramo).toMatch(/const local = assessLevel\(/);
    expect(ramo).toMatch(/setResult\(\{ \.\.\.local, message: LEVEL_FALLBACK\[local\.level\] \}\)/);
    /* ⚠️ E a mesma pressão que o servidor receberia — senão a resposta de
       fora e a de dentro divergiriam no caso que mais importa. */
    expect(ramo).toMatch(/systolic: pressao\?\.systolic \?\? null/);
  });

  test("⚠️ e o `toast` de 'não foi possível avaliar' não volta", () => {
    /* Ele era a tela inteira de erro sobre uma triagem que o app sabia
       responder. */
    expect(corpo()).not.toContain("Não foi possível avaliar os sintomas");
  });

  test("⚠️ o que NÃO se finge é o registro", () => {
    const c = corpo();
    const i = c.lastIndexOf("} catch {");
    const ramo = c.slice(i, c.indexOf("} finally {", i));
    /* `registrou: false` é o que faz a caixa dizer que o médico não vai ver —
       e isso é verdade, e muda o que ela faz a seguir. */
    expect(ramo).toContain("setRegistrou(false)");
    expect(ramo).toContain("setSemRede(true)");
    /* E a tela tem um texto PRÓPRIO para esse caso: o genérico de "não
       consegui registrar" não explica que a avaliação saiu daqui de dentro. */
    /* ⚠️ E o GUARDA do texto, não o texto: trocar `{semRede && (` por
       `{false && (` deixava a frase no arquivo e a faixa fora da tela. */
    const t = c.indexOf("Você está sem conexão");
    expect(t).toBeGreaterThan(-1);
    const chave = c.lastIndexOf("{", t);
    expect(chave).toBeGreaterThan(-1);
    expect(c.slice(chave, t)).toMatch(/semRede/);
    expect(c).toMatch(/!semRede && registrou === false/);
  });

  test("a bandeira é zerada a cada nova avaliação", () => {
    /* Sem isto, a faixa de "sem conexão" sobreviveria a uma tentativa que deu
       certo depois — e a tela diria que o médico não viu algo que ele viu. */
    const c = corpo();
    const i = c.indexOf("async function avaliar(");
    expect(i).toBeGreaterThan(-1);
    const fn = c.slice(i, c.indexOf("try {", i));
    expect(fn).toContain("setSemRede(false)");
  });
});
