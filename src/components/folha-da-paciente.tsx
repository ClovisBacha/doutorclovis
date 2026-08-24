import { useState } from "react";
import { GraficoClinico, daSerie, seriesDePressao } from "./grafico-clinico";
import { sinalGlicemia, sinalPressao } from "@/lib/sinais-clinicos";
import {
  serieDe,
  type Consulta,
  type EventoClinico,
  type FichaClinica,
} from "@/lib/clinical.functions";

/**
 * A PACIENTE EM UMA FOLHA — para levar.
 *
 * ─── QUANDO ISTO É USADO ────────────────────────────────────────────────────
 *
 * Encaminhamento para a maternidade, segunda opinião, internação às três da
 * manhã. Nesses momentos o sistema não está com ele: está o papel, ou o PDF no
 * celular de outra pessoa. Hoje ele copiaria da tela, campo por campo.
 *
 * ─── O QUE ESTA FOLHA NÃO FAZ ───────────────────────────────────────────────
 *
 * **Não gera PDF por conta própria.** Usa a impressão do navegador, que já sabe
 * salvar em PDF em todo aparelho que interessa. Uma biblioteca de PDF seria
 * meio megabyte no bundle da paciente para resolver algo que o `Ctrl+P` resolve
 * — e um segundo lugar onde o layout diverge do que está na tela.
 *
 * **Não recalcula nada.** Todos os números vêm dos mesmos dados e das mesmas
 * réguas da tela. Uma folha que calcula por conta própria é a segunda fonte que
 * um dia diverge — e divergir num papel que foi para outro hospital é pior que
 * divergir na tela, porque ninguém volta para conferir.
 *
 * ─── O QUE ELA DIZ DE SI MESMA ──────────────────────────────────────────────
 *
 * O rodapé carimba data, hora e a origem dos números ("informados pela paciente
 * no app, não aferidos em consultório"). Sem isso, uma folha de três meses atrás
 * encontrada numa pasta é lida como se fosse de hoje, e medida caseira é lida
 * como aferição.
 */
