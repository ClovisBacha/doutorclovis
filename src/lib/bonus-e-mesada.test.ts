/**
 * A FIAÇÃO DO BÔNUS E DA MESADA — o que os testes da economia não viam.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ────────────────────────────────────────────
 *
 * `economia-sementinhas.test.ts` prova a CONTA. Um verificador adversarial
 * mediu o que ela não prova, mutando o código e rodando os 1.368 testes:
 *
 *   · remover `bonusDeVinculo` de `chooseDoctor` (o caminho MAIS usado) → verde
 *   · inverter a trava de Modo Cuidado em `bonusDeVinculo` → verde
 *   · apagar a trava de Modo Cuidado de `presentearPaciente` → verde
 *
 * A segunda é a pior: invertida, o app paga Sementinhas **só** para quem acabou
 * de perder o bebê — e passava.
 *
 * É a quinta vez nesta base que a mesma armadilha aparece: o teste prova a
 * função extraída e nunca o CHAMADOR. As outras quatro foram o backfill, o
 * bloco do cérebro, o corte da memória e o caminho do dinheiro do cupom.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BONUS_VINCULO_MEDICO, GANHO_DIA_TIPICO } from "./economia-sementinhas";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const sementinhas = semComentarios("src/lib/sementinhas.functions.ts");
const doctors = semComentarios("src/lib/doctors.functions.ts");
const patientlink = semComentarios("src/lib/patientlink.functions.ts");
const invites = semComentarios("src/lib/invites.functions.ts");
const mesada = semComentarios("src/lib/mesada.functions.ts");

describe("1. OS TRÊS caminhos de vínculo pagam o bônus", () => {
  /**
   * São os três — e só os três — que escrevem `patient_profiles.doctor_id`.
   * Faltar em um é o defeito que esta base já teve com o teto de pacientes
   * (existia em dois, vazava no terceiro).
   */
  test("`chooseDoctor` — a busca pública, o caminho mais usado", () => {
    expect(doctors).toContain("bonusDeVinculo(supabaseAdmin, user.id, data.doctorId)");
  });

  test("`respondPatientRequest` — o médico aceita", () => {
    expect(patientlink).toContain(
      "bonusDeVinculo(supabaseAdmin, req.patient_id as string, user.id)",
    );
  });

  test("`redeemInviteCode` — ela resgata o código dele", () => {
    expect(invites).toContain("bonusDeVinculo(supabaseAdmin, u.user.id, row.doctor_id as string)");
  });

  test("e são exatamente TRÊS chamadas em toda a base", () => {
    /* Uma quarta seria um caminho de vínculo que ninguém sabe que existe. */
    const total = [doctors, patientlink, invites].reduce(
      (n, f) => n + (f.match(/bonusDeVinculo\(/g) ?? []).length,
      0,
    );
    expect(total).toBe(3);
  });
});

describe("2. o bônus NÃO é farmável trocando de médico", () => {
  /**
   * A chave era `vinculo:${doctorId}` — única por PAR. `/encontrar-medico` é
   * rota pública e a troca de médico é livre e sem carência: quatro toques na
   * lista pagavam quatro bônus, ou seja 800 🌱 — mais que a loja grátis inteira
   * (704) — em menos de um minuto. A parede de quinze dias caía antes de
   * existir.
   */
  test("a chave de dedupe é FIXA, não carrega o médico", () => {
    expect(sementinhas).toContain('dedupeKey: "vinculo-medico"');
    expect(sementinhas).not.toContain("dedupeKey: `vinculo:${doctorId}`");
  });

  test("e um farm de quatro médicos valeria mais que uma semana de jogo", () => {
    /* A aritmética que descreve o defeito. O número do bônus caiu de 200 para
       100 quando a economia foi recalibrada, então "quatro toques pagam a loja
       inteira" deixou de ser verdade — mas o defeito não era o tamanho do
       bônus, era a chave por par: `/encontrar-medico` é rota pública e a troca
       de médico é livre e sem carência.

       A régua que continua valendo, e que não depende do valor: um farm de um
       minuto não pode valer mais que dias de uso honesto. */
    const umaSemana = 7 * GANHO_DIA_TIPICO;
    expect(BONUS_VINCULO_MEDICO * 4).toBeGreaterThan(umaSemana);
    expect(BONUS_VINCULO_MEDICO).toBeLessThan(umaSemana);
  });
});

