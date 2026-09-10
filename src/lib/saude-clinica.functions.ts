/**
 * A FILA CLÍNICA ESTÁ COMPLETA? — o controle que faltava, e os dois riscos que
 * ele cobre.
 *
 * ⚠️ **A VIEW `clinical_events` PODE ESTAR INCOMPLETA SEM NINGUÉM SABER.**
 *
 * Ela é montada dinamicamente (`DO` + `to_regclass`): cada uma das doze fontes
 * só entra se a tabela dela existir no instante em que o SQL roda. É um desenho
 * deliberado e certo — produção tem menos tabelas que o repositório, e um
 * `CREATE VIEW` sobre tabela ausente falharia inteiro, derrubando junto as
 * fontes que existem.
 *
 * O preço é uma dependência de ORDEM que nada verifica: se `epds_logs` nasceu
 * num `APLICAR_` rodado DEPOIS do da view, a EPDS simplesmente não está lá. A
 * view existe, as consultas respondem, a fila do médico só tem uma fonte a
 * menos.
 *
 * ⚠️ **E a fonte mais provável de ficar de fora é a pior possível.** A questão
 * 10 da EPDS é **ideação de autolesão** — `clinical.functions.ts` a trata como
 * `gravidade: "grave"`. Uma paciente pode responder que sim, a linha grava, e
 * o evento nunca chega ao médico. Não há erro, não há log, não há tela vazia:
 * há uma fila que parece completa.
 *
 * Este handler compara, fonte a fonte: **a tabela tem linhas** e **a view
 * devolve linhas daquela fonte**? Tem e não devolve = a view está velha.
 *
 * ⚠️ **"Sem dados" NUNCA vira "ok".** Uma tabela vazia não prova nada sobre a
 * view, e responder verde ali seria a mesma mentira que este arquivo existe
 * para pegar. O estado é `indeterminado`, e a tela diz isso.
 *
 * ⚠️ **E CONFERIR A FONTE NÃO CONFERE O CAMPO — é o segundo risco, e ele
 * acontece com mais frequência.** A view não só GANHA fontes: ela ganha
 * CAMPOS. Quando `kick_sessions` passou a projetar `forca` e `duracao_min`, a
 * fonte já estava lá — a comparação fonte-a-fonte responde `ok` do mesmo jeito,
 * com a view antiga, e nada nesta tela mudaria de cor. O dado é gravado, a
 * fonte aparece verde, e o campo simplesmente não existe no `dados`.
 *
 * O preço é conhecido: sem `duracao_min`, `sinalMovimentosReduzidos` recebe
 * `undefined` e **cala** (degradação segura, por construção) — então uma noite
 * de duas horas com quatro movimentos chega ao prontuário como "4 movimentos",
 * sem cor e sem número. Nada quebra; o alarme deixa de existir.
 *
 * Por isso a segunda comparação, campo a campo: **a tabela tem linha que PODE
 * produzir aquele campo** e **a view devolve alguma linha com ele preenchido**?
 * Tem e não devolve = a view está velha, e o conserto é rodar de novo o mesmo
 * `APLICAR_EVENTOS_CLINICOS.sql` (idempotente — ela se amplia sozinha).
 *
 * ⚠️ **As duas RÉGUAS moram em `saude-clinica.ts`, puras.** Aqui ficam só as
 * sondas: enterradas no handler, as decisões só poderiam ser testadas por
 * TEXTO — e teste de texto fica verde exatamente sobre o defeito que ele
 * existe para pegar.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSuperAdmin, TokenSchema } from "@/lib/platform-admin.server";
import {
  CAMPOS_CLINICOS,
  estadoDaFonte,
  estadoDoCampo,
  FONTES_CLINICAS,
  type EstadoDaFonte,
  type EstadoDoCampo,
  type SaudeClinica,
  type Sonda,
} from "@/lib/saude-clinica";

export {
  CAMPOS_CLINICOS,
  FONTES_CLINICAS,
  type EstadoDaFonte,
  type EstadoDoCampo,
  type SaudeClinica,
};

/** A sonda que não chegou a acontecer — a view não existe, então nada dela vale. */
const NAO_SONDADO: Sonda = { n: null, ausente: false, semColuna: false };

