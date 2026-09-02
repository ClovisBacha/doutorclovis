/**
 * A LISTA DE PRESENTES — a tela da AMIGA.
 *
 * Ela chega por um link do WhatsApp, sem conta e sem login. É a tela mais
 * exposta do app: trinta pessoas que nunca entraram aqui, metade delas num
 * celular antigo, decidindo o que dar em dois minutos.
 *
 * ─── AS TRÊS COISAS QUE ELA FAZ DIFERENTE DE UM SITE DE CHÁ ────────────────
 *
 * 1. **As fraldas vêm por CARÊNCIA, não por tamanho.** `ordemDeUrgencia` põe M
 *    e G na frente, e RN cheio no fim. Se a lista abrisse em RN — que é o que
 *    todo site faz, porque é a ordem "natural" — a amiga tocaria no primeiro e
 *    o erro universal do chá de bebê se reproduziria com um contador bonito por
 *    cima.
 *
 * 2. **Diz quanto tempo cada tamanho dura.** "RN · 3 semanas" ao lado de "M · 4
 *    meses" é a informação que falta no mundo inteiro, e ela explica a ordem
 *    sem precisar de um parágrafo.
 *
 * 3. **Estado, nunca dívida.** "4 de 18 pacotes", jamais "faltam 14!". Lista de
 *    presente é a mecânica que mais fácil vira cobrança sobre a rede de uma
 *    gestante, e quem paga o constrangimento é ela.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { chamadaDaCota, estadoDaCota, legendaDaCota } from "@/lib/cotas";
import { duracaoEmTexto, legendaDoTamanho, ordemDeUrgencia, saldoDeFraldas } from "@/lib/fraldas";
import type { TamanhoFralda } from "@/lib/fraldas";
import { ehItemFechado, ordemDaListaPublica, type ItemDaLista } from "@/lib/presentes";
import type { ListaPublica } from "@/lib/presentes.functions";

/** Um token por CLIQUE — idempotência por intenção. Ver o SQL. */
function tokenDeClique(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function ListaDePresentesPublica({
  token,
  lista,
  aoReservar,
  aoCancelar,
}: {
  token: string;
  lista: ListaPublica;
  /** Injetável para a bancada desenhar a tela sem servidor. */
  aoReservar?: (p: {
    token: string;
    itemId: string;
    quantidade: number;
    quemNome: string;
    recado: string | null;
    idemKey: string;
  }) => Promise<{ ok: boolean; motivo?: string; maximo?: number; tokenReserva?: string }>;
  /** Injetável para a bancada. Sem ela, chama `cancelarReserva` de verdade. */
  aoCancelar?: (tokenReserva: string) => Promise<{ ok: boolean }>;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [recado, setRecado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [feitos, setFeitos] = useState<Record<string, number>>({});
  /**
   * O comprovante de cada reserva desta visita — o que torna o "Desfazer"
   * possível.
   *
   * ⚠️ **`cancelarReserva` estava escrita, testada e SEM CHAMADOR.** O servidor
   * sabia desfazer desde o primeiro dia; a tela jogava o `tokenReserva` fora no
   * instante em que ele chegava. Quem tocasse no item errado — e num cartão de
   * fralda, com quatro tamanhos empilhados, isso acontece — não tinha nenhuma
   * saída: nem cancelar, nem avisar, nem sequer entender o que ficou prometido.
   *
   * ⚠️ **NÃO vai para o `localStorage`, e isso é decisão.** O token de reserva
   * é uma CAPACIDADE — quem o tem cancela a promessa, sem login nenhum. O link
   * da lista roda no grupo do WhatsApp da família e é aberto em celular
   * emprestado; guardar a capacidade no aparelho deixaria a próxima pessoa
   * cancelando o presente da anterior. O desfazer vale enquanto a página está
   * aberta, que é a janela do arrependimento.
   */
  const [comprovantes, setComprovantes] = useState<Record<string, string>>({});

  /* As fraldas viram um bloco só, ordenado por carência; o resto é lista
     comum. Separar aqui e não no servidor é de propósito: a régua de ordem é
     pura e a tela é quem sabe que fralda tem cartão diferente. */
  const fraldas = useMemo(
    () => lista.itens.filter((i) => i.tipo === "fralda" && i.tamanho),
    [lista.itens],
  );
  const outros = useMemo(
    () => ordemDaListaPublica(lista.itens.filter((i) => i.tipo !== "fralda")),
    [lista.itens],
  );

  const saldos = useMemo(() => {
    const meta = {} as Record<TamanhoFralda, number>;
    const reservado = {} as Record<TamanhoFralda, number>;
    for (const f of fraldas) {
      meta[f.tamanho as TamanhoFralda] = f.meta;
      reservado[f.tamanho as TamanhoFralda] = f.reservado + (feitos[f.id] ?? 0);
    }
    return saldoDeFraldas(meta, reservado);
  }, [fraldas, feitos]);

  const ordem = useMemo(() => ordemDeUrgencia(saldos), [saldos]);
  const fraldaDe = (t: TamanhoFralda) => fraldas.find((f) => f.tamanho === t);

  async function reservar(item: ItemDaLista) {
    if (!nome.trim()) {
      toast.error("Coloque seu nome para ela saber quem foi 💛");
      return;
    }
    if (enviando) return;
    setEnviando(true);
    try {
      const chamar =
        aoReservar ??
        (async (p) => {
          const { reservarPorToken } = await import("@/lib/presentes.functions");
          return reservarPorToken({
            data: { ...p, revelarEm: null },
          }) as Promise<{
            ok: boolean;
            motivo?: string;
            maximo?: number;
            tokenReserva?: string;
          }>;
        });

      const r = await chamar({
        token,
        itemId: item.id,
        quantidade,
        quemNome: nome.trim(),
        recado: recado.trim() || null,
        idemKey: tokenDeClique(),
      });

      if (!r.ok) {
        /* O texto do "acima do teto" é o único lugar da tela que EXPLICA a
           régua das fraldas — e é o momento certo, porque ela acabou de
           esbarrar nela. Fora daqui seria um parágrafo que ninguém lê. */
        if (r.motivo === "acima-do-teto" && item.tipo === "fralda") {
          toast.error(
            r.maximo === 0
              ? `Esse tamanho já está completo 💛 Que tal outro? Os maiores duram mais.`
              : `Cabe mais ${r.maximo} ${r.maximo === 1 ? "pacote" : "pacotes"} desse tamanho.`,
          );
        } else if (r.motivo === "cota-fechada") {
          toast.error("Essa cota fechou — alguém acabou de completar 💛");
        } else if (r.motivo === "indisponivel") {
          toast.error("Essa lista não está disponível no momento.");
        } else {
          toast.error("Não deu para guardar. Tente de novo.");
        }
        return;
      }

      setFeitos((f) => ({ ...f, [item.id]: (f[item.id] ?? 0) + quantidade }));
      if (r.tokenReserva) setComprovantes((c) => ({ ...c, [item.id]: r.tokenReserva! }));
      setAberto(null);
      setRecado("");
      setQuantidade(1);
      toast.success("Guardado 💛 Ela vai saber que foi você.");
    } catch {
      toast.error("Não deu para guardar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  /**
   * DESFAZER a reserva.
   *
   * ⚠️ **Marca, nunca apaga** (é o servidor quem decide isso), e a tela só
   * devolve o contador ao que era: ela nunca reservou mais de uma vez pelo
   * mesmo cartão nesta visita, então subtrair o que ela acabou de somar é
   * exato.
   */
  async function desfazer(item: ItemDaLista) {
    const tk = comprovantes[item.id];
    if (!tk || enviando) return;
    setEnviando(true);
    try {
      const chamar =
        aoCancelar ??
        (async (t: string) => {
          const { cancelarReserva } = await import("@/lib/presentes.functions");
          return (await cancelarReserva({ data: { tokenReserva: t } })) as { ok: boolean };
        });
      const r = await chamar(tk);
      if (!r.ok) {
        toast.error("Não deu para desfazer. Tente de novo.");
        return;
      }
      setFeitos((f) => {
        const resto = { ...f };
        delete resto[item.id];
        return resto;
      });
      setComprovantes((c) => {
        const resto = { ...c };
        delete resto[item.id];
        return resto;
      });
      toast.success("Desfeito. Ninguém fica sabendo 💛");
    } catch {
      toast.error("Não deu para desfazer. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  /**
   * "Você marcou · Desfazer" — a linha que aparece depois de reservar.
   *
   * ⚠️ **Um componente só para os DOIS cartões** (fralda e item comum): duas
   * cópias divergiriam no primeiro ajuste, e esta é a única saída que a amiga
   * tem depois de tocar no item errado.
   */
  function Desfazer({ item }: { item: ItemDaLista }) {
    if (!comprovantes[item.id]) return null;
    return (
      <div className="mt-2 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2">
        <span className="min-w-0 flex-1 text-xs text-foreground">Você marcou esse 💛</span>
        <button
          type="button"
          disabled={enviando}
          onClick={() => void desfazer(item)}
          className="press shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Desfazer
        </button>
      </div>
    );
  }

  function Formulario({ item }: { item: ItemDaLista }) {
    const cota = item.tipo === "cota";
    return (
      <div className="mt-3 space-y-2.5 border-t border-border pt-3">
        <label className="block text-xs font-medium text-muted-foreground">
          Seu nome
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como ela te chama"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          {cota ? "Quantas cotas" : item.tipo === "fralda" ? "Quantos pacotes" : "Quantos"}
          <input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block text-xs font-medium text-muted-foreground">
          Recado (opcional)
          <textarea
            value={recado}
            onChange={(e) => setRecado(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Uma palavrinha pra ela"
            className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAberto(null)}
            className="press flex-1 rounded-xl border border-border px-3 py-2 text-sm font-medium"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => reservar(item)}
            disabled={enviando}
            className="press flex-[2] rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {enviando ? "Guardando…" : "Vou dar esse 💛"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">
          {lista.titulo?.trim() || `Lista da ${lista.donaNome}`}
        </h1>
        {lista.recado?.trim() && (
          <p className="mt-2 text-sm text-muted-foreground">{lista.recado}</p>
        )}
      </header>

      {/* ─── AS FRALDAS ────────────────────────────────────────────────── */}
      {fraldas.length > 0 && (
        <section className="rounded-3xl card-material p-4">
          <h2 className="font-semibold">Fraldas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os tamanhos maiores duram muito mais — e são os que costumam faltar.
          </p>
          <ul className="mt-3 space-y-2">
            {ordem.map((t) => {
              const f = fraldaDe(t);
              const s = saldos.find((x) => x.tamanho === t);
              if (!f || !s) return null;
              const cheio = s.cheio;
              return (
                <li
                  key={t}
                  className={`rounded-2xl p-3 ${cheio ? "bg-muted/40 opacity-70" : "bg-muted/60"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {t}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        · dura {duracaoEmTexto(t)}
                      </span>
                    </span>
                    {cheio && <span className="text-xs">completo 💛</span>}
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, s.fracao * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                    {legendaDoTamanho(s)}
                  </p>
                  <Desfazer item={f} />
                  {!cheio &&
                    !comprovantes[f.id] &&
                    (aberto === f.id ? (
                      <Formulario item={f} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAberto(f.id)}
                        className="press mt-2 w-full rounded-xl border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary"
                      >
                        Quero dar desse
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ─── O RESTO DA LISTA ──────────────────────────────────────────── */}
      {outros.length > 0 && (
        <section className="space-y-2.5">
          {outros.map((i) => {
            const feito = ehItemFechado({ ...i, reservado: i.reservado + (feitos[i.id] ?? 0) });
            const cota = i.tipo === "cota" && i.centavosTotal;
            const e = estadoDaCota(i.meta, i.reservado + (feitos[i.id] ?? 0));
            return (
              <div
                key={i.id}
                className={`rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] ${
                  feito ? "opacity-70" : ""
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{i.titulo}</h3>
                  {feito && <span className="shrink-0 text-xs">completo 💛</span>}
                </div>
                {i.nota && <p className="mt-1 text-xs text-muted-foreground">{i.nota}</p>}

                {cota && (
                  <>
                    <p className="mt-2 text-sm font-medium text-primary">
                      {chamadaDaCota(i.centavosTotal!, i.meta)}
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(100, e.fracao * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {legendaDaCota(e)}
                    </p>
                  </>
                )}

                <Desfazer item={i} />
                {!feito &&
                  !comprovantes[i.id] &&
                  (aberto === i.id ? (
                    <Formulario item={i} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAberto(i.id)}
                      className="press mt-2 w-full rounded-xl border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary"
                    >
                      {cota ? "Quero entrar nesse" : "Vou dar esse"}
                    </button>
                  ))}
              </div>
            );
          })}
        </section>
      )}

      {lista.itens.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          A lista ainda está sendo montada. Volte daqui a pouco 💛
        </p>
      )}

      <p className="pb-4 text-center text-[11px] text-muted-foreground">
        Nada é cobrado por aqui — você combina direto com {lista.donaNome}.
      </p>
    </div>
  );
}
