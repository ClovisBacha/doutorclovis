import { describe, expect, test } from "bun:test";
import { PORTAS, portasDaComunidade } from "./comunidade";

describe("portasDaComunidade", () => {
  test("fora do luto, as quatro portas aparecem", () => {
    expect(portasDaComunidade({ careMode: false })).toEqual(PORTAS);
  });

  test("⚠️ em Modo Cuidado, a votação de nome sai", () => {
    // Votar num nome é uma decisão sobre um bebê que vai nascer. Oferecê-la a
    // quem acabou de perder a gestação é o app não ter entendido o que houve.
    const chaves = portasDaComunidade({ careMode: true }).map((p) => p.key);
    expect(chaves).not.toContain("nome");
  });

  test("⚠️ em Modo Cuidado, a rede de apoio FICA", () => {
    // Tirar amigas e acompanhante seria isolá-la exatamente no pior momento —
    // e o Modo Cuidado existe para cuidar, não para esvaziar o app.
    const chaves = portasDaComunidade({ careMode: true }).map((p) => p.key);
    expect(chaves).toContain("amigas");
    expect(chaves).toContain("acompanhante");
  });

  test("⚠️ em Modo Cuidado, o Álbum FICA", () => {
    // As fotos que já estão lá são a memória do que houve. Escondê-las seria o
    // app apagar o bebê dela — a mesma decisão que manteve `exam_files` de pé
    // quando o envio de exames saiu do produto.
    expect(portasDaComunidade({ careMode: true }).map((p) => p.key)).toContain("album");
  });

  test("toda porta tem destino, e as de hub têm sub-tela", () => {
    for (const p of PORTAS) {
      expect(p.destino.length).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.emoji.length).toBeGreaterThan(0);
      // Quem aponta para "Bebê" cai no `BebeHub` e PRECISA dizer qual
      // sub-tela — sem isso a paciente cai na grade e tem de procurar de novo
      // o que já pediu, e o atalho custa mais que o caminho antigo.
      if (p.destino === "Bebê") expect(p.subDestino).toBeTruthy();
    }
  });

  test("as chaves não se repetem", () => {
    expect(new Set(PORTAS.map((p) => p.key)).size).toBe(PORTAS.length);
  });
});

describe("a porta do chá de bebê", () => {
  test("⚠️ vem PRIMEIRO — é a única que muda sozinha", () => {
    // Uma amiga reserva e o número anda sem ela ter feito nada. As outras
    // quatro são estáveis: quem já sabe onde fica o álbum não precisa vê-lo no
    // topo todo dia.
    expect(PORTAS[0].key).toBe("cha");
  });

  test("⚠️ some em Modo Cuidado, junto com o nome", () => {
    // Mesma razão de tempo verbal: uma lista de presentes é preparo para a
    // chegada, e oferecê-la a quem acabou de perder a gestação é o app não ter
    // entendido o que aconteceu.
    const chaves = portasDaComunidade({ careMode: true }).map((p) => p.key);
    expect(chaves).not.toContain("cha");
    expect(chaves).not.toContain("nome");
    // E a rede de apoio continua de pé.
    expect(chaves).toContain("amigas");
    expect(chaves).toContain("acompanhante");
    expect(chaves).toContain("album");
  });
});
