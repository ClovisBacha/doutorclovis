/**
 * O ASSENTO DE CLÍNICA, EXERCITADO.
 *
 * Duas coisas passaram por aqui sem nenhum teste de comportamento:
 *
 * 1. O assento herdava `plan = "clinica"` FIXO — e `clinica` tem
 *    `aiRepliesPerCycle: null` e `maxPatients: null`. Qualquer médico adicionado
 *    a uma clínica ativa ganhava IA ilimitada e pacientes ilimitadas, de graça,
 *    para sempre. Passou a herdar o plano do DONO.
 *
 * 2. A exceção "só sobe quem está abaixo do Elite". Ela existia porque `CLINICA`
 *    herdava de `PRO`, então subir para Clínica zerava os convites premium e
 *    devolvia o selo "Pro". A escada foi consertada (`CLINICA` herda de `BLACK`)
 *    e o comentário do conserto dizia que a exceção existia só para contornar a
 *    escada quebrada — mas a exceção ficou no código. E aí VIROU a inversão:
 *    `clinica` é rank 8, acima de elite (6) e black (7), então um Elite numa
 *    clínica de dono Clínica ficava de fora do assento que o ELEVARIA.
 *
 * Um verificador plantou a exceção de volta e a suíte inteira ficou verde.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

const DIA = 24 * 60 * 60 * 1000;
const emDias = (d: number) => new Date(Date.now() + d * DIA).toISOString();

function bancoFalso(opts: {
  membro: { plan: string; active?: boolean; expira?: string | null; clinicId?: string | null };
  clinica?: { active: boolean; owner: string } | null;
  dono?: { plan: string; active?: boolean; expira?: string | null } | null;
}) {
  return {
    from(tabela: string) {
      const q: any = {
        select: () => q,
        eq: (_c: string, v: string) => {
          q._id = v;
          return q;
        },
        maybeSingle: async () => {
          if (tabela === "clinics") {
            return {
              data: opts.clinica
                ? { active: opts.clinica.active, owner_user_id: opts.clinica.owner }
                : null,
              error: null,
            };
          }
          /* `doctors` é lida DUAS vezes: o membro e, depois, o dono. */
          if (q._id === "dono-1") {
            return {
              data: opts.dono
                ? {
                    plan: opts.dono.plan,
                    active: opts.dono.active ?? true,
                    plan_expires_at: opts.dono.expira ?? null,
                  }
                : null,
              error: null,
            };
          }
          return {
            data: {
              plan: opts.membro.plan,
              active: opts.membro.active ?? true,
              plan_expires_at: opts.membro.expira ?? null,
              clinic_id: opts.membro.clinicId ?? null,
            },
            error: null,
          };
        },
      };
      return q;
    },
  };
}

async function planoDe(opts: Parameters<typeof bancoFalso>[0]): Promise<string> {
  const real = await import("@/integrations/supabase/client.server");
  mock.module("@/integrations/supabase/client.server", () => ({
    ...real,
    supabaseAdmin: bancoFalso(opts),
  }));
  const { effectivePlan } = await import("./entitlements.server");
  return effectivePlan({ id: "membro-1", email: "medico@exemplo.com" });
}

const CLINICA_ATIVA = { active: true, owner: "dono-1" };

afterEach(() => {
  mock.restore();
});

describe("1. o assento herda o plano do DONO, não um cheque em branco", () => {
  test("dono Clínica → o membro sobe para Clínica", () => {
    return planoDe({
      membro: { plan: "free", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "clinica" },
    }).then((p) => expect(p).toBe("clinica"));
  });

  test("dono no plano de mensagens → o membro sobe só até ele, não até Clínica", () => {
    /* A asserção que descreve o defeito: era `plan = "clinica"` fixo, e
       `clinica` tem IA e pacientes ILIMITADAS. */
    return planoDe({
      membro: { plan: "free", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "mensagens" },
    }).then((p) => expect(p).toBe("mensagens"));
  });

  test("dono com o cartão vencido → o assento cai junto", () => {
    /* É o único jeito de o contrato fechar: senão a plataforma banca o uso do
       membro depois que a clínica parou de pagar. */
    return planoDe({
      membro: { plan: "free", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "clinica", expira: emDias(-30) },
    }).then((p) => expect(p).toBe("free"));
  });

  test("dono desativado → o assento não vale nada", () => {
    return planoDe({
      membro: { plan: "free", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "clinica", active: false },
    }).then((p) => expect(p).toBe("free"));
  });

  test("clínica INATIVA não dá assento nenhum", () => {
    return planoDe({
      membro: { plan: "free", clinicId: "cl-1" },
      clinica: { active: false, owner: "dono-1" },
      dono: { plan: "clinica" },
    }).then((p) => expect(p).toBe("free"));
  });

  test("sem clínica, o médico vale o próprio plano", () => {
    return planoDe({ membro: { plan: "free" } }).then((p) => expect(p).toBe("free"));
  });
});

describe("2. o assento SÓ SOBE — nunca rebaixa", () => {
  test("membro no plano de mensagens numa clínica de dono Free continua no dele", () => {
    /* Ele paga o próprio plano; o assento é um bônus, não um teto. */
    return planoDe({
      membro: { plan: "mensagens", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "free" },
    }).then((p) => expect(p).toBe("mensagens"));
  });

  test("membro Clínica numa clínica de dono no plano de mensagens continua Clínica", () => {
    return planoDe({
      membro: { plan: "clinica", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "mensagens" },
    }).then((p) => expect(p).toBe("clinica"));
  });
});

describe("3. a exceção 'só sobe quem está abaixo do Elite' não existe mais", () => {
  /**
   * Estes dois são os que o mutante do verificador mata. Com o portão de volta,
   * a herança inteira é pulada para Elite e Black — e como `clinica` é rank 8,
   * o portão passou a impedir exatamente a subida que ele dizia proteger.
   */
  test("Elite numa clínica de dono Clínica SOBE para Clínica", () => {
    return planoDe({
      membro: { plan: "mensagens", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "clinica" },
    }).then((p) => expect(p).toBe("clinica"));
  });

  test("Black numa clínica de dono Clínica também", () => {
    return planoDe({
      membro: { plan: "clinica", clinicId: "cl-1" },
      clinica: CLINICA_ATIVA,
      dono: { plan: "clinica" },
    }).then((p) => expect(p).toBe("clinica"));
  });

  test("e subir para Clínica não custa nada ao Elite — a escada é monotônica", async () => {
    /* A razão pela qual a exceção existia: `CLINICA` herdava de `PRO`, então
       subir zerava os convites premium e devolvia o selo "Pro". Se voltar a
       herdar errado, a exceção volta a ser necessária — e este teste avisa. */
    const { PLAN_ENTITLEMENTS } = await import("./entitlements");
    const cl = PLAN_ENTITLEMENTS.clinica;
    const el = PLAN_ENTITLEMENTS.mensagens;
    expect(cl.premiumInvitesPerMonth ?? 0).toBeGreaterThanOrEqual(el.premiumInvitesPerMonth ?? 0);
    expect(cl.maxBrains === null || (cl.maxBrains ?? 0) >= (el.maxBrains ?? 0)).toBe(true);
  });
});
