/**
 * Enviar uma receita, um pedido de exame ou uma orientação para UMA paciente.
 *
 * A aba Ferramentas tinha os modelos e fazia duas coisas: copiar e imprimir. A
 * receita existia só no papel que ela levava, e o sistema — que tem a caixa
 * onde o laudo volta — nunca soube que o exame tinha sido pedido. O ciclo tinha
 * começo e fim e faltava o meio.
 *
 * O texto vem editável de propósito: o modelo é um ponto de partida, não uma
 * prescrição pronta. Dose, via e duração mudam com a paciente, e um campo
 * bloqueado faria ele copiar para outro lugar, editar lá, e o registro voltaria
 * a não existir.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { emitirParaPaciente, type TipoDeEmissao } from "@/lib/clinical.functions";
import { listMyPatients, type LinkedPatient } from "@/lib/patientlink.functions";

const ROTULO: Record<TipoDeEmissao, string> = {
  prescricao: "Receita",
  exame: "Pedido de exame",
  orientacao: "Orientação",
};

export function EnviarParaPaciente({
  tipo,
  titulo,
  conteudoInicial,
  tokenFn,
  onFechar,
}: {
  tipo: TipoDeEmissao;
  titulo: string;
  conteudoInicial: string;
  tokenFn: () => Promise<string>;
  onFechar: () => void;
}) {
  const [pacientes, setPacientes] = useState<LinkedPatient[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState(conteudoInicial);
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await listMyPatients({ data: { accessToken: await tokenFn() } });
        if (r.ok) setPacientes(r.patients);
      } catch {
        /* lista vazia; o aviso abaixo cobre */
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Busca por nome. O painel não tem busca de paciente em lugar nenhum, e uma
     lista de cinquenta nomes num seletor é onde o médico escolhe a errada. */
  const filtradas = busca.trim()
    ? pacientes.filter((p) =>
        (p.display_name ?? "").toLowerCase().includes(busca.trim().toLowerCase()),
      )
    : pacientes;

  async function enviar() {
    if (!alvo) {
      toast.error("Escolha para qual paciente.");
      return;
    }
    if (conteudo.trim().length < 2) {
      toast.error("O conteúdo está vazio.");
      return;
    }
    setEnviando(true);
    try {
      const r = await emitirParaPaciente({
        data: {
          accessToken: await tokenFn(),
          pacienteId: alvo,
          tipo,
          titulo,
          conteudo: conteudo.trim(),
          nota: nota.trim() || undefined,
        },
      });
      if (!r.ok) throw new Error("recusado");
      toast.success(`${ROTULO[tipo]} enviada ✓`);
      onFechar();
    } catch {
      toast.error("Não consegui enviar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onFechar}
    >
      <div
        className="flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              {ROTULO[tipo]}
            </p>
            <p className="truncate font-serif text-lg">{titulo}</p>
          </div>
          <button onClick={onFechar} className="shrink-0 text-sm text-muted-foreground">
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Para quem
            </span>
            {carregando ? (
              <div className="skeleton mt-1 h-9 rounded-xl" />
            ) : pacientes.length === 0 ? (
              <p className="mt-1 rounded-xl border border-border bg-background p-3 text-[13px] text-muted-foreground">
                Você ainda não tem pacientes vinculadas.
              </p>
            ) : (
              <>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar pelo nome…"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                />
                <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-border">
                  {filtradas.length === 0 ? (
                    <p className="p-3 text-[13px] text-muted-foreground">
                      Nenhuma paciente com esse nome.
                    </p>
                  ) : (
                    filtradas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setAlvo(p.id)}
                        className={`block w-full px-3 py-2 text-left text-sm ${
                          alvo === p.id
                            ? "bg-primary/10 font-semibold text-primary"
                            : "hover:bg-secondary/60"
                        }`}
                      >
                        {p.display_name ?? "Paciente"}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </label>

          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Conteúdo — confira antes de enviar
            </span>
            <textarea
              rows={6}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-1.5 font-mono text-[13px] leading-snug outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
              O modelo é um ponto de partida. Dose, via e duração mudam com a paciente.
            </span>
          </label>

          <label className="mt-3 block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              Recado para ela (opcional)
            </span>
            <textarea
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex.: comece hoje e me avise se sentir enjoo."
              className="mt-1 w-full rounded-xl border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
        </div>

        <div className="shrink-0 border-t border-border px-5 py-3">
          <button
            onClick={enviar}
            disabled={enviando || !alvo}
            className="press w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {enviando ? "Enviando…" : `Enviar ${ROTULO[tipo].toLowerCase()}`}
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">
            Ela recebe no app e fica registrado no prontuário dela.
          </p>
        </div>
      </div>
    </div>
  );
}
