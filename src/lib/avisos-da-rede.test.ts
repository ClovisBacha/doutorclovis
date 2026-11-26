import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AVISOS_QUE_ELA_DESLIGA,
  LINK_DA_BIO_MAX,
  avisoMandaPush,
  limparLinkDaBio,
  podeAvisar,
} from "./rede-social";

/**
 * ⚠️ **A REDE ERA QUASE MUDA, e as preferências não existiam.**
 *
 * `textoDoAviso` tinha frase escrita para as oito espécies e só UMA empurrava:
 * comentar, mencionar e marcar gravavam na caixa ♡ e não avisavam ninguém. E o
 * único jeito de parar de receber era desligar a notificação do app inteiro —
 * o mesmo canal do aviso de emergência.
 */

const FONTE = readFileSync("src/lib/rede-social.functions.ts", "utf8");
const TELA = readFileSync("src/components/rede-social.tsx", "utf8");
const PERFIL = readFileSync("src/components/rede-instagram.tsx", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDaFuncao(nome: string): string {
  const s = semProsa(FONTE);
  const i = s.indexOf(`async function ${nome}`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = s.indexOf("\n}\n", i);
  return s.slice(i, j < 0 ? undefined : j);
}

describe("⚠️ o que merece interromper", () => {
  test("o que PEDE alguma coisa dela", () => {
    for (const e of ["pediu_para_seguir", "comentou", "mencionou", "marcou"] as const) {
      expect({ e, push: avisoMandaPush(e) }).toEqual({ e, push: true });
    }
  });

  test("⚠️ afago NÃO interrompe", () => {
    /**
     * O push deste app é o mesmo canal do aviso de emergência. Um coraçãozinho
     * de madrugada gasta o canal que um dia vai avisar de uma consulta — e quem
     * desliga por causa dele desliga o SOS junto.
     *
     * ⚠️ `aceitou` entra aqui e não no de cima: ela mandou o pedido e vai
     * encontrar a resposta quando abrir. O critério é "PEDE", não "importa".
     */
    for (const e of ["reagiu", "reagiu_story", "seguiu", "aceitou"] as const) {
      expect({ e, push: avisoMandaPush(e) }).toEqual({ e, push: false });
    }
  });

  test("⚠️ a lista de preferências só mostra o que MANDA push", () => {
    /* Um interruptor ao lado de um aviso que nunca sai prometeria controle
       sobre coisa nenhuma. */
    for (const a of AVISOS_QUE_ELA_DESLIGA) {
      expect({ chave: a.chave, manda: avisoMandaPush(a.chave) }).toEqual({
        chave: a.chave,
        manda: true,
      });
    }
    expect(AVISOS_QUE_ELA_DESLIGA.length).toBe(4);
  });

  test("⚠️ `podeAvisar` FALHA ABERTO quando não sabe", () => {
    /* O pior caso é um push que ela preferia não receber; o oposto é o silêncio
       — e silêncio numa leitura degradada some sem deixar rastro. */
    expect(podeAvisar("comentou", null)).toBe(true);
    expect(podeAvisar("comentou", [])).toBe(true);
    expect(podeAvisar("comentou", ["comentou"])).toBe(false);
    /* E o que não manda push continua não mandando, desligada ou não. */
    expect(podeAvisar("reagiu", null)).toBe(false);
  });
});

describe("⚠️ o push sai de UMA porta", () => {
  const C = corpoDaFuncao("registrarAtividade");

  test("dentro de `registrarAtividade`, o único caminho de um aviso", () => {
    /* Solto no `seguir`, sete das oito espécies ficaram mudas. Aqui, a espécie
       que alguém acrescentar amanhã já sai avisando. */
    expect(C).toContain("sendPushToUser(opts.donoId");
  });

  test("⚠️ e a ordem é: gravou → fora da rede? → régua → push", () => {
    const iGravou = C.indexOf("if (error) return;");
    const iFora = C.indexOf("foraDaRede(dono)");
    const iRegua = C.indexOf("podeAvisar(opts.especie, desligados)");
    const iPush = C.indexOf("sendPushToUser(");
    expect(iGravou).toBeGreaterThan(-1);
    expect(iFora).toBeGreaterThan(iGravou);
    expect(iRegua).toBeGreaterThan(iFora);
    expect(iPush).toBeGreaterThan(iRegua);
  });
});

describe("⚠️ o aviso de quem publicou — só para FAVORITAS", () => {
  const C = corpoDaFuncao("avisarQuemMeFavoritou");

  test("lê `rede_favoritos`, e nunca `rede_seguidores`", () => {
    /**
     * "Fulana publicou" para todo mundo que segue é o pior push possível aqui:
     * quem segue trinta pessoas receberia trinta interrupções por dia e
     * desligaria a notificação inteira — com ela o SOS e o lembrete de consulta.
     */
    expect(C).toContain('.from("rede_favoritos")');
    expect(C).not.toContain('.from("rede_seguidores")');
  });

  test("⚠️ a camada `amigas` NÃO avisa ninguém", () => {
    /* Quem favoritou pode não ser amiga, e o push carregaria o NOME de quem
       publicou um desabafo restrito para fora da camada que o restringe. */
    expect(C).toMatch(/if \(visibilidade === "amigas"\) return;/);
  });

  test("⚠️ e quem me bloqueou não recebe", () => {
    /* O bloqueio vale nos DOIS sentidos: um push meu chegando nela seria o
       bloqueio falhando pelo caminho mais visível possível. */
    expect(C).toContain('.from("rede_bloqueios")');
    expect(C).toContain("foraDaRede(dela)");
  });

  test("⚠️ o texto NÃO traz a legenda", () => {
    /* O que ela publicou pode ser exatamente o que não se lê sem contexto, e a
       tela de bloqueio do celular é o pior contexto que existe. */
    expect(C).toContain("publicou`");
    expect(C).not.toContain("data.texto");
  });
});

describe("⚠️ o link da bio", () => {
  test("aceita http e https, e completa o que veio sem esquema", () => {
    expect(limparLinkDaBio("https://instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(limparLinkDaBio("instagram.com/ana")).toBe("https://instagram.com/ana");
    expect(limparLinkDaBio("  http://exemplo.com  ")).toBe("http://exemplo.com/");
  });

  test("⚠️ RECUSA o que vira comportamento na tela de quem visita", () => {
    /**
     * O `href` é o único lugar do app onde texto de uma paciente vira
     * comportamento na tela de OUTRA. `javascript:` numa bio é XSS.
     */
    for (const veneno of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "file:///etc/passwd",
      "//exemplo.com",
      /**
       * ⚠️ **O CASO QUE SÓ O TESTE DE PROTOCOLO PEGA, e a mutação provou.**
       * `new URL("javascript://exemplo.com/%0aalert(1)")` tem hostname
       * `exemplo.com` — passa pela conferência de "tem ponto?" e pela de "tem
       * esquema?". Sem o `protocol !== "javascript:"`, este endereço vira um
       * `href` clicável que executa script na tela de QUEM VISITA o perfil.
       */
      "javascript://exemplo.com/%0aalert(1)",
    ]) {
      expect({ veneno, saida: limparLinkDaBio(veneno) }).toEqual({ veneno, saida: null });
    }
  });

  test("⚠️ e recusa endereço que não leva a lugar nenhum", () => {
    /* `https://oi` renderizado como link é uma promessa que o toque não
       cumpre. */
    for (const lixo of ["", "   ", "oi", null, undefined]) {
      expect(limparLinkDaBio(lixo)).toBe(null);
    }
  });

  test("⚠️ quem limpa é o SERVIDOR, e a tela não confere nada", () => {
    /* Uma segunda régua no `href` divergiria da primeira, e a divergência
       aparece como `javascript:` clicável. */
    expect(semProsa(FONTE)).toContain("limparLinkDaBio(data.bioLink)");
    const t = semProsa(PERFIL);
    expect(t).toContain("href={perfil.bioLink}");
    expect(t).not.toContain("limparLinkDaBio");
  });

  test("⚠️ e o link abre com `noopener`", () => {
    /* Sem ele, a página aberta ganha `window.opener` e pode navegar a NOSSA aba
       para onde quiser — com a paciente achando que continua no app. */
    const t = semProsa(PERFIL);
    const i = t.indexOf("href={perfil.bioLink}");
    expect(t.slice(i, i + 220)).toContain('rel="noopener noreferrer nofollow"');
  });

  test("tem teto de tamanho", () => {
    expect(LINK_DA_BIO_MAX).toBeGreaterThan(0);
    expect(semProsa(FONTE)).toContain("z.string().max(LINK_DA_BIO_MAX)");
  });
});

describe("⚠️ a tela das preferências", () => {
  const T = semProsa(TELA);

  test("existe, e diz o que NÃO passa por ela", () => {
    /* Sem a frase, desligar aqui parece desligar o aviso do médico junto — e
       aí ela não desliga nada. */
    expect(T).toContain("AVISOS_QUE_ELA_DESLIGA.map(");
    expect(T).toContain("Avisos da Comunidade");
    expect(T).toMatch(/emergência não passam por aqui/);
  });

  test("⚠️ e desfaz quando o servidor recusa ou não guarda", () => {
    const i = T.indexOf("async function mudarAviso");
    const corpo = T.slice(i, T.indexOf("\n  async function", i + 10));
    /**
     * ⚠️ **SÃO DUAS voltas atrás, e a mutação provou que uma asserção não
     * bastava:** o `catch` (a rede caiu) e o `parcial` (o banco não guardou).
     * `toContain` sozinho ficava verde com o `catch` apagado, porque a mesma
     * chamada continua no bloco do `parcial`.
     */
    expect(corpo.match(/setAvisosDesligados\(antes\)/g) ?? []).toHaveLength(2);
    expect(corpo).toContain('"parcial" in r && r.parcial');
  });

  test("⚠️ o servidor filtra chave inventada contra o catálogo", () => {
    /* Uma chave forjada no corpo do pedido viraria um desligamento que nenhuma
       tela sabe mostrar — e que ela não teria como religar. */
    expect(semProsa(FONTE)).toContain("AVISOS_QUE_ELA_DESLIGA.some((a) => a.chave === c)");
  });
});
