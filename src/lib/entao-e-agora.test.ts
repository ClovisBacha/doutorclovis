import { describe, expect, test } from "bun:test";
import {
  candidatosAoEntao,
  carimboDaComparacao,
  DIAS_MINIMOS,
  legendaSugerida,
  type CandidatoAoEntao,
  chaveDoLembrete,
  lembreteDoEntao,
} from "./entao-e-agora";

const AGORA = new Date("2026-08-19T12:00:00Z");
const atras = (dias: number) => new Date(AGORA.getTime() - dias * 86_400_000).toISOString();
const p = (dias: number, mudar: Partial<CandidatoAoEntao> = {}): CandidatoAoEntao => ({
  id: `p${dias}`,
  criadoEm: atras(dias),
  imagemUrl: "foto",
  ...mudar,
});

describe("quem serve como 'então'", () => {
  /* ⚠️ Comparar a barriga de hoje com a de anteontem não mostra nada — e um
     recurso que rende uma imagem sem diferença ensina que ele não vale a pena
     na primeira tentativa. */
  test("⚠️ precisa ter pelo menos quatro semanas", () => {
    expect(candidatosAoEntao([p(DIAS_MINIMOS - 1)], AGORA)).toEqual([]);
    expect(candidatosAoEntao([p(DIAS_MINIMOS)], AGORA)).toHaveLength(1);
  });

  test("precisa ter FOTO — é uma comparação visual", () => {
    expect(candidatosAoEntao([p(60, { imagemUrl: null })], AGORA)).toEqual([]);
  });

  test("do mais novo para o mais antigo", () => {
    expect(candidatosAoEntao([p(120), p(40), p(80)], AGORA).map((x) => x.id)).toEqual([
      "p40",
      "p80",
      "p120",
    ]);
  });

  test("data inválida não entra e não estoura", () => {
    expect(candidatosAoEntao([p(60, { criadoEm: "outro dia" })], AGORA)).toEqual([]);
  });
});

describe("o carimbo", () => {
  test("as duas semanas, quando ela as mostra", () => {
    expect(carimboDaComparacao({ semanaAntes: 18, semanaAgora: 32, mostrarSemana: true })).toEqual({
      antes: "18s",
      agora: "32s",
    });
  });

  /* ⚠️ Fazer a metade "antiga" escapar da chave, com o argumento de que é
     passado, seria publicar a semana dela pela porta dos fundos — e o passado
     dela é tão dela quanto o presente. */
  test("⚠️ a chave `mostrar_semana` manda nos DOIS", () => {
    expect(
      carimboDaComparacao({ semanaAntes: 18, semanaAgora: 32, mostrarSemana: false }),
    ).toBeNull();
  });

  test("sem uma das semanas, não há carimbo", () => {
    expect(
      carimboDaComparacao({ semanaAntes: null, semanaAgora: 32, mostrarSemana: true }),
    ).toBeNull();
    expect(
      carimboDaComparacao({ semanaAntes: 18, semanaAgora: null, mostrarSemana: true }),
    ).toBeNull();
  });

  /* ⚠️ "28s → 28s" faz a comparação parecer quebrada, e acontece de verdade em
     quem publica duas vezes na mesma semana gestacional depois de um intervalo
     longo de calendário (DUM corrigida, por exemplo). */
  test("⚠️ semanas iguais não viram carimbo", () => {
    expect(
      carimboDaComparacao({ semanaAntes: 28, semanaAgora: 28, mostrarSemana: true }),
    ).toBeNull();
  });
});