describe("3. o bônus só é pago DEPOIS de o vínculo gravar", () => {
  /**
   * No caminho do convite ele era pago ANTES do `if (vincErr)`. Com falha de
   * escrita ela recebia 200 🌱 sem médico nenhum — e, pior, a chave ficava
   * gravada, então quando ela vinculasse de verdade o dedupe engoliria o bônus
   * e ela o perderia para sempre, sem log e sem tela.
   */
  test("no convite, o bônus está no ramo de SUCESSO", () => {
    const i = invites.indexOf("const { error: vincErr }");
    expect(i).toBeGreaterThan(-1);
    const janela = invites.slice(i, i + 900);
    const erro = janela.indexOf("if (vincErr)");
    const bonus = janela.indexOf("bonusDeVinculo");
    expect(erro).toBeGreaterThan(-1);
    expect(bonus).toBeGreaterThan(erro); // o bônus vem DEPOIS da checagem
    expect(janela.slice(erro, bonus)).toContain("} else {");
  });

  test("e nos outros dois também", () => {
    for (const [fonte, marca] of [
      [doctors, "vinculo_falhou"],
      [patientlink, "await desfazer()"],
    ] as const) {
      const erro = fonte.indexOf(marca);
      const bonus = fonte.indexOf("bonusDeVinculo");
      expect(erro).toBeGreaterThan(-1);
      expect(bonus).toBeGreaterThan(erro);
    }
  });
});

describe("4. MODO CUIDADO — quem perdeu a gestação não recebe gamificação", () => {
  /**
   * A mutação mais grave que passou verde: inverter esta condição faz o app
   * pagar Sementinhas SÓ para quem acabou de perder o bebê.
   */
  test("o bônus de vínculo checa, e SAI quando é verdade", () => {
    const i = sementinhas.indexOf("export async function bonusDeVinculo");
    expect(i).toBeGreaterThan(-1);
    const corpo = sementinhas.slice(i, i + 1200);
    expect(corpo).toContain(
      "if (await isCareModeActive(supabaseAdmin as never, patientId)) return;",
    );
  });

  test("a mesada também — e com o mesmo sentido", () => {
    const i = mesada.indexOf("isCareModeActive");
    expect(i).toBeGreaterThan(-1);
    const janela = mesada.slice(i - 120, i + 260);
    expect(janela).toContain('error: "modo_cuidado"');
    /* A ordem importa: `if (ativo) recusa`, nunca `if (!ativo) recusa`. */
    expect(janela).not.toContain("!(await isCareModeActive");
  });
});

describe("5. a mesada não mente sobre o que enviou", () => {
  /**
   * `grantSementinhas` usa `ignoreDuplicates: true`: um segundo presente à mesma
   * paciente no mesmo ciclo é DO NOTHING, sem erro. A versão anterior devolvia
   * `ok: true, quantidade: 500` e o médico lia "500 🌱 enviadas" enquanto a
   * paciente recebia ZERO.
   */
  test("relê a linha e confere que ela é DESTE presente", () => {
    expect(mesada).toContain('.eq("dedupe_key", dedupeKey)');
    expect(mesada).toContain('error: "nao_gravou"');
    /* Era `error: "ja_presenteada"`, quando a chave carregava o CICLO e achar a
       linha significava "ela já ganhou este mês". O limite de um por paciente
       por mês caiu (pedido do dono), a chave passou a carregar o token do
       CLIQUE, e achar a linha passou a significar outra coisa: este mesmo envio
       já foi processado. Isso é sucesso — mas sucesso MARCADO, para a tela não
       comemorar duas vezes o que saiu uma. O que não pode voltar é `ok: true`
       mudo, que era a mentira original. */
    expect(mesada).toContain("repetido: true as const");
  });

  test("e NÃO apaga linha do livro-caixa", () => {
    /* A migration diz, por escrito, "o saldo NUNCA zera, nada é deletado".
       O revert apagava a linha do dedupe — que numa corrida pode ser o presente
       ANTERIOR, já GASTO, deixando o saldo da paciente negativo. */
    const i = mesada.indexOf("export const presentearPaciente");
    const corpo = mesada.slice(i);
    expect(corpo).not.toContain('from("sementinhas_ledger")\n      .delete()');
    expect(corpo).not.toContain(".delete()");
  });

  test("o teto é conferido ANTES da escrita", () => {
    const i = mesada.indexOf("export const presentearPaciente");
    const corpo = mesada.slice(i);
    const checa = corpo.indexOf("mesada_esgotada");
    const grava = corpo.indexOf("grantSementinhas");
    expect(checa).toBeGreaterThan(-1);
    expect(checa).toBeLessThan(grava);
  });

  test("e o vínculo ATUAL é exigido — presente é mensagem", () => {
    const i = mesada.indexOf("export const presentearPaciente");
    const corpo = mesada.slice(i);
    expect(corpo).toContain('.eq("doctor_id", doctorId)');
    expect(corpo).toContain('error: "sem_vinculo"');
  });
});

