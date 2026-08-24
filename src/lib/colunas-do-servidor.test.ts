/**
 * AS COLUNAS QUE O NAVEGADOR NÃO PODE ESCREVER.
 *
 * `patient_profiles` é escrita direto do navegador com a chave anon em vários
 * pontos do app — a chave do perfil público, a bio, a foto, o Modo Cuidado. Isso
 * é deliberado e está certo: são decisões DELA sobre a conta DELA.
 *
 * ⚠️ Mas a mesma tabela guarda colunas que NÃO são dela para escrever, e para
 * cada uma delas o repo usa o mesmo remédio: `REVOKE UPDATE (coluna) … FROM
 * authenticated`. Sem o REVOKE, uma paciente autenticada pode rodar
 *
 *     UPDATE patient_profiles SET <coluna> = … WHERE id = auth.uid();
 *
 * direto do navegador, porque a policy de linha a autoriza a mexer na própria
 * linha — e a policy de LINHA não distingue coluna.
 *
 * Este teste é a catraca: toda coluna desta lista tem de ter o REVOKE em algum
 * `APLICAR_`. Ela nasceu porque `conta_oficial` entrou sem.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const SQL = readdirSync("supabase")
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`supabase/${f}`, "utf8"))
  .join("\n");

/**
 * Coluna → por que o navegador não pode escrevê-la.
 *
 * ⚠️ Acrescentar uma coluna que o SERVIDOR decide sem pôr o REVOKE é abrir uma
 * porta que ninguém vê: nada quebra, nenhum teste fica vermelho, e o efeito só
 * aparece quando alguém tentar.
 */
const SO_O_SERVIDOR: Record<string, string> = {
  conta_oficial:
    "é o selo do CONSULTÓRIO. Sem o REVOKE, qualquer paciente se dá o selo e " +
    "aparece FIXADA EM PRIMEIRO na fileira de sugeridas de toda conta nova — " +
    "falando com autoridade médica emprestada para quem acabou de chegar.",
  referred_by:
    "é o grafo de amizade E o recibo de uma recompensa já paga. Escrevê-lo à " +
    "mão viraria amiga de quem ela escolhesse, e reclamaria indicação alheia.",
  referral_code: "é a capacidade que identifica a conta dela; forjá-lo rouba indicação.",
  med_reminder_sent_at:
    "é o carimbo que impede o push repetido. Zerá-lo faria o lembrete sair de " +
    "hora em hora — no mesmo canal por onde chega o aviso de emergência.",
};

describe("o que só o servidor escreve", () => {
  for (const [coluna, porque] of Object.entries(SO_O_SERVIDOR)) {
    test(`⚠️ \`${coluna}\` é revogada do \`authenticated\` — ${porque.slice(0, 60)}…`, () => {
      /* ⚠️ A coluna pode estar em QUALQUER posição da lista: o repo revoga
         `(referred_by, referral_code)` numa linha só, e um padrão que exigisse
         a primeira posição daria vermelho sobre SQL correto — e, pior, na
         próxima vez alguém o afrouxaria e ele pararia de proteger as duas. */
      const alvo = new RegExp(
        `REVOKE\\s+UPDATE\\s*\\([^)]*\\b${coluna}\\b[^)]*\\)\\s+ON\\s+public\\.patient_profiles\\s+FROM\\s+authenticated`,
        "i",
      );
      expect(SQL).toMatch(alvo);
    });
  }

  /* ⚠️ E a conferência do `APLICAR_` tem de RELATAR o estado, senão o dono roda
     o arquivo e não tem como saber se aquela linha pegou. */
  test("⚠️ a conferência do SQL relata se o selo continua escrevível", () => {
    const oficial = readFileSync("supabase/APLICAR_CONTA_OFICIAL.sql", "utf8");
    expect(oficial).toContain("selo_escrevivel");
    expect(oficial).toContain("column_privileges");
  });
});
