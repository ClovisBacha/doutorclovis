/**
 * O QUE ELE JÁ EMITIU PARA ELA — a lista que o médico não tinha.
 *
 * ⚠️ **`emissoesDaPaciente` existia inteira e não tinha chamador nenhum.**
 * Escrita, recortada pelo vínculo ATUAL, devolvendo receita e pedido de exame
 * com data, texto e o "ela marcou como feito" — e o médico não tinha onde ver.
 * Ele emitia, o documento chegava na aba dela, e do lado dele o rastro sumia.
 *
 * ⚠️ **O custo é clínico:** ele abre a ficha na consulta seguinte para decidir o
 * que pedir, sem enxergar o que ELE MESMO pediu no mês passado. Exame repetido
 * é dinheiro e agulha à toa; receita repetida é dose dobrada quando ela já está
 * tomando.
 *
 * ⚠️ **E ela mora onde a emissão NASCE** (`AcoesDaPaciente`), e não numa aba
 * própria: é a mesma decisão que tirou o receituário de aba própria e o pôs
 * dentro do cartão da paciente já escolhida. O histórico ao lado do botão é o
 * que impede a segunda emissão.
 */
import { useEffect, useState } from "react";

import type { Emissao } from "@/lib/clinical.functions";

type Estado = "carregando" | "pronto" | "falhou";

const ROTULO: Record<string, string> = { exame: "🔬 Exame", prescricao: "💊 Receita" };

function dia(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function EmissoesDaPaciente({
  pacienteId,
  tokenFn,
  recarregar,
  bancada,
}: {
  pacienteId: string;
  tokenFn: () => Promise<string>;
  /** Muda quando uma emissão nova é enviada — a lista relê. */
  recarregar?: number;
  bancada?: { emissoes: Emissao[]; estado: Estado; degradado?: boolean };
}) {
  const ehBancada = !!bancada;
  const [lista, setLista] = useState<Emissao[]>(bancada?.emissoes ?? []);
  const [estado, setEstado] = useState<Estado>(bancada?.estado ?? "carregando");
  const [degradado, setDegradado] = useState(bancada?.degradado ?? false);
  const [aberto, setAberto] = useState<string | null>(null);

  async function carregar() {
    setEstado("carregando");
    try {
      const accessToken = await tokenFn();
      if (!accessToken) {
        setEstado("falhou");
        return;
      }
      const { emissoesDaPaciente } = await import("@/lib/clinical.functions");
      const r = await emissoesDaPaciente({ data: { accessToken, pacienteId } });
      /* `ok: false` aqui quer dizer "não é sua paciente" ou sessão inválida —
         o bloco inteiro se esconde, porque não há o que mostrar. */
      if (!r.ok) {
        setEstado("falhou");
        return;
      }
      setLista(r.emissoes);
      /* ⚠️ E `degradado` é OUTRA coisa: a leitura falhou, e uma lista vazia
         aqui afirmaria que ele nunca emitiu nada. Num cartão clínico essa
         afirmação vale uma receita repetida. */
      setDegradado(!!r.degradado);
      setEstado("pronto");
    } catch {
      setEstado("falhou");
    }
  }

  useEffect(() => {
    if (ehBancada) return;
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId, recarregar, ehBancada]);

  if (estado === "carregando") return <div className="skeleton mt-3 h-12 rounded-xl" />;

  /* Sessão inválida ou vínculo desfeito: nada a mostrar, e um erro aqui seria
     ruído sobre um bloco acessório. */
  if (estado === "falhou") return null;

  if (degradado) {
    return (
      <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-2.5 dark:bg-amber-500/10">
        <p className="text-[12px] leading-snug text-amber-900/90 dark:text-amber-100/90">
          ⚠️ Não consegui ler o que já foi emitido para ela —{" "}
          <strong>não conclua que não há nada</strong>. Confira antes de repetir um exame ou uma
          receita.
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="mt-2 min-h-[44px] rounded-full border border-amber-400 px-3 text-[13px] font-medium text-amber-900 dark:text-amber-100"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  /* ⚠️ Sem emissão a seção não existe: "nada emitido" é o estado normal de toda
     paciente nova, e uma linha dizendo isso em cada ficha é ruído. */
  if (lista.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Já enviado para ela
      </p>
      <div className="mt-1.5 space-y-1.5">
        {lista.slice(0, 8).map((e) => (
          <div key={e.id} className="rounded-xl border border-border bg-background">
            <button
              type="button"
              onClick={() => setAberto((a) => (a === e.id ? null : e.id))}
              className="flex min-h-[44px] w-full items-center gap-2 px-3 text-left"
            >
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                {dia(e.created_at)}
              </span>
              <span className="shrink-0 text-[11px]">{ROTULO[e.kind] ?? e.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{e.titulo}</span>
              {/* ⚠️ O "ela marcou como feito" é a informação que muda a conduta:
                  um pedido de exame de seis semanas atrás sem retorno é outra
                  conversa que um de ontem. */}
              {e.cumprido_em ? (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  feito
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  aguardando
                </span>
              )}
            </button>
            {aberto === e.id && (
              <div className="border-t border-border px-3 py-2">
                <pre className="whitespace-pre-wrap break-words font-sans text-[12px] leading-snug text-muted-foreground">
                  {e.conteudo}
                </pre>
                {e.nota && (
                  <p className="mt-1.5 text-[12px] italic text-muted-foreground/80">{e.nota}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {lista.length > 8 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Mostrando as 8 mais recentes de {lista.length}.
        </p>
      )}
    </div>
  );
}
