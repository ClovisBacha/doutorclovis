/**
 * ⚠️ A FILA DE MODERAÇÃO FECHA O CICLO.
 *
 * ─── OS DEFEITOS QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ───────────────────────
 *
 * 1. **O desfecho nunca era mandado.** O servidor aceita
 *    `removido | avisado | sem_acao`; a tela chamava sem nenhum. Toda denúncia
 *    era resolvida como "sem ação", e a tela "Suas denúncias" da paciente dizia
 *    "ainda não olhamos" **para sempre** — o ciclo que a plataforma promete
 *    fechar não fechava.
 *
 * 2. **"Removido" não removia nada.** O desfecho volta para quem denunciou:
 *    dizer "A publicação saiu do ar" sem tirá-la do ar é a plataforma mentindo
 *    para quem confiou nela — e a paciente veria, no feed, a mesma publicação
 *    que o app disse ter removido.
 *
 * 3. **A fila não tinha contador.** Ela vive dentro da aba de entrada, então
 *    quem estivesse noutra aba não sabia que ela cresceu.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BAIXA_DO_ALVO, PODE_REMOVER, rotuloDoAlvo } from "./denuncias";

/** A prosa deste repositório cita o que ele proíbe — some antes de procurar. */
const semProsa = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("⚠️ o desfecho sai da tela e chega no servidor", () => {
  const TELA = semProsa("src/components/fila-de-denuncias.tsx");

  test("a tela MANDA o desfecho — os três", () => {
    for (const d of ["removido", "avisado", "sem_acao"]) {
      expect(TELA).toContain(`resolver(d.id, "${d}")`);
    }
  });

  test("⚠️ e ela não resolve mais sem dizer o que foi feito", () => {
    /* ⚠️ Escopado à fila DA REDE. A da caixinha resolve sem desfecho de
       propósito — lá não há publicação a remover nem conta a avisar, e a
       primeira versão deste teste reprovou aquela chamada, que está certa. */
    /* ⚠️ Âncora SEM os parênteses vazios: a assinatura ganhou a prop de
       bancada e virou `FilaDaRede({ bancada })` — um teste que trava a grafia
       da assinatura reprova sobre código que continua certo. */
    const i = TELA.indexOf("function FilaDaRede(");
    expect(i).toBeGreaterThan(0);
    const daRede = TELA.slice(i);
    expect(daRede).not.toMatch(/resolver\(d\.id\)/);
    expect(daRede).toMatch(/desfecho\s*[,}]/);
  });

  test('⚠️ "Remover" só aparece onde HÁ o que remover', () => {
    expect(TELA).toContain("PODE_REMOVER.includes(d.alvo)");
  });

  test("⚠️ a recusa NÃO some a linha da fila", () => {
    /* Um desfecho que não corresponde ao que aconteceu é pior que nenhum: se a
       baixa falha, a denúncia continua na fila e o administrador sabe. */
    const i = TELA.indexOf("async function resolver(");
    const corpo = TELA.slice(i, TELA.indexOf("\n  }", i));
    const sucesso = corpo.indexOf("if (r.ok)");
    const filtra = corpo.indexOf("setFila((f) => f.filter");
    expect(sucesso).toBeGreaterThan(0);
    expect(filtra).toBeGreaterThan(sucesso);
  });
});

