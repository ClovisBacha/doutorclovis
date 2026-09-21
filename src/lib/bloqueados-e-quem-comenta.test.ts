import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  QUEM_COMENTA,
  QUEM_COMENTA_PADRAO,
  apertarQuemComenta,
  podeComentar,
  quemComentaDe,
} from "./rede-social";

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const COMENTARIOS = readFileSync("src/lib/comentarios.functions.ts", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(fonte: string, nome: string): string {
  const s = semProsa(fonte);
  const i = s.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\nexport const ", i + 10);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ a lista de bloqueados — bloquear era um beco sem saída", () => {
  const C = corpoDe(FONTE, "meusBloqueados");

  test("⚠️ ela IGNORA o próprio bloqueio, e é a única leitura que faz isso", () => {
    /**
     * Quem eu bloqueei está, por construção, escondida de mim em todo lugar — e
     * é justamente aqui que ela PRECISA aparecer, senão a lista vem vazia e o
     * desbloqueio é impossível. Por isso `perfisPorId` e não a régua de
     * visibilidade.
     */
    expect(C).toContain("perfisPorId(sb, ids)");
    expect(C).not.toContain("podeVerPost");
  });

  test("⚠️ é PRIVADA: não existe alvo vindo do cliente", () => {
    /* A lista de quem alguém bloqueou é a lista das pessoas com quem ela teve
       problema — num app onde as pacientes se conhecem da vida real, é o dado
       mais explosivo da aba. */
    expect(C).toContain('.eq("quem_id", eu)');
    expect(C.slice(0, C.indexOf(".handler("))).not.toContain("alvoId");
  });

  test("⚠️ falha de leitura devolve ERRO, e nunca lista vazia", () => {
    /* "Você não bloqueou ninguém" faria ela concluir que o bloqueio não pegou —
       e talvez bloquear de novo, ou desistir de bloquear. */
    expect(C).toContain('motivo: "banco"');
  });

  test("mostra NOME e FOTO, e não uuid", () => {
    /* Um bloqueio guardado como uuid seria uma lista que ela não consegue ler:
       para desbloquear, precisaria adivinhar quem é cada linha. */
    expect(C).toContain("naFileira(");
  });

  test("⚠️ e a tela tem a PORTA — senão a função não existe para ninguém", () => {
    const tela = readFileSync("src/components/rede-instagram.tsx", "utf8");
    expect(tela).toContain("meusBloqueados");
    expect(semProsa(tela)).toContain('rotulo: "Bloqueados"');
  });

  test("⚠️ e ela é COMPONENTE, para poder ser fotografada", () => {
    /**
     * Era a única tela de segurança da aba sem bancada — e os três estados que
     * mais importam não se fabricam numa conta de teste: a leitura falhando,
     * a lista carregando e "ninguém". Enquanto vivia dentro de `RedeNoApp`,
     * olhar para ela era impossível.
     */
    const tela = semProsa(readFileSync("src/components/rede-instagram.tsx", "utf8"));
    expect(tela).toContain("export function ListaDeBloqueados");
    /* Ela não busca nada: recebe tudo por prop, como o alerta de SOS. */
    const i = tela.indexOf("export function ListaDeBloqueados");
    expect(tela.slice(i, i + 3000)).not.toContain("await import");
    const bancada = readFileSync("src/routes/preview-instagram.tsx", "utf8");
    expect(bancada).toContain("ListaDeBloqueados");
  });
});

describe("a régua de quem comenta", () => {
  test("o padrão é `todos` — o comportamento de hoje", () => {
    /* Fechar por padrão emudeceria as conversas já existentes sem ninguém ter
       pedido. */
    expect(QUEM_COMENTA_PADRAO).toBe("todos");
    expect(QUEM_COMENTA.map((q) => q.chave)).toEqual(["todos", "seguidores", "amigas"]);
  });

  test("desconhecido cai no padrão", () => {
    for (const lixo of [undefined, null, "", "publico", 42, {}]) {
      expect(quemComentaDe(lixo)).toBe("todos");
    }
    expect(quemComentaDe("amigas")).toBe("amigas");
  });

  test("⚠️ NUNCA mais aberta que a visibilidade", () => {
    /**
     * Um post da camada `amigas` com "todo mundo pode comentar" é uma combinação
     * sem sentido: as pessoas a quem "todo mundo" se refere não veem a
     * publicação. Oferecê-la faria a autora acreditar que abriu a conversa
     * quando não abriu nada.
     */
    expect(apertarQuemComenta({ visibilidade: "amigas", quemComenta: "todos" })).toBe("amigas");
    expect(apertarQuemComenta({ visibilidade: "amigas", quemComenta: "seguidores" })).toBe(
      "amigas",
    );
    expect(apertarQuemComenta({ visibilidade: "seguidores", quemComenta: "todos" })).toBe(
      "seguidores",
    );
  });

  test("⚠️ mas `todos` num post PÚBLICO continua `todos`", () => {
    /* Ali "todos os que veem" É todo mundo — o aperto só acontece quando a
       publicação é mais fechada. */
    expect(apertarQuemComenta({ visibilidade: "publico", quemComenta: "todos" })).toBe("todos");
  });

  test("⚠️ e apertar NUNCA abre: `amigas` num post público segue `amigas`", () => {
    expect(apertarQuemComenta({ visibilidade: "publico", quemComenta: "amigas" })).toBe("amigas");
  });
});

describe("⚠️ quem pode comentar", () => {
  const base = { euId: "eu", autorId: "ela", sigoAtivo: false, somosAmigas: false };

  test("`todos` deixa qualquer um que veja", () => {
    expect(podeComentar({ ...base, quemComenta: "todos" })).toBe(true);
  });

  test("`amigas` recusa quem só segue", () => {
    expect(podeComentar({ ...base, quemComenta: "amigas", sigoAtivo: true })).toBe(false);
    expect(podeComentar({ ...base, quemComenta: "amigas", somosAmigas: true })).toBe(true);
  });

  test("⚠️ `seguidores` aceita a AMIGA que não segue", () => {
    /* O grafo de amizade deste app é um vínculo mais forte que seguir; barrar a
       amiga seria a régua contradizendo a própria escada. */
    expect(podeComentar({ ...base, quemComenta: "seguidores", somosAmigas: true })).toBe(true);
  });

  test("⚠️ a AUTORA sempre pode, inclusive no próprio post fechado", () => {
    /* Responder a quem comentou é o uso mais comum, e uma régua que a barrasse
       tornaria "só amigas" inutilizável para quem ainda não tem amigas na rede. */
    expect(
      podeComentar({
        euId: "ela",
        autorId: "ela",
        quemComenta: "amigas",
        sigoAtivo: false,
        somosAmigas: false,
      }),
    ).toBe(true);
  });
});

describe("⚠️ o servidor aplica a camada ao comentar", () => {
  const C = corpoDe(COMENTARIOS, "comentar");

  test("a régua roda, e é apertada antes", () => {
    expect(C).toContain("podeComentar({");
    expect(C).toContain("apertarQuemComenta({");
  });

  test("⚠️ e a recusa tem motivo PRÓPRIO", () => {
    /* "indisponivel" faria a tela dizer que o post sumiu, sobre um post que está
       lá e que ela está lendo. */
    expect(C).toContain('motivo: "so_convidadas"');
  });

  test("⚠️ a leitura devolve `possoComentar` — a tela não decide", () => {
    /* Uma segunda régua na tela ofereceria o campo e o servidor recusaria depois
       de ela ter escrito. */
    const L = corpoDe(COMENTARIOS, "comentariosDoPost");
    expect(L).toContain("possoComentar: podeComentar({");
  });

  test("⚠️ e há DEGRAU para a coluna nova", () => {
    /* Sem `quem_comenta`, todo post aceita comentário de quem o vê — o estado de
       antes do recurso, e o único seguro: fechar por não saber emudeceria
       conversas que já existem. */
    expect(COMENTARIOS).toContain("APLICAR_DEZ_DA_REDE.sql");
  });
});