/** Conta linhas sem trazer nenhuma — o conteúdo clínico não precisa viajar. */
async function contar(sb: any, tabela: string, filtro?: (q: any) => any): Promise<Sonda> {
  let q = sb.from(tabela).select("*", { count: "exact", head: true });
  if (filtro) q = filtro(q);
  const { count, error } = await q;
  if (error) {
    return {
      n: null,
      ausente: error.code === "42P01",
      semColuna: error.code === "42703",
    };
  }
  return { n: count ?? 0, ausente: false, semColuna: false };
}

export const saudeClinica = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TokenSchema.parse(i))
  .handler(async ({ data }): Promise<SaudeClinica | { ok: false }> => {
    const user = await requireSuperAdmin(data.accessToken);
    if (!user) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const daView = await contar(sb, "clinical_events");
    const viewExiste = !daView.ausente && daView.n !== null;

    /* ⚠️ Todas as sondas em PARALELO: são 28 contagens independentes, e em
       série seriam 28 latências somadas numa tela que o dono abre para ter uma
       resposta rápida. */
    const fontesEmVoo = Promise.all(
      FONTES_CLINICAS.map(async (f): Promise<EstadoDaFonte> => {
        const [tabela, naView] = await Promise.all([
          contar(sb, f.tabela),
          viewExiste
            ? contar(sb, "clinical_events", (q: any) => q.eq("fonte", f.tabela))
            : Promise.resolve(NAO_SONDADO),
        ]);
        return {
          tabela: f.tabela,
          nome: f.nome,
          peso: f.peso,
          linhasNaTabela: tabela.n,
          linhasNaView: naView.n,
          estado: estadoDaFonte(tabela, naView, viewExiste),
        };
      }),
    );

    /* ⚠️ As duas comparações saem na MESMA leva, e a espera é a de UMA.
       Encadeá-las (`await` das fontes, depois o dos campos) somaria duas
       latências — e as duas só dependem de `viewExiste`, já resolvido acima. */
    const camposEmVoo = Promise.all(
      CAMPOS_CLINICOS.map(async (c): Promise<EstadoDoCampo> => {
        const [naTabela, naView] = await Promise.all([
          /* ⚠️ "Quantas linhas PODEM produzir este campo?" — nunca "quantas
             linhas a tabela tem". Uma sessão de chutes ainda aberta não produz
             duração nenhuma, e contá-la faria a tela acusar view velha sobre
             uma paciente que só não terminou de contar. */
          contar(sb, c.fonte, (q: any) => q.not(c.colunaDaTabela, "is", null)),
          /* ⚠️ Chave de `jsonb` ausente devolve NULL no `->>`, então este filtro
             conta exatamente as linhas em que a view PROJETOU o campo. Se o
             PostgREST recusar a sintaxe, o erro cai em `ilegivel` — "não
             consegui conferir" nunca vira "ok". */
          viewExiste
            ? contar(sb, "clinical_events", (q: any) =>
                q.eq("fonte", c.fonte).not(`dados->>${c.campo}`, "is", null),
              )
            : Promise.resolve(NAO_SONDADO),
        ]);
        return {
          fonte: c.fonte,
          campo: c.campo,
          nome: c.nome,
          peso: c.peso,
          sqlDaColuna: c.sqlDaColuna,
          linhasQuePodem: naTabela.n,
          linhasComOCampo: naView.n,
          estado: estadoDoCampo(naTabela, naView, viewExiste),
        };
      }),
    );

    const [fontes, campos] = await Promise.all([fontesEmVoo, camposEmVoo]);

    return {
      ok: true as const,
      viewExiste,
      fontes,
      foraDaView: fontes.filter((f) => f.estado === "fora_da_view").length,
      ausentes: fontes.filter((f) => f.estado === "ausente").length,
      campos,
      camposForaDaView: campos.filter((c) => c.estado === "fora_da_view").length,
    };
  });
