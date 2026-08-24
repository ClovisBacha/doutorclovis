import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { INTERVALO_MINIMO_MS, varrerLembretes, zerarEstrangulador } from "./lembretes.server";
import {
  INTERVALO_MINIMO_MS as INTERVALO_MED,
  zerarEstranguladorDaMeditacao,
} from "./meditacao.server";

/**
 * ⚠️ DOIS RECURSOS ESTAVAM ESCUROS PORQUE O CRON NUNCA FOI AGENDADO.
 *
 * `vercel.json` declara UM cron: `push-weekly-tick`. Os outros três endpoints
 * (`lembretes-tick`, `meditacao-tick`, `waitlist-tick`) dependem de serviço
 * externo — decisão registrada, porque intervalo menor que diário exige plano
 * Pro. Só que a fila de espera tinha previsto isso e os outros dois não:
 *
 *   · `waitlist` roda preguiçosamente ao abrir a fila → degrada, funciona.
 *   · `lembretes` e `meditacao` **não tinham chamador nenhum fora do cron** →
 *     o aviso de 24 h, o de 4 h, o pedido de pré-consulta de 48 h e o lembrete
 *     diário de meditação simplesmente não saíam.
 *
 * Falta em consultório de alto risco é vaga perdida duas vezes — era o
 * argumento do próprio recurso.
 */
describe("todo cron tem recuo preguiçoso", () => {
  const arquivos = (() => {
    const out: Record<string, string> = {};
    for (const n of readdirSync("src/lib")) if (n.endsWith(".ts")) out[`lib/${n}`] = "";
    return out;
  })();
  void arquivos;

  /**
   * ⚠️ **O QUE TORNA SEGURO CHAMAR DE FORMA PREGUIÇOSA NÃO É A VARREDURA — É A
   * IDEMPOTÊNCIA.** Os lembretes não repetem o que está em
   * `appointment_reminders` (índice único), e a meditação grava o carimbo ANTES
   * de enviar. Chamar dez vezes por minuto manda no máximo uma vez.
   *
   * Se algum dia alguém tirar a gravação-antes-do-envio, a chamada preguiçosa
   * vira spam no MESMO canal por onde chega o aviso de emergência.
   */
  test("⚠️ os lembretes gravam o registro ANTES de enviar", () => {
    const src = readFileSync("src/lib/lembretes.server.ts", "utf8");
    /* ⚠️ **ANCORA NO INSERT, e não no nome da tabela.** A primeira versão usava
       `indexOf('.from("appointment_reminders")')` — e casava a LEITURA do que
       já foi enviado, três consultas antes, que legitimamente vem antes do
       envio. A mutação que movia a GRAVAÇÃO para depois do push passou verde.
       É a armadilha que este repositório já pagou quatro vezes: a asserção
       satisfeita por outra ocorrência do mesmo nome. */
    const iRegistro = src.indexOf("const { error: erroRegistro }");
    const iEnvio = src.indexOf("sendPushToUser(");
    expect(iRegistro).toBeGreaterThan(-1);
    expect(iEnvio).toBeGreaterThan(-1);
    expect(iRegistro).toBeLessThan(iEnvio);
    /* E a gravação continua sendo um INSERT nessa tabela — se virar outra
       coisa, a idempotência que sustenta a chamada preguiçosa some junto. */
    const trecho = src.slice(iRegistro, iRegistro + 400);
    expect(trecho).toContain('.from("appointment_reminders")');
    expect(trecho).toContain(".insert(");
  });

  test("⚠️ os dois têm chamador FORA do cron", () => {
    const consultas = readFileSync("src/lib/appointments.functions.ts", "utf8");
    expect(consultas).toContain("varrerLembretes()");
    const presenca = readFileSync("src/lib/amigas.functions.ts", "utf8");
    expect(presenca).toContain("varrerLembretesDeMeditacao()");
  });

  /**
   * ⚠️ **O CRON NÃO É ESTRANGULADO.** Ele é a fonte PROATIVA; deixá-lo depender
   * de uma visita de paciente que aconteceu um minuto antes inverte o desenho.
   */
  test("⚠️ o cron força, o chamador preguiçoso não", () => {
    for (const rota of ["lembretes-tick", "meditacao-tick"]) {
      const src = readFileSync(`src/routes/api/${rota}.ts`, "utf8");
      expect(src).toContain("forcar: true");
    }
    /* E quem pega carona chama sem argumento — sujeito ao estrangulador. */
    expect(readFileSync("src/lib/appointments.functions.ts", "utf8")).toContain(
      "await varrerLembretes();",
    );
  });

  test("⚠️ o estrangulador segura a segunda chamada seguida", async () => {
    zerarEstrangulador();
    const t0 = 1_000_000_000_000;
    /* A primeira passa do estrangulador (e falha adiante por falta de banco no
       teste — o que importa aqui é que ela NÃO foi barrada antes). */
    await varrerLembretes({ agora: t0 }).catch(() => null);
    /* A segunda, dentro da janela, é barrada: devolve `null` sem tocar o banco. */
    const segunda = await varrerLembretes({ agora: t0 + 1000 }).catch(() => "erro");
    expect(segunda).toBeNull();
    /* Passada a janela, volta a rodar. */
    const depois = await varrerLembretes({ agora: t0 + INTERVALO_MINIMO_MS + 1 }).catch(
      () => "erro",
    );
    expect(depois).not.toBeNull();
    zerarEstrangulador();
    zerarEstranguladorDaMeditacao();
  });

  test("a janela dos dois é a mesma", () => {
    expect(INTERVALO_MINIMO_MS).toBe(INTERVALO_MED);
    expect(INTERVALO_MINIMO_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });
});
