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

/** Só o corpo de uma função da tela — nunca até o fim do arquivo. */
function corpoDe(nome: string): string {
  const i = FONTE.indexOf(`async function ${nome}(`);
  expect(i).toBeGreaterThan(-1);
  const resto = FONTE.slice(i + 10);
  const j = resto.indexOf("\n  }\n");
  return j === -1 ? resto : resto.slice(0, j);
}

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

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ AS TRÊS AÇÕES QUE MENTIAM NA TELA
   As três eram otimistas (o que é o certo) e nenhuma sabia desfazer: a tela
   dizia "pronto" sobre coisa que o servidor tinha recusado.
   ══════════════════════════════════════════════════════════════════════════ */
describe("salvar", () => {
  /* ⚠️ O servidor gravava e o marcador do cartão sugerido não mudava — e
     salvar a publicação de uma desconhecida é justamente o gesto que a zona
     de sugeridos existe para provocar. */
  test("⚠️ pinta as TRÊS listas, inclusive os sugeridos", () => {
    const corpo = corpoDe("guardar");
    expect(corpo).toContain("setPosts(aplicar)");
    expect(corpo).toContain("setDoPerfil(aplicar)");
    expect(corpo).toContain("setSugestoes(aplicar)");
  });
});

describe("tirar a própria marcação", () => {
  /* ⚠️ A tela já tinha tirado o nome dela do post; um `ok: false` deixava a
     mentira na tela e ela ia embora achando que tinha saído da foto. É a
     defesa dela contra aparecer onde não quer. */
  test("⚠️ recusa do servidor volta atrás e avisa", () => {
    const corpo = corpoDe("tirarMarcacao");
    expect(corpo).toContain("const r = await tirarMinhaMarcacao(");
    expect(corpo).toContain("if (!r.ok)");
    expect(corpo).toContain("toast.error");
  });
});

describe("publicar story", () => {
  /* ⚠️ O story passa pela MESMA régua clínica do post, e o `!r.ok` caía num
     `if` sem `else`: a tela de conferência fechava e nada dizia nada. Ela
     concluía que o app tinha travado e mandava de novo, com o mesmo texto. */
  test("⚠️ a recusa chega à tela, com o recado do SERVIDOR", () => {
    const corpo = corpoDe("publicarStory");
    expect(corpo).toContain("toast.error");
    expect(corpo).toContain('"recado" in r && r.recado');
  });
});

describe("o rascunho do compositor", () => {
  /* ⚠️ O efeito rodava na montagem com os campos vazios e, 700 ms depois,
     APAGAVA o rascunho guardado — `paraGuardar` devolve `guardar: false` para
     rascunho vazio, que é a regra certa. A faixa "você tinha um rascunho"
     continuava na tela porque o texto já estava em memória: quem tocasse em
     "Recuperar" na hora não via nada de errado, e quem voltasse depois perdia
     o texto para sempre. */
  test("⚠️ a primeira passada do efeito NÃO grava", () => {
    const i = FONTE.indexOf("const primeiraPintura = useRef(true)");
    expect(i).toBeGreaterThan(-1);
    const efeito = FONTE.slice(i, FONTE.indexOf("}, [texto, vis, opcoes", i));
    expect(efeito).toContain("if (primeiraPintura.current)");
    expect(efeito).toContain("primeiraPintura.current = false");
    /* E o `return` vem ANTES do `setTimeout`, senão o adiamento continua
       agendado e o rascunho é apagado do mesmo jeito. */
    expect(efeito.indexOf("primeiraPintura.current = false")).toBeLessThan(
      efeito.indexOf("setTimeout"),
    );
  });
});

describe("a enquete do story", () => {
  const visor = FONTE.slice(FONTE.indexOf("{atual.enquete && ("));

  /* ⚠️ "67%" são dois votos de três, e numa base pequena a porcentagem
     transforma três pessoas numa maioria. O post do feed já dizia os dois; o
     story dizia só a fração — a mesma enquete contando duas histórias. */
  test("⚠️ mostra o NÚMERO junto da porcentagem", () => {
    const bloco = visor.slice(0, visor.indexOf("Toque para votar"));
    expect(bloco).toContain("{fatia}%");
    expect(bloco).toContain("rotuloDeVotos(votos)");
  });

  /* ⚠️ O comentário do bloco prometia que a enquete pausa o relógio e nada o
     fazia: só a caixinha pausava, no `onFocus` do campo. Ler quatro opções e
     escolher leva mais que os cinco segundos do story. */
  test("⚠️ e ela PARA o relógio enquanto o voto não sai", () => {
    expect(FONTE).toContain("const enqueteEsperando =");
    expect(FONTE).toContain("|| enqueteEsperando ||");
  });
});
