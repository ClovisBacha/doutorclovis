import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  EXPLICACAO_DA_SUGESTAO,
  MINIMO_PARA_MOSTRAR,
  RASCUNHO_DA_PRIMEIRA,
  SUGESTOES_DE_CONVERSA,
  sugerirConversas,
  TITULO_DA_SUGESTAO,
  type CandidataAConversa,
} from "./conversa-sugerida";

const FONTE = readFileSync("src/lib/conversa-sugerida.ts", "utf8");
/* ⚠️ Tira os comentários antes de procurar. A prosa deste arquivo CITA o que
   ele proíbe ("28 semanas", "seguidores"), e um teste que aceita a própria
   documentação fica verde exatamente quando o defeito está descrito. Já
   aconteceu duas vezes neste repo, nos dois sentidos. */
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

function c(id: string, extra: Partial<CandidataAConversa> = {}): CandidataAConversa {
  return { id, nome: id, avatarUrl: null, fase: "t2", ultimaVez: null, ...extra };
}

describe("a sugestão de conversa", () => {
  test("junta quem está na mesma fase", () => {
    const r = sugerirConversas({
      euId: "eu",
      minhaFase: "t2",
      candidatas: [c("a"), c("b"), c("c", { fase: "t3" })],
      bloqueadas: new Set(),
      jaConverso: new Set(),
    });
    expect(r.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("⚠️ sem a minha fase, não sugere ninguém", () => {
    /* Sem fase não há assunto, e "alguém" não é motivo para escrever a uma
       estranha. Devolver a lista inteira aqui seria transformar a caixa de
       entrada num catálogo de pacientes.

       ⚠️ **Quem garante isto é `mesmaFase`, e não o `if` de atalho da função** —
       a mutação que apaga aquele `if` sobrevive, de propósito, porque o
       resultado é o mesmo. O teste abaixo trava o COMPORTAMENTO, que é o que
       importa; o teste que trava a linha travaria a implementação e mentiria no
       dia em que ela mudasse. */
    expect(
      sugerirConversas({
        euId: "eu",
        minhaFase: null,
        candidatas: [c("a"), c("b"), c("d")],
        bloqueadas: new Set(),
        jaConverso: new Set(),
      }),
    ).toEqual([]);
  });

  test("⚠️ e é `mesmaFase` quem sustenta isso, inclusive com os dois nulos", () => {
    /* O caso que o atalho esconde: candidata TAMBÉM sem fase. Se `mesmaFase`
       um dia passasse a casar `null` com `null`, a paciente sem DUM receberia
       como sugestão todas as outras sem DUM — e o `if` de cima não a salvaria,
       porque ele só olha o MEU lado. */
    expect(
      sugerirConversas({
        euId: "eu",
        minhaFase: null,
        candidatas: [c("a", { fase: null }), c("b", { fase: null })],
        bloqueadas: new Set(),
        jaConverso: new Set(),
      }),
    ).toEqual([]);
  });

  test("⚠️ o bloqueio tira da fileira — nos dois sentidos", () => {
    /* A lista de sugestões seria a porta dos fundos do bloqueio, e a mais
       cruel: o app apresentando de volta quem ela afastou. */
    const r = sugerirConversas({
      euId: "eu",
      minhaFase: "t2",
      candidatas: [c("a"), c("b"), c("z")],
      bloqueadas: new Set(["a"]),
      jaConverso: new Set(),
    });
    expect(r.map((x) => x.id)).toEqual(["b", "z"]);
  });

  test("⚠️ quem já tem conversa não é sugerido", () => {
    const r = sugerirConversas({
      euId: "eu",
      minhaFase: "t2",
      candidatas: [c("a"), c("b"), c("z")],
      bloqueadas: new Set(),
      jaConverso: new Set(["b"]),
    });
    expect(r.map((x) => x.id)).toEqual(["a", "z"]);
  });

  test("eu nunca apareço na minha própria fileira", () => {
    expect(
      sugerirConversas({
        euId: "eu",
        minhaFase: "t2",
        candidatas: [c("eu"), c("a"), c("b")],
        bloqueadas: new Set(),
        jaConverso: new Set(),
      }).map((x) => x.id),
    ).toEqual(["a", "b"]);
  });

  test(`⚠️ abaixo de ${MINIMO_PARA_MOSTRAR} a fileira não existe`, () => {
    /* Com UMA candidata a fileira deixa de ser sobre a FASE e passa a ser sobre
       uma pessoa — e numa base pequena isso vira identificação. */
    expect(
      sugerirConversas({
        euId: "eu",
        minhaFase: "t2",
        candidatas: [c("a")],
        bloqueadas: new Set(),
        jaConverso: new Set(),
      }),
    ).toEqual([]);
  });

  test("ordena por quem apareceu por último, com desempate estável", () => {
    const r = sugerirConversas({
      euId: "eu",
      minhaFase: "t2",
      candidatas: [
        c("velha", { ultimaVez: "2026-08-01T10:00:00Z" }),
        c("nova", { ultimaVez: "2026-08-20T10:00:00Z" }),
        c("zzz"),
        c("aaa"),
      ],
      bloqueadas: new Set(),
      jaConverso: new Set(),
      limite: 4,
    });
    expect(r.map((x) => x.id)).toEqual(["nova", "velha", "aaa", "zzz"]);
  });

  test("a mesma entrada devolve a mesma ordem duas vezes", () => {
    /* Sem desempate estável, duas candidatas sem `last_seen_at` trocam de lugar
       entre duas aberturas e a fileira parece um sorteio. */
    const entrada = {
      euId: "eu",
      minhaFase: "t2" as const,
      candidatas: [c("m"), c("n"), c("o")],
      bloqueadas: new Set<string>(),
      jaConverso: new Set<string>(),
    };
    expect(sugerirConversas(entrada).map((x) => x.id)).toEqual(
      sugerirConversas(entrada).map((x) => x.id),
    );
  });

  test(`o teto é ${SUGESTOES_DE_CONVERSA}`, () => {
    const r = sugerirConversas({
      euId: "eu",
      minhaFase: "t2",
      candidatas: ["a", "b", "c", "d", "e", "f"].map((x) => c(x)),
      bloqueadas: new Set(),
      jaConverso: new Set(),
    });
    expect(r).toHaveLength(SUGESTOES_DE_CONVERSA);
  });
});

describe("⚠️ o bloqueio que falha FECHADO passa intacto", () => {
  test("um conjunto que diz `true` para todos zera a fileira", () => {
    /* É o `ConjuntoDeBloqueio` degradado: quando a leitura falha, ele responde
       `true` para todo mundo. Se esta régua exigisse um `Set` de verdade, o
       servidor teria de converter — e a conversão perde a propriedade, porque
       um `Set` de lista vazia responde `false` para todos e a fileira passaria
       a sugerir justamente quem ela deveria esconder. */
    const tudoBloqueado = { has: () => true };
    expect(
      sugerirConversas({
        euId: "eu",
        minhaFase: "t2",
        candidatas: [c("a"), c("b"), c("z")],
        bloqueadas: tudoBloqueado,
        jaConverso: new Set(),
      }),
    ).toEqual([]);
  });
});

describe("⚠️ o que esta régua NÃO pode saber", () => {
  test("nem a semana nem a DPP entram no arquivo", () => {
    /* A régua é a FASE (`fase-parecida.ts`), e o número da semana é dado
       clínico governado pela chave `mostrar_semana`. Uma sugestão que dissesse
       "ela também está de 28 semanas" publicaria pela porta lateral o que a
       chave fecha na frente. */
    for (const proibido of ["lmp_date", "computeGestation", "semanas", "weeks", "dpp"]) {
      expect({ proibido, presente: CODIGO.toLowerCase().includes(proibido.toLowerCase()) }).toEqual(
        {
          proibido,
          presente: false,
        },
      );
    }
  });

  test("⚠️ engajamento não é sinal — nenhum", () => {
    /* A mesma proibição de `sugestoes.ts`, e pela mesma razão: numa base de
       gestação de alto risco, o post que mais engaja é o da EMERGÊNCIA. */
    for (const proibido of ["reacao", "reagi", "curtid", "seguidor", "elosEmComum", "audiencia"]) {
      expect({ proibido, presente: CODIGO.toLowerCase().includes(proibido.toLowerCase()) }).toEqual(
        {
          proibido,
          presente: false,
        },
      );
    }
  });

  test("⚠️ doctor_id nunca vira grafo social", () => {
    /* Montar sugestão a partir de com quem ela se trata é usar o prontuário
       para sugerir amizade, mesmo que a tela nunca diga o motivo. */
    expect(CODIGO).not.toContain("doctor_id");
  });
});

describe("os textos da fileira", () => {
  test("⚠️ o título não diz semana nem conta pessoas", () => {
    expect(TITULO_DA_SUGESTAO).not.toMatch(/\d/);
    expect(TITULO_DA_SUGESTAO.toLowerCase()).not.toContain("semana");
  });

  test("a explicação diz a régua de privacidade em voz alta", () => {
    /* Sem a frase, quem fechou o perfil e não se vê aqui conclui que a fileira
       está quebrada — e quem deixou aberto não sabe que está aparecendo. */
    expect(EXPLICACAO_DA_SUGESTAO.toLowerCase()).toContain("perfil aberto");
  });

  test("⚠️ o rascunho da primeira mensagem não cita gestação", () => {
    /* "Vi que você também está de 28 semanas" é o texto óbvio, e é o que a
       régua inteira existe para não deixar sair. */
    for (const proibido of ["semana", "grávida", "gravida", "bebê", "bebe", "gestaç"]) {
      expect({
        proibido,
        presente: RASCUNHO_DA_PRIMEIRA.toLowerCase().includes(proibido),
      }).toEqual({ proibido, presente: false });
    }
  });

  test("e não promete amizade nem encontro", () => {
    for (const p of ["amiga", "amizade", "perto de você", "conheça"]) {
      expect(`${TITULO_DA_SUGESTAO} ${RASCUNHO_DA_PRIMEIRA}`.toLowerCase()).not.toContain(p);
    }
  });
});
