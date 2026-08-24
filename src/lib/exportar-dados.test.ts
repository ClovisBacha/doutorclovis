import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AVISO, FONTES, FORA_DO_EXPORT, LIMITE_POR_FONTE, nomeDoArquivo } from "./exportar-dados";

/**
 * ⚠️ UM EXPORT QUE VAZE DADO DE TERCEIRO É PIOR QUE NÃO TER EXPORT.
 *
 * Este é o risco central do recurso, e não a completude. A paciente baixa um
 * arquivo sem senha e manda por WhatsApp; se dentro dele estiver o nome de quem
 * reservou um presente, ou quem mandou pergunta na caixinha anônima, o vazamento
 * é nosso e é irreversível.
 */
describe("o export não leva dado de terceiro", () => {
  /**
   * ⚠️ **As tabelas COMPARTILHADAS não entram, nem por engano.** Cada uma tem o
   * id ou o nome de outra pessoa dentro:
   *   · `presente_reservas` — quem deu o presente
   *   · `rede_perguntas`    — a caixinha é ANÔNIMA; `quem_id` existe para
   *                           bloquear, nunca para ser lido
   *   · `rede_reacoes`, `rede_seguidores`, `rede_marcacoes` — outras pessoas
   *   · `amizades`, `duplas` — o id da outra
   *   · `rede_denuncias`    — quem foi denunciado
   *   · `companion_invites` — o token que abre o painel de emergência dela
   */
  const PROIBIDAS = [
    "presente_reservas",
    "rede_perguntas",
    "rede_reacoes",
    "rede_seguidores",
    "rede_marcacoes",
    "rede_denuncias",
    "rede_bloqueios",
    "amizades",
    "duplas",
    "companion_invites",
    "chat_memory",
  ];

  test("⚠️ nenhuma tabela compartilhada está na lista", () => {
    const nomes = FONTES.map((f) => f.tabela);
    for (const p of PROIBIDAS) expect(nomes).not.toContain(p);
  });

  /**
   * ⚠️ **`sementinhas_ledger` entra SEM `dedupe_key`** — ela carrega o id de
   * quem deu o presente (`presente:<medico>:<paciente>:<token>`). É o caso mais
   * fácil de deixar passar, porque a tabela é dela.
   */
  test("⚠️ o extrato não leva a chave que identifica quem deu", () => {
    const f = FONTES.find((x) => x.tabela === "sementinhas_ledger");
    expect(f).not.toBeUndefined();
    expect(f!.colunas).not.toContain("dedupe_key");
    expect(f!.colunas).not.toBe("*");
  });

  /**
   * ⚠️ **`consultations` entra pela METADE.** `resumo_paciente` é o campo
   * rotulado "o que ela vai ler", escrito para ela. `achados` e `conduta` são o
   * registro profissional do médico — liberá-los por botão automático é decisão
   * de prontuário médico, não de software.
   */
  test("⚠️ a consulta leva o resumo dela, não o registro do médico", () => {
    const f = FONTES.find((x) => x.tabela === "consultations");
    expect(f).not.toBeUndefined();
    expect(f!.colunas).toContain("resumo_paciente");
    expect(f!.colunas).not.toContain("achados");
    expect(f!.colunas).not.toContain("conduta");
  });

  /** Toda fonte declara POR QUE é dela — sem razão escrita, não entra. */
  test("⚠️ toda fonte tem razão escrita", () => {
    for (const f of FONTES) {
      /* Curta pode ser ("medição dela" tem 12 letras e diz tudo). O que não
         pode é placeholder — a razão existe para obrigar quem acrescenta uma
         tabela a parar e pensar se o dado é mesmo só dela. */
      expect(f.porque.trim().length).toBeGreaterThan(8);
      expect(f.porque.toLowerCase()).not.toMatch(/^(todo|tudo|dados?|n\/?a|-)$/);
      expect(f.tabela.trim().length).toBeGreaterThan(0);
      expect(f.coluna.trim().length).toBeGreaterThan(0);
    }
  });

  test("as chaves do arquivo não se repetem", () => {
    const chaves = FONTES.map((f) => f.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });
});

describe("o export não finge completude", () => {
  /**
   * ⚠️ **O que fica de fora é DITO, dentro do próprio arquivo.** Um export que
   * não diz o que não trouxe faz a paciente acreditar que tem tudo — e ela pode
   * apagar a conta em seguida, levando junto o que faltou.
   */
  test("⚠️ o arquivo carrega a lista do que ficou de fora", () => {
    expect(FORA_DO_EXPORT.length).toBeGreaterThanOrEqual(3);
    for (const x of FORA_DO_EXPORT) expect(x.porque.trim().length).toBeGreaterThan(20);
    const texto = FORA_DO_EXPORT.map((x) => x.o_que).join(" ");
    expect(texto).toContain("Achados");
    expect(texto.toLowerCase()).toContain("caixinha");
  });

  /**
   * ⚠️ **Falha de leitura vira `falhas`, nunca bloco vazio.** É a mesma direção
   * do "incompleto" do prontuário: a tela avisa em vez de fingir.
   */
  test("⚠️ o servidor registra as falhas em vez de omitir", () => {
    const src = readFileSync("src/lib/exportar-dados.functions.ts", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    expect(src).toContain("falhas.push(f.tabela)");
    /* Tabela ausente é normal num banco atrás das migrations — não é falha. */
    expect(src).toContain('code !== "42P01"');
  });

  /**
   * ⚠️ **A SESSÃO É O ÚNICO RECORTE.** Não há `pacienteId` no corpo do pedido:
   * bastaria trocar um uuid para baixar a gestação inteira de outra pessoa.
   */
  test("⚠️ não existe alvo vindo do cliente", () => {
    /* ⚠️ **Comentários fora ANTES de procurar — SEXTA vez neste repositório.**
       Este teste ficou vermelho na primeira execução por causa da MINHA prosa,
       que diz "não há `pacienteId` no corpo do pedido" para explicar a decisão.
       A regra já vale para toda catraca daqui, e a partir de agora vale por
       padrão em qualquer teste que leia fonte: tira-se o comentário primeiro. */
    const src = readFileSync("src/lib/exportar-dados.functions.ts", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    expect(src).not.toContain("pacienteId");
    expect(src).not.toContain("alvoId");
    expect(src).toContain("accessToken: z.string()");
  });

  /** O médico não exporta por aqui — o dado dele é de terceiros. */
  test("⚠️ conta de médico é recusada", () => {
    const src = readFileSync("src/lib/exportar-dados.functions.ts", "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      " ",
    );
    expect(src).toContain('motivo: "medico"');
    expect(src.indexOf('from("doctors")')).toBeLessThan(src.indexOf("FONTES.map"));
  });
});

describe("o arquivo", () => {
  /** ⚠️ Sem o nome dela: downloads é pasta compartilhada. */
  test("⚠️ o nome não carrega o nome da paciente", () => {
    const n = nomeDoArquivo(new Date("2026-08-21T12:00:00Z"));
    expect(n).toBe("obstetrica-meus-dados-2026-08-21.json");
  });

  test("o aviso diz que tem dado de saúde e não tem senha", () => {
    expect(AVISO.toLowerCase()).toContain("saúde");
    expect(AVISO.toLowerCase()).toContain("senha");
  });

  test("há teto por fonte", () => {
    expect(LIMITE_POR_FONTE).toBeGreaterThan(500);
    expect(LIMITE_POR_FONTE).toBeLessThanOrEqual(10000);
  });
});
