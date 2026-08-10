import { useMemo, useState } from "react";
import {
  CORES_DO_TIPO,
  celasDoMes,
  diaLocal,
  faixaHoraria,
  porDia,
  resumoDoDia,
  type EventoDaAgenda,
  type NovaConsulta,
  type TipoDeEvento,
} from "@/lib/agenda-unificada";
import { DiaDaAgenda, type ContatoDaPaciente, type PacienteDoSelect } from "./dia-da-agenda";

/**
 * O CALENDÁRIO DO MÊS — um só, com tudo dentro.
 *
 * ─── O QUE ELE SUBSTITUI ────────────────────────────────────────────────────
 *
 * A agenda estava repartida em quatro telas que não sabiam uma da outra:
 * Agendamentos, Calendário (uma faixa de SETE dias), Teleconsultas e Consultas
 * Pagas. O médico via a consulta presencial numa aba e a teleconsulta do mesmo
 * dia noutra — e nenhuma respondia "como está o meu mês".
 *
 * ─── AS DUAS DECISÕES DE DESENHO ────────────────────────────────────────────
 *
 * **A legenda é por TIPO, e o tipo é o que muda o dia dele.** Azul é ir ao
 * consultório, laranja é abrir o vídeo, roxo é a consulta particular. Não
 * inventei cor por status: status muda o tempo todo e ninguém decora seis
 * cores. Status vira texto quando ele abre o dia.
 *
 * **O que não tem hora marcada é mostrado como não tendo.** Pedido ainda não
 * confirmado e consulta particular (que o banco guarda sem data combinada)
 * aparecem tracejados. Pintá-los como compromisso faria o médico contar com uma
 * hora que ninguém combinou — e some se ele não os visse, porque a particular é
 * justamente aquela pela qual ele já recebeu.
 */
