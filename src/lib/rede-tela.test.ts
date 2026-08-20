import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * AS CATRACAS DA TELA DA REDE — o que toda lista de posts precisa oferecer.
 *
 * ⚠️ **Nasceu de um defeito que não aparecia em teste nem em `tsc`.** A zona
 * "Publicações sugeridas" é o ÚNICO lugar do app onde a paciente vê publicação
 * de quem ela não escolheu seguir — e era a única lista que não passava
 * `aoDenunciar`. Toda prop de ação é opcional em `PostInstagram` (tem de ser: a
 * gaveta dos arquivados não reage nem vota), então esquecer uma não quebra
 * nada; some um botão, em silêncio, no cartão que mais precisa dele.
 *
 * Pela diretriz **1.2** da App Store, conteúdo gerado por usuário precisa de
 * denúncia em todo ponto onde é exibido — e a de estranha é o caso que a
 * diretriz descreve.
 */
const FONTE = readFileSync("src/components/rede-instagram.tsx", "utf8");

/** Cada `<PostInstagram …/>` da tela, com as props que ele recebe. */
function renderizacoesDePost(): string[] {
  const saida: string[] = [];
  let i = FONTE.indexOf("<PostInstagram");
  while (i !== -1) {
    /* O fecho da tag: `/>` da própria abertura. `PostInstagram` não tem
       filhos em nenhum ponto de uso, e um dia que tiver este corte reprova em
       vez de mentir. */
    const fim = FONTE.indexOf("/>", i);
    expect(fim).toBeGreaterThan(-1);
    saida.push(FONTE.slice(i, fim));
    i = FONTE.indexOf("<PostInstagram", fim);
  }
  return saida;
}

describe("toda lista de posts", () => {
  test("existe mais de uma — feed e sugeridos, no mínimo", () => {
    expect(renderizacoesDePost().length).toBeGreaterThanOrEqual(2);
  });

  /* ⚠️ O defeito exato: os sugeridos não tinham denúncia. */
  test("⚠️ passa `aoDenunciar` — inclusive a zona de sugeridos", () => {
    for (const r of renderizacoesDePost()) {
      expect(r).toContain("aoDenunciar=");
    }
  });

  /* Reagir e abrir o perfil são o que faz um post ser um post; sem eles o
     cartão vira figura. */
  test("passa `aoReagir` e `aoAbrirPerfil`", () => {
    for (const r of renderizacoesDePost()) {
      expect(r).toContain("aoReagir=");
      expect(r).toContain("aoAbrirPerfil=");
    }
  });

  /* ⚠️ E a zona de sugeridos NÃO oferece apagar: nenhum post ali é dela, e um
     ⋯ com "apagar" sobre a publicação de uma desconhecida seria uma promessa
     que o servidor recusa. */
  test("⚠️ os sugeridos levam o rótulo obrigatório e não oferecem apagar", () => {
    const sug = renderizacoesDePost().filter((r) => /\bsugerido\b/.test(r));
    expect(sug).toHaveLength(1);
    expect(sug[0]).not.toContain("aoApagar=");
  });
});
