/**
 * "A FILA CLÍNICA ESTÁ COMPLETA?" — a tela do controle mais importante do admin.
 *
 * ⚠️ **ELA EXISTE PARA UM ÚNICO DESFECHO: uma fonte clínica fora da view.** A
 * view `clinical_events` é montada com guardas `to_regclass`, então uma tabela
 * criada depois da última execução do SQL fica de fora em silêncio. A fonte
 * mais provável de ficar de fora carrega a questão 10 da EPDS — ideação de
 * autolesão.
 *
 * Por isso o alarme é DESPROPORCIONAL de propósito: uma fonte fora da view
 * ocupa a tela inteira, em vermelho, com a instrução do que rodar. Um aviso
 * discreto numa lista de doze linhas seria lido como detalhe.
 *
 * ⚠️ **E o segundo alarme é sobre CAMPO, não sobre fonte.** Uma view que ganhou
 * campos novos (`forca`, `duracao_min`) e não foi recriada deixa as doze fontes
 * VERDES e o alarme clínico calado. Ele tem o mesmo peso visual do primeiro
 * porque tem o mesmo desfecho: dado gravado que não chega ao médico.
 *
 * ⚠️ **E VERMELHO E VERDE NUNCA APARECEM JUNTOS.** A caixa verde fala das
 * fontes; com um campo fora da view ela seria lida como "está tudo certo" a um
 * centímetro de um alarme dizendo o contrário — a contradição na mesma tela que
 * este repositório já pagou uma vez. Ela espera as DUAS comparações.
 */
import { useEffect, useState } from "react";

import { adminToken, EmptyHint, Panel } from "@/components/admin-ui";
import {
  conferidas as contarConferidas,
  podeDizerQueEstaCerto,
  type EstadoDaFonte,
  type EstadoDoCampo,
  type SaudeClinica,
} from "@/lib/saude-clinica";

const CORES: Record<EstadoDaFonte["estado"], string> = {
  fora_da_view: "border-red-500/50 bg-red-500/10",
  ausente: "border-amber-500/40 bg-amber-500/10",
  ilegivel: "border-amber-500/40 bg-amber-500/10",
  indeterminado: "border-border bg-muted/30",
  ok: "border-emerald-500/30 bg-emerald-500/5",
};

const RECADO: Record<EstadoDaFonte["estado"], string> = {
  fora_da_view: "TEM DADO E NÃO CHEGA AO MÉDICO",
  ausente: "tabela não existe",
  ilegivel: "não deu para ler",
  indeterminado: "sem dados — não dá para concluir",
  ok: "chegando",
};

const CORES_CAMPO: Record<EstadoDoCampo["estado"], string> = {
  fora_da_view: "border-red-500/50 bg-red-500/10",
  coluna_ausente: "border-amber-500/40 bg-amber-500/10",
  tabela_ausente: "border-amber-500/40 bg-amber-500/10",
  ilegivel: "border-amber-500/40 bg-amber-500/10",
  indeterminado: "border-border bg-muted/30",
  ok: "border-emerald-500/30 bg-emerald-500/5",
};

const RECADO_CAMPO: Record<EstadoDoCampo["estado"], string> = {
  fora_da_view: "A VIEW NÃO PROJETA ESTE CAMPO",
  coluna_ausente: "a coluna de origem não existe",
  tabela_ausente: "a tabela não existe",
  ilegivel: "não deu para ler",
  indeterminado: "sem dado que produza o campo",
  ok: "chegando",
};

