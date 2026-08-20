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

describe("a tela de um post só", () => {
  /* ⚠️ **É o caminho mais provável do "ver quem reagiu", e era o único sem a
     prop.** A autora abre a grade do próprio perfil e toca num post de duas
     semanas atrás: o resumo com os emojis vinha desenhado como texto morto,
     ela tocava no número e nada acontecia. O único caminho vivo era achar o
     mesmo post rolando o feed cronológico — que depois de algumas páginas não
     existe mais. */
  test("⚠️ `TelaDoPost` recebe `aoVerQuemReagiu`", () => {
    const i = FONTE.indexOf("<TelaDoPost");
    expect(i).toBeGreaterThan(-1);
    const tag = FONTE.slice(i, FONTE.indexOf("/>", i));
    expect(tag).toContain("aoVerQuemReagiu=");
  });
});

describe("quem viu o meu story", () => {
  /* ⚠️ **Falha de leitura virava "Ninguém viu ainda"** — a única recompensa de
     publicar um story transformada na informação errada, sem nada que a
     distinguisse de um erro. Mesma régua de `chavesResgatadas` e
     `contarTrofeus`: falha ao LER nunca vira "não tem". */
  test("⚠️ `null` é falha e `[]` é ninguém — e a tela distingue os dois", () => {
    const i = FONTE.indexOf("async function quemViu(");
    expect(i).toBeGreaterThan(-1);
    const corpo = FONTE.slice(i, FONTE.indexOf("\n  }\n", i));
    expect(corpo).toContain("r.ok ? r.gente : null");
    expect(corpo).not.toContain("return [];");
    /* E o estado guarda o terceiro caso, senão o `??` volta a achatar. */
    expect(FONTE).toContain('PessoaNaLista[] | "erro" | null');
    expect(FONTE).toContain('setQuemViu((await aoQuemViu(atual.id)) ?? "erro")');
    expect(FONTE).toContain("Não deu para carregar agora.");
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   O CONVITE PELO WHATSAPP — e o defeito que ele não pode repetir
   A aba das Amigas já teve um "Convidar" que mandava `/auth` PURO: a amiga
   criava a conta e nunca virava amiga dela — não aparecia na lista, não dava
   para formar dupla, e as 100 🌱 não eram pagas a ninguém. O botão da tela cujo
   assunto inteiro é trazer alguém era o único caminho do app que não trazia.
   ══════════════════════════════════════════════════════════════════════════ */
describe("convidar pela Comunidade", () => {
  const i = FONTE.indexOf("function ConvidarPeloWhatsApp");
  const corpo = FONTE.slice(i, FONTE.indexOf("\n}\n", i));

  test("existe", () => {
    expect(i).toBeGreaterThan(-1);
  });

  /* ⚠️ O link é o de INDICAÇÃO, e sai da régua única — nunca montado à mão. */
  test("⚠️ o link carrega o código, pela mesma `linkDeIndicacao`", () => {
    expect(corpo).toContain("linkDeIndicacao(codigo");
    expect(corpo).toContain("linkDoWhatsApp(texto)");
    expect(corpo).toContain("mensagemDeConvite(link)");
  });

  /* ⚠️ Sem código o cartão NÃO aparece: um convite sem indicação é
     indistinguível de um bom para quem manda e para quem recebe, e ela só tem
     a atenção da amiga uma vez. */
  test("⚠️ sem código, não desenha nada", () => {
    expect(corpo).toContain("if (!codigo) return null;");
    expect(corpo).toContain("if (!link) return null;");
  });

  /* ⚠️ `location.origin` no RENDER quebrou a hidratação na primeira foto desta
     tela (servidor sem `window`, cliente com) — e, pior, em preview mandaria
     um endereço que a amiga não consegue abrir. */
  test("⚠️ o domínio é o de produção, nunca `location.origin`", () => {
    /* ⚠️ **SEM COMENTÁRIOS antes de procurar** — a primeira execução deste
       teste ficou VERMELHA sobre código correto, porque o comentário que
       explica a decisão contém a própria string proibida. É a armadilha que o
       cabeçalho de `caixinha-servidor.test.ts` descreve, nas duas direções. */
    const semComentarios = corpo
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
    expect(semComentarios).toContain("linkDeIndicacao(codigo, SITE)");
    expect(semComentarios).not.toContain("location.origin");
  });

  /* ⚠️ Modo Cuidado: o portão mora em quem monta o `convite`, e não em cada
     aparição do cartão — a mensagem diz "na minha gestação" na primeira
     pessoa, e o app não põe essas palavras na boca de quem acabou de perder a
     gestação. */
  test("⚠️ o portão do luto está em `RedeNoApp`, uma vez só", () => {
    const efeito = FONTE.slice(FONTE.indexOf("Carrega o código de indicação"));
    expect(efeito.slice(0, 900)).toContain("if (careMode) {");
    expect(efeito.slice(0, 900)).toContain("setMeuCodigo(null)");
  });

  /* Os dois pontos de uso: o feed vazio e o fim do feed. */
  test("aparece no vazio e no fim do feed", () => {
    const usos = FONTE.split("<ConvidarPeloWhatsApp").length - 1;
    expect(usos).toBe(2);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ONDE ELA PAROU DE LER — a plumaria de DOM (a régua está em `lugar-no-feed`)
   ══════════════════════════════════════════════════════════════════════════ */
describe("o lugar no feed", () => {
  const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(
    /\{\/\*[\s\S]*?\*\/\}/g,
    " ",
  );

  /* ⚠️ A âncora é o ID DO POST, e não pixels: as fotos chegam por URL assinada
     depois da primeira pintura, então a altura da lista muda embaixo de
     qualquer número de rolagem. */
  test("⚠️ cada post carrega `data-post`", () => {
    expect(semComentarios).toContain("<article data-post={post.id}");
    expect(semComentarios).toContain('querySelectorAll<HTMLElement>("article[data-post]")');
  });

  /* ⚠️ `sessionStorage`: "onde eu parei" morre com a aba. Entre sessões,
     devolveria a paciente ao meio de um feed que mudou inteiro — e o que ela
     quer de manhã é o que apareceu de novo. */
  test("⚠️ é `sessionStorage`, nunca `localStorage`", () => {
    const i = semComentarios.indexOf("const guardarOLugar");
    expect(i).toBeGreaterThan(-1);
    const bloco = semComentarios.slice(i, semComentarios.indexOf("}, [euId]);", i));
    expect(bloco).toContain("sessionStorage.setItem");
    expect(bloco).not.toContain("localStorage");
  });

  /* ⚠️ Medido no navegador: `styles.css` põe `scroll-behavior: smooth` no
     `<html>`, e `auto` quer dizer "use o CSS" — a volta saía como uma rolagem
     ANIMADA de 2.500 px na abertura da aba. */
  test("⚠️ a volta é `instant`, e nunca `auto`", () => {
    expect(semComentarios).toContain('behavior: "instant"');
    expect(semComentarios).not.toContain('scrollIntoView({ block: "start", behavior: "auto" })');
  });

  /* ⚠️ O efeito depende de `posts`, que muda a cada página da rolagem infinita:
     sem a trava, cada página nova puxaria a tela de volta ao mesmo post — a
     paciente rolando para baixo e o app puxando para cima. */
  test("⚠️ volta UMA vez por montagem", () => {
    expect(semComentarios).toContain("const jaVoltei = useRef(false)");
    expect(semComentarios).toContain("if (jaVoltei.current ||");
  });

  /* ⚠️ O toque no ícone da barra é um pedido explícito de voltar ao começo —
     sem apagar o lugar, a próxima abertura devolveria a paciente ao ponto que
     ela acabou de dizer que não queria. */
  test("⚠️ o toque no ícone da barra APAGA o lugar", () => {
    const i = semComentarios.indexOf("const primeiroSinal = useRef(true)");
    expect(i).toBeGreaterThan(-1);
    const efeito = semComentarios.slice(i, semComentarios.indexOf("[sinalDeVoltarAoFeed]", i));
    expect(efeito).toContain("esquecerOLugar()");
  });
});

describe("o lembrete do então e agora", () => {
  const semComentarios = FONTE.replace(/\/\*[\s\S]*?\*\//g, " ").replace(
    /\{\/\*[\s\S]*?\*\/\}/g,
    " ",
  );

  /* ⚠️ Quem DECIDE é a régua pura, com o portão do Modo Cuidado dentro — a tela
     não pode ter uma segunda condição, que é como o luto volta pela lateral. */
  test("⚠️ a decisão sai de `lembreteDoEntao`, e o luto vai como fato", () => {
    const i = semComentarios.indexOf("lembreteDoEntao({");
    expect(i).toBeGreaterThan(-1);
    const chamada = semComentarios.slice(i, semComentarios.indexOf("});", i));
    expect(chamada).toContain("candidatos: paraComparar");
    expect(chamada).toContain("emCuidado: careMode");
  });

  /* ⚠️ Ignorar é a resposta mais comum a qualquer cartão. Contado só pela
     dispensa, o lembrete voltaria em TODA abertura da aba para quem rolou por
     cima dele. */
  test("⚠️ o carimbo é gravado quando ele APARECE, não ao dispensar", () => {
    const i = semComentarios.indexOf("lembreteDoEntao({");
    const depois = semComentarios.slice(i, i + 900);
    expect(depois).toContain("localStorage.setItem(chave, new Date().toISOString())");
    /* E antes de o cartão ir para a tela — nunca depois de um `if` de dispensa. */
    expect(depois.indexOf("localStorage.setItem(chave")).toBeLessThan(
      depois.indexOf("setLembreteEntao({"),
    );
  });

  /* ⚠️ Dois cartões empilhados entre os stories e o primeiro post empurram o
     feed para fora da dobra — o arranjo que o dono pediu para corrigir. */
  test("⚠️ um cartão de cada vez: a retrospectiva ganha", () => {
    expect(semComentarios).toContain("{!retro && lembreteEntao && aoCompararAgora");
  });

  /* ⚠️ Sem isto, tocar em "Comparar" abriria o compositor com a comparação
     desligada: o cartão prometeria uma coisa e entregaria outra. */
  test("⚠️ o compositor abre JÁ comparando, e zera ao fechar", () => {
    expect(semComentarios).toContain("useState<string | null>(entaoInicial ?? null)");
    expect(semComentarios).toContain("entaoInicial={entaoEscolhido}");
    expect(semComentarios).toContain("setEntaoEscolhido(null)");
  });
});
