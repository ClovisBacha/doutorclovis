import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { FONTES } from "./exportar-dados";

/**
 * ⚠️ **OS DOIS BURACOS DE LGPD DA COMUNIDADE.**
 *
 * A aba nasceu depois da exclusão de conta e depois do exportador, e ninguém
 * voltou aos dois. O resultado eram as duas metades do mesmo defeito: ela pedia
 * para apagar e as fotos ficavam; ela pedia os dados e a aba onde mais escreve
 * não vinha.
 */

const CONTA = readFileSync("src/lib/conta.functions.ts", "utf8");
const IMAGENS = readFileSync("src/lib/imagens.server.ts", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

describe("⚠️ a exclusão de conta varre os baldes da Comunidade", () => {
  const C = semProsa(CONTA);

  test("os QUATRO baldes são varridos", () => {
    /**
     * `exames` e `album` já eram varridos. `rede` (fotos e vídeos das
     * publicações e dos stories) e `conversas` (as fotos do direct) nasceram com
     * a Comunidade e ficaram de fora: a paciente pedia a exclusão, o produto
     * respondia que apagou, e a ultrassom dela continuava no nosso disco.
     */
    /**
     * ⚠️ **COBRA A CHAMADA, e nunca a palavra.** A primeira versão procurava
     * `BALDE_REDE` no arquivo — e o nome continua aparecendo no `import` depois
     * de a chamada sumir: as duas mutações que apagavam as varreduras novas
     * passavam VERDES. É o defeito que este repositório documenta desde a
     * catraca de portas ("casa palavra inteira, e no lugar certo").
     */
    for (const balde of ["BALDE_EXAMES", "BALDE_ALBUM", "BALDE_REDE", "BALDE_CONVERSAS"]) {
      expect({ balde, varre: C.includes(`apagarTudoDoDono(${balde}, uid)`) }).toEqual({
        balde,
        varre: true,
      });
    }
  });

  test("⚠️ e a varredura cobre as DUAS convenções de pasta", () => {
    /**
     * `guardarImagem` põe tudo em `pastaDoDono` (sha256 do uuid). Mas o VÍDEO do
     * post e a FOTO da conversa sobem por URL assinada, e ali a pasta é o uuid
     * CRU. Varrer só uma apagaria as fotos e deixaria os vídeos — com o produto
     * dizendo "apagamos" do mesmo jeito.
     */
    expect(C).toContain("apagarTudoDoDono(");
    expect(C).not.toMatch(/await apagarPastaDoDono\(/);
    const i = IMAGENS.indexOf("export async function apagarTudoDoDono");
    const corpo = IMAGENS.slice(i, i + 700);
    expect(corpo).toContain("pastaDoDono(donoId)");
    expect(corpo).toMatch(/apagarPastaDoDono\(balde, donoId, donoId\)/);
  });

  test("⚠️ os arquivos saem ANTES do `deleteUser`", () => {
    /* Com a linha já apagada não há mais como saber quais arquivos eram dela —
       o caminho tem o uuid, mas quem relaciona uuid a pessoa é a linha que
       acabou de sumir. */
    const iArquivos = C.indexOf("apagarTudoDoDono(");
    const iUser = C.indexOf("auth.admin.deleteUser");
    expect(iArquivos).toBeGreaterThan(-1);
    expect(iUser).toBeGreaterThan(iArquivos);
  });
});

describe("⚠️ o export leva o que ela ESCREVEU na Comunidade", () => {
  const tabelas = FONTES.map((f) => f.tabela);

  test("publicações, stories, comentários, mensagens e notas entram", () => {
    for (const t of [
      "rede_posts",
      "rede_stories",
      "rede_comentarios",
      "rede_mensagens",
      "rede_notas",
    ]) {
      expect(tabelas).toContain(t);
    }
  });

  test("⚠️ e o recorte é sempre por AUTORIA dela", () => {
    /* Um recorte por `dona_id` traria o que OUTRAS pessoas escreveram para ela
       — e num arquivo que ela pode mandar por WhatsApp. */
    for (const t of ["rede_posts", "rede_stories", "rede_comentarios", "rede_mensagens"]) {
      expect(FONTES.find((f) => f.tabela === t)!.coluna).toBe("autor_id");
    }
  });

  test("⚠️ nada de `*`: coluna a coluna, e nenhuma aponta para terceiro", () => {
    /**
     * `rede_mensagens.conversa_id` diria COM QUEM ela falou; `rede_posts` e
     * `rede_stories` não carregam nada de terceiro, mas um `*` futuro
     * carregaria. É a mesma razão pela qual `sementinhas_ledger` entra sem
     * `dedupe_key`.
     */
    for (const t of [
      "rede_posts",
      "rede_stories",
      "rede_comentarios",
      "rede_mensagens",
      "rede_notas",
    ]) {
      const f = FONTES.find((x) => x.tabela === t)!;
      expect(f.colunas).not.toBe("*");
      for (const proibida of ["conversa_id", "dona_id", "quem_id", "autor_id", "post_id"]) {
        expect(f.colunas).not.toContain(proibida);
      }
    }
  });

  test("⚠️ e a caixinha fica de fora INTEIRA", () => {
    /* O anonimato da caixinha é o recurso. Exportar até a metade dela cria mais
       uma superfície por onde o autor pode vazar — hoje, ou no dia em que
       alguém trocar a coluna do recorte por engano. */
    expect(tabelas).not.toContain("rede_perguntas");
  });

  test("toda fonte nova tem o `porque` preenchido", () => {
    /* Sem razão escrita, não entra — é a regra do próprio tipo. */
    for (const f of FONTES) expect(f.porque.trim().length).toBeGreaterThan(10);
  });
});