describe("a legenda sugerida", () => {
  test("usa as duas semanas quando há carimbo", () => {
    expect(legendaSugerida({ antes: "18s", agora: "32s" })).toBe("18s e 32s 💛");
  });

  test("sem carimbo, continua fazendo sentido", () => {
    expect(legendaSugerida(null)).toBe("Então e agora 💛");
  });

  /* ⚠️ "Que barrigão!" é um comentário que só a dona pode fazer sobre o próprio
     corpo — e o app escrevendo isso na legenda dela é o app fazendo o
     comentário. */
  test("⚠️ sem superlativo sobre o corpo dela", () => {
    for (const c of [null, { antes: "18s", agora: "32s" }]) {
      const t = legendaSugerida(c).toLocaleLowerCase("pt-BR");
      for (const proibido of ["barrigão", "enorme", "gigante", "que barriga", "cresceu muito"]) {
        expect(t).not.toContain(proibido);
      }
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   O LEMBRETE — um recurso escondido no compositor não acontece
   ══════════════════════════════════════════════════════════════════════════ */
describe("lembreteDoEntao", () => {
  const AGORA2 = new Date("2026-08-20T12:00:00Z");
  const dias = (n: number) => new Date(AGORA2.getTime() - n * 86_400_000).toISOString();
  const cand = (id: string, d: number, foto = "u") => ({
    id,
    criadoEm: dias(d),
    imagemUrl: foto as string | null,
  });

  test("com candidata e sem lembrete anterior, lembra", () => {
    const r = lembreteDoEntao({
      candidatos: [cand("a", 30)],
      ultimoEm: null,
      agora: AGORA2,
      emCuidado: false,
    });
    expect(r?.id).toBe("a");
  });

  /* ⚠️ A graça do formato é a DISTÂNCIA, e `candidatosAoEntao` devolve em ordem
     decrescente de data: a última da lista é a que mostra mais mudança. */
  test("⚠️ escolhe a MAIS ANTIGA que serve", () => {
    const r = lembreteDoEntao({
      candidatos: [cand("nova", 30), cand("velha", 120)],
      ultimoEm: null,
      agora: AGORA2,
      emCuidado: false,
    });
    expect(r?.id).toBe("velha");
  });

  /* ⚠️ "Que tal comparar com a foto de quatro semanas atrás?" para quem acabou
     de perder a gestação é o que o Modo Cuidado existe para impedir — e a foto
     antiga é da barriga dela. */
  test("⚠️ nunca em Modo Cuidado", () => {
    expect(
      lembreteDoEntao({
        candidatos: [cand("a", 30)],
        ultimoEm: null,
        agora: AGORA2,
        emCuidado: true,
      }),
    ).toBeNull();
  });

  test("sem candidata com foto, não lembra", () => {
    expect(
      lembreteDoEntao({
        candidatos: [cand("a", 30, null as unknown as string)],
        ultimoEm: null,
        agora: AGORA2,
        emCuidado: false,
      }),
    ).toBeNull();
    expect(
      lembreteDoEntao({ candidatos: [], ultimoEm: null, agora: AGORA2, emCuidado: false }),
    ).toBeNull();
  });

  /* ⚠️ O carimbo é escrito quando ele APARECE, não só quando ela dispensa —
     senão quem rola por cima dele o recebe em toda abertura da aba. */
  test("⚠️ respeita a janela de sete dias", () => {
    const base = { candidatos: [cand("a", 40)], agora: AGORA2, emCuidado: false };
    expect(lembreteDoEntao({ ...base, ultimoEm: dias(6) })).toBeNull();
    expect(lembreteDoEntao({ ...base, ultimoEm: dias(8) })?.id).toBe("a");
  });

  /* ⚠️ Errar para o lado de não incomodar é gratuito; para o outro, não. */
  test("⚠️ carimbo ilegível ou do futuro SEGURA o lembrete", () => {
    const base = { candidatos: [cand("a", 40)], agora: AGORA2, emCuidado: false };
    expect(lembreteDoEntao({ ...base, ultimoEm: "ontem" })).toBeNull();
    expect(lembreteDoEntao({ ...base, ultimoEm: dias(-3) })).toBeNull();
  });

  /* ⚠️ O aparelho é compartilhado. */
  test("⚠️ a chave carrega o id da conta", () => {
    expect(chaveDoLembrete("a")).not.toBe(chaveDoLembrete("b"));
  });
});
