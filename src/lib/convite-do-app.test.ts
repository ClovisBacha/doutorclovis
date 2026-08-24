import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fraseDoRodape, ROTULO_DO_BOTAO, type OndeConvida } from "./convite-do-app";

const TODAS: OndeConvida[] = ["presentes", "album", "nome", "acompanhante", "perfil"];

describe("as frases do rodapé", () => {
  test("cada página tem a sua, e são diferentes", () => {
    const titulos = TODAS.map((o) => fraseDoRodape(o).titulo);
    expect(new Set(titulos).size).toBe(TODAS.length);
  });

  /* ⚠️ Cada uma fala do que a pessoa ACABOU de ver — quem estava escolhendo
     uma fralda não quer ler "acompanhamento semana a semana". */
  test("⚠️ cada frase fala da página em que está", () => {
    expect(fraseDoRodape("presentes").titulo.toLowerCase()).toContain("lista");
    expect(fraseDoRodape("album").titulo.toLowerCase()).toContain("álbum");
    expect(fraseDoRodape("nome").titulo.toLowerCase()).toContain("votação");
    expect(fraseDoRodape("acompanhante").titulo.toLowerCase()).toContain("acompanhando");
    expect(fraseDoRodape("perfil").titulo.toLowerCase()).toContain("perfil");
  });

  /* ⚠️ Quem lê pode estar grávida, e a promessa clínica é do médico dela — não
     de um rodapé. Mesma proibição das frases do mascote. */
  test("⚠️ nenhuma promete cuidado, segurança ou desfecho", () => {
    const tudo = TODAS.map((o) => `${fraseDoRodape(o).titulo} ${fraseDoRodape(o).sub}`)
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "seguro",
      "segurança",
      "cuida de você",
      "vai te ajudar",
      "está tudo bem",
      "tranquil",
      "garant",
      "médico responde",
      /* ⚠️ A da vitrine não pode prometer seguir: a página pública não tem
         botão de seguir, e seguir exige conta. */
      "siga",
      "seguir",
    ]) {
      expect(tudo).not.toContain(proibido);
    }
  });

  /* ⚠️ Metade de quem abre estes links não é gestante — é a tia, o colega de
     trabalho, o marido. "Crie sua conta" é o rodapé não ter entendido para
     quem está falando. */
  test("⚠️ o botão NÃO manda criar conta", () => {
    const r = ROTULO_DO_BOTAO.toLocaleLowerCase("pt-BR");
    expect(r).not.toContain("criar");
    expect(r).not.toContain("cadastr");
    expect(r).toContain("conhec");
  });

  test("toda frase tem título e subtítulo não vazios", () => {
    for (const o of TODAS) {
      const f = fraseDoRodape(o);
      expect(f.titulo.trim().length).toBeGreaterThan(8);
      expect(f.sub.trim().length).toBeGreaterThan(8);
    }
  });
});

/**
 * ⚠️ CADA PÁGINA PÚBLICA USA A VARIANTE DELA — e esta catraca nasceu de um
 * defeito real.
 *
 * `/votar-nome` foi escrita copiando a linha da página vizinha e ficou com
 * `onde="album"`: quem votava num nome lia, no pé, "Este álbum vive no
 * Obstétrica" — um rodapé descrevendo uma tela que aquela pessoa nunca viu. Não
 * quebra nada, não aparece em teste, e é exatamente o tipo de coisa que faz o
 * app parecer descuidado para quem ainda não é usuário.
 *
 * A frase é o único trabalho deste componente. Se ela fala de outra página, o
 * componente não fez nada.
 */
describe("a variante de cada rota pública", () => {
  const ESPERADO: Record<string, OndeConvida> = {
    "src/routes/album.$token.tsx": "album",
    "src/routes/votar-nome.$token.tsx": "nome",
    "src/routes/acompanhar.$token.tsx": "acompanhante",
    "src/routes/presente.$token.tsx": "presentes",
    "src/routes/p.$codigo.tsx": "perfil",
  };

  for (const [arquivo, onde] of Object.entries(ESPERADO)) {
    test(`${arquivo} usa onde="${onde}"`, () => {
      const fonte = readFileSync(arquivo, "utf8");
      const achados = [...fonte.matchAll(/<ConviteDoApp[^>]*onde="([a-z]+)"/g)].map((m) => m[1]);
      expect(achados.length).toBeGreaterThan(0);
      for (const a of achados) expect(a).toBe(onde);
    });
  }
});

/**
 * ⚠️ A VITRINE NOMEIA QUEM TROUXE — e o que ela NÃO pode fazer.
 *
 * Quem abriu `/p/<codigo>` veio por causa de UMA pessoa: o link estava na bio
 * dela, no story dela, na mensagem dela. O rodapé antigo falava do app em
 * abstrato e desperdiçava a única coisa que separa essa visita de qualquer
 * outra — um nome que quem lê reconhece.
 */
describe("o rodapé da vitrine", () => {
  test("⚠️ diz o nome de quem trouxe", () => {
    const f = fraseDoRodape("perfil", "Marina");
    expect(f.titulo).toContain("Marina");
    expect(f.sub).toContain("Marina");
  });

  /* ⚠️ PRIMEIRO nome, nunca o completo — quem chama é quem corta, e o teste
     existe para o dia em que alguém passar `display_name` inteiro por engano:
     a frase tem de sair com o que recebeu, sem inventar sobrenome nenhum. */
  test("⚠️ nunca acrescenta nada ao nome recebido", () => {
    const f = fraseDoRodape("perfil", "Marina");
    expect(f.titulo).not.toContain("Costa");
    expect(f.titulo.match(/Marina/g)?.length).toBe(1);
  });

  /* ⚠️ Sem nome, volta à frase antiga — nunca "Alguém está no Obstétrica", que
     lê como erro de sistema no lugar mais visível que este app tem. */
  test("⚠️ sem nome, a frase antiga — nunca um placeholder", () => {
    for (const vazio of [undefined, null, "", "   "]) {
      const f = fraseDoRodape("perfil", vazio);
      expect(f.titulo.toLowerCase()).toContain("perfil");
      expect(f.titulo.toLowerCase()).not.toContain("alguém");
      expect(f.titulo.toLowerCase()).not.toContain("undefined");
    }
  });

  /* ⚠️ E ela continua NÃO prometendo seguir: a página pública não tem esse
     botão, porque seguir exige conta. A proibição já vale para todas as
     frases; aqui ela é reconferida com o nome dentro, que é o caso novo. */
  test("⚠️ com nome, ainda não promete seguir", () => {
    const t = `${fraseDoRodape("perfil", "Marina").titulo} ${fraseDoRodape("perfil", "Marina").sub}`;
    expect(t.toLocaleLowerCase("pt-BR")).not.toContain("siga");
    expect(t.toLocaleLowerCase("pt-BR")).not.toContain("seguir");
  });

  /* As outras quatro páginas ignoram o nome — passar um não muda nada nelas. */
  test("só a vitrine usa o nome", () => {
    for (const onde of ["presentes", "album", "nome", "acompanhante"] as OndeConvida[]) {
      expect(fraseDoRodape(onde, "Marina")).toEqual(fraseDoRodape(onde));
    }
  });
});
