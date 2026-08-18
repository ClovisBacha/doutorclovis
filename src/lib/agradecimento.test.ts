import { describe, expect, test } from "bun:test";
import {
  agrupaPorPessoa,
  linkDeWhatsApp,
  quemFaltaAgradecer,
  textoDeAgradecimento,
  type ParaAgradecer,
} from "./agradecimento";
import type { ReservaPublica } from "./presentes";

function reserva(p: Partial<ReservaPublica> = {}): ReservaPublica {
  return {
    id: "r1",
    itemId: "i1",
    quantidade: 1,
    quemNome: "Vó Ana",
    recado: null,
    temAudio: false,
    revelarEm: null,
    agradecidaEm: null,
    criadaEm: "2026-09-01T10:00:00Z",
    ...p,
  };
}

const TITULOS: Record<string, string> = {
  i1: "a banheira",
  i2: "o carrinho",
  i3: "as fraldas M",
};
const titulo = (id: string) => TITULOS[id] ?? "o presente";

describe("agrupaPorPessoa", () => {
  test("junta o que a mesma pessoa deu", () => {
    const r = agrupaPorPessoa(
      [
        reserva({ id: "a", itemId: "i1", quemNome: "Vó Ana" }),
        reserva({ id: "b", itemId: "i2", quemNome: "Vó Ana" }),
      ],
      titulo,
    );
    expect(r).toHaveLength(1);
    expect(r[0].itens).toEqual(["a banheira", "o carrinho"]);
    expect(r[0].reservaIds).toEqual(["a", "b"]);
  });

  test("⚠️ mesma pessoa com acento e caixa diferentes é UMA pessoa", () => {
    // Ela digitou de dois celulares. Três mensagens seguidas para a mesma tia
    // é pior que nenhuma — lê como robô.
    const r = agrupaPorPessoa(
      [
        reserva({ id: "a", quemNome: "Vó Ana" }),
        reserva({ id: "b", quemNome: "vo ana" }),
        reserva({ id: "c", quemNome: "VÓ ANA" }),
      ],
      titulo,
    );
    expect(r).toHaveLength(1);
    expect(r[0].reservaIds).toHaveLength(3);
  });

  test("pessoas diferentes ficam separadas", () => {
    const r = agrupaPorPessoa(
      [reserva({ id: "a", quemNome: "Ana" }), reserva({ id: "b", quemNome: "Carol" })],
      titulo,
    );
    expect(r).toHaveLength(2);
  });

  test("⚠️ só está agradecida quem teve TODAS as reservas agradecidas", () => {
    // Com um `||`, agradecer uma fralda tiraria da fila a pessoa que também
    // deu o carrinho — e ela nunca receberia o agradecimento do presente caro.
    const r = agrupaPorPessoa(
      [
        reserva({ id: "a", agradecidaEm: "2026-09-05T10:00:00Z" }),
        reserva({ id: "b", agradecidaEm: null }),
      ],
      titulo,
    );
    expect(r[0].agradecida).toBe(false);
  });

  test("com todas agradecidas, sai da fila", () => {
    const r = agrupaPorPessoa(
      [
        reserva({ id: "a", agradecidaEm: "2026-09-05T10:00:00Z" }),
        reserva({ id: "b", agradecidaEm: "2026-09-05T10:00:00Z" }),
      ],
      titulo,
    );
    expect(r[0].agradecida).toBe(true);
    expect(quemFaltaAgradecer(r)).toHaveLength(0);
  });

  test("o áudio de qualquer uma das reservas conta", () => {
    const r = agrupaPorPessoa(
      [reserva({ id: "a", temAudio: false }), reserva({ id: "b", temAudio: true })],
      titulo,
    );
    expect(r[0].temAudio).toBe(true);
  });

  test("sem nome vira Alguém e não quebra", () => {
    const r = agrupaPorPessoa([reserva({ quemNome: null })], titulo);
    expect(r[0].nome).toBe("Alguém");
  });
});