export function CalendarioDoMes({
  eventos,
  pacientes = [],
  aoMarcar,
  aoEnviarLink,
  aoBuscarContato,
  className = "",
}: {
  eventos: EventoDaAgenda[];
  /** Para o atalho "é paciente do app" dentro do dia. */
  pacientes?: PacienteDoSelect[];
  /** Quando existe, clicar num dia abre a tela grande com o formulário. */
  aoMarcar?: (v: NovaConsulta) => Promise<{ ok: boolean; erro?: string; avisou?: boolean }>;
  aoEnviarLink?: (evento: EventoDaAgenda) => Promise<{ ok: boolean; erro?: string }>;
  /** Busca e-mail e telefone do cadastro da paciente escolhida no formulário. */
  aoBuscarContato?: (pacienteId: string) => Promise<ContatoDaPaciente>;
  className?: string;
}) {
  const hoje = new Date();
  const [mes, setMes] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  const [diaAberto, setDiaAberto] = useState<string | null>(() => diaLocal(hoje));
  /* O dia em TELA GRANDE. Separado de `diaAberto` de propósito: a faixa de
     leitura embaixo da grade continua acompanhando o dia selecionado, e o modal
     só abre quando ele clica de verdade. Fundidos, o calendário abriria um
     modal sozinho ao carregar, em cima do dia de hoje. */
  const [diaEmTela, setDiaEmTela] = useState<string | null>(null);

  const celas = useMemo(() => celasDoMes(mes.getFullYear(), mes.getMonth()), [mes]);
  const mapa = useMemo(() => porDia(eventos), [eventos]);
  const doDia = diaAberto ? (mapa.get(diaAberto) ?? []) : [];

  function andar(n: number) {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));
  }

  const tiposPresentes = useMemo(() => {
    const s = new Set<TipoDeEvento>();
    for (const e of eventos) s.add(e.tipo);
    return s;
  }, [eventos]);

  return (
    <div className={`rounded-3xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      {/* ── Cabeçalho ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-serif text-lg capitalize">
          {mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => andar(-1)}
            aria-label="Mês anterior"
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/50"
          >
            ←
          </button>
          <button
            onClick={() => {
              setMes(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
              setDiaAberto(diaLocal(new Date()));
            }}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/50"
          >
            Hoje
          </button>
          <button
            onClick={() => andar(1)}
            aria-label="Próximo mês"
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary/50"
          >
            →
          </button>
        </div>
      </div>

      {/* ── Legenda ──
          Só os tipos que EXISTEM no mês. Uma legenda com três cores das quais
          duas nunca aparecem ensina o médico a ignorar a legenda. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {(Object.keys(CORES_DO_TIPO) as TipoDeEvento[])
          .filter((t) => tiposPresentes.has(t))
          .map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${CORES_DO_TIPO[t].ponto}`} aria-hidden />
              {CORES_DO_TIPO[t].rotulo}
            </span>
          ))}
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full border border-dashed border-muted-foreground"
            aria-hidden
          />
          Sem hora combinada
        </span>
      </div>

      {/* ── A grade ── */}
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {celas.map(({ data, doMes }) => {
          const chave = diaLocal(data);
          const eventosDoDia = mapa.get(chave) ?? [];
          const ehHoje = chave === diaLocal(hoje);
          const aberto = chave === diaAberto;
          return (
            <button
              key={chave}
              onClick={() => {
                setDiaAberto(chave);
                /* Um clique, duas coisas: seleciona (a faixa de baixo segue) e
                   abre a tela do dia. Sem `aoMarcar` não há o que abrir — o
                   calendário continua servindo como só-leitura. */
                if (aoMarcar) setDiaEmTela(chave);
              }}
              aria-label={`${data.getDate()} — ${eventosDoDia.length} compromisso(s)`}
              aria-pressed={aberto}
              className={`flex min-h-[62px] flex-col items-center gap-1 rounded-xl border p-1.5 text-sm transition-colors ${
                aberto
                  ? "border-primary bg-primary/10"
                  : ehHoje
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:border-border"
              } ${doMes ? "" : "opacity-35"}`}
            >
              <span className={ehHoje ? "font-bold text-primary" : ""}>{data.getDate()}</span>
              {/* Até três pontinhos e depois um "+N": seis bolinhas numa célula
                  de 60px viram sujeira e param de informar. */}
              <span className="flex flex-wrap items-center justify-center gap-0.5">
                {eventosDoDia.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={`h-1.5 w-1.5 rounded-full ${
                      e.firme
                        ? CORES_DO_TIPO[e.tipo].ponto
                        : `border border-dashed ${CORES_DO_TIPO[e.tipo].ponto.replace("bg-", "border-")}`
                    }`}
                  />
                ))}
                {eventosDoDia.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">
                    +{eventosDoDia.length - 3}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── O dia aberto ── */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {diaAberto
              ? new Date(`${diaAberto}T12:00:00`).toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })
              : "Escolha um dia"}
          </p>
          {/* Como o dia está, em uma frase. Conta só COMPROMISSO — somar as
              preferências daria "4 consultas" num dia com uma marcada e três
              "quem sabe", e é justamente para saber se o dia está cheio que
              esta linha existe. */}
          {diaAberto && <p className="text-[11px] text-muted-foreground">{resumoDoDia(doDia)}</p>}
        </div>
        {doDia.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nada marcado neste dia.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {doDia.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${CORES_DO_TIPO[e.tipo].ponto}`} />
                <span className="font-medium tabular-nums">
                  {faixaHoraria(e) ?? (e.firme ? "—" : "a combinar")}
                </span>
                <span className="font-medium">{e.titulo}</span>
                <span className="text-xs text-muted-foreground">{e.situacao}</span>
                {/* O pagamento, que é o que ele quer ver ao abrir a consulta.
                    `null` NÃO vira "não pago": não há o que pagar, e um selo
                    vermelho ali seria cobrança inventada. */}
                {e.pago !== null && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      e.pago ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {e.pago ? "Pago" : "A pagar"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ─── O DIA EM TELA GRANDE ────────────────────────────────────────
          Onde ele lê o dia inteiro e MARCA. A faixa acima continua existindo
          como resumo de leitura rápida: fechada a tela, ele ainda vê o que
          escolheu sem precisar abrir de novo. */}
      {diaEmTela && aoMarcar && (
        <DiaDaAgenda
          dia={diaEmTela}
          eventos={mapa.get(diaEmTela) ?? []}
          pacientes={pacientes}
          aoMarcar={aoMarcar}
          aoEnviarLink={aoEnviarLink}
          aoBuscarContato={aoBuscarContato}
          onFechar={() => setDiaEmTela(null)}
        />
      )}
    </div>
  );
}
