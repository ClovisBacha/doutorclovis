/**
 * O GRUPO AVISAVA MENOS QUE O 1-A-1 — e a assimetria estava invertida.
 *
 * ⚠️ `enviarMensagem` (o direct de duas pessoas) devolve `avisoClinico` quando
 * a triagem reconhece conduta: manda a mensagem — não é papel do app censurar
 * conversa privada entre adultas — e **lembra quem escreveu**. `mandarNoGrupo`
 * rodava a MESMA `triarTexto`, recusava só a emergência, e **jogava o resto
 * fora**: o mesmo texto chegava a até OITO leitoras e ninguém era avisado.
 *
 * ⚠️ **O canal com uma leitora avisava; o canal com sete, não.** É o cenário
 * dos 5,5% de respostas potencialmente danosas multiplicado por sete — o número
 * que fechou os comentários deste app.
 *
 * ⚠️ **E o conserto NÃO é recusar.** Um grupo aqui é criado por uma pessoa, só
 * com gente do grafo dela, com teto de oito e leitura a partir de `entrou_em`:
 * é conversa privada, não publicação. O que muda é que ela passa a saber o que
 * acabou de mandar.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const GRUPO = semComentarios(readFileSync("src/lib/grupo.functions.ts", "utf8"));
const TELA = semComentarios(readFileSync("src/components/rede-grupo.tsx", "utf8"));
const DIRECT = semComentarios(readFileSync("src/lib/conversa.functions.ts", "utf8"));

function corpoDe(fonte: string, assinatura: string, depois: readonly string[] = []): string {
  const i = fonte.indexOf(assinatura);
  if (i < 0) return "";
  let de = i;
  for (const marca of depois) {
    de = fonte.indexOf(marca, de);
    if (de < 0) return "";
    de += marca.length;
  }
  const abre = fonte.indexOf("{", de);
  if (abre < 0) return "";
  let n = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === "{") n++;
    else if (fonte[j] === "}" && --n === 0) return fonte.slice(abre, j + 1);
  }
  return "";
}

/** ⚠️ `.handler(` → `=>` sem a chave: com ela, a contagem começa na
 *  desestruturação `{ data }` da primeira linha. */
const MANDAR = corpoDe(GRUPO, "export const mandarNoGrupo", [".handler(", "=>"]);

describe("o grupo roda a régua e USA o resultado", () => {
  test("⚠️ a triagem é a MESMA do direct e do comentário", () => {
    /* Uma segunda régua clínica divergiria da primeira no primeiro conserto, e
       a divergência apareceria como conduta passando num canal e não no outro. */
    expect(MANDAR.length).toBeGreaterThan(0);
    expect(MANDAR).toContain('import("./pergunta-clinica")');
    expect(MANDAR).toContain("triarTexto(texto)");
  });

  test("⚠️ a emergência continua sendo RECUSADA", () => {
    expect(MANDAR).toContain('if (desfecho === "emergencia")');
    expect(MANDAR).toContain('motivo: "emergencia" as const');
  });

  test("⚠️ e o resto NÃO é jogado fora — vira aviso", () => {
    /* A forma exata do defeito era `if (triarTexto(texto) === "emergencia")`:
       o desfecho não era guardado, então `clinica` sumia. */
    expect(MANDAR).toContain('desfecho !== "publicavel" ? ("conduta" as const) : null');
    expect(MANDAR).toContain("avisoClinico");
  });

  test("⚠️ o aviso CHEGA ao retorno — não basta calculá-lo", () => {
    /* Um campo calculado e não devolvido é a mesma coisa que não existir: é o
       `parcial: true` com zero leitores que este repositório já pagou. */
    expect(MANDAR).toContain("return { ok: true as const, avisoClinico }");
  });

  test("⚠️ e a TELA do grupo o lê", () => {
    expect(TELA).toContain('r.avisoClinico === "conduta"');
    expect(TELA).toMatch(/só o médico de cada uma pode orientar sobre sintoma/);
  });

  test("⚠️ a frase é a do GRUPO, e não a do 1-a-1", () => {
    /* "só o médico DELA" não faz sentido quando são sete pessoas — cada uma
       tem o seu. */
    expect(TELA).not.toMatch(/só o médico dela pode orientar/);
  });

  test("⚠️ o grupo NÃO passou a recusar conduta", () => {
    /* Um grupo aqui é criado por uma pessoa, só com gente do grafo dela, teto
       de oito, leitura a partir de `entrou_em`: é conversa privada, não
       publicação. Recusar seria o app decidindo o que oito adultas podem dizer
       umas às outras — e é o oposto da decisão tomada para o direct. */
    expect(MANDAR).not.toMatch(/desfecho !== "publicavel"\)\s*\{?\s*return \{ ok: false/);
    expect(MANDAR).not.toContain('motivo: "clinico"');
  });
});

describe("os dois canais privados concordam", () => {
  test("⚠️ o direct também MANDA e avisa — nenhum dos dois censura", () => {
    /* Se um dia o direct passar a recusar, este teste fica vermelho e obriga a
       decidir os dois juntos, em vez de deixá-los divergir em silêncio. */
    const envio = corpoDe(DIRECT, "export const enviarMensagem", [".handler(", "=>"]);
    expect(envio.length).toBeGreaterThan(0);
    expect(envio).toContain('avisoClinico = "conduta"');
    expect(envio).toContain('motivo: "emergencia" as const');
  });
});
