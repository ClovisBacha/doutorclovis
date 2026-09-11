/**
 * A TROCA DE FORMATO — o único ganho de banda que não custa qualidade.
 *
 * O que se cobra aqui: que a sonda pegue a FALHA SILENCIOSA (navegador que
 * devolve PNG quando pedem WebP), que todo ponto do app que produz foto passe
 * por uma função só, e que o cartão de compartilhar continue FORA disso.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { codificarFoto, esquecerSondaDeWebp, suportaWebp } from "./codificar-imagem";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/**
 * Um `document` de mentira com UMA pergunta: o que `toDataURL("image/webp")`
 * devolve? É exatamente a única coisa que a sonda olha.
 */
function comNavegador(devolve: (tipo: string) => string) {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({
      width: 0,
      height: 0,
      toDataURL: (tipo: string) => devolve(tipo),
    }),
  };
  esquecerSondaDeWebp();
}

/** Um canvas de mentira que ECOA o tipo pedido e anota cada chamada. */
function canvasFalso(anota: { tipo: string; q: number }[] = []) {
  return {
    anota,
    canvas: {
      toDataURL: (tipo: string, q: number) => {
        anota.push({ tipo, q });
        return `data:${tipo};base64,zz`;
      },
    } as unknown as HTMLCanvasElement,
  };
}

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
  esquecerSondaDeWebp();
});

describe("a sonda de WebP", () => {
  test("⚠️ o navegador que devolve PNG em silêncio é RECUSADO", () => {
    /* A armadilha inteira. `toDataURL("image/webp")` num navegador que não
       sabe codificar WebP **não dá erro** — devolve um PNG com o mesmo
       formato de data URL. E PNG de foto são megabytes: a publicação
       estouraria o teto do servidor e seria recusada, com a paciente sem
       entender por quê. Só ler o que VOLTOU pega isso. */
    comNavegador((t) =>
      t === "image/webp" ? "data:image/png;base64,zz" : "data:image/jpeg;base64,zz",
    );
    expect(suportaWebp()).toBe(false);
    const { canvas } = canvasFalso();
    expect(codificarFoto(canvas, 0.72).startsWith("data:image/jpeg")).toBe(true);
  });

  test("o navegador que sabe codificar é aceito", () => {
    comNavegador((t) => `data:${t};base64,zz`);
    expect(suportaWebp()).toBe(true);
    const { canvas } = canvasFalso();
    expect(codificarFoto(canvas, 0.72).startsWith("data:image/webp")).toBe(true);
  });

  test("⚠️ sem `document` — no servidor — a resposta é NÃO", () => {
    /* O SSR não codifica foto nenhuma; o que importa é ele não estourar e não
       afirmar suporte que ninguém conferiu. */
    esquecerSondaDeWebp();
    expect(suportaWebp()).toBe(false);
  });

  test("⚠️ `toDataURL` que ESTOURA cai no JPEG, e não derruba a publicação", () => {
    comNavegador(() => {
      throw new Error("canvas sujo");
    });
    expect(suportaWebp()).toBe(false);
  });

  test("a sonda pergunta UMA vez", () => {
    /* Ela roda a cada foto preparada; sem memória, seria um canvas descartável
       por foto de um carrossel de dez. */
    let sondas = 0;
    comNavegador((t) => {
      sondas++;
      return `data:${t};base64,zz`;
    });
    const { canvas } = canvasFalso();
    codificarFoto(canvas, 0.8);
    codificarFoto(canvas, 0.8);
    codificarFoto(canvas, 0.8);
    expect(sondas).toBe(1);
  });
});

describe("o número da qualidade atravessa a troca de formato", () => {
  test("⚠️ o MESMO número vai para os dois formatos", () => {
    /* Trocar de formato é de graça em qualidade; mexer no NÚMERO não é. Se um
       dia alguém baixar a qualidade "porque WebP aguenta", que seja decisão
       escrita, e não efeito colateral desta função. */
    comNavegador((t) => `data:${t};base64,zz`);
    const com = canvasFalso();
    codificarFoto(com.canvas, 0.72);
    expect(com.anota).toEqual([{ tipo: "image/webp", q: 0.72 }]);

    comNavegador((t) => (t === "image/webp" ? "data:image/png;base64,z" : `data:${t};base64,z`));
    const sem = canvasFalso();
    codificarFoto(sem.canvas, 0.72);
    expect(sem.anota).toEqual([{ tipo: "image/jpeg", q: 0.72 }]);
  });
});

