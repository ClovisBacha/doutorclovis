/**
 * A CARTEIRINHA É A FICHA QUE O SOCORRISTA LÊ — E ELA AFIRMAVA QUATRO COISAS
 * QUE NÃO SABIA.
 *
 * `CardTab` é a aba "Carteirinha": nome, tipo sanguíneo, alergias, medicações,
 * contato de emergência e um QR com tudo isso, feito para ser mostrado num
 * plantão. É a MESMA informação da folha do SOS, num documento permanente —
 * e as duas telas divergiram, porque cada conserto foi aplicado numa só.
 *
 *   1. ⚠️ **MODO CUIDADO NÃO ATRAVESSAVA.** A folha do SOS recebe
 *      `tituloDaFicha={!profile || careMode ? "…PACIENTE OBSTÉTRICA" : …}`
 *      desde ago/2026. A carteirinha não recebia `careMode` NENHUM: no luto
 *      ela continuava carimbando "GESTANTE", o nome do bebê e uma DPP que não
 *      vai acontecer — no cartão E dentro do QR. Não é só o custo emocional:
 *      um bebê que não vai nascer e uma data de parto que não existe são
 *      informação ERRADA para quem vai atendê-la.
 *      ⚠️ E o que NÃO pode sair é o resto: sangue, alergias, medicações e
 *      contato ficam inteiros. Quem perdeu uma gestação continua sendo
 *      paciente obstétrica, e continua podendo passar mal.
 *
 *   2. ⚠️ **"Alergias: Nenhuma" AFIRMAVA AUSÊNCIA sobre um campo vazio.**
 *      Campo em branco quer dizer que ela não preencheu; "nada relatado" e
 *      "não tem" não são a mesma coisa, e a diferença entre os dois é uma
 *      prescrição. A folha do SOS já dizia "nenhuma informada" — a régua
 *      existia no vizinho e não tinha sido aplicada aqui.
 *
 *   3. ⚠️ **"Atualizado em" MOSTRAVA A HORA DE ABRIR A TELA.** Era
 *      `new Date()`, então o socorrista lia "Atualizado em: hoje, 04:55" sobre
 *      uma lista de alergias que pode ter seis meses. `updated_at` existe na
 *      tabela mas só é escrito quando o MÉDICO edita, então mostrá-lo seria
 *      trocar uma data falsa para mais por uma falsa para menos. O que sobra
 *      de verdadeiro é que o QR foi GERADO agora.
 *
 *   4. ⚠️ **"✓ Copiado!" sem olhar a resposta do clipboard.** `writeText`
 *      rejeita quando o navegador nega o acesso, e a tela dizia que copiou.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/** ⚠️ A prosa deste arquivo CITA o que ele proíbe — sai antes da busca. */
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));

/**
 * O corpo de `CardTab`, do `function CardTab(` até a próxima função de topo.
 * ⚠️ Não é uma janela de N caracteres: o arquivo tem dezesseis mil linhas e as
 * mesmas palavras aparecem dezenas de vezes.
 */
function corpoDaCarteirinha() {
  const i = CONTA.indexOf("function CardTab(");
  expect(i).toBeGreaterThan(-1);
  const j = CONTA.indexOf("\nfunction ", i + 1);
  expect(j).toBeGreaterThan(i);
  return CONTA.slice(i, j);
}