export function FolhaDaPaciente({
  nome,
  ficha,
  eventos,
  consultas,
  semanas,
  dpp,
  medico,
  onFechar,
}: {
  nome: string;
  ficha: FichaClinica | null;
  eventos: EventoClinico[];
  consultas: Consulta[];
  semanas: number | null;
  dpp: string | null;
  medico: { nome?: string | null; crm?: string | null } | null;
  onFechar: () => void;
}) {
  const [emitidaEm] = useState(() => new Date());

  const pa = serieDe(eventos, "systolic", "Pressão (sistólica)", "mmHg");
  const peso = serieDe(eventos, "weight_kg", "Peso", "kg");
  const gli = serieDe(eventos, "glucose_mg_dl", "Glicemia", "mg/dL");

  const dataHora = emitidaEm.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50 p-0 print:static print:bg-transparent print:p-0">
      {/* ── Barra de ação: some na impressão ── */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 print:hidden">
        <p className="font-serif text-lg">Folha da paciente</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="press rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            🖨️ Imprimir / salvar em PDF
          </button>
          <button
            onClick={onFechar}
            className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* ── A folha ──
          `bg-white text-black` fixo, e não os tokens do tema: o modo escuro
          imprimiria uma página preta e gastaria o toner do consultório inteiro
          — e, em papel, o cinza-sobre-preto simplesmente não se lê. */}
      <div className="mx-auto max-w-[820px] bg-white p-8 text-black print:max-w-none print:p-0">
        <header className="border-b-2 border-black/80 pb-3">
          <h1 className="font-serif text-2xl">{nome}</h1>
          <p className="mt-1 text-sm">
            {semanas != null ? `${semanas} semanas de gestação` : "Idade gestacional não informada"}
            {dpp ? ` · DPP ${new Date(`${dpp}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
          </p>
          {medico?.nome && (
            <p className="mt-0.5 text-sm">
              Acompanhada por {medico.nome}
              {medico.crm ? ` · CRM ${medico.crm}` : ""}
            </p>
          )}
        </header>

        {/* ── O que muda conduta, primeiro ── */}
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]">O que muda conduta</h2>
          <ul className="mt-1.5 space-y-1 text-sm">
            {/* Alergia e medicação em uso vêm ANTES de qualquer número: são o
                que muda o que se pode prescrever na porta do pronto-socorro. */}
            <li>
              <strong>Alergias:</strong> {ficha?.alergias?.trim() || "nenhuma relatada"}
            </li>
            <li>
              <strong>Medicações em uso:</strong>{" "}
              {ficha?.medicamentos?.trim() || "nenhuma relatada"}
            </li>
            <li>
              {/* `riscos` é a lista que hoje só a IA lê — e é exatamente o que
                  a maternidade precisa saber antes de qualquer coisa. */}
              <strong>História de risco:</strong>{" "}
              {ficha?.riscos?.length ? ficha.riscos.join(", ") : "nada relatado"}
            </li>
            {ficha?.observacoesPrevias?.trim() && (
              <li>
                <strong>Observações:</strong> {ficha.observacoesPrevias.trim()}
              </li>
            )}
            {ficha?.contatoEmergencia?.trim() && (
              <li>
                {/* Quem chamar. Numa internação às três da manhã, é a linha
                    que mais rápido deixa de estar disponível. */}
                <strong>Contato de emergência:</strong> {ficha.contatoEmergencia.trim()}
                {ficha.telefoneEmergencia?.trim() ? ` · ${ficha.telefoneEmergencia.trim()}` : ""}
              </li>
            )}
            <li>
              <strong>Tipo sanguíneo:</strong> {ficha?.tipoSanguineo?.trim() || "não informado"}
            </li>
          </ul>
          {ficha?.degradada && (
            <p className="mt-2 border border-black/40 p-2 text-[12px]">
              ⚠️ O banco não tem as colunas do perfil completo. Alergias, medicações e história de
              risco estão <strong>desconhecidas</strong> aqui — não vazias.
            </p>
          )}
        </section>

        {/* ── As séries ── */}
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]">Como ela vem</h2>
          <div className="mt-2 grid grid-cols-1 gap-3">
            <GraficoClinico
              titulo="Pressão arterial"
              series={seriesDePressao(eventos, (s, d) => sinalPressao(s, d)?.gravidade ?? null)}
            />
            <GraficoClinico titulo="Peso" series={[daSerie(peso)]} />
            <GraficoClinico
              titulo="Glicemia"
              series={[
                daSerie(gli, (v) => sinalGlicemia(v)?.gravidade ?? null, { de: 70, ate: 99 }),
              ]}
            />
          </div>
          {pa.pontos.length === 0 && peso.pontos.length === 0 && gli.pontos.length === 0 && (
            <p className="mt-2 text-sm">Sem medidas registradas por ela no app.</p>
          )}
        </section>

        {/* ── Consultas ── */}
        <section className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em]">Últimas consultas</h2>
          {consultas.length === 0 ? (
            <p className="mt-1.5 text-sm">Nenhuma consulta registrada.</p>
          ) : (
            <ul className="mt-1.5 space-y-2 text-sm">
              {consultas.slice(0, 5).map((c) => (
                <li key={c.id} className="border-l-2 border-black/30 pl-3">
                  <p className="font-semibold">
                    {new Date(c.occurred_at).toLocaleDateString("pt-BR")} · {c.kind}
                    {c.systolic != null && c.diastolic != null
                      ? ` · PA ${c.systolic}/${c.diastolic}`
                      : ""}
                    {c.weight_kg != null ? ` · ${c.weight_kg} kg` : ""}
                    {c.fundal_height_cm != null ? ` · AU ${c.fundal_height_cm} cm` : ""}
                    {c.fetal_bpm != null ? ` · BCF ${c.fetal_bpm}` : ""}
                  </p>
                  {c.achados && <p className="whitespace-pre-wrap">{c.achados}</p>}
                  {c.conduta && (
                    <p className="whitespace-pre-wrap">
                      <strong>Conduta:</strong> {c.conduta}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── O carimbo ──
            Data, hora e origem dos números. Sem isto, uma folha de três meses
            atrás encontrada numa pasta é lida como se fosse de hoje, e medida
            caseira é lida como aferição de consultório. */}
        <footer className="mt-6 border-t border-black/50 pt-2 text-[11px] leading-snug">
          <p>
            Emitida em {dataHora} pelo app Obstétrica. Os valores dos gráficos foram{" "}
            <strong>informados pela paciente no aplicativo</strong> e não aferidos em consultório;
            os das consultas foram registrados pelo médico.
          </p>
          <p className="mt-0.5">
            Este documento resume registros e não substitui o prontuário nem constitui laudo.
          </p>
        </footer>
      </div>
    </div>
  );
}