describe("textoDeAgradecimento", () => {
  function p(x: Partial<ParaAgradecer> = {}): ParaAgradecer {
    return {
      reservaIds: ["a"],
      nome: "Vó Ana",
      itens: ["a banheira"],
      temAudio: false,
      agradecida: false,
      ...x,
    };
  }

  test("⚠️ NUNCA cita o que a pessoa não deu", () => {
    // "Obrigada pelo carrinho" para quem deu fralda destruiria o recurso
    // inteiro na primeira vez que acontecesse.
    const t = textoDeAgradecimento(p({ itens: ["as fraldas M"] }));
    expect(t).toContain("as fraldas M");
    expect(t).not.toContain("carrinho");
    expect(t).not.toContain("banheira");
  });

  test("usa o primeiro nome", () => {
    expect(textoDeAgradecimento(p({ nome: "Maria Fernanda Alves" }))).toContain("Oi, Maria!");
  });

  test("lista dois itens com 'e', e três com vírgula", () => {
    expect(textoDeAgradecimento(p({ itens: ["a banheira", "o carrinho"] }))).toContain(
      "a banheira e o carrinho",
    );
    expect(
      textoDeAgradecimento(p({ itens: ["a banheira", "o carrinho", "as fraldas M"] })),
    ).toContain("a banheira, o carrinho e as fraldas M");
  });

  test("item repetido não aparece duas vezes", () => {
    const t = textoDeAgradecimento(p({ itens: ["as fraldas M", "as fraldas M"] }));
    expect(t.match(/as fraldas M/g)).toHaveLength(1);
  });

  test("⚠️ menciona o áudio quando existe — é o que a lista tem de melhor", () => {
    expect(textoDeAgradecimento(p({ temAudio: true }))).toContain("áudio");
    expect(textoDeAgradecimento(p({ temAudio: false }))).not.toContain("áudio");
  });

  test("⚠️ o nome do bebê vai SEM artigo — serve para Helena e para Miguel", () => {
    // "A Helena vai crescer" viraria "A Miguel vai crescer". Acertar o artigo
    // exigiria saber o gênero pelo nome, que é o que não dá para fazer. Mesma
    // armadilha que o bolão já tinha ("Quando o Helena nasce?") e que
    // reapareceu neste arquivo no mesmo dia.
    for (const nome of ["Helena", "Miguel", "Ariel"]) {
      const t = textoDeAgradecimento(p(), { bebeNome: nome });
      expect(t).toContain(`${nome} vai crescer`);
      expect(t).not.toContain(`A ${nome}`);
      expect(t).not.toContain(`O ${nome}`);
    }
  });

  test("⚠️ sem nome de bebê, NÃO inventa", () => {
    // O app falando por ela sobre a coisa mais íntima daquele momento.
    const semNome = textoDeAgradecimento(p(), {});
    expect(semNome).not.toMatch(/\bbebê\b/i);
    expect(textoDeAgradecimento(p(), { bebeNome: "Helena" })).toContain("Helena");
    expect(textoDeAgradecimento(p(), { bebeNome: "   " })).not.toMatch(/\bA\s+\s/);
  });

  test("o texto não cobra nem promete nada clínico", () => {
    const proibido = /falta|corre|últim|urgente|parto|semana|exame/i;
    expect(textoDeAgradecimento(p({ temAudio: true }), { bebeNome: "Helena" })).not.toMatch(
      proibido,
    );
  });
});

describe("linkDeWhatsApp", () => {
  test("⚠️ vai SEM número — ela escolhe o contato", () => {
    // O app não tem o telefone de quem deu (é terceiro sem conta), e um link
    // com número errado mandaria o agradecimento da tia para outra pessoa.
    const l = linkDeWhatsApp("Oi, Ana!");
    expect(l.startsWith("https://wa.me/?text=")).toBe(true);
    expect(l).not.toMatch(/wa\.me\/\d/);
  });

  test("escapa o texto", () => {
    expect(linkDeWhatsApp("a & b")).toContain("%26");
  });
});