describe("⚠️ a carteirinha de emergência não afirma o que não sabe", () => {
  test("o Modo Cuidado CHEGA nela — o chamador passa a prop", () => {
    /* Sem isto nada abaixo tem como funcionar: a régua pode estar escrita
       dentro do componente e o portão nunca fecha. */
    const i = CONTA.indexOf("<CardTab");
    expect(i).toBeGreaterThan(-1);
    const chamada = CONTA.slice(i, CONTA.indexOf("/>", i));
    expect(chamada).toContain("careMode={careMode}");
  });

  test("o rótulo da ficha muda no luto, e sai do MESMO lugar no cartão e no QR", () => {
    const c = corpoDaCarteirinha();
    /* Uma régua só: duas expressões divergiriam, e a divergência apareceria
       como o cartão dizendo uma coisa e o QR outra — no mesmo documento. */
    expect(c).toMatch(/rotuloDaFicha\s*=\s*careMode\s*\?\s*"PACIENTE OBSTÉTRICA"\s*:\s*"GESTANTE"/);
    expect(c).toContain("CARTEIRINHA DE EMERGÊNCIA — ${rotuloDaFicha}");
    expect(c).toContain("{rotuloDaFicha}");
    /* E a palavra não pode voltar cravada em lugar nenhum. */
    expect(c).not.toMatch(/EMERGÊNCIA — GESTANTE/);
  });

  test("as três linhas que falam de gestação em curso saem no luto — no QR e na tela", () => {
    const c = corpoDaCarteirinha();
    /* QR: o bebê, a idade gestacional e a DPP viram `null` e o `.filter` os
       tira da string que o hospital lê. */
    expect(c).toMatch(/careMode \? null : `Bebê:/);
    expect(c).toMatch(/careMode \? null : `IG:/);
    expect(c).toMatch(/careMode\s*\?\s*null\s*:\s*`DPP:/);
    /* Tela: o nome do bebê e os dois cartões.
       ⚠️ A cobrança é a GARANTIA (o campo está atrás de `!careMode`), nunca a
       grafia: o prettier quebra `{!careMode && <Info … />}` em três linhas
       quando o conteúdo passa de cem colunas, e a primeira versão deste teste
       ficou vermelha sobre código correto por causa disso. É a décima terceira
       vez que travar a escrita reprova o certo nesta base. */
    expect(c).toMatch(/!careMode && profile\.baby_name/);
    for (const campo of ['label="IG atual"', 'label="DPP"']) {
      const i = c.indexOf(campo);
      expect(i).toBeGreaterThan(-1);
      /* O `!careMode &&` que embrulha o campo, com ou sem parêntese e quebra
         de linha entre os dois. */
      expect(c.slice(Math.max(0, i - 60), i)).toMatch(/!careMode && \(?\s*<Info\s*$/);
    }
  });

  test("⚠️ e o que é SOCORRO continua inteiro no luto", () => {
    /* O Modo Cuidado governa conteúdo, nunca socorro. Sangue, alergias,
       medicação e contato não podem ganhar portão — quem perdeu a gestação
       continua podendo passar mal, e é justamente ela que pode precisar de um
       pronto-socorro nos dias seguintes. */
    const c = corpoDaCarteirinha();
    for (const campo of [
      'label="Tipo sanguíneo"',
      'label="Alergias"',
      'label="Medicamentos"',
      'label="Contato emergência"',
    ]) {
      const i = c.indexOf(campo);
      expect(i).toBeGreaterThan(-1);
      /* A linha do campo não pode estar embrulhada por um `!careMode &&` —
         basta olhar os 40 caracteres antes dele. */
      expect(c.slice(Math.max(0, i - 40), i)).not.toContain("!careMode");
    }
    /* E os números de emergência ficam, sem exceção. */
    expect(c).toContain("href={`tel:${number}`}");
    expect(c).toContain('number: "192"');
  });

  test("campo vazio é DESCONHECIDO, nunca 'Nenhuma'", () => {
    const c = corpoDaCarteirinha();
    expect(c).toMatch(/const alergias = profile\?\.allergies \|\| "não informado"/);
    expect(c).toMatch(/const medicacoes = profile\?\.medications \|\| "não informado"/);
    /* ⚠️ `||` e não `??`: string vazia também é "ela não preencheu", e com o
       `??` a ficha saía com o campo EM BRANCO — que se lê igual a "não tem". */
    expect(c).not.toMatch(/allergies \?\?/);
    expect(c).not.toMatch(/medications \?\?/);
    /* A palavra que afirma ausência não pode voltar. */
    expect(c).not.toContain('"Nenhuma"');
    expect(c).not.toContain('"Nenhum"');
    /* E o QR usa as MESMAS variáveis da tela. */
    expect(c).toContain("`Alergias: ${alergias}`");
    expect(c).toContain("`Medicamentos: ${medicacoes}`");
    expect(c).toContain('<Info label="Alergias" value={alergias} />');
    expect(c).toContain('<Info label="Medicamentos" value={medicacoes} />');
  });

  test("o carimbo diz o que é verdade: o QR foi GERADO agora", () => {
    const c = corpoDaCarteirinha();
    expect(c).toMatch(/const geradoEm = new Date\(\)\.toLocaleString\("pt-BR"\)/);
    expect(c).toContain("`Gerado em: ${geradoEm}`");
    expect(c).toContain("QR gerado em: {geradoEm}");
    /* ⚠️ "Atualizado" era a mentira: ela descreve a idade do DADO, e o app não
       a conhece. Nem o nome da variável volta. */
    expect(c).not.toContain("Atualizado em:");
    expect(c).not.toContain("updatedAt");
    /* E a tela dá o caminho de conferir, em vez de afirmar frescor. */
    expect(c).toContain("Os dados vêm do seu Perfil.");
  });

  test("copiar espera a resposta, e a falha DIZ o que fazer", () => {
    const c = corpoDaCarteirinha();
    /* ⚠️ A âncora leva o `async` junto: `indexOf("function copyCard(")` casa
       DEPOIS dele, e a fatia sairia sem a palavra que o teste quer cobrar. */
    const i = c.indexOf("async function copyCard(");
    expect(i).toBeGreaterThan(-1);
    const fn = c.slice(i, c.indexOf("\n  }", i));
    expect(fn).toContain("await navigator.clipboard.writeText(cardText)");
    expect(fn).toContain("catch");
    /* ⚠️ O `setCopied(true)` fica DEPOIS do await, dentro do `try` — antes
       dele, a tela volta a dizer que copiou sobre uma promessa que rejeitou. */
    expect(fn.indexOf("await navigator.clipboard")).toBeLessThan(fn.indexOf("setCopied(true)"));
    expect(fn).toContain("toast.error(");
  });

  test("a falha de leitura continua vindo ANTES do vazio", () => {
    /* Já estava certo (é a SÉTIMA da classe, consertada em ago/2026) e não
       pode regredir com as mudanças acima: "Preencha seu perfil primeiro"
       sobre um perfil preenchido é uma acusação, num pronto-socorro. */
    const c = corpoDaCarteirinha();
    const instavel = c.indexOf("if (!profile && instavel)");
    const vazio = c.indexOf("if (!profile)\n");
    expect(instavel).toBeGreaterThan(-1);
    expect(vazio).toBeGreaterThan(-1);
    expect(instavel).toBeLessThan(vazio);
  });
});