export function SaudeClinicaTab({ bancada }: { bancada?: SaudeClinica | "falhou" } = {}) {
  const [d, setD] = useState<SaudeClinica | null>(bancada && bancada !== "falhou" ? bancada : null);
  const [carregando, setCarregando] = useState(!bancada);
  const [falhou, setFalhou] = useState(bancada === "falhou");
  const ehBancada = Boolean(bancada);
  /* Quantas comparações de fato PROVARAM alguma coisa — só as que têm linha na
     tabela dizem se a view as alcança. A régua é pura para poder ser testada. */
  const provado = contarConferidas({ fontes: d?.fontes ?? [], campos: d?.campos ?? [] });

  useEffect(() => {
    if (ehBancada) return;
    let vivo = true;
    (async () => {
      try {
        const { saudeClinica } = await import("@/lib/saude-clinica.functions");
        const r = await saudeClinica({ data: { accessToken: await adminToken() } });
        if (!vivo) return;
        if (r.ok) setD(r);
        else setFalhou(true);
      } catch {
        if (vivo) setFalhou(true);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [ehBancada]);

  return (
    <div className="space-y-4">
      {carregando && !d && <EmptyHint>Conferindo as doze fontes clínicas…</EmptyHint>}

      {falhou && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Não foi possível conferir agora. <strong>Isto não quer dizer que está tudo certo</strong>{" "}
          — quer dizer que a checagem falhou.
        </div>
      )}

      {d && (
        <>
          {/* ⚠️ O alarme ocupa a tela ANTES da lista: uma fonte clínica que não
              chega ao médico não pode ser uma linha entre doze. */}
          {d.foraDaView > 0 && (
            <div className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4">
              <p className="text-base font-bold text-red-600 dark:text-red-400">
                ⚠️ {d.foraDaView} fonte{d.foraDaView === 1 ? "" : "s"} clínica
                {d.foraDaView === 1 ? "" : "s"} com dado que NÃO chega ao médico
              </p>
              <p className="mt-2 text-sm">
                A view <code className="rounded bg-muted px-1">clinical_events</code> foi montada
                antes destas tabelas existirem, então elas ficaram de fora dela. O que a paciente
                registra ali é gravado e nunca aparece na fila de trabalho.
              </p>
              <p className="mt-2 text-sm font-medium">
                Conserto: rodar de novo{" "}
                <code className="rounded bg-muted px-1">supabase/APLICAR_EVENTOS_CLINICOS.sql</code>{" "}
                — ele é idempotente e a view se amplia sozinha.
              </p>
            </div>
          )}

          {/* ⚠️ O MESMO PESO DO ALARME DE FONTE, e pela mesma razão: as doze
              fontes podem estar todas verdes com a view velha — a comparação
              fonte-a-fonte não enxerga campo. */}
          {d.camposForaDaView > 0 && (
            <div className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4">
              <p className="text-base font-bold text-red-600 dark:text-red-400">
                ⚠️ A view está VELHA: {d.camposForaDaView} campo
                {d.camposForaDaView === 1 ? "" : "s"} clínico
                {d.camposForaDaView === 1 ? "" : "s"} que a paciente registra e a view não projeta
              </p>
              <p className="mt-2 text-sm">
                A fonte está na view — por isso a lista abaixo fica verde —, mas a versão dela é
                anterior a estes campos. O dado é gravado e a régua clínica que depende dele{" "}
                <strong>cala em silêncio</strong>: nada quebra, e o alarme deixa de existir.
              </p>
              <p className="mt-2 text-sm font-medium">
                Conserto: rodar de novo{" "}
                <code className="rounded bg-muted px-1">supabase/APLICAR_EVENTOS_CLINICOS.sql</code>{" "}
                — o mesmo arquivo, idempotente; ele remonta a view com os campos.
              </p>
            </div>
          )}

          {!d.viewExiste && (
            <div className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4">
              <p className="text-base font-bold text-red-600 dark:text-red-400">
                ⚠️ A view <code>clinical_events</code> não respondeu
              </p>
              <p className="mt-2 text-sm">
                Sem ela a fila de trabalho do médico não existe. Rode{" "}
                <code className="rounded bg-muted px-1">supabase/APLICAR_EVENTOS_CLINICOS.sql</code>
                .
              </p>
            </div>
          )}

          {/* ⚠️ **"NADA FICOU DE FORA" e "NADA PÔDE SER CONFERIDO" NÃO SÃO A
              MESMA FRASE.** Numa base nova todas as doze tabelas estão vazias,
              e a versão anterior desta caixa dizia "nenhuma fonte com dado
              ficou de fora da view" — verdade literal, e lida como aprovação
              sobre uma checagem que não checou nada. É exatamente o tipo de
              tranquilização falsa que esta tela existe para não dar. */}
          {/* ⚠️ AS DUAS CONTAGENS, e nunca só a das fontes: com um número só,
              esta caixa seria lida como veredito sobre a view inteira — e ela é
              justamente a que fica verde com a view velha. */}
          {podeDizerQueEstaCerto(d) &&
            (provado.fontes + provado.campos === 0 ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                <strong>Nada pôde ser conferido.</strong> As doze tabelas estão vazias, e tabela
                vazia não prova nada sobre a view — isto não é um “está tudo certo”. Volte aqui
                quando houver registro de paciente.
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
                <strong>
                  {provado.fontes} de {d.fontes.length} fontes e {provado.campos} de{" "}
                  {d.campos.length} campos conferidos
                </strong>{" "}
                — nada do que deu para conferir ficou de fora da view.{" "}
                {provado.fontes + provado.campos < d.fontes.length + d.campos.length && (
                  <>
                    O resto está sem dado que prove alguma coisa e{" "}
                    <strong>não pôde ser conferido</strong>.
                  </>
                )}
              </div>
            ))}

          <Panel
            title="As doze fontes da fila clínica"
            subtitle="Cada uma alimenta o que o médico vê em “o que pede olhar”."
          >
            <div className="space-y-2">
              {d.fontes.map((f) => (
                <div key={f.tabela} className={`rounded-lg border p-3 text-sm ${CORES[f.estado]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{f.nome}</span>
                    <span className="font-mono text-xs opacity-80">{RECADO[f.estado]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {f.peso} ·{" "}
                    {f.linhasNaTabela === null
                      ? "—"
                      : `${f.linhasNaTabela.toLocaleString("pt-BR")} na tabela`}
                    {f.linhasNaView !== null &&
                      ` · ${f.linhasNaView.toLocaleString("pt-BR")} na view`}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Os campos que a view precisa projetar"
            subtitle="Fonte presente não quer dizer campo presente — e é o campo que a régua clínica lê."
          >
            <div className="space-y-2">
              {d.campos.map((c) => (
                <div
                  key={`${c.fonte}.${c.campo}`}
                  className={`rounded-lg border p-3 text-sm ${CORES_CAMPO[c.estado]}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{c.nome}</span>
                    <span className="font-mono text-xs opacity-80">{RECADO_CAMPO[c.estado]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <code>
                      {c.fonte} → dados.{c.campo}
                    </code>{" "}
                    · {c.peso}
                  </p>
                  {/* ⚠️ Sem a coluna de origem não HÁ contagem — e um "—"
                      solto numa linha é ruído com cara de medida. */}
                  {c.linhasQuePodem !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.linhasQuePodem.toLocaleString("pt-BR")} podem produzir
                      {c.linhasComOCampo !== null &&
                        ` · ${c.linhasComOCampo.toLocaleString("pt-BR")} na view com o campo`}
                    </p>
                  )}
                  {/* ⚠️ Só aqui o SQL da COLUNA é nomeado — mandar rodá-lo por
                      causa de uma view velha faria o dono rodar o arquivo
                      errado e concluir que a tela mente. */}
                  {c.estado === "coluna_ausente" && c.sqlDaColuna && (
                    <p className="mt-2 text-xs font-medium">
                      Conserto: rodar{" "}
                      <code className="rounded bg-muted px-1">supabase/{c.sqlDaColuna}</code>.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
