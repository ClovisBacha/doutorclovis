import { useEffect, useState } from "react";
import { toast } from "sonner";
import { deCampoLocal } from "@/lib/agenda-unificada";
import { NOMES_DOS_DIAS } from "@/lib/disponibilidade";
import {
  abrirFaixa,
  bloquearPeriodo,
  desbloquearPeriodo,
  fecharFaixa,
  minhaGrade,
  type BloqueioDoMedico,
  type GradeDoMedico,
} from "@/lib/disponibilidade.functions";

/**
 * OS HORÁRIOS QUE ELE ABRE — e os que ele fecha.
 *
 * ─── O QUE ISTO MUDA PARA A PACIENTE ────────────────────────────────────────
 *
 * Sem grade, ela pede um horário no escuro ("terça de manhã?") e ele confirma,
 * recusa ou sugere outro: duas mensagens e uma espera para marcar uma consulta,
 * com ele recebendo pedidos para dias em que nem atende. Com a grade, o app
 * mostra a ela só o que existe de verdade.
 *
 * ─── AS DUAS COISAS QUE A TELA PRECISA DIZER ────────────────────────────────
 *
 * **Grade vazia não é erro, é um estado.** Um médico que ainda não montou nada
 * precisa ver o convite para montar, e não uma tela em branco que parece
 * quebrada.
 *
 * **Falta de tabela tem recado próprio.** "Não consegui carregar" mandaria ele
 * tentar de novo para sempre; o que resolve é rodar um SQL.
 */