describe('⚠️ "removido" remove de verdade', () => {
  const SRV = semProsa("src/lib/rede-social.functions.ts");
  const i = SRV.indexOf("export const resolverDenunciaDaRede");
  const corpo = SRV.slice(i, SRV.indexOf("\nexport const", i + 10));

  test("o handler dá baixa no alvo antes de gravar o desfecho", () => {
    expect(i).toBeGreaterThan(0);
    expect(corpo).toContain('desfecho === "removido"');
    expect(corpo).toContain("BAIXA_DO_ALVO");
  });

  test("⚠️ falhar em remover NÃO vira 'removido'", () => {
    const j = corpo.indexOf("erroBaixa");
    expect(j).toBeGreaterThan(0);
    const ramo = corpo.slice(j, j + 260);
    expect(ramo).toMatch(/return \{ ok: false/);
  });

  test("⚠️ alvo sem publicação recusa, em vez de mentir", () => {
    expect(corpo).toContain("nao_removivel");
  });

  test("⚠️ e ARQUIVA, nunca APAGA — remoção por engano tem de ser desfazível", () => {
    for (const alvo of PODE_REMOVER) {
      const b = BAIXA_DO_ALVO[alvo]!;
      expect(b.coluna).toMatch(/_em$/);
    }
    // Nenhum `.delete()` no ramo da remoção.
    const j = corpo.indexOf('desfecho === "removido"');
    expect(corpo.slice(j, j + 900)).not.toContain(".delete(");
  });

  test("⚠️ o mapa NÃO mora no arquivo da rede — ele não conhece comentário", () => {
    /* Há teste próprio (`rede-social-servidor`) cobrando isso, e foi ele que
       pegou a primeira versão desta função. O mapa é dado, em `denuncias.ts`. */
    expect(SRV).not.toContain("rede_comentarios");
    expect(BAIXA_DO_ALVO.comentario?.tabela).toBe("rede_comentarios");
  });
});

describe("⚠️ o contador da fila", () => {
  const C = semProsa("src/lib/moderacao.functions.ts");

  test("conta as DUAS filas, com os mesmos filtros das telas", () => {
    expect(C).toContain("rede_denuncias");
    expect(C).toContain("rede_perguntas");
    expect(C).toContain('is("resolvido_em", null)');
    expect(C).toContain('not("denunciado_em", "is", null)');
  });

  test("⚠️ conta sem trazer o TRECHO do que foi dito", () => {
    expect(C).toContain("head: true");
  });

  test("⚠️ falha ao contar devolve `null`, e NUNCA zero", () => {
    /* Zero AFIRMA que a fila está limpa — a frase mais perigosa que um painel
       de moderação pode dizer errado. */
    expect(C).toMatch(/total: null/);
    const i = C.indexOf("const conta =");
    const fn = C.slice(i, C.indexOf("};", i));
    expect(fn).toContain("return null");
    expect(fn).toContain("42P01");
  });

  test("⚠️ o painel não transforma `null` em número na fita", () => {
    const P = semProsa("src/routes/_authenticated/painel.tsx");
    expect(P).toContain("contarDenunciasAbertas");
    // O estado é `number | null`; a fita recebe 0 só quando não há número.
    expect(P).toMatch(/useState<number \| null>\(null\)/);
  });

  test("⚠️ a busca do contador é PRÓPRIA — a fila é desmontada ao trocar de aba", () => {
    const P = semProsa("src/routes/_authenticated/painel.tsx");
    const i = P.indexOf("contarDenunciasAbertas");
    // Ela vive num efeito com deps vazias, fora de qualquer condição de aba.
    expect(P.slice(Math.max(0, i - 900), i)).toContain("useEffect(");
  });
});

describe("⚠️ os rótulos da fila", () => {
  test("cada alvo removível tem rótulo e tabela declarada", () => {
    /* ⚠️ O rótulo NÃO precisa diferir do valor: "story" é como se diz story em
       português, e exigir diferença reprovava um rótulo correto. O que importa
       é ele existir, e `alvos-da-denuncia.test.ts` já cobra que os sete sejam
       distintos entre si. */
    for (const alvo of PODE_REMOVER) {
      expect(rotuloDoAlvo(alvo).length).toBeGreaterThan(0);
      expect(BAIXA_DO_ALVO[alvo]).not.toBeUndefined();
    }
  });

  test("⚠️ perfil, pergunta, mensagem e conversa NÃO são removíveis", () => {
    for (const alvo of ["perfil", "pergunta", "mensagem", "conversa"]) {
      expect(PODE_REMOVER).not.toContain(alvo);
      expect(BAIXA_DO_ALVO[alvo]).toBeUndefined();
    }
  });
});

/**
 * ⚠️ O CONTROLE DO ADMIN, E A LINHA QUE ELE NÃO ATRAVESSA.
 *
 * A tentação óbvia ao "dar mais controle de dados" é uma tela com tudo que a
 * paciente publicou. Seria fácil, e transformaria moderação em VIGILÂNCIA — a
 * Comunidade é onde ela escreve para o público que ELA escolheu.
 *
 * A régua: o admin vê **o que foi denunciado** (e que ele já veria na fila),
 * **o estado da conta** e **contagens**. Nada mais.
 */
describe("⚠️ a ficha de moderação não vira vigilância", () => {
  const M = semProsa("src/lib/moderacao.functions.ts");
  const i = M.indexOf("export const fichaDeModeracao");
  const corpo = M.slice(i, M.indexOf("\nexport const", i + 10));

  test("ela lê `rede_denuncias` recortada pela conta, e o PERFIL só pelo estado", () => {
    expect(i).toBeGreaterThan(0);
    expect(corpo).toContain('eq("denunciada_id", data.contaId)');
    expect(corpo).toContain("patient_profiles");
  });

  test("⚠️ NÃO lê as publicações, os stories nem as mensagens da paciente", () => {
    for (const t of ["rede_posts", "rede_stories", "rede_mensagens", "rede_comentarios"]) {
      expect(`ficha lê ${t}`).toBe(corpo.includes(t) ? `ficha NÃO pode ler ${t}` : `ficha lê ${t}`);
    }
  });

  test("⚠️ e o select do perfil não traz bio, foto nem semana", () => {
    const j = corpo.indexOf("patient_profiles");
    const sel = corpo.slice(j, j + 300);
    for (const c of ["bio", "avatar_url", "lmp_date", "baby_name"]) {
      expect(`select traz ${c}`).toBe(
        sel.includes(c) ? `select NÃO pode trazer ${c}` : `select traz ${c}`,
      );
    }
  });

  test("⚠️ a tela diz o que NÃO está ali", () => {
    const T = readFileSync("src/components/fila-de-denuncias.tsx", "utf8");
    expect(T).toContain("O que ninguém denunciou não aparece aqui");
  });

  test("⚠️ falha ao abrir a ficha vira recado, e nunca ficha vazia", () => {
    const T = semProsa("src/components/fila-de-denuncias.tsx");
    const j = T.indexOf("async function verFicha(");
    const c = T.slice(j, T.indexOf("\n  }", j));
    expect(c).toMatch(/if \(r\.ok\)/);
    expect(c).toContain("setRecado");
  });
});

describe("⚠️ os números da Comunidade", () => {
  const M = semProsa("src/lib/moderacao.functions.ts");
  const i = M.indexOf("export const numerosDaComunidade");
  const corpo = M.slice(i);

  test("conta sem trazer conteúdo", () => {
    expect(i).toBeGreaterThan(0);
    const heads = (corpo.match(/head: true/g) ?? []).length;
    expect(heads).toBeGreaterThanOrEqual(6);
  });

  test("⚠️ ilegível vira `null`, e a tela desenha “—” em vez de 0", () => {
    expect(corpo).toContain("return null");
    const T = semProsa("src/components/numeros-da-comunidade.tsx");
    expect(T).toMatch(/x === null \? "—"/);
  });

  test("⚠️ só as DENÚNCIAS são alerta quando sobem", () => {
    /* Os outros cinco são bons quando crescem; pintar todos igual ensinaria a
       não olhar nenhum. */
    const T = semProsa("src/components/numeros-da-comunidade.tsx");
    const j = T.indexOf("alerta={");
    expect(j).toBeGreaterThan(0);
    expect(T.slice(j, j + 120)).toContain("denunciasNaSemana");
    expect((T.match(/alerta=\{/g) ?? []).length).toBe(1);
  });
});
