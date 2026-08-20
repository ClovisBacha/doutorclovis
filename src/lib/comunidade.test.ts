import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
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

describe("a barra de baixo", () => {
  const CONTA = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  test("⚠️ tocar em Comunidade abre o FEED, não o hub de portas", () => {
    // Pedido do dono: "essa é a primeira tela que tem que ter quando se entra
    // na aba da comunidade — a tela do feed, mostrando as publicações".
    //
    // É a régua do Instagram, e ela está certa: uma aba social que abre num
    // menu de seções cobra um toque a mais para chegar na única coisa que muda
    // sozinha. O hub continua a um toque, no ⊞ do cabeçalho do feed.
    expect(CONTA).toContain('comunidade: "Feed",');
    expect(CONTA).not.toContain('comunidade: "Comunidade",');
  });

  test("⚠️ e a aba do Feed desenha SÓ o feed", () => {
    // As configurações de perfil ficavam acima dele e empurravam as
    // publicações para baixo da dobra — o oposto do que "o feed é a primeira
    // tela" quer dizer. Hoje elas moram no hub, que é onde "meu perfil" mora.
    /* ⚠️ Procura o bloco de RENDER (`{tab === "Feed" && (`), não a primeira
       aparição da string. A frase passou a existir também na condição que
       ESCONDE a barra de cima, que vem antes no arquivo — e a janela de 260
       caracteres caía no lugar errado, reprovando código correto. */
    /* ⚠️ **A JANELA DE 260 CARACTERES NUNCA ALCANÇAVA A REGRESSÃO QUE ELE DIZ
       COBRIR.** `<RedeNoApp>` recebe uma dúzia de props comentadas, então o
       bloco do Feed tem milhares de caracteres — e a janela parava bem antes.
       Só pegaria o defeito se alguém reintroduzisse as configurações
       EXATAMENTE na linha acima do `<RedeNoApp>`; escritas em qualquer outro
       ponto do mesmo bloco, a suíte continuava verde sobre a tela que o dono
       reclamou com a foto do aparelho. O recorte é o BLOCO INTEIRO. */
    const i = CONTA.indexOf('{tab === "Feed" && (');
    expect(i).toBeGreaterThan(-1);
    const proximaAba = CONTA.indexOf("{tab === ", i + 10);
    const bloco = CONTA.slice(i, proximaAba === -1 ? CONTA.length : proximaAba);
    /* Um bloco que caiba na janela antiga é sinal de recorte errado, não de
       bloco curto: `<RedeNoApp>` sozinho passa de mil caracteres. */
    expect(bloco.length).toBeGreaterThan(500);
    expect(bloco).toContain("RedeNoApp");
    expect(bloco).not.toContain("ConfiguracoesDoPerfil");
  });

  test("⚠️ e a barra de cima do app NÃO aparece no Feed", () => {
    // Pedido do dono, com a foto do aparelho: eram duas barras empilhadas
    // (‹ Feed ⚙ Sair, e o cabeçalho da própria tela), e as duas juntas comiam
    // a primeira dobra de um iPhone. O primeiro elemento da aba tem de ser a
    // fileira de stories.
    expect(CONTA).toContain('mobileHome || tab === "Feed" ? "hidden" : "flex"');
  });

  test("⚠️ as ações do feed viram as bolinhas da barra de baixo", () => {
    // Elas não sumiram com o cabeçalho: publicar, buscar, atividade, perfil e
    // salvos passaram a abrir no segundo toque no ícone da Comunidade.
    const REDE = readFileSync("src/components/rede-instagram.tsx", "utf8");
    expect(REDE).toContain('publicarAtalhos("comunidade"');
    for (const acao of ["Publicar", "Buscar", "Atividade", "Meu perfil", "Salvos"]) {
      expect(REDE).toContain(`rotulo: "${acao}"`);
    }
    // E o cabeçalho da tela realmente saiu.
    expect(REDE).not.toContain('<h1 className="text-lg font-semibold tracking-tight">Comunidade');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ⚠️ O ÍCONE DA BARRA VOLTA AO COMEÇO — e não fazia nada
   A aba tem sub-telas próprias (perfil, salvos, caixinha, arquivados, busca) e
   a barra só publica atalhos quando ela está no FEED. De dentro de uma
   sub-tela o toque caía num `setTab("Feed")` que já era "Feed", e a tela não
   se mexia: ela ficava presa num perfil sem nenhuma pista além da seta.
   ══════════════════════════════════════════════════════════════════════════ */
describe("tocar no ícone da Comunidade", () => {
  const CONTA = readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8");
  const REDE = readFileSync("src/components/rede-instagram.tsx", "utf8");

  test("⚠️ a rota manda um SINAL, e ele é um contador", () => {
    expect(CONTA).toContain('if (section === "comunidade") setVoltarAoFeed((n) => n + 1);');
    /* Contador, nunca booleano: precisa disparar de novo a cada toque. */
    expect(CONTA).toContain("useState(0)");
    expect(CONTA).toContain("sinalDeVoltarAoFeed={voltarAoFeed}");
  });

  test("⚠️ a tela responde voltando ao feed e fechando o story", () => {
    const i = REDE.indexOf("const primeiroSinal = useRef(true)");
    expect(i).toBeGreaterThan(-1);
    const efeito = REDE.slice(i, REDE.indexOf("[sinalDeVoltarAoFeed]", i));
    expect(efeito).toContain('setOnde({ t: "feed" })');
    expect(efeito).toContain("setVendoStory(null)");
  });

  /* ⚠️ A primeira passada não faz nada: o efeito roda na montagem, quando ela
     ACABOU de chegar por outro caminho (o hub, um deep-link, o cartão de
     presente). Sem a guarda, abrir a aba já num perfil a jogaria para o feed
     no primeiro quadro. */
  test("⚠️ e a montagem NÃO dispara o retorno", () => {
    const i = REDE.indexOf("const primeiroSinal = useRef(true)");
    const efeito = REDE.slice(i, REDE.indexOf("[sinalDeVoltarAoFeed]", i));
    expect(efeito).toContain("if (primeiroSinal.current)");
    expect(efeito.indexOf("primeiroSinal.current = false")).toBeLessThan(
      efeito.indexOf('setOnde({ t: "feed" })'),
    );
  });

  /* ⚠️ E a fita de categorias do computador navega por `goToTab`, nunca por
     `setTab` cru — a MESMA lição da pílula das Recompensas: `setTab` não limpa
     `consultasSub`, e quem tivesse aberto uma sub-tela voltava a cair nela a
     cada troca de categoria. */
  test("⚠️ a fita do desktop usa `goToTab`", () => {
    const i = CONTA.indexOf("CATEGORIES.map((cat)");
    expect(i).toBeGreaterThan(-1);
    const fita = CONTA.slice(i, CONTA.indexOf("</button>", i));
    expect(fita).toContain("goToTab(cat.tabs[0])");
    expect(fita).not.toContain("setTab(cat.tabs[0])");
  });
});