export function GradeDeHorarios({ tokenFn }: { tokenFn: () => Promise<string> }) {
  const [grade, setGrade] = useState<GradeDoMedico[] | null>(null);
  const [bloqueios, setBloqueios] = useState<BloqueioDoMedico[]>([]);
  const [semTabela, setSemTabela] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Nova faixa
  const [dia, setDia] = useState(1);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("12:00");
  const [minutos, setMinutos] = useState(30);
  const [tipo, setTipo] = useState<"presencial" | "teleconsulta" | "ambos">("ambos");

  // Novo bloqueio
  const [bloqDe, setBloqDe] = useState("");
  const [bloqAte, setBloqAte] = useState("");
  const [bloqMotivo, setBloqMotivo] = useState("");

  async function carregar() {
    try {
      const r = await minhaGrade({ data: { accessToken: await tokenFn() } });
      if (r.ok) {
        setGrade(r.grade);
        setBloqueios(r.bloqueios);
        setSemTabela(false);
      } else if (r.motivo === "sem_tabela") {
        setSemTabela(true);
        setGrade([]);
      } else {
        /* NÃO zera a grade: apagar da tela o que já estava lá por causa de uma
           leitura que falhou faria o médico achar que perdeu a configuração. */
        setGrade((g) => g ?? []);
      }
    } catch {
      setGrade((g) => g ?? []);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function adicionar() {
    if (fim <= inicio) {
      toast.error("O fim tem que ser depois do início.");
      return;
    }
    setSalvando(true);
    try {
      const r = await abrirFaixa({
        data: { accessToken: await tokenFn(), weekday: dia, inicio, fim, minutos, tipo },
      });
      if (!r.ok) {
        toast.error(
          r.motivo === "sem_tabela"
            ? "Rode o APLICAR_DISPONIBILIDADE.sql no Supabase para usar a grade."
            : "Não consegui salvar a faixa.",
        );
        return;
      }
      toast.success("Faixa aberta ✓");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  async function bloquear() {
    const de = deCampoLocal(bloqDe);
    const ate = deCampoLocal(bloqAte);
    if (!de || !ate) {
      toast.error("Preencha o começo e o fim do bloqueio.");
      return;
    }
    if (ate <= de) {
      toast.error("O fim tem que ser depois do começo.");
      return;
    }
    setSalvando(true);
    try {
      const r = await bloquearPeriodo({
        data: { accessToken: await tokenFn(), inicio: de, fim: ate, motivo: bloqMotivo.trim() },
      });
      if (!r.ok) {
        toast.error(
          r.motivo === "sem_tabela"
            ? "Rode o APLICAR_DISPONIBILIDADE.sql no Supabase para usar os bloqueios."
            : "Não consegui bloquear.",
        );
        return;
      }
      toast.success("Período bloqueado ✓");
      setBloqDe("");
      setBloqAte("");
      setBloqMotivo("");
      await carregar();
    } finally {
      setSalvando(false);
    }
  }

  if (grade === null) return <div className="skeleton h-48 rounded-3xl" />;

  const porDia = NOMES_DOS_DIAS.map((nome, i) => ({
    nome,
    i,
    faixas: grade.filter((f) => f.weekday === i),
  }));

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <h3 className="font-serif text-xl">Horários que você atende</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        O que você abrir aqui é o que a paciente vê no app na hora de marcar. Fora dessas faixas ela
        não consegue pedir horário.
      </p>

      {semTabela && (
        <p className="mt-3 rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-[12px] leading-snug text-amber-900">
          As tabelas da grade ainda não existem no banco. Rode{" "}
          <code>supabase/APLICAR_DISPONIBILIDADE.sql</code> no SQL Editor do Supabase — é
          idempotente, pode rodar mais de uma vez.
        </p>
      )}

      {/* ── A grade ── */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {porDia.map(({ nome, i, faixas }) => (
          <div key={i} className="rounded-2xl border border-border bg-background p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {nome}
            </p>
            {faixas.length === 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">Não atende</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {faixas.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-[13px]">
                    <span className="font-medium tabular-nums">
                      {f.start_time.slice(0, 5)}–{f.end_time.slice(0, 5)}
                    </span>
                    <span className="text-muted-foreground">
                      {f.slot_minutes}min ·{" "}
                      {f.kind === "ambos"
                        ? "presencial e vídeo"
                        : f.kind === "presencial"
                          ? "presencial"
                          : "vídeo"}
                    </span>
                    <button
                      onClick={async () => {
                        const r = await fecharFaixa({
                          data: { accessToken: await tokenFn(), id: f.id },
                        });
                        if (r.ok) {
                          toast.success("Faixa removida.");
                          carregar();
                        } else toast.error("Não consegui remover.");
                      }}
                      aria-label={`Remover faixa de ${nome} às ${f.start_time.slice(0, 5)}`}
                      className="ml-auto text-xs text-muted-foreground hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* ── Abrir faixa ── */}
      <div className="mt-4 rounded-2xl border border-dashed border-border p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Abrir uma faixa
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Dia</span>
            <select
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            >
              {NOMES_DOS_DIAS.map((n, i) => (
                <option key={i} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Das</span>
            <input
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Até</span>
            <input
              type="time"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Cada</span>
            <select
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            >
              {[15, 20, 30, 40, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="ambos">Presencial e vídeo</option>
              <option value="presencial">Só presencial</option>
              <option value="teleconsulta">Só vídeo</option>
            </select>
          </label>
          <button
            onClick={adicionar}
            disabled={salvando}
            className="press rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Abrir
          </button>
        </div>
      </div>

      {/* ── Bloqueios ── */}
      <div className="mt-5 border-t border-border pt-4">
        <h4 className="font-serif text-lg">Períodos bloqueados</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Férias, congresso, uma tarde. Some da agenda dela mesmo dentro da faixa aberta.
        </p>

        {bloqueios.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted-foreground">Nenhum bloqueio à frente.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {bloqueios.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-[13px]"
              >
                <span className="font-medium">
                  {new Date(b.starts_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" → "}
                  {new Date(b.ends_at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {b.reason && <span className="text-muted-foreground">{b.reason}</span>}
                <button
                  onClick={async () => {
                    const r = await desbloquearPeriodo({
                      data: { accessToken: await tokenFn(), id: b.id },
                    });
                    if (r.ok) {
                      toast.success("Bloqueio removido.");
                      carregar();
                    } else toast.error("Não consegui remover.");
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-rose-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="text-[10px] text-muted-foreground">De</span>
            <input
              type="datetime-local"
              value={bloqDe}
              onChange={(e) => setBloqDe(e.target.value)}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-muted-foreground">Até</span>
            <input
              type="datetime-local"
              value={bloqAte}
              onChange={(e) => setBloqAte(e.target.value)}
              className="mt-0.5 block rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block min-w-[10rem] flex-1">
            <span className="text-[10px] text-muted-foreground">Motivo (opcional)</span>
            <input
              value={bloqMotivo}
              onChange={(e) => setBloqMotivo(e.target.value)}
              placeholder="Congresso, férias…"
              className="mt-0.5 block w-full rounded-xl border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={bloquear}
            disabled={salvando}
            className="press rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Bloquear
          </button>
        </div>
      </div>
    </div>
  );
}
