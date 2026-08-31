/**
 * DUAS TELAS DIZIAM "PRONTO" SEM OLHAR A RESPOSTA.
 *
 * ⚠️ **`{ ok: false }` CHEGA NUMA RESPOSTA 200 NORMAL**, e é isso que faz esta
 * classe durar: o `try/catch` em volta não pega nada disso. Sessão expirada,
 * RLS, coluna ausente — tudo volta como sucesso HTTP com `ok` falso.
 *
 * As duas desta leva, e o custo de cada uma:
 *
 *   · **deixar de seguir** (`rede-instagram.tsx`) — o vínculo era apagado da
 *     tela sem conferir nada. Ela deixava de seguir, o servidor recusava, e na
 *     abertura seguinte a pessoa estava lá de novo. ⚠️ **O ramo de SEGUIR, duas
 *     linhas abaixo, já conferia** — a régua aplicada num lado e deixada de pé
 *     no vizinho, que é a forma mais comum de defeito deste repositório.
 *   · **desconectar a agenda do Google** (`painel.tsx`) — a mais cara das duas.
 *     O médico desconecta porque não quer mais que a agenda dele seja lida; a
 *     tela dizia "desconectada" e o token continuava valendo. **Ele fica achando
 *     que cortou um acesso que continua aberto.**
 *
 * ⚠️ A lista é escrita à mão de propósito. Uma varredura por "toda chamada de
 * servidor sem `if (!r.ok)`" pegaria junto as que descartam DE PROPÓSITO — a
 * denúncia de comentário é uma delas, com a razão escrita ao lado ("dizer 'não
 * deu para denunciar' ensina que a denúncia pode falhar"). Catraca com falso
 * positivo é catraca que alguém desliga.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/**
 * A instrução IMEDIATAMENTE seguinte a uma chamada.
 *
 * ⚠️ **Não é "o corpo depois do marcador".** O primeiro `{` depois de
 * `deixarDeSeguir(` é o ARGUMENTO (`{ data: { … } }`), não um corpo — a
 * armadilha de extração por contagem de chaves que este repositório já pagou
 * três vezes. E não é uma janela de N caracteres: o ramo de SEGUIR vive duas
 * linhas abaixo e também escreve `r.ok`, então uma janela larga ficaria verde
 * com a checagem apagada.
 */
function instrucaoApos(fonte: string, marcador: string) {
  const i = fonte.indexOf(marcador);
  expect(i).toBeGreaterThan(-1);

  /* 1 · fecha os parênteses da própria chamada */
  let k = fonte.indexOf("(", i + marcador.length - 1);
  let n = 0;
  for (; k < fonte.length; k++) {
    if (fonte[k] === "(") n++;
    else if (fonte[k] === ")" && --n === 0) break;
  }
  /* 2 · pula o `;` dela */
  k = fonte.indexOf(";", k) + 1;

  /* 3 · lê a próxima instrução até o `;` de profundidade zero */
  let chaves = 0;
  for (let j = k; j < fonte.length; j++) {
    if (fonte[j] === "{") chaves++;
    else if (fonte[j] === "}") chaves--;
    else if (fonte[j] === ";" && chaves <= 0) return fonte.slice(k, j + 1);
  }
  throw new Error(`a instrução depois de ${marcador} não fecha`);
}

describe("a tela lê o que o servidor respondeu", () => {
  test("⚠️ deixar de seguir só some da tela se o servidor aceitou", () => {
    const REDE = semComentarios(readFileSync("src/components/rede-instagram.tsx", "utf8"));
    const depois = instrucaoApos(REDE, "const r = await mod.deixarDeSeguir(");
    /* Cobra a GARANTIA — a limpeza do vínculo depende do `ok` —, e não a
       grafia de um `if`. */
    expect(depois).toMatch(/meuVinculo: null/);
    expect(depois).toMatch(/r\.ok/);
    expect(depois.search(/r\.ok/)).toBeLessThan(depois.indexOf("meuVinculo: null"));
  });

  test("⚠️ desconectar a agenda do Google não afirma o que não aconteceu", () => {
    const PAINEL = semComentarios(readFileSync("src/routes/_authenticated/painel.tsx", "utf8"));
    const depois = instrucaoApos(PAINEL, "const r = await disconnectGoogleCalendar(");
    expect(depois).toMatch(/!r\.ok/);
    /* E o recado diz que ela CONTINUA conectada: um "não foi possível" genérico
       deixaria o médico sem saber se o acesso caiu ou não. */
    expect(depois).toMatch(/continua conectada/i);
  });
});

describe("as duas telas que prometiam sem confirmar", () => {
  test("⚠️ o voto no nome do bebê não tranca sobre um voto que não entrou", () => {
    const VOTAR = semComentarios(readFileSync("src/routes/votar-nome.$token.tsx", "utf8"));
    const depois = instrucaoApos(VOTAR, "const r = await voteForName(");
    /* A votação pode estar encerrada, ou o INSERT recusado — e a tela gravava
       "já votou" no `localStorage` mesmo assim: o voto da avó nunca entrava na
       contagem E ela ficava impedida de tentar de novo. O nome saía de uma
       apuração silenciosamente incompleta.
       ⚠️ E a régua certa mora QUINZE LINHAS ABAIXO, em `handleAddName`. */
    expect(depois).toMatch(/!r\.ok/);
    /* A trava só é gravada DEPOIS da conferência. */
    expect(VOTAR.indexOf("!r.ok")).toBeLessThan(VOTAR.indexOf("localStorage.setItem(`voted_"));
  });

  test("⚠️ o 👎 da nutrição só promete o médico quando o servidor enfileirou", () => {
    const CONTA = semComentarios(readFileSync("src/routes/_authenticated/minha-conta.tsx", "utf8"));
    const i = CONTA.indexOf("async function votar(indice: number");
    expect(i).toBeGreaterThan(-1);
    const corpo = CONTA.slice(i, CONTA.indexOf("\n  }", i));
    /* `submitBrainFeedback` devolve `{ ok: false }` em 200, e só enfileira
       quando há `entryId` — a cota pode ter estourado, o cérebro pode estar
       desligado. Ela reclamava de uma orientação alimentar errada, lia "seu
       médico vai ver", e o item podia não estar em fila nenhuma.
       ⚠️ O chat principal já tinha esta correção, com o comentário à vista. */
    expect(corpo).toMatch(/chegouAoMedico/);
    expect(corpo).toMatch(/"fila"/);
    /* E o rótulo distingue os três estados, senão a promessa volta pela tela. */
    expect(CONTA).toMatch(/votos\[i\] === "fila"/);
  });
});
