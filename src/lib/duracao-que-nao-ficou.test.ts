/**
 * A DURAÇÃO DA CONSULTA ERA DESCARTADA EM SILÊNCIO.
 *
 * ⚠️ **Medido contra o banco de PRODUÇÃO (ago/2026), por sondagem ao PostgREST:**
 * das 63 levas de `APLICAR_*.sql`, `appointment_requests.duration_minutes` é a
 * ÚNICA coluna que não existe lá. Nenhuma tabela falta; só ela.
 *
 * O recuo do `marcarConsultaNoDia` faz a coisa certa — tira a coluna nova e
 * grava assim mesmo, para que marcar consulta não pare de funcionar por causa
 * de um campo novo. O que faltava era CONTAR.
 *
 * ⚠️ **A conta do estrago:** ele marca 60 minutos para uma primeira consulta ou
 * um caso difícil, a tela responde "consulta marcada", a coluna é jogada fora,
 * e a leitura devolve `DURACAO_PADRAO_MINUTOS`. Trinta minutos depois o horário
 * volta a parecer livre — e `validarNovaConsulta`, que compara FAIXA, autoriza
 * a segunda paciente em cima da segunda metade da primeira. **Duas pacientes na
 * mesma sala, com o app tendo dito "pronto" às duas.**
 *
 * É a classe "escrita que diz pronto" encontrada dentro de um recuo que existe
 * para o lado certo: o recuo salvava o recurso e escondia o preço.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

const SERVIDOR = semComentarios(readFileSync("src/lib/admin.functions.ts", "utf8"));
const TELA = semComentarios(readFileSync("src/components/dia-da-agenda.tsx", "utf8"));
const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));

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

/** `.handler(` → `=>` sem a chave: com ela a contagem começa na desestruturação. */
const MARCAR = corpoDe(SERVIDOR, "export const marcarConsultaNoDia", [".handler(", "=>"]);

describe("o recuo continua salvando o recurso", () => {
  test("⚠️ a coluna ausente NÃO derruba a marcação", () => {
    /* Marcar consulta funcionava ontem; um campo novo e opcional não pode
       pará-la hoje. O laço tira uma coluna por vez e tenta de novo. */
    expect(MARCAR.length).toBeGreaterThan(0);
    expect(MARCAR).toContain(
      'for (const coluna of ["patient_user_id", "duration_minutes"] as const)',
    );
    expect(MARCAR).toContain("delete linha[coluna]");
  });

  test("⚠️ e é PGRST204, não 42703 — a escrita tem código próprio", () => {
    /* 42703 é erro do Postgres em SELECT; escrito aqui seria um recuo que nunca
       roda. Este engano já custou três vezes nesta base. */
    expect(MARCAR).toContain("colunaAusente(error)");
    expect(MARCAR).not.toMatch(/=== "42703"/);
  });
});

describe("mas ele passou a CONTAR o que descartou", () => {
  test("⚠️ o servidor devolve `duracaoNaoFicou`", () => {
    expect(MARCAR).toContain("descartadas.push(coluna)");
    expect(MARCAR).toContain('descartadas.includes("duration_minutes")');
    expect(MARCAR).toContain("duracaoNaoFicou,");
  });

  test("⚠️ só avisa quando MUDA alguma coisa", () => {
    /* Se ele escolheu exatamente a duração padrão, descartar a coluna não altera
       nada — e o aviso seria ruído numa tela usada dezenas de vezes por dia. */
    expect(MARCAR).toContain("data.duracaoMinutos !== DURACAO_PADRAO_MINUTOS");
  });

  test("⚠️ e diz qual duração VALEU — não só que algo deu errado", () => {
    /* "A duração não ficou" sem o número deixa ele adivinhando o tamanho do
       buraco na agenda. */
    expect(MARCAR).toContain("duracaoQueValeu");
  });

  test("a consulta NÃO é desfeita por causa disto", () => {
    /* Ela está na agenda dele, que é o que ele pediu. */
    expect(MARCAR).toContain("ok: true as const");
  });
});

describe("o aviso CHEGA ao médico", () => {
  test("⚠️ o painel repassa os dois campos", () => {
    /* Sem repassar, o aviso morre no meio do caminho — foi assim que
       `parcial: true` ficou meses com zero leitores nesta base. */
    expect(PAINEL).toContain("duracaoNaoFicou: r.ok ? r.duracaoNaoFicou : undefined");
    expect(PAINEL).toContain("duracaoQueValeu: r.ok ? r.duracaoQueValeu : undefined");
  });

  test("⚠️ a tela desenha, e o aviso é SEPARADO do sucesso", () => {
    /* Emendar isto na frase de sucesso faria a linha mais importante ser lida
       como detalhe. */
    expect(TELA).toContain("if (r.duracaoNaoFicou)");
    expect(TELA).toMatch(/toast\.warning\(/);
  });

  test("⚠️ o texto diz o RISCO e o que fazer — não só 'deu erro'", () => {
    const i = TELA.indexOf("if (r.duracaoNaoFicou)");
    expect(i).toBeGreaterThan(-1);
    const bloco = TELA.slice(i, i + 800);
    expect(bloco).toMatch(/APLICAR_DURACAO_DA_CONSULTA\.sql/);
    expect(bloco).toMatch(/pode ser marcado por cima/);
  });

  test("o aviso fica tempo suficiente para ser lido", () => {
    const i = TELA.indexOf("if (r.duracaoNaoFicou)");
    expect(TELA.slice(i, i + 800)).toMatch(/duration: 10000/);
  });
});
