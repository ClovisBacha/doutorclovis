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
import { legendaDaCota, estadoDaCota, sugerirCotas } from "@/lib/cotas";
import { SITE } from "@/lib/indicacao";
import {
  legendaDoTamanho,
  ordemDeUrgencia,
  saldoDeFraldas,
  type TamanhoFralda,
} from "@/lib/fraldas";
import { progressoDaLista, textoDoConvite } from "@/lib/presentes";
import type { ListaDaDona } from "@/lib/presentes.functions";

export type BancadaDoCha = { lista: ListaDaDona; guardados: number };

/**
 * "R$ 150" — o valor de UMA cota, a partir do total e do número de pedaços.
 *
 * ⚠️ **Arredonda para baixo, e a diferença some na ÚLTIMA cota** — é a mesma
 * decisão de `cotas.ts` (R$ 1.200 ÷ 7 dá 17143 centavos, e sete deles somam um
 * centavo a mais). Aqui o número é só a etiqueta do botão; quem manda no valor
 * cobrado é a régua no servidor. Espalhar o resto entre as primeiras faria a
 * tela mostrar dois preços para a mesma cota.
 */
function reaisPorCota(centavosTotal: number, pedacos: number): string {
  const c = Math.floor(centavosTotal / pedacos);
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
  /* ⚠️ **`titulo` É DA LISTA; `novoTitulo` é do ITEM.** Os dois existiam com
     nomes parecidos e só um tinha tela — foi assim que os três campos do
     convite passaram despercebidos. */
  const [titulo, setTitulo] = useState(bancada?.lista?.titulo ?? "");
  const [recado, setRecado] = useState(bancada?.lista?.recado ?? "");
  const [dataDoCha, setDataDoCha] = useState(bancada?.lista?.dataDoCha ?? "");
  const [salvandoConvite, setSalvandoConvite] = useState(false);
  /* ⚠️ **AS COTAS NÃO TINHAM COMO NASCER.** O servidor aceita `tipo: "cota"`,
     a régua está inteira e testada (`cotas.ts`, com o caso do R$ 1.200 ÷ 7), e
     a página pública desenha a reserva de cota — mas o único lugar do `src/`
     que escrevia `tipo: "cota"` era a BANCADA. Nenhuma gestante conseguia criar
     uma: o formulário mandava `tipo: "item"` cravado. Das três espécies, a
     fralda nasce semeada com a lista e o item comum tem formulário; a cota era
     uma função documentada como pronta e inalcançável.

     ⚠️ E é a bancada que fazia parecer entregue — mesmo defeito das sete
     funções de servidor sem porta, que também só existiam em `/preview-*`. */
  const [ehCota, setEhCota] = useState(false);
  /** Em REAIS, como ela digita. Vira centavos só na hora de mandar. */
  const [valorDaCota, setValorDaCota] = useState("");
  const [pedacos, setPedacos] = useState<number | null>(null);

  /* O total em centavos, ou 0 quando o campo ainda não é um número. */
  const centavosDaCota = useMemo(() => {
    const n = Number(valorDaCota.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [valorDaCota]);
  const sugestoesDeCota = useMemo(() => sugerirCotas(centavosDaCota), [centavosDaCota]);
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
        if (r.ok) {
          setDados({ lista: r.lista, guardados: r.guardados });
          /* ⚠️ **OS CAMPOS SÃO SEMEADOS AQUI, e não no `useState`.** O
             inicializador roda uma vez, ANTES de a lista chegar — sem esta
             linha, os três abririam vazios sobre um convite já escrito, e o
             primeiro salvamento apagaria o que ela tinha. */
          setTitulo(r.lista.titulo ?? "");
          setRecado(r.lista.recado ?? "");
          setDataDoCha(r.lista.dataDoCha ?? "");
        }
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

  /**
   * O endereço que ela manda para a família.
   *
   * ⚠️ **`SITE`, e NUNCA `window.location.origin`.** O guarda
   * `typeof window === "undefined"` evita o CRASH no servidor e **não evita a
   * DIVERGÊNCIA**: o servidor renderizava `/presente/<token>` e o cliente
   * `http://127.0.0.1:8080/presente/<token>`, e as duas execuções são
   * exatamente as que precisam concordar — o React descarta a árvore e
   * remonta.
   *
   * É o mesmo defeito que o endereço da vitrine já pagou neste repositório, num
   * arquivo diferente. Aqui ele ficou invisível porque a tela da DONA não tinha
   * bancada: em produção ela é alcançada por navegação do cliente, então o
   * servidor nunca a desenhava.
   *
   * E `SITE` é mais certo por um segundo motivo: este link é COPIADO para o
   * WhatsApp da família. `origin` num preview da Vercel gravaria o endereço do
   * preview na conversa, para sempre.
   */
  const url = useMemo(() => (lista ? `${SITE}/presente/${lista.token}` : ""), [lista]);

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
        /* ⚠️ "contagem-ilegivel" tem texto PRÓPRIO: dizer "alguém já reservou"
           sobre uma leitura que falhou faria a mãe procurar uma reserva que
           talvez não exista, e desistir de tirar um item que ela pode tirar. */
        const motivo = "motivo" in r ? r.motivo : null;
        toast.error(
          motivo === "tem-reserva"
            ? "Alguém já reservou esse item — fale com ela antes de tirar 💛"
            : motivo === "contagem-ilegivel"
              ? "Não consegui conferir se alguém já reservou — tente de novo."
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
      /* ⚠️ **Centavos INTEIROS, e a conversão mora aqui.** `sugerirCotas` e
         `estadoDaCota` trabalham em centavos porque R$ 1.200 ÷ 7 é o caso que
         quebra em ponto flutuante — `Math.round` no total, uma vez, e nunca
         aritmética de reais espalhada pela tela. */
      const centavos = ehCota ? centavosDaCota : null;
      /* ⚠️ **Confere aqui, e não só no botão desabilitado.** `ItemSchema` exige
         `meta >= 1` e `centavosTotal` entre 1 e R$ 100.000 — um payload fora
         disso volta como erro de banco genérico ("não deu para guardar"), que
         não diz à mãe o que corrigir. O `disabled` é do cliente e some com um
         toque em outra ordem; a régua tem de estar no caminho do envio. */
      if (ehCota && (!pedacos || centavos == null || centavos < 1 || centavos > 100_000_00)) {
        toast.error("Confira o valor e escolha em quantas cotas dividir.");
        return;
      }
      const r = await salvarItens({
        data: {
          accessToken: token,
          itens: [
            {
              id: null,
              tipo: ehCota ? "cota" : "item",
              titulo: t,
              nota: null,
              ordem: 100 + lista!.itens.length,
              tamanho: null,
              /* Na cota, `meta` é o NÚMERO DE COTAS; no item comum, 1. */
              meta: ehCota ? pedacos! : 1,
              teto: null,
              centavosTotal: centavos,
            },
          ],
        },
      });
      if (!r.ok) {
        toast.error("Não deu para guardar o item.");
        return;
      }
      setNovoTitulo("");
      setEhCota(false);
      setValorDaCota("");
      setPedacos(null);
      const novo = await minhaLista({ data: { accessToken: token } });
      if (novo.ok) setDados({ lista: novo.lista, guardados: novo.guardados });
      toast.success("Item na lista 💛");
    } catch {
      toast.error("Não deu para guardar o item.");
    }
  }

  /**
   * O convite mudou em relação ao que está guardado?
   *
   * ⚠️ **É o que impede o botão de prometer trabalho que não existe.** Sem a
   * comparação, "Salvar convite" fica aceso para sempre — e um botão que
   * sempre pode ser tocado ensina que tocar nele não significa nada.
   */
  const mudouConvite =
    !!dados &&
    (titulo.trim() !== (dados.lista.titulo ?? "") ||
      recado.trim() !== (dados.lista.recado ?? "") ||
      dataDoCha !== (dados.lista.dataDoCha ?? ""));

  /**
   * O nome do bebê no exemplo do campo.
   *
   * ⚠️ **SEM ARTIGO, e eu reintroduzi essa armadilha nesta mesma rodada.**
   * Escrevi o artigo saindo da PRIMEIRA LETRA e o resultado medido foi
   * "Chá de bebê **do** Helena": inicial não é sinal de gênero em português, e
   * `baby_name` não carrega gênero nenhum. É o mesmo defeito que o bolão teve
   * ("Quando o Helena nasce?") e que o agradecimento do chá já documenta —
   * aparecendo pela terceira vez, num arquivo diferente.
   *
   * O travessão resolve sem adivinhar nada.
   */
  const nomeDoBebe = dados?.lista.bebeNome ?? null;
  const placeholderDoTitulo = nomeDoBebe ? `Chá de bebê — ${nomeDoBebe}` : "Chá de bebê";

  async function salvarConvite() {
    if (!dados || salvandoConvite || !mudouConvite) return;
    setSalvandoConvite(true);
    try {
      const s = await supabase.auth.getSession();
      const token = s.data.session?.access_token;
      if (!token) return;
      const { salvarItens, minhaLista } = await import("@/lib/presentes.functions");
      /**
       * ⚠️ **SEM `itens` — e é o servidor que separa os dois assuntos.**
       *
       * `salvarItens` grava o convite E a lista. Reenviar a lista aqui pediria
       * que a tela remontasse a forma exata que o schema espera, e qualquer
       * diferença apagaria itens que ninguém pediu para apagar. O campo virou
       * opcional: ausente quer dizer "não mexi na lista".
       *
       * ⚠️ **E vazio vira `null`, nunca `""`.** A coluna é `text` nullable, e a
       * página pública decide o texto padrão pelo `null`: com string vazia, o
       * convite abriria com um título em branco em vez do padrão.
       */
      const r = await salvarItens({
        data: {
          accessToken: token,
          titulo: titulo.trim() || null,
          recado: recado.trim() || null,
          dataDoCha: dataDoCha || null,
        },
      });
      if (!r.ok) {
        toast.error("Não deu para salvar o convite.");
        return;
      }
      /* Relê do servidor: é ele que decide o que ficou guardado, e pintar o que
         eu mandei deixaria a tela certa e o banco diferente. */
      const novo = await minhaLista({ data: { accessToken: token } });
      if (novo.ok) setDados({ lista: novo.lista, guardados: novo.guardados });
      toast.success("Convite salvo 💛");
    } catch {
      toast.error("Não deu para salvar o convite.");
    } finally {
      setSalvandoConvite(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* O título mora no cabeçalho da porta (`CabecalhoDaPorta`, em
          `minha-conta`), que já diz "Chá de bebê" sobre a família rosa. Aqui fica
          só a frase de abertura — um segundo título seria eco. */}
      <header>
        <p className="text-sm text-muted-foreground">
          Monte a lista, mande o link. Quem quiser dar escolhe o que ainda cabe.
        </p>
      </header>

      {/* ─── O CONVITE: TÍTULO, RECADO E DATA ──────────────────────────────
          ⚠️ **AS TRÊS COLUNAS EXISTIAM E NÃO TINHAM PORTA NENHUMA.**
          `salvarItens` aceita `titulo`, `recado` e `dataDoCha`, o handler as
          grava e `minhaLista` as devolve — e o único chamador mandava só
          `itens`. A lista abria com o texto padrão para todo mundo, e a
          página que a amiga recebe é justamente onde essas três informações
          fazem o convite parecer um convite.

          ⚠️ **`type="date"`, e não texto.** Data em campo livre já custou três
          horas nesta base (`confirmed_time` aceitando "manhã"), e aqui ela vai
          para uma coluna `date`. */}
      <section className="rounded-3xl card-material p-4">
        <p className="font-serif text-[15px] font-semibold text-muted-foreground">O convite</p>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
          /* ⚠️ **O NOME DO BEBÊ VAI SEM ARTIGO CRAVADO** — "d{a|o}" sai da
              primeira letra, senão "A Miguel". É a mesma armadilha que o bolão
              teve e que o agradecimento do chá já documenta. */
          placeholder={placeholderDoTitulo}
          aria-label="Título da lista"
          className="mt-2 min-h-[44px] w-full rounded-2xl border border-border bg-background px-3 text-sm"
        />
        <textarea
          value={recado}
          onChange={(e) => setRecado(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="Um recado para quem abrir (opcional)"
          aria-label="Recado da lista"
          className="mt-2 w-full resize-none rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">Data do chá</span>
          <input
            type="date"
            value={dataDoCha}
            onChange={(e) => setDataDoCha(e.target.value)}
            aria-label="Data do chá"
            className="min-h-[44px] flex-1 rounded-2xl border border-border bg-background px-3 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={salvandoConvite || !mudouConvite}
          onClick={() => void salvarConvite()}
          className="press mt-2 min-h-[44px] w-full rounded-2xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {salvandoConvite ? "Salvando…" : mudouConvite ? "Salvar convite" : "Convite salvo"}
        </button>
      </section>

      {/* ─── O LINK ────────────────────────────────────────────────────── */}
      <section className="rounded-3xl card-material p-4">
        <p className="font-serif text-[15px] font-semibold text-muted-foreground">Seu link</p>
        <p className="mt-1 break-all text-sm text-foreground">{url}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={copiar}
            className="btn-3d press min-h-11 flex-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            Copiar convite
          </button>
          <a
            href={linkDeWhatsApp(textoDoConvite({ bebeNome: lista.bebeNome, url }))}
            target="_blank"
            rel="noreferrer"
            className="pill-3d press min-h-11 flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold"
          >
            Mandar no WhatsApp
          </a>
        </div>
      </section>

      {/* ─── O QUE JÁ CHEGOU ───────────────────────────────────────────── */}
      <section className="rounded-3xl card-material p-4">
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
      <section className="rounded-3xl card-material p-4">
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
                    {/* ✕ desenhado em texto: é o único controle destrutivo
                        desta tela.
                        ⚠️ E ESTE COMENTÁRIO PROMETIA "44px" QUE O CÓDIGO NUNCA
                        ENTREGOU. Medido a 393px: o desenho é 29×32 e o alvo
                        efetivo é 28×18 — metade do mínimo em altura.
                        ⚠️ PIOR: o toque 10px ABAIXO do centro já acerta o ✕ da
                        LINHA DE BAIXO. Num controle que tira item da lista,
                        isso tira o item errado. A causa é o `-my-2`: as caixas
                        dos botões se encavalam.
                        ⚠️ E NÃO SE CONSERTA COM `after:-inset`. Foi tentado e
                        medido: estender a área do dedo põe o pseudo-elemento do
                        vizinho por cima, e a altura efetiva CAI de 18 para 6.
                        O conserto de verdade é a ALTURA DA LINHA (botão h-11
                        com a linha acompanhando), que muda o desenho da lista —
                        decisão do dono, não remendo. */}
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
            disabled={ehCota && !pedacos}
            className="press shrink-0 rounded-xl border border-primary/40 px-3 py-2 text-sm font-medium text-primary disabled:opacity-40"
          >
            Pôr na lista
          </button>
        </div>

        {/* ─── DIVIDIR EM COTAS ──────────────────────────────────────────
            ⚠️ **Desligado por padrão.** A maioria dos itens de um chá é item
            simples; abrir o formulário já em modo cota faria toda mãe decidir
            sobre divisão para acrescentar uma mamadeira. */}
        <label className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          <input
            type="checkbox"
            checked={ehCota}
            onChange={(e) => {
              setEhCota(e.target.checked);
              if (!e.target.checked) {
                setValorDaCota("");
                setPedacos(null);
              }
            }}
            className="h-4 w-4 accent-primary"
          />
          É caro — quero dividir em cotas
        </label>

        {ehCota && (
          <div className="mt-2 rounded-2xl border border-border p-3">
            <label className="block text-xs text-muted-foreground" htmlFor="valor-da-cota">
              Quanto custa, mais ou menos?
            </label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">R$</span>
              <input
                id="valor-da-cota"
                inputMode="decimal"
                value={valorDaCota}
                onChange={(e) => {
                  /* Só dígito, vírgula e ponto: o campo vira centavos depois, e
                     letra aqui viraria `NaN` no `Math.round`. */
                  setValorDaCota(e.target.value.replace(/[^\d.,]/g, "").slice(0, 9));
                  setPedacos(null);
                }}
                placeholder="1200"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {/* ⚠️ **As opções saem de `sugerirCotas`, que já existia e não tinha
                CHAMADOR NENHUM.** Ela é quem garante o piso de R$ 25 por cota:
                "12x de R$ 8" transforma o carrinho numa vaquinha de trocado —
                o oposto do que a cota existe para fazer. Deixar a mãe digitar
                um número livre reintroduziria exatamente isso. */}
            {sugestoesDeCota.length > 0 ? (
              <>
                <p className="mt-2.5 text-xs text-muted-foreground">Dividir em:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sugestoesDeCota.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPedacos(n)}
                      aria-pressed={pedacos === n}
                      className={`press rounded-full border px-3 py-1.5 text-[13px] ${
                        pedacos === n
                          ? "border-primary bg-primary/10 font-semibold text-primary"
                          : "border-border"
                      }`}
                    >
                      {n}x de {reaisPorCota(centavosDaCota, n)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* ⚠️ Diz o PISO, não "valor inválido": sem o número ela não sabe
                 o que corrigir, e o piso é a regra inteira. */
              valorDaCota.trim() !== "" && (
                <p className="mt-2.5 text-xs text-muted-foreground">
                  Para dividir, o presente precisa custar pelo menos R$ 50 — cada cota não pode
                  ficar abaixo de R$ 25.
                </p>
              )
            )}
          </div>
        )}
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
        <section className="rounded-3xl card-material p-4">
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
