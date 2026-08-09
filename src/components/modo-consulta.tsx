import type { ReactNode } from "react";
import { essenciais, idadeGestacional, quantasDesconhecidas } from "@/lib/modo-consulta";
import { resumoParaAchados } from "@/lib/resumo-da-consulta";
import type { Consulta, EventoClinico, FichaClinica } from "@/lib/clinical.functions";

/**
 * MODO CONSULTA — a tela dos quinze minutos com ela na frente.
 *
 * ─── POR QUE ESTA TELA EXISTE ───────────────────────────────────────────────
 *
 * O cartão da paciente foi desenhado para ser LIDO: três abas, gráficos, linha
 * do tempo, conversa com a IA. Durante a consulta o médico está falando com uma
 * pessoa e olhando a tela de lado — e precisa de quatro coisas em letra grande:
 * em que semana ela está, o que ele não pode prescrever, o que mudou desde a
 * última vez, e onde registrar.
 *
 * O resto não é só desnecessário: é o que faz ele não abrir o sistema durante a
 * consulta e registrar tudo depois, de memória. É assim que o prontuário fica
 * pela metade.
 *
 * ─── AS DECISÕES ────────────────────────────────────────────────────────────
 *
 * **Alergia e medicação aparecem SEMPRE, mesmo vazias.** Um espaço em branco
 * onde deveria estar "alergias" é lido como "não tem alergia". A régua está em
 * `modo-consulta.ts`, testada, e ela distingue "nada relatado" de
 * "desconhecido — o banco não tem este campo": a diferença entre as duas é uma
 * prescrição.
 *
 * **A idade gestacional vem em DIAS.** 36s0d e 36s6d são condutas diferentes, e
 * é o número que ele olha primeiro.
 *
 * **Nada de gráfico, linha do tempo ou conversa da IA.** Eles respondem
 * perguntas que não são feitas com a paciente sentada na frente. Estão a um
 * toque, fechando esta tela.
 */
export function ModoConsulta({
  nome,
  ficha,
  eventos,
  consultas,
  formulario,
  onFechar,
}: {
  nome: string;
  ficha: FichaClinica | null;
  eventos: EventoClinico[];
  consultas: Consulta[];
  /** O `RegistrarConsulta`, montado por quem tem o token. */
  formulario: ReactNode;
  onFechar: () => void;
}) {
  const linhas = essenciais(ficha);
  const cegas = quantasDesconhecidas(linhas);
  const desdeAConsulta = consultas[0]?.occurred_at ?? null;
  const resumo = resumoParaAchados(eventos, desdeAConsulta);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-background">
      {/* ── Cabeçalho: quem, e em que semana ── */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b-2 border-primary/30 bg-card px-5 py-3">
        <div className="min-w-0">
          <p className="truncate font-serif text-2xl leading-tight">{nome}</p>
          <p className="text-sm text-muted-foreground">
            {consultas.length > 0
              ? `Última consulta em ${new Date(consultas[0].occurred_at).toLocaleDateString("pt-BR")}`
              : "Primeira consulta registrada aqui"}
          </p>
        </div>
        {/* O número que ele olha primeiro, no tamanho que se lê de lado. */}
        <p className="shrink-0 font-serif text-4xl tabular-nums text-primary">
          {idadeGestacional(ficha?.gestDias ?? null)}
        </p>
        <button
          onClick={onFechar}
          className="shrink-0 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground"
        >
          Sair do modo consulta
        </button>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 py-5">
        {/* ── O que impede uma receita ── */}
        <div className="rounded-3xl border-2 border-border bg-card p-5">
          <dl className="space-y-3">
            {linhas.map((l) => (
              <div key={l.rotulo} className="flex flex-wrap items-baseline gap-x-3">
                <dt className="w-24 shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {l.rotulo}
                </dt>
                {/* Texto grande: é lido de lado, a um metro da tela. E o
                    desconhecido tem COR e palavra própria — nunca só a
                    ausência de destaque, que se lê como normalidade. */}
                <dd
                  className={`min-w-0 flex-1 text-lg leading-snug ${
                    l.desconhecido ? "font-semibold text-amber-700 dark:text-amber-400" : ""
                  }`}
                >
                  {l.desconhecido && "⚠️ "}
                  {l.valor}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Um aviso só, no topo — quatro alertas iguais viram paisagem. */}
        {cegas > 0 && (
          <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[13px] leading-snug text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            O banco ainda não tem as colunas do perfil completo. Alergias, medicações e história de
            risco estão <strong>desconhecidas</strong> aqui — não vazias. Pergunte a ela antes de
            prescrever.
          </p>
        )}

        {/* ── O que mudou desde a última vez ── */}
        <div className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Desde a última consulta
          </h2>
          {resumo ? (
            /* O MESMO texto que entra no campo de achados. Duas versões do "o
               que mudou" — uma para ler e outra para gravar — divergiriam, e ele
               leria uma e assinaria a outra. */
            <pre className="mt-2 whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 font-sans text-[15px] leading-relaxed">
              {resumo}
            </pre>
          ) : (
            <p className="mt-2 rounded-2xl border border-border bg-card p-4 text-[15px] text-muted-foreground">
              Ela não registrou nada no app desde então.
            </p>
          )}
        </div>

        {/* ── Onde registrar ── */}
        <div className="mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            Registrar esta consulta
          </h2>
          <div className="mt-2">{formulario}</div>
        </div>
      </div>
    </div>
  );
}
