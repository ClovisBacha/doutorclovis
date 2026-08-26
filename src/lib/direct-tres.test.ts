import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CITACAO_MAX,
  REACOES_DE_MENSAGEM,
  alvoDaCitacao,
  reacaoDeMensagemConhecida,
  textoDaCitacao,
} from "./conversa";

/**
 * ⚠️ **AS TRÊS QUE FALTAVAM NO DIRECT.**
 *
 * Responder a uma mensagem específica, reagir, e denunciar. A terceira é a mais
 * séria: post, comentário, perfil e caixinha já tinham denúncia — o DIRECT não
 * tinha, e é o canal mais privado, onde o assédio de verdade acontece. Bloquear
 * existe, mas bloquear não deixa rastro nenhum para a plataforma: a próxima
 * paciente recebe a mesma coisa da mesma pessoa, e ninguém nunca soube.
 */

const FONTE = readFileSync("src/lib/conversa.functions.ts", "utf8");
/** ⚠️ A prosa cita o que ela proíbe — tira-se antes de procurar. */
const semProsa = FONTE.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

function corpoDe(nome: string): string {
  const i = semProsa.indexOf(`export const ${nome} = createServerFn`);
  if (i < 0) throw new Error(`não achei ${nome}`);
  const j = semProsa.indexOf("\nexport const ", i + 10);
  return semProsa.slice(i, j < 0 ? undefined : j);
}

describe("a citação", () => {
  test("⚠️ NÃO se aninha — um nível só", () => {
    /**
     * Responder a uma resposta cita a MESMA mensagem original. Numa tela de
     * 393px a citação da citação vira uma faixa de 40px que ninguém lê, e o
     * histórico deixa de caber. É a mesma decisão de `raizDoComentario`.
     */
    expect(alvoDaCitacao({ id: "b", respondeA: "a" })).toBe("a");
    expect(alvoDaCitacao({ id: "a", respondeA: null })).toBe("a");
  });

  test("⚠️ é UMA linha, e cortada", () => {
    /* A citação existe para lembrar QUAL mensagem, não para reler: uma citação
       de cinco linhas empurra a resposta para fora da tela. */
    const longo = "a".repeat(300);
    const t = textoDaCitacao({ texto: longo, apagada: false });
    expect(t.length).toBeLessThanOrEqual(CITACAO_MAX);
    expect(t.endsWith("…")).toBe(true);
  });

  test("⚠️ mensagem apagada vira 'mensagem apagada', e nunca vazio", () => {
    /* Apagar MARCA em vez de remover, então a linha continua ali com o texto
       nulo — e a citação em branco pareceria defeito. */
    expect(textoDaCitacao({ texto: null, apagada: true })).toBe("mensagem apagada");
    /* ⚠️ E o texto da apagada NÃO volta pela citação, mesmo se ainda estiver na
       linha: `apagada` vence o texto. */
    expect(textoDaCitacao({ texto: "segredo", apagada: true })).toBe("mensagem apagada");
  });

  test("foto e anexo têm rótulo próprio", () => {
    expect(textoDaCitacao({ texto: null, apagada: false, imagemUrl: "x" })).toBe("📷 Foto");
    expect(textoDaCitacao({ texto: null, apagada: false, refTipo: "post" })).toBe("🖼 Publicação");
  });
});

describe("as reações de mensagem", () => {
  test("⚠️ SEIS, e não as treze do post", () => {
    /**
     * Embaixo de uma publicação a reação é pública e escolhe o tom; numa
     * conversa entre duas pessoas ela é um aceno, e treze opções transformam um
     * aceno numa decisão.
     */
    expect(REACOES_DE_MENSAGEM).toHaveLength(6);
  });

  test("⚠️ NÃO tem 😢 nem 😱", () => {
    /**
     * 😢 lê como PENA, que é a coisa que ela menos quer receber; 😱 devolve
     * pânico a quem está com medo — e numa base de alto risco é justamente a
     * mensagem assustada que mais receberia reação. É a mesma lista de
     * proibidos da reação do post.
     */
    for (const proibido of ["😢", "😱", "👎"]) {
      expect(REACOES_DE_MENSAGEM as readonly string[]).not.toContain(proibido);
    }
  });

  test("emoji desconhecido é recusado", () => {
    expect(reacaoDeMensagemConhecida("❤️")).toBe(true);
    for (const lixo of ["😢", "", "x", null, 42, undefined]) {
      expect(reacaoDeMensagemConhecida(lixo)).toBe(false);
    }
  });
});

describe("⚠️ o servidor: reagir", () => {
  const C = corpoDe("reagirAMensagem");

  test("a conversa é minha, conferido ANTES de qualquer escrita", () => {
    const iDono = C.indexOf("minhaConversa(sb, data.conversaId, eu)");
    const iEscrita = Math.min(
      ...[C.indexOf(".upsert("), C.indexOf(".delete(")].filter((n) => n > -1),
    );
    expect(iDono).toBeGreaterThan(-1);
    expect(iEscrita).toBeGreaterThan(iDono);
  });

  test("⚠️ e a MENSAGEM tem de ser desta conversa", () => {
    /**
     * `minhaConversa` prova que a conversa é minha; sem esta segunda leitura, um
     * `mensagemId` de OUTRA conversa passaria com um `conversaId` legítimo — e a
     * reação apareceria numa conversa de terceiros.
     */
    expect(C).toContain("conversa_id !== data.conversaId");
  });

  test("mensagem apagada não recebe reação", () => {
    expect(C).toContain("apagada_em");
  });

  test("⚠️ o tipo passa pela régua, e desconhecido é recusado", () => {
    expect(C).toContain("reacaoDeMensagemConhecida(data.tipo)");
  });

  test("⚠️ sem a tabela, a tela SABE — nunca um 'reagiu' mudo", () => {
    expect(C).toContain('motivo: "sem_suporte"');
  });
});