describe("5b. dizer «enviado» duas vezes era MENTIRA nos dois lados", () => {
  /**
   * ─── O DEFEITO QUE O PRÓPRIO COMENTÁRIO DIZIA TER CONSERTADO ──────────────
   *
   * A conferência relia a linha DEPOIS da escrita e só acusava repetição quando
   * o valor gravado DIFERIA do novo. Ou seja: pegava "mandei Semente e agora
   * Jardim", e deixava passar o caso mais comum de todos — **mandar o mesmo
   * presente duas vezes**.
   *
   * Dois toques no mesmo botão devolviam `ok: true` nos dois. A tela dizia
   * "enviado" duas vezes. A segunda não escreveu nada, porque
   * `grantSementinhas` ignora duplicata em silêncio.
   *
   * Um verificador adversarial achou isso nas DUAS mesadas — com o comentário
   * logo acima afirmando o contrário, o que é o pior jeito de um defeito
   * sobreviver: quem lê acredita e não confere.
   *
   * A régua certa é a EXISTÊNCIA da linha ANTES da escrita.
   */
  const pacienteFns = semComentarios("src/lib/mesada-paciente.functions.ts");

  for (const [onde, fonte] of [
    ["a mesada do médico", mesada],
    ["a mesada da paciente", pacienteFns],
  ] as const) {
    test(`${onde} lê a linha ANTES de gravar`, () => {
      const iLeitura = fonte.indexOf("jaExistia");
      const iEscrita = fonte.indexOf("grantSementinhas(typedDb");
      expect(iLeitura).toBeGreaterThan(-1);
      expect(iEscrita).toBeGreaterThan(-1);
      expect(iLeitura).toBeLessThan(iEscrita);
    });

    test(`${onde} não repassa a duplicata como envio novo`, () => {
      /* A DUAS mesadas precisam distinguir "gravou agora" de "já estava lá" —
         `grantSementinhas` ignora duplicata em silêncio, e `ok: true` mudo era
         a mentira original.

         O que muda entre as duas é o SENTIDO de achar a linha, porque só a do
         médico perdeu o limite mensal:

          · na do MÉDICO a chave carrega o token do clique, então a linha só
            existe se este mesmo envio já rodou — sucesso, marcado com
            `repetido` para a tela não festejar de novo;
          · na da PACIENTE a chave ainda carrega o ciclo e o limite de uma amiga
            por mês continua de pé, então a linha significa recusa. */
      const i = fonte.indexOf("if (jaExistia)");
      expect(i).toBeGreaterThan(-1);
      const bloco = fonte.slice(i, i + 260);
      const esperado =
        onde === "a mesada do médico" ? "repetido: true as const" : 'error: "ja_presenteada"';
      expect(bloco).toContain(esperado);
    });

    test(`${onde} não decide repetição comparando VALORES`, () => {
      /* A asserção que descreve o defeito: era `gravou.amount !== quanto`. */
      expect(fonte).not.toContain("!== quanto");
    });
  }

  test("a mesada da PACIENTE mantém uma amiga por ciclo", () => {
    /* O dono tirou o limite da mesada do MÉDICO, e só dela. Entre amigas o
       bolso é bem menor (`MESADA_DA_ASSINANTE`) e o limite é o que impede uma
       assinante de despejar o mês inteiro numa conta só. */
    expect(pacienteFns).toContain("const ciclo = inicioDoCiclo()");
    expect(pacienteFns).toMatch(/amiga:\$\{uid\}:\$\{data\.amigaId\}:\$\{ciclo\}/);
  });
});

describe("6. a mesada não sai do plano ANTIGO", () => {
  /**
   * Ela lia `ent.aiRepliesPerCycle`, e os planos antigos têm tetos de outra
   * ordem: Black = 30.000 → mesada de **90.000 🌱/mês**, doze vezes o topo que a
   * escada nova pretende. Sementinha não custa dinheiro, então isso não
   * quebraria a fatura — quebraria a economia da loja, que é calibrada dia a dia.
   */
  test("o fallback é a ENTRADA da escada, não o teto do plano velho", () => {
    expect(mesada).toContain("ENTRADA_MENSAGENS");
    expect(mesada).not.toContain("ent.aiRepliesPerCycle");
  });
});