describe("o carrossel não baixa foto que ninguém está vendo", () => {
  const TELA = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));

  test("⚠️ a foto só ganha `src` quando chega a vez dela", () => {
    /* `loading="lazy"` NÃO segura o eixo horizontal — medido no Chromium: numa
       lista de seis publicações de cinco fotos ele baixa TRÊS de cada uma das
       cinco primeiras, quinze arquivos, para a paciente ver uma. Sem `src` a
       imagem não é pedida, e é só isso que segura. */
    expect(TELA).toMatch(/src=\{n <= ate \+ 1 \? u : undefined\}/);
  });

  test("⚠️ a régua é 'a da vez MAIS a seguinte'", () => {
    /* Segurar tudo menos a primeira economiza mais e cobra em outra moeda: a
       foto seguinte apareceria em branco durante o deslize, que é o gesto com
       que ela descobre que há mais foto. Numa publicação de ultrassom isso é
       péssimo — e "sem perder qualidade" inclui a resposta ao dedo. */
    expect(TELA).toContain("Math.max(v, n + 1)");
  });

  test("⚠️ o limite só SOBE", () => {
    /* Com `setAte(n + 1)` cru, voltar para a primeira foto descarregaria as
       outras — e folhear para trás baixaria tudo de novo, que é o oposto. */
    expect(TELA).not.toMatch(/setAte\(n \+ 1\)/);
  });
});

describe("quem passa por aqui, e quem não passa", () => {
  const NO_APP = [
    "src/components/rede-instagram.tsx",
    "src/routes/album.$token.tsx",
    "src/routes/_authenticated/minha-conta.tsx",
  ];

  test("⚠️ nenhuma foto do app é codificada em JPEG cru", () => {
    /* Um `toDataURL("image/jpeg")` solto é um ponto que ficou de fora da
       troca — e ele não quebra nada, só continua gastando 29% a mais em
       silêncio, que é como um ganho destes se perde com o tempo. */
    const culpados: string[] = [];
    for (const arquivo of NO_APP) {
      const codigo = semComentarios(readFileSync(arquivo, "utf8"));
      if (codigo.includes('toDataURL("image/jpeg"')) culpados.push(arquivo);
    }
    expect(culpados).toEqual([]);
  });

  test("os três chamam `codificarFoto`", () => {
    for (const arquivo of NO_APP) {
      expect(semComentarios(readFileSync(arquivo, "utf8"))).toContain("codificarFoto(");
    }
  });

  test("⚠️ o cartão de COMPARTILHAR continua em JPEG, de propósito", () => {
    /* Ele sai do app — WhatsApp, Instagram, a galeria do celular. Economizar
       29% de uma imagem que sai uma vez não paga o risco de ela não abrir do
       outro lado. Se um dia alguém "uniformizar" isto, que seja lendo esta
       linha primeiro. */
    const cartao = semComentarios(readFileSync("src/lib/share-card.ts", "utf8"));
    expect(cartao).toContain('toDataURL("image/jpeg"');
    expect(cartao).not.toContain("codificarFoto");
  });

  test("⚠️ o servidor sabe guardar o que o cliente passou a mandar", () => {
    /* A extensão sai do tipo MIME. Sem o ramo do WebP o arquivo iria para o
       balde com nome `.jpg` e conteúdo WebP — abre na maioria dos lugares e
       quebra em alguns, que é o pior tipo de defeito. */
    const servidor = semComentarios(readFileSync("src/lib/imagens.server.ts", "utf8"));
    expect(servidor).toContain('"image/webp"');
    expect(servidor).toContain('"webp"');
  });

  test("⚠️ a sonda não é chamada dentro de um render", () => {
    /* Ela toca `document`: no SSR responderia uma coisa e no cliente outra, e
       o React descarta a árvore quando as duas discordam. Este app já ficou
       SEM ABRIR por um defeito dessa família. A catraca geral vive em
       `capacidade-fora-do-render.test.ts`; aqui fica o caso deste módulo. */
    for (const arquivo of NO_APP) {
      const codigo = semComentarios(readFileSync(arquivo, "utf8"));
      expect(codigo).not.toContain("{suportaWebp(");
      expect(codigo).not.toContain("{ suportaWebp(");
    }
  });
});
