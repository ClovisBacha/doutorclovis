/**
 * O CHÁ DE BEBÊ — a tela da PACIENTE.
 *
 * Três coisas, nessa ordem: o link para mandar, o que já chegou, e a quem
 * agradecer. A lista se monta sozinha com os cinco cartões de fralda; o resto
 * ela acrescenta se quiser.
 *
 * ⚠️ **Modo Cuidado não desenha nada disto**, e o portão está em
 * `portasDaComunidade` (a porta some) E aqui (a tela recusa). Dois portões
 * porque o objeto vive FORA do aparelho dela: o link já está na mão de trinta
 * pessoas, e quem o fecha de verdade é o servidor (`listaViva`).
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  agrupaPorPessoa,
  linkDeWhatsApp,
  quemFaltaAgradecer,
  textoDeAgradecimento,
} from "@/lib/agradecimento";
import { legendaDaCota, estadoDaCota } from "@/lib/cotas";
import {
  legendaDoTamanho,
  ordemDeUrgencia,
  saldoDeFraldas,
  type TamanhoFralda,
} from "@/lib/fraldas";
import { progressoDaLista, textoDoConvite } from "@/lib/presentes";
import type { ListaDaDona } from "@/lib/presentes.functions";

export type BancadaDoCha = { lista: ListaDaDona; guardados: number };

export function ChaDeBebe({
  careMode = false,
  bancada,
}: {
  careMode?: boolean;
  bancada?: BancadaDoCha;
}) {
  const [dados, setDados] = useState<BancadaDoCha | null>(bancada ?? null);
  const [carregando, setCarregando] = useState(!bancada);
  const [novoTitulo, setNovoTitulo] = useState("");
  /** O item cuja saída está sendo confirmada. `null` = nenhum. */
  const [confirmando, setConfirmando] = useState<string | null>(null);

  useEffect(() => {
    if (bancada || careMode) {
      setCarregando(false);
      return;
    }
    let vivo = true;
    (async () => {
      try {
        const s = await supabase.auth.getSession();
        const token = s.data.session?.access_token;
        if (!token) return;
        const { minhaLista } = await import("@/lib/presentes.functions");
        const r = await minhaLista({ data: { accessToken: token } });
        if (!vivo) return;
        if (r.ok) setDados({ lista: r.lista, guardados: r.guardados });
      } catch {
        /* Sem lista a tela mostra o vazio, não um erro: ela não pediu isto
           agora, veio ver o que já tem. */
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [careMode, bancada]);

  const lista = dados?.lista ?? null;

  const url = useMemo(() => {
    if (!lista) return "";
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/presente/${lista.token}`;
  }, [lista]);

  const fraldas = useMemo(
    () => (lista?.itens ?? []).filter((i) => i.tipo === "fralda" && i.tamanho),
    [lista],
  );

  const saldos = useMemo(() => {
    const meta = {} as Record<TamanhoFralda, number>;
    const reservado = {} as Record<TamanhoFralda, number>;
    for (const f of fraldas) {
      meta[f.tamanho as TamanhoFralda] = f.meta;
      reservado[f.tamanho as TamanhoFralda] = f.reservado;
    }
    return saldoDeFraldas(meta, reservado);
  }, [fraldas]);

  const pessoas = useMemo(() => {
    if (!lista) return [];
    const titulo = (id: string) =>
      lista.itens.find((i) => i.id === id)?.titulo?.toLowerCase() ?? "o presente";
    return agrupaPorPessoa(lista.reservas, titulo);
  }, [lista]);

  const faltam = useMemo(() => quemFaltaAgradecer(pessoas), [pessoas]);
  const progresso = useMemo(() => progressoDaLista(lista?.itens ?? []), [lista]);

  if (careMode) return null;

  if (carregando) {
    return (
      <div className="space-y-3">
        <div className="skeleton h-24 rounded-3xl" />
        <div className="skeleton h-40 rounded-3xl" />
      </div>
    );
  }

  if (!lista) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Não deu para abrir a lista agora. Tente de novo daqui a pouco.
      </p>
    );
  }

  async function copiar() {
    const texto = textoDoConvite({ bebeNome: lista!.bebeNome, url });
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Convite copiado 💛");
    } catch {
      toast.error("Não deu para copiar. Segure no link para selecionar.");
    }
  }

  async function agradecer(reservaIds: string[], texto: string) {
    window.open(linkDeWhatsApp(texto), "_blank");
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { marcarAgradecida } = await import("@/lib/presentes.functions");
      await marcarAgradecida({ data: { accessToken: token, reservaIds } });
      setDados((d) =>
        d
          ? {
              ...d,
              lista: {
                ...d.lista,
                reservas: d.lista.reservas.map((r) =>
                  reservaIds.includes(r.id) ? { ...r, agradecidaEm: new Date().toISOString() } : r,
                ),
              },
            }
          : d,
      );
    } catch {
      /* O WhatsApp já abriu — falhar em marcar só faz ela aparecer na fila de
         novo, que é o lado seguro de errar. */
    }
  }

  /**
   * TIRAR um item da lista.
   *
   * ⚠️ **`arquivarItem` estava escrita, testada e SEM CHAMADOR desde o
   * primeiro dia.** Ela podia pôr item e nunca tirar: um "Berço" digitado
   * errado ficava para sempre no link que trinta pessoas receberam. É a mesma
   * família de defeito de `proximoDesbloqueio` e das três conquistas da Escola
   * do Bebê — servidor pronto, porta inexistente.
   *
   * ⚠️ **E o servidor RECUSA arquivar item já reservado** — quem prometeu
   * merece saber antes. A tela diz isso com a palavra certa em vez de "não
   * deu": um erro genérico aqui faria ela tentar de novo para sempre.
   */
  async function tirar(itemId: string) {
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { arquivarItem, minhaLista } = await import("@/lib/presentes.functions");
      const r = await arquivarItem({ data: { accessToken: token, itemId } });
      if (!r.ok) {
        toast.error(
          "motivo" in r && r.motivo === "tem-reserva"
            ? "Alguém já reservou esse item — fale com ela antes de tirar 💛"
            : "Não deu para tirar o item.",
        );
        return;
      }
      const novo = await minhaLista({ data: { accessToken: token } });
      if (novo.ok) setDados({ lista: novo.lista, guardados: novo.guardados });
      setConfirmando(null);
    } catch {
      toast.error("Não deu para tirar o item.");
    }
  }

  async function acrescentar() {
    const t = novoTitulo.trim();
    if (!t) return;
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarItens, minhaLista } = await import("@/lib/presentes.functions");
      const r = await salvarItens({
        data: {
          accessToken: token,
          itens: [
            {
              id: null,
              tipo: "item",
              titulo: t,
              nota: null,
              ordem: 100 + lista!.itens.length,
              tamanho: null,
              meta: 1,
              teto: null,
              centavosTotal: null,
            },
          ],
        },
      });
      if (!r.ok) {
        toast.error("Não deu para guardar o item.");
        return;
      }
      setNovoTitulo("");
      const novo = await minhaLista({ data: { accessToken: token } });
      if (novo.ok) setDados({ lista: novo.lista, guardados: novo.guardados });
      toast.success("Item na lista 💛");
    } catch {
      toast.error("Não deu para guardar o item.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">🎁 Chá de bebê</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Monte a lista, mande o link. Quem quiser dar escolhe o que ainda cabe.
        </p>
      </header>

      {/* ─── O LINK ────────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Seu link
        </p>
        <p className="mt-1 break-all text-sm text-foreground">{url}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copiar}
            className="press flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Copiar convite
          </button>
          <a
            href={linkDeWhatsApp(textoDoConvite({ bebeNome: lista.bebeNome, url }))}
            target="_blank"
            rel="noreferrer"
            className="press flex-1 rounded-xl border border-border px-3 py-2 text-center text-sm font-medium"
          >
            Mandar no WhatsApp
          </a>
        </div>
      </section>

      {/* ─── O QUE JÁ CHEGOU ───────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <h3 className="font-semibold">Fraldas</h3>
        <ul className="mt-2 space-y-1.5">
          {ordemDeUrgencia(saldos).map((t) => {
            const s = saldos.find((x) => x.tamanho === t)!;
            return (
              <li key={t} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 font-semibold">{t}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, s.fracao * 100)}%` }}
                  />
                </div>
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {legendaDoTamanho(s)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ─── OS OUTROS ITENS ───────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold">Na lista</h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {progresso.fechados} de {progresso.itens}
          </span>
        </div>
        <ul className="mt-2 space-y-1.5">
          {lista.itens
            .filter((i) => i.tipo !== "fralda")
            .map((i) => {
              const e = i.tipo === "cota" ? estadoDaCota(i.meta, i.reservado) : null;
              return (
                <li key={i.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 flex-1">{i.titulo}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {e ? legendaDaCota(e) : i.reservado > 0 ? "reservado 💛" : "—"}
                    </span>
                    {/* ⚠️ Alvo de 44px e ✕ desenhado em texto: é o único
                        controle destrutivo desta tela, e mirar num × de 16px
                        ao lado do nome do item é pedir para errar. */}
                    <button
                      type="button"
                      onClick={() => setConfirmando(confirmando === i.id ? null : i.id)}
                      aria-label={`Tirar ${i.titulo} da lista`}
                      className="press -my-2 shrink-0 px-2 py-2 text-base leading-none text-muted-foreground"
                    >
                      ✕
                    </button>
                  </div>
                  {/* ⚠️ MENSAGEM SEPARADA, e não o mesmo botão virando "tem
                      certeza?" — a mesma decisão do cancelar consulta, e pelo
                      mesmo motivo: o segundo toque no lugar do primeiro
                      confirma o que ela ainda estava lendo. */}
                  {confirmando === i.id && (
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2">
                      <span className="min-w-0 flex-1 text-xs">Tirar da lista?</span>
                      <button
                        type="button"
                        onClick={() => void tirar(i.id)}
                        className="press shrink-0 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
                      >
                        Tirar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="press shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs"
                      >
                        Não
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        <div className="mt-3 flex gap-2">
          <input
            value={novoTitulo}
            onChange={(e) => setNovoTitulo(e.target.value.slice(0, 120))}
            placeholder="Acrescentar um item"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={acrescentar}
            className="press shrink-0 rounded-xl border border-primary/40 px-3 py-2 text-sm font-medium text-primary"
          >
            Pôr na lista
          </button>
        </div>
      </section>

      {/* ─── O QUE ESTÁ GUARDADO ───────────────────────────────────────── */}
      {dados!.guardados > 0 && (
        <section className="rounded-2xl bg-muted/50 p-4 text-center">
          <p className="text-sm">
            🎁 {dados!.guardados}{" "}
            {dados!.guardados === 1 ? "presente guardado" : "presentes guardados"} para depois
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Alguém marcou para aparecer num dia especial. Você vai saber quando chegar.
          </p>
        </section>
      )}

      {/* ─── A QUEM AGRADECER ──────────────────────────────────────────── */}
      {pessoas.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="font-semibold">Agradecer</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            O texto já vem pronto — dá pra mudar antes de mandar.
          </p>
          <ul className="mt-3 space-y-2">
            {[...faltam, ...pessoas.filter((p) => p.agradecida)].map((p) => {
              const texto = textoDeAgradecimento(p, { bebeNome: lista.bebeNome });
              return (
                <li
                  key={p.reservaIds.join(",")}
                  className={`rounded-2xl bg-muted/50 p-3 ${p.agradecida ? "opacity-60" : ""}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{p.nome}</span>
                    {p.temAudio && <span className="shrink-0 text-xs">🎤 recado</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.itens.join(" · ")}</p>
                  {p.agradecida ? (
                    <p className="mt-1.5 text-xs">agradecida 💛</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => agradecer(p.reservaIds, texto)}
                      className="press mt-2 w-full rounded-xl border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      Agradecer no WhatsApp
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
