import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CONVITE_DA_COMUNIDADE,
  ofereceAComunidade,
  TEXTO_PERFIL_PUBLICO,
} from "./chaves-do-perfil";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/**
 * ⚠️ O TEXTO DA CHAVE É O CONSENTIMENTO — e ele passou a ter DUAS portas.
 *
 * A tela de configurações da Comunidade e o ritual de boas-vindas mostram o
 * MESMO interruptor. `rede-social.tsx` registra, por escrito, que "a explicação
 * é a defesa: 'não podemos expor a paciente sem ela saber' só é verdade se ela
 * puder ler, ali, o que ligar aquilo significa".
 *
 * Duas cópias divergem no primeiro ajuste, e a divergência aparece como duas
 * telas prometendo coisas diferentes sobre a mesma chave — o defeito exato que
 * a auditoria achou quando `/p/<codigo>` passou a publicar na internet sob um
 * texto que dizia "no app".
 */
describe("o texto do perfil público", () => {
  test("⚠️ a frase é literal: NO APP", () => {
    expect(TEXTO_PERFIL_PUBLICO.ligado.toLocaleLowerCase("pt-BR")).toContain("no app");
  });

  /**
   * ⚠️ E ela NÃO pode falar da internet aberta.
   *
   * Essa é `vitrine_publica`, chave própria, com texto próprio. As duas andaram
   * juntas por uma leva inteira e foi exatamente o defeito: um consentimento
   * dado para "dentro do app" autorizando uma página que abre sem conta.
   */
  test("⚠️ não promete nem menciona a página aberta na internet", () => {
    const t = `${TEXTO_PERFIL_PUBLICO.ligado} ${TEXTO_PERFIL_PUBLICO.desligado}`.toLocaleLowerCase(
      "pt-BR",
    );
    for (const proibido of ["internet", "navegador", "sem conta", "google", "fora do app"]) {
      expect(t).not.toContain(proibido);
    }
  });

  test("os dois estados dizem coisas diferentes, e nenhum é vazio", () => {
    expect(TEXTO_PERFIL_PUBLICO.ligado).not.toBe(TEXTO_PERFIL_PUBLICO.desligado);
    expect(TEXTO_PERFIL_PUBLICO.ligado.length).toBeGreaterThan(20);
    expect(TEXTO_PERFIL_PUBLICO.desligado.length).toBeGreaterThan(20);
  });

  /* ⚠️ A CATRACA: as duas telas leem daqui, e nenhuma escreve a frase à mão. */
  test("⚠️ as DUAS portas leem a constante — nenhuma tem cópia própria", () => {
    for (const arquivo of [
      "src/components/rede-social.tsx",
      "src/routes/_authenticated/minha-conta.tsx",
    ]) {
      const fonte = semComentarios(readFileSync(arquivo, "utf8"));
      expect(fonte).toContain("TEXTO_PERFIL_PUBLICO");
      // A frase escrita à mão é o que não pode voltar.
      expect(fonte).not.toContain("Qualquer pessoa no app pode te achar e te acompanhar.");
    }
  });
});

describe("o convite do ritual", () => {
  /**
   * ⚠️ NÃO PROMETE GENTE.
   *
   * "Conheça outras gestantes como você" promete uma comunidade cheia a quem
   * entra num app que pode ter cinco contas — e a decepção acontece no primeiro
   * minuto, que é o pior lugar possível para ela acontecer. O texto descreve o
   * que a CHAVE faz, e mais nada.
   */
  test("⚠️ não promete gente, nem cuidado, nem desfecho", () => {
    const t = `${CONVITE_DA_COMUNIDADE.titulo} ${CONVITE_DA_COMUNIDADE.sub}`.toLocaleLowerCase(
      "pt-BR",
    );
    for (const proibido of [
      "milhares",
      "milhões",
      "outras gestantes como você",
      "não fique sozinha",
      "apoio",
      "seguro",
      "tranquil",
      "vai te ajudar",
    ]) {
      expect(t).not.toContain(proibido);
    }
  });

  /* ⚠️ Ele diz que dá para mudar depois — é o que separa um convite de uma
     porta de mão única no primeiro minuto de uso. */
  test("⚠️ diz que dá para mudar depois", () => {
    expect(CONVITE_DA_COMUNIDADE.sub.toLocaleLowerCase("pt-BR")).toContain("mudar");
  });
});

describe("o portão", () => {
  test("oferece no caso comum", () => {
    expect(ofereceAComunidade({ emCuidado: false })).toBe(true);
  });

  /**
   * ⚠️ Nunca em Modo Cuidado. O ritual só abre para conta recém-criada, então o
   * caso é raro — e é por ser raro que ele passaria despercebido: quem criou a
   * conta depois de uma perda encontraria, no primeiro minuto, um convite para
   * virar visível numa rede de gestantes.
   */
  test("⚠️ nunca em Modo Cuidado", () => {
    expect(ofereceAComunidade({ emCuidado: true })).toBe(false);
  });
});

/**
 * ⚠️ O RITUAL LIGA `perfil_publico`, E NUNCA `vitrine_publica`.
 *
 * A vitrine é a página que abre na internet aberta, sem conta — ela merece um
 * momento deliberado, não uma chavinha no meio das boas-vindas. Ligá-la aqui
 * seria repetir, na porta mais nova, o defeito que a auditoria acabou de achar.
 */
describe("o que o ritual grava", () => {
  /* ⚠️ O ritual MUDOU DE CASA em set/2026 (`minha-conta.tsx` → o componente
     próprio), e a garantia não mudou uma linha: o move foi verbatim, conferido
     por hash. Este teste seguia o ARQUIVO; segue o componente agora. */
  const ritual = semComentarios(readFileSync("src/components/onboarding-ritual.tsx", "utf8"));

  test("⚠️ grava `perfil_publico`", () => {
    expect(ritual).toContain("payload.perfil_publico = true");
  });

  test("⚠️ NUNCA grava `vitrine_publica`", () => {
    expect(ritual).not.toContain("vitrine_publica");
  });

  /**
   * ⚠️ E não segue ninguém por ela.
   *
   * Seguir é um gesto, e um app que segue coisas pela paciente ensina que a
   * lista dela não é dela — a mesma razão pela qual nem a conta oficial é
   * seguida automaticamente. O único caso em que este app cria vínculo sem
   * perguntar é o do convite, onde há consentimento explícito dos dois lados.
   */
  test("⚠️ o ritual não segue ninguém pela paciente", () => {
    const i = ritual.indexOf("async function finish()");
    expect(i).toBeGreaterThan(-1);
    const corpo = ritual.slice(i, ritual.indexOf("\n  }", i + 100));
    expect(corpo).not.toContain("rede_seguidores");
    expect(corpo).not.toContain("paresDoSeguir");
  });
});
