import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DIA_DO_RESUMO,
  MINIMO_DE_PUBLICACOES,
  textoDoResumo,
  valeResumoDaComunidade,
} from "./resumo-da-comunidade";

const base = { publicacoes: 4, pessoas: 2, emCuidado: false };

describe("quando o resumo sai", () => {
  test("com movimento na rede, sai", () => {
    expect(valeResumoDaComunidade(base)).toBe(true);
  });

  /**
   * ⚠️ DUAS publicações, e não uma.
   *
   * Um push semanal por uma única publicação é o app pedindo atenção em nome
   * de quase nada — e o custo não é o incômodo: é a PRÓXIMA notificação, que
   * ela vai ignorar. Este é o mesmo canal por onde chega o aviso de
   * emergência.
   */
  test("⚠️ uma publicação só não vale um push", () => {
    expect(MINIMO_DE_PUBLICACOES).toBeGreaterThanOrEqual(2);
    expect(valeResumoDaComunidade({ ...base, publicacoes: 1 })).toBe(false);
    expect(valeResumoDaComunidade({ ...base, publicacoes: 0 })).toBe(false);
  });

  /**
   * ⚠️ NUNCA em Modo Cuidado — e este é o único dos portões que a tela não tem
   * como aplicar depois, porque o push chega FORA do app.
   */
  test("⚠️ nunca em Modo Cuidado, por mais movimento que haja", () => {
    expect(valeResumoDaComunidade({ publicacoes: 99, pessoas: 12, emCuidado: true })).toBe(false);
  });

  /* ⚠️ Domingo — o MESMO dia do resumo da Gratidão e da retrospectiva dentro
     do app. Dois pushes do mesmo app em dias diferentes ensinam que ele fala
     demais. */
  test("⚠️ cai no mesmo dia do resumo da Gratidão", () => {
    expect(DIA_DO_RESUMO).toBe(0);
    const cron = readFileSync("src/routes/api/push-weekly-tick.ts", "utf8");
    // O da Gratidão também dispara em domingo (`getDay() !== 0`).
    expect(cron).toContain("hojeBR.getDay() !== 0");
    expect(cron).toContain("hojeBR.getDay() !== DIA_DO_RESUMO");
  });
});

describe("o texto", () => {
  /**
   * ⚠️ NÚMERO, e nunca NOME.
   *
   * "Marina e Carol publicaram" chega na tela de bloqueio do celular dela, e
   * quem estiver ao lado lê: o nome de duas gestantes e a informação de que as
   * três se conhecem. É a mesma razão pela qual a lista de seguidores deste app
   * não é pública.
   */
  test("⚠️ não cita ninguém pelo nome", () => {
    const { titulo, corpo } = textoDoResumo(base);
    expect(titulo).toContain("2");
    expect(`${titulo} ${corpo}`).not.toMatch(/[A-Z][a-zà-ú]+ e [A-Z][a-zà-ú]+/);
  });

  /**
   * ⚠️ E NÃO COBRA. "Você está sumida" e "não perca" são o texto de todo app de
   * rede social, e aqui cairiam numa gestante que pode estar internada.
   */
  test("⚠️ não cobra, não ameaça e não promete clínica", () => {
    const t = Object.values(textoDoResumo(base)).join(" ").toLocaleLowerCase("pt-BR");
    for (const proibido of [
      "você está sumida",
      "sumiu",
      "não perca",
      "volte",
      "faz tempo",
      "está tudo bem",
      "sua gestação",
      "seu bebê",
      "novidades sobre",
    ]) {
      expect(t).not.toContain(proibido);
    }
  });

  test("singular e plural, nas duas contagens", () => {
    expect(textoDoResumo({ ...base, pessoas: 1 }).titulo.toLowerCase()).toContain("alguém");
    expect(textoDoResumo({ ...base, publicacoes: 1 }).corpo).toContain("1 publicação nova");
    expect(textoDoResumo({ ...base, publicacoes: 5 }).corpo).toContain("5 publicações novas");
  });
});

/**
 * ⚠️ O TRABALHO NÃO PODE VIRAR UMA CONSULTA POR PACIENTE.
 *
 * Um laço "para cada paciente, conte os posts de quem ela segue" custaria uma
 * ida ao banco por conta — funciona com cinquenta pacientes e derruba o cron
 * com quinhentas.
 */
describe("o trabalho do cron", () => {
  const cron = readFileSync("src/routes/api/push-weekly-tick.ts", "utf8");
  const i = cron.indexOf("async function resumoDaComunidade");
  const corpo = cron.slice(i, cron.indexOf("\n}\n", i));

  test("⚠️ duas consultas para a base inteira, cruzadas em memória", () => {
    expect(i).toBeGreaterThan(-1);
    expect(corpo).toContain("Promise.all");
    expect(corpo).toContain('.from("rede_posts")');
    expect(corpo).toContain('.from("rede_seguidores")');
  });

  /* ⚠️ Só a camada `publico`: as outras exigiriam `podeVerPost` por par, e um
     push anunciando uma publicação que ela não pode abrir é pior que nenhum. */
  test("⚠️ só publicações públicas e não arquivadas", () => {
    expect(corpo).toContain('.eq("visibilidade", "publico")');
    expect(corpo).toContain('.is("arquivado_em", null)');
  });

  /* ⚠️ E o portão do luto é aplicado com o resultado da régua, nunca por um
     `if` local — é o mesmo `valeResumoDaComunidade` que o teste acima cobre. */
  test("⚠️ o portão vem da régua", () => {
    expect(corpo).toContain("valeResumoDaComunidade(f)");
    expect(corpo).toContain('.eq("care_mode", true)');
  });
});