describe("⚠️ o servidor: denunciar mensagem", () => {
  const C = corpoDe("denunciarMensagem");

  test("a conversa é minha, e a mensagem é dela", () => {
    expect(C).toContain("minhaConversa(sb, data.conversaId, eu)");
    expect(C).toContain("conversa_id !== data.conversaId");
  });

  test("⚠️ denunciar a PRÓPRIA mensagem é recusado", () => {
    /* Não quer dizer nada, e encheria a fila com linhas que ninguém tem o que
       julgar. */
    expect(C).toMatch(/autor_id === eu/);
  });

  test("⚠️ o TRECHO é congelado, e cortado", () => {
    /**
     * Se ela apagar a mensagem depois, a fila continua sabendo o que foi
     * denunciado — a mesma decisão da denúncia de post. E é a única cópia do
     * texto que sai da conversa: ela existe para a fila poder julgar, e por isso
     * vai cortada.
     */
    expect(C).toMatch(/trecho: .*slice\(0, 500\)/);
  });

  test("⚠️ o motivo é CATÁLOGO FECHADO", () => {
    /* Campo aberto numa denúncia de app de gestação é onde alguém escreve a
       informação clínica de outra pessoa. */
    expect(C).toContain('z.enum(["assedio", "saude", "imagem", "spam", "outro"])');
  });

  test("⚠️ sem o CHECK novo, a tela DIZ — e não promete 'fica registrada'", () => {
    /* É a promessa que este app já quebrou uma vez, com `denunciado_em` gravado
       e nunca lido. */
    expect(C).toContain('motivo: "sem_suporte"');
  });
});

describe("⚠️ o servidor: a citação no envio", () => {
  const C = corpoDe("enviarMensagem");

  test("a citada tem de ser da MESMA conversa", () => {
    /* Um `respondeA` apontando para outra conversa faria o trecho de uma
       mensagem privada de terceiros aparecer citado aqui. */
    const i = C.indexOf("if (data.respondeA)");
    expect(i).toBeGreaterThan(-1);
    expect(C.slice(i, i + 700)).toContain("conversa_id === data.conversaId");
  });

  test("⚠️ e passa por `alvoDaCitacao` — um nível só", () => {
    expect(C).toContain("alvoDaCitacao({");
  });

  test("⚠️ alvo inválido NÃO recusa a mensagem", () => {
    /**
     * A citação é um enfeite de contexto, e derrubar o envio por causa dela
     * seria perder o texto que ela escreveu. Vai sem citação: `respondeA` nasce
     * `null` e só é preenchido quando o alvo confere.
     */
    expect(C).toMatch(/let respondeA: string \| null = null/);
    const i = C.indexOf("if (data.respondeA)");
    const bloco = C.slice(i, i + 700);
    expect(bloco).not.toContain("return { ok: false");
  });

  test("⚠️ e sem a coluna, a mensagem VAI — só sem a citação", () => {
    /* A citação é contexto, não conteúdo: o texto que ela escreveu chega
       inteiro. Recusar aqui seria perder a mensagem por causa de um enfeite. */
    const i = C.indexOf("responde_a: respondeA");
    expect(i).toBeGreaterThan(-1);
    expect(C.slice(i, i + 500)).toContain(".insert({");
  });
});

describe("⚠️ a leitura: citação e reações em LOTE", () => {
  const C = corpoDe("mensagensDaConversa");

  test("uma consulta para as citadas, uma para as reações", () => {
    /* Uma consulta por mensagem seriam cinquenta idas ao banco por página, na
       tela que a paciente abre mais que qualquer outra desta aba. */
    expect(C).toContain('.in("id", idsCitados)');
    expect(C).toContain('"mensagem_id",');
  });

  test("⚠️ a citada é conferida contra a conversa também na LEITURA", () => {
    /* Cinto e suspensório: o envio já confere, mas uma linha gravada por uma
       versão anterior não passou por lá. */
    expect(C).toContain("conversa_id !== data.conversaId");
  });

  test("⚠️ a citação some quando a PRÓPRIA mensagem é apagada", () => {
    /* Junto com o texto e a foto, e pela mesma razão: nada da mensagem apagada
       viaja. */
    expect(C).toMatch(/!m\.apagada_em && m\.responde_a/);
  });

  test("⚠️ a citação NÃO carrega a URL da foto", () => {
    /* Assiná-la seria uma viagem ao Storage por citação, e a citação não precisa
       da imagem — só do sinal de que havia uma. */
    const i = C.indexOf("citacao:");
    expect(C.slice(i, i + 700)).not.toContain("createSignedUrls");
  });

  test("⚠️ falha ao ler reações NÃO derruba a conversa", () => {
    /* Sem as reações a conversa continua inteira; derrubá-la por um enfeite
       seria trocar um agrado por uma tela vazia. */
    const i = C.indexOf("reacoesPor");
    const bloco = C.slice(i, i + 900);
    expect(bloco).toContain("?? []");
  });

  test("⚠️ a leitura tem DEGRAU para `responde_a`", () => {
    /* Sem a coluna, o `42703` derrubaria a leitura e a conversa pararia de
       abrir — por causa de um recurso que ainda não existe naquele banco. */
    expect(C).toContain("APLICAR_DEZ_DA_REDE.sql");
  });
});
